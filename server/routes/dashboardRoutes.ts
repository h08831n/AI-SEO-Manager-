import { Router, Request, Response } from 'express';
import { DashboardAggregationService } from '../services/dashboard/dashboardAggregationService';
import { WebsiteRepository } from '../repositories/websiteRepository';
import { requireWorkspaceAuth } from '../security/authMiddleware';

const router = Router();

// GET /api/dashboard/overview
router.get('/overview', requireWorkspaceAuth('VIEWER'), async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    let websiteId = (req.headers['x-website-id'] as string) || (req.query.websiteId as string);

    if (!websiteId) {
      const websites = await WebsiteRepository.listWebsites(workspaceId);
      if (websites.length > 0) {
        websiteId = websites[0].id;
      }
    }

    if (!websiteId) {
      // Workspace has no websites yet; return clean onboarding state
      return res.json({
        website: null,
        healthState: {
          overallScore: 0,
          previousScore: 0,
          lastAudited: new Date().toISOString(),
          pillars: {},
        },
        metrics: {
          top10Rankings: 0,
          top10RankingsChange: 0,
          organicClicks: 0,
          organicClicksChangePct: 0,
          totalImpressions: 0,
          impressionsChangePct: 0,
          averageCtr: 0,
          averageCtrChangePct: 0,
          averagePosition: 0,
          averagePositionChange: 0,
        },
        brief: null,
        recommendations: [],
        recentActions: [],
        agents: [],
      });
    }

    const data = await DashboardAggregationService.getOverview(websiteId, workspaceId);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'FAILED_TO_FETCH_DASHBOARD', message: err.message });
  }
});

// GET /api/dashboard/websites/:websiteId
router.get('/websites/:websiteId', requireWorkspaceAuth('VIEWER'), async (req: Request, res: Response) => {
  try {
    const websiteId = req.params.websiteId;
    const workspaceId = req.workspaceId!;

    const site = await WebsiteRepository.getById(websiteId, workspaceId);
    if (!site) {
      return res.status(404).json({ error: 'WEBSITE_NOT_FOUND', message: 'Website not found in current workspace context' });
    }

    const data = await DashboardAggregationService.getOverview(websiteId, workspaceId);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'FAILED_TO_FETCH_DASHBOARD', message: err.message });
  }
});

export default router;

