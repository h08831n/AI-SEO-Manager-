import { prisma } from '../../../db/prisma';
import { ActionPreStateSnapshot, RollbackExecutionHistory } from '../actionTypes';
import crypto from 'crypto';

export class ActionSnapshotService {
  // In-memory fallback / cache that synchronizes with database
  private static snapshotCache: Map<string, ActionPreStateSnapshot> = new Map();
  private static rollbackHistoryCache: Map<string, RollbackExecutionHistory[]> = new Map();

  /**
   * Persists pre-state snapshot durably so rollbacks survive worker restarts.
   */
  public static async savePreStateSnapshot(params: {
    actionExecutionId: string;
    websiteId: string;
    actionType: string;
    targetUrl: string;
    preState: any;
  }): Promise<ActionPreStateSnapshot> {
    const { actionExecutionId, websiteId, actionType, targetUrl, preState } = params;
    const preStateJson = JSON.stringify(preState);
    const checksum = crypto.createHash('sha256').update(preStateJson).digest('hex');

    const snapshot: ActionPreStateSnapshot = {
      id: `snap-${actionExecutionId}`,
      actionExecutionId,
      websiteId,
      actionType,
      targetUrl,
      preStateJson,
      checksum,
      createdAt: new Date(),
    };

    this.snapshotCache.set(actionExecutionId, snapshot);

    // Save to ActionExecution beforeEvidenceJson in DB
    await prisma.actionExecution.updateMany({
      where: { id: actionExecutionId },
      data: {
        beforeEvidenceJson: preStateJson,
      },
    });

    // Record persistent snapshot event in Outbox
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'ACTION_SNAPSHOT',
        aggregateId: snapshot.id,
        eventType: 'PRE_STATE_SNAPSHOT_CAPTURED',
        payloadJson: JSON.stringify(snapshot),
      },
    });

    return snapshot;
  }

  /**
   * Retrieves the pre-state snapshot, recovering from database if in-memory cache was lost during a worker restart.
   */
  public static async getPreStateSnapshot(actionExecutionId: string): Promise<ActionPreStateSnapshot | null> {
    // 1. Check in-memory cache first
    const cached = this.snapshotCache.get(actionExecutionId);
    if (cached) {
      return cached;
    }

    // 2. Worker Restart Survival: Recover from Prisma DB ActionExecution
    const execution = await prisma.actionExecution.findUnique({
      where: { id: actionExecutionId },
    });

    if (execution && execution.beforeEvidenceJson) {
      const checksum = crypto.createHash('sha256').update(execution.beforeEvidenceJson).digest('hex');
      const recovered: ActionPreStateSnapshot = {
        id: `snap-${execution.id}`,
        actionExecutionId: execution.id,
        websiteId: execution.websiteId,
        actionType: execution.actionType,
        targetUrl: execution.targetUrl,
        preStateJson: execution.beforeEvidenceJson,
        checksum,
        createdAt: execution.createdAt,
      };

      this.snapshotCache.set(actionExecutionId, recovered);
      return recovered;
    }

    return null;
  }

  /**
   * Records a complete rollback execution history entry for permanent auditability.
   */
  public static async recordRollbackHistory(params: {
    actionExecutionId: string;
    websiteId: string;
    rolledBackByUserId?: string;
    reason: string;
    preStateRestored: any;
    success: boolean;
    durationMs?: number;
  }): Promise<RollbackExecutionHistory> {
    const { actionExecutionId, websiteId, rolledBackByUserId, reason, preStateRestored, success, durationMs } = params;

    const historyEntry: RollbackExecutionHistory = {
      id: `rb-hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      actionExecutionId,
      websiteId,
      rolledBackByUserId,
      reason,
      preStateRestoredJson: JSON.stringify(preStateRestored),
      success,
      rolledBackAt: new Date(),
      durationMs: durationMs || 0,
    };

    const list = this.rollbackHistoryCache.get(websiteId) || [];
    list.push(historyEntry);
    this.rollbackHistoryCache.set(websiteId, list);

    // Persist to Outbox Event
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'ROLLBACK_HISTORY',
        aggregateId: historyEntry.id,
        eventType: 'ROLLBACK_EXECUTED',
        payloadJson: JSON.stringify(historyEntry),
      },
    });

    return historyEntry;
  }

  /**
   * Retrieves rollback execution history for a website.
   */
  public static async getRollbackHistory(websiteId: string): Promise<RollbackExecutionHistory[]> {
    return this.rollbackHistoryCache.get(websiteId) || [];
  }

  /**
   * Clears in-memory cache for worker restart simulation testing.
   */
  public static simulateWorkerRestart(): void {
    this.snapshotCache.clear();
  }
}
