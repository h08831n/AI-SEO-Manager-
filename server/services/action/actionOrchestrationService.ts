import { prisma } from '../../db/prisma';
import { ActionStatus, AutomationRiskLevel } from '@prisma/client';
import { ActionExecutorRouter } from './executors/actionExecutorRouter';
import { GovernanceEngine } from './governanceEngine';
import { VerificationEngine } from './verificationEngine';
import { LearningLoopEngine } from '../decision/learningLoopEngine';
import { AuditLogRepository } from '../../repositories/auditLogRepository';
import { ActionSnapshotService } from './snapshots/actionSnapshotService';

export interface ExecuteActionParams {
  websiteId: string;
  taskId?: string;
  recommendationId?: string;
  actionType: string;
  targetUrl: string;
  payload: Record<string, any>;
  idempotencyKey: string;
  userId?: string;
  userRole?: string;
  isDryRun?: boolean;
  autoVerify?: boolean;
  platform?: string;
}

export class ActionOrchestrationService {
  /**
   * Orchestrates safe action execution with dry runs, pre-state snapshotting, and automatic verification.
   */
  public static async executeAction(params: ExecuteActionParams): Promise<{
    success: boolean;
    actionExecutionId: string;
    state: ActionStatus;
    preStateSnapshot?: any;
    appliedState?: any;
    diffSummary?: string;
    verificationResult?: any;
    rolledBack?: boolean;
    message?: string;
    isDuplicate?: boolean;
  }> {
    const {
      websiteId,
      taskId,
      recommendationId,
      actionType,
      targetUrl,
      payload,
      idempotencyKey,
      userId,
      userRole,
      isDryRun = false,
      autoVerify = true,
      platform,
    } = params;

    // 1. Idempotency Check
    const existingExecution = await prisma.actionExecution.findFirst({
      where: { idempotencyKey },
    });

    if (existingExecution && !isDryRun) {
      return {
        success: true,
        actionExecutionId: existingExecution.id,
        state: existingExecution.state,
        message: 'Duplicate idempotent execution detected. Returning existing execution.',
        isDuplicate: true,
      };
    }

    // 2. Resolve Target and Executor
    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    const target = {
      websiteId,
      targetUrl,
      domain: website?.domain || 'example.com',
      platform,
    };

    const executor = ActionExecutorRouter.getExecutor(actionType);

    // 3. Dry-run Validation
    const validation = await executor.validate(target, payload);
    if (!validation.valid) {
      throw new Error(`Action validation failed: ${validation.errors?.join(', ')}`);
    }

    if (isDryRun) {
      return {
        success: true,
        actionExecutionId: `dry-run-${Date.now()}`,
        state: ActionStatus.DRY_RUN_VALIDATED,
        message: 'Dry run completed successfully. Payload is valid and ready for execution.',
      };
    }

    // 4. Governance & Safety Checks
    const governance = await GovernanceEngine.evaluateExecutionGovernance({
      websiteId,
      actionType,
      automationLevel: AutomationRiskLevel.LEVEL_1_SAFE_AUTOMATION,
      isManualTrigger: Boolean(userId),
      userRole,
    });

    if (!governance.allowed && !userId) {
      throw new Error(`Execution blocked by Governance Engine: ${governance.reason}`);
    }

    // 5. Capture Pre-State Snapshot
    const preStateSnapshot = await executor.capturePreState(target);

    // 6. Record ActionExecution with EXECUTING status
    const actionExecution = await prisma.actionExecution.create({
      data: {
        websiteId,
        taskId,
        recommendationId,
        actionType,
        targetUrl,
        idempotencyKey,
        requestedByUserId: userId,
        state: ActionStatus.EXECUTING,
        attemptCount: 1,
        beforeEvidenceJson: JSON.stringify(preStateSnapshot),
        executedAt: new Date(),
      },
    });

    // 7. Persist Snapshot in ActionSnapshotService for restart survival
    await ActionSnapshotService.savePreStateSnapshot({
      actionExecutionId: actionExecution.id,
      websiteId,
      actionType,
      targetUrl,
      preState: preStateSnapshot,
    });

    // 8. Execute Atomic Action
    const execResult = await executor.apply(target, payload, preStateSnapshot);

    // 9. Update DB with applied state
    await prisma.actionExecution.update({
      where: { id: actionExecution.id },
      data: {
        state: ActionStatus.AWAITING_VERIFICATION,
        afterEvidenceJson: JSON.stringify(execResult.appliedState),
      },
    });

    if (taskId) {
      await prisma.seoTask.update({
        where: { id: taskId },
        data: {
          status: ActionStatus.AWAITING_VERIFICATION,
          executedAt: new Date(),
        },
      });
    }

    // 10. Immutable Audit Log & Outbox Event
    await AuditLogRepository.log({
      websiteId,
      actionName: `EXECUTE_${actionType}`,
      affectedUrl: targetUrl,
      triggeredBy: userId ? `USER_${userId}` : 'AUTONOMOUS_ENGINE',
      reason: execResult.message || 'Action executed by Autonomous SEO System',
      beforeStateJson: JSON.stringify(preStateSnapshot),
      afterStateJson: JSON.stringify(execResult.appliedState),
      isReversible: true,
      isReverted: false,
      correlationId: idempotencyKey,
    });

    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'ACTION_EXECUTION',
        aggregateId: actionExecution.id,
        eventType: 'ACTION_EXECUTED',
        payloadJson: JSON.stringify({
          actionExecutionId: actionExecution.id,
          websiteId,
          actionType,
          targetUrl,
          appliedState: execResult.appliedState,
        }),
      },
    });

    // 11. Automated Closed-Loop Verification (Stage 1: HTTP / DOM / Schema)
    let verificationResult: any = null;
    let rolledBack = false;

    if (autoVerify) {
      let ruleKey: string | undefined;
      if (recommendationId) {
        const rec = await prisma.seoRecommendation.findUnique({ where: { id: recommendationId } });
        ruleKey = rec?.ruleKey || undefined;
      }

      verificationResult = await VerificationEngine.runStage1SyntheticVerification({
        actionExecutionId: actionExecution.id,
        websiteId,
        actionType,
        targetUrl,
        expectedState: payload,
        ruleKey,
        platform,
      });

      // If immediate synthetic verification fails -> AUTOMATIC ROLLBACK
      if (verificationResult.requiresRollback) {
        const rollbackRes = await this.rollbackAction({
          actionExecutionId: actionExecution.id,
          websiteId,
          reason: `Automatic rollback triggered: Stage 1 synthetic verification failed (${verificationResult.varianceDetails})`,
          platform,
        });
        rolledBack = rollbackRes.success;
      } else if (taskId) {
        await prisma.seoTask.update({
          where: { id: taskId },
          data: { status: ActionStatus.VERIFIED_COMPLETED, completedAt: new Date() },
        });
      }
    }

    return {
      success: !rolledBack,
      actionExecutionId: actionExecution.id,
      state: rolledBack ? ActionStatus.REVERTED_RESTORED : ActionStatus.VERIFIED_COMPLETED,
      preStateSnapshot,
      appliedState: execResult.appliedState,
      diffSummary: execResult.diffSummary,
      verificationResult,
      rolledBack,
      message: rolledBack ? 'Verification failed; action automatically rolled back' : execResult.message,
    };
  }

  /**
   * Executes a 1-click deterministic rollback by restoring the pre-state snapshot.
   * Survives worker restarts by reloading snapshot from durable database storage.
   */
  public static async rollbackAction(params: {
    actionExecutionId: string;
    websiteId: string;
    reason?: string;
    userId?: string;
    platform?: string;
  }): Promise<{ success: boolean; message: string; restoredState: any }> {
    const startTime = Date.now();
    const { actionExecutionId, websiteId, reason, userId, platform } = params;

    const execution = await prisma.actionExecution.findFirst({
      where: { id: actionExecutionId, websiteId },
      include: { recommendation: true, task: true },
    });

    if (!execution) {
      throw new Error(`Action execution '${actionExecutionId}' not found for website '${websiteId}'`);
    }

    // Retrieve snapshot from persistent SnapshotService (handles worker restart recovery)
    const snapshotEntity = await ActionSnapshotService.getPreStateSnapshot(actionExecutionId);
    let preStateSnapshot = snapshotEntity?.preStateJson ? JSON.parse(snapshotEntity.preStateJson) : null;

    if (!preStateSnapshot && execution.beforeEvidenceJson) {
      preStateSnapshot = JSON.parse(execution.beforeEvidenceJson);
    }

    if (!preStateSnapshot) {
      throw new Error(`Cannot rollback action '${actionExecutionId}': Missing preStateSnapshot.`);
    }

    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    const target = {
      websiteId,
      targetUrl: execution.targetUrl,
      domain: website?.domain || 'example.com',
      platform,
    };

    const executor = ActionExecutorRouter.getExecutor(execution.actionType);
    const rollbackResult = await executor.rollback(target, preStateSnapshot);

    // Update ActionExecution state to REVERTED_RESTORED
    await prisma.actionExecution.update({
      where: { id: actionExecutionId },
      data: {
        state: ActionStatus.REVERTED_RESTORED,
        failureReason: reason || 'Rollback triggered',
        updatedAt: new Date(),
      },
    });

    if (execution.taskId) {
      await prisma.seoTask.update({
        where: { id: execution.taskId },
        data: { status: ActionStatus.REVERTED_RESTORED },
      });
    }

    // Persist to RollbackExecutionHistory
    await ActionSnapshotService.recordRollbackHistory({
      actionExecutionId,
      websiteId,
      rolledBackByUserId: userId,
      reason: reason || 'Rollback triggered',
      preStateRestored: rollbackResult.restoredState,
      success: rollbackResult.success,
      durationMs: Date.now() - startTime,
    });

    // Learning Loop: Record Rollback outcome
    const ruleKey = execution.recommendation?.ruleKey;
    if (ruleKey) {
      await LearningLoopEngine.recordActionOutcome({
        ruleKey,
        websiteId,
        actionExecutionId,
        actionType: execution.actionType,
        outcome: 'ROLLED_BACK',
      });
    }

    // Audit Logging
    await AuditLogRepository.log({
      websiteId,
      actionName: `ROLLBACK_${execution.actionType}`,
      affectedUrl: execution.targetUrl,
      triggeredBy: userId ? `USER_${userId}` : 'AUTONOMOUS_ROLLBACK_ENGINE',
      reason: reason || rollbackResult.message || 'Action rolled back',
      beforeStateJson: execution.afterEvidenceJson,
      afterStateJson: JSON.stringify(rollbackResult.restoredState),
      isReversible: true,
      isReverted: true,
      correlationId: execution.idempotencyKey,
    });

    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'ACTION_EXECUTION',
        aggregateId: actionExecutionId,
        eventType: 'ACTION_ROLLED_BACK',
        payloadJson: JSON.stringify({
          actionExecutionId,
          websiteId,
          reason,
          restoredState: rollbackResult.restoredState,
        }),
      },
    });

    return {
      success: true,
      message: rollbackResult.message || 'Successfully rolled back action and restored pre-state',
      restoredState: rollbackResult.restoredState,
    };
  }
}
