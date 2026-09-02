import { Router, Request, Response } from 'express';
import { AgentSwarmService } from '../services/agents/agentSwarmService';
import { WebsiteRepository } from '../repositories/websiteRepository';
import { requireWorkspaceAuth, requireWebsiteAccess } from '../security/authMiddleware';

const router = Router();

// GET /api/agents
router.get('/', requireWorkspaceAuth('VIEWER'), async (req: Request, res: Response) => {
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
      return res.json({ agents: [] });
    }

    const agents = await AgentSwarmService.getAgents(websiteId);
    return res.json({ agents });
  } catch (err: any) {
    return res.status(500).json({ error: 'FAILED_TO_FETCH_AGENTS', message: err.message });
  }
});

// GET /api/agents/websites/:websiteId
router.get('/websites/:websiteId', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  try {
    const websiteId = req.website!.id;
    const agents = await AgentSwarmService.getAgents(websiteId);
    return res.json({ agents });
  } catch (err: any) {
    return res.status(500).json({ error: 'FAILED_TO_FETCH_AGENTS', message: err.message });
  }
});

// POST /api/agents/:agentId/task
router.post('/:agentId/task', requireWorkspaceAuth('EDITOR'), async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const workspaceId = req.workspaceId!;
    let websiteId = (req.headers['x-website-id'] as string) || req.body?.websiteId || (req.query.websiteId as string);

    if (!websiteId) {
      const websites = await WebsiteRepository.listWebsites(workspaceId);
      if (websites.length > 0) {
        websiteId = websites[0].id;
      }
    }

    if (!websiteId) {
      return res.status(400).json({ error: 'MISSING_WEBSITE_CONTEXT', message: 'No website found in workspace' });
    }

    const site = await WebsiteRepository.getById(websiteId, workspaceId);
    if (!site) {
      return res.status(404).json({ error: 'WEBSITE_NOT_FOUND' });
    }

    const result = await AgentSwarmService.executeAgentTask(websiteId, agentId, req.body?.taskType);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'AGENT_TASK_FAILED', message: err.message });
  }
});

// POST /api/agents/websites/:websiteId/:agentId/task
router.post('/websites/:websiteId/:agentId/task', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const { websiteId, agentId } = req.params;
    const result = await AgentSwarmService.executeAgentTask(websiteId, agentId, req.body?.taskType);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'AGENT_TASK_FAILED', message: err.message });
  }
});

// POST /api/agents/autonomous-loop
router.post('/autonomous-loop', requireWorkspaceAuth('EDITOR'), async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    let websiteId = (req.headers['x-website-id'] as string) || req.body?.websiteId || (req.query.websiteId as string);

    if (!websiteId) {
      const websites = await WebsiteRepository.listWebsites(workspaceId);
      if (websites.length > 0) {
        websiteId = websites[0].id;
      }
    }

    if (!websiteId) {
      return res.status(400).json({ error: 'MISSING_WEBSITE_CONTEXT', message: 'No website found in workspace' });
    }

    const site = await WebsiteRepository.getById(websiteId, workspaceId);
    if (!site) {
      return res.status(404).json({ error: 'WEBSITE_NOT_FOUND' });
    }

    const result = await AgentSwarmService.runAutonomousLoop(websiteId);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'AUTONOMOUS_LOOP_FAILED', message: err.message });
  }
});

// POST /api/agents/websites/:websiteId/autonomous-loop
router.post('/websites/:websiteId/autonomous-loop', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const websiteId = req.website!.id;
    const result = await AgentSwarmService.runAutonomousLoop(websiteId);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'AUTONOMOUS_LOOP_FAILED', message: err.message });
  }
});

export default router;
