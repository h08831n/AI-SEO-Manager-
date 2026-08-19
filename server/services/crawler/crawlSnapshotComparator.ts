export interface CrawledPageSnapshot {
  url: string;
  normalizedUrl: string;
  statusCode: number;
  finalUrl?: string | null;
  title?: string | null;
  metaDescription?: string | null;
  h1Tags: string[];
  canonicalUrl?: string | null;
  metaRobots?: string | null;
  xRobotsTag?: string | null;
  isIndexable: boolean;
  contentHash?: string | null;
  inlinksCount: number;
}

export interface DetectedSeoEvent {
  websiteId: string;
  crawlRunId: string;
  eventType: string; // NEW_URL, NOT_DISCOVERED_THIS_RUN, STATUS_CHANGED, TITLE_CHANGED, DESCRIPTION_CHANGED, H1_CHANGED, CANONICAL_CHANGED, META_ROBOTS_CHANGED, X_ROBOTS_CHANGED, INDEXABILITY_CHANGED, NEW_404, RECOVERED_404, CONTENT_CHANGED
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
    previousPages: CrawledPageSnapshot[],
    options: {
      isComparable?: boolean;
      currentCrawlStatus?: string;
      previousCrawlStatus?: string;
    } = {}
  ): DetectedSeoEvent[] {
    const events: DetectedSeoEvent[] = [];
    const isComparable = options.isComparable ?? true;

    if (!isComparable) {
      return events;
    }

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

      // Meta Description Change
      if (curr.metaDescription !== prev.metaDescription) {
        events.push({
          websiteId,
          crawlRunId: currentCrawlRunId,
          eventType: 'DESCRIPTION_CHANGED',
          entityType: 'URL',
          entityUrl: curr.url,
          beforeValue: JSON.stringify({ metaDescription: prev.metaDescription }),
          afterValue: JSON.stringify({ metaDescription: curr.metaDescription }),
          deltaNotes: `Meta description updated`,
          severity: 'LOW',
          source: 'CRAWLER',
        });
      }

      // H1 Change
      const prevH1 = (prev.h1Tags || []).join(' | ');
      const currH1 = (curr.h1Tags || []).join(' | ');
      if (prevH1 !== currH1) {
        events.push({
          websiteId,
          crawlRunId: currentCrawlRunId,
          eventType: 'H1_CHANGED',
          entityType: 'URL',
          entityUrl: curr.url,
          beforeValue: JSON.stringify({ h1Tags: prev.h1Tags }),
          afterValue: JSON.stringify({ h1Tags: curr.h1Tags }),
          deltaNotes: `H1 headings modified`,
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

      // Meta Robots Change
      if (curr.metaRobots !== prev.metaRobots) {
        events.push({
          websiteId,
          crawlRunId: currentCrawlRunId,
          eventType: 'META_ROBOTS_CHANGED',
          entityType: 'URL',
          entityUrl: curr.url,
          beforeValue: JSON.stringify({ metaRobots: prev.metaRobots }),
          afterValue: JSON.stringify({ metaRobots: curr.metaRobots }),
          deltaNotes: `Meta robots directive changed from "${prev.metaRobots || 'none'}" to "${curr.metaRobots || 'none'}"`,
          severity: 'HIGH',
          source: 'CRAWLER',
        });
      }

      // X-Robots-Tag Change
      if (curr.xRobotsTag !== prev.xRobotsTag) {
        events.push({
          websiteId,
          crawlRunId: currentCrawlRunId,
          eventType: 'X_ROBOTS_CHANGED',
          entityType: 'URL',
          entityUrl: curr.url,
          beforeValue: JSON.stringify({ xRobotsTag: prev.xRobotsTag }),
          afterValue: JSON.stringify({ xRobotsTag: curr.xRobotsTag }),
          deltaNotes: `X-Robots-Tag header changed from "${prev.xRobotsTag || 'none'}" to "${curr.xRobotsTag || 'none'}"`,
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

    // 2. Evaluate missing URLs from current crawl (NOT_DISCOVERED_THIS_RUN - never false removed confirmation)
    for (const prev of previousPages) {
      if (!currMap.has(prev.normalizedUrl)) {
        events.push({
          websiteId,
          crawlRunId: currentCrawlRunId,
          eventType: 'NOT_DISCOVERED_THIS_RUN',
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
