import { ActionStatus, AutomationRiskLevel } from '@prisma/client';
import { CmsPlatformType } from './cms/cmsActionProviderInterface';

export type ActionType =
  | 'SET_CANONICAL_URL'
  | 'SET_META_TAGS'
  | 'INJECT_STRUCTURED_DATA'
  | 'CREATE_REDIRECT_RULE'
  | 'INJECT_INTERNAL_LINK'
  | 'MODIFY_ROBOTS_TXT'
  | 'CONTENT_REFRESH_ACTION';

export interface ActionTarget {
  websiteId: string;
  targetUrl: string;
  domain: string;
  platform?: CmsPlatformType | string;
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
  stage: 'STAGE_1_SYNTHETIC_DOM' | 'STAGE_2_INDEX_SERP' | 'STAGE_3_TRAFFIC_CONVERSION';
  passed: boolean;
  status: ActionStatus;
  observedData: Record<string, any>;
  expectedData: Record<string, any>;
  varianceDetails?: string;
  requiresRollback: boolean;
  verifiedAt: Date;
  stageName?: string;
  stageMetrics?: Record<string, any>;
}

// Rollback & Pre-state Persistent Data Models
export interface ActionPreStateSnapshot {
  id: string;
  actionExecutionId: string;
  websiteId: string;
  actionType: string;
  targetUrl: string;
  preStateJson: string;
  checksum: string;
  createdAt: Date;
}

export interface RollbackExecutionHistory {
  id: string;
  actionExecutionId: string;
  websiteId: string;
  rolledBackByUserId?: string;
  reason: string;
  preStateRestoredJson: string;
  success: boolean;
  rolledBackAt: Date;
  durationMs?: number;
}
