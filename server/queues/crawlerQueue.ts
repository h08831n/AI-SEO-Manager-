import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { CrawlCoordinator, CrawlConfiguration } from '../services/crawler/crawlCoordinator';
import { CrawlRepository } from '../repositories/crawlRepository';

export interface CrawlJobData {
  jobType: 'CRAWL_COORDINATE' | 'CRAWL_FETCH_URL' | 'CRAWL_FINALIZE';
  websiteId: string;
  crawlRunId: string;
  config?: CrawlConfiguration;
  url?: string;
  normalizedUrl?: string;
  depth?: number;
  discoverySource?: 'SEED' | 'HTML_LINK' | 'SITEMAP' | 'REDIRECT' | 'CANONICAL' | 'HREFLANG';
  priority?: number;
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
  public static readonly CRAWLER_COORDINATOR_QUEUE = 'seo-crawler-coordinator';
  public static readonly CRAWLER_URL_FETCH_QUEUE = 'seo-crawler-url-fetch';
  public static readonly CRAWLER_FINALIZATION_QUEUE = 'seo-crawler-finalization';

  private static coordinatorQueue: Queue | null = null;
  private static fetchQueue: Queue | null = null;
  private static coordinatorWorker: Worker | null = null;
  private static fetchWorker: Worker | null = null;
  private static redisConnection: IORedis | null = null;

  public static isRedisAvailable(): boolean {
    return Boolean(process.env.REDIS_URL);
  }

  public static initialize(): void {
    if (!process.env.REDIS_URL) {
      console.log('[CrawlerQueueRegistry] REDIS_URL not configured. Async BullMQ queue disabled (in-process fallback available).');
      return;
    }

    try {
      this.redisConnection = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

      this.coordinatorQueue = new Queue(this.CRAWLER_COORDINATOR_QUEUE, {
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

      this.fetchQueue = new Queue(this.CRAWLER_URL_FETCH_QUEUE, {
        connection: this.redisConnection as any,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      });

      // Coordinator Worker
      this.coordinatorWorker = new Worker<CrawlJobData, CrawlJobResult>(
        this.CRAWLER_COORDINATOR_QUEUE,
        async (job: Job<CrawlJobData>) => {
          console.log(`[CrawlerWorker] Processing coordinator job ${job.id} for crawlRunId=${job.data.crawlRunId}`);
          const { websiteId, crawlRunId, config } = job.data;
          
          if (!config) {
            throw new Error(`CRAWL_CONFIG_MISSING for crawlRunId=${crawlRunId}`);
          }

          try {
            const result = await CrawlCoordinator.executeCrawl(config, crawlRunId);
            return {
              status: 'SUCCESS',
              crawlRunId,
              totalPages: result.totalPages,
              totalIssues: result.totalIssues,
            };
          } catch (err: any) {
            console.error(`[CrawlerWorker] Coordinator job ${job.id} failed:`, err);
            await CrawlRepository.updateCrawlRun(crawlRunId, {
              status: 'FAILED',
              completedAt: new Date().toISOString(),
            });
            throw err;
          }
        },
        {
          connection: this.redisConnection as any,
          concurrency: parseInt(process.env.CRAWLER_CONCURRENCY || '2', 10),
        }
      );

      this.coordinatorWorker.on('completed', (job) => {
        console.log(`[CrawlerWorker] Coordinator job ${job?.id} completed successfully.`);
      });

      this.coordinatorWorker.on('failed', (job, err) => {
        console.error(`[CrawlerWorker] Coordinator job ${job?.id} failed with error:`, err);
      });

      console.log('[CrawlerQueueRegistry] BullMQ Queues and Workers successfully initialized.');
    } catch (err) {
      console.warn('[CrawlerQueueRegistry] Initialization warning:', err);
    }
  }

  public static async enqueueCoordinatorJob(
    websiteId: string,
    crawlRunId: string,
    config: CrawlConfiguration,
    correlationId?: string
  ): Promise<string> {
    if (this.coordinatorQueue) {
      const jobId = `coord-${crawlRunId}-${Date.now()}`;
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

    // In-Process Asynchronous execution fallback when Redis is absent
    setImmediate(async () => {
      try {
        console.log(`[CrawlerQueueRegistry] Executing in-process background crawl for run ${crawlRunId}`);
        await CrawlCoordinator.executeCrawl(config, crawlRunId);
      } catch (err) {
        console.error(`[CrawlerQueueRegistry] Background crawl ${crawlRunId} failed:`, err);
        await CrawlRepository.updateCrawlRun(crawlRunId, {
          status: 'FAILED',
          completedAt: new Date().toISOString(),
        });
      }
    });

    return `inprocess-${crawlRunId}`;
  }

  public static async shutdown(): Promise<void> {
    if (this.coordinatorWorker) await this.coordinatorWorker.close();
    if (this.fetchWorker) await this.fetchWorker.close();
    if (this.coordinatorQueue) await this.coordinatorQueue.close();
    if (this.fetchQueue) await this.fetchQueue.close();
    if (this.redisConnection) await this.redisConnection.quit();
  }
}
