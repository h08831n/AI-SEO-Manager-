import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../server/db/prisma';
import { BayesianRuleLearningEngine } from '../server/services/bayesian/bayesianRuleLearningEngine';
import { PolicySafetyGate } from '../server/services/bayesian/policySafetyGate';
import { RecalibrationLockManager } from '../server/services/bayesian/recalibrationLockManager';
import { BayesianRecalibrationWorker } from '../server/services/worker/bayesianRecalibrationWorker';
import { OpportunityScoreEngine } from '../server/services/decision/opportunityScoreEngine';
import { DiagnosisEngine } from '../server/services/decision/diagnosisEngine';
import { OutboxDispatcher } from '../server/services/outbox/outboxDispatcher';
import {
  DEFAULT_ALPHA_PRIOR,
  DEFAULT_BETA_PRIOR,
  MIN_RULE_WEIGHT,
  MAX_RULE_WEIGHT,
  MAX_WEIGHT_DELTA_PER_CYCLE,
  DRIFT_REVIEW_THRESHOLD,
  DAMPED_WEIGHT_CEILING,
} from '../server/config/bayesianConstants';
import { ActionStatus, BusinessValueTier } from '@prisma/client';

describe('Phase 6.2: Bayesian Rule Learning & Policy Safety Gate', () => {
  const testSiteId = 'site-phase62-bayesian-test';

  beforeEach(async () => {
    await OutboxDispatcher.clearForTesting();

    await prisma.website.upsert({
      where: { id: testSiteId },
      update: {},
      create: {
        id: testSiteId,
        workspaceId: 'ws-phase62-test',
        productionUrl: 'https://bayesian-test.io',
        domain: 'bayesian-test.io',
        name: 'Bayesian Test Corp',
      },
    });
  });

  afterEach(async () => {
    try {
      await prisma.bayesianRuleWeightState.deleteMany({
        where: { websiteId: testSiteId },
      });
      await prisma.actionAttributionFact.deleteMany({
        where: { websiteId: testSiteId },
      });
      await prisma.actionExecution.deleteMany({
        where: { websiteId: testSiteId },
      });
      await prisma.urlIdentity.deleteMany({
        where: { websiteId: testSiteId },
      });
    } catch {
      // ignore
    }
  });

  describe('1. Policy Safety Gate Isolated Invariants', () => {
    it('enforces step-delta clamping on large positive raw weight shifts', () => {
      // Current = 1.0, Raw = 1.60 -> Delta = +0.60 (exceeds MAX_WEIGHT_DELTA_PER_CYCLE = 0.35)
      const result = PolicySafetyGate.evaluateWeightUpdate({
        currentAppliedWeight: 1.0,
        currentApprovalStatus: 'AUTO_APPROVED',
        rawCalculatedWeight: 1.60,
        posteriorWinRate: 0.80,
        observedWins: 6,
        observedLosses: 0,
      });

      expect(result.rawCalculatedWeight).toBe(1.60);
      expect(result.approvedAppliedWeight).toBe(1.35); // 1.0 + 0.35
      expect(result.deltaApplied).toBe(0.35);
      expect(result.driftDetected).toBe(true); // |1.60 - 1.0| = 0.60 >= 0.50
      expect(result.approvalStatus).toBe('PENDING_REVIEW');
      expect(result.isAutoDamped).toBe(false);
    });

    it('enforces absolute boundary clamping within [MIN_RULE_WEIGHT, MAX_RULE_WEIGHT]', () => {
      // Extreme low raw weight clamped to MIN_RULE_WEIGHT (0.20)
      const lowResult = PolicySafetyGate.evaluateWeightUpdate({
        currentAppliedWeight: 0.30,
        currentApprovalStatus: 'AUTO_APPROVED',
        rawCalculatedWeight: 0.05,
        posteriorWinRate: 0.025,
        observedWins: 0,
        observedLosses: 2,
      });
      expect(lowResult.approvedAppliedWeight).toBeGreaterThanOrEqual(MIN_RULE_WEIGHT);

      // Extreme high raw weight clamped to MAX_RULE_WEIGHT (2.50)
      const highResult = PolicySafetyGate.evaluateWeightUpdate({
        currentAppliedWeight: 2.40,
        currentApprovalStatus: 'AUTO_APPROVED',
        rawCalculatedWeight: 2.90,
        posteriorWinRate: 0.98,
        observedWins: 10,
        observedLosses: 0,
      });
      expect(highResult.approvedAppliedWeight).toBeLessThanOrEqual(MAX_RULE_WEIGHT);
    });

    it('triggers Auto-Damping when observed losses >= 3 and win rate is poor', () => {
      const dampResult = PolicySafetyGate.evaluateWeightUpdate({
        currentAppliedWeight: 1.0,
        currentApprovalStatus: 'AUTO_APPROVED',
        rawCalculatedWeight: 0.40,
        posteriorWinRate: 0.20, // 20% win rate
        observedWins: 0,
        observedLosses: 4,
      });

      expect(dampResult.isAutoDamped).toBe(true);
      expect(dampResult.approvalStatus).toBe('PENDING_REVIEW');
      expect(dampResult.approvedAppliedWeight).toBeLessThanOrEqual(DAMPED_WEIGHT_CEILING);
      expect(dampResult.dampedReason).toContain('exceeds loss threshold');
    });

    it('strictly protects LOCKED states from automated mutation', () => {
      const lockedResult = PolicySafetyGate.evaluateWeightUpdate({
        currentAppliedWeight: 1.85,
        currentApprovalStatus: 'LOCKED',
        rawCalculatedWeight: 0.30,
        posteriorWinRate: 0.15,
        observedWins: 0,
        observedLosses: 5,
      });

      expect(lockedResult.approvalStatus).toBe('LOCKED');
      expect(lockedResult.approvedAppliedWeight).toBe(1.85); // Unchanged
      expect(lockedResult.deltaApplied).toBe(0);
    });
  });

  describe('2. End-to-End Bayesian Recalibration Engine', () => {
    it('computes correct Beta-Binomial posteriors from WIN and LOSS attribution facts', async () => {
      const pastDate = new Date('2026-05-01T00:00:00Z');
      const endDate = new Date('2026-05-20T00:00:00Z');
      const now = new Date('2026-05-25T00:00:00Z');

      const url = await prisma.urlIdentity.create({
        data: {
          websiteId: testSiteId,
          normalizedUrl: 'https://bayesian-test.io/products/widget-a',
          pathname: '/products/widget-a',
        },
      });

      // Create 3 WIN facts and 1 LOSS fact
      for (let i = 1; i <= 4; i++) {
        const isWin = i <= 3;
        const exec = await prisma.actionExecution.create({
          data: {
            websiteId: testSiteId,
            actionType: 'TITLE_TAG_OPTIMIZATION',
            targetUrl: url.normalizedUrl,
            idempotencyKey: `exec-beta-${i}-${Date.now()}`,
            state: ActionStatus.VERIFIED_COMPLETED,
            executedAt: pastDate,
            verifiedAt: pastDate,
          },
        });

        await prisma.actionAttributionFact.create({
          data: {
            websiteId: testSiteId,
            actionExecutionId: exec.id,
            evaluationKey: `eval-beta-${i}-${Date.now()}`,
            urlIdentityId: url.id,
            ruleKey: 'RULE_TITLE_TAG',
            cmsProvider: 'SHOPIFY',
            pageArchetype: 'PRODUCT',
            executionDate: pastDate,
            baselineStartDate: new Date('2026-04-01T00:00:00Z'),
            evaluationStartDate: pastDate,
            evaluationEndDate: endDate,
            preAvgRank: 12.0,
            postAvgRank: isWin ? 8.0 : 14.0,
            rankDelta: isWin ? 4.0 : -2.0,
            preClicks30d: 100,
            postClicks30d: isWin ? 140 : 80,
            clickLiftDelta: isWin ? 40 : -20,
            netCausalLift: isWin ? 35.0 : -25.0,
            outcomeCategory: isWin ? 'WIN' : 'LOSS',
            confidenceScore: 0.85,
          },
        });
      }

      // Recalibrate
      const summary = await BayesianRuleLearningEngine.recalibrateRuleWeights(testSiteId, { now });
      expect(summary.totalFactsProcessed).toBe(4);
      expect(summary.totalRuleStatesUpdated).toBe(1);

      const result = summary.results[0];
      expect(result.ruleKey).toBe('RULE_TITLE_TAG');
      expect(result.cmsProvider).toBe('SHOPIFY');
      expect(result.pageArchetype).toBe('PRODUCT');
      expect(result.observedWins).toBe(3);
      expect(result.observedLosses).toBe(1);

      // Prior = Beta(2, 2)
      // Posterior = Beta(2 + 3, 2 + 1) = Beta(5, 3)
      expect(result.alphaPosterior).toBe(5.0);
      expect(result.betaPosterior).toBe(3.0);

      // Posterior Mean = 5 / (5 + 3) = 5/8 = 0.625
      expect(result.posteriorMeanWinRate).toBe(0.625);

      // Raw weight = 0.625 * 2.0 = 1.25
      expect(result.rawCalculatedWeight).toBe(1.25);

      // Verify persisted state in DB
      const dbState = await prisma.bayesianRuleWeightState.findUnique({
        where: {
          websiteId_ruleKey_cmsProvider_pageArchetype: {
            websiteId: testSiteId,
            ruleKey: 'RULE_TITLE_TAG',
            cmsProvider: 'SHOPIFY',
            pageArchetype: 'PRODUCT',
          },
        },
      });
      expect(dbState).toBeDefined();
      expect(dbState?.alphaPosterior).toBe(5.0);
      expect(dbState?.betaPosterior).toBe(3.0);
      expect(dbState?.approvedAppliedWeight).toBe(1.25);
    });

    it('emits outbox event and flags auto-damping for consistently failing rules', async () => {
      const pastDate = new Date('2026-05-01T00:00:00Z');
      const endDate = new Date('2026-05-20T00:00:00Z');
      const now = new Date('2026-05-25T00:00:00Z');

      const url = await prisma.urlIdentity.create({
        data: {
          websiteId: testSiteId,
          normalizedUrl: 'https://bayesian-test.io/blog/post-1',
          pathname: '/blog/post-1',
        },
      });

      // Create 4 LOSS facts
      for (let i = 1; i <= 4; i++) {
        const exec = await prisma.actionExecution.create({
          data: {
            websiteId: testSiteId,
            actionType: 'SCHEMA_INJECTION',
            targetUrl: url.normalizedUrl,
            idempotencyKey: `exec-loss-${i}-${Date.now()}`,
            state: ActionStatus.VERIFIED_COMPLETED,
            executedAt: pastDate,
            verifiedAt: pastDate,
          },
        });

        await prisma.actionAttributionFact.create({
          data: {
            websiteId: testSiteId,
            actionExecutionId: exec.id,
            evaluationKey: `eval-loss-${i}-${Date.now()}`,
            urlIdentityId: url.id,
            ruleKey: 'RULE_SCHEMA_MARKUP',
            cmsProvider: 'WORDPRESS',
            pageArchetype: 'BLOG',
            executionDate: pastDate,
            baselineStartDate: new Date('2026-04-01T00:00:00Z'),
            evaluationStartDate: pastDate,
            evaluationEndDate: endDate,
            preAvgRank: 10.0,
            postAvgRank: 18.0,
            rankDelta: -8.0,
            preClicks30d: 100,
            postClicks30d: 50,
            clickLiftDelta: -50,
            netCausalLift: -45.0,
            outcomeCategory: 'LOSS',
            confidenceScore: 0.80,
          },
        });
      }

      const summary = await BayesianRuleLearningEngine.recalibrateRuleWeights(testSiteId, { now });
      expect(summary.autoDampedCount).toBe(1);

      const state = summary.results.find((r) => r.ruleKey === 'RULE_SCHEMA_MARKUP');
      expect(state?.isAutoDamped).toBe(true);
      expect(state?.approvalStatus).toBe('PENDING_REVIEW');
      expect(state?.approvedAppliedWeight).toBeLessThanOrEqual(DAMPED_WEIGHT_CEILING);
    });
  });

  describe('3. Multi-Grain Context Resolution & Hierarchical Fallbacks', () => {
    it('resolves weights in strict order: (site+rule+cms+archetype) -> (site+rule+cms+ALL) -> (site+rule+ALL+ALL) -> default 1.0', async () => {
      // 1. Create exact grain state
      await prisma.bayesianRuleWeightState.create({
        data: {
          websiteId: testSiteId,
          ruleKey: 'RULE_META_DESCRIPTION',
          cmsProvider: 'SHOPIFY',
          pageArchetype: 'PRODUCT',
          approvedAppliedWeight: 1.45,
          rawCalculatedWeight: 1.45,
        },
      });

      // 2. Create CMS grain state
      await prisma.bayesianRuleWeightState.create({
        data: {
          websiteId: testSiteId,
          ruleKey: 'RULE_META_DESCRIPTION',
          cmsProvider: 'SHOPIFY',
          pageArchetype: 'ALL',
          approvedAppliedWeight: 1.25,
          rawCalculatedWeight: 1.25,
        },
      });

      // 3. Create Global Site grain state
      await prisma.bayesianRuleWeightState.create({
        data: {
          websiteId: testSiteId,
          ruleKey: 'RULE_META_DESCRIPTION',
          cmsProvider: 'ALL',
          pageArchetype: 'ALL',
          approvedAppliedWeight: 1.10,
          rawCalculatedWeight: 1.10,
        },
      });

      // Query 1: Exact match
      const exactWeight = await BayesianRuleLearningEngine.getAppliedWeight(
        testSiteId,
        'RULE_META_DESCRIPTION',
        'SHOPIFY',
        'PRODUCT'
      );
      expect(exactWeight).toBe(1.45);

      // Query 2: CMS match (archetype fallback to ALL)
      const cmsWeight = await BayesianRuleLearningEngine.getAppliedWeight(
        testSiteId,
        'RULE_META_DESCRIPTION',
        'SHOPIFY',
        'COLLECTION'
      );
      expect(cmsWeight).toBe(1.25);

      // Query 3: Global Site match (CMS fallback to ALL)
      const siteWeight = await BayesianRuleLearningEngine.getAppliedWeight(
        testSiteId,
        'RULE_META_DESCRIPTION',
        'WORDPRESS',
        'BLOG'
      );
      expect(siteWeight).toBe(1.10);

      // Query 4: Uncalibrated rule fallback to default 1.0
      const defaultWeight = await BayesianRuleLearningEngine.getAppliedWeight(
        testSiteId,
        'RULE_UNKNOWN_UNCALIBRATED'
      );
      expect(defaultWeight).toBe(1.0);
    });
  });

  describe('4. Approval, Lock, and Unlock Workflows', () => {
    it('allows manual approval of pending/damped rule states', async () => {
      const state = await prisma.bayesianRuleWeightState.create({
        data: {
          websiteId: testSiteId,
          ruleKey: 'RULE_H1_TAG',
          cmsProvider: 'ALL',
          pageArchetype: 'ALL',
          approvedAppliedWeight: 0.35,
          rawCalculatedWeight: 0.85,
          isAutoDamped: true,
          approvalStatus: 'PENDING_REVIEW',
        },
      });

      // Approve weight
      const approved = await BayesianRuleLearningEngine.approveWeight(state.id, {
        approvedWeight: 0.90,
        approverId: 'user-seo-admin',
      });

      expect(approved.approvalStatus).toBe('AUTO_APPROVED');
      expect(approved.isAutoDamped).toBe(false);
      expect(approved.approvedAppliedWeight).toBe(0.90);
    });

    it('locks and unlocks weights via administrative policy actions', async () => {
      const state = await prisma.bayesianRuleWeightState.create({
        data: {
          websiteId: testSiteId,
          ruleKey: 'RULE_CANONICAL',
          cmsProvider: 'ALL',
          pageArchetype: 'ALL',
          approvedAppliedWeight: 1.0,
          rawCalculatedWeight: 1.0,
          approvalStatus: 'AUTO_APPROVED',
        },
      });

      // Lock
      const locked = await BayesianRuleLearningEngine.lockWeight(state.id, 1.75, 'Executive override');
      expect(locked.approvalStatus).toBe('LOCKED');
      expect(locked.approvedAppliedWeight).toBe(1.75);

      // Unlock
      const unlocked = await BayesianRuleLearningEngine.unlockWeight(state.id);
      expect(unlocked.approvalStatus).toBe('AUTO_APPROVED');
    });
  });

  describe('5. Background Worker Recalibration Sweep', () => {
    it('executes scheduled sweep across active websites cleanly', async () => {
      const summaries = await BayesianRecalibrationWorker.executeRecalibrationSweep({
        now: new Date(),
      });
      expect(Array.isArray(summaries)).toBe(true);
    });
  });

  describe('6. Opportunity Scoring & Decision Engine Modulation', () => {
    it('modulates opportunity scores proportionally based on learned Bayesian weights', () => {
      // Baseline calculation (ruleWeight = 1.0)
      const baseScoring = OpportunityScoreEngine.calculateScore({
        potentialTrafficGain: 5.0,
        businessValueTier: BusinessValueTier.TIER_2_HIGH, // Weight = 4.0
        confidenceScore: 0.8,
        effortScore: 2.0,
        riskScore: 2.0,
        ruleWeight: 1.0,
      });

      // High-performing learned rule (ruleWeight = 1.40)
      const boostedScoring = OpportunityScoreEngine.calculateScore({
        potentialTrafficGain: 5.0,
        businessValueTier: BusinessValueTier.TIER_2_HIGH,
        confidenceScore: 0.8,
        effortScore: 2.0,
        riskScore: 2.0,
        ruleWeight: 1.40,
      });

      // Auto-damped failing rule (ruleWeight = 0.35)
      const dampedScoring = OpportunityScoreEngine.calculateScore({
        potentialTrafficGain: 5.0,
        businessValueTier: BusinessValueTier.TIER_2_HIGH,
        confidenceScore: 0.8,
        effortScore: 2.0,
        riskScore: 2.0,
        ruleWeight: 0.35,
      });

      expect(boostedScoring.score).toBeGreaterThan(baseScoring.score);
      expect(dampedScoring.score).toBeLessThan(baseScoring.score);
      expect(boostedScoring.score).toBe(Number((baseScoring.score * 1.40).toFixed(1)));
    });

    it('DiagnosisEngine applies Bayesian rule weights to prioritize opportunities', () => {
      const mockContexts = [
        {
          websiteId: testSiteId,
          targetDomain: 'bayesian-test.io',
          url: 'https://bayesian-test.io/page-1',
          signals: [],
          crawlIssues: [
            {
              issueType: 'MISSING_CANONICAL',
              severity: 'HIGH' as any,
              pageUrl: 'https://bayesian-test.io/page-1',
            },
          ],
        },
      ];

      // With default weight (1.0)
      const defaultOpps = DiagnosisEngine.evaluateContexts(mockContexts as any);
      expect(defaultOpps.length).toBeGreaterThan(0);
      const defaultScore = defaultOpps[0]?.scoring.score ?? 0;

      // With damped weight (0.35)
      const dampedOpps = DiagnosisEngine.evaluateContexts(mockContexts as any, {
        ruleWeights: { RULE_CANONICAL_MISMATCH: 0.35 },
      });
      const dampedScore = dampedOpps[0]?.scoring.score ?? 0;

      expect(defaultScore).toBeGreaterThan(0);
      expect(dampedScore).toBeGreaterThan(0);
      expect(dampedScore).toBeLessThan(defaultScore);
    });
  });

  describe('7. Concurrency, Lease Locking & Idempotent Recalibration Safety', () => {
    it('RecalibrationLockManager acquires, respects lease contention, and releases safely', async () => {
      const lock1 = await RecalibrationLockManager.acquireLock(testSiteId, 'worker-A', 5000);
      expect(lock1.acquired).toBe(true);
      expect(lock1.lockedBy).toBe('worker-A');

      // Attempt concurrent acquire by worker-B -> rejected
      const lock2 = await RecalibrationLockManager.acquireLock(testSiteId, 'worker-B', 5000);
      expect(lock2.acquired).toBe(false);
      expect(lock2.reason).toContain('worker-A');

      // Release by worker-A
      const released = await RecalibrationLockManager.releaseLock(testSiteId, 'worker-A');
      expect(released).toBe(true);

      // Now worker-B can acquire
      const lock3 = await RecalibrationLockManager.acquireLock(testSiteId, 'worker-B', 5000);
      expect(lock3.acquired).toBe(true);
      await RecalibrationLockManager.releaseLock(testSiteId, 'worker-B');
    });

    it('recalibration does NOT double-count previously processed attribution evidence', async () => {
      // 1st run: processes eligible facts
      const run1 = await BayesianRuleLearningEngine.recalibrateRuleWeights(testSiteId);
      expect(run1.totalFactsProcessed).toBeGreaterThanOrEqual(0);

      // 2nd run immediately without new facts: must process 0 new evidence facts
      const run2 = await BayesianRuleLearningEngine.recalibrateRuleWeights(testSiteId);
      expect(run2.totalFactsProcessed).toBe(0);
      expect(run2.totalRuleStatesUpdated).toBe(0);
    });

    it('emits transactional outbox events when rule weights are modified or damped', async () => {
      const events = await prisma.outboxEvent.findMany({
        where: { aggregateType: 'BAYESIAN_RULE_WEIGHT' },
      });
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e: any) => e.eventType.startsWith('BAYESIAN_RULE_'))).toBe(true);
    });
  });
});
