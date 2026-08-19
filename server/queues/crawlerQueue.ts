import { CrawlConfiguration } from '../services/crawler/crawlCoordinator';
import { CrawlerQueueProducer } from './crawlerQueueProducer';
import { CrawlerQueueConsumer } from './crawlerQueueConsumer';

export interface CrawlJobData {
  jobType: 'CRAWL_COORDINATE' | 'CRAWL_FETCH_URL' | 'CRAWL_FINALIZE';
  websiteId: string;
  crawlRunId: string;
  config: CrawlConfiguration;
  correlationId?: string;
}

export interface CrawlJobResult {
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'ROBOTS_BLOCKED' | 'SCOPE_BLOCKED';
  crawlRunId: string;
  totalPages?: number;
  totalIssues?: number;
  error?: string;
}

export class CrawlerQueueRegistry {
  public static isRedisAvailable(): boolean {
    return Boolean(process.env.REDIS_URL);
  }

  public static initialize(): void {
    CrawlerQueueProducer.initialize();
  }

  public static async enqueueCoordinatorJob(
    websiteId: string,
    crawlRunId: string,
    config: CrawlConfiguration,
    correlationId?: string
  ): Promise<string> {
    return CrawlerQueueProducer.enqueueCoordinatorJob(websiteId, crawlRunId, config, correlationId);
  }

  public static async shutdown(): Promise<void> {
    await CrawlerQueueProducer.shutdown();
    await CrawlerQueueConsumer.shutdown();
  }
}
