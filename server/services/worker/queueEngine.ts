import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

export interface SeoJobPayload {
  websiteId: string;
  requestedByUserId?: string;
  jobType: 'CRAWL_AUDIT' | 'SERP_REFRESH' | 'DECAY_DETECTION' | 'TASK_EXECUTION';
  parameters?: Record<string, any>;
}

export interface JobRunEntity {
  id: string;
  websiteId?: string;
  requestedByUserId?: string;
  queueName: string;
  jobName: string;
  jobId?: string;
  payloadJson?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progressPct: number;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const jobRunsStore: Map<string, JobRunEntity> = new Map();

export class QueueEngine {
  private static redisConnection: IORedis | null = null;
  private static seoQueue: Queue | null = null;
  private static seoWorker: Worker | null = null;

  public static initialize(): { queueAvailable: boolean; mode: string } {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      return { queueAvailable: false, mode: 'STANDALONE_IN_MEMORY' };
    }

    try {
      this.redisConnection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });

      this.seoQueue = new Queue('seo-jobs', {
        connection: this.redisConnection,
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

      this.seoWorker = new Worker(
        'seo-jobs',
        async (job: Job) => {
          await this.processJob(job);
        },
        { connection: this.redisConnection }
      );

      this.seoWorker.on('completed', (job) => {
        const run = jobRunsStore.get(job.id || '');
        if (run) {
          run.status = 'COMPLETED';
          run.completedAt = new Date().toISOString();
          run.progressPct = 100;
          run.updatedAt = new Date().toISOString();
        }
      });

      this.seoWorker.on('failed', (job, err) => {
        if (job) {
          const run = jobRunsStore.get(job.id || '');
          if (run) {
            run.status = 'FAILED';
            run.errorMessage = err.message;
            run.updatedAt = new Date().toISOString();
          }
        }
      });

      return { queueAvailable: true, mode: 'BULLMQ_REDIS' };
    } catch (err) {
      console.warn('[QueueEngine] Redis connection failed, operating in fallback mode:', err);
      return { queueAvailable: false, mode: 'FALLBACK_STANDALONE' };
    }
  }

  public static async enqueueJob(
    jobName: string,
    payload: SeoJobPayload
  ): Promise<{ jobRun: JobRunEntity; bullJobId?: string }> {
    const runId = `job-run-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const jobRun: JobRunEntity = {
      id: runId,
      websiteId: payload.websiteId,
      requestedByUserId: payload.requestedByUserId,
      queueName: 'seo-jobs',
      jobName,
      payloadJson: JSON.stringify(payload),
      status: 'PENDING',
      progressPct: 0,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    jobRunsStore.set(runId, jobRun);

    if (this.seoQueue) {
      try {
        const bullJob = await this.seoQueue.add(jobName, payload, { jobId: runId });
        jobRun.jobId = bullJob.id;
        return { jobRun, bullJobId: bullJob.id };
      } catch (err: any) {
        jobRun.status = 'FAILED';
        jobRun.errorMessage = `Queue add failure: ${err.message}`;
      }
    }

    return { jobRun };
  }

  private static async processJob(job: Job): Promise<void> {
    const run = jobRunsStore.get(job.id || '');
    if (run) {
      run.status = 'PROCESSING';
      run.startedAt = new Date().toISOString();
      run.attempts += 1;
      run.updatedAt = new Date().toISOString();
    }
    // Processing logic placeholder
  }

  public static getJobRun(id: string): JobRunEntity | null {
    return jobRunsStore.get(id) || null;
  }

  public static listJobRuns(websiteId?: string): JobRunEntity[] {
    const all = Array.from(jobRunsStore.values());
    if (!websiteId) return all;
    return all.filter((r) => r.websiteId === websiteId);
  }

  public static async shutdown(): Promise<void> {
    if (this.seoWorker) {
      await this.seoWorker.close();
    }
    if (this.seoQueue) {
      await this.seoQueue.close();
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
    }
  }
}
