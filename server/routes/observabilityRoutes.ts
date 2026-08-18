import { Router, Request, Response } from 'express';
import { VersionedRuleEngine } from '../domain/rules/ruleEngine';
import { VersionedOpportunityScorer } from '../domain/scoring/opportunityScorer';

const router = Router();

// GET /api/observability/status
router.get('/status', (req: Request, res: Response) => {
  return res.json({
    status: 'HEALTHY',
    version: '2.0.0-phase1',
    timestamp: new Date().toISOString(),
    ruleEngine: {
      version: VersionedRuleEngine.VERSION,
      registeredRulesCount: VersionedRuleEngine.getRegisteredRules().length,
    },
    scoringEngine: {
      version: VersionedOpportunityScorer.VERSION,
    },
    databaseMode: process.env.DATABASE_URL ? 'POSTGRESQL_READY' : 'MEMORY_BACKED_ISOLATED',
    llmProvider: process.env.GEMINI_API_KEY ? 'GEMINI_CONFIGURED' : 'UNCONFIGURED',
  });
});

// GET /api/health
router.get('/health', (req: Request, res: Response) => {
  return res.json({ status: 'ok', uptime: process.uptime() });
});

export default router;
