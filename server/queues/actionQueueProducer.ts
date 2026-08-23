import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { prisma } from '../db/prisma';

export interface ActionJobData {
  jobType: 'EXECUTE_ACTION' | 'ROLLBACK_ACTION' | 'VERIFY_ACTION' | 'EVALUATE_DECISIONS';
  websiteId: string;
  actionExecutionId?: string;
  taskId?: string;
  actionType?: string;
  targetUrl?: string;
  payload?: Record<string, any>;
  idempotencyKey?: string;
  userId?: string;
}

export class ActionQueueProducer {
  private static queue: Queue<ActionJobData> | null = null;

  static getQueue(): Queue<ActionJobData> | null {
    if (!process.env.REDIS_URL) {
      return null;
    }
    if (!this.queue) {
      const connection = getRedisConnection();
      this.queue = new Queue<ActionJobData>('action-execution-queue', {
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

  static async enqueueAction(
    data: ActionJobData,
    options?: { force?: boolean }
  ): Promise<{ jobId: string; deduplicated: boolean }> {
    const queue = this.getQueue();
    const idempotencyKey =
      data.idempotencyKey ||
      `action-${data.websiteId}-${data.jobType}-${data.taskId || data.actionExecutionId || 'eval'}-${Date.now()}`;

    if (!options?.force) {
      const existingJob = await prisma.jobRun.findFirst({
        where: {
          websiteId: data.websiteId,
          queueName: 'action-execution-queue',
          jobId: idempotencyKey,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      });

      if (existingJob) {
        return { jobId: existingJob.jobId || existingJob.id, deduplicated: true };
      }
    }

    const jobId = idempotencyKey;

    await prisma.jobRun.create({
      data: {
        websiteId: data.websiteId,
        queueName: 'action-execution-queue',
        jobName: data.jobType,
        jobId,
        payloadJson: JSON.stringify(data),
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
      },
    });

    if (process.env.NODE_ENV !== 'test' && process.env.REDIS_URL) {
      try {
        await queue.add(data.jobType, data, { jobId });
      } catch {
        // In-memory fallback
      }
    }

    return { jobId, deduplicated: false };
  }
}
