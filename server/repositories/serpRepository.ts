import { prisma } from '../db/prisma';
import { SerpDevice, SerpFeatureType, Prisma } from '@prisma/client';
import { RawSerpResponse } from '../services/serp/providers/serpProvider';
import { VisibilityModelEngine } from '../services/serp/visibilityModelEngine';
import { UrlNormalizer } from '../services/crawler/urlNormalizer';

export interface IngestSerpSnapshotInput {
  websiteId: string;
  keywordId: string;
  rawResponse: RawSerpResponse;
  targetDomain: string;
  searchVolume?: number | null;
}

export class SerpRepository {
  static async saveSerpSnapshotAndFacts(input: IngestSerpSnapshotInput) {
    const { websiteId, keywordId, rawResponse, targetDomain, searchVolume } = input;
    const normTargetDomain = targetDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 1. Identify Target Website Results & URLs in Top 100
    const targetResults = rawResponse.organicResults.filter((r) => {
      const d = r.domain.replace(/^www\./, '').toLowerCase();
      return d === normTargetDomain || r.url.toLowerCase().includes(normTargetDomain);
    });

    const bestTargetResult = targetResults.length > 0 ? targetResults[0] : null;
    const ourRank = bestTargetResult ? bestTargetResult.position : null;
    const ourRankedUrl = bestTargetResult ? bestTargetResult.url : null;
    const hasMultipleRankings = targetResults.length > 1;

    // 2. Reconcile Target URL with UrlIdentity if available
    let ourUrlIdentityId: string | null = null;
    if (ourRankedUrl) {
      try {
        const normalizedUrl = UrlNormalizer.normalize(ourRankedUrl, `https://${normTargetDomain}`);
        const urlId = await prisma.urlIdentity.findFirst({
          where: { websiteId, normalizedUrl },
        });
        if (urlId) {
          ourUrlIdentityId = urlId.id;
        }
      } catch {
        // Fallback gracefully
      }
    }

    // 3. Feature Aggregations
    const featureTypes = rawResponse.features.map((f) => f.featureType);
    const aiOverviewFeature = rawResponse.features.find((f) => f.featureType === SerpFeatureType.AI_OVERVIEW);
    const featuredSnippetFeature = rawResponse.features.find((f) => f.featureType === SerpFeatureType.FEATURED_SNIPPET);

    const isTargetCitedInAiOverview = aiOverviewFeature?.sourceUrls?.some((u) => u.toLowerCase().includes(normTargetDomain)) ?? false;
    const isTargetFeaturedSnippetOwner = featuredSnippetFeature?.domain?.toLowerCase().includes(normTargetDomain) ?? false;

    // 4. Calculate Dynamic Visibility
    const visibility = VisibilityModelEngine.calculate({
      position: ourRank,
      device: rawResponse.device,
      searchVolume,
      featuresPresent: featureTypes,
      isTargetCitedInAiOverview,
      isTargetFeaturedSnippetOwner,
    });

    // 5. Create SerpSnapshot Record
    const snapshot = await prisma.serpSnapshot.create({
      data: {
        websiteId,
        keywordId,
        keywordText: rawResponse.keyword,
        device: rawResponse.device,
        countryCode: rawResponse.countryCode,
        languageCode: rawResponse.languageCode,
        provider: rawResponse.provider,
        rawPayloadHash: rawResponse.rawPayloadHash,
        rawResponseJson: rawResponse.rawJson, // Short-term raw JSON
        totalResults: rawResponse.totalResults,
        searchEngine: rawResponse.searchEngine,
        ourRank,
        ourRankedUrl,
        ourUrlIdentityId,
        ourPixelTop: bestTargetResult?.pixelTop,
        hasMultipleRankings,
        snapshotDate: rawResponse.retrievedAt,
        provenanceSource: rawResponse.provider,
        provenanceMethod: 'API_POLL',
        provenanceTimestamp: rawResponse.retrievedAt,
      },
    });

    // 6. Create SerpItems (Organic Results)
    for (const item of rawResponse.organicResults) {
      const isTarget = item.domain.replace(/^www\./, '').toLowerCase() === normTargetDomain;
      await prisma.serpItem.create({
        data: {
          snapshotId: snapshot.id,
          position: item.position,
          domain: item.domain,
          url: item.url,
          title: item.title,
          snippet: item.snippet,
          displayUrl: item.displayUrl,
          isTargetWebsite: isTarget,
          urlIdentityId: isTarget ? ourUrlIdentityId : null,
          pixelTop: item.pixelTop,
          pixelHeight: item.pixelHeight,
        },
      });
    }

    // 7. Create SerpFeatureOccurrences
    for (const feat of rawResponse.features) {
      const citedTarget = feat.sourceUrls?.some((u) => u.toLowerCase().includes(normTargetDomain)) || false;
      await prisma.serpFeatureOccurrence.create({
        data: {
          snapshotId: snapshot.id,
          featureType: feat.featureType,
          position: feat.position,
          title: feat.title,
          snippet: feat.snippet,
          targetUrl: feat.targetUrl,
          domain: feat.domain,
          sourceUrls: feat.sourceUrls || [],
          isTargetWebsiteCited: citedTarget,
          targetUrlIdentityId: citedTarget ? ourUrlIdentityId : null,
          pixelTop: feat.pixelTop,
          pixelHeight: feat.pixelHeight,
          rawFeatureJson: feat.rawFeatureJson,
        },
      });
    }

    // 8. Upsert Authoritative KeywordRankDaily Fact
    const existingFact = await prisma.keywordRankDaily.findFirst({
      where: {
        websiteId,
        keywordId,
        device: rawResponse.device,
        countryCode: rawResponse.countryCode,
        date: today,
      },
    });

    const previousFact = await prisma.keywordRankDaily.findFirst({
      where: {
        websiteId,
        keywordId,
        device: rawResponse.device,
        countryCode: rawResponse.countryCode,
        date: { lt: today },
      },
      orderBy: { date: 'desc' },
    });

    const previousRank = previousFact?.rank ?? null;
    const rankChange = previousRank && ourRank ? previousRank - ourRank : null;

    let rankDailyFact;
    if (existingFact) {
      rankDailyFact = await prisma.keywordRankDaily.update({
        where: { id: existingFact.id },
        data: {
          rank: ourRank,
          previousRank,
          rankChange,
          rankedUrl: ourRankedUrl,
          rankedUrlIdentityId: ourUrlIdentityId,
          hasFeaturedSnippet: isTargetFeaturedSnippetOwner,
          hasAiOverviewCitation: isTargetCitedInAiOverview,
          aiOverviewOnSerp: featureTypes.includes(SerpFeatureType.AI_OVERVIEW),
          totalFeaturesOnSerp: rawResponse.features.length,
          visibilityWeight: visibility.visibilityWeight,
          visibilityScore: visibility.visibilityScore,
          ctrModelUsed: visibility.ctrModelUsed,
          snapshotId: snapshot.id,
          provenanceTimestamp: new Date(),
        },
      });
    } else {
      rankDailyFact = await prisma.keywordRankDaily.create({
        data: {
          websiteId,
          keywordId,
          date: today,
          device: rawResponse.device,
          countryCode: rawResponse.countryCode,
          rank: ourRank,
          previousRank,
          rankChange,
          rankedUrl: ourRankedUrl,
          rankedUrlIdentityId: ourUrlIdentityId,
          hasFeaturedSnippet: isTargetFeaturedSnippetOwner,
          hasAiOverviewCitation: isTargetCitedInAiOverview,
          aiOverviewOnSerp: featureTypes.includes(SerpFeatureType.AI_OVERVIEW),
          totalFeaturesOnSerp: rawResponse.features.length,
          visibilityWeight: visibility.visibilityWeight,
          visibilityScore: visibility.visibilityScore,
          ctrModelUsed: visibility.ctrModelUsed,
          snapshotId: snapshot.id,
          provenanceSource: rawResponse.provider,
          provenanceMethod: 'DAILY_AGGREGATE',
          provenanceTimestamp: new Date(),
        },
      });
    }

    return {
      snapshot,
      rankDailyFact,
      previousSnapshotRank: previousRank,
      currentRank: ourRank,
      visibility,
      targetResults,
    };
  }

  static async getLatestSnapshot(keywordId: string, device: SerpDevice = SerpDevice.DESKTOP) {
    const snapshot: any = await prisma.serpSnapshot.findFirst({
      where: { keywordId, device },
      orderBy: { snapshotDate: 'desc' },
      include: {
        serpItems: { orderBy: { position: 'asc' } },
        featureOccurrences: true,
      },
    });
    if (!snapshot) return null;
    if (!snapshot.serpItems) {
      snapshot.serpItems = await prisma.serpItem.findMany({
        where: { snapshotId: snapshot.id },
        orderBy: { position: 'asc' },
      });
    }
    if (!snapshot.featureOccurrences) {
      snapshot.featureOccurrences = await prisma.serpFeatureOccurrence.findMany({
        where: { snapshotId: snapshot.id },
      });
    }
    return snapshot;
  }

  static async getRankHistory(keywordId: string, device: SerpDevice = SerpDevice.DESKTOP, days = 30) {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    return await prisma.keywordRankDaily.findMany({
      where: {
        keywordId,
        device,
        date: { gte: sinceDate },
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Short-term retention cleanup: clears raw JSON response payloads older than retentionDays
   * while leaving parsed items, features, and facts fully intact.
   */
  static async pruneRawSerpJson(olderThanDays = 14) {
    const cutoffDate = new Date(Date.now() - olderThanDays * 86400 * 1000 + (olderThanDays === 0 ? 5000 : 0));

    const oldSnapshots = await prisma.serpSnapshot.findMany({
      where: {
        snapshotDate: { lte: cutoffDate },
        rawResponseJson: { not: null },
      },
      select: { id: true },
    });

    for (const snap of oldSnapshots) {
      await prisma.serpSnapshot.update({
        where: { id: snap.id },
        data: { rawResponseJson: null },
      });
    }

    return { prunedCount: oldSnapshots.length };
  }
}
