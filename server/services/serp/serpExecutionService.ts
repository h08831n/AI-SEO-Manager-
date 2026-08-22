import { prisma } from '../../db/prisma';
import { SerpProviderRouter } from './providers/serpApiAdapter';
import { SerpRepository } from '../../repositories/serpRepository';
import { SerpEventEngine } from './serpEventEngine';
import { KeywordRepository } from '../../repositories/keywordRepository';
import { CompetitorRepository } from '../../repositories/competitorRepository';
import { SerpDevice } from '@prisma/client';

export interface ExecuteSerpCheckInput {
  websiteId: string;
  keywordId: string;
  device?: SerpDevice;
  countryCode?: string;
  preferredProvider?: string;
}

export class SerpExecutionService {
  static async executeKeywordSerpCheck(input: ExecuteSerpCheckInput) {
    const { websiteId, keywordId, device = SerpDevice.DESKTOP, countryCode = 'US', preferredProvider } = input;

    // 1. Load Keyword & Website
    const keyword = await prisma.keywordUniverse.findFirst({
      where: { id: keywordId, websiteId },
      include: { website: true },
    });
    if (!keyword) {
      throw new Error(`Keyword '${keywordId}' not found for website '${websiteId}'`);
    }

    const website = (keyword as any).website || (await prisma.website.findUnique({ where: { id: websiteId } }));
    const targetDomain = website?.domain || 'example.com';
    const provider = SerpProviderRouter.getProvider(preferredProvider);

    // 2. Fetch SERP
    const rawResponse = await provider.fetchSerp({
      keyword: keyword.keyword,
      device,
      countryCode,
      targetDomain,
    });

    // 3. Save Snapshot, Features, and Daily Rank Fact
    const { snapshot, rankDailyFact, previousSnapshotRank, currentRank, visibility, targetResults } =
      await SerpRepository.saveSerpSnapshotAndFacts({
        websiteId,
        keywordId,
        rawResponse,
        targetDomain,
        searchVolume: keyword.searchVolume,
      });

    // 4. Update Cached Latest Rank in Keyword Universe
    await KeywordRepository.updateLatestRank(keywordId, {
      desktopRank: device === SerpDevice.DESKTOP ? currentRank : undefined,
      mobileRank: device === SerpDevice.MOBILE ? currentRank : undefined,
    });

    // 5. Evaluate and Emit SERP Events & Recommendations
    const events = await SerpEventEngine.evaluateAndEmitEvents({
      websiteId,
      keywordId,
      snapshotId: snapshot.id,
      keywordText: keyword.keyword,
      businessValue: keyword.businessValue,
      searchIntent: keyword.searchIntent,
      currentRank,
      previousRank: previousSnapshotRank,
      currentResponse: rawResponse,
      targetResults,
      targetDomain,
    });

    return {
      success: true,
      keywordId,
      keyword: keyword.keyword,
      device,
      currentRank,
      previousRank: previousSnapshotRank,
      visibility,
      snapshotId: snapshot.id,
      emittedEvents: events,
    };
  }

  static async batchExecuteKeywordChecks(websiteId: string, keywordIds: string[], device: SerpDevice = SerpDevice.DESKTOP) {
    const results = [];
    for (const kwId of keywordIds) {
      try {
        const res = await this.executeKeywordSerpCheck({
          websiteId,
          keywordId: kwId,
          device,
        });
        results.push(res);
      } catch (err: any) {
        results.push({
          success: false,
          keywordId: kwId,
          error: err.message,
        });
      }
    }

    // Refresh Competitor stats after batch
    const website = await prisma.website.findUnique({ where: { id: websiteId } });
    if (website) {
      await CompetitorRepository.refreshCompetitorIntelligence(websiteId, website.domain);
    }

    return {
      total: keywordIds.length,
      processed: results.length,
      results,
    };
  }
}
