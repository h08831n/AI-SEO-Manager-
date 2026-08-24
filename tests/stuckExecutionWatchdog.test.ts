import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../server/db/prisma';
import { ActionApprovalCenter } from '../server/services/action/approval/actionApprovalCenter';
import { StuckExecutionWatchdog } from '../server/services/action/approval/stuckExecutionWatchdog';

describe('Stuck Execution Watchdog & Risk-Based Recovery Policy Suite', () => {
  const websiteId = 'site-watchdog-risk-policy-test';

  it('1. Enforces Risk-Based Recovery Matrix during autonomous watchdog scan: LOW -> RETRY, MEDIUM -> REVIEW TASK, HIGH -> ROLLBACK SUGGESTION', async () => {
    // 1. Setup LOW RISK action stuck in EXECUTING (LEVEL_1_SAFE_AUTOMATION)
    const lowRiskItem = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'SET_CANONICAL_URL',
      targetUrl: 'https://watchdog.techscale.io/low-risk',
      payload: { canonicalUrl: 'https://watchdog.techscale.io/target' },
      riskLevel: 'LEVEL_1_SAFE_AUTOMATION',
    });
    await ActionApprovalCenter.approveAction({ actionId: lowRiskItem.id, userId: 'admin-lead' });
    await ActionApprovalCenter.queueAction(lowRiskItem.id, 'WORKER');
    await ActionApprovalCenter.markExecuting(lowRiskItem.id, `exec-low-${Date.now()}`, 'WORKER');

    // 2. Setup MEDIUM RISK action stuck in EXECUTING (LEVEL_2_REVIEW_REQUIRED)
    const mediumRiskItem = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'SET_META_TAGS',
      targetUrl: 'https://watchdog.techscale.io/medium-risk',
      payload: { title: 'Updated Meta Description' },
      riskLevel: 'LEVEL_2_REVIEW_REQUIRED',
    });
    await ActionApprovalCenter.approveAction({ actionId: mediumRiskItem.id, userId: 'admin-lead' });
    await ActionApprovalCenter.queueAction(mediumRiskItem.id, 'WORKER');
    await ActionApprovalCenter.markExecuting(mediumRiskItem.id, `exec-med-${Date.now()}`, 'WORKER');

    // 3. Setup HIGH RISK action stuck in EXECUTING (LEVEL_3_HIGH_RISK_MANUAL)
    const highRiskItem = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'CREATE_REDIRECT_RULE',
      targetUrl: 'https://watchdog.techscale.io/high-risk',
      payload: { destinationUrl: 'https://watchdog.techscale.io/new-dest' },
      riskLevel: 'LEVEL_3_HIGH_RISK_MANUAL',
    });
    await ActionApprovalCenter.approveAction({ actionId: highRiskItem.id, userId: 'admin-lead' });
    await ActionApprovalCenter.queueAction(highRiskItem.id, 'WORKER');
    await ActionApprovalCenter.markExecuting(highRiskItem.id, `exec-high-${Date.now()}`, 'WORKER');

    // Backdate timestamps
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.actionApprovalRequest.update({
      where: { id: lowRiskItem.id },
      data: { updatedAt: fifteenMinutesAgo },
    });
    await prisma.actionApprovalRequest.update({
      where: { id: mediumRiskItem.id },
      data: { updatedAt: fifteenMinutesAgo },
    });
    await prisma.actionApprovalRequest.update({
      where: { id: highRiskItem.id },
      data: { updatedAt: fifteenMinutesAgo },
    });

    // 4. Trigger scan under RISK_BASED policy
    const scanResult = await StuckExecutionWatchdog.scanAndResolveStuckActions({
      executingTimeoutMs: 5000,
      verifyingTimeoutMs: 5000,
      policyMode: 'RISK_BASED',
    });

    expect(scanResult.stuckCount).toBeGreaterThanOrEqual(3);

    // Verify LOW RISK action resolution -> RETRY allowed
    const resolvedLow = scanResult.resolvedActions.find((a) => a.actionId === lowRiskItem.id);
    expect(resolvedLow?.resolutionApplied).toBe('RETRY');
    expect(resolvedLow?.newState).toBe('QUEUED');
    const dbLow = await prisma.actionApprovalRequest.findUnique({ where: { id: lowRiskItem.id } });
    expect(dbLow?.state).toBe('QUEUED');

    // Verify MEDIUM RISK action resolution -> Created review task
    const resolvedMed = scanResult.resolvedActions.find((a) => a.actionId === mediumRiskItem.id);
    expect(resolvedMed?.resolutionApplied).toBe('MANUAL_REVIEW_ESCALATION');
    expect(resolvedMed?.newState).toBe('REJECTED');
    expect(resolvedMed?.taskId).toBeDefined();
    const dbMed = await prisma.actionApprovalRequest.findUnique({ where: { id: mediumRiskItem.id } });
    expect(dbMed?.state).toBe('REJECTED');
    expect(dbMed?.rejectionReason).toContain('WATCHDOG_REVIEW_TASK_CREATED');

    // Verify Task record exists in DB
    const reviewTask = await prisma.seoTask.findUnique({ where: { id: resolvedMed?.taskId } });
    expect(reviewTask).toBeDefined();
    expect(reviewTask?.websiteId).toBe(websiteId);
    expect(reviewTask?.priority).toBe('HIGH');

    // Verify HIGH RISK action resolution -> ROLLBACK_SUGGESTION only
    const resolvedHigh = scanResult.resolvedActions.find((a) => a.actionId === highRiskItem.id);
    expect(resolvedHigh?.resolutionApplied).toBe('ROLLBACK_SUGGESTION');
    expect(resolvedHigh?.newState).toBe('ROLLED_BACK');
    const dbHigh = await prisma.actionApprovalRequest.findUnique({ where: { id: highRiskItem.id } });
    expect(dbHigh?.state).toBe('ROLLED_BACK');

    // Verify audit logs for all 3 actions
    const lowLogs = await ActionApprovalCenter.getTransitionLogs(lowRiskItem.id);
    expect(lowLogs[lowLogs.length - 1].reason).toContain('WATCHDOG_RETRY');

    const medLogs = await ActionApprovalCenter.getTransitionLogs(mediumRiskItem.id);
    expect(medLogs[medLogs.length - 1].reason).toContain('WATCHDOG_MANUAL_REVIEW_TASK');

    const highLogs = await ActionApprovalCenter.getTransitionLogs(highRiskItem.id);
    expect(highLogs[highLogs.length - 1].reason).toContain('WATCHDOG_ROLLBACK_SUGGESTION');
  });

  it('2. Emits structured ACTION_STUCK_EXECUTION outbox events with policy audit data', async () => {
    const item = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'INJECT_STRUCTURED_DATA',
      targetUrl: 'https://watchdog.techscale.io/schema-stuck',
      payload: { schemaType: 'FAQPage' },
      riskLevel: 'LEVEL_1_SAFE_AUTOMATION',
    });
    await ActionApprovalCenter.approveAction({ actionId: item.id, userId: 'admin' });
    await ActionApprovalCenter.queueAction(item.id, 'WORKER');
    await ActionApprovalCenter.markExecuting(item.id, `exec-${Date.now()}`, 'WORKER');

    const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);
    await prisma.actionApprovalRequest.update({
      where: { id: item.id },
      data: { updatedAt: twentyMinAgo },
    });

    await StuckExecutionWatchdog.scanAndResolveStuckActions({
      executingTimeoutMs: 5000,
      policyMode: 'RISK_BASED',
    });

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        eventType: 'ACTION_STUCK_EXECUTION',
        aggregateId: item.id,
      },
    });

    expect(outboxEvents.length).toBeGreaterThanOrEqual(1);
    const payload = JSON.parse(outboxEvents[0].payloadJson);
    expect(payload.actionId).toBe(item.id);
    expect(payload.riskLevel).toBe('LEVEL_1_SAFE_AUTOMATION');
    expect(payload.recommendedResolution).toBe('RETRY');
    expect(payload.policyMode).toBe('RISK_BASED');
  });
});
