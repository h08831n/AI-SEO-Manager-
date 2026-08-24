import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { prisma } from '../db/prisma';
import { AttributionJobData } from './attributionQueueProducer';
import { AttributionEvaluationWorker } from '../services/worker/attributionEvaluationWorker';

export class AttributionQueueConsumer {
  private static worker: Worker<AttributionJobData> | null = null;

  static start(): Worker<AttributionJobData> | null {
    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    if (!process.env.REDIS_URL || isTest) {
      return null;
    }

    if (!this.worker) {
      const connection = getRedisConnection();
      this.worker = new Worker<AttributionJobData>(
        'attribution-evaluation-queue',
        async (job: Job<AttributionJobData>) => {
          const { jobType, websiteId, actionExecutionId, horizonDays } = job.data;
          console.log(`[AttributionQueueConsumer] Processing job ${job.id} (${jobType}) for site ${websiteId}`);

          // Update JobRun status to PROCESSING
          await prisma.jobRun.updateMany({
            where: { jobId: job.id, queueName: 'attribution-evaluation-queue' },
            data: { status: 'PROCESSING', startedAt: new Date() },
          });

          try {
            if (jobType === 'EVALUATE_ATTRIBUTION' && actionExecutionId) {
              await AttributionEvaluationWorker.evaluateSingleExecution(actionExecutionId, horizonDays || 30);
            } else if (jobType === 'BATCH_EVALUATE_MATURE_EXECUTIONS') {
              await AttributionEvaluationWorker.batchEvaluateMatureExecutions(websiteId);
            }

            // Update JobRun to COMPLETED
            await prisma.jobRun.updateMany({
              where: { jobId: job.id, queueName: 'attribution-evaluation-queue' },
              data: { status: 'COMPLETED', completedAt: new Date(), progressPct: 100 },
            });
          } catch (err: any) {
            console.error(`[AttributionQueueConsumer] Job ${job.id} failed:`, err);
            await prisma.jobRun.updateMany({
              where: { jobId: job.id, queueName: 'attribution-evaluation-queue' },
              data: { status: 'FAILED', errorMessage: err.message },
            });
            throw err;
          }
        },
        {
          connection: connection as any,
          concurrency: 3,
        }
      );
    }

    return this.worker;
  }

  static async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
