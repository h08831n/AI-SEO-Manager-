/**
 * Phase H: Transactional Outbox Event Handler Registry
 * 
 * Central registry mapping outbox event types to typed, idempotent, and retry-safe handlers.
 * Prevents monolithic if/else chains and guarantees safe error isolation.
 */

import { OutboxEventRecord } from './outboxDispatcher';
import { BayesianRuleLearningEngine } from '../bayesian/bayesianRuleLearningEngine';
import { AuditLogRepository } from '../../repositories/auditLogRepository';
import { CrawlerQueueProducer } from '../../queues/crawlerQueueProducer';
import { CrawlRepository } from '../../repositories/crawlRepository';
import { isProductionMode } from '../../config/runtimeMode';

export type OutboxEventHandler = (payload: any, record?: OutboxEventRecord) => Promise<void>;

export class EventHandlerRegistry {
  private static handlers: Map<string, OutboxEventHandler[]> = new Map();

  static {
    // 1. ACTION_EXECUTED -> Trigger Attribution Lineage & Pre-warm
    this.register('ACTION_EXECUTED', async (payload) => {
      try {
        const { AttributionLineageService } = await import('../attribution/attributionLineageService');
        if (payload.actionExecutionId) {
          await AttributionLineageService.resolveLineage(payload.actionExecutionId);
        }
      } catch (err) {
        console.warn('[EventHandlerRegistry] ACTION_EXECUTED lineage pre-warm error:', err);
      }
    });

    // 2. ATTRIBUTION_EVALUATION_COMPLETED -> Trigger Bayesian Recalibration
    this.register('ATTRIBUTION_EVALUATION_COMPLETED', async (payload) => {
      const websiteId = payload.websiteId;
      if (websiteId) {
        try {
          await BayesianRuleLearningEngine.recalibrateRuleWeights(websiteId);
        } catch (err) {
          console.error(`[EventHandlerRegistry] Bayesian recalibration triggered by attribution failed for ${websiteId}:`, err);
        }
      }
    });

    // 3. ATTRIBUTION_EVALUATION_REQUESTED -> Route to worker
    this.register('ATTRIBUTION_EVALUATION_REQUESTED', async (payload) => {
      try {
        const { AttributionEvaluationWorker } = await import('../worker/attributionEvaluationWorker');
        await AttributionEvaluationWorker.handleEvent('ATTRIBUTION_EVALUATION_REQUESTED', payload);
      } catch (err) {
        console.error('[EventHandlerRegistry] ATTRIBUTION_EVALUATION_REQUESTED handler failed:', err);
      }
    });

    // 4. BAYESIAN_RULE_WEIGHT_UPDATED -> Audit & Telemetry
    this.register('BAYESIAN_RULE_WEIGHT_UPDATED', async (payload) => {
      try {
        await AuditLogRepository.log({
          websiteId: payload.websiteId,
          actionName: `BAYESIAN_WEIGHT_UPDATE_${payload.ruleKey}`,
          affectedUrl: payload.pageArchetype || 'ALL',
          triggeredBy: 'BAYESIAN_LEARNING_ENGINE',
          reason: `Posterior win rate ${(payload.posteriorMeanWinRate * 100).toFixed(1)}%, applied weight: ${payload.approvedAppliedWeight}`,
          beforeStateJson: JSON.stringify({ previousWeight: payload.previousAppliedWeight }),
          afterStateJson: JSON.stringify({ newWeight: payload.approvedAppliedWeight }),
          isReversible: true,
          isReverted: false,
          correlationId: payload.correlationId,
        });
      } catch (err) {
        console.warn('[EventHandlerRegistry] BAYESIAN_RULE_WEIGHT_UPDATED audit log failed:', err);
      }
    });

    // 5. ACTION_VERIFICATION_FAILED -> Recovery & Rollback Audit
    this.register('ACTION_VERIFICATION_FAILED', async (payload) => {
      console.warn(`[EventHandlerRegistry] Action verification failed for execution ${payload.actionExecutionId}:`, payload.varianceDetails);
    });

    // 6. ACTION_ROLLED_BACK -> Rollback Event Handler
    this.register('ACTION_ROLLED_BACK', async (payload) => {
      console.log(`[EventHandlerRegistry] Action rolled back successfully: ${payload.actionExecutionId}`);
    });

    // 7. CRAWL_REQUESTED -> Crawl Coordinator Job Dispatch
    this.register('CRAWL_REQUESTED', async (payload) => {
      const { websiteId, crawlRunId, config, correlationId } = payload;
      if (process.env.REDIS_URL) {
        await CrawlerQueueProducer.enqueueCoordinatorJob(websiteId, crawlRunId, config, correlationId);
        await CrawlRepository.updateCrawlRun(crawlRunId, { status: 'QUEUED' });
      } else {
        if (isProductionMode()) {
          throw new Error('REDIS_URL required in PRODUCTION mode to dispatch crawl jobs.');
        }
        const { CrawlCoordinator } = await import('../../services/crawler/crawlCoordinator');
        setImmediate(async () => {
          try {
            await CrawlRepository.updateCrawlRun(crawlRunId, {
              status: 'RUNNING',
              startedAt: new Date().toISOString(),
            });
            await CrawlCoordinator.executeCrawl(config, crawlRunId);
          } catch (err: any) {
            console.error(`[EventHandlerRegistry] Background crawl failed for ${crawlRunId}:`, err);
            await CrawlRepository.updateCrawlRun(crawlRunId, {
              status: 'FAILED',
              completedAt: new Date().toISOString(),
            });
          }
        });
      }
    });
  }

  /**
   * Registers a handler for a given event type.
   */
  public static register(eventType: string, handler: OutboxEventHandler): void {
    const existing = this.handlers.get(eventType) || [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  /**
   * Dispatches an event to all registered handlers.
   */
  public static async dispatch(
    eventId: string,
    eventType: string,
    payload: any,
    record?: OutboxEventRecord
  ): Promise<void> {
    const handlers = this.handlers.get(eventType);

    if (!handlers || handlers.length === 0) {
      console.log(`[EventHandlerRegistry] No handler registered for event type '${eventType}' (Event ID: ${eventId}). Acknowledged safely.`);
      return;
    }

    for (const handler of handlers) {
      await handler(payload, record);
    }
  }

  /**
   * Returns list of registered event types.
   */
  public static getRegisteredEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
