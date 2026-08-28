/**
 * Phase 6.2 Recalibration Lock Service
 * 
 * Provides distributed and multi-instance concurrency control for Bayesian weight recalibration.
 * Uses PostgreSQL row-level lease locking with automatic expiration to prevent duplicate simultaneous executions.
 */

import { prisma } from '../../db/prisma';

export interface RecalibrationLockResult {
  acquired: boolean;
  websiteId: string;
  lockedBy: string;
  expiresAt?: Date;
  reason?: string;
}

export class RecalibrationLockManager {
  private static readonly DEFAULT_LEASE_TTL_MS = 60_000; // 1 minute lease

  /**
   * Attempts to acquire an exclusive recalibration lock for the specified website.
   */
  public static async acquireLock(
    websiteId: string,
    workerId: string,
    ttlMs: number = this.DEFAULT_LEASE_TTL_MS
  ): Promise<RecalibrationLockResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    try {
      // Check existing lock
      const existing = await prisma.bayesianRecalibrationLock.findUnique({
        where: { websiteId },
      });

      if (existing) {
        const lockExpired = existing.expiresAt && new Date(existing.expiresAt) <= now;
        if (!lockExpired && existing.lockedBy !== workerId) {
          return {
            acquired: false,
            websiteId,
            lockedBy: existing.lockedBy,
            expiresAt: existing.expiresAt,
            reason: `Locked by worker ${existing.lockedBy} until ${existing.expiresAt.toISOString()}`,
          };
        }

        // Lock expired or owned by same worker -> update / take over lease
        await prisma.bayesianRecalibrationLock.update({
          where: { websiteId },
          data: {
            lockedBy: workerId,
            lockedAt: now,
            expiresAt,
          },
        });

        return {
          acquired: true,
          websiteId,
          lockedBy: workerId,
          expiresAt,
        };
      }

      // No existing lock -> create new
      await prisma.bayesianRecalibrationLock.create({
        data: {
          websiteId,
          lockedBy: workerId,
          lockedAt: now,
          expiresAt,
        },
      });

      return {
        acquired: true,
        websiteId,
        lockedBy: workerId,
        expiresAt,
      };
    } catch {
      // Concurrency conflict / duplicate key on create race
      return {
        acquired: false,
        websiteId,
        lockedBy: 'concurrent_process',
        reason: 'Failed to acquire lease due to concurrent lock contention',
      };
    }
  }

  /**
   * Releases an active recalibration lock held by workerId.
   */
  public static async releaseLock(websiteId: string, workerId: string): Promise<boolean> {
    try {
      const existing = await prisma.bayesianRecalibrationLock.findUnique({
        where: { websiteId },
      });

      if (!existing) {
        return true;
      }

      // Only release if owned by same worker or expired
      if (existing.lockedBy === workerId || (existing.expiresAt && new Date(existing.expiresAt) <= new Date())) {
        await prisma.bayesianRecalibrationLock.delete({
          where: { websiteId },
        });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Executes an action inside an acquired lock. Safely releases lock when done.
   */
  public static async withLock<T>(
    websiteId: string,
    workerId: string,
    fn: () => Promise<T>,
    ttlMs: number = this.DEFAULT_LEASE_TTL_MS
  ): Promise<{ executed: boolean; result?: T; reason?: string }> {
    const lock = await this.acquireLock(websiteId, workerId, ttlMs);
    if (!lock.acquired) {
      return {
        executed: false,
        reason: lock.reason || 'Lock acquisition failed',
      };
    }

    try {
      const result = await fn();
      return { executed: true, result };
    } finally {
      await this.releaseLock(websiteId, workerId);
    }
  }
}
