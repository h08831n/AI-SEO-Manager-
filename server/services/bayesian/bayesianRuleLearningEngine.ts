/**
 * Phase 6.2 Bayesian Rule Learning Engine
 * 
 * Implements Beta-Binomial conjugate updating across multi-grain SEO rule execution outcomes,
 * paired with the Policy Safety Gate to manage rule confidence weights safely.
 * 
 * Hardening:
 * 1. Processed evidence tracking (BayesianProcessedEvidence & BayesianRuleEvidenceCursor)
 *    ensures repeated recalibrations NEVER double-count attribution facts.
 * 2. Recalibration execution locking (RecalibrationLockManager) prevents concurrent workers.
 * 3. Transactional Outbox verification ensures events are stored atomically within DB transactions.
 */

import { prisma } from '../../db/prisma';
import { BayesianInputBoundary, EligibleBayesianFact } from './bayesianInputBoundary';
import { PolicySafetyGate, PolicyGateEvaluationResult } from './policySafetyGate';
import { OutboxDispatcher } from '../outbox/outboxDispatcher';
import { RecalibrationLockManager } from './recalibrationLockManager';
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
  newEvidenceCount: number;
}

export interface RecalibrationSummary {
  websiteId?: string;
  totalFactsProcessed: number;
  totalRuleStatesUpdated: number;
  autoDampedCount: number;
  pendingReviewCount: number;
  results: BayesianRecalibrationResult[];
  skippedDueToLock?: boolean;
}

export class BayesianRuleLearningEngine {
  /**
   * Recalibrates Bayesian rule weights based on eligible attribution facts.
   * Enforces distributed lock per website and incremental unconsumed evidence processing.
   */
  public static async recalibrateRuleWeights(
    websiteId?: string,
    options?: { now?: Date; workerId?: string }
  ): Promise<RecalibrationSummary> {
    const workerId = options?.workerId || `worker-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // If websiteId is provided, enforce execution locking
    if (websiteId) {
      const lock = await RecalibrationLockManager.acquireLock(websiteId, workerId);
      if (!lock.acquired) {
        return {
          websiteId,
          totalFactsProcessed: 0,
          totalRuleStatesUpdated: 0,
          autoDampedCount: 0,
          pendingReviewCount: 0,
          results: [],
          skippedDueToLock: true,
        };
      }

      try {
        return await this.executeRecalibrationCore(websiteId, options);
      } finally {
        await RecalibrationLockManager.releaseLock(websiteId, workerId);
      }
    }

    // If no websiteId, run per-site with individual locks
    const sites = await prisma.website.findMany({ select: { id: true } });
    const allResults: BayesianRecalibrationResult[] = [];
    let totalFacts = 0;
    let autoDamped = 0;
    let pendingReview = 0;

    for (const s of sites) {
      const siteSummary = await this.recalibrateRuleWeights(s.id, options);
      totalFacts += siteSummary.totalFactsProcessed;
      autoDamped += siteSummary.autoDampedCount;
      pendingReview += siteSummary.pendingReviewCount;
      allResults.push(...siteSummary.results);
    }

    return {
      totalFactsProcessed: totalFacts,
      totalRuleStatesUpdated: allResults.length,
      autoDampedCount: autoDamped,
      pendingReviewCount: pendingReview,
      results: allResults,
    };
  }

  /**
   * Core recalibration algorithm executed under lock.
   */
  private static async executeRecalibrationCore(
    websiteId: string,
    options?: { now?: Date }
  ): Promise<RecalibrationSummary> {
    const now = options?.now ?? new Date();

    // Fetch all eligible completed attribution facts for this website
    const eligibleFacts = await BayesianInputBoundary.fetchEligibleAttributionFacts(websiteId, {
      now,
    });

    if (eligibleFacts.length === 0) {
      return {
        websiteId,
        totalFactsProcessed: 0,
        totalRuleStatesUpdated: 0,
        autoDampedCount: 0,
        pendingReviewCount: 0,
        results: [],
      };
    }

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
    let totalNewEvidenceProcessed = 0;

    for (const [grainKey, facts] of groupedFacts.entries()) {
      const [siteId, ruleKey, cms, archetype] = grainKey.split('::');

      // Use a database transaction to ensure atomicity across State, Evidence, Cursor, and Outbox
      const grainResult = await prisma.$transaction(async (tx: any) => {
        // Fetch or initialize rule state
        let existingState = await tx.bayesianRuleWeightState.findUnique({
          where: {
            websiteId_ruleKey_cmsProvider_pageArchetype: {
              websiteId: siteId,
              ruleKey,
              cmsProvider: cms,
              pageArchetype: archetype,
            },
          },
        });

        // Fetch already processed evidence IDs for this rule state to prevent double counting
        let stateId = existingState?.id;
        const alreadyProcessedFactIds = new Set<string>();

        if (stateId) {
          const processedRecords = await tx.bayesianProcessedEvidence.findMany({
            where: { stateId },
            select: { attributionFactId: true },
          });
          for (const r of processedRecords) {
            alreadyProcessedFactIds.add(r.attributionFactId);
          }
        }

        // Filter out facts already processed into this state
        const unconsumedFacts = facts.filter((f) => !alreadyProcessedFactIds.has(f.attributionFactId));

        // If no new evidence exists, skip updating posterior to preserve idempotency
        if (unconsumedFacts.length === 0 && existingState) {
          return null;
        }

        // Existing priors or posterior baselines
        const alphaPrior = existingState?.alphaPrior ?? DEFAULT_ALPHA_PRIOR;
        const betaPrior = existingState?.betaPrior ?? DEFAULT_BETA_PRIOR;
        const currentAppliedWeight = existingState?.approvedAppliedWeight ?? 1.0;
        const currentStatus = (existingState?.approvalStatus as BayesianApprovalStatus) ?? 'AUTO_APPROVED';
        const isCurrentlyDamped = existingState?.isAutoDamped ?? false;

        // Current cumulative counts
        const prevWins = existingState?.observedWins ?? 0;
        const prevLosses = existingState?.observedLosses ?? 0;

        // New wins and losses from unconsumed facts
        const newWins = unconsumedFacts.filter((f) => f.outcomeCategory === 'WIN').length;
        const newLosses = unconsumedFacts.filter((f) => f.outcomeCategory === 'LOSS').length;

        const totalObservedWins = prevWins + newWins;
        const totalObservedLosses = prevLosses + newLosses;

        // Beta-Binomial conjugate posterior update
        const alphaPosterior = Number((alphaPrior + totalObservedWins).toFixed(3));
        const betaPosterior = Number((betaPrior + totalObservedLosses).toFixed(3));
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
          observedWins: totalObservedWins,
          observedLosses: totalObservedLosses,
          isCurrentlyDamped,
        });

        // Upsert BayesianRuleWeightState within transaction
        const updatedRecord = await tx.bayesianRuleWeightState.upsert({
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
            observedWins: totalObservedWins,
            observedLosses: totalObservedLosses,
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
            observedWins: totalObservedWins,
            observedLosses: totalObservedLosses,
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

        // Record newly processed evidence records to prevent future double counting
        for (const fact of unconsumedFacts) {
          await tx.bayesianProcessedEvidence.create({
            data: {
              websiteId: siteId,
              stateId: updatedRecord.id,
              attributionFactId: fact.attributionFactId,
              outcomeCategory: fact.outcomeCategory,
              confidenceScore: fact.confidenceScore,
              processedAt: now,
            },
          });
        }

        // Update rule evidence cursor
        const lastFact = unconsumedFacts[unconsumedFacts.length - 1];
        await tx.bayesianRuleEvidenceCursor.upsert({
          where: {
            websiteId_ruleKey_cmsProvider_pageArchetype: {
              websiteId: siteId,
              ruleKey,
              cmsProvider: cms,
              pageArchetype: archetype,
            },
          },
          update: {
            lastProcessedFactId: lastFact ? lastFact.attributionFactId : undefined,
            lastProcessedFactDate: lastFact ? lastFact.evaluationEndDate : undefined,
            processedFactCount: totalObservedWins + totalObservedLosses,
            lastRecalibratedAt: now,
          },
          create: {
            websiteId: siteId,
            ruleKey,
            cmsProvider: cms,
            pageArchetype: archetype,
            lastProcessedFactId: lastFact ? lastFact.attributionFactId : null,
            lastProcessedFactDate: lastFact ? lastFact.evaluationEndDate : null,
            processedFactCount: totalObservedWins + totalObservedLosses,
            lastRecalibratedAt: now,
          },
        });

        const resultItem: BayesianRecalibrationResult = {
          websiteId: siteId,
          ruleKey,
          cmsProvider: cms,
          pageArchetype: archetype,
          alphaPrior,
          betaPrior,
          observedWins: totalObservedWins,
          observedLosses: totalObservedLosses,
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
          newEvidenceCount: unconsumedFacts.length,
        };

        // Emit Outbox event transactionally
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
          tx,
        });

        return {
          resultItem,
          isAutoDamped: policyDecision.isAutoDamped,
          isPendingReview: policyDecision.approvalStatus === 'PENDING_REVIEW',
          newCount: unconsumedFacts.length,
        };
      });

      if (grainResult) {
        results.push(grainResult.resultItem);
        totalNewEvidenceProcessed += grainResult.newCount;
        if (grainResult.isAutoDamped) autoDampedCount++;
        if (grainResult.isPendingReview) pendingReviewCount++;
      }
    }

    return {
      websiteId,
      totalFactsProcessed: totalNewEvidenceProcessed,
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
      if (exactState?.approvedAppliedWeight != null) {
        return exactState.approvedAppliedWeight;
      }
    }

    // 2. CMS match with ALL archetypes
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
      if (cmsState?.approvedAppliedWeight != null) {
        return cmsState.approvedAppliedWeight;
      }
    }

    // 3. Site-wide global match (ALL cms, ALL archetypes)
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
    if (siteState?.approvedAppliedWeight != null) {
      return siteState.approvedAppliedWeight;
    }

    // 4. Default uncalibrated base weight
    return 1.0;
  }

  /**
   * Approves a pending or damped rule weight, un-damping it and setting approvalStatus = AUTO_APPROVED.
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

    return await prisma.$transaction(async (tx: any) => {
      const updated = await tx.bayesianRuleWeightState.update({
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
        tx,
      });

      return updated;
    });
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
    return await prisma.$transaction(async (tx: any) => {
      const updated = await tx.bayesianRuleWeightState.update({
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
        tx,
      });

      return updated;
    });
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
    return await prisma.$transaction(async (tx: any) => {
      const updated = await tx.bayesianRuleWeightState.update({
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
        tx,
      });

      return updated;
    });
  }
}
