import { Router, Request, Response } from 'express';
import { ActionExecutionPipeline } from '../services/action/actionExecutionPipeline';
import { VerificationEngine } from '../services/action/verificationEngine';
import { ActionApprovalCenter } from '../services/action/approval/actionApprovalCenter';
import { ActionSnapshotService } from '../services/action/snapshots/actionSnapshotService';
import { StuckExecutionWatchdog } from '../services/action/approval/stuckExecutionWatchdog';
import { ApprovalState } from '../services/action/approval/approvalTypes';
import { requireWebsiteAccess, requireWorkspaceAuth } from '../security/authMiddleware';
import { prisma } from '../db/prisma';
import { z } from 'zod';

const router = Router();

const ExecuteActionSchema = z.object({
  websiteId: z.string().optional(),
  actionType: z.string(),
  targetUrl: z.string().url(),
  payload: z.record(z.string(), z.any()),
  idempotencyKey: z.string().min(8),
  taskId: z.string().optional(),
  recommendationId: z.string().optional(),
  approvalRequestId: z.string().optional(),
  isDryRun: z.boolean().optional(),
  autoVerify: z.boolean().optional(),
  platform: z.string().optional(),
  executionMode: z.enum(['MANUAL', 'AUTONOMOUS', 'CANARY']).optional(),
});

// POST /api/actions/execute
router.post('/execute', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const websiteId = req.website?.id || req.body.websiteId;
    if (!websiteId) {
      return res.status(400).json({ error: 'TARGET_WEBSITE_REQUIRED', message: 'websiteId is required.' });
    }

    const userId = req.principal?.userId || 'SYSTEM';
    const userRole = req.principal?.workspaceMemberships[0]?.role || 'ADMIN';

    const parseResult = ExecuteActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.flatten() });
    }

    const {
      actionType,
      targetUrl,
      payload,
      idempotencyKey,
      taskId,
      recommendationId,
      approvalRequestId,
      isDryRun,
      autoVerify,
      platform,
      executionMode = 'MANUAL',
    } = parseResult.data;

    const result = await ActionExecutionPipeline.execute({
      websiteId,
      taskId,
      recommendationId,
      approvalRequestId,
      actionType,
      targetUrl,
      payload,
      idempotencyKey,
      executionMode,
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
router.post('/:id/rollback', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const websiteId = req.website?.id || req.body.websiteId;
    if (!websiteId) {
      return res.status(400).json({ error: 'TARGET_WEBSITE_REQUIRED' });
    }

    const userId = req.principal?.userId || 'SYSTEM';
    const reason = req.body.reason || 'Manual 1-click rollback requested';
    const platform = req.body.platform;

    const result = await ActionExecutionPipeline.rollback({
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
router.post('/:id/verify', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const websiteId = req.website?.id || req.body.websiteId;
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
        gscIndexed: req.body.gscIndexed,
        serpFeaturePresent: req.body.serpFeaturePresent,
      });
      return res.json({ verification });
    }

    if (stage === 'STAGE_3_TRAFFIC_CONVERSION') {
      const verification = await VerificationEngine.runStage3ImpactVerification({
        actionExecutionId: execution.id,
        websiteId,
        ruleKey: execution.recommendation?.ruleKey || 'GENERAL_ACTION_RULE',
        preClicks: req.body.preClicks,
        postClicks: req.body.postClicks,
        preRank: req.body.preRank,
        postRank: req.body.postRank,
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
router.get('/approval-center/queue', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  const websiteId = req.website?.id || (req.query.websiteId as string);
  if (!websiteId) {
    return res.status(400).json({ error: 'websiteId required' });
  }
  const state = req.query.state as ApprovalState | undefined;
  const items = await ActionApprovalCenter.getApprovalQueue(websiteId, state);
  return res.json({ items });
});

// POST /api/actions/approval-center/propose
router.post('/approval-center/propose', requireWebsiteAccess('EDITOR'), async (req: Request, res: Response) => {
  try {
    const websiteId = req.website?.id || req.body.websiteId;
    const userId = req.principal?.userId || 'SYSTEM_DIAGNOSIS_ENGINE';
    const item = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: req.body.actionType,
      targetUrl: req.body.targetUrl,
      ruleKey: req.body.ruleKey,
      payload: req.body.payload || {},
      opportunityScore: req.body.opportunityScore,
      riskLevel: req.body.riskLevel,
      proposedBy: req.body.proposedBy || userId,
    });
    return res.json({ item });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/actions/approval-center/:id/approve
router.post('/approval-center/:id/approve', requireWorkspaceAuth('ADMIN'), async (req: Request, res: Response) => {
  try {
    const userId = req.principal?.userId || 'ADMIN';
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
router.post('/approval-center/:id/reject', requireWorkspaceAuth('ADMIN'), async (req: Request, res: Response) => {
  try {
    const userId = req.principal?.userId || 'ADMIN';
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
router.get('/approval-center/:id/logs', requireWorkspaceAuth('VIEWER'), async (req: Request, res: Response) => {
  const logs = await ActionApprovalCenter.getTransitionLogs(req.params.id);
  return res.json({ logs });
});

// GET /api/actions/rollback-history
router.get('/rollback-history', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  const websiteId = req.website?.id || (req.query.websiteId as string);
  if (!websiteId) {
    return res.status(400).json({ error: 'websiteId required' });
  }
  const history = await ActionSnapshotService.getRollbackHistory(websiteId);
  return res.json({ history });
});

// POST /api/actions/watchdog/scan
router.post('/watchdog/scan', requireWorkspaceAuth('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { executingTimeoutMs, verifyingTimeoutMs, policyMode, explicitStrategy } = req.body || {};
    const result = await StuckExecutionWatchdog.scanAndResolveStuckActions({
      executingTimeoutMs,
      verifyingTimeoutMs,
      policyMode,
      explicitStrategy,
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/actions/watchdog/resolve
router.post('/watchdog/resolve', requireWorkspaceAuth('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { actionId, strategy, reason } = req.body || {};
    if (!actionId || !strategy) {
      return res.status(400).json({ error: 'actionId and strategy are required' });
    }
    const result = await StuckExecutionWatchdog.applyResolution(actionId, strategy, reason || 'Manual operator trigger');
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/actions
router.get('/', requireWebsiteAccess('VIEWER'), async (req: Request, res: Response) => {
  const websiteId = req.website?.id || (req.query.websiteId as string);
  if (!websiteId) {
    return res.status(400).json({ error: 'websiteId required' });
  }
  const executions = await prisma.actionExecution.findMany({
    where: { websiteId },
    include: { verifications: true, task: true, recommendation: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ executions });
});

export default router;
