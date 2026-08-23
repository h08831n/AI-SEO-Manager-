import { prisma } from '../../../db/prisma';
import { ActionApprovalCenter } from './actionApprovalCenter';
import { ApprovalState, ProposedActionItem } from './approvalTypes';

export type StuckResolutionStrategy = 'RETRY' | 'ROLLBACK_SUGGESTION' | 'MANUAL_REVIEW_ESCALATION';

export interface StuckExecutionIncident {
  actionId: string;
  websiteId: string;
  actionType: string;
  targetUrl: string;
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
    resolutionApplied: StuckResolutionStrategy;
    newState: ApprovalState;
    message: string;
  }>;
}

export interface WatchdogConfig {
  executingTimeoutMs?: number; // default: 5 minutes (300,000 ms)
  verifyingTimeoutMs?: number; // default: 10 minutes (600,000 ms)
  autoResolveStrategy?: StuckResolutionStrategy | 'NONE'; // default: 'NONE' (audit & alert only unless explicit)
}

export class StuckExecutionWatchdog {
  public static readonly DEFAULT_EXECUTING_TIMEOUT_MS = 5 * 60 * 1000; // 5 mins
  public static readonly DEFAULT_VERIFYING_TIMEOUT_MS = 10 * 60 * 1000; // 10 mins

  /**
   * Scans for actions stuck in EXECUTING or VERIFYING states beyond configurable thresholds.
   * Emits ACTION_STUCK_EXECUTION system outbox events and executes automated resolution or escalation.
   */
  public static async scanAndResolveStuckActions(
    config: WatchdogConfig = {}
  ): Promise<WatchdogEvaluationResult> {
    const executingTimeout = config.executingTimeoutMs ?? this.DEFAULT_EXECUTING_TIMEOUT_MS;
    const verifyingTimeout = config.verifyingTimeoutMs ?? this.DEFAULT_VERIFYING_TIMEOUT_MS;
    const autoResolve = config.autoResolveStrategy ?? 'NONE';

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

      // Determine recommended resolution strategy based on state and risk level
      let recommendedResolution: StuckResolutionStrategy = 'MANUAL_REVIEW_ESCALATION';
      if (state === 'EXECUTING') {
        recommendedResolution = record.riskLevel === 'LEVEL_1_SAFE_AUTOMATION' ? 'RETRY' : 'MANUAL_REVIEW_ESCALATION';
      } else if (state === 'VERIFYING') {
        recommendedResolution = 'ROLLBACK_SUGGESTION';
      }

      const incidentId = `stuck-inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const incident: StuckExecutionIncident = {
        actionId: record.id,
        websiteId: record.websiteId,
        actionType: record.actionType,
        targetUrl: record.targetUrl,
        state,
        stuckDurationMs,
        thresholdMs,
        lastUpdatedAt: record.updatedAt,
        recommendedResolution,
        incidentId,
      };

      incidents.push(incident);

      // 2. Emit ACTION_STUCK_EXECUTION System Outbox Event for telemetry, alerting, and external listeners
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
            state,
            stuckDurationMs,
            thresholdMs,
            recommendedResolution,
            detectedAt: now,
          }),
        },
      });

      // 3. Apply automated or requested resolution if strategy is configured
      if (autoResolve !== 'NONE') {
        const resolutionToApply = autoResolve === 'RETRY' ? 'RETRY' : autoResolve === 'ROLLBACK_SUGGESTION' ? 'ROLLBACK_SUGGESTION' : 'MANUAL_REVIEW_ESCALATION';

        const resolutionResult = await this.applyResolution(
          record.id,
          resolutionToApply,
          `Watchdog automated resolution: stuck in ${state} for ${Math.round(stuckDurationMs / 1000)}s (threshold: ${Math.round(thresholdMs / 1000)}s)`
        );

        if (resolutionResult) {
          resolvedActions.push(resolutionResult);
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
  } | null> {
    const action = await prisma.actionApprovalRequest.findUnique({
      where: { id: actionId },
    });

    if (!action) {
      return null;
    }

    const currentState = action.state as ApprovalState;

    switch (strategy) {
      case 'RETRY': {
        // Retry execution by re-queuing the approved action
        // First transition from EXECUTING -> REJECTED or directly reset to QUEUED via state machine transition
        // In our state machine: EXECUTING can rollback or reset. We record transition log and update to QUEUED
        await prisma.$transaction(async (tx) => {
          await tx.actionApprovalRequest.update({
            where: { id: actionId },
            data: {
              state: 'QUEUED',
              updatedAt: new Date(),
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
            },
          });
        });

        return {
          actionId,
          resolutionApplied: 'RETRY',
          newState: 'QUEUED',
          message: `Stuck action re-queued for execution attempt.`,
        };
      }

      case 'ROLLBACK_SUGGESTION': {
        // Escalate for automated or suggested rollback
        await prisma.$transaction(async (tx) => {
          await tx.actionApprovalRequest.update({
            where: { id: actionId },
            data: {
              state: 'ROLLED_BACK',
              updatedAt: new Date(),
            },
          });

          await tx.actionStateTransitionLog.create({
            data: {
              id: `trans-wd-rollback-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              approvalRequestId: actionId,
              fromState: currentState,
              toState: 'ROLLED_BACK',
              actorId,
              reason: `[WATCHDOG_ROLLBACK] ${reason}`,
            },
          });
        });

        return {
          actionId,
          resolutionApplied: 'ROLLBACK_SUGGESTION',
          newState: 'ROLLED_BACK',
          message: `Stuck verification triggered automated rollback.`,
        };
      }

      case 'MANUAL_REVIEW_ESCALATION':
      default: {
        // Escalate to REJECTED or PROPOSED with explicit escalation notes
        await prisma.$transaction(async (tx) => {
          await tx.actionApprovalRequest.update({
            where: { id: actionId },
            data: {
              state: 'REJECTED',
              rejectionReason: `[WATCHDOG_ESCALATED] ${reason}`,
              updatedAt: new Date(),
            },
          });

          await tx.actionStateTransitionLog.create({
            data: {
              id: `trans-wd-esc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              approvalRequestId: actionId,
              fromState: currentState,
              toState: 'REJECTED',
              actorId,
              reason: `[WATCHDOG_MANUAL_REVIEW_ESCALATION] ${reason}`,
            },
          });
        });

        return {
          actionId,
          resolutionApplied: 'MANUAL_REVIEW_ESCALATION',
          newState: 'REJECTED',
          message: `Stuck execution escalated for manual review and placed into REJECTED state.`,
        };
      }
    }
  }
}
