/**
 * Phase 6.2 Bayesian Rule Learning Engine
 * 
 * Implements Beta-Binomial conjugate updating across multi-grain SEO rule execution outcomes,
 * paired with the Policy Safety Gate to manage rule confidence weights safely.
 */

import { prisma } from '../../db/prisma';
import { BayesianInputBoundary, EligibleBayesianFact } from './bayesianInputBoundary';
import { PolicySafetyGate, PolicyGateEvaluationResult } from './policySafetyGate';
import { OutboxDispatcher } from '../outbox/outboxDispatcher';
import {
  DEFAULT_ALPHA_PRIOR,
  DEFAULT_BETA_PRIOR,
  BayesianApprovalStatus,
} from '../../config/bayesianConstants';

export interface BayesianRecalibrationResult {
  websiteId: string;
  ruleKey: string;
  cmsProvider: string;
  pageArchetype: string;
  alphaPrior: number;
  betaPrior: number;
  observedWins: number;
  observedLosses: number;
  alphaPosterior: number;
  betaPosterior: number;
  posteriorMeanWinRate: number;
  posteriorVariance: number;
  rawCalculatedWeight: number;
  approvedAppliedWeight: number;
  approvalStatus: BayesianApprovalStatus;
  isAutoDamped: boolean;
  dampedReason?: string | null;
  driftDetected: boolean;
}

export interface RecalibrationSummary {
  websiteId?: string;
  totalFactsProcessed: number;
  totalRuleStatesUpdated: number;
  autoDampedCount: number;
  pendingReviewCount: number;
  results: BayesianRecalibrationResult[];
}

export class BayesianRuleLearningEngine {
  /**
   * Recalibrates Bayesian rule weights based on eligible attribution facts.
   */
  public static async recalibrateRuleWeights(
    websiteId?: string,
    options?: { now?: Date }
  ): Promise<RecalibrationSummary> {
    const eligibleFacts = await BayesianInputBoundary.fetchEligibleAttributionFacts(websiteId, {
      now: options?.now,
    });

    // Group facts by composite grain: (websiteId, ruleKey, cmsProvider, pageArchetype)
    const groupedFacts = new Map<string, EligibleBayesianFact[]>();

    for (const fact of eligibleFacts) {
      const siteId = fact.websiteId;
      const ruleKey = fact.ruleKey;
      const cms = fact.cmsProvider || 'ALL';
      const archetype = fact.pageArchetype || 'ALL';

      const key = `${siteId}::${ruleKey}::${cms}::${archetype}`;
      if (!groupedFacts.has(key)) {
        groupedFacts.set(key, []);
      }
      groupedFacts.get(key)!.push(fact);
    }

    const results: BayesianRecalibrationResult[] = [];
    let autoDampedCount = 0;
    let pendingReviewCount = 0;

    for (const [grainKey, facts] of groupedFacts.entries()) {
      const [siteId, ruleKey, cms, archetype] = grainKey.split('::');

      // Fetch or initialize rule state
      let existingState = await prisma.bayesianRuleWeightState.findUnique({
        where: {
          websiteId_ruleKey_cmsProvider_pageArchetype: {
            websiteId: siteId,
            ruleKey,
            cmsProvider: cms,
            pageArchetype: archetype,
          },
        },
      });

      const alphaPrior = existingState?.alphaPrior ?? DEFAULT_ALPHA_PRIOR;
      const betaPrior = existingState?.betaPrior ?? DEFAULT_BETA_PRIOR;
      const currentAppliedWeight = existingState?.approvedAppliedWeight ?? 1.0;
      const currentStatus = (existingState?.approvalStatus as BayesianApprovalStatus) ?? 'AUTO_APPROVED';
      const isCurrentlyDamped = existingState?.isAutoDamped ?? false;

      // Count wins and losses from eligible facts
      const observedWins = facts.filter((f) => f.outcomeCategory === 'WIN').length;
      const observedLosses = facts.filter((f) => f.outcomeCategory === 'LOSS').length;

      // Beta-Binomial conjugate posterior update
      const alphaPosterior = Number((alphaPrior + observedWins).toFixed(3));
      const betaPosterior = Number((betaPrior + observedLosses).toFixed(3));
      const totalPosteriorStrength = alphaPosterior + betaPosterior;

      // Posterior mean win probability: mu = alpha / (alpha + beta)
      const posteriorMeanWinRate = Number((alphaPosterior / totalPosteriorStrength).toFixed(4));

      // Posterior variance: sigma^2 = (alpha * beta) / ((alpha + beta)^2 * (alpha + beta + 1))
      const posteriorVariance = Number(
        (
          (alphaPosterior * betaPosterior) /
          (Math.pow(totalPosteriorStrength, 2) * (totalPosteriorStrength + 1))
        ).toFixed(6)
      );

      // Raw calculated weight (normalized: win rate 0.50 -> 1.0)
      const rawCalculatedWeight = Number((posteriorMeanWinRate * 2.0).toFixed(3));

      // Pass through Policy Safety Gate
      const policyDecision: PolicyGateEvaluationResult = PolicySafetyGate.evaluateWeightUpdate({
        currentAppliedWeight,
        currentApprovalStatus: currentStatus,
        rawCalculatedWeight,
        posteriorWinRate: posteriorMeanWinRate,
        observedWins,
        observedLosses,
        isCurrentlyDamped,
      });

      if (policyDecision.isAutoDamped) {
        autoDampedCount++;
      }
      if (policyDecision.approvalStatus === 'PENDING_REVIEW') {
        pendingReviewCount++;
      }

      const now = options?.now ?? new Date();

      // Upsert BayesianRuleWeightState
      const updatedRecord = await prisma.bayesianRuleWeightState.upsert({
        where: {
          websiteId_ruleKey_cmsProvider_pageArchetype: {
            websiteId: siteId,
            ruleKey,
            cmsProvider: cms,
            pageArchetype: archetype,
          },
        },
        update: {
          alphaPrior,
          betaPrior,
          observedWins,
          observedLosses,
          alphaPosterior,
          betaPosterior,
          rawCalculatedWeight: policyDecision.rawCalculatedWeight,
          approvedAppliedWeight: policyDecision.approvedAppliedWeight,
          isAutoDamped: policyDecision.isAutoDamped,
          approvalStatus: policyDecision.approvalStatus,
          lastEvaluatedAt: now,
          lastApprovedAt:
            policyDecision.approvalStatus === 'AUTO_APPROVED' ? now : existingState?.lastApprovedAt ?? now,
        },
        create: {
          websiteId: siteId,
          ruleKey,
          cmsProvider: cms,
          pageArchetype: archetype,
          alphaPrior,
          betaPrior,
          observedWins,
          observedLosses,
          alphaPosterior,
          betaPosterior,
          rawCalculatedWeight: policyDecision.rawCalculatedWeight,
          approvedAppliedWeight: policyDecision.approvedAppliedWeight,
          isAutoDamped: policyDecision.isAutoDamped,
          approvalStatus: policyDecision.approvalStatus,
          lastEvaluatedAt: now,
          lastApprovedAt: now,
        },
      });

      const resultItem: BayesianRecalibrationResult = {
        websiteId: siteId,
        ruleKey,
        cmsProvider: cms,
        pageArchetype: archetype,
        alphaPrior,
        betaPrior,
        observedWins,
        observedLosses,
        alphaPosterior,
        betaPosterior,
        posteriorMeanWinRate,
        posteriorVariance,
        rawCalculatedWeight: policyDecision.rawCalculatedWeight,
        approvedAppliedWeight: policyDecision.approvedAppliedWeight,
        approvalStatus: policyDecision.approvalStatus,
        isAutoDamped: policyDecision.isAutoDamped,
        dampedReason: policyDecision.dampedReason,
        driftDetected: policyDecision.driftDetected,
      };

      results.push(resultItem);

      // Emit Outbox event
      const eventType = policyDecision.isAutoDamped
        ? 'BAYESIAN_RULE_AUTO_DAMPED'
        : 'BAYESIAN_RULE_WEIGHT_UPDATED';

      await OutboxDispatcher.recordEvent({
        aggregateType: 'BAYESIAN_RULE_WEIGHT',
        aggregateId: updatedRecord.id,
        eventType,
        payload: {
          ...resultItem,
          stateId: updatedRecord.id,
          recalibratedAt: now.toISOString(),
        },
      });
    }

    return {
      websiteId,
      totalFactsProcessed: eligibleFacts.length,
      totalRuleStatesUpdated: results.length,
      autoDampedCount,
      pendingReviewCount,
      results,
    };
  }

  /**
   * Resolves the applied Bayesian multiplier weight for a specific execution context with hierarchical fallback.
   * Hierarchy:
   * 1. (websiteId, ruleKey, cmsProvider, pageArchetype)
   * 2. (websiteId, ruleKey, cmsProvider, 'ALL')
   * 3. (websiteId, ruleKey, 'ALL', 'ALL')
   * 4. 1.0 (default uncalibrated base weight)
   */
  public static async getAppliedWeight(
    websiteId: string,
    ruleKey: string,
    cmsProvider?: string,
    pageArchetype?: string
  ): Promise<number> {
    const cms = cmsProvider || 'ALL';
    const archetype = pageArchetype || 'ALL';

    // 1. Exact match
    if (cms !== 'ALL' || archetype !== 'ALL') {
      const exactState = await prisma.bayesianRuleWeightState.findUnique({
        where: {
          websiteId_ruleKey_cmsProvider_pageArchetype: {
            websiteId,
            ruleKey,
            cmsProvider: cms,
            pageArchetype: archetype,
          },
        },
      });
      if (exactState) {
        return exactState.approvedAppliedWeight;
      }
    }

    // 2. CMS match, Archetype ALL
    if (cms !== 'ALL') {
      const cmsState = await prisma.bayesianRuleWeightState.findUnique({
        where: {
          websiteId_ruleKey_cmsProvider_pageArchetype: {
            websiteId,
            ruleKey,
            cmsProvider: cms,
            pageArchetype: 'ALL',
          },
        },
      });
      if (cmsState) {
        return cmsState.approvedAppliedWeight;
      }
    }

    // 3. Global site rule match
    const siteState = await prisma.bayesianRuleWeightState.findUnique({
      where: {
        websiteId_ruleKey_cmsProvider_pageArchetype: {
          websiteId,
          ruleKey,
          cmsProvider: 'ALL',
          pageArchetype: 'ALL',
        },
      },
    });
    if (siteState) {
      return siteState.approvedAppliedWeight;
    }

    // 4. Default fallback
    return 1.0;
  }

  /**
   * Approves a pending or damped rule weight, transitioning status to AUTO_APPROVED.
   */
  public static async approveWeight(
    id: string,
    options?: { approvedWeight?: number; approverId?: string }
  ): Promise<any> {
    const existing = await prisma.bayesianRuleWeightState.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error(`BayesianRuleWeightState not found for id: ${id}`);
    }

    const appliedWeight = options?.approvedWeight ?? existing.rawCalculatedWeight;
    const now = new Date();

    const updated = await prisma.bayesianRuleWeightState.update({
      where: { id },
      data: {
        approvedAppliedWeight: appliedWeight,
        approvalStatus: 'AUTO_APPROVED',
        isAutoDamped: false,
        lastApprovedAt: now,
      },
    });

    await OutboxDispatcher.recordEvent({
      aggregateType: 'BAYESIAN_RULE_WEIGHT',
      aggregateId: updated.id,
      eventType: 'BAYESIAN_RULE_WEIGHT_APPROVED',
      payload: {
        id: updated.id,
        websiteId: updated.websiteId,
        ruleKey: updated.ruleKey,
        approvedAppliedWeight: appliedWeight,
        approverId: options?.approverId || 'system',
        approvedAt: now.toISOString(),
      },
    });

    return updated;
  }

  /**
   * Locks a rule weight at a specific constant value, preventing automated updates.
   */
  public static async lockWeight(id: string, lockValue: number, reason?: string): Promise<any> {
    const existing = await prisma.bayesianRuleWeightState.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error(`BayesianRuleWeightState not found for id: ${id}`);
    }

    const now = new Date();
    const updated = await prisma.bayesianRuleWeightState.update({
      where: { id },
      data: {
        approvedAppliedWeight: lockValue,
        approvalStatus: 'LOCKED',
        lastApprovedAt: now,
      },
    });

    await OutboxDispatcher.recordEvent({
      aggregateType: 'BAYESIAN_RULE_WEIGHT',
      aggregateId: updated.id,
      eventType: 'BAYESIAN_RULE_WEIGHT_LOCKED',
      payload: {
        id: updated.id,
        websiteId: updated.websiteId,
        ruleKey: updated.ruleKey,
        lockValue,
        reason: reason || 'Manual policy lock',
        lockedAt: now.toISOString(),
      },
    });

    return updated;
  }

  /**
   * Unlocks a locked rule weight, returning it to AUTO_APPROVED.
   */
  public static async unlockWeight(id: string): Promise<any> {
    const existing = await prisma.bayesianRuleWeightState.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new Error(`BayesianRuleWeightState not found for id: ${id}`);
    }

    const now = new Date();
    const updated = await prisma.bayesianRuleWeightState.update({
      where: { id },
      data: {
        approvalStatus: 'AUTO_APPROVED',
        lastApprovedAt: now,
      },
    });

    await OutboxDispatcher.recordEvent({
      aggregateType: 'BAYESIAN_RULE_WEIGHT',
      aggregateId: updated.id,
      eventType: 'BAYESIAN_RULE_WEIGHT_UNLOCKED',
      payload: {
        id: updated.id,
        websiteId: updated.websiteId,
        ruleKey: updated.ruleKey,
        unlockedAt: now.toISOString(),
      },
    });

    return updated;
  }
}
