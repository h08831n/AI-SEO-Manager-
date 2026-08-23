import { describe, it, expect } from 'vitest';
import { prisma } from '../server/db/prisma';
import { ActionApprovalCenter } from '../server/services/action/approval/actionApprovalCenter';

describe('Action Approval Center Durable Database & Concurrency Suite', () => {
  const websiteId = 'site-concurrency-test-01';

  it('handles simultaneous approvals by two admins: only one transition succeeds, other fails with conflict', async () => {
    // 1. Propose an action
    const proposed = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'SET_CANONICAL_URL',
      targetUrl: 'https://concurrent.techscale.io/article-1',
      payload: { canonicalUrl: 'https://concurrent.techscale.io/canonical-1' },
      opportunityScore: 90,
      riskLevel: 'LEVEL_2_REVIEW_REQUIRED',
    });

    expect(proposed.state).toBe('PROPOSED');

    // 2. Simulate two admins attempting to approve the same action concurrently
    const [resultAdmin1, resultAdmin2] = await Promise.allSettled([
      ActionApprovalCenter.approveAction({
        actionId: proposed.id,
        userId: 'admin-alice',
        notes: 'Approved by Alice',
      }),
      ActionApprovalCenter.approveAction({
        actionId: proposed.id,
        userId: 'admin-bob',
        notes: 'Approved by Bob',
      }),
    ]);

    const fulfilled = [resultAdmin1, resultAdmin2].filter((r) => r.status === 'fulfilled');
    const rejected = [resultAdmin1, resultAdmin2].filter((r) => r.status === 'rejected');

    // Exactly one transition must succeed
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    if (rejected[0].status === 'rejected') {
      expect(rejected[0].reason.message).toMatch(/cannot transition|conflict/i);
    }

    // 3. Verify Database is the single source of truth
    const dbRecord = await prisma.actionApprovalRequest.findUnique({
      where: { id: proposed.id },
    });
    expect(dbRecord?.state).toBe('APPROVED');

    // Verify exactly one state transition log was recorded
    const transitionLogs = await ActionApprovalCenter.getTransitionLogs(proposed.id);
    expect(transitionLogs.length).toBe(1);
    expect(transitionLogs[0].previousState).toBe('PROPOSED');
    expect(transitionLogs[0].newState).toBe('APPROVED');
  });

  it('recovers state from database seamlessly when worker restarts during EXECUTING state', async () => {
    const executionId = `exec-worker-crash-${Date.now()}`;

    // 1. Lifecycle progression up to EXECUTING
    const proposed = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: 'INJECT_STRUCTURED_DATA',
      targetUrl: 'https://concurrent.techscale.io/product-page',
      payload: { schemaType: 'Product', name: 'Cloud Tier' },
      opportunityScore: 85,
    });

    await ActionApprovalCenter.approveAction({
      actionId: proposed.id,
      userId: 'admin-charlie',
    });

    await ActionApprovalCenter.queueAction(proposed.id, 'WORKER_DISPATCH');

    const executing = await ActionApprovalCenter.markExecuting(
      proposed.id,
      executionId,
      'WORKER_PROCESS_01'
    );
    expect(executing.state).toBe('EXECUTING');
    expect(executing.executionId).toBe(executionId);

    // 2. Simulate worker crash / cold restart (no in-memory references)
    // Query directly from a fresh caller
    const recovered = await ActionApprovalCenter.getActionById(proposed.id);
    expect(recovered).not.toBeNull();
    expect(recovered?.state).toBe('EXECUTING');
    expect(recovered?.executionId).toBe(executionId);

    // 3. New worker process resumes pipeline from DB state
    const verifying = await ActionApprovalCenter.markVerifying(
      proposed.id,
      'STAGE_1_SYNTHETIC_DOM',
      'WORKER_PROCESS_02_RESTARTED'
    );
    expect(verifying.state).toBe('VERIFYING');

    const verified = await ActionApprovalCenter.markVerified(
      proposed.id,
      'WORKER_PROCESS_02_RESTARTED'
    );
    expect(verified.state).toBe('VERIFIED');

    // Verify DB transition log history
    const logs = await ActionApprovalCenter.getTransitionLogs(proposed.id);
    expect(logs.length).toBe(5); // PROPOSED->APPROVED->QUEUED->EXECUTING->VERIFYING->VERIFIED
    expect(logs.map((l) => l.newState)).toEqual([
      'APPROVED',
      'QUEUED',
      'EXECUTING',
      'VERIFYING',
      'VERIFIED',
    ]);
  });

  it('supports multi-instance approval queue querying and filtering purely via Prisma', async () => {
    const freshSiteId = `site-multi-instance-${Date.now()}`;

    const item1 = await ActionApprovalCenter.proposeAction({
      websiteId: freshSiteId,
      actionType: 'SET_META_TAGS',
      targetUrl: 'https://multi.techscale.io/page1',
      payload: { title: 'Optimized Meta' },
      opportunityScore: 95,
    });

    const item2 = await ActionApprovalCenter.proposeAction({
      websiteId: freshSiteId,
      actionType: 'SET_CANONICAL_URL',
      targetUrl: 'https://multi.techscale.io/page2',
      payload: { canonicalUrl: 'https://multi.techscale.io/hub' },
      opportunityScore: 80,
    });

    await ActionApprovalCenter.approveAction({
      actionId: item1.id,
      userId: 'admin-lead',
    });

    // Query queue from simulated instance A
    const proposedQueue = await ActionApprovalCenter.getApprovalQueue(freshSiteId, 'PROPOSED');
    expect(proposedQueue.length).toBe(1);
    expect(proposedQueue[0].id).toBe(item2.id);

    // Query approved queue from simulated instance B
    const approvedQueue = await ActionApprovalCenter.getApprovalQueue(freshSiteId, 'APPROVED');
    expect(approvedQueue.length).toBe(1);
    expect(approvedQueue[0].id).toBe(item1.id);
  });
});
