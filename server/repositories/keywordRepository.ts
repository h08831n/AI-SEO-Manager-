import { prisma } from '../db/prisma';
import {
  SearchIntent,
  FunnelStage,
  BusinessValueTier,
  KeywordTrackingStatus,
  KeywordDiscoverySource,
} from '@prisma/client';

export interface CreateKeywordInput {
  websiteId: string;
  keyword: string;
  searchIntent?: SearchIntent;
  intentConfidence?: number;
  funnelStage?: FunnelStage;
  businessValue?: BusinessValueTier;
  conversionIntent?: boolean;
  moneyKeyword?: boolean;
  topicEntityId?: string;
  topicEntityName?: string;
  conversionGoal?: string;
  targetUrl?: string;
  targetUrlIdentityId?: string;
  clusterId?: string;
  trackingStatus?: KeywordTrackingStatus;
  priority?: number;
  tags?: string[];
  discoverySource?: KeywordDiscoverySource;
  searchVolume?: number;
  cpc?: number;
  competitionIndex?: number;
  metricSource?: string;
  provenanceSource?: string;
  provenanceMethod?: string;
}

export interface UpdateKeywordInput {
  searchIntent?: SearchIntent;
  intentConfidence?: number;
  funnelStage?: FunnelStage;
  businessValue?: BusinessValueTier;
  conversionIntent?: boolean;
  moneyKeyword?: boolean;
  topicEntityId?: string | null;
  topicEntityName?: string | null;
  conversionGoal?: string | null;
  targetUrl?: string | null;
  targetUrlIdentityId?: string | null;
  clusterId?: string | null;
  trackingStatus?: KeywordTrackingStatus;
  priority?: number;
  tags?: string[];
  searchVolume?: number | null;
  cpc?: number | null;
  competitionIndex?: number | null;
  metricSource?: string;
}

export interface KeywordFilterOptions {
  trackingStatus?: KeywordTrackingStatus;
  searchIntent?: SearchIntent;
  funnelStage?: FunnelStage;
  businessValue?: BusinessValueTier;
  moneyKeyword?: boolean;
  topicEntityId?: string;
  query?: string;
  limit?: number;
  offset?: number;
}

export class KeywordRepository {
  static normalizeKeyword(kw: string): string {
    return kw
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  static async upsertKeyword(input: CreateKeywordInput) {
    const normalizedKeyword = this.normalizeKeyword(input.keyword);
    const now = new Date();

    const existing = await prisma.keywordUniverse.findFirst({
      where: {
        websiteId: input.websiteId,
        normalizedKeyword,
      },
    });

    if (existing) {
      return await prisma.keywordUniverse.update({
        where: { id: existing.id },
        data: {
          searchIntent: input.searchIntent ?? existing.searchIntent,
          intentConfidence: input.intentConfidence ?? existing.intentConfidence,
          funnelStage: input.funnelStage ?? existing.funnelStage,
          businessValue: input.businessValue ?? existing.businessValue,
          conversionIntent: input.conversionIntent ?? existing.conversionIntent,
          moneyKeyword: input.moneyKeyword ?? existing.moneyKeyword,
          topicEntityId: input.topicEntityId !== undefined ? input.topicEntityId : existing.topicEntityId,
          topicEntityName: input.topicEntityName !== undefined ? input.topicEntityName : existing.topicEntityName,
          conversionGoal: input.conversionGoal !== undefined ? input.conversionGoal : existing.conversionGoal,
          targetUrl: input.targetUrl !== undefined ? input.targetUrl : existing.targetUrl,
          targetUrlIdentityId: input.targetUrlIdentityId !== undefined ? input.targetUrlIdentityId : existing.targetUrlIdentityId,
          clusterId: input.clusterId !== undefined ? input.clusterId : existing.clusterId,
          trackingStatus: input.trackingStatus ?? existing.trackingStatus,
          priority: input.priority ?? existing.priority,
          tags: input.tags ?? existing.tags,
          searchVolume: input.searchVolume !== undefined ? input.searchVolume : existing.searchVolume,
          cpc: input.cpc !== undefined ? input.cpc : existing.cpc,
          competitionIndex: input.competitionIndex !== undefined ? input.competitionIndex : existing.competitionIndex,
          metricSource: input.metricSource ?? existing.metricSource,
          metricRetrievedAt: input.searchVolume !== undefined ? now : existing.metricRetrievedAt,
          updatedAt: now,
        },
      });
    }

    return await prisma.keywordUniverse.create({
      data: {
        websiteId: input.websiteId,
        keyword: input.keyword.trim(),
        normalizedKeyword,
        searchIntent: input.searchIntent ?? SearchIntent.INFORMATIONAL,
        intentConfidence: input.intentConfidence ?? 0.8,
        funnelStage: input.funnelStage ?? FunnelStage.TOFU,
        businessValue: input.businessValue ?? BusinessValueTier.TIER_3_MEDIUM,
        conversionIntent: input.conversionIntent ?? false,
        moneyKeyword: input.moneyKeyword ?? false,
        topicEntityId: input.topicEntityId,
        topicEntityName: input.topicEntityName,
        conversionGoal: input.conversionGoal,
        targetUrl: input.targetUrl,
        targetUrlIdentityId: input.targetUrlIdentityId,
        clusterId: input.clusterId,
        trackingStatus: input.trackingStatus ?? KeywordTrackingStatus.ACTIVE,
        priority: input.priority ?? 3,
        tags: input.tags ?? [],
        discoverySource: input.discoverySource ?? KeywordDiscoverySource.MANUAL_SEED,
        searchVolume: input.searchVolume,
        cpc: input.cpc,
        competitionIndex: input.competitionIndex,
        metricSource: input.metricSource,
        metricRetrievedAt: input.searchVolume !== undefined ? now : null,
        provenanceSource: input.provenanceSource ?? 'MANUAL',
        provenanceMethod: input.provenanceMethod ?? 'INITIAL_IMPORT',
        provenanceTimestamp: now,
      },
    });
  }

  static async batchUpsertKeywords(websiteId: string, items: CreateKeywordInput[]) {
    const results = [];
    for (const item of items) {
      const res = await this.upsertKeyword({ ...item, websiteId });
      results.push(res);
    }
    return results;
  }

  static async getKeywordById(id: string, websiteId: string) {
    return await prisma.keywordUniverse.findFirst({
      where: { id, websiteId },
      include: {
        seoEntity: true,
        rankDailyFacts: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });
  }

  static async listKeywords(websiteId: string, options: KeywordFilterOptions = {}) {
    const where: any = { websiteId };

    if (options.trackingStatus) where.trackingStatus = options.trackingStatus;
    if (options.searchIntent) where.searchIntent = options.searchIntent;
    if (options.funnelStage) where.funnelStage = options.funnelStage;
    if (options.businessValue) where.businessValue = options.businessValue;
    if (options.moneyKeyword !== undefined) where.moneyKeyword = options.moneyKeyword;
    if (options.topicEntityId) where.topicEntityId = options.topicEntityId;
    if (options.query) {
      where.normalizedKeyword = {
        contains: this.normalizeKeyword(options.query),
      };
    }

    const [items, total] = await Promise.all([
      prisma.keywordUniverse.findMany({
        where,
        orderBy: [{ businessValue: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
        take: options.limit || 100,
        skip: options.offset || 0,
        include: {
          seoEntity: {
            select: { id: true, name: true, slug: true, entityType: true },
          },
        },
      }),
      prisma.keywordUniverse.count({ where }),
    ]);

    return { items, total };
  }

  static async updateKeyword(id: string, websiteId: string, input: UpdateKeywordInput) {
    const existing = await prisma.keywordUniverse.findFirst({
      where: { id, websiteId },
    });
    if (!existing) {
      throw new Error(`Keyword '${id}' not found for website '${websiteId}'`);
    }

    return await prisma.keywordUniverse.update({
      where: { id },
      data: {
        ...input,
        updatedAt: new Date(),
      },
    });
  }

  static async deleteKeyword(id: string, websiteId: string) {
    const existing = await prisma.keywordUniverse.findFirst({
      where: { id, websiteId },
    });
    if (!existing) {
      throw new Error(`Keyword '${id}' not found for website '${websiteId}'`);
    }

    return await prisma.keywordUniverse.delete({
      where: { id },
    });
  }

  static async updateLatestRank(
    id: string,
    params: {
      desktopRank?: number | null;
      mobileRank?: number | null;
    }
  ) {
    const keyword = await prisma.keywordUniverse.findUnique({ where: { id } });
    if (!keyword) return;

    const data: any = {
      lastTrackedAt: new Date(),
      updatedAt: new Date(),
    };

    if (params.desktopRank !== undefined) {
      data.previousDesktopRank = keyword.currentDesktopRank;
      data.currentDesktopRank = params.desktopRank;
      if (params.desktopRank !== null) {
        if (!keyword.firstRankedDate) data.firstRankedDate = new Date();
        if (!keyword.bestRank || params.desktopRank < keyword.bestRank) {
          data.bestRank = params.desktopRank;
        }
      }
    }

    if (params.mobileRank !== undefined) {
      data.previousMobileRank = keyword.currentMobileRank;
      data.currentMobileRank = params.mobileRank;
    }

    return await prisma.keywordUniverse.update({
      where: { id },
      data,
    });
  }
}
