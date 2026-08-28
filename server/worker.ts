import { startBackgroundWorker } from './services/worker/backgroundWorker';
import { ActionWatchdogWorker } from './services/worker/actionWatchdogWorker';
import { CrawlerQueueConsumer } from './queues/crawlerQueueConsumer';
import { SyncQueueConsumer } from './queues/syncQueueConsumer';
import { SerpQueueConsumer } from './queues/serpQueueConsumer';
import { ActionQueueConsumer } from './queues/actionQueueConsumer';
import { AttributionQueueConsumer } from './queues/attributionQueueConsumer';
import { OutboxDispatcher } from './services/outbox/outboxDispatcher';
import { recordWorkerHeartbeat } from './routes/observabilityRoutes';
import { isProductionMode } from './config/runtimeMode';

console.log('[Worker Process] Initializing Autonomous SEO Worker Runtime, Consumers & Outbox Dispatcher...');

if (isProductionMode() && !process.env.REDIS_URL) {
  console.error('[Worker Process] FATAL: REDIS_URL is required in PRODUCTION mode for worker consumers.');
  process.exit(1);
}

// 1. Initialize BullMQ Consumers
CrawlerQueueConsumer.initialize();
SyncQueueConsumer.start();
const serpQueueConsumer = new SerpQueueConsumer();
serpQueueConsumer.start();
ActionQueueConsumer.start();
AttributionQueueConsumer.start();

// 2. Start Transactional Outbox Polling
OutboxDispatcher.startPolling(2000);

// 3. Start Background Task Worker & Action Stuck Execution Watchdog Worker
const workerRuntime = startBackgroundWorker();
const watchdogWorkerRuntime = ActionWatchdogWorker.start();

// 4. Print Structured Topology Banner
console.log(`
========================================
AUTONOMOUS SEO WORKER RUNTIME TOPOLOGY
========================================
CrawlerConsumer ........ ENABLED
SyncConsumer ........... ENABLED
SerpConsumer ........... ENABLED
ActionConsumer ......... ENABLED
AttributionConsumer .... ENABLED
OutboxDispatcher ....... ENABLED
Watchdog ............... ENABLED
========================================
`);

// 5. Periodic Worker Heartbeat emitter (local + shared)
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
    await serpQueueConsumer.stop();
    await ActionQueueConsumer.stop();
    await AttributionQueueConsumer.stop();
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
