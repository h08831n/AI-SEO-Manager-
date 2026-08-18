import { Router, Request, Response } from 'express';
import { TaskRepository } from '../repositories/taskRepository';
import { AuditLogRepository } from '../repositories/auditLogRepository';
import { z } from 'zod';

const router = Router();

// GET /api/tasks
router.get('/', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const tasks = await TaskRepository.listTasks(websiteId);
  return res.json({ tasks });
});

// GET /api/recommendations
router.get('/recommendations', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const recommendations = await TaskRepository.listRecommendations(websiteId);
  return res.json({ recommendations });
});

// POST /api/tasks/:id/execute
const ExecuteTaskSchema = z.object({
  idempotencyKey: z.string().min(8),
  isSimulation: z.boolean().default(false),
});

router.post('/:id/execute', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const parseResult = ExecuteTaskSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ error: 'Valid idempotencyKey is required' });
  }

  const { idempotencyKey, isSimulation } = parseResult.data;
  const result = await TaskRepository.executeTaskWithIdempotency(
    req.params.id,
    websiteId,
    idempotencyKey,
    isSimulation
  );

  // Append audit log
  await AuditLogRepository.log({
    websiteId,
    actionName: isSimulation ? 'SIMULATE_TASK_EXECUTION' : 'ATTEMPT_TASK_EXECUTION',
    affectedUrl: `task://${req.params.id}`,
    triggeredBy: isSimulation ? 'SIMULATION' : '1_CLICK_EXECUTION',
    reason: result.message,
    beforeStateJson: null,
    afterStateJson: JSON.stringify({ status: result.status, idempotencyKey }),
    isReversible: true,
    isReverted: false,
    correlationId: idempotencyKey,
  });

  return res.json(result);
});

// GET /api/audit-logs
router.get('/audit-logs', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const logs = await AuditLogRepository.listForWebsite(websiteId);
  return res.json({ logs });
});

export default router;
