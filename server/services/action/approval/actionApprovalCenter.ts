import crypto from 'crypto';
import { ApprovalState, ProposedActionItem, StateTransitionLog } from './approvalTypes';
import { prisma } from '../../../db/prisma';

export class ActionApprovalCenter {
  // Valid State Machine Transitions
  private static ALLOWED_TRANSITIONS: Record<ApprovalState, ApprovalState[]> = {
    PROPOSED: ['APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED'],
    APPROVED: ['QUEUED', 'EXECUTING', 'REJECTED', 'EXPIRED', 'REVOKED'],
    REJECTED: ['PROPOSED'], // Can be re-proposed if reworked
    QUEUED: ['EXECUTING', 'REJECTED', 'REVOKED'],
    EXECUTING: ['VERIFYING', 'VERIFIED', 'ROLLED_BACK'],
    VERIFYING: ['VERIFIED', 'ROLLED_BACK'],
    VERIFIED: ['ROLLED_BACK'], // 1-click rollback after verification
    ROLLED_BACK: ['PROPOSED'],
    EXPIRED: ['PROPOSED'],
    REVOKED: ['PROPOSED'],
  };

  /**
   * Deterministic SHA-256 hash of canonicalized JSON payload for approval intent binding.
   */
  public static computePayloadHash(payload: Record<string, any>): string {
    const canonical = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(canonical);
      return Object.keys(obj)
        .sort()
        .reduce((acc: any, key: string) => {
          acc[key] = canonical(obj[key]);
          return acc;
        }, {});
    };
    const jsonString = JSON.stringify(canonical(payload || {}));
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }

  /**
   * Helper to deserialize Prisma ActionApprovalRequest record to ProposedActionItem.
   */
  private static mapDbRecordToItem(rec: any): ProposedActionItem {
    let payload = {};
    try {
      payload = typeof rec.payloadJson === 'string' ? JSON.parse(rec.payloadJson) : rec.payloadJson || {};
    } catch (e) {
      payload = {};
    }

    return {
      id: rec.id,
      websiteId: rec.websiteId,
      actionType: rec.actionType,
      targetUrl: rec.targetUrl,
      ruleKey: rec.ruleKey || undefined,
      payload,
      payloadHash: rec.payloadHash || undefined,
      opportunityScore: rec.opportunityScore,
      riskLevel: rec.riskLevel as any,
      riskTier: rec.riskTier as any,
      state: rec.state as ApprovalState,
      proposedBy: rec.proposedBy,
      approvedBy: rec.approvedBy || undefined,
      approvalNotes: rec.approvalNotes || undefined,
      rejectionReason: rec.rejectionReason || undefined,
      executionId: rec.actionExecutionId || undefined,
      recommendationId: rec.recommendationId || undefined,
      taskId: rec.taskId || undefined,
      expiresAt: rec.expiresAt || undefined,
      consumedAt: rec.consumedAt || undefined,
      revokedAt: rec.revokedAt || undefined,
      proposedAt: rec.createdAt,
      updatedAt: rec.updatedAt,
    };
  }

  /**
   * Validates state transition according to the formal state machine.
   */
  private static validateTransition(currentState: ApprovalState, targetState: ApprovalState): void {
    const allowed = this.ALLOWED_TRANSITIONS[currentState] || [];
    if (!allowed.includes(targetState)) {
      throw new Error(
        `Invalid Action Approval state transition: cannot transition from '${currentState}' to '${targetState}'`
      );
    }
  }

  /**
   * Atomic transactional state transition helper.
   * Guarantees that across multiple API instances and concurrent executions,
   * only ONE transition can succeed for a given state.
   */
  private static async executeAtomicTransition(params: {
    actionId: string;
    targetState: ApprovalState;
    actorId: string;
    reasonOrNotes?: string;
    updateFields?: Record<string, any>;
  }): Promise<ProposedActionItem> {
    const { actionId, targetState, actorId, reasonOrNotes, updateFields = {} } = params;

    return await prisma.$transaction(async (tx) => {
      const existing = await tx.actionApprovalRequest.findUnique({
        where: { id: actionId },
      });

      if (!existing) {
        throw new Error(`Approval item with ID '${actionId}' not found`);
      }

      const currentState = existing.state as ApprovalState;
      ActionApprovalCenter.validateTransition(currentState, targetState);

      const now = new Date();
      // Atomic conditional update on current state
      const updateResult = await tx.actionApprovalRequest.updateMany({
        where: {
          id: actionId,
          state: currentState,
        },
        data: {
          state: targetState,
          updatedAt: now,
          ...updateFields,
        },
      });

      if (updateResult.count === 0) {
        const fresh = await tx.actionApprovalRequest.findUnique({ where: { id: actionId } });
        throw new Error(
          `Concurrent transition conflict: action '${actionId}' is in state '${fresh?.state}', cannot transition from '${currentState}' to '${targetState}'`
        );
      }

      const logId = `trans-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      // Persist immutable audit log to ActionStateTransitionLog Prisma table
      await tx.actionStateTransitionLog.create({
        data: {
          id: logId,
          approvalRequestId: actionId,
          fromState: currentState,
          toState: targetState,
          actorId,
          reason: reasonOrNotes,
          timestamp: now,
        },
      });

      // Persist outbox event for event-driven integration
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'APPROVAL_CENTER',
          aggregateId: actionId,
          eventType: 'ACTION_STATE_TRANSITIONED',
          payloadJson: JSON.stringify({
            id: logId,
            actionId,
            previousState: currentState,
            newState: targetState,
            triggeredByUserId: actorId,
            reason: reasonOrNotes,
            timestamp: now,
          }),
        },
      });

      const updatedRecord = await tx.actionApprovalRequest.findUnique({ where: { id: actionId } });
      return this.mapDbRecordToItem(updatedRecord!);
    });
  }

  /**
   * Proposes a new action item into the Action Approval Center and persists to DB.
   */
  public static async proposeAction(params: {
    websiteId: string;
    actionType: string;
    targetUrl: string;
    ruleKey?: string;
    payload: Record<string, any>;
    opportunityScore?: number;
    riskLevel?: 'LEVEL_0_SUGGESTION_ONLY' | 'LEVEL_1_SAFE_AUTOMATION' | 'LEVEL_2_REVIEW_REQUIRED' | 'LEVEL_3_HIGH_RISK_MANUAL';
    riskTier?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    proposedBy?: string;
    recommendationId?: string;
    taskId?: string;
    expiresInDays?: number;
  }): Promise<ProposedActionItem> {
    const {
      websiteId,
      actionType,
      targetUrl,
      ruleKey,
      payload,
      opportunityScore = 75,
      riskLevel = 'LEVEL_2_REVIEW_REQUIRED',
      riskTier = 'MEDIUM',
      proposedBy = 'SYSTEM_DIAGNOSIS_ENGINE',
      recommendationId,
      taskId,
      expiresInDays = 7,
    } = params;

    const actionId = `prop-act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const payloadJson = JSON.stringify(payload);
    const payloadHash = this.computePayloadHash(payload);
    const now = new Date();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    // Persist to ActionApprovalRequest table
    const dbRecord = await prisma.actionApprovalRequest.create({
      data: {
        id: actionId,
        websiteId,
        actionType,
        targetUrl,
        ruleKey,
        payloadJson,
        payloadHash,
        opportunityScore,
        riskLevel,
        riskTier,
        state: 'PROPOSED',
        proposedBy,
        recommendationId,
        taskId,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      },
    });

    const actionItem = this.mapDbRecordToItem(dbRecord);

    // Persist outbox event
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'APPROVAL_CENTER',
        aggregateId: actionItem.id,
        eventType: 'ACTION_PROPOSED',
        payloadJson: JSON.stringify(actionItem),
      },
    });

    return actionItem;
  }

  /**
   * Approves a proposed action atomically in DB.
   */
  public static async approveAction(params: {
    actionId: string;
    userId: string;
    notes?: string;
  }): Promise<ProposedActionItem> {
    const { actionId, userId, notes } = params;
    return await this.executeAtomicTransition({
      actionId,
      targetState: 'APPROVED',
      actorId: userId,
      reasonOrNotes: notes,
      updateFields: {
        approvedBy: userId,
        approvalNotes: notes,
      },
    });
  }

  /**
   * Rejects a proposed, approved, or queued action atomically in DB.
   */
  public static async rejectAction(params: {
    actionId: string;
    userId: string;
    reason: string;
  }): Promise<ProposedActionItem> {
    const { actionId, userId, reason } = params;
    return await this.executeAtomicTransition({
      actionId,
      targetState: 'REJECTED',
      actorId: userId,
      reasonOrNotes: reason,
      updateFields: {
        rejectionReason: reason,
      },
    });
  }

  /**
   * Revokes an existing approval intent.
   */
  public static async revokeAction(params: {
    actionId: string;
    userId: string;
    reason?: string;
  }): Promise<ProposedActionItem> {
    const { actionId, userId, reason } = params;
    return await this.executeAtomicTransition({
      actionId,
      targetState: 'REVOKED',
      actorId: userId,
      reasonOrNotes: reason || 'Approval intent revoked',
      updateFields: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Transitions action to QUEUED state for execution dispatcher.
   */
  public static async queueAction(actionId: string, userId: string = 'SYSTEM'): Promise<ProposedActionItem> {
    return await this.executeAtomicTransition({
      actionId,
      targetState: 'QUEUED',
      actorId: userId,
    });
  }

  /**
   * Transitions action to EXECUTING state and records consumed timestamp.
   */
  public static async markExecuting(
    actionId: string,
    executionId: string,
    userId: string = 'WORKER'
  ): Promise<ProposedActionItem> {
    return await this.executeAtomicTransition({
      actionId,
      targetState: 'EXECUTING',
      actorId: userId,
      updateFields: {
        actionExecutionId: executionId,
        consumedAt: new Date(),
      },
    });
  }

  /**
   * Transitions action to VERIFYING state.
   */
  public static async markVerifying(
    actionId: string,
    stageName: string = 'STAGE_1_SYNTHETIC_DOM',
    userId: string = 'VERIFIER'
  ): Promise<ProposedActionItem> {
    return await this.executeAtomicTransition({
      actionId,
      targetState: 'VERIFYING',
      actorId: userId,
      reasonOrNotes: `Stage: ${stageName}`,
    });
  }

  /**
   * Transitions action to VERIFIED state.
   */
  public static async markVerified(actionId: string, userId: string = 'VERIFIER'): Promise<ProposedActionItem> {
    return await this.executeAtomicTransition({
      actionId,
      targetState: 'VERIFIED',
      actorId: userId,
      reasonOrNotes: 'All verification stages satisfied',
    });
  }

  /**
   * Transitions action to ROLLED_BACK state.
   */
  public static async markRolledBack(
    actionId: string,
    reason: string,
    userId: string = 'ROLLBACK_WORKER'
  ): Promise<ProposedActionItem> {
    return await this.executeAtomicTransition({
      actionId,
      targetState: 'ROLLED_BACK',
      actorId: userId,
      reasonOrNotes: reason,
    });
  }

  /**
   * Retrieves all action approval items for a website from Prisma DB.
   */
  public static async getApprovalQueue(
    websiteId: string,
    stateFilter?: ApprovalState
  ): Promise<ProposedActionItem[]> {
    return await this.getApprovalQueueAsync(websiteId, stateFilter);
  }

  /**
   * Async database-backed retrieval for approval queue.
   */
  public static async getApprovalQueueAsync(
    websiteId: string,
    stateFilter?: ApprovalState
  ): Promise<ProposedActionItem[]> {
    const where: any = { websiteId };
    if (stateFilter) {
      where.state = stateFilter;
    }

    const records = await prisma.actionApprovalRequest.findMany({
      where,
      orderBy: { opportunityScore: 'desc' },
    });

    return records.map((rec) => this.mapDbRecordToItem(rec));
  }

  /**
   * Retrieves an action item by ID from Prisma DB.
   */
  public static async getActionById(actionId: string): Promise<ProposedActionItem | null> {
    return await this.getActionByIdAsync(actionId);
  }

  /**
   * Async database-backed retrieval for a single action item.
   */
  public static async getActionByIdAsync(actionId: string): Promise<ProposedActionItem | null> {
    const rec = await prisma.actionApprovalRequest.findUnique({
      where: { id: actionId },
    });
    if (!rec) return null;
    return this.mapDbRecordToItem(rec);
  }

  /**
   * Retrieves all transition logs for an action item from Prisma DB.
   */
  public static async getTransitionLogs(actionId: string): Promise<StateTransitionLog[]> {
    return await this.getTransitionLogsAsync(actionId);
  }

  /**
   * Async database-backed retrieval for transition logs.
   */
  public static async getTransitionLogsAsync(actionId: string): Promise<StateTransitionLog[]> {
    const logs = await prisma.actionStateTransitionLog.findMany({
      where: { approvalRequestId: actionId },
      orderBy: { timestamp: 'asc' },
    });

    return logs.map((l) => ({
      id: l.id,
      actionId: l.approvalRequestId,
      previousState: l.fromState as ApprovalState,
      newState: l.toState as ApprovalState,
      triggeredByUserId: l.actorId,
      reason: l.reason || undefined,
      timestamp: l.timestamp,
    }));
  }
}
