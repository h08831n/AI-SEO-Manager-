import { OutboxStatus } from '@prisma/client';

export interface OutboxRecord {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payloadJson: string;
  status: OutboxStatus;
  attemptCount: number;
  lastError?: string;
  nextAttemptAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

const outboxStore: Map<string, OutboxRecord> = new Map();

export class OutboxDispatcher {
  /**
   * Helper simulating transactional creation of domain record + outbox event
   */
  public static async recordEvent(params: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: any;
  }): Promise<OutboxRecord> {
    const id = `outbox-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record: OutboxRecord = {
      id,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      eventType: params.eventType,
      payloadJson: JSON.stringify(params.payload),
      status: 'PENDING',
      attemptCount: 0,
      createdAt: new Date().toISOString(),
    };

    outboxStore.set(id, record);
    return record;
  }

  /**
   * Dispatches pending outbox events to their destination with retry and backoff handling
   */
  public static async processPendingEvents(
    publisher: (event: OutboxRecord) => Promise<boolean>
  ): Promise<{ dispatched: number; failed: number }> {
    const now = new Date().toISOString();
    const pending = Array.from(outboxStore.values()).filter(
      (e) =>
        (e.status === 'PENDING' || e.status === 'FAILED') &&
        (!e.nextAttemptAt || e.nextAttemptAt <= now) &&
        e.attemptCount < 5
    );

    let dispatched = 0;
    let failed = 0;

    for (const event of pending) {
      event.status = 'PROCESSING';
      event.attemptCount += 1;

      try {
        const success = await publisher(event);
        if (success) {
          event.status = 'DELIVERED';
          event.deliveredAt = new Date().toISOString();
          event.lastError = undefined;
          dispatched += 1;
        } else {
          throw new Error('Publisher returned unacknowledged delivery');
        }
      } catch (err: any) {
        failed += 1;
        event.status = event.attemptCount >= 5 ? 'FAILED' : 'PENDING';
        event.lastError = err.message || 'Delivery error';
        // Exponential backoff
        const backoffSeconds = Math.pow(2, event.attemptCount) * 5;
        event.nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
      }
    }

    return { dispatched, failed };
  }

  public static async getById(id: string): Promise<OutboxRecord | null> {
    return outboxStore.get(id) || null;
  }

  public static async listAll(): Promise<OutboxRecord[]> {
    return Array.from(outboxStore.values());
  }

  public static async clearForTesting(): Promise<void> {
    outboxStore.clear();
  }
}
