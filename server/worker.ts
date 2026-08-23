import { startBackgroundWorker } from './services/worker/backgroundWorker';
import { ActionWatchdogWorker } from './services/worker/actionWatchdogWorker';
import { CrawlerQueueConsumer } from './queues/crawlerQueueConsumer';
import { SyncQueueConsumer } from './queues/syncQueueConsumer';
import { OutboxDispatcher } from './services/outbox/outboxDispatcher';
import { recordWorkerHeartbeat } from './routes/observabilityRoutes';

console.log('[Worker Process] Initializing Autonomous SEO Worker Runtime, Consumer & Outbox Dispatcher...');

// 1. Initialize BullMQ Crawler Consumer Worker & Integration Sync Consumer
CrawlerQueueConsumer.initialize();
SyncQueueConsumer.start();

// 2. Start Transactional Outbox Polling
OutboxDispatcher.startPolling(2000);

// 3. Start Background Task Worker & Action Stuck Execution Watchdog Worker (5 min interval)
const workerRuntime = startBackgroundWorker();
const watchdogWorkerRuntime = ActionWatchdogWorker.start();

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
    await watchdogWorkerRuntime.stop();
    await CrawlerQueueConsumer.shutdown();
    await SyncQueueConsumer.stop();
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
