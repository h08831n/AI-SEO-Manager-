import { Router, Request, Response } from 'express';
import { SignalAggregatorService } from '../services/decision/signalAggregator';
import { DiagnosisEngine } from '../services/decision/diagnosisEngine';
import { RecommendationSynthesizer } from '../services/decision/recommendationSynthesizer';
import { DiagnosisRuleCatalog } from '../services/decision/rules/diagnosisRuleCatalog';
import { LearningLoopEngine } from '../services/decision/learningLoopEngine';
import { ActionQueueProducer } from '../queues/actionQueueProducer';

const router = Router();

// POST /api/decision/evaluate
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const websiteId = (req.headers['x-website-id'] as string) || (req.body.websiteId as string) || 'site-techscale-prod';
    const asyncMode = req.query.async === 'true';

    if (asyncMode) {
      const { jobId, deduplicated } = await ActionQueueProducer.enqueueAction({
        jobType: 'EVALUATE_DECISIONS',
        websiteId,
      });
      return res.json({ status: 'QUEUED', jobId, deduplicated });
    }

    const contexts = await SignalAggregatorService.aggregateProblemContexts(websiteId);
    const opportunities = DiagnosisEngine.evaluateContexts(contexts);
    const result = await RecommendationSynthesizer.synthesizeAndPersist(websiteId, opportunities);

    return res.json({
      status: 'COMPLETED',
      evaluatedContextsCount: contexts.length,
      opportunitiesCount: opportunities.length,
      persisted: result,
      topOpportunities: opportunities.slice(0, 10),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/decision/rules
router.get('/rules', async (req: Request, res: Response) => {
  const rules = DiagnosisRuleCatalog.getAllRules().map((r) => ({
    id: r.id,
    version: r.version,
    name: r.name,
    category: r.category,
    description: r.description,
    defaultAutomationLevel: r.defaultAutomationLevel,
    baseEffort: r.baseEffort,
    baseRisk: r.baseRisk,
  }));
  return res.json({ rules });
});

// GET /api/decision/learning-stats
router.get('/learning-stats', async (req: Request, res: Response) => {
  const profiles = LearningLoopEngine.getAllProfiles();
  return res.json({ profiles });
});

export default router;
