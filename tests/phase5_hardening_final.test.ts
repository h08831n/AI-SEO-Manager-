import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { prisma } from '../server/db/prisma';
import { CmsProviderRegistry } from '../server/services/action/cms/cmsProviderRegistry';
import { WordPressCmsProvider } from '../server/services/action/cms/wordPressCmsProvider';
import { ShopifyCmsProvider } from '../server/services/action/cms/shopifyCmsProvider';
import { CustomApiCmsProvider } from '../server/services/action/cms/customApiCmsProvider';
import { StaticSiteCmsProvider } from '../server/services/action/cms/staticSiteCmsProvider';
import { ActionSnapshotService } from '../server/services/action/snapshots/actionSnapshotService';
import { VerificationEngine } from '../server/services/action/verificationEngine';
import { LearningLoopEngine } from '../server/services/decision/learningLoopEngine';
import { ActionApprovalCenter } from '../server/services/action/approval/actionApprovalCenter';
import { ActionOrchestrationService } from '../server/services/action/actionOrchestrationService';
import { DiagnosisRuleCatalog } from '../server/services/decision/rules/diagnosisRuleCatalog';
import { ActionStatus } from '@prisma/client';

describe('Phase 5 Final Hardening Acceptance Tests', () => {
  const testWebsiteId = 'site-phase5-hardening-test';

  beforeAll(async () => {
    await prisma.website.upsert({
      where: { id: testWebsiteId },
      update: { domain: 'hardening.techscale.io' },
      create: {
        id: testWebsiteId,
        workspaceId: 'ws-test-default',
        productionUrl: 'https://hardening.techscale.io',
        domain: 'hardening.techscale.io',
        name: 'Phase 5 Hardening Test Site',
      },
    });
  });

  describe('1. ICmsActionProvider Abstraction (WordPress, Shopify, Custom API, Static Site)', () => {
    it('provides all 4 concrete CMS providers with verified ICmsActionProvider interfaces', async () => {
      const platforms = CmsProviderRegistry.getSupportedPlatforms();
      expect(platforms).toContain('WORDPRESS');
      expect(platforms).toContain('SHOPIFY');
      expect(platforms).toContain('CUSTOM_API');
      expect(platforms).toContain('STATIC_SITE');

      const wp = CmsProviderRegistry.getProvider('WORDPRESS');
      const shopify = CmsProviderRegistry.getProvider('SHOPIFY');
      const customApi = CmsProviderRegistry.getProvider('CUSTOM_API');
      const staticSite = CmsProviderRegistry.getProvider('STATIC_SITE');

      expect(wp).toBeInstanceOf(WordPressCmsProvider);
      expect(shopify).toBeInstanceOf(ShopifyCmsProvider);
      expect(customApi).toBeInstanceOf(CustomApiCmsProvider);
      expect(staticSite).toBeInstanceOf(StaticSiteCmsProvider);

      // Verify connection test handshakes
      const wpConn = await wp.testConnection(testWebsiteId, 'hardening.techscale.io');
      expect(wpConn.connected).toBe(true);

      const shopifyConn = await shopify.testConnection(testWebsiteId, 'hardening.techscale.io');
      expect(shopifyConn.connected).toBe(true);
    });

    it('executes atomic operations and rollbacks across all CMS providers uniformly', async () => {
      const providers = [
        CmsProviderRegistry.getProvider('WORDPRESS'),
        CmsProviderRegistry.getProvider('SHOPIFY'),
        CmsProviderRegistry.getProvider('CUSTOM_API'),
        CmsProviderRegistry.getProvider('STATIC_SITE'),
      ];

      for (const provider of providers) {
        const testUrl = `https://hardening.techscale.io/provider-test-${provider.platform.toLowerCase()}`;

        // 1. Canonical operations
        const setCanon = await provider.setCanonicalUrl(testUrl, `${testUrl}/`);
        expect(setCanon.success).toBe(true);
        expect(await provider.getCanonicalUrl(testUrl)).toBe(`${testUrl}/`);

        await provider.revertCanonicalUrl(testUrl, null);
        expect(await provider.getCanonicalUrl(testUrl)).toBeNull();

        // 2. Meta Tags operations
        const setMeta = await provider.setMetaTags(testUrl, {
          title: `Optimized Title [${provider.platform}]`,
          description: 'High CTR description test',
        });
        expect(setMeta.success).toBe(true);
        const meta = await provider.getMetaTags(testUrl);
        expect(meta.title).toBe(`Optimized Title [${provider.platform}]`);

        // 3. Redirect operations
        const setRedirect = await provider.createRedirectRule(testUrl, 'https://hardening.techscale.io/new-dest', 301);
        expect(setRedirect.success).toBe(true);
        const rule = await provider.getRedirectRule(testUrl);
        expect(rule?.destinationUrl).toBe('https://hardening.techscale.io/new-dest');
        expect(rule?.statusCode).toBe(301);
      }
    });
  });

  describe('2. Persistent Action State Snapshots & Worker Restart Survival', () => {
    it('persists ActionPreStateSnapshot to durable storage and restores after simulated worker restart', async () => {
      const actionExecutionId = `exec-persist-snap-${Date.now()}`;
      const targetUrl = 'https://hardening.techscale.io/products/kubernetes';

      // 1. Create ActionExecution in DB
      await prisma.actionExecution.create({
        data: {
          id: actionExecutionId,
          websiteId: testWebsiteId,
          actionType: 'SET_META_TAGS',
          targetUrl,
          idempotencyKey: `idemp-snap-${Date.now()}`,
          state: ActionStatus.EXECUTING,
          beforeEvidenceJson: JSON.stringify({
            title: 'Original Kubernetes Platform',
            description: 'Old meta description',
          }),
        },
      });

      // 2. Persist Snapshot with SHA-256 Checksum
      const savedSnapshot = await ActionSnapshotService.savePreStateSnapshot({
        actionExecutionId,
        websiteId: testWebsiteId,
        actionType: 'SET_META_TAGS',
        targetUrl,
        preState: {
          title: 'Original Kubernetes Platform',
          description: 'Old meta description',
        },
      });

      expect(savedSnapshot.checksum).toBeDefined();
      expect(savedSnapshot.checksum.length).toBe(64); // SHA-256 hex length

      // 3. Simulate Worker Restart (clearing in-memory cache)
      ActionSnapshotService.simulateWorkerRestart();

      // 4. Retrieve Snapshot after restart -> must recover cleanly from durable DB
      const recovered = await ActionSnapshotService.getPreStateSnapshot(actionExecutionId);
      expect(recovered).not.toBeNull();
      expect(recovered?.actionExecutionId).toBe(actionExecutionId);
      const parsedPreState = JSON.parse(recovered!.preStateJson);
      expect(parsedPreState.title).toBe('Original Kubernetes Platform');

      // 5. Execute 1-click rollback using restored snapshot
      const rollback = await ActionOrchestrationService.rollbackAction({
        actionExecutionId,
        websiteId: testWebsiteId,
        reason: 'Rollback post worker restart verification',
      });
      expect(rollback.success).toBe(true);

      // 6. Verify RollbackExecutionHistory recorded
      const history = await ActionSnapshotService.getRollbackHistory(testWebsiteId);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].actionExecutionId).toBe(actionExecutionId);
    });
  });

  describe('3. Hardened 3-Stage VerificationEngine', () => {
    it('executes Stage 1: Synthetic HTTP / DOM / Schema verification', async () => {
      const actionExecutionId = `exec-stage1-${Date.now()}`;
      const targetUrl = 'https://hardening.techscale.io/features/api';

      await prisma.actionExecution.create({
        data: {
          id: actionExecutionId,
          websiteId: testWebsiteId,
          actionType: 'SET_CANONICAL_URL',
          targetUrl,
          idempotencyKey: `idemp-stage1-${Date.now()}`,
          state: ActionStatus.AWAITING_VERIFICATION,
        },
      });

      // Set state in CMS
      const wp = CmsProviderRegistry.getProvider('WORDPRESS');
      await wp.setCanonicalUrl(targetUrl, `${targetUrl}/`);

      const stage1 = await VerificationEngine.runStage1SyntheticVerification({
        actionExecutionId,
        websiteId: testWebsiteId,
        actionType: 'SET_CANONICAL_URL',
        targetUrl,
        expectedState: { canonicalUrl: `${targetUrl}/` },
      });

      expect(stage1.stage).toBe('STAGE_1_SYNTHETIC_DOM');
      expect(stage1.passed).toBe(true);
      expect(stage1.status).toBe(ActionStatus.VERIFIED_COMPLETED);
    });

    it('executes Stage 2: GSC Index + SERP verification', async () => {
      const actionExecutionId = `exec-stage2-${Date.now()}`;

      const stage2 = await VerificationEngine.runStage2IndexSerpVerification({
        actionExecutionId,
        websiteId: testWebsiteId,
        targetUrl: 'https://hardening.techscale.io/features/api',
        gscIndexed: true,
        serpFeaturePresent: true,
        aiOverviewCited: true,
      });

      expect(stage2.stage).toBe('STAGE_2_INDEX_SERP');
      expect(stage2.passed).toBe(true);
      expect(stage2.observedData.gscIndexState).toBe('SUBMITTED_AND_INDEXED');
      expect(stage2.observedData.aiOverviewCited).toBe(true);
    });

    it('executes Stage 3: Traffic / Rank / Conversion impact verification', async () => {
      const actionExecutionId = `exec-stage3-${Date.now()}`;
      const ruleKey = 'RULE_TITLE_CTR_UNDERPERFORMER';

      const stage3 = await VerificationEngine.runStage3ImpactVerification({
        actionExecutionId,
        websiteId: testWebsiteId,
        ruleKey,
        preClicks: 500,
        postClicks: 625, // +25% lift
        preRank: 5.2,
        postRank: 3.1, // +2.1 rank improvement
        preConversions: 40,
        postConversions: 55, // +37.5% conversion lift
      });

      expect(stage3.stage).toBe('STAGE_3_TRAFFIC_CONVERSION');
      expect(stage3.impactPositive).toBe(true);
      expect(stage3.clicksLiftPct).toBe(25.0);
      expect(stage3.rankDelta).toBeCloseTo(2.1, 1);
    });
  });

  describe('4. Expanded LearningLoopEngine Persistence', () => {
    it('persists Prediction, Confidence, Action, Expected Outcome, Actual Outcome, Learning Delta, and Rule Effectiveness', async () => {
      const ruleKey = 'RULE_AI_OVERVIEW_DISPLACEMENT';

      const { profile, learningRecord } = await LearningLoopEngine.recordActionOutcome({
        ruleKey,
        websiteId: testWebsiteId,
        actionType: 'INJECT_STRUCTURED_DATA',
        outcome: 'SUCCESS',
        metricDeltaPct: 22.4,
        confidence: 0.94,
        prediction: {
          hypothesis: 'FAQ schema injection captures AI Overview citation',
          expectedGainPct: 15.0,
          targetMetric: 'CLICKS',
        },
        expectedOutcome: {
          clicksLiftPct: 15.0,
          indexationConfirmed: true,
        },
        actualOutcome: {
          passed: true,
          clicksLiftPct: 22.4,
          stage: 'STAGE_3_TRAFFIC_CONVERSION',
        },
      });

      // Verify all 7 required fields are persisted
      expect(learningRecord.prediction.hypothesis).toContain('FAQ schema');
      expect(learningRecord.confidence).toBeGreaterThan(0.5);
      expect(learningRecord.action.actionType).toBe('INJECT_STRUCTURED_DATA');
      expect(learningRecord.expectedOutcome.clicksLiftPct).toBe(15.0);
      expect(learningRecord.actualOutcome.clicksLiftPct).toBe(22.4);
      expect(learningRecord.learningDelta.variancePct).toBe(7.4); // 22.4 - 15.0 = +7.4
      expect(learningRecord.ruleEffectiveness.successRate).toBe(1.0);

      // Verify retrieval
      const records = LearningLoopEngine.getLearningRecords(ruleKey);
      expect(records.length).toBeGreaterThan(0);
      expect(records[records.length - 1].id).toBe(learningRecord.id);
    });
  });

  describe('5. Action Approval Center State Machine & Backend Contracts', () => {
    it('enforces full lifecycle: PROPOSED -> APPROVED -> QUEUED -> EXECUTING -> VERIFYING -> VERIFIED -> ROLLED_BACK', async () => {
      // 1. Propose
      const proposed = await ActionApprovalCenter.proposeAction({
        websiteId: testWebsiteId,
        actionType: 'CREATE_REDIRECT_RULE',
        targetUrl: 'https://hardening.techscale.io/old-404-page',
        payload: { sourceUrl: 'https://hardening.techscale.io/old-404-page', destinationUrl: 'https://hardening.techscale.io/new-hub' },
        opportunityScore: 88,
        riskLevel: 'LEVEL_2_REVIEW_REQUIRED',
      });
      expect(proposed.state).toBe('PROPOSED');

      // 2. Approve
      const approved = await ActionApprovalCenter.approveAction({
        actionId: proposed.id,
        userId: 'usr-seo-lead-01',
        notes: 'Verified redirect target is semantically equivalent',
      });
      expect(approved.state).toBe('APPROVED');
      expect(approved.approvedBy).toBe('usr-seo-lead-01');

      // 3. Queue
      const queued = await ActionApprovalCenter.queueAction(proposed.id);
      expect(queued.state).toBe('QUEUED');

      // 4. Executing
      const executing = await ActionApprovalCenter.markExecuting(proposed.id, `exec-${Date.now()}`);
      expect(executing.state).toBe('EXECUTING');

      // 5. Verifying
      const verifying = await ActionApprovalCenter.markVerifying(proposed.id, 'STAGE_1_SYNTHETIC_DOM');
      expect(verifying.state).toBe('VERIFYING');

      // 6. Verified
      const verified = await ActionApprovalCenter.markVerified(proposed.id);
      expect(verified.state).toBe('VERIFIED');

      // 7. Rolled Back (1-Click)
      const rolledBack = await ActionApprovalCenter.markRolledBack(proposed.id, 'Manual rollback test');
      expect(rolledBack.state).toBe('ROLLED_BACK');

      // Verify full transition logs audit trail
      const logs = await ActionApprovalCenter.getTransitionLogs(proposed.id);
      expect(logs.length).toBe(6);
    });

    it('rejects invalid state machine transitions', async () => {
      const item = await ActionApprovalCenter.proposeAction({
        websiteId: testWebsiteId,
        actionType: 'SET_CANONICAL_URL',
        targetUrl: 'https://hardening.techscale.io/invalid-trans',
        payload: {},
      });

      // Directly jumping from PROPOSED to VERIFIED must throw
      await expect(ActionApprovalCenter.markVerified(item.id)).rejects.toThrow(
        /Invalid Action Approval state transition/
      );
    });
  });

  describe('6. CONTENT_REFRESH_ACTION Safe Recommendation Architecture', () => {
    it('synthesizes safe content refresh recommendation package without autonomous AI publishing', async () => {
      const rule = DiagnosisRuleCatalog.findRule('RULE_DECAYING_CONTENT_REFRESH');
      expect(rule).toBeDefined();

      const context = {
        websiteId: testWebsiteId,
        targetDomain: 'hardening.techscale.io',
        url: 'https://hardening.techscale.io/guide/kubernetes-scaling',
        keyword: 'kubernetes scaling guide',
        signals: [
          {
            metricName: 'TRAFFIC_DECAY',
            metadata: { issueType: 'CONTENT_DECAY' },
          },
        ],
        gscMetrics: {
          clicks: 25,
          impressions: 1200,
          ctr: 0.02,
          avgPosition: 9.4,
        },
      };

      expect(rule!.applies(context as any)).toBe(true);
      const diagnosis = rule!.diagnose(context as any);
      expect(diagnosis).not.toBeNull();
      expect(diagnosis!.recommendedActionType).toBe('CONTENT_REFRESH_ACTION');

      // Execute via ContentRefreshActionExecutor
      const target = {
        websiteId: testWebsiteId,
        targetUrl: context.url,
        domain: context.targetDomain,
      };

      const result = await ActionOrchestrationService.executeAction({
        websiteId: testWebsiteId,
        actionType: 'CONTENT_REFRESH_ACTION',
        targetUrl: context.url,
        payload: diagnosis!.actionPayload,
        idempotencyKey: `idemp-cr-${Date.now()}`,
        autoVerify: true,
      });

      expect(result.success).toBe(true);
      expect(result.appliedState.status).toBe('STAGED_FOR_HUMAN_REVIEW');
      expect(result.appliedState.isAiAutoPublished).toBe(false);
      expect(result.appliedState.readyForPublish).toBe(false);
      expect(result.appliedState.suggestedHeadings.length).toBeGreaterThan(0);
    });
  });
});
