import { FrontierStatus } from '@prisma/client';

export interface FrontierItem {
  id: string;
  crawlRunId: string;
  url: string;
  normalizedUrl: string;
  depth: number;
  priority: number;
  status: FrontierStatus;
  discoverySource: string; // SEED, SITEMAP, HTML_LINK, REDIRECT
  parentUrl?: string;
  attemptCount: number;
  lastError?: string;
  createdAt: string;
}

export class CrawlFrontier {
  private queue: FrontierItem[] = [];
  private visitedUrls: Set<string> = new Set();
  private itemsByNormalizedUrl: Map<string, FrontierItem> = new Map();

  public enqueue(
    crawlRunId: string,
    url: string,
    normalizedUrl: string,
    depth: number,
    discoverySource: string,
    priority = 10,
    parentUrl?: string
  ): boolean {
    if (this.visitedUrls.has(normalizedUrl) || this.itemsByNormalizedUrl.has(normalizedUrl)) {
      return false;
    }

    const item: FrontierItem = {
      id: `front-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      crawlRunId,
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

    this.itemsByNormalizedUrl.set(normalizedUrl, item);
    this.queue.push(item);
    // Sort by priority (higher first), then depth (shallow first)
    this.queue.sort((a, b) => (b.priority !== a.priority ? b.priority - a.priority : a.depth - b.depth));
    return true;
  }

  public dequeue(): FrontierItem | undefined {
    const item = this.queue.shift();
    if (item) {
      item.status = 'FETCHING';
      this.visitedUrls.add(item.normalizedUrl);
    }
    return item;
  }

  public markCompleted(normalizedUrl: string): void {
    const item = this.itemsByNormalizedUrl.get(normalizedUrl);
    if (item) {
      item.status = 'FETCHED';
    }
  }

  public markFailed(normalizedUrl: string, error: string): void {
    const item = this.itemsByNormalizedUrl.get(normalizedUrl);
    if (item) {
      item.status = 'FAILED';
      item.attemptCount += 1;
      item.lastError = error;
    }
  }

  public markBlocked(normalizedUrl: string, reason: 'ROBOTS' | 'SCOPE' | 'SECURITY'): void {
    const item = this.itemsByNormalizedUrl.get(normalizedUrl);
    if (item) {
      item.status = reason === 'ROBOTS' ? 'BLOCKED_ROBOTS' : reason === 'SCOPE' ? 'BLOCKED_SCOPE' : 'BLOCKED_SECURITY';
      this.visitedUrls.add(normalizedUrl);
    }
  }

  public size(): number {
    return this.queue.length;
  }

  public isVisited(normalizedUrl: string): boolean {
    return this.visitedUrls.has(normalizedUrl);
  }

  public getAllItems(): FrontierItem[] {
    return Array.from(this.itemsByNormalizedUrl.values());
  }
}
