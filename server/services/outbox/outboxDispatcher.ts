import { OutboxStatus } from '@prisma/client';
import { getPrismaClient } from '../../db/prismaClient';
import { CrawlerQueueProducer } from '../../queues/crawlerQueueProducer';
import { CrawlRepository } from '../../repositories/crawlRepository';
import { CrawlCoordinator } from '../crawler/crawlCoordinator';
import { isProductionMode } from '../../config/runtimeMode';

export interface OutboxEventRecord {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payloadJson: string;
  status: OutboxStatus;
  attemptCount: number;
  lastError?: string | null;
  nextAttemptAt?: Date | null;
  deliveredAt?: Date | null;
  createdAt: Date;
}

export interface RecordOutboxEventParams {
  aggregateType?: string;
  aggregateId?: string;
  eventType: string;
  payload: any;
}

export interface CreateOutboxEventParams {
  aggregateType?: string;
  aggregateId?: string;
  eventType: 'CRAWL_REQUESTED' | 'CRAWL_CANCEL_REQUESTED' | 'ACTION_EXECUTION_REQUESTED' | string;
  payload: any;
}

export class OutboxDispatcher {
  private static pollTimer: NodeJS.Timeout | null = null;
  private static isProcessing = false;
  private static inMemoryStore: OutboxEventRecord[] = [];

  public static async clearForTesting(): Promise<void> {
    this.inMemoryStore = [];
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        await prisma.outboxEvent.deleteMany({});
      } catch {
        // ignore
      }
    }
  }

  public static async recordEvent(params: RecordOutboxEventParams): Promise<OutboxEventRecord> {
    const prisma = getPrismaClient();
    const id = `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const payloadJson = JSON.stringify(params.payload);
    const aggregateType = params.aggregateType || 'DOMAIN_EVENT';
    const aggregateId = params.aggregateId || id;
    const now = new Date();

    const record: OutboxEventRecord = {
      id,
      aggregateType,
      aggregateId,
      eventType: params.eventType,
      payloadJson,
      status: 'PENDING',
      attemptCount: 0,
      lastError: null,
      nextAttemptAt: null,
      deliveredAt: null,
      createdAt: now,
    };

    if (prisma) {
      try {
        const created = await prisma.outboxEvent.create({
          data: {
            id,
            aggregateType,
            aggregateId,
            eventType: params.eventType,
            payloadJson,
            status: 'PENDING',
            attemptCount: 0,
          },
        });
        return {
          id: created.id,
          aggregateType: created.aggregateType,
          aggregateId: created.aggregateId,
          eventType: created.eventType,
          payloadJson: created.payloadJson,
          status: created.status,
          attemptCount: created.attemptCount,
          lastError: created.lastError,
          nextAttemptAt: created.nextAttemptAt,
          deliveredAt: created.deliveredAt,
          createdAt: created.createdAt,
        };
      } catch (err) {
        if (isProductionMode()) {
          throw new Error(`PERSISTENCE_UNAVAILABLE: Outbox creation failed: ${err}`);
        }
      }
    }

    this.inMemoryStore.push(record);
    return record;
  }

  public static async createOutboxEvent(params: CreateOutboxEventParams): Promise<string> {
    const event = await this.recordEvent({
      aggregateType: params.aggregateType || 'CRAWL_RUN',
      aggregateId: params.aggregateId || (params.payload?.crawlRunId || 'system'),
      eventType: params.eventType,
      payload: params.payload,
    });
    return event.id;
  }

  public static async getById(id: string): Promise<OutboxEventRecord | null> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const found = await prisma.outboxEvent.findUnique({ where: { id } });
        if (found) {
          return {
            id: found.id,
            aggregateType: found.aggregateType,
            aggregateId: found.aggregateId,
            eventType: found.eventType,
            payloadJson: found.payloadJson,
            status: found.status,
            attemptCount: found.attemptCount,
            lastError: found.lastError,
            nextAttemptAt: found.nextAttemptAt,
            deliveredAt: found.deliveredAt,
            createdAt: found.createdAt,
          };
        }
      } catch {
        // fallback
      }
    }
    return this.inMemoryStore.find((e) => e.id === id) || null;
  }

  public static async listAll(): Promise<OutboxEventRecord[]> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const found = await prisma.outboxEvent.findMany({ orderBy: { createdAt: 'asc' } });
        if (found.length > 0) {
          return found.map((f) => ({
            id: f.id,
            aggregateType: f.aggregateType,
            aggregateId: f.aggregateId,
            eventType: f.eventType,
            payloadJson: f.payloadJson,
            status: f.status,
            attemptCount: f.attemptCount,
            lastError: f.lastError,
            nextAttemptAt: f.nextAttemptAt,
            deliveredAt: f.deliveredAt,
            createdAt: f.createdAt,
          }));
        }
      } catch {
        // fallback
      }
    }
    return [...this.inMemoryStore];
  }

  public static startPolling(intervalMs = 2000): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(async () => {
      await this.dispatchPendingEvents();
    }, intervalMs);
  }

  public static stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public static async processPendingEvents(
    customPublisher?: (event: OutboxEventRecord) => Promise<boolean | void>
  ): Promise<{ dispatched: number; failed: number }> {
    let dispatched = 0;
    let failed = 0;

    const prisma = getPrismaClient();

    if (prisma) {
      try {
        const pendingEvents = await prisma.outboxEvent.findMany({
          where: {
            status: 'PENDING',
            attemptCount: { lt: 5 },
          },
          orderBy: { createdAt: 'asc' },
          take: 20,
        });

        for (const ev of pendingEvents) {
          const record: OutboxEventRecord = {
            id: ev.id,
            aggregateType: ev.aggregateType,
            aggregateId: ev.aggregateId,
            eventType: ev.eventType,
            payloadJson: ev.payloadJson,
            status: ev.status,
            attemptCount: ev.attemptCount,
            lastError: ev.lastError,
            nextAttemptAt: ev.nextAttemptAt,
            deliveredAt: ev.deliveredAt,
            createdAt: ev.createdAt,
          };

          try {
            if (customPublisher) {
              await customPublisher(record);
            } else {
              await this.processSingleEvent(ev.id, ev.eventType, JSON.parse(ev.payloadJson));
            }

            await prisma.outboxEvent.update({
              where: { id: ev.id },
              data: {
                status: 'DELIVERED',
                deliveredAt: new Date(),
              },
            });
            dispatched++;
          } catch (dispatchErr: any) {
            failed++;
            const newAttempt = ev.attemptCount + 1;
            const nextAttempt = new Date(Date.now() + Math.min(60000, 1000 * Math.pow(2, newAttempt)));
            await prisma.outboxEvent.update({
              where: { id: ev.id },
              data: {
                attemptCount: newAttempt,
                lastError: dispatchErr.message,
                status: newAttempt >= 5 ? 'FAILED' : 'PENDING',
                nextAttemptAt: nextAttempt,
              },
            });
          }
        }

        return { dispatched, failed };
      } catch {
        // fallback to memory
      }
    }

    // In-memory fallback
    const pending = this.inMemoryStore.filter((e) => e.status === 'PENDING' && e.attemptCount < 5);
    for (const ev of pending) {
      try {
        if (customPublisher) {
          await customPublisher(ev);
        } else {
          await this.processSingleEvent(ev.id, ev.eventType, JSON.parse(ev.payloadJson));
        }
        ev.status = 'DELIVERED';
        ev.deliveredAt = new Date();
        dispatched++;
      } catch (err: any) {
        failed++;
        ev.attemptCount += 1;
        ev.lastError = err.message;
        ev.status = ev.attemptCount >= 5 ? 'FAILED' : 'PENDING';
        ev.nextAttemptAt = new Date(Date.now() + 1000 * Math.pow(2, ev.attemptCount));
      }
    }

    return { dispatched, failed };
  }

  public static async dispatchPendingEvents(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;
    try {
      const { dispatched } = await this.processPendingEvents();
      return dispatched;
    } finally {
      this.isProcessing = false;
    }
  }

  public static async processSingleEvent(
    _eventId: string,
    eventType: string,
    payload: any
  ): Promise<void> {
    if (eventType === 'CRAWL_REQUESTED') {
      const { websiteId, crawlRunId, config, correlationId } = payload;

      if (process.env.REDIS_URL) {
        await CrawlerQueueProducer.enqueueCoordinatorJob(websiteId, crawlRunId, config, correlationId);
        await CrawlRepository.updateCrawlRun(crawlRunId, { status: 'QUEUED' });
      } else {
        if (isProductionMode()) {
          throw new Error('REDIS_URL required in PRODUCTION mode to dispatch crawl jobs.');
        }

        setImmediate(async () => {
          try {
            await CrawlRepository.updateCrawlRun(crawlRunId, {
              status: 'RUNNING',
              startedAt: new Date().toISOString(),
            });
            await CrawlCoordinator.executeCrawl(config, crawlRunId);
          } catch (err: any) {
            console.error(`[OutboxDispatcher] DEV background crawl execution failed for ${crawlRunId}:`, err);
            await CrawlRepository.updateCrawlRun(crawlRunId, {
              status: 'FAILED',
              completedAt: new Date().toISOString(),
            });
          }
        });
      }
    }
  }
}
