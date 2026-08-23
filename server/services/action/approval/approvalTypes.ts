export type ApprovalState =
  | 'PROPOSED'
  | 'APPROVED'
  | 'REJECTED'
  | 'QUEUED'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'ROLLED_BACK';

export interface ProposedActionItem {
  id: string;
  websiteId: string;
  actionType: string;
  targetUrl: string;
  ruleKey?: string;
  payload: Record<string, any>;
  opportunityScore: number;
  riskLevel: 'LEVEL_0_SUGGESTION_ONLY' | 'LEVEL_1_SAFE_AUTOMATION' | 'LEVEL_2_REVIEW_REQUIRED' | 'LEVEL_3_HIGH_RISK_MANUAL';
  state: ApprovalState;
  proposedBy: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  approvalNotes?: string;
  executionId?: string;
  verificationStage?: string;
  proposedAt: Date;
  updatedAt: Date;
}

export interface StateTransitionLog {
  id: string;
  actionId: string;
  previousState: ApprovalState;
  newState: ApprovalState;
  triggeredByUserId: string;
  reason?: string;
  timestamp: Date;
}
