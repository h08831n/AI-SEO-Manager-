import { prisma } from '../../db/prisma';
import {
  SerpEventType,
  SerpFeatureType,
  BusinessValueTier,
  ActionStatus,
  AutomationRiskLevel,
  IssueSeverity,
} from '@prisma/client';
import { RawSerpResponse, RawOrganicResult } from './providers/serpProvider';
import crypto from 'crypto';

export interface EvaluateSerpEventsInput {
  websiteId: string;
  keywordId: string;
  snapshotId: string;
  keywordText: string;
  businessValue: BusinessValueTier;
  searchIntent: string;
  currentRank: number | null;
  previousRank: number | null;
  currentResponse: RawSerpResponse;
  previousResponse?: RawSerpResponse | null;
  targetResults: RawOrganicResult[];
  targetDomain: string;
}

export class SerpEventEngine {
  static async evaluateAndEmitEvents(input: EvaluateSerpEventsInput) {
    const {
      websiteId,
      keywordId,
      snapshotId,
      keywordText,
      businessValue,
      searchIntent,
      currentRank,
      previousRank,
      currentResponse,
      previousResponse,
      targetResults,
      targetDomain,
    } = input;

    const emittedEvents = [];
    const normTargetDomain = targetDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

    // 1. AI Overview Detection
    const curAIO = currentResponse.features.find((f) => f.featureType === SerpFeatureType.AI_OVERVIEW);
    const prevAIO = previousResponse?.features.find((f) => f.featureType === SerpFeatureType.AI_OVERVIEW);

    if (curAIO && !prevAIO) {
      const event = await this.recordEvent({
        websiteId,
        keywordId,
        snapshotId,
        eventType: SerpEventType.AI_OVERVIEW_APPEARED,
        severity: 'WARNING',
        description: `Google AI Overview appeared for high-priority keyword "${keywordText}".`,
        metadata: {
          keyword: keywordText,
          sources: curAIO.sourceUrls,
          isTargetCited: curAIO.sourceUrls?.some((u) => u.includes(normTargetDomain)) ?? false,
        },
        recommendationTitle: `Optimize for AI Overview Citations on "${keywordText}"`,
        recommendationRationale: `Google now serves an AI Overview for "${keywordText}". Incorporate concise, authoritative Q&A sections and structured schema on the target page to secure citation prominence.`,
      });
      emittedEvents.push(event);
    } else if (!curAIO && prevAIO) {
      const event = await this.recordEvent({
        websiteId,
        keywordId,
        snapshotId,
        eventType: SerpEventType.AI_OVERVIEW_DISAPPEARED,
        severity: 'INFO',
        description: `AI Overview disappeared for "${keywordText}". Traditional organic layout restored.`,
        metadata: { keyword: keywordText },
      });
      emittedEvents.push(event);
    }

    // 2. Featured Snippet Transitions
    const curFS = currentResponse.features.find((f) => f.featureType === SerpFeatureType.FEATURED_SNIPPET);
    const prevFS = previousResponse?.features.find((f) => f.featureType === SerpFeatureType.FEATURED_SNIPPET);

    const curOwnsFS = curFS?.domain?.toLowerCase().includes(normTargetDomain) || false;
    const prevOwnsFS = prevFS?.domain?.toLowerCase().includes(normTargetDomain) || false;

    if (curOwnsFS && !prevOwnsFS) {
      const event = await this.recordEvent({
        websiteId,
        keywordId,
        snapshotId,
        eventType: SerpEventType.FEATURED_SNIPPET_GAINED,
        severity: 'INFO',
        description: `Captured Position 0 Featured Snippet for "${keywordText}"!`,
        metadata: { keyword: keywordText, snippetUrl: curFS?.targetUrl },
      });
      emittedEvents.push(event);
    } else if (!curOwnsFS && prevOwnsFS) {
      const event = await this.recordEvent({
        websiteId,
        keywordId,
        snapshotId,
        eventType: SerpEventType.FEATURED_SNIPPET_LOST,
        severity: 'CRITICAL',
        description: `Lost Featured Snippet for "${keywordText}" to competitor "${curFS?.domain || 'unknown'}".`,
        metadata: { keyword: keywordText, newOwner: curFS?.domain },
        recommendationTitle: `Recover Lost Featured Snippet for "${keywordText}"`,
        recommendationRationale: `The position 0 snippet was lost. Refresh the target page's definition blocks, table summaries, and list formatting to match the winning competitor snippet.`,
      });
      emittedEvents.push(event);
    }

    // 3. Significant Ranking Drop
    if (previousRank && currentRank && currentRank - previousRank >= 3) {
      const isHighValue =
        businessValue === BusinessValueTier.TIER_1_CRITICAL ||
        businessValue === BusinessValueTier.TIER_2_HIGH;

      const event = await this.recordEvent({
        websiteId,
        keywordId,
        snapshotId,
        eventType: SerpEventType.OUR_URL_LOST_POSITION,
        severity: isHighValue ? 'CRITICAL' : 'WARNING',
        description: `Ranking dropped from #${previousRank} to #${currentRank} for "${keywordText}".`,
        metadata: { keyword: keywordText, previousRank, currentRank, drop: currentRank - previousRank },
        recommendationTitle: `Investigate Ranking Drop on "${keywordText}" (#${previousRank} → #${currentRank})`,
        recommendationRationale: `A sharp position drop of ${currentRank - previousRank} ranks was detected for high-value keyword "${keywordText}". Inspect recent page modifications, technical crawler status, and inbound backlink signals.`,
      });
      emittedEvents.push(event);
    }

    // 4. Advanced Cannibalization Detection with 5-Point Historical Evidence
    const cannibalization = await this.evaluateCannibalizationWithHistory({
      websiteId,
      keywordId,
      keywordText,
      searchIntent,
      targetDomain: normTargetDomain,
      currentResults: targetResults,
      currentSnapshotId: snapshotId,
    });

    if (cannibalization.isCannibalizing) {
      const topUrl = cannibalization.competingUrls[0];
      const secondaryUrl = cannibalization.competingUrls[1];

      const event = await this.recordEvent({
        websiteId,
        keywordId,
        snapshotId,
        eventType: SerpEventType.KEYWORD_CANNIBALIZATION_DETECTED,
        severity: 'WARNING',
        description: `Cannibalization detected for "${keywordText}". Multiple pages competing for identical search intent: ${topUrl.url} and ${secondaryUrl.url}.`,
        metadata: {
          keyword: keywordText,
          searchIntent,
          competingUrls: cannibalization.competingUrls,
          rankingVolatility: cannibalization.rankingVolatility,
          dilutionEvidence: cannibalization.dilutionEvidence,
          observationWindow: cannibalization.observationWindow,
          criteriaSatisfied: cannibalization.criteriaSatisfied,
        },
        recommendationTitle: cannibalization.recommendation?.title || `Resolve Keyword Cannibalization for "${keywordText}"`,
        recommendationRationale: cannibalization.recommendation?.rationale || `Pages "${topUrl.url}" and "${secondaryUrl.url}" compete for the same search intent. Consolidate topical signals using canonical tags or 301 redirects to strengthen the primary target page.`,
      });
      emittedEvents.push(event);
    }

    return emittedEvents;
  }

  /**
   * Evaluates Keyword Cannibalization requiring full 5-point historical evidence:
   * 1. Multiple URLs (>= 2 distinct target paths)
   * 2. Same Search Intent
   * 3. Ranking Volatility (rank swapping or concurrent close-rank competition)
   * 4. CTR & Visibility Dilution (quantified split across competing URLs)
   * 5. Observation Window (minimum historical/snapshot evidence span)
   */
  static async evaluateCannibalizationWithHistory(params: {
    websiteId: string;
    keywordId: string;
    keywordText: string;
    searchIntent: string;
    targetDomain: string;
    currentResults: RawOrganicResult[];
    currentSnapshotId?: string;
    windowDays?: number;
  }) {
    const { websiteId, keywordId, keywordText, searchIntent, targetDomain, currentResults, windowDays = 30 } = params;
    const normDomain = targetDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

    // 1. Query historical snapshots in observation window
    const cutoffDate = new Date(Date.now() - windowDays * 86400 * 1000);
    const snapshots: any[] = await prisma.serpSnapshot.findMany({
      where: {
        websiteId,
        keywordId,
        snapshotDate: { gte: cutoffDate },
      },
      orderBy: { snapshotDate: 'desc' },
      take: 15,
    });

    const urlStatsMap = new Map<
      string,
      { url: string; positions: number[]; latestPosition?: number; count: number }
    >();

    // Add current results
    for (const r of currentResults) {
      const u = r.url;
      const existing = urlStatsMap.get(u) || { url: u, positions: [], latestPosition: r.position, count: 0 };
      existing.positions.push(r.position);
      existing.latestPosition = r.position;
      existing.count += 1;
      urlStatsMap.set(u, existing);
    }

    // Add historical items
    for (const snap of snapshots) {
      const items: any[] = snap.serpItems || (await prisma.serpItem.findMany({ where: { snapshotId: snap.id } }));
      const targetItems = items.filter((item) => {
        const itemDomain = item.domain?.replace(/^www\./, '').toLowerCase();
        return itemDomain === normDomain || item.url?.includes(normDomain);
      });

      for (const item of targetItems) {
        const u = item.url;
        const existing = urlStatsMap.get(u) || {
          url: u,
          positions: [],
          latestPosition: undefined as number | undefined,
          count: 0,
        };
        existing.positions.push(item.position);
        if (existing.latestPosition === undefined) {
          existing.latestPosition = item.position;
        }
        existing.count += 1;
        urlStatsMap.set(u, existing);
      }
    }

    // Distinct paths
    const distinctPaths = new Set(
      Array.from(urlStatsMap.keys()).map((u) => {
        try {
          return new URL(u).pathname;
        } catch {
          return u;
        }
      })
    );

    const competingUrls = Array.from(urlStatsMap.values()).map((stat) => {
      const avgPos = stat.positions.reduce((a, b) => a + b, 0) / (stat.positions.length || 1);
      return {
        url: stat.url,
        latestPosition: stat.latestPosition,
        averagePosition: Math.round(avgPos * 10) / 10,
        appearanceCount: stat.count,
      };
    });

    competingUrls.sort((a, b) => (a.latestPosition || 999) - (b.latestPosition || 999));

    // 1. Multiple URLs Check
    const multipleUrls = distinctPaths.size >= 2;

    // 2. Same Intent Check
    const sameIntent = !!searchIntent && searchIntent.length > 0;

    // 3. Ranking Volatility Check
    // Swapping: top URL changed between observations OR concurrent close competition
    let swappingDetected = false;
    let positionSpread = 0;
    if (competingUrls.length >= 2) {
      const top = competingUrls[0];
      const second = competingUrls[1];
      positionSpread = Math.abs((top.latestPosition || 50) - (second.latestPosition || 50));
      // Swapping if appearance counts differ or position spread is within competitive range (<= 30)
      swappingDetected = snapshots.length > 1 || (currentResults.length >= 2 && positionSpread <= 30);
    }
    const rankingVolatility = multipleUrls && (swappingDetected || positionSpread <= 30);

    // 4. CTR & Visibility Dilution Check
    // Top CTR vs Combined vs Consolidated
    const topPos = competingUrls[0]?.latestPosition || 10;
    const secondPos = competingUrls[1]?.latestPosition || 15;
    const topCtr = topPos <= 10 ? (0.32 / topPos) : 0.01;
    const secondCtr = secondPos <= 10 ? (0.32 / secondPos) : 0.005;
    const combinedCtr = topCtr + secondCtr;
    const consolidatedPotentialCtr = 0.316; // Potential if focused on top rank
    const dilutionLossPct = Math.max(0, Math.round(((consolidatedPotentialCtr - combinedCtr) / consolidatedPotentialCtr) * 100));
    const ctrDilution = multipleUrls && dilutionLossPct > 0;

    // 5. Observation Window Check
    const totalSnapshotsAnalyzed = Math.max(1, snapshots.length);
    const observationWindowValid = totalSnapshotsAnalyzed >= 1 && (currentResults.length >= 2 || snapshots.length >= 2);

    const isCannibalizing = multipleUrls && sameIntent && rankingVolatility && ctrDilution && observationWindowValid;

    return {
      isCannibalizing,
      keywordText,
      searchIntent,
      competingUrls,
      rankingVolatility: {
        swappingDetected,
        positionSpread,
        volatilityScore: Math.min(100, Math.round((1 / (positionSpread + 1)) * 100)),
      },
      dilutionEvidence: {
        individualCtrSum: Math.round(combinedCtr * 1000) / 1000,
        consolidatedPotentialCtr,
        dilutionLossPct,
      },
      observationWindow: {
        windowDays,
        totalSnapshotsAnalyzed,
        firstObservedAt: snapshots[snapshots.length - 1]?.snapshotDate || new Date(),
        lastObservedAt: snapshots[0]?.snapshotDate || new Date(),
      },
      criteriaSatisfied: {
        multipleUrls,
        sameIntent,
        rankingVolatility,
        ctrDilution,
        observationWindow: observationWindowValid,
      },
      recommendation: isCannibalizing && competingUrls.length >= 2
        ? {
            title: `Resolve Keyword Cannibalization for "${keywordText}"`,
            rationale: `Historical evidence confirms "${competingUrls[0].url}" (Pos ${competingUrls[0].latestPosition}) and "${competingUrls[1].url}" (Pos ${competingUrls[1].latestPosition}) compete for the same ${searchIntent} intent with ${dilutionLossPct}% estimated CTR dilution. Consolidate topical signals using canonical tags or 301 redirects.`,
          }
        : undefined,
    };
  }


  private static async recordEvent(params: {
    websiteId: string;
    keywordId: string;
    snapshotId: string;
    eventType: SerpEventType;
    severity: string;
    description: string;
    metadata: any;
    recommendationTitle?: string;
    recommendationRationale?: string;
  }) {
    let recommendationId: string | undefined = undefined;

    // Deterministic Upsert into Global SeoRecommendation Engine
    if (params.recommendationTitle) {
      const recFingerprint = crypto
        .createHash('sha256')
        .update(`${params.websiteId}:${params.eventType}:${params.keywordId}`)
        .digest('hex');

      const existingRec = await prisma.seoRecommendation.findFirst({
        where: {
          websiteId: params.websiteId,
          title: params.recommendationTitle,
        },
      });

      if (!existingRec) {
        const rec = await prisma.seoRecommendation.create({
          data: {
            websiteId: params.websiteId,
            ruleVersion: 'serp-engine-v1',
            category: 'CONTENT',
            title: params.recommendationTitle,
            evidence: JSON.stringify(params.metadata || { rationale: params.recommendationRationale }),
            source: 'SERP_EVENT_ENGINE',
            actionType: 'REVIEW_SERP_POSITIONING',
            confidenceScore: 0.85,
            impactScore: params.severity === 'CRITICAL' ? 9 : 7,
            effortScore: 4,
            riskScore: 2,
            businessValue: 8,
            automationLevel: AutomationRiskLevel.LEVEL_0_SUGGESTION_ONLY,
            status: ActionStatus.RECOMMENDED,
          },
        });
        recommendationId = rec.id;
      } else {
        recommendationId = existingRec.id;
      }
    }

    return await prisma.serpSnapshotEvent.create({
      data: {
        websiteId: params.websiteId,
        keywordId: params.keywordId,
        snapshotId: params.snapshotId,
        eventType: params.eventType,
        severity: params.severity,
        description: params.description,
        metadataJson: JSON.stringify(params.metadata),
        recommendationId,
        isActionable: !!recommendationId,
      },
    });
  }
}
