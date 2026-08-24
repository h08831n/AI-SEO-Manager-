import { describe, it, expect } from 'vitest';
import { prisma } from '../server/db/prisma';
import { ActionApprovalCenter } from '../server/services/action/approval/actionApprovalCenter';
import { StuckExecutionWatchdog } from '../server/services/action/approval/stuckExecutionWatchdog';
import { ActionWatchdogWorker } from '../server/services/worker/actionWatchdogWorker';

describe('Action Watchdog Worker Autonomous Lifecycle Suite', () => {
  const websiteId = 'site-worker-watchdog-restart-test';

  it('handles worker restart + stuck action detection + automated recovery execution', async () => {
    // 1. Propose and queue two actions that simulate worker crash/hang during execution and verification
    const stuckExecutingAction = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'SET_CANONICAL_URL',
      targetUrl: 'https://restart-watchdog.techscale.io/canonical-stuck',
      payload: { canonicalUrl: 'https://restart-watchdog.techscale.io/canonical-target' },
      riskLevel: 'LEVEL_1_SAFE_AUTOMATION',
    });
    await ActionApprovalCenter.approveAction({ actionId: stuckExecutingAction.id, userId: 'admin-lead' });
    await ActionApprovalCenter.queueAction(stuckExecutingAction.id, 'WORKER_NODE_1');
    await ActionApprovalCenter.markExecuting(stuckExecutingAction.id, `exec-crash-${Date.now()}`, 'WORKER_NODE_1');

    const stuckVerifyingAction = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'INJECT_STRUCTURED_DATA',
      targetUrl: 'https://restart-watchdog.techscale.io/schema-stuck',
      payload: { schemaType: 'FAQPage' },
      riskLevel: 'LEVEL_2_REVIEW_REQUIRED',
    });
    await ActionApprovalCenter.approveAction({ actionId: stuckVerifyingAction.id, userId: 'admin-lead' });
    await ActionApprovalCenter.queueAction(stuckVerifyingAction.id, 'WORKER_NODE_1');
    await ActionApprovalCenter.markExecuting(stuckVerifyingAction.id, `exec-crash-v-${Date.now()}`, 'WORKER_NODE_1');
    await ActionApprovalCenter.markVerifying(stuckVerifyingAction.id, 'STAGE_1_SYNTHETIC_DOM', 'VERIFIER_NODE_1');

    // 2. Simulate worker crash/restart: Simulate passage of time (>5 minutes for EXECUTING, >10 minutes for VERIFYING)
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    await prisma.actionApprovalRequest.update({
      where: { id: stuckExecutingAction.id },
      data: { updatedAt: twentyMinutesAgo },
    });
    await prisma.actionApprovalRequest.update({
      where: { id: stuckVerifyingAction.id },
      data: { updatedAt: twentyMinutesAgo },
    });

    // 3. Worker Node 2 starts up fresh and initializes action-watchdog-worker
    const workerRuntime = ActionWatchdogWorker.start(5 * 60 * 1000, {
      executingTimeoutMs: 5000,
      verifyingTimeoutMs: 5000,
      policyMode: 'RISK_BASED',
    });

    expect(workerRuntime.isRunning()).toBe(true);

    // 4. Trigger watchdog cycle (equivalent to scheduler firing after startup)
    const cycleResult = await workerRuntime.runOnce();

    expect(cycleResult.stuckCount).toBeGreaterThanOrEqual(2);

    // Verify incident details
    const incExecuting = cycleResult.incidents.find((i) => i.actionId === stuckExecutingAction.id);
    const incVerifying = cycleResult.incidents.find((i) => i.actionId === stuckVerifyingAction.id);

    expect(incExecuting).toBeDefined();
    expect(incExecuting?.state).toBe('EXECUTING');
    expect(incVerifying).toBeDefined();
    expect(incVerifying?.state).toBe('VERIFYING');

    // 5. Verify ACTION_STUCK_EXECUTION outbox event was generated
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        eventType: 'ACTION_STUCK_EXECUTION',
        aggregateId: { in: [stuckExecutingAction.id, stuckVerifyingAction.id] },
      },
    });
    expect(outboxEvents.length).toBeGreaterThanOrEqual(2);

    // 6. Verify automated recovery strategy applied (RETRY -> QUEUED)
    const refreshedExecuting = await ActionApprovalCenter.getActionById(stuckExecutingAction.id);
    expect(refreshedExecuting?.state).toBe('QUEUED');

    // 7. Verify full audit trail in ActionStateTransitionLog
    const logs = await ActionApprovalCenter.getTransitionLogs(stuckExecutingAction.id);
    const retryLog = logs[logs.length - 1];
    expect(retryLog.newState).toBe('QUEUED');
    expect(retryLog.reason).toContain('WATCHDOG_RETRY');

    // 8. Graceful stop
    await workerRuntime.stop();
    expect(workerRuntime.isRunning()).toBe(false);
  });
});
