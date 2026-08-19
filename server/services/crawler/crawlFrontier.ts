import { FrontierStatus } from '@prisma/client';
import { getPrismaClient } from '../../db/prismaClient';

export interface FrontierItem {
  id: string;
  crawlRunId: string;
  url: string;
  normalizedUrl: string;
  depth: number;
  priority: number;
  status: FrontierStatus;
  discoverySource: string; // SEED, SITEMAP, HTML_LINK, REDIRECT, CANONICAL, HREFLANG
  parentUrl?: string;
  attemptCount: number;
  lastError?: string;
  nextAttemptAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export class CrawlFrontier {
  private crawlRunId: string;
  private memoryQueue: FrontierItem[] = [];
  private memoryItemsByNormalizedUrl: Map<string, FrontierItem> = new Map();
  private memoryVisitedUrls: Set<string> = new Set();

  constructor(crawlRunId: string) {
    this.crawlRunId = crawlRunId;
  }

  public async enqueue(
    url: string,
    normalizedUrl: string,
    depth: number,
    discoverySource: string,
    priority = 10,
    parentUrl?: string
  ): Promise<boolean> {
    const prisma = getPrismaClient();

    if (prisma) {
      try {
        const id = `front-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await prisma.crawlFrontierEntry.upsert({
          where: {
            crawlRunId_normalizedUrl: {
              crawlRunId: this.crawlRunId,
              normalizedUrl,
            },
          },
          update: {}, // Already exists, do not duplicate
          create: {
            id,
            crawlRunId: this.crawlRunId,
            url,
            normalizedUrl,
            depth,
            priority,
            status: 'DISCOVERED',
            discoverySource,
            parentUrl,
            attemptCount: 0,
          },
        });
        return true;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: Frontier enqueue failed: ${err}`);
        }
      }
    }

    // In-memory fallback for DEV/TEST
    if (this.memoryVisitedUrls.has(normalizedUrl) || this.memoryItemsByNormalizedUrl.has(normalizedUrl)) {
      return false;
    }

    const item: FrontierItem = {
      id: `front-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      crawlRunId: this.crawlRunId,
      url,
      normalizedUrl,
      depth,
      priority,
      status: 'QUEUED',
      discoverySource,
      parentUrl,
      attemptCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.memoryItemsByNormalizedUrl.set(normalizedUrl, item);
    this.memoryQueue.push(item);
    this.memoryQueue.sort((a, b) => (b.priority !== a.priority ? b.priority - a.priority : a.depth - b.depth));
    return true;
  }

  public async dequeue(): Promise<FrontierItem | undefined> {
    const prisma = getPrismaClient();

    if (prisma) {
      try {
        const claimed = await prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<Array<{
            id: string;
            crawlRunId: string;
            url: string;
            normalizedUrl: string;
            depth: number;
            priority: number;
            status: FrontierStatus;
            discoverySource: string;
            parentUrl: string | null;
            attemptCount: number;
            lastError: string | null;
            nextAttemptAt: Date | null;
            createdAt: Date;
          }>>`
            SELECT id, "crawlRunId", url, "normalizedUrl", depth, priority, status, "discoverySource", "parentUrl", "attemptCount", "lastError", "nextAttemptAt", "createdAt"
            FROM "crawl_frontier_entries"
            WHERE "crawlRunId" = ${this.crawlRunId}
              AND (status = 'DISCOVERED' OR status = 'QUEUED' OR (status = 'FETCHING' AND "lockedUntil" < NOW()))
              AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
            ORDER BY priority DESC, depth ASC, "createdAt" ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED;
          `;

          if (rows.length === 0) {
            return null;
          }

          const selected = rows[0];
          const lockExpiry = new Date(Date.now() + 60000);

          await tx.crawlFrontierEntry.update({
            where: { id: selected.id },
            data: {
              status: 'FETCHING',
              lockedUntil: lockExpiry,
            },
          });

          return selected;
        });

        if (claimed) {
          return {
            id: claimed.id,
            crawlRunId: claimed.crawlRunId,
            url: claimed.url,
            normalizedUrl: claimed.normalizedUrl,
            depth: claimed.depth,
            priority: claimed.priority,
            status: 'FETCHING',
            discoverySource: claimed.discoverySource,
            parentUrl: claimed.parentUrl || undefined,
            attemptCount: claimed.attemptCount,
            lastError: claimed.lastError || undefined,
            nextAttemptAt: claimed.nextAttemptAt ? claimed.nextAttemptAt.toISOString() : undefined,
            createdAt: claimed.createdAt.toISOString(),
          };
        }
        return undefined;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: Frontier dequeue failed: ${err}`);
        }
      }
    }

    const nowIso = new Date().toISOString();
    const readyIdx = this.memoryQueue.findIndex(
      (item) => !item.nextAttemptAt || item.nextAttemptAt <= nowIso
    );

    if (readyIdx >= 0) {
      const item = this.memoryQueue.splice(readyIdx, 1)[0];
      item.status = 'FETCHING';
      this.memoryVisitedUrls.add(item.normalizedUrl);
      return item;
    }

    return undefined;
  }

  public async scheduleRetry(
    normalizedUrl: string,
    error: string,
    delayMs: number,
    attemptCount: number
  ): Promise<void> {
    const nextAttemptAt = new Date(Date.now() + delayMs);
    const prisma = getPrismaClient();

    if (prisma) {
      try {
        await prisma.crawlFrontierEntry.updateMany({
          where: { crawlRunId: this.crawlRunId, normalizedUrl },
          data: {
            status: 'DISCOVERED',
            lastError: error,
            attemptCount,
            nextAttemptAt,
          },
        });
        return;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: Frontier scheduleRetry failed: ${err}`);
        }
      }
    }

    const item = this.memoryItemsByNormalizedUrl.get(normalizedUrl);
    if (item) {
      item.status = 'QUEUED';
      item.attemptCount = attemptCount;
      item.lastError = error;
      item.nextAttemptAt = nextAttemptAt.toISOString();
      this.memoryVisitedUrls.delete(normalizedUrl);
      this.memoryQueue.push(item);
      this.memoryQueue.sort((a, b) => (b.priority !== a.priority ? b.priority - a.priority : a.depth - b.depth));
    }
  }

  public async markCompleted(normalizedUrl: string): Promise<void> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.crawlFrontierEntry.updateMany({
          where: { crawlRunId: this.crawlRunId, normalizedUrl },
          data: { status: 'FETCHED' },
        });
        return;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: ${err}`);
        }
      }
    }

    const item = this.memoryItemsByNormalizedUrl.get(normalizedUrl);
    if (item) {
      item.status = 'FETCHED';
    }
  }

  public async markFailed(normalizedUrl: string, error: string): Promise<void> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.crawlFrontierEntry.updateMany({
          where: { crawlRunId: this.crawlRunId, normalizedUrl },
          data: {
            status: 'FAILED',
            lastError: error,
            attemptCount: { increment: 1 },
          },
        });
        return;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: ${err}`);
        }
      }
    }

    const item = this.memoryItemsByNormalizedUrl.get(normalizedUrl);
    if (item) {
      item.status = 'FAILED';
      item.attemptCount += 1;
      item.lastError = error;
    }
  }

  public async markBlocked(normalizedUrl: string, reason: 'ROBOTS' | 'SCOPE' | 'SECURITY'): Promise<void> {
    const statusVal: FrontierStatus = reason === 'ROBOTS' ? 'BLOCKED_ROBOTS' : reason === 'SCOPE' ? 'BLOCKED_SCOPE' : 'BLOCKED_SECURITY';
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.crawlFrontierEntry.updateMany({
          where: { crawlRunId: this.crawlRunId, normalizedUrl },
          data: { status: statusVal },
        });
        return;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: ${err}`);
        }
      }
    }

    const item = this.memoryItemsByNormalizedUrl.get(normalizedUrl);
    if (item) {
      item.status = statusVal;
      this.memoryVisitedUrls.add(normalizedUrl);
    }
  }

  public async size(): Promise<number> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const count = await prisma.crawlFrontierEntry.count({
          where: {
            crawlRunId: this.crawlRunId,
            status: { in: ['DISCOVERED', 'QUEUED'] },
          },
        });
        return count;
      } catch {
        // fallback
      }
    }
    return this.memoryQueue.length;
  }

  public async isVisited(normalizedUrl: string): Promise<boolean> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const entry = await prisma.crawlFrontierEntry.findFirst({
          where: {
            crawlRunId: this.crawlRunId,
            normalizedUrl,
            status: { in: ['FETCHING', 'FETCHED', 'FAILED', 'BLOCKED_ROBOTS', 'BLOCKED_SCOPE', 'BLOCKED_SECURITY'] },
          },
        });
        return Boolean(entry);
      } catch {
        // fallback
      }
    }
    return this.memoryVisitedUrls.has(normalizedUrl);
  }

  public async getAllItems(): Promise<FrontierItem[]> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const rows = await prisma.crawlFrontierEntry.findMany({
          where: { crawlRunId: this.crawlRunId },
          orderBy: { createdAt: 'asc' },
        });
        return rows.map((r) => ({
          id: r.id,
          crawlRunId: r.crawlRunId,
          url: r.url,
          normalizedUrl: r.normalizedUrl,
          depth: r.depth,
          priority: r.priority,
          status: r.status,
          discoverySource: r.discoverySource,
          parentUrl: r.parentUrl || undefined,
          attemptCount: r.attemptCount,
          lastError: r.lastError || undefined,
          nextAttemptAt: r.nextAttemptAt ? r.nextAttemptAt.toISOString() : undefined,
          createdAt: r.createdAt.toISOString(),
        }));
      } catch {
        // fallback
      }
    }
    return Array.from(this.memoryItemsByNormalizedUrl.values());
  }
}
