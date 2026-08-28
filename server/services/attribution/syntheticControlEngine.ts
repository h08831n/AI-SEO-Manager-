import { prisma } from '../../db/prisma';
import { AttributionLineageService } from './attributionLineageService';
import {
  MIN_CONTROL_SIMILARITY,
  MIN_CONTROL_HISTORY_DAYS,
} from '../../config/attributionConstants';

export interface SyntheticControlFeatureBreakdown {
  archetypeSimilarity: number;
  depthDelta: number;
  volumeSimilarity: number;
  slopeSimilarity: number;
  graphSimilarity: number;
  treatmentVolume: number;
  candidateVolume: number;
  treatmentInlinks: number;
  candidateInlinks: number;
}

export interface SyntheticControlMatchResult {
  controlUrlId: string;
  controlUrl: string;
  similarityScore: number;
  features: SyntheticControlFeatureBreakdown;
  baselinePreClicks: number;
  baselinePostClicks: number;
  baselinePreRank?: number;
  baselinePostRank?: number;
}

export interface FindSyntheticControlsParams {
  websiteId: string;
  treatmentUrlId: string;
  treatmentNormalizedUrl: string;
  treatmentPrimaryKeywordId?: string;
  executionDate: Date;
  k?: number; // default 3
}

export class SyntheticControlEngine {
  // Configurable feature weights (sum to 1.0)
  public static readonly WEIGHT_ARCHETYPE = 0.35;
  public static readonly WEIGHT_VOLUME = 0.25;
  public static readonly WEIGHT_SLOPE = 0.25;
  public static readonly WEIGHT_GRAPH = 0.15;

  /**
   * Identifies and ranks synthetic control twins for a treatment URL based on multi-factor similarity.
   */
  public static async selectSyntheticControls(
    params: FindSyntheticControlsParams
  ): Promise<SyntheticControlMatchResult[]> {
    const {
      websiteId,
      treatmentUrlId,
      treatmentNormalizedUrl,
      treatmentPrimaryKeywordId,
      executionDate,
      k = 3,
    } = params;

    // 1. Fetch treatment URL details
    const treatmentUrl = await prisma.urlIdentity.findUnique({
      where: { id: treatmentUrlId },
    });

    if (!treatmentUrl) {
      throw new Error(`Treatment URL identity '${treatmentUrlId}' not found.`);
    }

    const treatmentArchetype = AttributionLineageService.derivePageArchetype(treatmentUrl.pathname);
    const treatmentDepth = treatmentUrl.minCrawlDepth || treatmentUrl.pathname.split('/').filter(Boolean).length;
    const treatmentInlinks = treatmentUrl.inlinksCount || 0;

    // Fetch treatment pre-period metrics (T - 30d to T)
    const baselineStartDate = new Date(executionDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const evaluationEndDate = new Date(executionDate.getTime() + 44 * 24 * 60 * 60 * 1000); // 14 lag + 30 post
    const treatmentGscFacts = await prisma.gscSearchAnalyticsFact.findMany({
      where: {
        websiteId,
        urlIdentityId: treatmentUrlId,
        date: { gte: baselineStartDate, lte: executionDate },
      },
      orderBy: { date: 'asc' },
    });

    const treatmentPreClicks = treatmentGscFacts.reduce((sum, f) => sum + (f.clicks || 0), 0);
    const treatmentPreImpressions = treatmentGscFacts.reduce((sum, f) => sum + (f.impressions || 0), 0);
    const treatmentTotalVolume = treatmentPreClicks + treatmentPreImpressions;

    // 2. Query Candidate URLs for this website
    const candidates = await prisma.urlIdentity.findMany({
      where: {
        websiteId,
        id: { not: treatmentUrlId },
      },
    });

    if (candidates.length === 0) {
      return [];
    }

    // 3. Collect exclusion sets: URLs with ActionExecution anywhere in baseline, treatment lag, or observation period
    const activeActionExecutions = await prisma.actionExecution.findMany({
      where: {
        websiteId,
        executedAt: { gte: baselineStartDate, lte: evaluationEndDate },
      },
      select: { targetUrl: true },
    });
    const excludedUrlsSet = new Set(
      activeActionExecutions.map(e => AttributionLineageService.normalizeUrl(e.targetUrl).normalizedUrl)
    );

    // B: Keywords bound to treatment (to avoid cannibalization overlap)
    let treatmentKeywordStr = '';
    if (treatmentPrimaryKeywordId) {
      const kw = await prisma.keywordUniverse.findUnique({ where: { id: treatmentPrimaryKeywordId } });
      treatmentKeywordStr = kw?.normalizedKeyword || '';
    }

    const scoredCandidates: SyntheticControlMatchResult[] = [];

    // Helper: Calculate linear regression slope of daily clicks time series
    const calcTrendSlope = (facts: Array<{ date: Date | string; clicks: number }>): number => {
      if (facts.length < 2) return 0.0;
      const n = facts.length;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;
      for (let i = 0; i < n; i++) {
        const y = facts[i].clicks || 0;
        sumX += i;
        sumY += y;
        sumXY += i * y;
        sumXX += i * i;
      }
      const denom = n * sumXX - sumX * sumX;
      return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0.0;
    };

    const treatmentSlope = calcTrendSlope(treatmentGscFacts);

    // 4. Score each candidate
    for (const candidate of candidates) {
      // Exclusion 1: Recent action executions (contaminated)
      if (excludedUrlsSet.has(candidate.normalizedUrl)) {
        continue;
      }

      const candidateArchetype = AttributionLineageService.derivePageArchetype(candidate.pathname);
      const candidateDepth = candidate.minCrawlDepth || candidate.pathname.split('/').filter(Boolean).length;
      const candidateInlinks = candidate.inlinksCount || 0;

      // Exclusion 2: Same primary keyword target
      if (treatmentKeywordStr) {
        const candidateKws = await prisma.keywordUniverse.findMany({
          where: {
            websiteId,
            targetUrlIdentityId: candidate.id,
          },
          select: { normalizedKeyword: true },
        });
        const sharesKeyword = candidateKws.some(k => k.normalizedKeyword === treatmentKeywordStr);
        if (sharesKeyword) {
          continue;
        }
      }

      // Candidate Pre-period metrics
      const candidateGscFacts = await prisma.gscSearchAnalyticsFact.findMany({
        where: {
          websiteId,
          urlIdentityId: candidate.id,
          date: { gte: baselineStartDate, lte: executionDate },
        },
        orderBy: { date: 'asc' },
      });

      const candidatePreClicks = candidateGscFacts.reduce((sum, f) => sum + (f.clicks || 0), 0);
      const candidatePreImpressions = candidateGscFacts.reduce((sum, f) => sum + (f.impressions || 0), 0);
      const candidateTotalVolume = candidatePreClicks + candidatePreImpressions;

      // --- Feature 1: Page Archetype & Directory Depth Match (0 to 1.0) ---
      let archetypeSim = 0.2;
      if (treatmentArchetype === candidateArchetype) {
        archetypeSim = 1.0;
      } else if (
        (treatmentArchetype.includes('PAGE') && candidateArchetype.includes('PAGE')) ||
        (treatmentArchetype.includes('CONTENT') && candidateArchetype.includes('CONTENT'))
      ) {
        archetypeSim = 0.6;
      }
      const depthDelta = Math.abs(treatmentDepth - candidateDepth);
      const depthSim = Math.max(0, 1.0 - depthDelta * 0.25);
      const featureArchetypeScore = 0.7 * archetypeSim + 0.3 * depthSim;

      // --- Feature 2: Historical Traffic & Impression Volume Scale (0 to 1.0) ---
      const logTreat = Math.log10(treatmentTotalVolume + 1);
      const logCand = Math.log10(candidateTotalVolume + 1);
      const logDiff = Math.abs(logTreat - logCand);
      const featureVolumeScore = Math.max(0, 1.0 - Math.min(1.0, logDiff / 2.0));

      // --- Feature 3: Pre-Period Baseline Trend & Linear Slope Matching (0 to 1.0) ---
      const candidateSlope = calcTrendSlope(candidateGscFacts);
      const slopeDelta = Math.abs(treatmentSlope - candidateSlope);
      const featureSlopeScore = Math.max(0.1, 1.0 - Math.min(1.0, slopeDelta / (Math.abs(treatmentSlope) + 1.0)));

      // --- Feature 4: Internal Link In-Degree Graph Proximity (0 to 1.0) ---
      const linkDiff = Math.abs(treatmentInlinks - candidateInlinks);
      const featureGraphScore = Math.max(0, 1.0 - linkDiff / Math.max(10, treatmentInlinks + candidateInlinks + 1));

      // Composite Weighted Similarity Score
      const compositeSimilarity =
        this.WEIGHT_ARCHETYPE * featureArchetypeScore +
        this.WEIGHT_VOLUME * featureVolumeScore +
        this.WEIGHT_SLOPE * featureSlopeScore +
        this.WEIGHT_GRAPH * featureGraphScore;

      const features: SyntheticControlFeatureBreakdown = {
        archetypeSimilarity: Number(featureArchetypeScore.toFixed(4)),
        depthDelta,
        volumeSimilarity: Number(featureVolumeScore.toFixed(4)),
        slopeSimilarity: Number(featureSlopeScore.toFixed(4)),
        graphSimilarity: Number(featureGraphScore.toFixed(4)),
        treatmentVolume: treatmentTotalVolume,
        candidateVolume: candidateTotalVolume,
        treatmentInlinks,
        candidateInlinks,
      };

      if (compositeSimilarity >= MIN_CONTROL_SIMILARITY) {
        scoredCandidates.push({
          controlUrlId: candidate.id,
          controlUrl: candidate.normalizedUrl,
          similarityScore: Number(compositeSimilarity.toFixed(4)),
          features,
          baselinePreClicks: candidatePreClicks,
          baselinePostClicks: 0,
        });
      }
    }

    // Sort descending by similarity score and take top k
    scoredCandidates.sort((a, b) => b.similarityScore - a.similarityScore);
    return scoredCandidates.slice(0, k);
  }

  /**
   * Persists synthetic control matches to the database for causal reference.
   * Ensures idempotency by removing prior matches for the attributionFactId if present.
   */
  public static async persistControlMatches(
    websiteId: string,
    treatmentUrlId: string,
    matches: SyntheticControlMatchResult[],
    attributionFactId?: string
  ): Promise<void> {
    if (attributionFactId) {
      try {
        await prisma.syntheticControlMatch.deleteMany({
          where: { attributionFactId },
        });
      } catch {
        // ignore
      }
    }

    for (const m of matches) {
      await prisma.syntheticControlMatch.create({
        data: {
          websiteId,
          treatmentUrlId,
          controlUrlId: m.controlUrlId,
          attributionFactId: attributionFactId || null,
          similarityScore: m.similarityScore,
          matchingFeaturesJson: JSON.stringify(m.features),
          baselinePreClicks: m.baselinePreClicks,
          baselinePostClicks: m.baselinePostClicks,
          baselinePreRank: m.baselinePreRank || null,
          baselinePostRank: m.baselinePostRank || null,
        },
      });
    }
  }

  /**
   * Evaluates synthetic control suitability over a history series.
   */
  public static selectSyntheticControl(params: {
    treatmentUrl: string;
    treatmentPreHistory: Array<{ date: string; clicks: number; impressions: number }>;
    candidatePool: Array<{ url: string; metrics: Array<{ date: string; clicks: number; impressions: number }> }>;
  }): {
    isValidControl: boolean;
    similarityScore: number;
    selectedControlUrl?: string;
  } {
    const { treatmentUrl, treatmentPreHistory, candidatePool } = params;
    if (!treatmentPreHistory || treatmentPreHistory.length < MIN_CONTROL_HISTORY_DAYS || candidatePool.length === 0) {
      return { isValidControl: false, similarityScore: 0 };
    }

    let bestScore = -1;
    let bestUrl: string | undefined;

    const treatClicks = treatmentPreHistory.map(p => p.clicks);
    const treatMean = treatClicks.reduce((a, b) => a + b, 0) / treatClicks.length;

    for (const cand of candidatePool) {
      if (cand.metrics.length < MIN_CONTROL_HISTORY_DAYS) continue;

      const candClicks = cand.metrics.map(p => p.clicks);
      const candMean = candClicks.reduce((a, b) => a + b, 0) / candClicks.length;

      // Pearson correlation
      let num = 0;
      let denomTreat = 0;
      let denomCand = 0;

      for (let i = 0; i < Math.min(treatClicks.length, candClicks.length); i++) {
        const dt = treatClicks[i] - treatMean;
        const dc = candClicks[i] - candMean;
        num += dt * dc;
        denomTreat += dt * dt;
        denomCand += dc * dc;
      }

      const denom = Math.sqrt(denomTreat * denomCand);
      const correlation = denom > 0 ? num / denom : 0;

      if (correlation > bestScore) {
        bestScore = correlation;
        bestUrl = cand.url;
      }
    }

    const similarity = Math.max(0, Number(bestScore.toFixed(4)));
    const isValidControl = similarity >= MIN_CONTROL_SIMILARITY;

    return {
      isValidControl,
      similarityScore: similarity,
      selectedControlUrl: isValidControl ? bestUrl : undefined,
    };
  }
}


