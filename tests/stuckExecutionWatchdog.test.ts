import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../server/db/prisma';
import { ActionApprovalCenter } from '../server/services/action/approval/actionApprovalCenter';
import { StuckExecutionWatchdog } from '../server/services/action/approval/stuckExecutionWatchdog';

describe('Stuck Execution Watchdog & Recovery Subsystem Suite', () => {
  const websiteId = 'site-watchdog-hardening-test';

  it('1. Detects stuck actions in EXECUTING and VERIFYING states beyond timeout and emits ACTION_STUCK_EXECUTION outbox events', async () => {
    // 1. Propose and advance action 1 to EXECUTING
    const itemExecuting = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'SET_CANONICAL_URL',
      targetUrl: 'https://watchdog.techscale.io/stuck-exec-1',
      payload: { canonicalUrl: 'https://watchdog.techscale.io/target-1' },
      riskLevel: 'LEVEL_1_SAFE_AUTOMATION',
    });
    await ActionApprovalCenter.approveAction({ actionId: itemExecuting.id, userId: 'admin-lead' });
    await ActionApprovalCenter.queueAction(itemExecuting.id, 'WORKER');
    await ActionApprovalCenter.markExecuting(itemExecuting.id, `exec-${Date.now()}`, 'WORKER');

    // 2. Propose and advance action 2 to VERIFYING
    const itemVerifying = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'INJECT_STRUCTURED_DATA',
      targetUrl: 'https://watchdog.techscale.io/stuck-verify-1',
      payload: { schemaType: 'Article' },
      riskLevel: 'LEVEL_2_REVIEW_REQUIRED',
    });
    await ActionApprovalCenter.approveAction({ actionId: itemVerifying.id, userId: 'admin-lead' });
    await ActionApprovalCenter.queueAction(itemVerifying.id, 'WORKER');
    await ActionApprovalCenter.markExecuting(itemVerifying.id, `exec-verify-${Date.now()}`, 'WORKER');
    await ActionApprovalCenter.markVerifying(itemVerifying.id, 'STAGE_1_SYNTHETIC_DOM', 'VERIFIER');

    // Backdate updatedAt timestamps in Prisma to simulate timeout expiration
    const tenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.actionApprovalRequest.update({
      where: { id: itemExecuting.id },
      data: { updatedAt: tenMinutesAgo },
    });
    await prisma.actionApprovalRequest.update({
      where: { id: itemVerifying.id },
      data: { updatedAt: tenMinutesAgo },
    });

    // 3. Trigger watchdog scan with a 5000ms threshold
    const scanResult = await StuckExecutionWatchdog.scanAndResolveStuckActions({
      executingTimeoutMs: 5000,
      verifyingTimeoutMs: 5000,
      autoResolveStrategy: 'NONE',
    });

    expect(scanResult.stuckCount).toBeGreaterThanOrEqual(2);
    const foundExecuting = scanResult.incidents.find((inc) => inc.actionId === itemExecuting.id);
    const foundVerifying = scanResult.incidents.find((inc) => inc.actionId === itemVerifying.id);

    expect(foundExecuting).toBeDefined();
    expect(foundExecuting?.state).toBe('EXECUTING');
    expect(foundExecuting?.recommendedResolution).toBe('RETRY');

    expect(foundVerifying).toBeDefined();
    expect(foundVerifying?.state).toBe('VERIFYING');
    expect(foundVerifying?.recommendedResolution).toBe('ROLLBACK_SUGGESTION');

    // 4. Verify ACTION_STUCK_EXECUTION outbox events were generated in the database
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        eventType: 'ACTION_STUCK_EXECUTION',
        aggregateId: { in: [itemExecuting.id, itemVerifying.id] },
      },
    });

    expect(outboxEvents.length).toBe(2);
    const parsedPayload = JSON.parse(outboxEvents[0].payloadJson);
    expect(parsedPayload.actionId).toBeDefined();
    expect(parsedPayload.thresholdMs).toBe(5000);
  });

  it('2. Supports automated RETRY resolution by re-queuing stuck action', async () => {
    const itemToRetry = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'SET_META_TAGS',
      targetUrl: 'https://watchdog.techscale.io/retry-page',
      payload: { title: 'New Meta Title' },
    });
    await ActionApprovalCenter.approveAction({ actionId: itemToRetry.id, userId: 'admin' });
    await ActionApprovalCenter.queueAction(itemToRetry.id, 'WORKER');
    await ActionApprovalCenter.markExecuting(itemToRetry.id, `exec-retry-${Date.now()}`, 'WORKER');

    // Apply RETRY resolution via watchdog
    const retryResult = await StuckExecutionWatchdog.applyResolution(
      itemToRetry.id,
      'RETRY',
      'Worker node connection reset timeout'
    );

    expect(retryResult).not.toBeNull();
    expect(retryResult?.resolutionApplied).toBe('RETRY');
    expect(retryResult?.newState).toBe('QUEUED');

    // Verify DB state
    const dbAction = await prisma.actionApprovalRequest.findUnique({
      where: { id: itemToRetry.id },
    });
    expect(dbAction?.state).toBe('QUEUED');

    const logs = await ActionApprovalCenter.getTransitionLogs(itemToRetry.id);
    const latestLog = logs[logs.length - 1];
    expect(latestLog.newState).toBe('QUEUED');
    expect(latestLog.reason).toContain('WATCHDOG_RETRY');
  });

  it('3. Supports automated ROLLBACK_SUGGESTION resolution for stalled verifications', async () => {
    const itemToRollback = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'CREATE_REDIRECT_RULE',
      targetUrl: 'https://watchdog.techscale.io/old-url',
      payload: { destinationUrl: 'https://watchdog.techscale.io/new-url', statusCode: 301 },
    });
    await ActionApprovalCenter.approveAction({ actionId: itemToRollback.id, userId: 'admin' });
    await ActionApprovalCenter.queueAction(itemToRollback.id, 'WORKER');
    await ActionApprovalCenter.markExecuting(itemToRollback.id, `exec-rb-${Date.now()}`, 'WORKER');
    await ActionApprovalCenter.markVerifying(itemToRollback.id, 'STAGE_1_SYNTHETIC_DOM', 'VERIFIER');

    // Apply ROLLBACK_SUGGESTION resolution via watchdog
    const rollbackResult = await StuckExecutionWatchdog.applyResolution(
      itemToRollback.id,
      'ROLLBACK_SUGGESTION',
      'Target endpoint returned unexpected variance during verification'
    );

    expect(rollbackResult).not.toBeNull();
    expect(rollbackResult?.resolutionApplied).toBe('ROLLBACK_SUGGESTION');
    expect(rollbackResult?.newState).toBe('ROLLED_BACK');

    const dbAction = await prisma.actionApprovalRequest.findUnique({
      where: { id: itemToRollback.id },
    });
    expect(dbAction?.state).toBe('ROLLED_BACK');
  });

  it('4. Supports MANUAL_REVIEW_ESCALATION placing stuck action into REJECTED state with audit notes', async () => {
    const itemToEscalate = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'INJECT_INTERNAL_LINK',
      targetUrl: 'https://watchdog.techscale.io/hub-page',
      payload: { links: [{ targetUrl: 'https://watchdog.techscale.io/dest', anchorText: 'Link' }] },
      riskLevel: 'LEVEL_3_HIGH_RISK_MANUAL',
    });
    await ActionApprovalCenter.approveAction({ actionId: itemToEscalate.id, userId: 'admin' });
    await ActionApprovalCenter.queueAction(itemToEscalate.id, 'WORKER');
    await ActionApprovalCenter.markExecuting(itemToEscalate.id, `exec-esc-${Date.now()}`, 'WORKER');

    // Apply MANUAL_REVIEW_ESCALATION
    const escResult = await StuckExecutionWatchdog.applyResolution(
      itemToEscalate.id,
      'MANUAL_REVIEW_ESCALATION',
      'Execution hung on CMS lock beyond 10 minutes'
    );

    expect(escResult).not.toBeNull();
    expect(escResult?.resolutionApplied).toBe('MANUAL_REVIEW_ESCALATION');
    expect(escResult?.newState).toBe('REJECTED');

    const dbAction = await prisma.actionApprovalRequest.findUnique({
      where: { id: itemToEscalate.id },
    });
    expect(dbAction?.state).toBe('REJECTED');
    expect(dbAction?.rejectionReason).toContain('WATCHDOG_ESCALATED');
  });
});
