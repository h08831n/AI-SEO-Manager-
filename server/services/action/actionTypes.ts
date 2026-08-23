import { ActionStatus, AutomationRiskLevel } from '@prisma/client';

export type ActionType =
  | 'SET_CANONICAL_URL'
  | 'SET_META_TAGS'
  | 'INJECT_STRUCTURED_DATA'
  | 'CREATE_REDIRECT_RULE'
  | 'INJECT_INTERNAL_LINK'
  | 'MODIFY_ROBOTS_TXT';

export interface ActionTarget {
  websiteId: string;
  targetUrl: string;
  domain: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface ExecutionResult<TData = any> {
  success: boolean;
  actionId: string;
  appliedState: TData;
  preStateSnapshot: any;
  executedAt: Date;
  message?: string;
  diffSummary?: string;
}

export interface RollbackResult {
  success: boolean;
  actionId: string;
  restoredState: any;
  rolledBackAt: Date;
  message?: string;
}

export interface VerificationCheckResult {
  tier: 'TIER_1_IMMEDIATE' | 'TIER_2_INTERMEDIATE' | 'TIER_3_LONG_TERM';
  passed: boolean;
  status: ActionStatus;
  observedData: Record<string, any>;
  expectedData: Record<string, any>;
  varianceDetails?: string;
  requiresRollback: boolean;
  verifiedAt: Date;
}
