import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { CrawlCoordinator, CrawlConfiguration } from '../services/crawler/crawlCoordinator';
import { CrawlRepository } from '../repositories/crawlRepository';

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
  public static readonly CRAWLER_COORDINATOR_QUEUE = 'seo-crawler-coordinator';

  private static coordinatorQueue: Queue | null = null;
  private static coordinatorWorker: Worker | null = null;
  private static redisConnection: IORedis | null = null;

  public static isRedisAvailable(): boolean {
    return Boolean(process.env.REDIS_URL);
  }

  public static isProductionMode(): boolean {
    return (process.env.APP_MODE === 'PRODUCTION' || process.env.NODE_ENV === 'production') && process.env.APP_MODE !== 'DEMO' && process.env.APP_MODE !== 'DEVELOPMENT';
  }

  public static initialize(): void {
    if (!process.env.REDIS_URL) {
      if (this.isProductionMode()) {
        console.error('[CrawlerQueueRegistry] FATAL: REDIS_URL required in PRODUCTION mode but missing.');
      } else {
        console.log('[CrawlerQueueRegistry] REDIS_URL not configured. Running in DEV/DEMO in-process asynchronous mode.');
      }
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

      // Coordinator Worker
      this.coordinatorWorker = new Worker<CrawlJobData, CrawlJobResult>(
        this.CRAWLER_COORDINATOR_QUEUE,
        async (job: Job<CrawlJobData>) => {
          console.log(`[CrawlerWorker] Processing coordinator job ${job.id} for crawlRunId=${job.data.crawlRunId}`);
          const { crawlRunId, config } = job.data;
          
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

    // STRICT FAIL-CLOSED IN PRODUCTION: Do NOT silently run inside API in production without Redis
    if (this.isProductionMode()) {
      throw new Error('QUEUE_UNAVAILABLE: Redis queue broker is required in PRODUCTION mode but unreachable');
    }

    // Explicit DEV / DEMO async execution (decoupled from HTTP request)
    setImmediate(async () => {
      try {
        console.log(`[CrawlerQueueRegistry] [DEV_ASYNC] Executing background crawl for run ${crawlRunId}`);
        await CrawlCoordinator.executeCrawl(config, crawlRunId);
      } catch (err) {
        console.error(`[CrawlerQueueRegistry] [DEV_ASYNC] Background crawl ${crawlRunId} failed:`, err);
        await CrawlRepository.updateCrawlRun(crawlRunId, {
          status: 'FAILED',
          completedAt: new Date().toISOString(),
        });
      }
    });

    return `dev-async-${crawlRunId}`;
  }

  public static async shutdown(): Promise<void> {
    if (this.coordinatorWorker) await this.coordinatorWorker.close();
    if (this.coordinatorQueue) await this.coordinatorQueue.close();
    if (this.redisConnection) await this.redisConnection.quit();
    this.coordinatorWorker = null;
    this.coordinatorQueue = null;
    this.redisConnection = null;
  }
}
