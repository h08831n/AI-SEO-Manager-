export interface CrawledPageSnapshot {
  url: string;
  normalizedUrl: string;
  statusCode: number;
  finalUrl?: string | null;
  title?: string | null;
  metaDescription?: string | null;
  h1Tags: string[];
  canonicalUrl?: string | null;
  isIndexable: boolean;
  contentHash?: string | null;
  inlinksCount: number;
}

export interface DetectedSeoEvent {
  websiteId: string;
  crawlRunId: string;
  eventType: string; // NEW_URL, REMOVED_URL, STATUS_CHANGED, TITLE_CHANGED, CANONICAL_CHANGED, ROBOTS_CHANGED, INDEXABILITY_CHANGED, NEW_404, RECOVERED_404, CONTENT_CHANGED
  entityType: string;
  entityUrl: string;
  beforeValue?: string;
  afterValue?: string;
  deltaNotes?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  source: string;
}

export class CrawlSnapshotComparator {
  /**
   * Compares current crawl run snapshots against previous run snapshots and produces deterministic SEO events
   */
  public static compareSnapshots(
    websiteId: string,
    currentCrawlRunId: string,
    currentPages: CrawledPageSnapshot[],
    previousPages: CrawledPageSnapshot[]
  ): DetectedSeoEvent[] {
    const events: DetectedSeoEvent[] = [];
    const prevMap = new Map<string, CrawledPageSnapshot>();
    const currMap = new Map<string, CrawledPageSnapshot>();

    for (const p of previousPages) {
      prevMap.set(p.normalizedUrl, p);
    }
    for (const c of currentPages) {
      currMap.set(c.normalizedUrl, c);
    }

    // 1. Evaluate current pages against previous
    for (const curr of currentPages) {
      const prev = prevMap.get(curr.normalizedUrl);

      if (!prev) {
        // NEW_URL discovered
        events.push({
          websiteId,
          crawlRunId: currentCrawlRunId,
          eventType: 'NEW_URL',
          entityType: 'URL',
          entityUrl: curr.url,
          afterValue: JSON.stringify({ statusCode: curr.statusCode, title: curr.title }),
          deltaNotes: 'URL observed for the first time in site crawl history',
          severity: 'INFO',
          source: 'CRAWLER',
        });
        continue;
      }

      // Status Change
      if (curr.statusCode !== prev.statusCode) {
        const isNew404 = curr.statusCode === 404;
        const isRecovered404 = prev.statusCode === 404 && curr.statusCode === 200;

        events.push({
          websiteId,
          crawlRunId: currentCrawlRunId,
          eventType: isNew404 ? 'NEW_404' : isRecovered404 ? 'RECOVERED_404' : 'STATUS_CHANGED',
          entityType: 'URL',
          entityUrl: curr.url,
          beforeValue: JSON.stringify({ statusCode: prev.statusCode }),
          afterValue: JSON.stringify({ statusCode: curr.statusCode }),
          deltaNotes: `HTTP status changed from ${prev.statusCode} to ${curr.statusCode}`,
          severity: isNew404 ? 'CRITICAL' : isRecovered404 ? 'INFO' : curr.statusCode >= 500 ? 'CRITICAL' : 'MEDIUM',
          source: 'CRAWLER',
        });
      }

      // Title Change
      if (curr.title !== prev.title) {
        events.push({
          websiteId,
          crawlRunId: currentCrawlRunId,
          eventType: 'TITLE_CHANGED',
          entityType: 'URL',
          entityUrl: curr.url,
          beforeValue: JSON.stringify({ title: prev.title }),
          afterValue: JSON.stringify({ title: curr.title }),
          deltaNotes: `Title tag updated from "${prev.title || ''}" to "${curr.title || ''}"`,
          severity: 'MEDIUM',
          source: 'CRAWLER',
        });
      }

      // Canonical Change
      if (curr.canonicalUrl !== prev.canonicalUrl) {
        events.push({
          websiteId,
          crawlRunId: currentCrawlRunId,
          eventType: 'CANONICAL_CHANGED',
          entityType: 'URL',
          entityUrl: curr.url,
          beforeValue: JSON.stringify({ canonicalUrl: prev.canonicalUrl }),
          afterValue: JSON.stringify({ canonicalUrl: curr.canonicalUrl }),
          deltaNotes: `Canonical URL directive changed from "${prev.canonicalUrl || 'none'}" to "${curr.canonicalUrl || 'none'}"`,
          severity: 'HIGH',
          source: 'CRAWLER',
        });
      }

      // Indexability Change
      if (curr.isIndexable !== prev.isIndexable) {
        events.push({
          websiteId,
          crawlRunId: currentCrawlRunId,
          eventType: 'INDEXABILITY_CHANGED',
          entityType: 'URL',
          entityUrl: curr.url,
          beforeValue: JSON.stringify({ isIndexable: prev.isIndexable }),
          afterValue: JSON.stringify({ isIndexable: curr.isIndexable }),
          deltaNotes: `Indexability status changed to ${curr.isIndexable ? 'INDEXABLE' : 'NON_INDEXABLE'}`,
          severity: curr.isIndexable ? 'INFO' : 'HIGH',
          source: 'CRAWLER',
        });
      }

      // Content Hash Change
      if (curr.contentHash && prev.contentHash && curr.contentHash !== prev.contentHash && curr.title === prev.title) {
        events.push({
          websiteId,
          crawlRunId: currentCrawlRunId,
          eventType: 'CONTENT_CHANGED',
          entityType: 'URL',
          entityUrl: curr.url,
          beforeValue: JSON.stringify({ contentHash: prev.contentHash }),
          afterValue: JSON.stringify({ contentHash: curr.contentHash }),
          deltaNotes: 'Page body copy modified without metadata change',
          severity: 'INFO',
          source: 'CRAWLER',
        });
      }
    }

    // 2. Evaluate missing URLs from current crawl (NOT_DISCOVERED_THIS_RUN)
    for (const prev of previousPages) {
      if (!currMap.has(prev.normalizedUrl)) {
        events.push({
          websiteId,
          crawlRunId: currentCrawlRunId,
          eventType: 'REMOVED_URL',
          entityType: 'URL',
          entityUrl: prev.url,
          beforeValue: JSON.stringify({ statusCode: prev.statusCode, title: prev.title }),
          deltaNotes: 'URL was not encountered during crawl discovery in this run',
          severity: 'LOW',
          source: 'CRAWLER',
        });
      }
    }

    return events;
  }
}
