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

export default router;
