export interface CrawlJobData {
  jobType: 'DISCOVER_SEED' | 'FETCH_URL' | 'PROCESS_SITEMAP' | 'FINALIZE_CRAWL';
  websiteId: string;
  crawlRunId: string;
  url?: string;
  normalizedUrl?: string;
  depth?: number;
  discoverySource?: 'SEED' | 'HTML_LINK' | 'SITEMAP' | 'REDIRECT' | 'CANONICAL' | 'HREFLANG';
  priority?: number;
  correlationId?: string;
  sitemapUrl?: string;
}

export interface CrawlJobResult {
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'ROBOTS_BLOCKED' | 'SCOPE_BLOCKED';
  url?: string;
  statusCode?: number;
  linksDiscovered?: number;
  error?: string;
}

export class CrawlerQueueRegistry {
  public static readonly CRAWLER_COORDINATOR_QUEUE = 'seo-crawler-coordinator';
  public static readonly CRAWLER_URL_FETCH_QUEUE = 'seo-crawler-url-fetch';
  public static readonly CRAWLER_FINALIZATION_QUEUE = 'seo-crawler-finalization';

  /**
   * Deterministic Job ID generator for at-least-once idempotency across BullMQ workers
   */
  public static buildJobId(crawlRunId: string, url: string, attempt = 1): string {
    const cleanUrl = Buffer.from(url).toString('base64url');
    return `crawl-${crawlRunId}-${cleanUrl}-att${attempt}`;
  }
}
