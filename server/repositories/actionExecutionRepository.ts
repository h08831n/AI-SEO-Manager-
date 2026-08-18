import { ActionStatus } from '@prisma/client';

export interface ActionExecutionRecord {
  id: string;
  websiteId: string;
  taskId?: string;
  recommendationId?: string;
  actionType: string;
  targetUrl: string;
  idempotencyKey: string;
  requestedByUserId?: string;
  approvalId?: string;
  state: ActionStatus;
  attemptCount: number;
  beforeEvidenceJson?: string;
  afterEvidenceJson?: string;
  failureReason?: string;
  executedAt?: string;
  verifiedAt?: string;
  rollbackExecutionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionVerificationRecord {
  id: string;
  actionExecutionId: string;
  status: ActionStatus;
  expectedStateJson: string;
  observedStateJson?: string;
  isMatch: boolean;
  varianceNotes?: string;
  verifiedAt?: string;
  createdAt: string;
}

const actionExecutionsStore: Map<string, ActionExecutionRecord> = new Map();
const actionVerificationsStore: Map<string, ActionVerificationRecord> = new Map();
const idempotencyKeyIndex: Map<string, string> = new Map(); // idempotencyKey -> actionExecutionId

export class ActionExecutionRepository {
  public static async findByIdempotencyKey(key: string): Promise<ActionExecutionRecord | null> {
    const id = idempotencyKeyIndex.get(key);
    if (!id) return null;
    return actionExecutionsStore.get(id) || null;
  }

  public static async getById(id: string): Promise<ActionExecutionRecord | null> {
    return actionExecutionsStore.get(id) || null;
  }

  public static async listByWebsite(websiteId: string): Promise<ActionExecutionRecord[]> {
    return Array.from(actionExecutionsStore.values()).filter((e) => e.websiteId === websiteId);
  }

  /**
   * Submits an ActionExecution protected by logical idempotency.
   * If the key already exists, returns existing record without re-executing.
   */
  public static async submitActionExecution(params: {
    websiteId: string;
    actionType: string;
    targetUrl: string;
    idempotencyKey: string;
    taskId?: string;
    recommendationId?: string;
    requestedByUserId?: string;
    beforeEvidenceJson?: string;
    isDryRun?: boolean;
  }): Promise<{ action: ActionExecutionRecord; isDuplicate: boolean }> {
    const existingId = idempotencyKeyIndex.get(params.idempotencyKey);
    if (existingId) {
      const existing = actionExecutionsStore.get(existingId);
      if (existing) {
        return { action: existing, isDuplicate: true };
      }
    }

    const id = `act-exec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record: ActionExecutionRecord = {
      id,
      websiteId: params.websiteId,
      taskId: params.taskId,
      recommendationId: params.recommendationId,
      actionType: params.actionType,
      targetUrl: params.targetUrl,
      idempotencyKey: params.idempotencyKey,
      requestedByUserId: params.requestedByUserId,
      state: params.isDryRun ? 'DRY_RUN' : 'PENDING_APPROVAL',
      attemptCount: 1,
      beforeEvidenceJson: params.beforeEvidenceJson,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    actionExecutionsStore.set(id, record);
    idempotencyKeyIndex.set(params.idempotencyKey, id);

    return { action: record, isDuplicate: false };
  }

  public static async recordVerification(params: {
    actionExecutionId: string;
    expectedStateJson: string;
    observedStateJson?: string;
    isMatch: boolean;
    varianceNotes?: string;
  }): Promise<ActionVerificationRecord> {
    const action = actionExecutionsStore.get(params.actionExecutionId);
    if (!action) {
      throw new Error(`Action execution not found: ${params.actionExecutionId}`);
    }

    const verificationId = `act-verif-${Date.now()}`;
    const verification: ActionVerificationRecord = {
      id: verificationId,
      actionExecutionId: params.actionExecutionId,
      status: params.isMatch ? 'VERIFIED_COMPLETED' : 'UNVERIFIED_BLOCKED',
      expectedStateJson: params.expectedStateJson,
      observedStateJson: params.observedStateJson,
      isMatch: params.isMatch,
      varianceNotes: params.varianceNotes,
      verifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    actionVerificationsStore.set(verificationId, verification);

    // Update parent action state
    action.state = params.isMatch ? 'VERIFIED_COMPLETED' : 'UNVERIFIED_BLOCKED';
    action.verifiedAt = verification.verifiedAt;
    action.updatedAt = new Date().toISOString();

    return verification;
  }

  public static async clearForTesting(): Promise<void> {
    actionExecutionsStore.clear();
    actionVerificationsStore.clear();
    idempotencyKeyIndex.clear();
  }
}
