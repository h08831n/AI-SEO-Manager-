import { prisma } from '../../db/prisma';
import { KeywordRepository, CreateKeywordInput } from '../../repositories/keywordRepository';
import { IntentClassifierService } from './intentClassifierService';
import { KeywordMetricProviderRouter } from './metricProviders/keywordMetricProvider';
import { KeywordDiscoverySource } from '@prisma/client';

export class KeywordDiscoveryPipeline {
  /**
   * Discover and ingest keywords from Google Search Console facts
   */
  static async discoverFromGsc(websiteId: string, minImpressions = 10, limit = 50) {
    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) throw new Error(`Website '${websiteId}' not found`);

    const gscFacts = await prisma.gscSearchAnalyticsFact.findMany({
      where: {
        websiteId,
        query: { not: null },
        impressions: { gte: minImpressions },
      },
      orderBy: { impressions: 'desc' },
      take: limit * 2,
    });

    const metricProvider = KeywordMetricProviderRouter.getProvider();
    const discovered = [];

    // Deduplicate queries
    const seenQueries = new Set<string>();

    for (const fact of gscFacts) {
      if (!fact.query) continue;
      const norm = KeywordRepository.normalizeKeyword(fact.query);
      if (seenQueries.has(norm)) continue;
      seenQueries.add(norm);

      const classification = IntentClassifierService.classify(fact.query, website.domain);
      const metrics = await metricProvider.getMetrics({ keyword: fact.query });

      const input: CreateKeywordInput = {
        websiteId,
        keyword: fact.query,
        searchIntent: classification.searchIntent,
        intentConfidence: classification.intentConfidence,
        funnelStage: classification.funnelStage,
        businessValue: classification.businessValue,
        conversionIntent: classification.conversionIntent,
        moneyKeyword: classification.moneyKeyword,
        conversionGoal: classification.conversionGoal,
        targetUrl: fact.pageUrl || undefined,
        discoverySource: KeywordDiscoverySource.GSC_INGESTION,
        searchVolume: metrics.searchVolume,
        cpc: metrics.cpc,
        competitionIndex: metrics.competitionIndex,
        metricSource: metrics.source,
        provenanceSource: 'GSC_SEARCH_ANALYTICS',
        provenanceMethod: 'IMPRESSION_HARVESTING',
      };

      const kw = await KeywordRepository.upsertKeyword(input);
      discovered.push(kw);
      if (discovered.length >= limit) break;
    }

    return {
      source: 'GSC_INGESTION',
      count: discovered.length,
      keywords: discovered,
    };
  }

  /**
   * Discover keywords from Phase 2 Crawled Page metadata (Titles, H1 headers)
   */
  static async discoverFromCrawl(websiteId: string, limit = 50) {
    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) throw new Error(`Website '${websiteId}' not found`);

    const crawledPages = await prisma.crawledPage.findMany({
      where: { websiteId, statusCode: 200 },
      take: 100,
    });

    const discovered = [];
    const seenQueries = new Set<string>();
    const metricProvider = KeywordMetricProviderRouter.getProvider();

    for (const page of crawledPages) {
      const candidates: string[] = [];
      if (page.title) {
        // Clean title (remove brand suffix)
        const cleanTitle = page.title.split(/[-|–]/)[0].trim();
        if (cleanTitle.length > 3 && cleanTitle.length < 60) {
          candidates.push(cleanTitle);
        }
      }
      if (page.h1Tags && Array.isArray(page.h1Tags)) {
        for (const h1 of page.h1Tags) {
          if (h1.length > 3 && h1.length < 60) {
            candidates.push(h1.trim());
          }
        }
      }

      for (const cand of candidates) {
        const norm = KeywordRepository.normalizeKeyword(cand);
        if (seenQueries.has(norm)) continue;
        seenQueries.add(norm);

        const classification = IntentClassifierService.classify(cand, website.domain);
        const metrics = await metricProvider.getMetrics({ keyword: cand });

        const input: CreateKeywordInput = {
          websiteId,
          keyword: cand,
          searchIntent: classification.searchIntent,
          intentConfidence: classification.intentConfidence,
          funnelStage: classification.funnelStage,
          businessValue: classification.businessValue,
          conversionIntent: classification.conversionIntent,
          moneyKeyword: classification.moneyKeyword,
          targetUrl: page.url,
          targetUrlIdentityId: undefined,
          discoverySource: KeywordDiscoverySource.CRAWL_EXTRACTION,
          searchVolume: metrics.searchVolume,
          cpc: metrics.cpc,
          competitionIndex: metrics.competitionIndex,
          metricSource: metrics.source,
          provenanceSource: 'TECHNICAL_CRAWLER',
          provenanceMethod: 'TITLE_H1_EXTRACTION',
        };

        const kw = await KeywordRepository.upsertKeyword(input);
        discovered.push(kw);
        if (discovered.length >= limit) break;
      }
      if (discovered.length >= limit) break;
    }

    return {
      source: 'CRAWL_EXTRACTION',
      count: discovered.length,
      keywords: discovered,
    };
  }

  /**
   * Seed keywords from manual text list or array
   */
  static async importSeeds(websiteId: string, keywords: string[]) {
    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    if (!website) throw new Error(`Website '${websiteId}' not found`);

    const metricProvider = KeywordMetricProviderRouter.getProvider();
    const imported = [];

    for (const raw of keywords) {
      if (!raw || typeof raw !== 'string') continue;
      const kwStr = raw.trim();
      if (!kwStr) continue;

      const classification = IntentClassifierService.classify(kwStr, website.domain);
      const metrics = await metricProvider.getMetrics({ keyword: kwStr });

      const input: CreateKeywordInput = {
        websiteId,
        keyword: kwStr,
        searchIntent: classification.searchIntent,
        intentConfidence: classification.intentConfidence,
        funnelStage: classification.funnelStage,
        businessValue: classification.businessValue,
        conversionIntent: classification.conversionIntent,
        moneyKeyword: classification.moneyKeyword,
        conversionGoal: classification.conversionGoal,
        discoverySource: KeywordDiscoverySource.MANUAL_SEED,
        searchVolume: metrics.searchVolume,
        cpc: metrics.cpc,
        competitionIndex: metrics.competitionIndex,
        metricSource: metrics.source,
        provenanceSource: 'MANUAL_IMPORT',
        provenanceMethod: 'SEED_LIST',
      };

      const kw = await KeywordRepository.upsertKeyword(input);
      imported.push(kw);
    }

    return {
      source: 'MANUAL_SEED',
      count: imported.length,
      keywords: imported,
    };
  }
}
