import { prisma } from '../../../db/prisma';
import { ApprovalState } from './approvalTypes';

export type StuckResolutionStrategy = 'RETRY' | 'ROLLBACK_SUGGESTION' | 'MANUAL_REVIEW_ESCALATION';

export type WatchdogPolicyMode = 'RISK_BASED' | 'EXPLICIT' | 'NONE';

export interface StuckExecutionIncident {
  actionId: string;
  websiteId: string;
  actionType: string;
  targetUrl: string;
  riskLevel: string;
  state: ApprovalState;
  stuckDurationMs: number;
  thresholdMs: number;
  lastUpdatedAt: Date;
  recommendedResolution: StuckResolutionStrategy;
  incidentId: string;
}

export interface WatchdogEvaluationResult {
  evaluatedCount: number;
  stuckCount: number;
  incidents: StuckExecutionIncident[];
  resolvedActions: Array<{
    actionId: string;
    riskLevel: string;
    resolutionApplied: StuckResolutionStrategy;
    newState: ApprovalState;
    message: string;
    taskId?: string;
  }>;
}

export interface WatchdogConfig {
  executingTimeoutMs?: number; // default: 5 minutes (300,000 ms)
  verifyingTimeoutMs?: number; // default: 10 minutes (600,000 ms)
  policyMode?: WatchdogPolicyMode; // default: 'RISK_BASED'
  explicitStrategy?: StuckResolutionStrategy; // Only when policyMode === 'EXPLICIT'
}

export class StuckExecutionWatchdog {
  public static readonly DEFAULT_EXECUTING_TIMEOUT_MS = 5 * 60 * 1000; // 5 mins
  public static readonly DEFAULT_VERIFYING_TIMEOUT_MS = 10 * 60 * 1000; // 10 mins

  /**
   * Evaluates the risk-based resolution strategy for a stuck action item:
   * - LOW RISK (LEVEL_0_SUGGESTION_ONLY, LEVEL_1_SAFE_AUTOMATION):
   *     -> Automatic RETRY allowed (re-queues action for automated execution attempt)
   * - MEDIUM RISK (LEVEL_2_REVIEW_REQUIRED):
   *     -> Create Review Task & Escalate (creates actionable Task item & marks REJECTED/NEEDS_REVIEW with audit log)
   * - HIGH RISK (LEVEL_3_HIGH_RISK_MANUAL):
   *     -> ROLLBACK_SUGGESTION only (triggers safe rollback to prevent manual mutation corruption)
   */
  public static evaluateRiskBasedStrategy(riskLevel: string, state: ApprovalState): StuckResolutionStrategy {
    const normalizedRisk = (riskLevel || '').toUpperCase();

    // High risk: Rollback suggestion only (or when stalled during verification)
    if (normalizedRisk.includes('LEVEL_3') || normalizedRisk.includes('HIGH')) {
      return 'ROLLBACK_SUGGESTION';
    }

    // Medium risk: Create review task and escalate to manual review
    if (normalizedRisk.includes('LEVEL_2') || normalizedRisk.includes('REVIEW') || normalizedRisk.includes('MEDIUM')) {
      return 'MANUAL_REVIEW_ESCALATION';
    }

    // Low risk (LEVEL_0 or LEVEL_1): Automatic retry allowed
    if (state === 'EXECUTING') {
      return 'RETRY';
    }

    // If verifying stalled even on low-risk, suggest rollback to keep environment safe
    return 'ROLLBACK_SUGGESTION';
  }

  /**
   * Scans for actions stuck in EXECUTING or VERIFYING states beyond configurable thresholds.
   * Emits ACTION_STUCK_EXECUTION system outbox events and executes risk-based or explicit resolution.
   */
  public static async scanAndResolveStuckActions(
    config: WatchdogConfig = {}
  ): Promise<WatchdogEvaluationResult> {
    const executingTimeout = config.executingTimeoutMs ?? this.DEFAULT_EXECUTING_TIMEOUT_MS;
    const verifyingTimeout = config.verifyingTimeoutMs ?? this.DEFAULT_VERIFYING_TIMEOUT_MS;
    const policyMode = config.policyMode ?? 'RISK_BASED';

    const now = new Date();
    const executingCutoff = new Date(now.getTime() - executingTimeout);
    const verifyingCutoff = new Date(now.getTime() - verifyingTimeout);

    // 1. Query stuck requests across both executing and verifying thresholds from Prisma DB
    const stuckRecords = await prisma.actionApprovalRequest.findMany({
      where: {
        OR: [
          {
            state: 'EXECUTING',
            updatedAt: { lte: executingCutoff },
          },
          {
            state: 'VERIFYING',
            updatedAt: { lte: verifyingCutoff },
          },
        ],
      },
      orderBy: { updatedAt: 'asc' },
    });

    const incidents: StuckExecutionIncident[] = [];
    const resolvedActions: WatchdogEvaluationResult['resolvedActions'] = [];

    for (const record of stuckRecords) {
      const state = record.state as ApprovalState;
      const thresholdMs = state === 'EXECUTING' ? executingTimeout : verifyingTimeout;
      const stuckDurationMs = now.getTime() - new Date(record.updatedAt).getTime();
      const riskLevel = record.riskLevel || 'LEVEL_1_SAFE_AUTOMATION';

      // Determine strategy based on risk policy
      const recommendedResolution = this.evaluateRiskBasedStrategy(riskLevel, state);
      const incidentId = `stuck-inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const incident: StuckExecutionIncident = {
        actionId: record.id,
        websiteId: record.websiteId,
        actionType: record.actionType,
        targetUrl: record.targetUrl,
        riskLevel,
        state,
        stuckDurationMs,
        thresholdMs,
        lastUpdatedAt: record.updatedAt,
        recommendedResolution,
        incidentId,
      };

      incidents.push(incident);

      // 2. Emit ACTION_STUCK_EXECUTION System Outbox Event for telemetry, alerting, and audit listeners
      await prisma.outboxEvent.create({
        data: {
          aggregateType: 'ACTION_WATCHDOG',
          aggregateId: record.id,
          eventType: 'ACTION_STUCK_EXECUTION',
          payloadJson: JSON.stringify({
            incidentId,
            actionId: record.id,
            websiteId: record.websiteId,
            actionType: record.actionType,
            targetUrl: record.targetUrl,
            riskLevel,
            state,
            stuckDurationMs,
            thresholdMs,
            policyMode,
            recommendedResolution,
            detectedAt: now,
          }),
        },
      });

      // 3. Apply resolution according to policy mode without bypassing approvals or safety controls
      if (policyMode === 'RISK_BASED') {
        const resolutionResult = await this.applyResolution(
          record.id,
          recommendedResolution,
          `Watchdog Risk Policy (${riskLevel}): stuck in ${state} for ${Math.round(stuckDurationMs / 1000)}s (threshold: ${Math.round(thresholdMs / 1000)}s)`
        );

        if (resolutionResult) {
          resolvedActions.push({
            ...resolutionResult,
            riskLevel,
          });
        }
      } else if (policyMode === 'EXPLICIT' && config.explicitStrategy) {
        const resolutionResult = await this.applyResolution(
          record.id,
          config.explicitStrategy,
          `Watchdog Explicit Strategy: stuck in ${state} for ${Math.round(stuckDurationMs / 1000)}s (threshold: ${Math.round(thresholdMs / 1000)}s)`
        );

        if (resolutionResult) {
          resolvedActions.push({
            ...resolutionResult,
            riskLevel,
          });
        }
      }
    }

    return {
      evaluatedCount: stuckRecords.length,
      stuckCount: incidents.length,
      incidents,
      resolvedActions,
    };
  }

  /**
   * Applies a specific recovery resolution (RETRY, ROLLBACK_SUGGESTION, or MANUAL_REVIEW_ESCALATION) to a stuck action.
   */
  public static async applyResolution(
    actionId: string,
    strategy: StuckResolutionStrategy,
    reason: string,
    actorId: string = 'SYSTEM_WATCHDOG'
  ): Promise<{
    actionId: string;
    resolutionApplied: StuckResolutionStrategy;
    newState: ApprovalState;
    message: string;
    taskId?: string;
  } | null> {
    const action = await prisma.actionApprovalRequest.findUnique({
      where: { id: actionId },
    });

    if (!action) {
      return null;
    }

    const currentState = action.state as ApprovalState;
    const now = new Date();

    switch (strategy) {
      case 'RETRY': {
        // LOW RISK: Re-queue action safely for worker execution
        await prisma.$transaction(async (tx) => {
          await tx.actionApprovalRequest.update({
            where: { id: actionId },
            data: {
              state: 'QUEUED',
              updatedAt: now,
            },
          });

          await tx.actionStateTransitionLog.create({
            data: {
              id: `trans-wd-retry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              approvalRequestId: actionId,
              fromState: currentState,
              toState: 'QUEUED',
              actorId,
              reason: `[WATCHDOG_RETRY] ${reason}`,
              timestamp: now,
            },
          });
        });

        return {
          actionId,
          resolutionApplied: 'RETRY',
          newState: 'QUEUED',
          message: `Stuck action re-queued for execution attempt under Low-Risk Retry Policy.`,
        };
      }

      case 'ROLLBACK_SUGGESTION': {
        // HIGH RISK: Suggest/Trigger safe rollback to prevent corrupted state
        await prisma.$transaction(async (tx) => {
          await tx.actionApprovalRequest.update({
            where: { id: actionId },
            data: {
              state: 'ROLLED_BACK',
              updatedAt: now,
            },
          });

          await tx.actionStateTransitionLog.create({
            data: {
              id: `trans-wd-rollback-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              approvalRequestId: actionId,
              fromState: currentState,
              toState: 'ROLLED_BACK',
              actorId,
              reason: `[WATCHDOG_ROLLBACK_SUGGESTION] ${reason}`,
              timestamp: now,
            },
          });
        });

        return {
          actionId,
          resolutionApplied: 'ROLLBACK_SUGGESTION',
          newState: 'ROLLED_BACK',
          message: `High-Risk stuck action transitioned to ROLLED_BACK under Rollback Suggestion Policy.`,
        };
      }

      case 'MANUAL_REVIEW_ESCALATION':
      default: {
        // MEDIUM RISK: Create a review task for operator review and transition to REJECTED (needs manual re-approval)
        const taskId = `task-stuck-review-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        await prisma.$transaction(async (tx) => {
          // 1. Create operator review task in SeoTask table
          await tx.seoTask.create({
            data: {
              id: taskId,
              websiteId: action.websiteId,
              title: `[Stuck Action Review] ${action.actionType} on ${action.targetUrl}`,
              category: 'GOVERNANCE',
              priority: 'HIGH',
              opportunityScore: action.opportunityScore || 50.0,
              automationLevel: 'LEVEL_2_REVIEW_REQUIRED',
              status: 'RECOMMENDED',
              reason: `Action '${actionId}' (${action.actionType}) was stuck in ${currentState}. Escalated by Watchdog: ${reason}`,
              evidence: `Target URL: ${action.targetUrl}, Risk Level: ${action.riskLevel}`,
              actionType: action.actionType,
              affectedUrls: [action.targetUrl],
              actionPayloadJson: action.payloadJson,
            },
          });

          // 2. Transition approval request to REJECTED with escalation reason
          await tx.actionApprovalRequest.update({
            where: { id: actionId },
            data: {
              state: 'REJECTED',
              rejectionReason: `[WATCHDOG_REVIEW_TASK_CREATED: ${taskId}] ${reason}`,
              updatedAt: now,
            },
          });

          // 3. Log audit transition
          await tx.actionStateTransitionLog.create({
            data: {
              id: `trans-wd-review-task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              approvalRequestId: actionId,
              fromState: currentState,
              toState: 'REJECTED',
              actorId,
              reason: `[WATCHDOG_MANUAL_REVIEW_TASK] Created Review Task ${taskId}: ${reason}`,
              timestamp: now,
            },
          });
        });

        return {
          actionId,
          resolutionApplied: 'MANUAL_REVIEW_ESCALATION',
          newState: 'REJECTED',
          taskId,
          message: `Medium-Risk stuck action escalated: Created Review Task '${taskId}' and placed action in REJECTED state.`,
        };
      }
    }
  }
}
