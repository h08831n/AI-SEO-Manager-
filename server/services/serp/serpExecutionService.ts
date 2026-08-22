import { prisma } from '../../db/prisma';
import { SerpProviderRouter } from './providers/serpProviderRouter';
import { ISerpProvider } from './providers/serpProvider';
import { SerpRepository } from '../../repositories/serpRepository';
import { SerpEventEngine } from './serpEventEngine';
import { KeywordRepository } from '../../repositories/keywordRepository';
import { CompetitorRepository } from '../../repositories/competitorRepository';
import { SerpProviderTimeoutError } from './serpErrors';
import { SerpDevice } from '@prisma/client';

export type SerpExecutionLifecycleStage =
  | 'QUEUE_CREATED'
  | 'PROCESSING'
  | 'PROVIDER_FETCH'
  | 'SNAPSHOT_CREATED'
  | 'RANK_FACT_CREATED'
  | 'EVENT_ANALYSIS'
  | 'RECOMMENDATION_CREATED'
  | 'COMPLETED';

export interface ExecuteSerpCheckInput {
  websiteId: string;
  keywordId: string;
  device?: SerpDevice;
  countryCode?: string;
  preferredProvider?: string;
  timeoutMs?: number;
  onLifecycleStage?: (stage: SerpExecutionLifecycleStage, metadata?: any) => Promise<void> | void;
}

export interface SerpExecutionResult {
  success: boolean;
  keywordId: string;
  keyword: string;
  device: SerpDevice;
  currentRank: number | null;
  previousRank: number | null;
  visibility: any;
  snapshotId: string;
  emittedEvents: any[];
  lifecycleStages: SerpExecutionLifecycleStage[];
  recommendationsCount: number;
}

export class SerpExecutionService {
  static async executeKeywordSerpCheck(input: ExecuteSerpCheckInput): Promise<SerpExecutionResult> {
    const {
      websiteId,
      keywordId,
      device = SerpDevice.DESKTOP,
      countryCode = 'US',
      preferredProvider,
      timeoutMs = 15000,
      onLifecycleStage,
    } = input;

    const completedStages: SerpExecutionLifecycleStage[] = [];

    const reportStage = async (stage: SerpExecutionLifecycleStage, meta?: any) => {
      completedStages.push(stage);
      if (onLifecycleStage) {
        try {
          await onLifecycleStage(stage, meta);
        } catch {
          // ignore stage listener failures
        }
      }
    };

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

    // Provider router resolution (Service -> SerpProviderRouter -> ISerpProvider)
    const provider: ISerpProvider = SerpProviderRouter.getProvider(preferredProvider);

    // 2. Stage: PROVIDER_FETCH with timeout safety
    await reportStage('PROVIDER_FETCH', { provider: provider.providerName, keyword: keyword.keyword });

    let fetchPromise = provider.fetchSerp({
      keyword: keyword.keyword,
      device,
      countryCode,
      targetDomain,
    });

    let timer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new SerpProviderTimeoutError(`Provider ${provider.providerName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    let rawResponse;
    try {
      rawResponse = await Promise.race([fetchPromise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }

    // 3. Stage: SNAPSHOT_CREATED
    const { snapshot, rankDailyFact, previousSnapshotRank, currentRank, visibility, targetResults } =
      await SerpRepository.saveSerpSnapshotAndFacts({
        websiteId,
        keywordId,
        rawResponse,
        targetDomain,
        searchVolume: keyword.searchVolume,
      });

    await reportStage('SNAPSHOT_CREATED', { snapshotId: snapshot.id, currentRank });

    // 4. Stage: RANK_FACT_CREATED
    await KeywordRepository.updateLatestRank(keywordId, {
      desktopRank: device === SerpDevice.DESKTOP ? currentRank : undefined,
      mobileRank: device === SerpDevice.MOBILE ? currentRank : undefined,
    });

    await reportStage('RANK_FACT_CREATED', {
      rankDailyFactId: rankDailyFact.id,
      currentRank,
      visibilityScore: visibility.visibilityScore,
    });

    // 5. Stage: EVENT_ANALYSIS
    await reportStage('EVENT_ANALYSIS', { previousRank: previousSnapshotRank, currentRank });

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

    // 6. Stage: RECOMMENDATION_CREATED (if any events generated actionable recommendations)
    const actionableEvents = events.filter((e) => e.isActionable && e.recommendationId);
    if (actionableEvents.length > 0) {
      await reportStage('RECOMMENDATION_CREATED', {
        count: actionableEvents.length,
        recommendationIds: actionableEvents.map((e) => e.recommendationId),
      });
    }

    await reportStage('COMPLETED');

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
      lifecycleStages: completedStages,
      recommendationsCount: actionableEvents.length,
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
