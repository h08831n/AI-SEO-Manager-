import { Router, Request, Response } from 'express';
import { requireWebsiteAccess } from '../security/authMiddleware';
import { CompetitorRepository } from '../repositories/competitorRepository';
import { prisma } from '../db/prisma';

export const competitorRoutes = Router();

// List discovered / direct competitors
competitorRoutes.get('/websites/:websiteId', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { directOnly = 'false' } = req.query;

    const competitors = await CompetitorRepository.listCompetitors(websiteId, directOnly === 'true');
    return res.json({ success: true, competitors });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Refresh competitor overlap analysis
competitorRoutes.post('/websites/:websiteId/refresh', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) {
      return res.status(404).json({ error: `Website '${websiteId}' not found` });
    }

    const result = await CompetitorRepository.refreshCompetitorIntelligence(websiteId, website.domain);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Set competitor exclusion (platform / user override)
competitorRoutes.post('/websites/:websiteId/exclusions', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId } = req.params;
    const { domain, isExcluded, reason } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'domain is required' });
    }

    const result = await CompetitorRepository.setCompetitorExclusion(
      websiteId,
      domain,
      isExcluded !== undefined ? isExcluded : true,
      reason
    );

    return res.json({ success: true, competitor: result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get keyword gap matrix with a competitor
competitorRoutes.get('/websites/:websiteId/gap/:competitorDomain', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const { websiteId, competitorDomain } = req.params;
    const gap = await CompetitorRepository.getKeywordGapMatrix(websiteId, competitorDomain);
    return res.json({ success: true, competitorDomain, count: gap.length, gap });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
