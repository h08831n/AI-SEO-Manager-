/**
 * Phase 6.1 -> 6.2 Bayesian Input Boundary
 * 
 * Strict boundary filter and query service for consuming ActionAttributionFacts into 
 * the Phase 6.2 Bayesian Rule Learning Pipeline.
 *
 * Strict Production Safeguards:
 * 1. Only consumes AttributionFact records where outcomeCategory is strictly 'WIN' or 'LOSS'.
 * 2. Enforces minimum confidence threshold (default >= 0.50).
 * 3. Enforces that the evaluation window is completed (evaluationEndDate <= now).
 * 4. Explicitly ignores/discards 'INCONCLUSIVE' and 'NEUTRAL' outcomes to prevent noisy or null posterior skew.
 */

import { prisma } from '../../db/prisma';

export const MIN_BAYESIAN_CONFIDENCE_THRESHOLD = 0.50;

export interface EligibleBayesianFact {
  attributionFactId: string;
  websiteId: string;
  actionExecutionId: string;
  ruleKey: string;
  cmsProvider: string;
  pageArchetype: string;
  outcomeCategory: 'WIN' | 'LOSS';
  confidenceScore: number;
  netCausalLift: number;
  rankDelta: number;
  clickLiftDelta: number;
  evaluationEndDate: Date;
  evaluationKey?: string | null;
}

export interface BayesianInputFilterOptions {
  minConfidenceThreshold?: number;
  now?: Date;
}

export class BayesianInputBoundary {
  /**
   * Evaluates whether an individual attribution record meets all strict Bayesian learning invariants:
   * - Outcome must be WIN or LOSS (NEUTRAL & INCONCLUSIVE are strictly excluded)
   * - Confidence score must be >= minConfidenceThreshold (default 0.50)
   * - Evaluation window must be completed (evaluationEndDate <= now)
   */
  public static isEligibleForBayesianLearning(
    fact: {
      outcomeCategory?: string | null;
      confidenceScore?: number | null;
      evaluationEndDate?: Date | string | null;
      ruleKey?: string | null;
    },
    options?: BayesianInputFilterOptions
  ): boolean {
    if (!fact) return false;

    const minConfidence = options?.minConfidenceThreshold ?? MIN_BAYESIAN_CONFIDENCE_THRESHOLD;
    const now = options?.now ?? new Date();

    // Invariant 1: Strictly WIN or LOSS
    if (fact.outcomeCategory !== 'WIN' && fact.outcomeCategory !== 'LOSS') {
      return false;
    }

    // Invariant 2: Confidence score must meet or exceed required threshold
    const confidence = typeof fact.confidenceScore === 'number' ? fact.confidenceScore : 0;
    if (confidence < minConfidence) {
      return false;
    }

    // Invariant 3: Evaluation horizon window must be closed/completed
    if (!fact.evaluationEndDate) {
      return false;
    }
    const endDate = new Date(fact.evaluationEndDate);
    if (isNaN(endDate.getTime()) || endDate > now) {
      return false;
    }

    return true;
  }

  /**
   * Filters an array of attribution facts in memory according to Bayesian eligibility rules.
   */
  public static filterEligibleAttributionFacts(
    facts: any[],
    options?: BayesianInputFilterOptions
  ): EligibleBayesianFact[] {
    if (!Array.isArray(facts)) return [];

    return facts
      .filter((fact) => this.isEligibleForBayesianLearning(fact, options))
      .map((fact) => ({
        attributionFactId: fact.id || fact.attributionFactId,
        websiteId: fact.websiteId,
        actionExecutionId: fact.actionExecutionId,
        ruleKey: fact.ruleKey,
        cmsProvider: fact.cmsProvider || 'CUSTOM',
        pageArchetype: fact.pageArchetype || 'GENERAL',
        outcomeCategory: fact.outcomeCategory as 'WIN' | 'LOSS',
        confidenceScore: Number(fact.confidenceScore),
        netCausalLift: Number(fact.netCausalLift ?? 0),
        rankDelta: Number(fact.rankDelta ?? 0),
        clickLiftDelta: Number(fact.clickLiftDelta ?? 0),
        evaluationEndDate: new Date(fact.evaluationEndDate),
        evaluationKey: fact.evaluationKey || null,
      }));
  }

  /**
   * Fetches only eligible, completed, high-confidence ActionAttributionFact records directly from database.
   */
  public static async fetchEligibleAttributionFacts(
    websiteId?: string,
    options?: BayesianInputFilterOptions
  ): Promise<EligibleBayesianFact[]> {
    const minConfidence = options?.minConfidenceThreshold ?? MIN_BAYESIAN_CONFIDENCE_THRESHOLD;
    const now = options?.now ?? new Date();

    const whereClause: any = {
      outcomeCategory: { in: ['WIN', 'LOSS'] },
      confidenceScore: { gte: minConfidence },
      evaluationEndDate: { lte: now },
    };

    if (websiteId) {
      whereClause.websiteId = websiteId;
    }

    const rawFacts = await prisma.actionAttributionFact.findMany({
      where: whereClause,
      orderBy: { evaluationEndDate: 'asc' },
    });

    return this.filterEligibleAttributionFacts(rawFacts, { minConfidenceThreshold: minConfidence, now });
  }
}
