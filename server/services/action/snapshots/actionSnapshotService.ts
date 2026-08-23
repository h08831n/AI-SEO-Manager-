import { prisma } from '../../../db/prisma';
import { ActionPreStateSnapshot, RollbackExecutionHistory } from '../actionTypes';
import crypto from 'crypto';

export class ActionSnapshotService {
  private static snapshotCache: Map<string, ActionPreStateSnapshot> = new Map();

  /**
   * Persists pre-state snapshot durably to ActionPreStateSnapshot table so rollbacks survive worker restarts.
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

    // Persist directly to ActionPreStateSnapshot Prisma model
    await prisma.actionPreStateSnapshot.create({
      data: {
        id: snapshot.id,
        actionExecutionId,
        websiteId,
        checksum,
        snapshotJson: preStateJson,
        createdAt: snapshot.createdAt,
      },
    });

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

    // 2. Query persistent ActionPreStateSnapshot model
    const persistentSnap = await prisma.actionPreStateSnapshot.findFirst({
      where: { actionExecutionId },
    });

    if (persistentSnap) {
      const execution = await prisma.actionExecution.findUnique({
        where: { id: actionExecutionId },
      });

      const recovered: ActionPreStateSnapshot = {
        id: persistentSnap.id,
        actionExecutionId: persistentSnap.actionExecutionId,
        websiteId: persistentSnap.websiteId,
        actionType: execution?.actionType || 'UNKNOWN_ACTION',
        targetUrl: execution?.targetUrl || '',
        preStateJson: persistentSnap.snapshotJson,
        checksum: persistentSnap.checksum,
        createdAt: persistentSnap.createdAt,
      };

      this.snapshotCache.set(actionExecutionId, recovered);
      return recovered;
    }

    // 3. Fallback recovery from ActionExecution beforeEvidenceJson
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
    const restoredStateJson = JSON.stringify(preStateRestored);
    const actorId = rolledBackByUserId || 'SYSTEM_ROLLBACK_ENGINE';

    const historyEntry: RollbackExecutionHistory = {
      id: `rb-hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      actionExecutionId,
      websiteId,
      rolledBackByUserId: actorId,
      reason,
      preStateRestoredJson: restoredStateJson,
      success,
      rolledBackAt: new Date(),
      durationMs: durationMs || 0,
    };

    // Persist directly to RollbackExecutionHistory Prisma model
    await prisma.rollbackExecutionHistory.create({
      data: {
        id: historyEntry.id,
        actionExecutionId,
        reason,
        restoredStateJson,
        success,
        actorId,
        createdAt: historyEntry.rolledBackAt,
      },
    });

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
   * Retrieves rollback execution history for a website from persistent database storage.
   */
  public static async getRollbackHistory(websiteId: string): Promise<RollbackExecutionHistory[]> {
    const histories = await prisma.rollbackExecutionHistory.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Format as RollbackExecutionHistory domain objects
    return histories.map((h) => ({
      id: h.id,
      actionExecutionId: h.actionExecutionId,
      websiteId,
      rolledBackByUserId: h.actorId,
      reason: h.reason,
      preStateRestoredJson: h.restoredStateJson,
      success: h.success,
      rolledBackAt: h.createdAt,
      durationMs: 0,
    }));
  }

  /**
   * Clears in-memory cache for worker restart simulation testing.
   */
  public static simulateWorkerRestart(): void {
    this.snapshotCache.clear();
  }
}
