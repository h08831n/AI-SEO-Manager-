import { Router, Request, Response } from 'express';
import { VersionedRuleEngine } from '../domain/rules/ruleEngine';
import { VersionedOpportunityScorer } from '../domain/scoring/opportunityScorer';
import { getPrismaClient } from '../db/prismaClient';
import IORedis from 'ioredis';

const router = Router();

type ServiceStatus = 'UP' | 'DOWN' | 'DEGRADED' | 'UNKNOWN' | 'NOT_CONFIGURED';

// GET /api/observability/status
router.get('/status', async (req: Request, res: Response) => {
  let dbStatus: ServiceStatus = 'NOT_CONFIGURED';
  let redisStatus: ServiceStatus = 'NOT_CONFIGURED';
  let workerStatus: ServiceStatus = 'NOT_CONFIGURED';

  // 1. Check PostgreSQL Database Connection (without exposing credentials)
  if (process.env.DATABASE_URL) {
    try {
      const prisma = getPrismaClient();
      if (prisma) {
        // Execute quick query
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

  // 3. Worker Status
  workerStatus = redisStatus === 'UP' ? 'UP' : redisStatus === 'DOWN' ? 'DOWN' : 'NOT_CONFIGURED';

  // 4. Overall health rollup
  const isHealthy = dbStatus !== 'DOWN' && redisStatus !== 'DOWN';

  return res.json({
    status: isHealthy ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    services: {
      api: 'UP',
      database: dbStatus,
      redis: redisStatus,
      worker: workerStatus,
      integrations: {
        googleSearchConsole: 'NOT_CONFIGURED',
        googleAnalytics4: 'NOT_CONFIGURED',
        wordPress: 'NOT_CONFIGURED',
        gemini: process.env.GEMINI_API_KEY ? 'UP' : 'NOT_CONFIGURED',
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
