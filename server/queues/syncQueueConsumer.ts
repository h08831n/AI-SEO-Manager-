import { Worker, Job } from 'bullmq';
import { RedisConnectionFactory } from '../config/redis';
import { SyncJobData } from './syncQueueProducer';
import { IntegrationSyncEngine } from '../services/integrations/syncEngine';
import { SignalDetectionEngine } from '../services/analytics/signalDetectionEngine';

export class SyncQueueConsumer {
  private static worker: Worker<SyncJobData> | null = null;

  public static start(): Worker<SyncJobData> {
    if (this.worker) return this.worker;

    const connection = RedisConnectionFactory.createClient();
    const syncEngine = new IntegrationSyncEngine();

    this.worker = new Worker<SyncJobData>(
      'integration-sync-queue',
      async (job: Job<SyncJobData>) => {
        const { websiteId, provider, syncType, startDate, endDate, correlationId } = job.data;
        const results: Record<string, any> = {};

        if (provider === 'GSC' || provider === 'ALL') {
          await job.updateProgress(25);
          results.gsc = await syncEngine.syncSearchConsole({
            websiteId,
            syncType,
            startDate,
            endDate,
            correlationId,
          });
        }

        if (provider === 'GA4' || provider === 'ALL') {
          await job.updateProgress(65);
          results.ga4 = await syncEngine.syncGoogleAnalytics4({
            websiteId,
            syncType,
            startDate,
            endDate,
            correlationId,
          });
        }

        // Run signal detection engine after sync
        await job.updateProgress(85);
        try {
          const now = new Date();
          const currentEnd = new Date(now.getTime() - 86400000);
          const currentStart = new Date(currentEnd.getTime() - 27 * 86400000);
          results.signals = await SignalDetectionEngine.evaluateSignals({
            websiteId,
            currentStart,
            currentEnd,
          });
        } catch {
          // Non-blocking signal evaluation error
        }

        await job.updateProgress(100);
        return results;
      },
      {
        connection: connection as any,
        concurrency: 4,
      }
    );

    this.worker.on('failed', (job, err) => {
      console.error(`[SyncQueueConsumer] Job ${job?.id} failed:`, err.message);
    });

    return this.worker;
  }

  public static async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
