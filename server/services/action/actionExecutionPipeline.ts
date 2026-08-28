/**
 * Phase C & D: Authoritative Action Execution Pipeline
 * 
 * Central, deterministic pipeline governing all SEO mutations.
 * Enforces:
 * - Tenancy validation
 * - Risk classification (LOW, MEDIUM, HIGH, CRITICAL)
 * - Autonomy safety gate & Global Autonomy Killswitch
 * - Pre-state snapshotting
 * - Execution through ICmsActionProvider / ActionExecutorRouter
 * - Independent verification (Stage 1 Synthetic & DOM check)
 * - Automatic deterministic rollback upon verification failure
 * - Outbox events & immutable audit logging
 */

import { prisma } from '../../db/prisma';
import { ActionStatus, AutomationRiskLevel } from '@prisma/client';
import { ActionExecutorRouter } from './executors/actionExecutorRouter';
import { GovernanceEngine } from './governanceEngine';
import { VerificationEngine } from './verificationEngine';
import { AuditLogRepository } from '../../repositories/auditLogRepository';
import { ActionSnapshotService } from './snapshots/actionSnapshotService';
import { OutboxDispatcher } from '../outbox/outboxDispatcher';

export type ActionExecutionMode = 'MANUAL' | 'AUTONOMOUS' | 'CANARY';
export type ActionRiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ActionExecutionPipelineParams {
  websiteId: string;
  taskId?: string;
  recommendationId?: string;
  actionType: string;
  targetUrl: string;
  payload: Record<string, any>;
  idempotencyKey: string;
  executionMode: ActionExecutionMode;
  userId?: string;
  userRole?: string;
  isDryRun?: boolean;
  autoVerify?: boolean;
  platform?: string;
  correlationId?: string;
}

export interface ActionExecutionPipelineResult {
  success: boolean;
  actionExecutionId: string;
  state: ActionStatus;
  executionMode: ActionExecutionMode;
  riskTier: ActionRiskTier;
  preStateSnapshot?: any;
  appliedState?: any;
  diffSummary?: string;
  verificationResult?: any;
  rolledBack?: boolean;
  message?: string;
  isDuplicate?: boolean;
  correlationId?: string;
}

export class ActionExecutionPipeline {
  /**
   * Classifies action risk tier deterministically.
   */
  public static classifyRisk(actionType: string, payload: Record<string, any>): ActionRiskTier {
    const type = actionType.toUpperCase();

    // Critical: Sitewide redirects, robots modifications, noindex directives
    if (
      type.includes('REDIRECT') ||
      payload.robotsMeta?.includes('noindex') ||
      payload.robotsMeta?.includes('none')
    ) {
      return 'CRITICAL';
    }

    // High: Canonical modifications, mass metadata updates
    if (type.includes('CANONICAL') || type.includes('STRUCTURED_DATA') || type.includes('SCHEMA')) {
      return 'HIGH';
    }

    // Medium: Internal link injections, extensive content refreshes
    if (type.includes('LINK') || type.includes('CONTENT')) {
      return 'MEDIUM';
    }

    // Low: Standard title/meta descriptions
    return 'LOW';
  }

  /**
   * Central execution entry point for all SEO mutations.
   */
  public static async execute(params: ActionExecutionPipelineParams): Promise<ActionExecutionPipelineResult> {
    const {
      websiteId,
      taskId,
      recommendationId,
      actionType,
      targetUrl,
      payload,
      idempotencyKey,
      executionMode,
      userId,
      userRole,
      isDryRun = false,
      autoVerify = true,
      platform,
      correlationId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    } = params;

    // 1. Validate Tenancy
    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) {
      throw new Error(`TENANCY_VIOLATION: Website '${websiteId}' does not exist or access is unauthorized.`);
    }

    // 2. Classify Risk
    const riskTier = this.classifyRisk(actionType, payload);

    // 3. Global Autonomy Killswitch Verification
    const isAutonomous = executionMode === 'AUTONOMOUS' || executionMode === 'CANARY';
    const isAutonomyEnabled = process.env.AUTONOMOUS_EXECUTION_ENABLED === 'true';

    if (isAutonomous && !isAutonomyEnabled && !userId) {
      throw new Error('AUTONOMY_DISABLED: Global autonomy killswitch is active. Autonomous execution is disabled.');
    }

    // 4. Idempotency Check
    const existingExecution = await prisma.actionExecution.findFirst({
      where: { idempotencyKey },
    });

    if (existingExecution && !isDryRun) {
      return {
        success: existingExecution.state === ActionStatus.VERIFIED_COMPLETED,
        actionExecutionId: existingExecution.id,
        state: existingExecution.state,
        executionMode,
        riskTier,
        message: 'Duplicate idempotent execution detected. Returning existing execution.',
        isDuplicate: true,
        correlationId,
      };
    }

    // 5. Governance Evaluation
    const governance = await GovernanceEngine.evaluateExecutionGovernance({
      websiteId,
      actionType,
      automationLevel:
        riskTier === 'CRITICAL' || riskTier === 'HIGH'
          ? AutomationRiskLevel.LEVEL_3_HIGH_RISK_MANUAL_ONLY
          : AutomationRiskLevel.LEVEL_1_SAFE_AUTOMATION,
      isManualTrigger: Boolean(userId),
      userRole,
    });

    if (!governance.allowed && !userId) {
      throw new Error(`GOVERNANCE_BLOCKED: ${governance.reason}`);
    }

    // High and Critical risk actions MUST have human approval if running autonomously
    if (isAutonomous && (riskTier === 'CRITICAL' || riskTier === 'HIGH')) {
      const priorApproval = await prisma.actionApprovalRequest.findFirst({
        where: {
          websiteId,
          targetUrl,
          actionType,
          state: 'APPROVED',
        },
      });

      if (!priorApproval) {
        throw new Error(
          `APPROVAL_REQUIRED: Action of risk tier ${riskTier} requires explicit human approval before execution.`
        );
      }
    }

    // 6. Target & Executor Resolution
    const target = {
      websiteId,
      targetUrl,
      domain: website.domain || 'example.com',
      platform,
    };

    const executor = ActionExecutorRouter.getExecutor(actionType);

    // 7. Dry-Run Validation
    const validation = await executor.validate(target, payload);
    if (!validation.valid) {
      throw new Error(`VALIDATION_FAILED: ${validation.errors?.join(', ')}`);
    }

    if (isDryRun) {
      return {
        success: true,
        actionExecutionId: `dry-run-${Date.now()}`,
        state: ActionStatus.DRY_RUN_VALIDATED,
        executionMode,
        riskTier,
        message: 'Dry run completed successfully. Target payload is valid.',
        correlationId,
      };
    }

    // 8. Capture Pre-State Snapshot
    const preStateSnapshot = await executor.capturePreState(target);

    // 9. Record ActionExecution with EXECUTING status
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

    // 10. Persist Snapshot for Restart Survival
    await ActionSnapshotService.savePreStateSnapshot({
      actionExecutionId: actionExecution.id,
      websiteId,
      actionType,
      targetUrl,
      preState: preStateSnapshot,
    });

    // 11. Apply Mutation through Executor
    const execResult = await executor.apply(target, payload, preStateSnapshot);

    // 12. Update ActionExecution to AWAITING_VERIFICATION
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

    // 13. Audit Log & Outbox Event
    await AuditLogRepository.log({
      websiteId,
      actionName: `EXECUTE_${actionType}`,
      affectedUrl: targetUrl,
      triggeredBy: userId ? `USER_${userId}` : `AUTONOMOUS_${executionMode}`,
      reason: execResult.message || 'Action executed via ActionExecutionPipeline',
      beforeStateJson: JSON.stringify(preStateSnapshot),
      afterStateJson: JSON.stringify(execResult.appliedState),
      isReversible: true,
      isReverted: false,
      correlationId,
    });

    await OutboxDispatcher.recordEvent({
      aggregateType: 'ACTION_EXECUTION',
      aggregateId: actionExecution.id,
      eventType: 'ACTION_EXECUTED',
      payload: {
        actionExecutionId: actionExecution.id,
        websiteId,
        taskId,
        recommendationId,
        actionType,
        targetUrl,
        executionMode,
        riskTier,
        appliedState: execResult.appliedState,
        correlationId,
      },
    });

    // 14. Independent Verification & Closed-Loop Rollback
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

      // If synthetic verification indicates failure -> AUTOMATIC DETERMINISTIC ROLLBACK
      if (verificationResult.requiresRollback) {
        const rollbackExecutor = ActionExecutorRouter.getExecutor(actionType);
        const rollbackRes = await rollbackExecutor.rollback(target, preStateSnapshot);

        await prisma.actionExecution.update({
          where: { id: actionExecution.id },
          data: {
            state: ActionStatus.REVERTED_RESTORED,
            failureReason: verificationResult.varianceDetails,
          },
        });

        if (taskId) {
          await prisma.seoTask.update({
            where: { id: taskId },
            data: { status: ActionStatus.REVERTED_RESTORED },
          });
        }

        await AuditLogRepository.log({
          websiteId,
          actionName: `ROLLBACK_${actionType}`,
          affectedUrl: targetUrl,
          triggeredBy: 'VERIFICATION_AUTO_ROLLBACK',
          reason: `Verification failed: ${verificationResult.varianceDetails}`,
          beforeStateJson: JSON.stringify(execResult.appliedState),
          afterStateJson: JSON.stringify(preStateSnapshot),
          isReversible: false,
          isReverted: true,
          correlationId,
        });

        await OutboxDispatcher.recordEvent({
          aggregateType: 'ACTION_EXECUTION',
          aggregateId: actionExecution.id,
          eventType: 'ACTION_ROLLED_BACK',
          payload: {
            actionExecutionId: actionExecution.id,
            websiteId,
            reason: verificationResult.varianceDetails,
            correlationId,
          },
        });

        rolledBack = true;
      } else {
        // Verification succeeded
        await prisma.actionExecution.update({
          where: { id: actionExecution.id },
          data: { state: ActionStatus.VERIFIED_COMPLETED },
        });

        if (taskId) {
          await prisma.seoTask.update({
            where: { id: taskId },
            data: { status: ActionStatus.VERIFIED_COMPLETED },
          });
        }
      }
    }

    return {
      success: !rolledBack,
      actionExecutionId: actionExecution.id,
      state: rolledBack ? ActionStatus.REVERTED_RESTORED : (autoVerify ? ActionStatus.VERIFIED_COMPLETED : ActionStatus.AWAITING_VERIFICATION),
      executionMode,
      riskTier,
      preStateSnapshot,
      appliedState: execResult.appliedState,
      diffSummary: execResult.diffSummary,
      verificationResult,
      rolledBack,
      message: rolledBack ? `Action rolled back due to verification failure: ${verificationResult?.varianceDetails}` : execResult.message,
      correlationId,
    };
  }
}

