import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { prisma } from '../db/prisma';
import { OutboxDispatcher } from '../services/outbox/outboxDispatcher';

export interface AttributionJobData {
  jobType: 'EVALUATE_ATTRIBUTION' | 'BATCH_EVALUATE_MATURE_EXECUTIONS';
  websiteId: string;
  actionExecutionId?: string;
  horizonDays?: number;
  correlationId?: string;
}

export class AttributionQueueProducer {
  private static queue: Queue<AttributionJobData> | null = null;

  static getQueue(): Queue<AttributionJobData> | null {
    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    if (!process.env.REDIS_URL || isTest) {
      return null;
    }
    if (!this.queue) {
      const connection = getRedisConnection();
      this.queue = new Queue<AttributionJobData>('attribution-evaluation-queue', {
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

  static async enqueueAttributionEvaluation(
    data: AttributionJobData
  ): Promise<{ jobId: string; deduplicated: boolean }> {
    const queue = this.getQueue();
    const horizon = data.horizonDays || 30;
    const jobId = data.actionExecutionId
      ? `attr-eval-${data.websiteId}-${data.actionExecutionId}-${horizon}`
      : `attr-batch-${data.websiteId}-${Date.now()}`;

    // Deduplication check in DB job runs
    const existingJob = await prisma.jobRun.findFirst({
      where: {
        websiteId: data.websiteId,
        queueName: 'attribution-evaluation-queue',
        jobId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    if (existingJob) {
      return { jobId: existingJob.id, deduplicated: true };
    }

    // Persist Outbox Event for guaranteed delivery & auditability
    await OutboxDispatcher.recordEvent({
      aggregateType: 'ACTION_EXECUTION',
      aggregateId: data.actionExecutionId || data.websiteId,
      eventType: 'ATTRIBUTION_EVALUATION_REQUESTED',
      payload: { ...data, jobId },
    });

    // Record JobRun record
    await prisma.jobRun.create({
      data: {
        websiteId: data.websiteId,
        queueName: 'attribution-evaluation-queue',
        jobName: data.jobType,
        jobId,
        payloadJson: JSON.stringify(data),
        status: 'PENDING',
      },
    });

    if (queue) {
      await queue.add(data.jobType, data, { jobId });
    }

    return { jobId, deduplicated: false };
  }
}
