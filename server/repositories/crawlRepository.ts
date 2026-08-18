import { CrawlUrlResponse } from '../../src/shared/contracts';

export interface CrawlRunRecord {
  id: string;
  websiteId: string;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  redirectCount: number;
  loadTimeMs: number;
  crawledAt: string;
  data: CrawlUrlResponse;
}

const crawlRunsStore: Map<string, CrawlRunRecord> = new Map();

export class CrawlRepository {
  public static async saveCrawlRun(websiteId: string, crawl: CrawlUrlResponse): Promise<CrawlRunRecord> {
    const id = `crawl-run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record: CrawlRunRecord = {
      id,
      websiteId,
      requestedUrl: crawl.requestedUrl,
      finalUrl: crawl.finalUrl,
      statusCode: crawl.statusCode,
      status: crawl.status,
      redirectCount: crawl.redirectCount,
      loadTimeMs: crawl.loadTimeMs,
      crawledAt: crawl.crawledAt,
      data: crawl,
    };
    crawlRunsStore.set(id, record);
    return record;
  }

  public static async listCrawlRuns(websiteId: string): Promise<CrawlRunRecord[]> {
    return Array.from(crawlRunsStore.values())
      .filter((c) => c.websiteId === websiteId)
      .sort((a, b) => new Date(b.crawledAt).getTime() - new Date(a.crawledAt).getTime());
  }

  public static async getCrawlRunById(id: string, websiteId: string): Promise<CrawlRunRecord | null> {
    const record = crawlRunsStore.get(id);
    if (!record || record.websiteId !== websiteId) return null;
    return record;
  }
}
