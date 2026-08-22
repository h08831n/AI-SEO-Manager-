import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { prisma } from '../db/prisma';
import { SerpJobData } from './serpQueueProducer';
import { SerpExecutionService } from '../services/serp/serpExecutionService';
import { CompetitorRepository } from '../repositories/competitorRepository';

export class SerpQueueConsumer {
  private worker: Worker<SerpJobData> | null = null;

  start() {
    if (this.worker) return;
    const connection = getRedisConnection();

    this.worker = new Worker<SerpJobData>(
      'serp-intelligence-queue',
      async (job: Job<SerpJobData>) => {
        const { jobType, websiteId, keywordId, keywordIds, device } = job.data;

        // Update JobRun status
        const jobRun = await prisma.jobRun.findFirst({
          where: { jobId: job.id, queueName: 'serp-intelligence-queue' },
        });
        if (jobRun) {
          await prisma.jobRun.update({
            where: { id: jobRun.id },
            data: { status: 'PROCESSING', startedAt: new Date() },
          });
        }

        try {
          let result: any = null;

          if (jobType === 'SERP_KEYWORD_CHECK' && keywordId) {
            result = await SerpExecutionService.executeKeywordSerpCheck({
              websiteId,
              keywordId,
              device,
            });
          } else if (jobType === 'SERP_BATCH_DISPATCH' && keywordIds) {
            result = await SerpExecutionService.batchExecuteKeywordChecks(websiteId, keywordIds, device);
          } else if (jobType === 'COMPETITOR_OVERLAP_REFRESH') {
            const website = await prisma.website.findUnique({ where: { id: websiteId } });
            if (website) {
              result = await CompetitorRepository.refreshCompetitorIntelligence(websiteId, website.domain);
            }
          }

          if (jobRun) {
            await prisma.jobRun.update({
              where: { id: jobRun.id },
              data: {
                status: 'COMPLETED',
                progressPct: 100,
                completedAt: new Date(),
              },
            });
          }

          return result;
        } catch (err: any) {
          if (jobRun) {
            await prisma.jobRun.update({
              where: { id: jobRun.id },
              data: {
                status: 'FAILED',
                errorMessage: err.message,
                completedAt: new Date(),
              },
            });
          }
          throw err;
        }
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

  async stop() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
