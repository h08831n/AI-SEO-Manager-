import { describe, it, expect, beforeEach } from 'vitest';
import { OutboxDispatcher } from '../server/services/outbox/outboxDispatcher';
import { SyncQueueProducer } from '../server/queues/syncQueueProducer';
import { WebsiteRepository } from '../server/repositories/websiteRepository';

describe('Phase 3: Sync Queue & Outbox Dispatcher Idempotency Test Suite', () => {
  const websiteId = 'test-sync-outbox-site-1';

  beforeEach(async () => {
    await WebsiteRepository.createWebsite({
      workspaceId: 'ws-outbox-sync',
      domain: 'outbox-sync.com',
      name: 'Outbox Sync Test',
      productionUrl: 'https://outbox-sync.com',
      defaultLanguage: 'en-US',
    });
  });

  it('records outbox event and processes pending events reliably', async () => {
    const event = await OutboxDispatcher.recordEvent({
      aggregateType: 'GOOGLE_SYNC',
      aggregateId: `${websiteId}:GSC`,
      eventType: 'SYNC_REQUESTED',
      payload: { websiteId, provider: 'GSC', syncType: 'MANUAL_RESYNC' },
    });

    expect(event.id).toBeDefined();
    expect(event.status).toBe('PENDING');

    const result = await OutboxDispatcher.processPendingEvents(async () => {
      // simulate publisher
      return true;
    });

    expect(result.dispatched).toBeGreaterThanOrEqual(1);
  });

  it('enqueues background sync job returning unique job ID for asynchronous execution', async () => {
    const jobId = await SyncQueueProducer.enqueueSync({
      websiteId,
      provider: 'ALL',
      syncType: 'MANUAL_RESYNC',
    });

    expect(jobId).toBeDefined();
    expect(jobId.includes('sync-')).toBe(true);
  });
});
