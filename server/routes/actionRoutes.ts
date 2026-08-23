import { Router, Request, Response } from 'express';
import { ActionOrchestrationService } from '../services/action/actionOrchestrationService';
import { VerificationEngine } from '../services/action/verificationEngine';
import { ActionApprovalCenter } from '../services/action/approval/actionApprovalCenter';
import { ActionSnapshotService } from '../services/action/snapshots/actionSnapshotService';
import { ApprovalState } from '../services/action/approval/approvalTypes';
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
  platform: z.string().optional(),
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

    const { actionType, targetUrl, payload, idempotencyKey, taskId, recommendationId, isDryRun, autoVerify, platform } =
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
      platform,
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
    const platform = req.body.platform;

    const result = await ActionOrchestrationService.rollbackAction({
      actionExecutionId: req.params.id,
      websiteId,
      reason,
      userId,
      platform,
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
    const stage = (req.query.stage as string) || 'STAGE_1_SYNTHETIC_DOM';
    const execution = await prisma.actionExecution.findFirst({
      where: { id: req.params.id, websiteId },
      include: { recommendation: true },
    });

    if (!execution) {
      return res.status(404).json({ error: 'Action execution not found' });
    }

    const expectedState = execution.afterEvidenceJson ? JSON.parse(execution.afterEvidenceJson) : {};

    if (stage === 'STAGE_2_INDEX_SERP') {
      const verification = await VerificationEngine.runStage2IndexSerpVerification({
        actionExecutionId: execution.id,
        websiteId,
        targetUrl: execution.targetUrl,
        ruleKey: execution.recommendation?.ruleKey || undefined,
        gscIndexed: req.body.gscIndexed ?? true,
        serpFeaturePresent: req.body.serpFeaturePresent ?? true,
      });
      return res.json({ verification });
    }

    if (stage === 'STAGE_3_TRAFFIC_CONVERSION') {
      const verification = await VerificationEngine.runStage3ImpactVerification({
        actionExecutionId: execution.id,
        websiteId,
        ruleKey: execution.recommendation?.ruleKey || 'GENERAL_ACTION_RULE',
        preClicks: req.body.preClicks || 100,
        postClicks: req.body.postClicks || 125,
        preRank: req.body.preRank || 10,
        postRank: req.body.postRank || 7,
      });
      return res.json({ verification });
    }

    // Default Stage 1
    const verification = await VerificationEngine.runStage1SyntheticVerification({
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

// --- Action Approval Center Endpoints ---

// GET /api/actions/approval-center/queue
router.get('/approval-center/queue', (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const state = req.query.state as ApprovalState | undefined;
  const items = ActionApprovalCenter.getApprovalQueue(websiteId, state);
  return res.json({ items });
});

// POST /api/actions/approval-center/propose
router.post('/approval-center/propose', async (req: Request, res: Response) => {
  try {
    const websiteId = (req.headers['x-website-id'] as string) || (req.body.websiteId as string) || 'site-techscale-prod';
    const item = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: req.body.actionType,
      targetUrl: req.body.targetUrl,
      ruleKey: req.body.ruleKey,
      payload: req.body.payload || {},
      opportunityScore: req.body.opportunityScore,
      riskLevel: req.body.riskLevel,
      proposedBy: req.body.proposedBy,
    });
    return res.json({ item });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/actions/approval-center/:id/approve
router.post('/approval-center/:id/approve', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'usr-admin-01';
    const item = await ActionApprovalCenter.approveAction({
      actionId: req.params.id,
      userId,
      notes: req.body.notes,
    });
    return res.json({ item });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/actions/approval-center/:id/reject
router.post('/approval-center/:id/reject', async (req: Request, res: Response) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'usr-admin-01';
    const item = await ActionApprovalCenter.rejectAction({
      actionId: req.params.id,
      userId,
      reason: req.body.reason || 'Rejected by reviewer',
    });
    return res.json({ item });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/actions/approval-center/:id/logs
router.get('/approval-center/:id/logs', (req: Request, res: Response) => {
  const logs = ActionApprovalCenter.getTransitionLogs(req.params.id);
  return res.json({ logs });
});

// GET /api/actions/rollback-history
router.get('/rollback-history', async (req: Request, res: Response) => {
  const websiteId = (req.headers['x-website-id'] as string) || 'site-techscale-prod';
  const history = await ActionSnapshotService.getRollbackHistory(websiteId);
  return res.json({ history });
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
