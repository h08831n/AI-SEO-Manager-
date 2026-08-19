import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { CrawlCoordinator } from '../services/crawler/crawlCoordinator';
import { CrawlRepository } from '../repositories/crawlRepository';
import { CrawlJobData, CrawlJobResult } from './crawlerQueue';
import { CrawlerQueueProducer } from './crawlerQueueProducer';

export class CrawlerQueueConsumer {
  private static coordinatorWorker: Worker<CrawlJobData, CrawlJobResult> | null = null;
  private static redisConnection: IORedis | null = null;
  private static heartbeatInterval: NodeJS.Timeout | null = null;

  public static initialize(): void {
    if (!process.env.REDIS_URL) {
      console.warn('[CrawlerQueueConsumer] REDIS_URL not set; BullMQ worker not started.');
      return;
    }

    try {
      this.redisConnection = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

      // Start shared worker heartbeat in Redis with 60s TTL
      const heartbeatRedis = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 0,
      });
      const updateHeartbeat = async () => {
        try {
          await heartbeatRedis.set('worker:heartbeat', Date.now().toString(), 'EX', 60);
        } catch {
          // ignore
        }
      };
      updateHeartbeat();
      this.heartbeatInterval = setInterval(updateHeartbeat, 15000);

      this.coordinatorWorker = new Worker<CrawlJobData, CrawlJobResult>(
        CrawlerQueueProducer.CRAWLER_COORDINATOR_QUEUE,
        async (job: Job<CrawlJobData>) => {
          console.log(`[CrawlerWorker] Processing coordinator job ${job.id} for crawlRunId=${job.data.crawlRunId}`);
          const { crawlRunId, config } = job.data;

          if (!config) {
            throw new Error(`CRAWL_CONFIG_MISSING for crawlRunId=${crawlRunId}`);
          }

          try {
            // Update status to RUNNING if it was QUEUED or PENDING
            await CrawlRepository.updateCrawlRun(crawlRunId, {
              status: 'RUNNING',
              startedAt: new Date().toISOString(),
            });

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

      console.log('[CrawlerQueueConsumer] BullMQ Coordinator Worker started.');
    } catch (err) {
      console.error('[CrawlerQueueConsumer] Error initializing worker:', err);
    }
  }

  public static async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.coordinatorWorker) {
      await this.coordinatorWorker.close();
      this.coordinatorWorker = null;
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
      this.redisConnection = null;
    }
  }
}
