import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { CrawlConfiguration } from '../services/crawler/crawlCoordinator';
import { isProductionMode } from '../config/runtimeMode';
import { CrawlJobData } from './crawlerQueue';

export class CrawlerQueueProducer {
  public static readonly CRAWLER_COORDINATOR_QUEUE = 'seo-crawler-coordinator';

  private static coordinatorQueue: Queue<CrawlJobData> | null = null;
  private static redisConnection: IORedis | null = null;

  public static initialize(): void {
    if (!process.env.REDIS_URL) {
      if (isProductionMode()) {
        console.error('[CrawlerQueueProducer] FATAL: REDIS_URL required in PRODUCTION mode.');
      }
      return;
    }

    try {
      this.redisConnection = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

      this.coordinatorQueue = new Queue<CrawlJobData>(this.CRAWLER_COORDINATOR_QUEUE, {
        connection: this.redisConnection as any,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      });
    } catch (err) {
      console.warn('[CrawlerQueueProducer] Redis Queue Producer init warning:', err);
    }
  }

  public static async enqueueCoordinatorJob(
    websiteId: string,
    crawlRunId: string,
    config: CrawlConfiguration,
    correlationId?: string
  ): Promise<string> {
    if (this.coordinatorQueue) {
      // Deterministic job ID prevents duplicate coordination enqueue
      const jobId = `crawl-coordinate:${crawlRunId}`;
      await this.coordinatorQueue.add(
        'CRAWL_COORDINATE',
        {
          jobType: 'CRAWL_COORDINATE',
          websiteId,
          crawlRunId,
          config,
          correlationId,
        },
        { jobId }
      );
      return jobId;
    }

    if (isProductionMode()) {
      throw new Error('QUEUE_UNAVAILABLE: Redis queue broker is required in PRODUCTION mode but unreachable');
    }

    return `dev-sync-${crawlRunId}`;
  }

  public static async shutdown(): Promise<void> {
    if (this.coordinatorQueue) {
      await this.coordinatorQueue.close();
      this.coordinatorQueue = null;
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
      this.redisConnection = null;
    }
  }
}
