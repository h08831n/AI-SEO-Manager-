import { Router, Request, Response } from 'express';
import { CrawlUrlRequestSchema } from '../../src/shared/contracts';
import { CrawlEngine } from '../services/crawler/crawlEngine';
import { CrawlRepository } from '../repositories/crawlRepository';
import { AuditLogRepository } from '../repositories/auditLogRepository';

const router = Router();

// POST /api/crawl/url (or /api/crawl for backwards compatibility)
router.post('/url', async (req: Request, res: Response) => {
  try {
    const parseResult = CrawlUrlRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Validation failed',
        errors: parseResult.error.flatten(),
      });
    }

    const { url } = parseResult.data;
    const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';

    const crawlResult = await CrawlEngine.crawlSingleUrl(url);

    // Persist crawl run to database repository
    const savedRun = await CrawlRepository.saveCrawlRun(websiteId, crawlResult);

    // Audit log
    await AuditLogRepository.log({
      websiteId,
      actionName: 'CRAWL_SINGLE_URL',
      affectedUrl: url,
      triggeredBy: 'MANUAL_USER',
      reason: `Audited single URL live crawl for ${url}`,
      beforeStateJson: null,
      afterStateJson: JSON.stringify({ statusCode: crawlResult.statusCode, issuesCount: crawlResult.issues.length }),
      isReversible: false,
      isReverted: false,
      correlationId: savedRun.id,
    });

    return res.json(crawlResult);
  } catch (err: any) {
    console.error('Crawl route error:', err);
    return res.status(500).json({
      status: 'FAILED',
      message: err.message || 'Crawl failed due to server or network error',
    });
  }
});

// GET /api/crawl/runs
router.get('/runs', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const runs = await CrawlRepository.listCrawlRuns(websiteId);
  return res.json({ runs });
});

// GET /api/crawl/runs/:id
router.get('/runs/:id', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const run = await CrawlRepository.getCrawlRunById(req.params.id, websiteId);
  if (!run) {
    return res.status(404).json({ error: 'Crawl run not found' });
  }
  return res.json(run);
});

export default router;
