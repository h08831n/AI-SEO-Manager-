import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { isProductionMode } from '../config/runtimeMode';

export interface SyncJobData {
  websiteId: string;
  provider: 'GSC' | 'GA4' | 'ALL';
  syncType?: 'INITIAL_BACKFILL' | 'INCREMENTAL_SYNC' | 'MANUAL_RESYNC';
  startDate?: string;
  endDate?: string;
  correlationId?: string;
}

export class SyncQueueProducer {
  public static readonly SYNC_QUEUE_NAME = 'integration-sync-queue';
  private static queue: Queue<SyncJobData> | null = null;
  private static redisConnection: IORedis | null = null;

  public static initialize(): void {
    if (!process.env.REDIS_URL) {
      if (isProductionMode()) {
        console.error('[SyncQueueProducer] FATAL: REDIS_URL required in PRODUCTION mode.');
      }
      return;
    }

    try {
      this.redisConnection = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

      this.queue = new Queue<SyncJobData>(this.SYNC_QUEUE_NAME, {
        connection: this.redisConnection as any,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      });
    } catch (err) {
      console.warn('[SyncQueueProducer] Redis Queue Producer init warning:', err);
    }
  }

  public static async enqueueSync(data: SyncJobData): Promise<string> {
    if (this.queue) {
      const jobId = `sync-${data.provider}-${data.websiteId}-${Date.now()}`;
      const job = await this.queue.add(`sync-${data.provider.toLowerCase()}-${data.websiteId}`, data, {
        jobId,
      });
      return job.id || jobId;
    }

    if (isProductionMode()) {
      throw new Error('QUEUE_UNAVAILABLE: Redis queue broker is required in PRODUCTION mode but unreachable');
    }

    return `dev-sync-${data.provider}-${data.websiteId}-${Date.now()}`;
  }

  public static async shutdown(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
      this.redisConnection = null;
    }
  }
}
