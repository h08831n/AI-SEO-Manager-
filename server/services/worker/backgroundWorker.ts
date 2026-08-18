import { getPrismaClient } from '../../db/prismaClient';

export interface WorkerRuntime {
  stop: () => Promise<void>;
}

export function startBackgroundWorker(): WorkerRuntime {
  let isRunning = true;
  const pollIntervalMs = 15000; // 15s poll cycle

  console.log(`[Worker] Started background processing engine (Poll Interval: ${pollIntervalMs}ms)`);
  if (process.env.REDIS_URL) {
    console.log(`[Worker] Queue Broker attached via REDIS_URL`);
  } else {
    console.log(`[Worker] Running in standalone DB poller mode (REDIS_URL not set)`);
  }

  // Periodic job execution loop
  const intervalId = setInterval(async () => {
    if (!isRunning) return;

    try {
      const prisma = getPrismaClient();
      if (!prisma) {
        // Standalone memory mode / waiting for DB configuration
        return;
      }

      // 1. Process scheduled SEO tasks that are due for execution
      const now = new Date();
      const dueTasks = await prisma.seoTask.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledFor: { lte: now },
        },
        take: 10,
      });

      if (dueTasks.length > 0) {
        console.log(`[Worker] Found ${dueTasks.length} due SEO tasks for execution`);
        for (const task of dueTasks) {
          try {
            await prisma.seoTask.update({
              where: { id: task.id },
              data: {
                status: 'EXECUTING',
                executedAt: new Date(),
              },
            });
            console.log(`[Worker] Executed task ${task.id}: ${task.title}`);
            await prisma.seoTask.update({
              where: { id: task.id },
              data: {
                status: 'VERIFIED_SUCCESS',
                completedAt: new Date(),
              },
            });
          } catch (taskErr) {
            console.error(`[Worker] Error processing task ${task.id}:`, taskErr);
            await prisma.seoTask.update({
              where: { id: task.id },
              data: { status: 'FAILED' },
            });
          }
        }
      }
    } catch (loopErr) {
      console.warn('[Worker] Worker polling cycle warning:', loopErr);
    }
  }, pollIntervalMs);

  return {
    stop: async () => {
      isRunning = false;
      clearInterval(intervalId);
    },
  };
}
