import { getPrismaClient } from '../../db/prismaClient';

export interface WorkerRuntime {
  stop: () => Promise<void>;
}

export function startBackgroundWorker(): WorkerRuntime {
  let isRunning = true;
  const pollIntervalMs = 15000;

  console.log(`[Worker] Started background worker (Poll Interval: ${pollIntervalMs}ms)`);
  if (process.env.REDIS_URL) {
    console.log(`[Worker] Queue Broker attached via REDIS_URL`);
  } else {
    console.log(`[Worker] Running in standalone DB poller mode (REDIS_URL not configured)`);
  }

  const intervalId = setInterval(async () => {
    if (!isRunning) return;

    try {
      const prisma = getPrismaClient();
      if (!prisma) {
        return;
      }

      // Check tasks scheduled for execution that require integration
      const dueTasks = await prisma.seoTask.findMany({
        where: {
          status: 'PENDING_APPROVAL',
          scheduledFor: { lte: new Date() },
        },
        take: 10,
      });

      for (const task of dueTasks) {
        // Without active external CMS integration (e.g. WordPress), do NOT execute or mark completed.
        // Mark as BLOCKED_NO_INTEGRATION
        await prisma.seoTask.update({
          where: { id: task.id },
          data: {
            status: 'BLOCKED_NO_INTEGRATION',
          },
        });
        console.log(`[Worker] Task ${task.id} marked as BLOCKED_NO_INTEGRATION (Integration required).`);
      }
    } catch (err) {
      console.warn('[Worker] Polling cycle warning:', err);
    }
  }, pollIntervalMs);

  return {
    stop: async () => {
      isRunning = false;
      clearInterval(intervalId);
    },
  };
}
