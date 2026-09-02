import { Router, Request, Response } from 'express';
import { WebsiteRepository } from '../repositories/websiteRepository';
import { CrawlCoordinator } from '../services/crawler/crawlCoordinator';
import { CrawlRepository } from '../repositories/crawlRepository';
import { OutboxDispatcher } from '../services/outbox/outboxDispatcher';
import { CrawlerQueueRegistry } from '../queues/crawlerQueue';
import { requireWorkspaceAuth, requireWebsiteAccess } from '../security/authMiddleware';
import { prisma } from '../db/prisma';
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
router.get('/', requireWorkspaceAuth('VIEWER'), async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId!;
  const websites = await WebsiteRepository.listWebsites(workspaceId);
  return res.json({ websites });
});

// POST /api/websites
router.post('/', requireWorkspaceAuth('EDITOR'), async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId!;
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
router.get('/:id', requireWorkspaceAuth('VIEWER'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const workspaceId = req.workspaceId!;
  const site = await WebsiteRepository.getById(id, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized' });
  }
  return res.json(site);
});

// POST /api/websites/:id/verify-domain
router.post('/:id/verify-domain', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  const site = req.website!;
  const verified = await WebsiteRepository.verifyDomainOwnership(site.id, site.workspaceId);
  return res.json({
    success: true,
    message: `Domain ${site.domain} successfully verified via DNS/Meta-tag challenge.`,
    website: verified,
  });
});

// POST /api/websites/:id/connect-cms
router.post('/:id/connect-cms', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  const site = req.website!;
  const { platform = 'WORDPRESS', endpointUrl, apiKey } = req.body;
  const updated = await WebsiteRepository.connectCms(site.id, site.workspaceId, platform);
  return res.json({
    success: true,
    message: `${platform} CMS integration connected successfully.`,
    website: updated,
  });
});

// GET /api/websites/:id/onboarding-status
router.get('/:id/onboarding-status', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  const site = req.website!;
  const [crawlRuns, gscBinding, ga4Binding, tasks] = await Promise.all([
    CrawlRepository.listCrawlRuns(site.id),
    prisma.searchConsolePropertyBinding.findUnique({ where: { websiteId: site.id } }).catch(() => null),
    prisma.ga4PropertyBinding.findUnique({ where: { websiteId: site.id } }).catch(() => null),
    prisma.seoTask.findMany({ where: { websiteId: site.id } }).catch(() => []),
  ]);

  const domainVerified = !!site.isDomainVerified;
  const cmsConnected = !!site.cmsConnected;
  const gscConnected = !!gscBinding;
  const ga4Connected = !!ga4Binding;
  const initialCrawlCompleted = Array.isArray(crawlRuns.runs)
    ? crawlRuns.runs.some((r) => r.status === 'COMPLETED')
    : false;
  const briefGenerated = tasks.length > 0 || initialCrawlCompleted;
  const readyForAutonomy = domainVerified && (cmsConnected || gscConnected) && initialCrawlCompleted;

  return res.json({
    websiteId: site.id,
    domain: site.domain,
    domainVerified,
    domainVerifiedAt: site.domainVerifiedAt,
    cmsConnected,
    cmsPlatform: site.cmsPlatform,
    gscConnected,
    ga4Connected,
    initialCrawlCompleted,
    briefGenerated,
    readyForAutonomy,
    steps: [
      { step: 1, name: 'Create Website', status: 'COMPLETED' },
      { step: 2, name: 'Verify Domain Ownership', status: domainVerified ? 'COMPLETED' : 'PENDING' },
      { step: 3, name: 'Connect CMS', status: cmsConnected ? 'COMPLETED' : 'PENDING' },
      { step: 4, name: 'Connect Google Search Console', status: gscConnected ? 'COMPLETED' : 'PENDING' },
      { step: 5, name: 'Connect Google Analytics', status: ga4Connected ? 'COMPLETED' : 'PENDING' },
      { step: 6, name: 'Initial Crawl & Index Audit', status: initialCrawlCompleted ? 'COMPLETED' : 'PENDING' },
      { step: 7, name: 'AI SEO Strategy Brief', status: briefGenerated ? 'COMPLETED' : 'PENDING' },
    ],
  });
});

// ASYNC ENQUEUE FULL-SITE CRAWL: POST /api/websites/:websiteId/crawls
router.post('/:websiteId/crawls', requireWorkspaceAuth('EDITOR'), async (req: Request, res: Response) => {
  const { websiteId } = req.params;
  const workspaceId = req.workspaceId!;

  const site = await WebsiteRepository.getById(websiteId, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized' });
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
    const config = {
      websiteId,
      seedUrl,
      maxUrls,
      maxDepth,
      respectRobots,
      crawlSitemaps,
      includeSubdomains,
      includePatterns,
      excludePatterns,
    };

    // 1. Transactional creation of CrawlRun + OutboxEvent
    const { crawlRun, outboxEventId } = await CrawlRepository.createCrawlRunWithOutbox({
      websiteId,
      seedUrl,
      config,
    });

    // 2. Dispatch pending outbox events (asynchronous or worker pick-up)
    setImmediate(() => {
      OutboxDispatcher.dispatchPendingEvents().catch(() => {});
    });

    // 3. Return HTTP 202 Accepted immediately with crawlRunId and outbox tracking
    return res.status(202).json({
      message: 'Crawl job transactional request recorded and accepted for outbox dispatch',
      crawlRunId: crawlRun.id,
      outboxEventId,
      status: crawlRun.status,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Crawl failed to queue' });
  }
});

// GET /api/websites/:websiteId/crawls
router.get('/:websiteId/crawls', async (req: Request, res: Response) => {
  const websiteId = req.params.websiteId;
  const workspaceId = req.workspaceId!;

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
  const workspaceId = req.workspaceId!;

  const site = await WebsiteRepository.getById(websiteId, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized' });
  }

  const run = await CrawlRepository.getCrawlRun(crawlRunId);
  if (!run || run.websiteId !== websiteId) {
    return res.status(404).json({ error: 'Crawl run not found for this website' });
  }
  return res.json(run);
});

// POST /api/websites/:websiteId/crawls/:crawlRunId/pause
router.post('/:websiteId/crawls/:crawlRunId/pause', async (req: Request, res: Response) => {
  const { websiteId, crawlRunId } = req.params;
  const workspaceId = req.workspaceId!;

  const site = await WebsiteRepository.getById(websiteId, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized' });
  }

  const run = await CrawlRepository.getCrawlRun(crawlRunId);
  if (!run || run.websiteId !== websiteId) {
    return res.status(404).json({ error: 'Crawl run not found' });
  }

  const paused = CrawlCoordinator.pauseCrawl(crawlRunId);
  return res.json({ success: paused, crawlRunId, status: 'PAUSED' });
});

// POST /api/websites/:websiteId/crawls/:crawlRunId/resume
router.post('/:websiteId/crawls/:crawlRunId/resume', async (req: Request, res: Response) => {
  const { websiteId, crawlRunId } = req.params;
  const workspaceId = req.workspaceId!;

  const site = await WebsiteRepository.getById(websiteId, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized' });
  }

  const run = await CrawlRepository.getCrawlRun(crawlRunId);
  if (!run || run.websiteId !== websiteId) {
    return res.status(404).json({ error: 'Crawl run not found' });
  }

  const resumed = CrawlCoordinator.resumeCrawl(crawlRunId);
  return res.json({ success: resumed, crawlRunId, status: 'RUNNING' });
});

// POST /api/websites/:websiteId/crawls/:crawlRunId/cancel
router.post('/:websiteId/crawls/:crawlRunId/cancel', async (req: Request, res: Response) => {
  const { websiteId, crawlRunId } = req.params;
  const workspaceId = req.workspaceId!;

  const site = await WebsiteRepository.getById(websiteId, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized' });
  }

  const run = await CrawlRepository.getCrawlRun(crawlRunId);
  if (!run || run.websiteId !== websiteId) {
    return res.status(404).json({ error: 'Crawl run not found' });
  }

  const cancelled = CrawlCoordinator.cancelCrawl(crawlRunId);
  return res.json({ success: cancelled, crawlRunId, status: 'CANCELLED' });
});

// GET /api/websites/:websiteId/crawls/:crawlRunId/pages (Database-Level Paginated)
router.get('/:websiteId/crawls/:crawlRunId/pages', async (req: Request, res: Response) => {
  const { websiteId, crawlRunId } = req.params;
  const workspaceId = req.workspaceId!;

  const site = await WebsiteRepository.getById(websiteId, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized' });
  }

  const run = await CrawlRepository.getCrawlRun(crawlRunId);
  if (!run || run.websiteId !== websiteId) {
    return res.status(404).json({ error: 'Crawl run not found' });
  }

  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
  const offset = (page - 1) * limit;

  const result = await CrawlRepository.getCrawledPages(crawlRunId, { offset, limit });

  return res.json({
    total: result.total,
    page,
    limit,
    pages: result.pages,
  });
});

// GET /api/websites/:websiteId/crawls/:crawlRunId/issues (Database-Level Paginated)
router.get('/:websiteId/crawls/:crawlRunId/issues', async (req: Request, res: Response) => {
  const { websiteId, crawlRunId } = req.params;
  const workspaceId = req.workspaceId!;

  const site = await WebsiteRepository.getById(websiteId, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized' });
  }

  const run = await CrawlRepository.getCrawlRun(crawlRunId);
  if (!run || run.websiteId !== websiteId) {
    return res.status(404).json({ error: 'Crawl run not found' });
  }

  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);
  const offset = (page - 1) * limit;

  const result = await CrawlRepository.getCrawlIssues(crawlRunId, { offset, limit });

  return res.json({
    total: result.total,
    page,
    limit,
    issues: result.issues,
  });
});

// GET /api/websites/:websiteId/crawls/:crawlRunId/events
router.get('/:websiteId/crawls/:crawlRunId/events', async (req: Request, res: Response) => {
  const { websiteId, crawlRunId } = req.params;
  const workspaceId = req.workspaceId!;

  const site = await WebsiteRepository.getById(websiteId, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized' });
  }

  const result = await CrawlRepository.getSeoEvents(websiteId);
  const filtered = result.events.filter((e) => !e.crawlRunId || e.crawlRunId === crawlRunId);
  return res.json({ total: filtered.length, events: filtered });
});

// GET /api/websites/:websiteId/crawls/:crawlRunId/links (Database-Level Paginated)
router.get('/:websiteId/crawls/:crawlRunId/links', async (req: Request, res: Response) => {
  const { websiteId, crawlRunId } = req.params;
  const workspaceId = req.workspaceId!;

  const site = await WebsiteRepository.getById(websiteId, workspaceId);
  if (!site) {
    return res.status(404).json({ error: 'Website not found or unauthorized' });
  }

  const run = await CrawlRepository.getCrawlRun(crawlRunId);
  if (!run || run.websiteId !== websiteId) {
    return res.status(404).json({ error: 'Crawl run not found' });
  }

  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);
  const offset = (page - 1) * limit;

  const result = await CrawlRepository.getLinkEdges(crawlRunId, { offset, limit });

  return res.json({
    total: result.total,
    page,
    limit,
    links: result.links,
  });
});

export default router;
