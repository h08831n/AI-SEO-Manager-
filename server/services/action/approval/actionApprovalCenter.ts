import { ApprovalState, ProposedActionItem, StateTransitionLog } from './approvalTypes';
import { prisma } from '../../../db/prisma';

export class ActionApprovalCenter {
  private static actionStore: Map<string, ProposedActionItem> = new Map();
  private static transitionLogs: Map<string, StateTransitionLog[]> = new Map();

  // Valid State Machine Transitions
  private static ALLOWED_TRANSITIONS: Record<ApprovalState, ApprovalState[]> = {
    PROPOSED: ['APPROVED', 'REJECTED'],
    APPROVED: ['QUEUED', 'REJECTED'],
    REJECTED: ['PROPOSED'], // Can be re-proposed if reworked
    QUEUED: ['EXECUTING', 'REJECTED'],
    EXECUTING: ['VERIFYING', 'ROLLED_BACK'],
    VERIFYING: ['VERIFIED', 'ROLLED_BACK'],
    VERIFIED: ['ROLLED_BACK'], // 1-click rollback after verification
    ROLLED_BACK: ['PROPOSED'],
  };

  /**
   * Proposes a new action item into the Action Approval Center.
   */
  public static async proposeAction(params: {
    websiteId: string;
    actionType: string;
    targetUrl: string;
    ruleKey?: string;
    payload: Record<string, any>;
    opportunityScore?: number;
    riskLevel?: 'LEVEL_0_SUGGESTION_ONLY' | 'LEVEL_1_SAFE_AUTOMATION' | 'LEVEL_2_REVIEW_REQUIRED' | 'LEVEL_3_HIGH_RISK_MANUAL';
    proposedBy?: string;
  }): Promise<ProposedActionItem> {
    const {
      websiteId,
      actionType,
      targetUrl,
      ruleKey,
      payload,
      opportunityScore = 75,
      riskLevel = 'LEVEL_2_REVIEW_REQUIRED',
      proposedBy = 'SYSTEM_DIAGNOSIS_ENGINE',
    } = params;

    const actionItem: ProposedActionItem = {
      id: `prop-act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      websiteId,
      actionType,
      targetUrl,
      ruleKey,
      payload,
      opportunityScore,
      riskLevel,
      state: 'PROPOSED',
      proposedBy,
      proposedAt: new Date(),
      updatedAt: new Date(),
    };

    this.actionStore.set(actionItem.id, actionItem);

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
   * Approves a proposed action.
   */
  public static async approveAction(params: {
    actionId: string;
    userId: string;
    notes?: string;
  }): Promise<ProposedActionItem> {
    const { actionId, userId, notes } = params;
    const action = this.getActionOrThrow(actionId);

    this.validateTransition(action.state, 'APPROVED');

    action.state = 'APPROVED';
    action.approvedBy = userId;
    action.approvalNotes = notes;
    action.updatedAt = new Date();

    await this.logTransition(actionId, 'PROPOSED', 'APPROVED', userId, notes);
    return action;
  }

  /**
   * Rejects a proposed or approved action.
   */
  public static async rejectAction(params: {
    actionId: string;
    userId: string;
    reason: string;
  }): Promise<ProposedActionItem> {
    const { actionId, userId, reason } = params;
    const action = this.getActionOrThrow(actionId);

    this.validateTransition(action.state, 'REJECTED');

    const prevState = action.state;
    action.state = 'REJECTED';
    action.rejectedBy = userId;
    action.rejectionReason = reason;
    action.updatedAt = new Date();

    await this.logTransition(actionId, prevState, 'REJECTED', userId, reason);
    return action;
  }

  /**
   * Transitions action to QUEUED state for execution dispatcher.
   */
  public static async queueAction(actionId: string, userId: string = 'SYSTEM'): Promise<ProposedActionItem> {
    const action = this.getActionOrThrow(actionId);
    this.validateTransition(action.state, 'QUEUED');

    const prevState = action.state;
    action.state = 'QUEUED';
    action.updatedAt = new Date();

    await this.logTransition(actionId, prevState, 'QUEUED', userId);
    return action;
  }

  /**
   * Transitions action to EXECUTING state.
   */
  public static async markExecuting(
    actionId: string,
    executionId: string,
    userId: string = 'WORKER'
  ): Promise<ProposedActionItem> {
    const action = this.getActionOrThrow(actionId);
    this.validateTransition(action.state, 'EXECUTING');

    const prevState = action.state;
    action.state = 'EXECUTING';
    action.executionId = executionId;
    action.updatedAt = new Date();

    await this.logTransition(actionId, prevState, 'EXECUTING', userId);
    return action;
  }

  /**
   * Transitions action to VERIFYING state.
   */
  public static async markVerifying(
    actionId: string,
    stageName: string = 'STAGE_1_SYNTHETIC_DOM',
    userId: string = 'VERIFIER'
  ): Promise<ProposedActionItem> {
    const action = this.getActionOrThrow(actionId);
    this.validateTransition(action.state, 'VERIFYING');

    const prevState = action.state;
    action.state = 'VERIFYING';
    action.verificationStage = stageName;
    action.updatedAt = new Date();

    await this.logTransition(actionId, prevState, 'VERIFYING', userId, `Stage: ${stageName}`);
    return action;
  }

  /**
   * Transitions action to VERIFIED state.
   */
  public static async markVerified(actionId: string, userId: string = 'VERIFIER'): Promise<ProposedActionItem> {
    const action = this.getActionOrThrow(actionId);
    this.validateTransition(action.state, 'VERIFIED');

    const prevState = action.state;
    action.state = 'VERIFIED';
    action.updatedAt = new Date();

    await this.logTransition(actionId, prevState, 'VERIFIED', userId, 'All verification stages satisfied');
    return action;
  }

  /**
   * Transitions action to ROLLED_BACK state.
   */
  public static async markRolledBack(
    actionId: string,
    reason: string,
    userId: string = 'ROLLBACK_WORKER'
  ): Promise<ProposedActionItem> {
    const action = this.getActionOrThrow(actionId);
    this.validateTransition(action.state, 'ROLLED_BACK');

    const prevState = action.state;
    action.state = 'ROLLED_BACK';
    action.updatedAt = new Date();

    await this.logTransition(actionId, prevState, 'ROLLED_BACK', userId, reason);
    return action;
  }

  /**
   * Retrieves all action approval items for a website, optionally filtered by state.
   */
  public static getApprovalQueue(websiteId: string, stateFilter?: ApprovalState): ProposedActionItem[] {
    const items: ProposedActionItem[] = [];
    for (const item of this.actionStore.values()) {
      if (item.websiteId === websiteId) {
        if (!stateFilter || item.state === stateFilter) {
          items.push(item);
        }
      }
    }
    return items.sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  public static getActionById(actionId: string): ProposedActionItem | undefined {
    return this.actionStore.get(actionId);
  }

  public static getTransitionLogs(actionId: string): StateTransitionLog[] {
    return this.transitionLogs.get(actionId) || [];
  }

  private static getActionOrThrow(actionId: string): ProposedActionItem {
    const action = this.actionStore.get(actionId);
    if (!action) {
      throw new Error(`Approval item with ID '${actionId}' not found`);
    }
    return action;
  }

  private static validateTransition(currentState: ApprovalState, targetState: ApprovalState): void {
    const allowed = this.ALLOWED_TRANSITIONS[currentState] || [];
    if (!allowed.includes(targetState)) {
      throw new Error(
        `Invalid Action Approval state transition: cannot transition from '${currentState}' to '${targetState}'`
      );
    }
  }

  private static async logTransition(
    actionId: string,
    previousState: ApprovalState,
    newState: ApprovalState,
    triggeredByUserId: string,
    reason?: string
  ): Promise<void> {
    const log: StateTransitionLog = {
      id: `trans-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      actionId,
      previousState,
      newState,
      triggeredByUserId,
      reason,
      timestamp: new Date(),
    };

    const logs = this.transitionLogs.get(actionId) || [];
    logs.push(log);
    this.transitionLogs.set(actionId, logs);

    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'APPROVAL_CENTER',
        aggregateId: actionId,
        eventType: 'ACTION_STATE_TRANSITIONED',
        payloadJson: JSON.stringify(log),
      },
    });
  }
}
