import { prisma } from '../../db/prisma';
import { AttributionLineageService, AttributionLineageContext } from './attributionLineageService';
import { SyntheticControlEngine, SyntheticControlMatchResult } from './syntheticControlEngine';
import { OutboxDispatcher } from '../outbox/outboxDispatcher';

export interface AttributionEvaluationResult {
  attributionFactId: string;
  actionExecutionId: string;
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
    evaluationHorizonDays: number = 30
  ): Promise<AttributionEvaluationResult> {
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
        date: { gte: executionDate, lte: evaluationEndDate },
      },
    });

    // Compute Treatment Pre-Period Metrics
    const preClicks = treatmentPreFacts.reduce((sum, f) => sum + (f.clicks || 0), 0);
    const preImpressions = treatmentPreFacts.reduce((sum, f) => sum + (f.impressions || 0), 0);
    const preCtr = preImpressions > 0 ? preClicks / preImpressions : 0;
    const preAvgRank =
      treatmentPreFacts.length > 0
        ? treatmentPreFacts.reduce((sum, f) => sum + (f.position || 0), 0) / treatmentPreFacts.length
        : 25.0; // Baseline fallback

    // Compute Treatment Post-Period Metrics
    const postClicks = treatmentPostFacts.reduce((sum, f) => sum + (f.clicks || 0), 0);
    const postImpressions = treatmentPostFacts.reduce((sum, f) => sum + (f.impressions || 0), 0);
    const postCtr = postImpressions > 0 ? postClicks / postImpressions : 0;
    const postAvgRank =
      treatmentPostFacts.length > 0
        ? treatmentPostFacts.reduce((sum, f) => sum + (f.position || 0), 0) / treatmentPostFacts.length
        : preAvgRank;

    // Check if rank tracking daily facts provide tighter primary keyword rankings
    let primaryKwPreRank: number | null = null;
    let primaryKwPostRank: number | null = null;
    if (primaryKeywordId) {
      const preRankFacts = await prisma.keywordRankDaily.findMany({
        where: {
          websiteId,
          keywordId: primaryKeywordId,
          date: { gte: baselineStartDate, lt: executionDate },
        },
      });
      const postRankFacts = await prisma.keywordRankDaily.findMany({
        where: {
          websiteId,
          keywordId: primaryKeywordId,
          date: { gte: executionDate, lte: evaluationEndDate },
        },
      });
      if (preRankFacts.length > 0) {
        primaryKwPreRank = preRankFacts.reduce((sum, r) => sum + (r.rank || 0), 0) / preRankFacts.length;
      }
      if (postRankFacts.length > 0) {
        primaryKwPostRank = postRankFacts.reduce((sum, r) => sum + (r.rank || 0), 0) / postRankFacts.length;
      }
    }

    const effectivePreRank = primaryKwPreRank ?? preAvgRank;
    const effectivePostRank = primaryKwPostRank ?? postAvgRank;
    // Rank delta: positive means rank improved (e.g. went from pos 15 to pos 10 = +5.0 improvement)
    const rankDelta = Number((effectivePreRank - effectivePostRank).toFixed(2));
    const clickLiftDelta = postClicks - preClicks;
    const impressionLiftDelta = postImpressions - preImpressions;
    const ctrDelta = Number((postCtr - preCtr).toFixed(4));

    // 4. Select & Calculate Synthetic Control Cohort Delta
    const controlMatches = await SyntheticControlEngine.selectSyntheticControls({
      websiteId,
      treatmentUrlId: urlIdentityId,
      treatmentNormalizedUrl: lineage.normalizedUrl,
      treatmentPrimaryKeywordId: primaryKeywordId,
      executionDate,
      k: 3,
    });

    let syntheticControlDelta = 0;
    const evaluatedControls: SyntheticControlMatchResult[] = [];

    if (controlMatches.length > 0) {
      let totalControlClickDelta = 0;
      for (const ctrl of controlMatches) {
        const ctrlPostFacts = await prisma.gscSearchAnalyticsFact.findMany({
          where: {
            websiteId,
            urlIdentityId: ctrl.controlUrlId,
            date: { gte: executionDate, lte: evaluationEndDate },
          },
        });
        const ctrlPostClicks = ctrlPostFacts.reduce((sum, f) => sum + (f.clicks || 0), 0);
        const ctrlClickDelta = ctrlPostClicks - ctrl.baselinePreClicks;
        totalControlClickDelta += ctrlClickDelta;

        evaluatedControls.push({
          ...ctrl,
          baselinePostClicks: ctrlPostClicks,
        });
      }
      syntheticControlDelta = totalControlClickDelta / controlMatches.length;
    }

    // 5. Check for SERP Volatility / Major Algorithm Fluctuations during observation window
    const serpVolatilityEvents = await prisma.serpSnapshotEvent.findMany({
      where: {
        websiteId,
        createdAt: { gte: executionDate, lte: evaluationEndDate },
        eventType: { in: ['ALGORITHM_UPDATE_DETECTED', 'SERP_VOLATILITY_SURGE'] as any },
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
      confidenceScore = Number(Math.max(0.1, confidenceScore * 0.5).toFixed(2));
    }

    // 8. Outcome Category Classification with INCONCLUSIVE & Confidence Thresholds
    let outcomeCategory: 'WIN' | 'LOSS' | 'NEUTRAL' | 'INCONCLUSIVE' = 'NEUTRAL';

    // Inconclusive conditions:
    // 1. Observation window is too short (< 14 days)
    // 2. Insufficient data points (e.g. 0 pre or post facts, or pre impressions = 0 and post impressions = 0)
    // 3. No viable control twins found (controlMatches.length === 0)
    // 4. Extreme SERP volatility detected during evaluation window
    // 5. Confidence score falls below the required threshold for deterministic attribution (threshold: 0.45)
    const isShortWindow = evaluationHorizonDays < 14;
    const isInsufficientData = treatmentPreFacts.length === 0 && treatmentPostFacts.length === 0;
    const isMissingControlGroup = controlMatches.length === 0;

    if (isShortWindow || isInsufficientData || isMissingControlGroup || isSerpVolatile || confidenceScore < 0.45) {
      outcomeCategory = 'INCONCLUSIVE';
    } else {
      // Explicit confidence thresholds required for WIN/LOSS assignment (confidence >= 0.50)
      const isConfident = confidenceScore >= 0.50;

      if (isConfident && (netCausalLift >= 5 || (rankDelta >= 1.5 && clickLiftDelta >= 0))) {
        outcomeCategory = 'WIN';
      } else if (isConfident && (netCausalLift <= -5 || (rankDelta <= -1.5 && clickLiftDelta < 0))) {
        outcomeCategory = 'LOSS';
      } else {
        outcomeCategory = 'NEUTRAL';
      }
    }

    // 9. Persist or Update ActionAttributionFact
    const existingFact = await prisma.actionAttributionFact.findUnique({
      where: { actionExecutionId },
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

    // 8. Persist control twin matches linked to this attribution fact
    await SyntheticControlEngine.persistControlMatches(
      websiteId,
      urlIdentityId,
      evaluatedControls,
      attributionFact.id
    );

    // 9. Update SeoEvent timeline with attribution results
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

    // 10. Emit Outbox Event for downstream Bayesian learning and canary watchdogs
    await OutboxDispatcher.recordEvent({
      aggregateType: 'ATTRIBUTION_FACT',
      aggregateId: attributionFact.id,
      eventType: 'ATTRIBUTION_EVALUATION_COMPLETED',
      payload: {
        attributionFactId: attributionFact.id,
        actionExecutionId,
        websiteId,
        ruleKey,
        cmsProvider,
        pageArchetype,
        outcomeCategory,
        netCausalLift,
        rankDelta,
        confidenceScore,
      },
    });

    return {
      attributionFactId: attributionFact.id,
      actionExecutionId,
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
      preAvgRank: effectivePreRank,
      postAvgRank: effectivePostRank,
      preClicks,
      postClicks,
      controlMatchesCount: evaluatedControls.length,
    };
  }
}
