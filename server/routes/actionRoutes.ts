import { Router, Request, Response } from 'express';
import { ActionOrchestrationService } from '../services/action/actionOrchestrationService';
import { VerificationEngine } from '../services/action/verificationEngine';
import { prisma } from '../db/prisma';
import { z } from 'zod';

const router = Router();

const ExecuteActionSchema = z.object({
  actionType: z.string(),
  targetUrl: z.string().url(),
  payload: z.record(z.string(), z.any()),
  idempotencyKey: z.string().min(8),
  taskId: z.string().optional(),
  recommendationId: z.string().optional(),
  isDryRun: z.boolean().optional(),
  autoVerify: z.boolean().optional(),
});

// POST /api/actions/execute
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const websiteId = (req.headers['x-website-id'] as string) || (req.body.websiteId as string) || 'site-techscale-prod';
    const userId = (req.headers['x-user-id'] as string) || 'usr-admin-01';
    const userRole = (req.headers['x-user-role'] as string) || 'ADMIN';

    const parseResult = ExecuteActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.flatten() });
    }

    const { actionType, targetUrl, payload, idempotencyKey, taskId, recommendationId, isDryRun, autoVerify } =
      parseResult.data;

    const result = await ActionOrchestrationService.executeAction({
      websiteId,
      taskId,
      recommendationId,
      actionType,
      targetUrl,
      payload,
      idempotencyKey,
      userId,
      userRole,
      isDryRun,
      autoVerify,
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/actions/:id/rollback
router.post('/:id/rollback', async (req: Request, res: Response) => {
  try {
    const websiteId = (req.headers['x-website-id'] as string) || (req.body.websiteId as string) || 'site-techscale-prod';
    const userId = (req.headers['x-user-id'] as string) || 'usr-admin-01';
    const reason = req.body.reason || 'Manual 1-click rollback requested';

    const result = await ActionOrchestrationService.rollbackAction({
      actionExecutionId: req.params.id,
      websiteId,
      reason,
      userId,
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/actions/:id/verify
router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
    const execution = await prisma.actionExecution.findFirst({
      where: { id: req.params.id, websiteId },
      include: { recommendation: true },
    });

    if (!execution) {
      return res.status(404).json({ error: 'Action execution not found' });
    }

    const expectedState = execution.afterEvidenceJson ? JSON.parse(execution.afterEvidenceJson) : {};

    const verification = await VerificationEngine.runTier1ImmediateVerification({
      actionExecutionId: execution.id,
      websiteId,
      actionType: execution.actionType,
      targetUrl: execution.targetUrl,
      expectedState,
      ruleKey: execution.recommendation?.ruleKey || undefined,
    });

    return res.json({ verification });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/actions
router.get('/', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const executions = await prisma.actionExecution.findMany({
    where: { websiteId },
    include: { verifications: true, task: true, recommendation: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ executions });
});

export default router;
