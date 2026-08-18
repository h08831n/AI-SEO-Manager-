import { startBackgroundWorker } from './services/worker/backgroundWorker';

console.log('[Worker Process] Initializing Autonomous SEO Worker Runtime...');

const workerRuntime = startBackgroundWorker();

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  console.log(`[Worker Process] Received ${signal}. Shutting down worker gracefully...`);
  try {
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
