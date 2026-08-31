import { Router, Request, Response } from 'express';
import { AgentSwarmService } from '../services/agents/agentSwarmService';

const router = Router();

// GET /api/agents or /api/agents/websites/:websiteId
router.get('/', async (req: Request, res: Response) => {
  try {
    const websiteId =
      (req.headers['x-website-id'] as string) ||
      (req.query.websiteId as string) ||
      'site-techscale-prod';

    const agents = await AgentSwarmService.getAgents(websiteId);
    return res.json({ agents });
  } catch (err: any) {
    return res.status(500).json({ error: 'FAILED_TO_FETCH_AGENTS', message: err.message });
  }
});

router.get('/websites/:websiteId', async (req: Request, res: Response) => {
  try {
    const websiteId = req.params.websiteId;
    const agents = await AgentSwarmService.getAgents(websiteId);
    return res.json({ agents });
  } catch (err: any) {
    return res.status(500).json({ error: 'FAILED_TO_FETCH_AGENTS', message: err.message });
  }
});

// POST /api/agents/websites/:websiteId/tasks/:agentId or /api/agents/:agentId/task
router.post('/:agentId/task', async (req: Request, res: Response) => {
  try {
    const agentId = req.params.agentId;
    const websiteId =
      (req.headers['x-website-id'] as string) ||
      (req.body && req.body.websiteId) ||
      (req.query.websiteId as string) ||
      'site-techscale-prod';

    const result = await AgentSwarmService.executeAgentTask(websiteId, agentId, req.body?.taskType);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'AGENT_TASK_FAILED', message: err.message });
  }
});

router.post('/websites/:websiteId/:agentId/task', async (req: Request, res: Response) => {
  try {
    const { websiteId, agentId } = req.params;
    const result = await AgentSwarmService.executeAgentTask(websiteId, agentId, req.body?.taskType);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'AGENT_TASK_FAILED', message: err.message });
  }
});

// POST /api/agents/autonomous-loop or /api/agents/websites/:websiteId/autonomous-loop
router.post('/autonomous-loop', async (req: Request, res: Response) => {
  try {
    const websiteId =
      (req.headers['x-website-id'] as string) ||
      (req.body && req.body.websiteId) ||
      (req.query.websiteId as string) ||
      'site-techscale-prod';

    const result = await AgentSwarmService.runAutonomousLoop(websiteId);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'AUTONOMOUS_LOOP_FAILED', message: err.message });
  }
});

router.post('/websites/:websiteId/autonomous-loop', async (req: Request, res: Response) => {
  try {
    const websiteId = req.params.websiteId;
    const result = await AgentSwarmService.runAutonomousLoop(websiteId);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'AUTONOMOUS_LOOP_FAILED', message: err.message });
  }
});

export default router;
