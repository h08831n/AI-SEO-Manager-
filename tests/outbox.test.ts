import { describe, it, expect, beforeEach } from 'vitest';
import { OutboxDispatcher } from '../server/services/outbox/outboxDispatcher';

describe('Transactional Outbox Pattern & Dispatcher', () => {
  beforeEach(async () => {
    await OutboxDispatcher.clearForTesting();
  });

  it('records domain event as PENDING outbox entry', async () => {
    const event = await OutboxDispatcher.recordEvent({
      aggregateType: 'SEO_TASK',
      aggregateId: 'task-title-01',
      eventType: 'TASK_APPROVED',
      payload: { websiteId: 'site-01', newTitle: 'New Optimized Title' },
    });

    expect(event.id).toBeDefined();
    expect(event.status).toBe('PENDING');
    expect(event.attemptCount).toBe(0);
  });

  it('successfully dispatches pending event and sets DELIVERED status', async () => {
    await OutboxDispatcher.recordEvent({
      aggregateType: 'ACTION_EXECUTION',
      aggregateId: 'act-001',
      eventType: 'EXECUTION_DISPATCHED',
      payload: { target: 'https://techscale.io' },
    });

    const mockPublisher = async () => true;
    const { dispatched, failed } = await OutboxDispatcher.processPendingEvents(mockPublisher);

    expect(dispatched).toBe(1);
    expect(failed).toBe(0);

    const allEvents = await OutboxDispatcher.listAll();
    expect(allEvents[0].status).toBe('DELIVERED');
    expect(allEvents[0].deliveredAt).toBeDefined();
  });

  it('handles publisher failure with retry count increment and nextAttemptAt schedule', async () => {
    const event = await OutboxDispatcher.recordEvent({
      aggregateType: 'CRAWL_RUN',
      aggregateId: 'crawl-001',
      eventType: 'CRAWL_COMPLETED',
      payload: { totalPages: 150 },
    });

    const mockFailingPublisher = async () => {
      throw new Error('Connection refused to event bus');
    };

    const { dispatched, failed } = await OutboxDispatcher.processPendingEvents(mockFailingPublisher);

    expect(dispatched).toBe(0);
    expect(failed).toBe(1);

    const stored = await OutboxDispatcher.getById(event.id);
    expect(stored?.attemptCount).toBe(1);
    expect(stored?.lastError).toContain('Connection refused');
    expect(stored?.nextAttemptAt).toBeDefined();
  });
});
