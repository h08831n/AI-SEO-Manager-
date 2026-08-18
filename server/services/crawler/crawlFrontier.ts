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
        const next = await prisma.crawlFrontierEntry.findFirst({
          where: {
            crawlRunId: this.crawlRunId,
            status: { in: ['DISCOVERED', 'QUEUED'] },
          },
          orderBy: [
            { priority: 'desc' },
            { depth: 'asc' },
            { createdAt: 'asc' },
          ],
        });

        if (next) {
          const updated = await prisma.crawlFrontierEntry.update({
            where: { id: next.id },
            data: { status: 'FETCHING' },
          });
          return {
            id: updated.id,
            crawlRunId: updated.crawlRunId,
            url: updated.url,
            normalizedUrl: updated.normalizedUrl,
            depth: updated.depth,
            priority: updated.priority,
            status: updated.status,
            discoverySource: updated.discoverySource,
            parentUrl: updated.parentUrl || undefined,
            attemptCount: updated.attemptCount,
            lastError: updated.lastError || undefined,
            createdAt: updated.createdAt.toISOString(),
          };
        }
        return undefined;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: Frontier dequeue failed: ${err}`);
        }
      }
    }

    const item = this.memoryQueue.shift();
    if (item) {
      item.status = 'FETCHING';
      this.memoryVisitedUrls.add(item.normalizedUrl);
    }
    return item;
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
          createdAt: r.createdAt.toISOString(),
        }));
      } catch {
        // fallback
      }
    }
    return Array.from(this.memoryItemsByNormalizedUrl.values());
  }
}
