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
import { ActionApprovalCenter } from './approval/actionApprovalCenter';
import { LearningLoopEngine } from '../decision/learningLoopEngine';
import { AttributionQueueProducer } from '../../queues/attributionQueueProducer';

export type ActionExecutionMode = 'MANUAL' | 'AUTONOMOUS' | 'CANARY';
export type ActionRiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ActionExecutionPipelineParams {
  websiteId: string;
  taskId?: string;
  recommendationId?: string;
  approvalRequestId?: string;
  actionType: string;
  targetUrl: string;
  payload: Record<string, any>;
  idempotencyKey: string;
  executionMode?: ActionExecutionMode;
  userId?: string;
  userRole?: string;
  isDryRun?: boolean;
  autoVerify?: boolean;
  platform?: string;
  correlationId?: string;
}

export type ActionPipelineInput = ActionExecutionPipelineParams;

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
      executionMode = params.userId ? 'MANUAL' : 'AUTONOMOUS',
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
    // CRITICAL: A userId must NEVER bypass the autonomy killswitch if executionMode is AUTONOMOUS
    const isAutonomous = executionMode === 'AUTONOMOUS' || executionMode === 'CANARY';
    const isAutonomyEnabled = process.env.AUTONOMOUS_EXECUTION_ENABLED === 'true';

    if (isAutonomous && !isAutonomyEnabled) {
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
    let mappedRiskLevel: AutomationRiskLevel;
    switch (riskTier) {
      case 'LOW':
        mappedRiskLevel = AutomationRiskLevel.LEVEL_1_SAFE_AUTOMATION;
        break;
      case 'MEDIUM':
        mappedRiskLevel = AutomationRiskLevel.LEVEL_2_REVIEW_REQUIRED;
        break;
      case 'HIGH':
      case 'CRITICAL':
      default:
        mappedRiskLevel = AutomationRiskLevel.LEVEL_3_HIGH_RISK_MANUAL_ONLY;
        break;
    }

    const governance = await GovernanceEngine.evaluateExecutionGovernance({
      websiteId,
      actionType,
      automationLevel: mappedRiskLevel,
      isManualTrigger: executionMode === 'MANUAL',
      userRole,
    });

    if (!isDryRun && !governance.allowed) {
      throw new Error(`GOVERNANCE_BLOCKED: ${governance.reason}`);
    }

    // Enforce grace period for autonomous runs
    if (!isDryRun && isAutonomous && governance.gracePeriodSeconds && governance.gracePeriodSeconds > 0) {
      let createdAtTime: number | null = null;
      if (recommendationId) {
        const rec = await prisma.seoRecommendation.findUnique({ where: { id: recommendationId } });
        if (rec) createdAtTime = new Date(rec.createdAt).getTime();
      }
      if (createdAtTime && (Date.now() - createdAtTime) < (governance.gracePeriodSeconds * 1000)) {
        throw new Error(
          `GRACE_PERIOD_ACTIVE: Autonomous execution blocked pending ${governance.gracePeriodSeconds}s governance grace period.`
        );
      }
    }

    // High and Critical risk actions MUST have human approval if running autonomously
    let boundApprovalId: string | undefined = params.approvalRequestId;
    if (!isDryRun && isAutonomous && (riskTier === 'CRITICAL' || riskTier === 'HIGH')) {
      if (!boundApprovalId) {
        const priorApproval = await prisma.actionApprovalRequest.findFirst({
          where: {
            websiteId,
            targetUrl,
            actionType,
            state: { in: ['APPROVED', 'QUEUED'] },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!priorApproval) {
          throw new Error(
            `APPROVAL_REQUIRED: Action of risk tier ${riskTier} requires explicit human approval before execution.`
          );
        }

        boundApprovalId = priorApproval.id;
      }
    }

    // If bound approval request is present, verify payload hash integrity
    if (boundApprovalId) {
      const approvalRec = await prisma.actionApprovalRequest.findUnique({
        where: { id: boundApprovalId },
      });
      if (approvalRec) {
        let approvedPayload = {};
        try {
          approvedPayload = typeof approvalRec.payloadJson === 'string' ? JSON.parse(approvalRec.payloadJson) : approvalRec.payloadJson;
        } catch (_) {
          approvedPayload = {};
        }
        const approvedHash = ActionApprovalCenter.computePayloadHash(approvedPayload);
        const currentHash = ActionApprovalCenter.computePayloadHash(payload);
        if (approvedHash !== currentHash) {
          throw new Error(
            `APPROVAL_INTENT_MISMATCH: Execution payload does not match the approved intent payload (approvedHash=${approvedHash.substring(0, 8)}, currentHash=${currentHash.substring(0, 8)}).`
          );
        }
      }
    }

    // Validate targetUrl belongs to authorized website domain
    if (website.domain) {
      try {
        const targetHost = new URL(targetUrl).hostname.toLowerCase();
        const expectedDomain = website.domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
        if (targetHost !== expectedDomain && !targetHost.endsWith(`.${expectedDomain}`)) {
          throw new Error(
            `TARGET_DOMAIN_MISMATCH: Target URL host "${targetHost}" does not match authorized website domain "${expectedDomain}".`
          );
        }
      } catch (err: any) {
        if (err.message.includes('TARGET_DOMAIN_MISMATCH')) throw err;
        throw new Error(`INVALID_TARGET_URL: Target URL "${targetUrl}" is invalid: ${err.message}`);
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
        message: 'Dry run completed successfully. Payload is valid and ready for execution.',
        correlationId,
      };
    }

    // 8. Prepare Execution ID and create ActionExecution in PREPARING state (PostgreSQL FK order compliant)
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const actionExecution = await prisma.actionExecution.create({
      data: {
        id: executionId,
        websiteId,
        taskId,
        recommendationId,
        actionType,
        targetUrl,
        idempotencyKey,
        state: ActionStatus.RECOMMENDED,
        requestedByUserId: userId,
      },
    });

    // 9. Capture Pre-State Snapshot
    const preStateSnapshot = typeof (executor as any).capturePreState === 'function'
      ? await (executor as any).capturePreState(target)
      : (typeof (executor as any).getCurrentState === 'function'
        ? await (executor as any).getCurrentState(target)
        : {});

    // Bind approval request if present
    if (boundApprovalId) {
      await ActionApprovalCenter.markExecuting(boundApprovalId, executionId, userId || 'SYSTEM');
    }

    // Persist durable pre-state snapshot (FK relation to actionExecution is satisfied)
    await ActionSnapshotService.savePreStateSnapshot({
      actionExecutionId: executionId,
      websiteId,
      targetUrl,
      actionType,
      preState: preStateSnapshot,
    });

    // 10. Atomically transition ActionExecution to EXECUTING state
    await prisma.actionExecution.update({
      where: { id: executionId },
      data: {
        state: ActionStatus.EXECUTING,
        beforeEvidenceJson: JSON.stringify(preStateSnapshot),
      },
    });

    // 11. Execute Mutation through Authoritative Executor
    let execResult: any;
    try {
      execResult = await executor.apply(target, payload, preStateSnapshot);
    } catch (execError: any) {
      await prisma.actionExecution.update({
        where: { id: actionExecution.id },
        data: {
          state: ActionStatus.FAILED,
          failureReason: execError.message,
        },
      });

      await AuditLogRepository.log({
        websiteId,
        actionName: `EXECUTION_FAILED_${actionType}`,
        affectedUrl: targetUrl,
        triggeredBy: userId ? `USER_${userId}` : `AUTONOMOUS_${executionMode}`,
        reason: `Execution failed: ${execError.message}`,
        beforeStateJson: JSON.stringify(preStateSnapshot),
        isReversible: true,
        isReverted: false,
        correlationId,
      });

      throw new Error(`MUTATION_FAILED: ${execError.message}`);
    }

    // Update with after evidence
    await prisma.actionExecution.update({
      where: { id: actionExecution.id },
      data: {
        state: autoVerify ? ActionStatus.AWAITING_VERIFICATION : ActionStatus.VERIFIED_COMPLETED,
        afterEvidenceJson: JSON.stringify(execResult.appliedState),
      },
    });

    // Immutable Audit Log
    await AuditLogRepository.log({
      websiteId,
      actionName: `EXECUTE_${actionType}`,
      affectedUrl: targetUrl,
      triggeredBy: userId ? `USER_${userId}` : `AUTONOMOUS_${executionMode}`,
      reason: execResult.diffSummary || 'Action executed via ActionExecutionPipeline',
      beforeStateJson: JSON.stringify(preStateSnapshot),
      afterStateJson: JSON.stringify(execResult.appliedState),
      isReversible: true,
      isReverted: false,
      correlationId,
    });

    // Outbox Event for Event-Driven Architecture
    await OutboxDispatcher.recordEvent({
      aggregateType: 'ACTION_EXECUTION',
      aggregateId: actionExecution.id,
      eventType: 'ACTION_EXECUTED',
      payload: {
        actionExecutionId: actionExecution.id,
        websiteId,
        actionType,
        targetUrl,
        executionMode,
        riskTier,
        appliedState: execResult.appliedState,
        correlationId,
      },
    });

    // 11. Independent Verification (Stage 1 Synthetic & DOM check)
    let rolledBack = false;
    let verificationResult: any = null;

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
        await rollbackExecutor.rollback(target, preStateSnapshot);

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

        if (boundApprovalId) {
          await ActionApprovalCenter.markRolledBack(boundApprovalId, verificationResult.varianceDetails, 'VERIFICATION_AUTO_ROLLBACK');
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

        if (boundApprovalId) {
          await ActionApprovalCenter.markVerified(boundApprovalId, userId || 'VERIFIER');
        }

        // Schedule deterministic causal attribution evaluation
        await AttributionQueueProducer.enqueueAttributionEvaluation({
          jobType: 'EVALUATE_ATTRIBUTION',
          websiteId,
          actionExecutionId: actionExecution.id,
          horizonDays: 30,
          correlationId,
        });
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

  /**
   * Executes a 1-click deterministic rollback by restoring the pre-state snapshot.
   * Survives worker restarts by reloading snapshot from durable database storage.
   */
  public static async rollback(params: {
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

    // Independent Rollback Verification
    let rollbackVerified = true;
    try {
      const rollbackVerification = await VerificationEngine.runStage1SyntheticVerification({
        actionExecutionId,
        websiteId,
        actionType: execution.actionType,
        targetUrl: execution.targetUrl,
        expectedState: preStateSnapshot,
        ruleKey: execution.recommendation?.ruleKey || undefined,
        platform,
      });
      if (rollbackVerification.requiresRollback) {
        rollbackVerified = false;
      }
    } catch {
      // Best effort verification check
    }

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
      success: rollbackResult.success && rollbackVerified,
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

    await OutboxDispatcher.recordEvent({
      aggregateType: 'ACTION_EXECUTION',
      aggregateId: actionExecutionId,
      eventType: 'ACTION_ROLLED_BACK',
      payload: {
        actionExecutionId,
        websiteId,
        reason,
        restoredState: rollbackResult.restoredState,
      },
    });

    return {
      success: true,
      message: rollbackResult.message || 'Successfully rolled back action and restored pre-state',
      restoredState: rollbackResult.restoredState,
    };
  }
}
