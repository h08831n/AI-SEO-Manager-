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

    // 4. Advanced Cannibalization Detection
    // 5-Point Constraint:
    // a. Same keyword & search intent
    // b. Multiple distinct target URLs in top 100 (targetResults >= 2)
    // c. Both URLs are distinct paths
    // d. Volatility / position displacement
    if (targetResults.length >= 2) {
      const urls = targetResults.map((r) => r.url);
      const distinctPaths = new Set(urls.map((u) => {
        try {
          return new URL(u).pathname;
        } catch {
          return u;
        }
      }));

      if (distinctPaths.size >= 2) {
        const topUrl = targetResults[0];
        const secondaryUrl = targetResults[1];

        const event = await this.recordEvent({
          websiteId,
          keywordId,
          snapshotId,
          eventType: SerpEventType.KEYWORD_CANNIBALIZATION_DETECTED,
          severity: 'WARNING',
          description: `Cannibalization detected for "${keywordText}". Multiple pages ranking simultaneously: ${topUrl.url} (#${topUrl.position}) and ${secondaryUrl.url} (#${secondaryUrl.position}).`,
          metadata: {
            keyword: keywordText,
            searchIntent,
            rankingUrls: targetResults.map((r) => ({ url: r.url, position: r.position })),
          },
          recommendationTitle: `Resolve Keyword Cannibalization for "${keywordText}"`,
          recommendationRationale: `Pages "${topUrl.url}" (Pos ${topUrl.position}) and "${secondaryUrl.url}" (Pos ${secondaryUrl.position}) compete for the same search intent. Consolidate topical signals using canonical tags or 301 redirects to strengthen the primary target page.`,
        });
        emittedEvents.push(event);
      }
    }

    return emittedEvents;
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
