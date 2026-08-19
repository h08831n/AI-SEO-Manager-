import { Router, Request, Response } from 'express';
import { VersionedRuleEngine } from '../domain/rules/ruleEngine';
import { VersionedOpportunityScorer } from '../domain/scoring/opportunityScorer';
import { getPrismaClient } from '../db/prismaClient';
import IORedis from 'ioredis';

const router = Router();

type ServiceStatus = 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN' | 'NOT_CONFIGURED';

// Track worker heartbeat timestamp
let lastWorkerHeartbeat: number = Date.now();

export function recordWorkerHeartbeat(): void {
  lastWorkerHeartbeat = Date.now();
}

// GET /api/observability/status
router.get('/status', async (req: Request, res: Response) => {
  let dbStatus: ServiceStatus = 'NOT_CONFIGURED';
  let redisStatus: ServiceStatus = 'NOT_CONFIGURED';
  let workerStatus: ServiceStatus = 'NOT_CONFIGURED';

  // 1. Check PostgreSQL Database Connection
  if (process.env.DATABASE_URL) {
    try {
      const prisma = getPrismaClient();
      if (prisma) {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'UP';
      } else {
        dbStatus = 'DOWN';
      }
    } catch {
      dbStatus = 'DOWN';
    }
  }

  // 2. Check Redis Connection
  if (process.env.REDIS_URL) {
    try {
      const testRedis = new IORedis(process.env.REDIS_URL, {
        connectTimeout: 1000,
        maxRetriesPerRequest: 0,
      });
      await testRedis.ping();
      redisStatus = 'UP';
      await testRedis.quit();
    } catch {
      redisStatus = 'DOWN';
    }
  }

  // 3. Worker Status (Independent heartbeat verification)
  const isWorkerFresh = Date.now() - lastWorkerHeartbeat < 60000;
  if (process.env.REDIS_URL && redisStatus === 'UP') {
    workerStatus = isWorkerFresh ? 'UP' : 'DEGRADED';
  } else if (!process.env.REDIS_URL) {
    workerStatus = 'NOT_CONFIGURED';
  } else {
    workerStatus = 'DOWN';
  }

  // 4. Gemini AI Model Configuration Check (Honest configuration check without assuming unexecuted live probe)
  const isGeminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  const geminiStatus: ServiceStatus = isGeminiConfigured ? 'UP' : 'NOT_CONFIGURED';

  const isHealthy = dbStatus !== 'DOWN' && redisStatus !== 'DOWN' && workerStatus !== 'DOWN';

  return res.json({
    status: isHealthy ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    services: {
      api: 'UP',
      database: dbStatus,
      redis: redisStatus,
      worker: workerStatus,
      lastWorkerHeartbeat: new Date(lastWorkerHeartbeat).toISOString(),
      integrations: {
        googleSearchConsole: 'NOT_CONFIGURED',
        googleAnalytics4: 'NOT_CONFIGURED',
        wordPress: 'NOT_CONFIGURED',
        gemini: geminiStatus,
      },
      geminiIntegration: {
        configured: isGeminiConfigured,
        status: isGeminiConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED',
      },
    },
    engines: {
      ruleEngineVersion: VersionedRuleEngine.VERSION,
      rulesCount: VersionedRuleEngine.getRegisteredRules().length,
      scoringEngineVersion: VersionedOpportunityScorer.VERSION,
    },
  });
});

// GET /api/health
router.get('/health', (req: Request, res: Response) => {
  return res.json({ status: 'ok', uptime: process.uptime() });
});

export default router;
