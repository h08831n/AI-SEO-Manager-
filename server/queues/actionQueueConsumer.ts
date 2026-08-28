import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { prisma } from '../db/prisma';
import { ActionJobData } from './actionQueueProducer';
import { ActionOrchestrationService } from '../services/action/actionOrchestrationService';
import { DecisionEvaluationService } from '../services/decision/decisionEvaluationService';

export class ActionQueueConsumer {
  private static worker: Worker<ActionJobData> | null = null;

  static start(): Worker<ActionJobData> | null {
    if (this.worker) return this.worker;
    if (!process.env.REDIS_URL) return null;

    const connection = getRedisConnection();
    this.worker = new Worker<ActionJobData>(
      'action-execution-queue',
      async (job: Job<ActionJobData>) => {
        const { jobType, websiteId, actionExecutionId, taskId, actionType, targetUrl, payload, idempotencyKey, userId } =
          job.data;

        await prisma.jobRun.updateMany({
          where: { jobId: job.id },
          data: { status: 'PROCESSING', startedAt: new Date() },
        });

        try {
          if (jobType === 'EVALUATE_DECISIONS') {
            await DecisionEvaluationService.evaluateDecisions({ websiteId });
          } else if (jobType === 'EXECUTE_ACTION') {
            if (!actionType || !targetUrl || !payload || !idempotencyKey) {
              throw new Error('Missing required action execution parameters in queue job');
            }
            await ActionOrchestrationService.executeAction({
              websiteId,
              taskId,
              actionType,
              targetUrl,
              payload,
              idempotencyKey,
              userId,
            });
          } else if (jobType === 'ROLLBACK_ACTION') {
            if (!actionExecutionId) {
              throw new Error('Missing actionExecutionId for rollback job');
            }
            await ActionOrchestrationService.rollbackAction({
              actionExecutionId,
              websiteId,
              userId,
            });
          }

          await prisma.jobRun.updateMany({
            where: { jobId: job.id },
            data: { status: 'COMPLETED', completedAt: new Date(), progressPct: 100 },
          });
        } catch (err: any) {
          await prisma.jobRun.updateMany({
            where: { jobId: job.id },
            data: {
              status: 'FAILED',
              errorMessage: err.message,
              attempts: { increment: 1 },
            },
          });
          throw err;
        }
      },
      {
        connection: connection as any,
        concurrency: 5,
      }
    );

    this.worker.on('failed', (job, err) => {
      console.error(`[ActionWorker] Job ${job?.id} failed:`, err.message);
    });

    return this.worker;
  }

  static async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}

