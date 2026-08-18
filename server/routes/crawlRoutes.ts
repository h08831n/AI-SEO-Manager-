import { Router, Request, Response } from 'express';
import { CrawlUrlRequestSchema } from '../../src/shared/contracts';
import { CrawlEngine } from '../services/crawler/crawlEngine';
import { CrawlCoordinator } from '../services/crawler/crawlCoordinator';
import { CrawlRepository } from '../repositories/crawlRepository';
import { AuditLogRepository } from '../repositories/auditLogRepository';

const router = Router();

// POST /api/crawl/url (single URL live crawl)
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
      correlationId: `corr-crawl-single-${Date.now()}`,
    });

    return res.json(crawlResult);
  } catch (err: any) {
    console.error('Crawl single URL error:', err);
    return res.status(500).json({
      status: 'FAILED',
      message: err.message || 'Crawl failed due to server or network error',
    });
  }
});

// POST /api/crawl/start (full sitewide technical crawl)
router.post('/start', async (req: Request, res: Response) => {
  try {
    const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
    const {
      seedUrl,
      maxUrls = 50,
      maxDepth = 3,
      respectRobots = true,
      crawlSitemaps = true,
      includeSubdomains = false,
      includePatterns = [],
      excludePatterns = [],
    } = req.body;

    if (!seedUrl) {
      return res.status(400).json({ error: 'seedUrl is required to start a technical crawl' });
    }

    // Execute crawl asynchronously / synchronously based on scale
    const crawlPromise = CrawlCoordinator.executeCrawl({
      websiteId,
      seedUrl,
      maxUrls,
      maxDepth,
      respectRobots,
      crawlSitemaps,
      includeSubdomains,
      includePatterns,
      excludePatterns,
    });

    // For prompt responsiveness, wait for execution or return immediate handle
    const result = await crawlPromise;

    await AuditLogRepository.log({
      websiteId,
      actionName: 'SITEWIDE_CRAWL_COMPLETED',
      affectedUrl: seedUrl,
      triggeredBy: 'MANUAL_USER',
      reason: `Executed sitewide crawl: ${result.totalPages} pages, ${result.totalIssues} issues detected`,
      beforeStateJson: null,
      afterStateJson: JSON.stringify(result),
      isReversible: false,
      isReverted: false,
      correlationId: result.crawlRunId || `corr-crawl-sitewide-${Date.now()}`,
    });

    return res.json({
      status: 'SUCCESS',
      ...result,
    });
  } catch (err: any) {
    console.error('Sitewide crawl execution error:', err);
    return res.status(500).json({
      status: 'FAILED',
      error: err.message || 'Sitewide crawl failed',
    });
  }
});

// POST /api/crawl/:id/cancel
router.post('/:id/cancel', (req: Request, res: Response) => {
  const cancelled = CrawlCoordinator.cancelCrawl(req.params.id);
  return res.json({ success: cancelled, crawlRunId: req.params.id });
});

// POST /api/crawl/:id/pause
router.post('/:id/pause', (req: Request, res: Response) => {
  const paused = CrawlCoordinator.pauseCrawl(req.params.id);
  return res.json({ success: paused, crawlRunId: req.params.id });
});

// POST /api/crawl/:id/resume
router.post('/:id/resume', (req: Request, res: Response) => {
  const resumed = CrawlCoordinator.resumeCrawl(req.params.id);
  return res.json({ success: resumed, crawlRunId: req.params.id });
});

// GET /api/crawl/runs
router.get('/runs', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const runs = await CrawlRepository.listCrawlRuns(websiteId);
  return res.json({ runs });
});

// GET /api/crawl/runs/:id
router.get('/runs/:id', async (req: Request, res: Response) => {
  const run = await CrawlRepository.getCrawlRun(req.params.id);
  if (!run) {
    return res.status(404).json({ error: 'Crawl run not found' });
  }
  const pages = await CrawlRepository.getCrawledPages(req.params.id);
  const issues = await CrawlRepository.getCrawlIssues(req.params.id);
  const links = await CrawlRepository.getLinkEdges(req.params.id);

  return res.json({
    run,
    pages,
    issues,
    links,
  });
});

// GET /api/crawl/events
router.get('/events', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const events = await CrawlRepository.getSeoEvents(websiteId);
  return res.json({ events });
});

export default router;
