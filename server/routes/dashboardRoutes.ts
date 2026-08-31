import { Router, Request, Response } from 'express';
import { DashboardAggregationService } from '../services/dashboard/dashboardAggregationService';
import { requireWorkspaceAuth } from '../security/authMiddleware';

const router = Router();

// GET /api/dashboard/overview
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const websiteId =
      (req.headers['x-website-id'] as string) ||
      (req.query.websiteId as string) ||
      'site-techscale-prod';
    const workspaceId =
      (req.headers['x-workspace-id'] as string) ||
      (req.query.workspaceId as string) ||
      'ws-techscale-org';

    const data = await DashboardAggregationService.getOverview(websiteId, workspaceId);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'FAILED_TO_FETCH_DASHBOARD', message: err.message });
  }
});

// GET /api/dashboard/websites/:websiteId
router.get('/websites/:websiteId', async (req: Request, res: Response) => {
  try {
    const websiteId = req.params.websiteId;
    const workspaceId =
      (req.headers['x-workspace-id'] as string) ||
      (req.query.workspaceId as string) ||
      'ws-techscale-org';

    const data = await DashboardAggregationService.getOverview(websiteId, workspaceId);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'FAILED_TO_FETCH_DASHBOARD', message: err.message });
  }
});

export default router;
