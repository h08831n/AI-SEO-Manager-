import { Queue } from 'bullmq';
import { RedisConnectionFactory } from '../config/redis';

export interface SyncJobData {
  websiteId: string;
  provider: 'GSC' | 'GA4' | 'ALL';
  syncType?: 'INITIAL_BACKFILL' | 'INCREMENTAL_SYNC' | 'MANUAL_RESYNC';
  startDate?: string;
  endDate?: string;
  correlationId?: string;
}

export class SyncQueueProducer {
  private static queue: Queue<SyncJobData> | null = null;

  public static getQueue(): Queue<SyncJobData> {
    if (!this.queue) {
      const connection = RedisConnectionFactory.createClient();
      this.queue = new Queue<SyncJobData>('integration-sync-queue', {
        connection: connection as any,
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
    }
    return this.queue;
  }

  public static async enqueueSync(data: SyncJobData): Promise<string> {
    const queue = this.getQueue();
    const job = await queue.add(`sync-${data.provider.toLowerCase()}-${data.websiteId}`, data, {
      jobId: `sync-${data.provider}-${data.websiteId}-${Date.now()}`,
    });
    return job.id || `sync-${Date.now()}`;
  }
}
