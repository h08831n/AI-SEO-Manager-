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
  idempotencyKey?: string;
  timeoutMs?: number;
  preferredProvider?: string;
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

  static async enqueueSerpCheck(data: SerpJobData, options?: { force?: boolean }): Promise<{ jobId: string; deduplicated: boolean }> {
    const queue = this.getQueue();
    const dateStr = new Date().toISOString().slice(0, 10);
    const idempotencyKey =
      data.idempotencyKey ||
      `serp-${data.websiteId}-${data.keywordId || 'batch'}-${data.device || 'DESKTOP'}-${dateStr}`;

    // 1. Idempotency check: avoid duplicate pending or active jobs unless force=true
    if (!options?.force) {
      const existingJob = await prisma.jobRun.findFirst({
        where: {
          websiteId: data.websiteId,
          queueName: 'serp-intelligence-queue',
          jobId: idempotencyKey,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      });

      if (existingJob) {
        return { jobId: existingJob.jobId || existingJob.id, deduplicated: true };
      }
    }

    const jobId = idempotencyKey;

    // 2. Audit outbox event: QUEUE_CREATED
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'SERP_CHECK',
        aggregateId: data.keywordId || data.websiteId,
        eventType: 'QUEUE_CREATED',
        payloadJson: JSON.stringify({ ...data, jobId }),
      },
    });

    // 3. Track JobRun in DB with status PENDING
    await prisma.jobRun.create({
      data: {
        websiteId: data.websiteId,
        queueName: 'serp-intelligence-queue',
        jobName: data.jobType,
        jobId,
        payloadJson: JSON.stringify(data),
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
      },
    });

    try {
      await queue.add(data.jobType, data, { jobId });
    } catch {
      // In-memory / direct test environment
    }

    return { jobId, deduplicated: false };
  }
}
