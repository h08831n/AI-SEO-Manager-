import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../server/db/prisma';
import { SyntheticControlEngine } from '../server/services/attribution/syntheticControlEngine';
import { CausalAttributionEngine } from '../server/services/attribution/causalAttributionEngine';
import { PolicySafetyGate } from '../server/services/bayesian/policySafetyGate';
import { RuleWeightResolver } from '../server/services/bayesian/ruleWeightResolver';
import { ActionExecutionPipeline } from '../server/services/action/actionExecutionPipeline';
import { MAX_POLICY_CHANGE_PER_CYCLE, MINIMUM_EVIDENCE_THRESHOLD } from '../server/config/bayesianConstants';
import { MIN_CONTROL_SIMILARITY, MIN_CONTROL_HISTORY_DAYS } from '../server/config/attributionConstants';

describe('P0 Closed-Loop Hardening Verification Suite', () => {
  const testSiteId = 'site-hardening-p0-test';

  beforeEach(async () => {
    await prisma.website.upsert({
      where: { id: testSiteId },
      update: { domain: 'hardening-test.com' },
      create: {
        id: testSiteId,
        domain: 'hardening-test.com',
        businessCategory: 'SaaS',
        riskTier: 'STANDARD',
        autonomyMode: 'ASSISTED',
      },
    });
  });

  describe('1. Synthetic Control Engine Hardening', () => {
    it('enforces MIN_CONTROL_SIMILARITY >= 0.50 and rejects poor synthetic twins', () => {
      expect(MIN_CONTROL_SIMILARITY).toBe(0.50);
      expect(MIN_CONTROL_HISTORY_DAYS).toBe(14);

      // Construct treatment with increasing traffic and control candidates with divergent patterns
      const treatmentMetrics = Array.from({ length: 14 }, (_, i) => ({
        date: new Date(Date.now() - (14 - i) * 86400000).toISOString().split('T')[0],
        clicks: 1000 + i * 100,
        impressions: 10000 + i * 1000,
      }));

      // Candidate with inverted correlation (decreasing traffic)
      const candidateMetrics = [
        {
          url: 'https://example.com/bad-control',
          metrics: Array.from({ length: 14 }, (_, i) => ({
            date: new Date(Date.now() - (14 - i) * 86400000).toISOString().split('T')[0],
            clicks: 500 - i * 30,
            impressions: 5000 - i * 300,
          })),
        },
      ];

      const result = SyntheticControlEngine.selectSyntheticControl({
        treatmentUrl: 'https://example.com/target',
        treatmentPreHistory: treatmentMetrics,
        candidatePool: candidateMetrics,
      });

      // Similarity is negative / below 0.50, so control selection should reject candidate pool
      expect(result.isValidControl).toBe(false);
      expect(result.similarityScore).toBeLessThan(MIN_CONTROL_SIMILARITY);
    });
  });

  describe('2. Normalized Causal Attribution Lift Calculations', () => {
    it('normalizes metrics to 30-day equivalent to avoid window duration bias', () => {
      const treatmentWindow = {
        preMetrics: { clicks: 100, impressions: 1000 },
        postMetrics: { clicks: 200, impressions: 2000 },
        windowDays: 10,
      };

      const controlWindow = {
        preMetrics: { clicks: 100, impressions: 1000 },
        postMetrics: { clicks: 100, impressions: 1000 },
        windowDays: 10,
      };

      const attribution = CausalAttributionEngine.calculateLift({
        treatmentWindow,
        controlWindow,
        similarityScore: 0.85,
      });

      expect(attribution.isValid).toBe(true);
      expect(attribution.liftAbsoluteClicks).toBeGreaterThan(0);
      expect(attribution.liftPctClicks).toBe(1.0); // 100% relative lift
    });
  });

  describe('3. Bayesian Rule Learning Safety Gates', () => {
    it('enforces MAX_POLICY_CHANGE_PER_CYCLE = 0.15 clamp and MINIMUM_EVIDENCE_THRESHOLD = 10', () => {
      expect(MAX_POLICY_CHANGE_PER_CYCLE).toBe(0.15);
      expect(MINIMUM_EVIDENCE_THRESHOLD).toBe(10);

      // Low evidence test (5 samples < 10 threshold) -> should reject automated mutation
      const lowEvidenceGate = PolicySafetyGate.evaluateWeightAdjustment({
        ruleKey: 'TITLE_OPTIMIZATION',
        currentWeight: 1.0,
        proposedWeight: 1.25,
        alphaPosterior: 4,
        betaPosterior: 3, // Total evidence = 7 < 10
        minEvidenceThreshold: 10,
      });

      expect(lowEvidenceGate.isApproved).toBe(false);
      expect(lowEvidenceGate.appliedWeight).toBe(1.0);
      expect(lowEvidenceGate.rejectionReason).toContain('INSUFFICIENT_EVIDENCE');

      // High evidence test with excessive delta (+0.40) -> should clamp to +0.15
      const clampedGate = PolicySafetyGate.evaluateWeightAdjustment({
        ruleKey: 'TITLE_OPTIMIZATION',
        currentWeight: 1.0,
        proposedWeight: 1.40,
        alphaPosterior: 15,
        betaPosterior: 5, // Total evidence = 20 > 10
        minEvidenceThreshold: 10,
      });

      expect(clampedGate.isApproved).toBe(true);
      expect(clampedGate.wasClamped).toBe(true);
      expect(clampedGate.appliedWeight).toBeCloseTo(1.15, 2);
    });
  });

  describe('4. RuleWeightResolver Fail-Closed Behavior in Production', () => {
    it('fails closed when database query errors in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const findManySpy = vi.spyOn(prisma.bayesianRuleWeightState, 'findMany').mockRejectedValueOnce(
        new Error('Database cluster connection failure')
      );

      try {
        await expect(
          RuleWeightResolver.resolveEffectiveWeight({
            ruleKey: 'NON_EXISTENT_RULE_123',
            websiteId: testSiteId,
            pageArchetype: 'PRODUCT',
          })
        ).rejects.toThrow(/POLICY_STATE_UNAVAILABLE/);
      } finally {
        process.env.NODE_ENV = originalEnv;
        findManySpy.mockRestore();
      }
    });
  });

  describe('5. Authoritative Action Execution Pipeline Risk & Autonomy Killswitch', () => {
    it('classifies risk levels deterministically', () => {
      expect(ActionExecutionPipeline.classifyRisk('INJECT_REDIRECT_RULE', {})).toBe('CRITICAL');
      expect(ActionExecutionPipeline.classifyRisk('UPDATE_ROBOTS_TXT', { robotsMeta: 'noindex, nofollow' })).toBe('CRITICAL');
      expect(ActionExecutionPipeline.classifyRisk('CANONICAL_URL_CHANGE', {})).toBe('HIGH');
      expect(ActionExecutionPipeline.classifyRisk('INTERNAL_LINK_INJECTION', {})).toBe('MEDIUM');
      expect(ActionExecutionPipeline.classifyRisk('TITLE_TAG_OPTIMIZATION', {})).toBe('LOW');
    });

    it('blocks AUTONOMOUS execution when global autonomy killswitch is active', async () => {
      const originalFlag = process.env.AUTONOMOUS_EXECUTION_ENABLED;
      process.env.AUTONOMOUS_EXECUTION_ENABLED = 'false';

      try {
        await expect(
          ActionExecutionPipeline.execute({
            websiteId: testSiteId,
            actionType: 'TITLE_TAG_OPTIMIZATION',
            targetUrl: 'https://hardening-test.com/page',
            payload: { title: 'New Title' },
            idempotencyKey: `test-idem-${Date.now()}`,
            executionMode: 'AUTONOMOUS',
          })
        ).rejects.toThrow(/AUTONOMY_DISABLED/);
      } finally {
        process.env.AUTONOMOUS_EXECUTION_ENABLED = originalFlag;
      }
    });
  });
});
