import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { prisma } from '../db/prisma';
import { SerpDevice } from '@prisma/client';

export interface SerpJobData {
  jobType: 'SERP_KEYWORD_CHECK' | 'SERP_BATCH_DISPATCH' | 'COMPETITOR_OVERLAP_REFRESH';
  websiteId: string;
  keywordId?: string;
  keywordIds?: string[];
  device?: SerpDevice;
  countryCode?: string;
  correlationId?: string;
}

export class SerpQueueProducer {
  private static queue: Queue<SerpJobData> | null = null;

  static getQueue(): Queue<SerpJobData> {
    if (!this.queue) {
      const connection = getRedisConnection();
      this.queue = new Queue<SerpJobData>('serp-intelligence-queue', {
        connection: connection as any,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });
    }
    return this.queue;
  }

  static async enqueueSerpCheck(data: SerpJobData): Promise<string> {
    const queue = this.getQueue();
    const jobId = `serp-${data.websiteId}-${data.keywordId || 'batch'}-${Date.now()}`;

    // 1. Audit outbox event
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'SERP_CHECK',
        aggregateId: data.keywordId || data.websiteId,
        eventType: data.jobType,
        payloadJson: JSON.stringify(data),
      },
    });

    // 2. Track JobRun in DB
    await prisma.jobRun.create({
      data: {
        websiteId: data.websiteId,
        queueName: 'serp-intelligence-queue',
        jobName: data.jobType,
        jobId,
        payloadJson: JSON.stringify(data),
        status: 'PENDING',
      },
    });

    try {
      await queue.add(data.jobType, data, { jobId });
    } catch {
      // In-memory / direct mode fallback
    }

    return jobId;
  }
}
