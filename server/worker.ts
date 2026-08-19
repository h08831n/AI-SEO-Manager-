import { startBackgroundWorker } from './services/worker/backgroundWorker';
import { CrawlerQueueConsumer } from './queues/crawlerQueueConsumer';
import { OutboxDispatcher } from './services/outbox/outboxDispatcher';
import { recordWorkerHeartbeat } from './routes/observabilityRoutes';

console.log('[Worker Process] Initializing Autonomous SEO Worker Runtime, Consumer & Outbox Dispatcher...');

// 1. Initialize BullMQ Crawler Consumer Worker
CrawlerQueueConsumer.initialize();

// 2. Start Transactional Outbox Polling
OutboxDispatcher.startPolling(2000);

// 3. Start Background Task Worker
const workerRuntime = startBackgroundWorker();

// 4. Periodic Worker Heartbeat emitter (local + shared)
const heartbeatTimer = setInterval(() => {
  recordWorkerHeartbeat();
}, 10000);

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  console.log(`[Worker Process] Received ${signal}. Shutting down worker gracefully...`);
  clearInterval(heartbeatTimer);
  OutboxDispatcher.stopPolling();
  try {
    await CrawlerQueueConsumer.shutdown();
    await workerRuntime.stop();
    console.log('[Worker Process] Worker shutdown completed.');
    process.exit(0);
  } catch (err) {
    console.error('[Worker Process] Error during worker shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
