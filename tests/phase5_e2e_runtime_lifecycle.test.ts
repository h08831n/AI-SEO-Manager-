import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../server/db/prisma';
import { ActionApprovalCenter } from '../server/services/action/approval/actionApprovalCenter';
import { ActionOrchestrationService } from '../server/services/action/actionOrchestrationService';
import { ActionSnapshotService } from '../server/services/action/snapshots/actionSnapshotService';
import { VerificationEngine } from '../server/services/action/verificationEngine';
import { CmsProviderRegistry } from '../server/services/action/cms/cmsProviderRegistry';
import { ActionStatus } from '@prisma/client';

describe('Phase 5 Complete End-to-End Runtime Lifecycle Test', () => {
  const websiteId = 'site-e2e-hardened-01';
  const targetUrl = 'https://hardening.techscale.io/e2e-lifecycle-article';
  const canonicalUrl = 'https://hardening.techscale.io/canonical-target-page';
  const platform = 'WORDPRESS';

  beforeEach(async () => {
    process.env.AUTONOMOUS_EXECUTION_ENABLED = 'true';
    ActionSnapshotService.simulateWorkerRestart();
    await prisma.website.upsert({
      where: { id: websiteId },
      update: { domain: 'hardening.techscale.io' },
      create: {
        id: websiteId,
        domain: 'hardening.techscale.io',
        businessCategory: 'Tech',
        riskTier: 'STANDARD',
        autonomyMode: 'FULL_AUTO',
      },
    });
  });

  it('executes full autonomous lifecycle: Signal -> Recommendation -> Approval -> Queue -> Executor -> Verification -> Rollback', async () => {
    // ----------------------------------------------------
    // STEP 1: SIGNAL GENERATION
    // ----------------------------------------------------
    const crawlSignal = {
      websiteId,
      issueType: 'MISSING_CANONICAL_TAG',
      targetUrl,
      severity: 'HIGH',
      detectedAt: new Date().toISOString(),
      metadata: { missingTag: 'canonical', currentTitle: 'E2E Article - Hardening Testing' },
    };

    expect(crawlSignal.issueType).toBe('MISSING_CANONICAL_TAG');
    expect(crawlSignal.targetUrl).toBe(targetUrl);

    // ----------------------------------------------------
    // STEP 2: RECOMMENDATION GENERATION
    // ----------------------------------------------------
    const recommendation = {
      ruleKey: 'TECH_CANONICAL_ENFORCE_RULE',
      actionType: 'SET_CANONICAL_URL',
      targetUrl,
      opportunityScore: 92.5,
      riskLevel: 'LEVEL_2_REVIEW_REQUIRED' as const,
      payload: {
        canonicalUrl,
      },
      expectedGainPct: 18.0,
    };

    expect(recommendation.opportunityScore).toBeGreaterThan(90);

    // ----------------------------------------------------
    // STEP 3: APPROVAL CENTER PROPOSAL & APPROVAL (Persisted in DB)
    // ----------------------------------------------------
    const proposed = await ActionApprovalCenter.proposeAction({
      websiteId,
      actionType: recommendation.actionType,
      targetUrl: recommendation.targetUrl,
      ruleKey: recommendation.ruleKey,
      payload: recommendation.payload,
      opportunityScore: recommendation.opportunityScore,
      riskLevel: recommendation.riskLevel,
      proposedBy: 'DIAGNOSIS_RULE_ENGINE',
    });

    expect(proposed.state).toBe('PROPOSED');
    expect(proposed.id).toBeDefined();

    // Verify DB persistence of ActionApprovalRequest
    const dbApprovalReq = await prisma.actionApprovalRequest.findUnique({
      where: { id: proposed.id },
    });
    expect(dbApprovalReq).toBeDefined();
    expect(dbApprovalReq?.state).toBe('PROPOSED');

    // Reviewer Approves the Action
    const approved = await ActionApprovalCenter.approveAction({
      actionId: proposed.id,
      userId: 'usr-seo-lead',
      notes: 'Approved for production WordPress deployment per canonical strategy',
    });

    expect(approved.state).toBe('APPROVED');
    expect(approved.approvedBy).toBe('usr-seo-lead');

    // Verify Transition Log DB persistence
    const transitionLogs = await ActionApprovalCenter.getTransitionLogsAsync(proposed.id);
    expect(transitionLogs.length).toBeGreaterThanOrEqual(1);
    expect(transitionLogs[0].newState).toBe('APPROVED');

    // ----------------------------------------------------
    // STEP 4: QUEUEING FOR WORKER DISPATCH
    // ----------------------------------------------------
    const queued = await ActionApprovalCenter.queueAction(proposed.id, 'DISPATCH_WORKER');
    expect(queued.state).toBe('QUEUED');

    // ----------------------------------------------------
    // STEP 5: EXECUTOR DISPATCH & PRE-STATE SNAPSHOT PERSISTENCE
    // ----------------------------------------------------
    // Execution worker picks up item
    const executionResult = await ActionOrchestrationService.executeAction({
      websiteId,
      actionType: 'SET_CANONICAL_URL',
      targetUrl,
      payload: { canonicalUrl },
      idempotencyKey: `idem-e2e-${Date.now()}`,
      userId: 'usr-worker-01',
      autoVerify: false,
      platform,
    });

    expect(executionResult.success).toBe(true);
    expect(executionResult.actionExecutionId).toBeDefined();
    expect(executionResult.state).toBe(ActionStatus.AWAITING_VERIFICATION);

    // Mark executing in approval center
    await ActionApprovalCenter.markExecuting(proposed.id, executionResult.actionExecutionId, 'usr-worker-01');

    // Verify ActionPreStateSnapshot was persisted in DB
    const dbSnapshot = await prisma.actionPreStateSnapshot.findFirst({
      where: { actionExecutionId: executionResult.actionExecutionId },
    });
    expect(dbSnapshot).toBeDefined();
    expect(dbSnapshot?.websiteId).toBe(websiteId);
    expect(dbSnapshot?.checksum).toBeDefined();

    // ----------------------------------------------------
    // STEP 6: VERIFICATION ENGINE (HTTP / Cheerio DOM Parsing)
    // ----------------------------------------------------
    await ActionApprovalCenter.markVerifying(proposed.id, 'STAGE_1_SYNTHETIC_DOM', 'VERIFIER_BOT');

    const stage1Result = await VerificationEngine.runStage1SyntheticVerification({
      actionExecutionId: executionResult.actionExecutionId,
      websiteId,
      actionType: 'SET_CANONICAL_URL',
      targetUrl,
      expectedState: { canonicalUrl },
      ruleKey: recommendation.ruleKey,
      platform,
    });

    expect(stage1Result.passed).toBe(true);
    expect(stage1Result.status).toBe(ActionStatus.VERIFIED_COMPLETED);
    expect(stage1Result.observedData.canonicalUrl).toBe(canonicalUrl);
    expect(stage1Result.observedData.httpStatus).toBe(200);

    // Verify ActionVerification record in DB
    const dbVerification = await prisma.actionVerification.findFirst({
      where: { actionExecutionId: executionResult.actionExecutionId },
    });
    expect(dbVerification).toBeDefined();
    expect(dbVerification?.isMatch).toBe(true);
    expect(dbVerification?.status).toBe(ActionStatus.VERIFIED_COMPLETED);

    // Mark Verified in approval center
    await ActionApprovalCenter.markVerified(proposed.id, 'VERIFIER_BOT');

    // ----------------------------------------------------
    // STEP 7: WORKER RESTART SURVIVAL & 1-CLICK ROLLBACK
    // ----------------------------------------------------
    // Simulate crash/restart of worker process
    ActionSnapshotService.simulateWorkerRestart();

    // Execute 1-click rollback
    const rollbackResult = await ActionOrchestrationService.rollbackAction({
      actionExecutionId: executionResult.actionExecutionId,
      websiteId,
      userId: 'usr-emergency-rollback',
      reason: 'Reverting per editorial direction and staging validation',
      platform,
    });

    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.restoredState !== undefined).toBe(true);

    // Verify RollbackExecutionHistory was persisted in DB
    const dbRollbackHistories = await prisma.rollbackExecutionHistory.findMany({
      where: { actionExecutionId: executionResult.actionExecutionId },
    });
    expect(dbRollbackHistories.length).toBe(1);
    expect(dbRollbackHistories[0].success).toBe(true);
    expect(dbRollbackHistories[0].actorId).toBe('usr-emergency-rollback');

    // Mark Rolled back in approval center
    const finalItem = await ActionApprovalCenter.markRolledBack(
      proposed.id,
      'Reverting per editorial direction',
      'usr-emergency-rollback'
    );

    expect(finalItem.state).toBe('ROLLED_BACK');

    // Final verification: CMS provider state is restored
    const cmsProvider = CmsProviderRegistry.getProvider(platform);
    const restoredCanonical = await cmsProvider.getCanonicalUrl(targetUrl);
    expect(restoredCanonical).toBeNull();
  });
});
