import { prisma } from '../../db/prisma';
import { AttributionLineageService } from './attributionLineageService';
import { SyntheticControlEngine } from './syntheticControlEngine';
import { OutboxDispatcher } from '../outbox/outboxDispatcher';
import {
  ATTRIBUTION_MODEL_VERSION,
  MIN_ATTRIBUTION_HORIZON_DAYS,
  ATTRIBUTION_MIN_CONFIDENCE_THRESHOLD,
  ATTRIBUTION_INCONCLUSIVE_CONFIDENCE_THRESHOLD,
  WIN_CLICK_LIFT_DELTA_THRESHOLD,
  WIN_RANK_DELTA_THRESHOLD,
  LOSS_CLICK_LIFT_DELTA_THRESHOLD,
  LOSS_RANK_DELTA_THRESHOLD,
  SERP_VOLATILITY_PENALTY_MULTIPLIER,
  buildAttributionEvaluationKey,
} from '../../config/attributionConstants';

export interface AttributionEvaluationOptions {
  evaluationHorizonDays?: number;
  modelVersion?: string;
}

export interface AttributionEvaluationResult {
  attributionFactId: string;
  actionExecutionId: string;
  evaluationKey: string;
  modelVersion: string;
  websiteId: string;
  urlIdentityId: string;
  primaryKeywordId?: string;
  outcomeCategory: 'WIN' | 'LOSS' | 'NEUTRAL' | 'INCONCLUSIVE';
  confidenceScore: number;
  netCausalLift: number;
  syntheticControlDelta: number;
  rankDelta: number;
  clickLiftDelta: number;
  impressionLiftDelta: number;
  ctrDelta: number;
  preAvgRank: number;
  postAvgRank: number;
  preClicks: number;
  postClicks: number;
  controlMatchesCount: number;
}

export class CausalAttributionEngine {
  /**
   * Evaluates the causal impact of an ActionExecution using Difference-in-Differences (DiD)
   * benchmarked against a matched synthetic control group.
   */
  public static async evaluateActionExecution(
    actionExecutionId: string,
    horizonOrOptions: number | AttributionEvaluationOptions = 30
  ): Promise<AttributionEvaluationResult> {
    const evaluationHorizonDays =
      typeof horizonOrOptions === 'number'
        ? horizonOrOptions
        : horizonOrOptions.evaluationHorizonDays ?? 30;
    const modelVersion =
      typeof horizonOrOptions === 'object' && horizonOrOptions.modelVersion
        ? horizonOrOptions.modelVersion
        : ATTRIBUTION_MODEL_VERSION;

    // 1. Resolve full lineage context
    const lineage = await AttributionLineageService.resolveLineage(actionExecutionId);
    const {
      websiteId,
      urlIdentityId,
      primaryKeywordId,
      ruleKey,
      cmsProvider,
      pageArchetype,
      executedAt,
      seoEventId,
    } = lineage;

    if (!urlIdentityId) {
      throw new Error(`Cannot evaluate attribution: URL Identity could not be resolved for '${actionExecutionId}'`);
    }

    // 2. Define Temporal Windows
    const executionDate = new Date(executedAt);
    const baselineStartDate = new Date(executionDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const evaluationStartDate = new Date(executionDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 14-day lag
    const evaluationEndDate = new Date(executionDate.getTime() + evaluationHorizonDays * 24 * 60 * 60 * 1000);

    // 3. Treatment Group Metrics (Pre & Post)
    const treatmentPreFacts = await prisma.gscSearchAnalyticsFact.findMany({
      where: {
        websiteId,
        urlIdentityId,
        date: { gte: baselineStartDate, lt: executionDate },
      },
    });

    const treatmentPostFacts = await prisma.gscSearchAnalyticsFact.findMany({
      where: {
        websiteId,
        urlIdentityId,
        date: { gte: evaluationStartDate, lte: evaluationEndDate },
      },
    });

    const preClicks = treatmentPreFacts.reduce((sum, f) => sum + f.clicks, 0);
    const postClicks = treatmentPostFacts.reduce((sum, f) => sum + f.clicks, 0);
    const clickLiftDelta = postClicks - preClicks;

    const preImpressions = treatmentPreFacts.reduce((sum, f) => sum + f.impressions, 0);
    const postImpressions = treatmentPostFacts.reduce((sum, f) => sum + f.impressions, 0);
    const impressionLiftDelta = postImpressions - preImpressions;

    const preCtr = preImpressions > 0 ? Number((preClicks / preImpressions).toFixed(4)) : 0.0;
    const postCtr = postImpressions > 0 ? Number((postClicks / postImpressions).toFixed(4)) : 0.0;
    const ctrDelta = Number((postCtr - preCtr).toFixed(4));

    // Treatment Average Rank calculation (weighted by impressions, or simple mean)
    const calcWeightedRank = (facts: typeof treatmentPreFacts): number => {
      const validRankFacts = facts.filter((f) => f.position > 0);
      if (validRankFacts.length === 0) return 0;
      const totalImps = validRankFacts.reduce((sum, f) => sum + Math.max(1, f.impressions), 0);
      const weightedSum = validRankFacts.reduce((sum, f) => sum + f.position * Math.max(1, f.impressions), 0);
      return totalImps > 0 ? weightedSum / totalImps : 0;
    };

    let preAvgRank = calcWeightedRank(treatmentPreFacts);
    let postAvgRank = calcWeightedRank(treatmentPostFacts);

    // If GSC position facts were sparse, check KeywordRankDaily fallback
    if (preAvgRank === 0 || postAvgRank === 0) {
      const keywordRanks = await prisma.keywordRankDaily.findMany({
        where: {
          websiteId,
          ...(primaryKeywordId ? { keywordId: primaryKeywordId } : {}),
          date: { gte: baselineStartDate, lte: evaluationEndDate },
        },
      });

      const preKeywordRanks = keywordRanks.filter((r) => new Date(r.date) < executionDate && r.rank > 0);
      const postKeywordRanks = keywordRanks.filter((r) => new Date(r.date) >= evaluationStartDate && r.rank > 0);

      if (preAvgRank === 0 && preKeywordRanks.length > 0) {
        preAvgRank = preKeywordRanks.reduce((s, r) => s + r.rank, 0) / preKeywordRanks.length;
      }
      if (postAvgRank === 0 && postKeywordRanks.length > 0) {
        postAvgRank = postKeywordRanks.reduce((s, r) => s + r.rank, 0) / postKeywordRanks.length;
      }
    }

    // Default fallback if no rank observation found
    const effectivePreRank = preAvgRank > 0 ? preAvgRank : 50.0;
    const effectivePostRank = postAvgRank > 0 ? postAvgRank : 50.0;
    // Rank delta: positive means rank improvement (e.g. from position 10 to 5 is +5)
    const rankDelta = Number((effectivePreRank - effectivePostRank).toFixed(2));

    // 4. Synthetic Control Group Construction & Counterfactual Estimation
    const controlMatches = await SyntheticControlEngine.selectSyntheticControls({
      websiteId,
      treatmentUrlId: urlIdentityId,
      treatmentNormalizedUrl: lineage.normalizedUrl || lineage.targetUrl,
      treatmentPrimaryKeywordId: primaryKeywordId || undefined,
      executionDate,
      k: 3,
    });

    let controlLiftSum = 0;
    for (const match of controlMatches) {
      const controlPostFacts = await prisma.gscSearchAnalyticsFact.findMany({
        where: {
          websiteId,
          urlIdentityId: match.controlUrlId,
          date: { gte: evaluationStartDate, lte: evaluationEndDate },
        },
      });
      const controlPostClicks = controlPostFacts.reduce((sum, f) => sum + f.clicks, 0);
      match.baselinePostClicks = controlPostClicks;
      controlLiftSum += (controlPostClicks - match.baselinePreClicks);
    }

    const syntheticControlDelta =
      controlMatches.length > 0
        ? Number((controlLiftSum / controlMatches.length).toFixed(2))
        : 0.0;

    // 5. Exogenous Volatility / Algorithm Anomaly Check
    const serpVolatilityEvents = await prisma.seoEvent.findMany({
      where: {
        websiteId,
        eventType: { in: ['SERP_ALGORITHM_UPDATE', 'COMPETITOR_SURGE', 'SITEWIDE_CRAWL_ANOMALY'] },
        detectedAt: { gte: executionDate, lte: evaluationEndDate },
      },
    });
    const isSerpVolatile = serpVolatilityEvents.length > 0;

    // 6. Deterministic Difference-in-Differences Net Lift Calculation
    // Net Lift = Treatment Delta - Synthetic Control Delta
    const netCausalLift = Number((clickLiftDelta - syntheticControlDelta).toFixed(2));

    // 7. Deterministic Confidence Score (0.0 to 1.0)
    // Based on:
    // a. Control twin presence and similarity scores (weight 0.40)
    // b. Pre-period & post-period data density (weight 0.35)
    // c. Magnitude of metric signal clarity (weight 0.25)
    const avgControlSimilarity =
      controlMatches.length > 0
        ? controlMatches.reduce((sum, m) => sum + m.similarityScore, 0) / controlMatches.length
        : 0.0;
    const totalFactsCount = treatmentPreFacts.length + treatmentPostFacts.length;
    const dataDensityScore = Math.min(1.0, totalFactsCount / 30);
    const signalClarityScore = Math.min(1.0, Math.abs(netCausalLift) / 20 + Math.abs(rankDelta) / 5);

    let confidenceScore = Number(
      (0.40 * avgControlSimilarity + 0.35 * dataDensityScore + 0.25 * signalClarityScore).toFixed(2)
    );

    // Apply volatility penalty to confidence score if SERP had turbulent algorithm updates
    if (isSerpVolatile) {
      confidenceScore = Number(
        Math.max(0.1, confidenceScore * SERP_VOLATILITY_PENALTY_MULTIPLIER).toFixed(2)
      );
    }

    // 8. Outcome Category Classification with INCONCLUSIVE & Confidence Thresholds
    let outcomeCategory: 'WIN' | 'LOSS' | 'NEUTRAL' | 'INCONCLUSIVE' = 'NEUTRAL';

    // Inconclusive conditions:
    // 1. Observation window is too short (< 14 days)
    // 2. Insufficient data points (e.g. 0 pre or post facts, or pre impressions = 0 and post impressions = 0)
    // 3. No viable control twins found (controlMatches.length === 0)
    // 4. Extreme SERP volatility detected during evaluation window
    // 5. Confidence score falls below the required threshold for deterministic attribution
    const isShortWindow = evaluationHorizonDays < MIN_ATTRIBUTION_HORIZON_DAYS;
    const isInsufficientData = treatmentPreFacts.length === 0 && treatmentPostFacts.length === 0;
    const isMissingControlGroup = controlMatches.length === 0;

    if (
      isShortWindow ||
      isInsufficientData ||
      isMissingControlGroup ||
      isSerpVolatile ||
      confidenceScore < ATTRIBUTION_INCONCLUSIVE_CONFIDENCE_THRESHOLD
    ) {
      outcomeCategory = 'INCONCLUSIVE';
    } else {
      // Explicit confidence thresholds required for WIN/LOSS assignment (confidence >= 0.50)
      const isConfident = confidenceScore >= ATTRIBUTION_MIN_CONFIDENCE_THRESHOLD;

      if (
        isConfident &&
        (netCausalLift >= WIN_CLICK_LIFT_DELTA_THRESHOLD ||
          (rankDelta >= WIN_RANK_DELTA_THRESHOLD && clickLiftDelta >= 0))
      ) {
        outcomeCategory = 'WIN';
      } else if (
        isConfident &&
        (netCausalLift <= LOSS_CLICK_LIFT_DELTA_THRESHOLD ||
          (rankDelta <= LOSS_RANK_DELTA_THRESHOLD && clickLiftDelta < 0))
      ) {
        outcomeCategory = 'LOSS';
      } else {
        outcomeCategory = 'NEUTRAL';
      }
    }

    // 9. Generate Deterministic Version-Aware Evaluation Key
    const evaluationKey = buildAttributionEvaluationKey({
      websiteId,
      actionExecutionId,
      evaluationStartDate,
      evaluationEndDate,
      modelVersion,
    });

    // 10. Persist or Update ActionAttributionFact (Idempotent upsert by evaluationKey)
    const existingFact = await prisma.actionAttributionFact.findUnique({
      where: { evaluationKey },
    });

    let attributionFact;
    if (existingFact) {
      attributionFact = await prisma.actionAttributionFact.update({
        where: { id: existingFact.id },
        data: {
          primaryKeywordId: primaryKeywordId || null,
          seoEventId: seoEventId || null,
          ruleKey,
          cmsProvider,
          pageArchetype,
          modelVersion,
          executionDate,
          baselineStartDate,
          evaluationStartDate,
          evaluationEndDate,
          preAvgRank: Number(effectivePreRank.toFixed(2)),
          postAvgRank: Number(effectivePostRank.toFixed(2)),
          rankDelta,
          preClicks30d: preClicks,
          postClicks30d: postClicks,
          clickLiftDelta,
          preImpressions30d: preImpressions,
          postImpressions30d: postImpressions,
          impressionLiftDelta,
          preCtr,
          postCtr,
          ctrDelta,
          syntheticControlDelta,
          netCausalLift,
          outcomeCategory,
          confidenceScore,
        },
      });
    } else {
      attributionFact = await prisma.actionAttributionFact.create({
        data: {
          websiteId,
          actionExecutionId,
          evaluationKey,
          modelVersion,
          urlIdentityId,
          primaryKeywordId: primaryKeywordId || null,
          seoEventId: seoEventId || null,
          ruleKey,
          cmsProvider,
          pageArchetype,
          executionDate,
          baselineStartDate,
          evaluationStartDate,
          evaluationEndDate,
          preAvgRank: Number(effectivePreRank.toFixed(2)),
          postAvgRank: Number(effectivePostRank.toFixed(2)),
          rankDelta,
          preClicks30d: preClicks,
          postClicks30d: postClicks,
          clickLiftDelta,
          preImpressions30d: preImpressions,
          postImpressions30d: postImpressions,
          impressionLiftDelta,
          preCtr,
          postCtr,
          ctrDelta,
          syntheticControlDelta,
          netCausalLift,
          outcomeCategory,
          confidenceScore,
        },
      });
    }

    // 11. Persist control twin matches linked to this attribution fact
    await SyntheticControlEngine.persistControlMatches(
      websiteId,
      urlIdentityId,
      controlMatches,
      attributionFact.id
    );

    // 12. Update SeoEvent timeline with attribution results
    if (seoEventId) {
      await prisma.seoEvent.update({
        where: { id: seoEventId },
        data: {
          eventType: 'ATTRIBUTION_EVALUATION_COMPLETED',
          severity: outcomeCategory === 'WIN' ? 'INFO' : outcomeCategory === 'LOSS' ? 'HIGH' : 'LOW',
          deltaNotes: `Attribution evaluated: Outcome=${outcomeCategory}, Net Causal Lift=${netCausalLift} clicks, Rank Delta=${rankDelta > 0 ? '+' : ''}${rankDelta}, Confidence=${(confidenceScore * 100).toFixed(0)}%.`,
          details: JSON.stringify({
            attributionFactId: attributionFact.id,
            actionExecutionId,
            evaluationKey,
            modelVersion,
            outcomeCategory,
            netCausalLift,
            rankDelta,
            clickLiftDelta,
            syntheticControlDelta,
            confidenceScore,
            evaluatedAt: new Date().toISOString(),
          }),
        },
      });
    }

    // 13. Emit Outbox Event for downstream Bayesian learning and canary watchdogs
    await OutboxDispatcher.recordEvent({
      aggregateType: 'ATTRIBUTION_FACT',
      aggregateId: attributionFact.id,
      eventType: 'ATTRIBUTION_EVALUATION_COMPLETED',
      payload: {
        attributionFactId: attributionFact.id,
        actionExecutionId,
        evaluationKey,
        modelVersion,
        websiteId,
        ruleKey,
        cmsProvider,
        pageArchetype,
        outcomeCategory,
        netCausalLift,
        rankDelta,
        confidenceScore,
        evaluationEndDate: evaluationEndDate.toISOString(),
      },
    });

    return {
      attributionFactId: attributionFact.id,
      actionExecutionId,
      evaluationKey,
      modelVersion,
      websiteId,
      urlIdentityId,
      primaryKeywordId: primaryKeywordId || undefined,
      outcomeCategory,
      confidenceScore,
      netCausalLift,
      syntheticControlDelta,
      rankDelta,
      clickLiftDelta,
      impressionLiftDelta,
      ctrDelta,
      preAvgRank: Number(effectivePreRank.toFixed(2)),
      postAvgRank: Number(effectivePostRank.toFixed(2)),
      preClicks,
      postClicks,
      controlMatchesCount: controlMatches.length,
    };
  }
}
