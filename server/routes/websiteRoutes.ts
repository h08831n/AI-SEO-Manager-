import { Router, Request, Response } from 'express';
import { WebsiteRepository } from '../repositories/websiteRepository';
import { z } from 'zod';

const router = Router();

const CreateWebsiteSchema = z.object({
  domain: z.string().min(3),
  name: z.string().min(1),
  productionUrl: z.string().url(),
  sitemapUrl: z.string().url().optional(),
  defaultLanguage: z.string().default('en-US'),
  industry: z.string().optional(),
});

// GET /api/websites
router.get('/', async (req: Request, res: Response) => {
  const workspaceId = (req.headers['x-workspace-id'] as string) || 'ws-techscale-org';
  const websites = await WebsiteRepository.listWebsites(workspaceId);
  return res.json({ websites });
});

// POST /api/websites
router.post('/', async (req: Request, res: Response) => {
  const workspaceId = (req.headers['x-workspace-id'] as string) || 'ws-techscale-org';
  const parseResult = CreateWebsiteSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid website data', details: parseResult.error.flatten() });
  }

  const existing = await WebsiteRepository.getByDomain(parseResult.data.domain, workspaceId);
  if (existing) {
    return res.status(409).json({ error: `Website with domain ${parseResult.data.domain} already exists in this workspace.` });
  }

  const site = await WebsiteRepository.createWebsite({
    ...parseResult.data,
    workspaceId,
  });

  return res.status(201).json(site);
});

// GET /api/websites/:id
router.get('/:id', async (req: Request, res: Response) => {
  const workspaceId = (req.headers['x-workspace-id'] as string) || 'ws-techscale-org';
  const site = await WebsiteRepository.getById(req.params.id, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized' });
  }
  return res.json(site);
});

// TENANT-SCORED CRAWL APIS (/api/websites/:websiteId/crawls/*)
import { CrawlCoordinator } from '../services/crawler/crawlCoordinator';
import { CrawlRepository } from '../repositories/crawlRepository';

// POST /api/websites/:websiteId/crawls
router.post('/:websiteId/crawls', async (req: Request, res: Response) => {
  const websiteId = req.params.websiteId;
  const workspaceId = (req.headers['x-workspace-id'] as string) || 'ws-techscale-org';

  const site = await WebsiteRepository.getById(websiteId, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized for this workspace' });
  }

  const {
    seedUrl = site.productionUrl,
    maxUrls = 100,
    maxDepth = 3,
    respectRobots = true,
    crawlSitemaps = true,
    includeSubdomains = false,
    includePatterns = [],
    excludePatterns = [],
  } = req.body;

  try {
    const result = await CrawlCoordinator.executeCrawl({
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
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Crawl failed to execute' });
  }
});

// GET /api/websites/:websiteId/crawls
router.get('/:websiteId/crawls', async (req: Request, res: Response) => {
  const websiteId = req.params.websiteId;
  const workspaceId = (req.headers['x-workspace-id'] as string) || 'ws-techscale-org';

  const site = await WebsiteRepository.getById(websiteId, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized' });
  }

  const runs = await CrawlRepository.listCrawlRuns(websiteId);
  return res.json({ runs });
});

// GET /api/websites/:websiteId/crawls/:crawlRunId
router.get('/:websiteId/crawls/:crawlRunId', async (req: Request, res: Response) => {
  const { websiteId, crawlRunId } = req.params;
  const run = await CrawlRepository.getCrawlRun(crawlRunId);
  if (!run || run.websiteId !== websiteId) {
    return res.status(404).json({ error: 'Crawl run not found for this website' });
  }
  return res.json(run);
});

// POST /api/websites/:websiteId/crawls/:crawlRunId/pause
router.post('/:websiteId/crawls/:crawlRunId/pause', async (req: Request, res: Response) => {
  const { crawlRunId } = req.params;
  const paused = CrawlCoordinator.pauseCrawl(crawlRunId);
  return res.json({ success: paused, crawlRunId, status: 'PAUSED' });
});

// POST /api/websites/:websiteId/crawls/:crawlRunId/resume
router.post('/:websiteId/crawls/:crawlRunId/resume', async (req: Request, res: Response) => {
  const { crawlRunId } = req.params;
  const resumed = CrawlCoordinator.resumeCrawl(crawlRunId);
  return res.json({ success: resumed, crawlRunId, status: 'RUNNING' });
});

// POST /api/websites/:websiteId/crawls/:crawlRunId/cancel
router.post('/:websiteId/crawls/:crawlRunId/cancel', async (req: Request, res: Response) => {
  const { crawlRunId } = req.params;
  const cancelled = CrawlCoordinator.cancelCrawl(crawlRunId);
  return res.json({ success: cancelled, crawlRunId, status: 'CANCELLED' });
});

// GET /api/websites/:websiteId/crawls/:crawlRunId/pages
router.get('/:websiteId/crawls/:crawlRunId/pages', async (req: Request, res: Response) => {
  const { websiteId, crawlRunId } = req.params;
  const run = await CrawlRepository.getCrawlRun(crawlRunId);
  if (!run || run.websiteId !== websiteId) {
    return res.status(404).json({ error: 'Crawl run not found' });
  }

  const pages = await CrawlRepository.getCrawledPages(crawlRunId);
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '50', 10);
  const offset = (page - 1) * limit;

  return res.json({
    total: pages.length,
    page,
    limit,
    pages: pages.slice(offset, offset + limit),
  });
});

// GET /api/websites/:websiteId/crawls/:crawlRunId/issues
router.get('/:websiteId/crawls/:crawlRunId/issues', async (req: Request, res: Response) => {
  const { websiteId, crawlRunId } = req.params;
  const run = await CrawlRepository.getCrawlRun(crawlRunId);
  if (!run || run.websiteId !== websiteId) {
    return res.status(404).json({ error: 'Crawl run not found' });
  }

  const issues = await CrawlRepository.getCrawlIssues(crawlRunId);
  return res.json({ total: issues.length, issues });
});

// GET /api/websites/:websiteId/crawls/:crawlRunId/events
router.get('/:websiteId/crawls/:crawlRunId/events', async (req: Request, res: Response) => {
  const { websiteId, crawlRunId } = req.params;
  const allEvents = await CrawlRepository.getSeoEvents(websiteId);
  const events = allEvents.filter((e) => !e.crawlRunId || e.crawlRunId === crawlRunId);
  return res.json({ total: events.length, events });
});

// GET /api/websites/:websiteId/crawls/:crawlRunId/links
router.get('/:websiteId/crawls/:crawlRunId/links', async (req: Request, res: Response) => {
  const { websiteId, crawlRunId } = req.params;
  const run = await CrawlRepository.getCrawlRun(crawlRunId);
  if (!run || run.websiteId !== websiteId) {
    return res.status(404).json({ error: 'Crawl run not found' });
  }

  const links = await CrawlRepository.getLinkEdges(crawlRunId);
  return res.json({ total: links.length, links });
});

export default router;
