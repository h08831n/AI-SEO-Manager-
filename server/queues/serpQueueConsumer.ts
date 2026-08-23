import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { prisma } from '../db/prisma';
import { SerpJobData } from './serpQueueProducer';
import { SerpExecutionService } from '../services/serp/serpExecutionService';
import { CompetitorRepository } from '../repositories/competitorRepository';
import { SerpProviderTimeoutError, SerpRateLimitError } from '../services/serp/serpErrors';

export class SerpQueueConsumer {
  private worker: Worker<SerpJobData> | null = null;

  start() {
    if (this.worker) return;
    if (!process.env.REDIS_URL) return;
    const connection = getRedisConnection();

    this.worker = new Worker<SerpJobData>(
      'serp-intelligence-queue',
      async (job: Job<SerpJobData>) => {
        return await SerpQueueConsumer.processJobPayload(job.data, job.id);
      },
      {
        connection: connection as any,
        concurrency: 4,
      }
    );

    this.worker.on('failed', (job, err) => {
      console.error(`[SerpQueueConsumer] Job ${job?.id} failed:`, err.message);
    });
  }

  static async processJobPayload(data: SerpJobData, externalJobId?: string): Promise<any> {
    const { jobType, websiteId, keywordId, keywordIds, device, timeoutMs, preferredProvider } = data;
    const jobId = externalJobId || data.idempotencyKey || `serp-${websiteId}-${keywordId || 'batch'}`;

    // 1. Find or create JobRun
    let jobRun = await prisma.jobRun.findFirst({
      where: { jobId, queueName: 'serp-intelligence-queue' },
    });

    if (!jobRun) {
      jobRun = await prisma.jobRun.create({
        data: {
          websiteId,
          queueName: 'serp-intelligence-queue',
          jobName: jobType,
          jobId,
          payloadJson: JSON.stringify(data),
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 3,
        },
      });
    }

    const currentAttempt = (jobRun.attempts || 0) + 1;

    // 2. Transition status to PROCESSING
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
        attempts: currentAttempt,
      },
    });

    try {
      let result: any = null;

      if (jobType === 'SERP_KEYWORD_CHECK' && keywordId) {
        result = await SerpExecutionService.executeKeywordSerpCheck({
          websiteId,
          keywordId,
          device,
          timeoutMs,
          preferredProvider,
        });
      } else if (jobType === 'SERP_BATCH_DISPATCH' && keywordIds) {
        result = await SerpExecutionService.batchExecuteKeywordChecks(websiteId, keywordIds, device);
      } else if (jobType === 'COMPETITOR_OVERLAP_REFRESH') {
        const website = await prisma.website.findUnique({ where: { id: websiteId } });
        if (website) {
          result = await CompetitorRepository.refreshCompetitorIntelligence(websiteId, website.domain);
        }
      }

      // 3. Mark COMPLETED
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: 'COMPLETED',
          progressPct: 100,
          completedAt: new Date(),
        },
      });

      return result;
    } catch (err: any) {
      const isDeadLetter = currentAttempt >= (jobRun.maxAttempts || 3);
      const isRateLimit = err instanceof SerpRateLimitError || err.name === 'SerpRateLimitError';
      const isTimeout = err instanceof SerpProviderTimeoutError || err.name === 'SerpProviderTimeoutError';

      const finalStatus = isDeadLetter ? 'DEAD_LETTER' : isRateLimit ? 'RATE_LIMITED' : 'FAILED';

      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: finalStatus,
          errorMessage: err.message,
          completedAt: isDeadLetter ? new Date() : undefined,
        },
      });

      // If dead-lettered, emit outbox event for dead-letter alerting
      if (isDeadLetter) {
        await prisma.outboxEvent.create({
          data: {
            aggregateType: 'SERP_CHECK',
            aggregateId: keywordId || websiteId,
            eventType: 'SERP_JOB_DEAD_LETTER',
            payloadJson: JSON.stringify({
              jobId,
              attempts: currentAttempt,
              error: err.message,
              isTimeout,
              isRateLimit,
            }),
          },
        });
      }

      throw err;
    }
  }

  async stop() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
