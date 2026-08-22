import { prisma } from '../db/prisma';
import { CompetitorExclusionEngine } from '../services/serp/competitorExclusionEngine';
import { VisibilityModelEngine } from '../services/serp/visibilityModelEngine';
import { SerpDevice } from '@prisma/client';

export class CompetitorRepository {
  static async listCompetitors(websiteId: string, directOnly = false) {
    const where: any = { websiteId };
    if (directOnly) {
      where.isDirectCompetitor = true;
      where.isExcluded = false;
    }
    return await prisma.competitorDomain.findMany({
      where,
      orderBy: { visibilityIndex: 'desc' },
      include: {
        dailyFacts: {
          orderBy: { date: 'desc' },
          take: 14,
        },
      },
    });
  }

  static async setCompetitorExclusion(websiteId: string, domain: string, isExcluded: boolean, reason?: string) {
    const norm = CompetitorExclusionEngine.normalizeDomain(domain);
    const existing = await prisma.competitorDomain.findFirst({
      where: { websiteId, domain: norm },
    });

    if (existing) {
      return await prisma.competitorDomain.update({
        where: { id: existing.id },
        data: {
          isExcluded,
          exclusionReason: reason || (isExcluded ? 'USER_OVERRIDE' : null),
          isDirectCompetitor: !isExcluded && !existing.isPlatform,
          updatedAt: new Date(),
        },
      });
    }

    return await prisma.competitorDomain.create({
      data: {
        websiteId,
        domain: norm,
        isDirectCompetitor: !isExcluded,
        isExcluded,
        exclusionReason: reason,
        provenanceSource: 'USER',
        provenanceMethod: 'MANUAL_OVERRIDE',
      },
    });
  }

  static async refreshCompetitorIntelligence(websiteId: string, targetDomain: string) {
    const normTargetDomain = CompetitorExclusionEngine.normalizeDomain(targetDomain);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 1. Fetch user custom exclusions
    const customExclusions = await prisma.competitorDomain.findMany({
      where: { websiteId, isExcluded: true },
      select: { domain: true },
    });
    const excludedList = customExclusions.map((c) => c.domain);

    // 2. Fetch all latest snapshots for this website
    const snapshots = await prisma.serpSnapshot.findMany({
      where: { websiteId },
      include: {
        serpItems: true,
        keyword: { select: { searchVolume: true, id: true } },
      },
      orderBy: { snapshotDate: 'desc' },
    });

    // Deduplicate by keywordId (take most recent snapshot per keyword)
    const latestByKeyword = new Map<string, typeof snapshots[0]>();
    for (const snap of snapshots) {
      if (!latestByKeyword.has(snap.keywordId)) {
        latestByKeyword.set(snap.keywordId, snap);
      }
    }

    const domainStatsMap = new Map<
      string,
      {
        domain: string;
        positions: number[];
        sharedKeywords: Set<string>;
        outrankingCount: number;
        outrankedByUsCount: number;
        top3Count: number;
        top10Count: number;
        visibilitySum: number;
      }
    >();

    let ourTotalVisibility = 0;

    for (const snap of latestByKeyword.values()) {
      const ourRank = snap.ourRank;
      const kw = (snap as any).keyword || (await prisma.keywordUniverse.findUnique({ where: { id: snap.keywordId } }));
      const searchVolume = kw?.searchVolume || 100;

      if (ourRank) {
        const ourVis = VisibilityModelEngine.calculate({
          position: ourRank,
          device: snap.device,
          searchVolume,
          featuresPresent: [],
        });
        ourTotalVisibility += ourVis.visibilityScore;
      }

      const serpItems = (snap as any).serpItems || (await prisma.serpItem.findMany({ where: { snapshotId: snap.id } }));

      for (const item of serpItems) {
        const itemDomain = CompetitorExclusionEngine.normalizeDomain(item.domain);
        if (itemDomain === normTargetDomain) continue;

        if (!domainStatsMap.has(itemDomain)) {
          domainStatsMap.set(itemDomain, {
            domain: itemDomain,
            positions: [],
            sharedKeywords: new Set(),
            outrankingCount: 0,
            outrankedByUsCount: 0,
            top3Count: 0,
            top10Count: 0,
            visibilitySum: 0,
          });
        }

        const stat = domainStatsMap.get(itemDomain)!;
        stat.positions.push(item.position);
        stat.sharedKeywords.add(snap.keywordId);

        if (item.position <= 3) stat.top3Count++;
        if (item.position <= 10) stat.top10Count++;

        if (!ourRank || item.position < ourRank) {
          stat.outrankingCount++;
        } else if (ourRank < item.position) {
          stat.outrankedByUsCount++;
        }

        const compVis = VisibilityModelEngine.calculate({
          position: item.position,
          device: snap.device,
          searchVolume,
          featuresPresent: [],
        });
        stat.visibilitySum += compVis.visibilityScore;
      }
    }

    const updatedCompetitors = [];

    for (const [dom, stat] of domainStatsMap.entries()) {
      const check = CompetitorExclusionEngine.evaluateDomain(dom, excludedList);
      const avgPos = parseFloat(
        (stat.positions.reduce((a, b) => a + b, 0) / stat.positions.length).toFixed(1)
      );
      const visIndex = parseFloat(stat.visibilitySum.toFixed(2));

      const existing = await prisma.competitorDomain.findFirst({
        where: { websiteId, domain: dom },
      });

      let compRecord;
      if (existing) {
        compRecord = await prisma.competitorDomain.update({
          where: { id: existing.id },
          data: {
            sharedKeywordsCount: stat.sharedKeywords.size,
            outrankingCount: stat.outrankingCount,
            outrankedByUsCount: stat.outrankedByUsCount,
            averagePosition: avgPos,
            visibilityIndex: visIndex,
            isPlatform: check.isPlatform,
            isExcluded: existing.isExcluded || check.isExcluded,
            exclusionReason: existing.exclusionReason || check.exclusionReason,
            isDirectCompetitor: !existing.isExcluded && !check.isExcluded && !check.isPlatform,
            lastCalculatedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      } else {
        compRecord = await prisma.competitorDomain.create({
          data: {
            websiteId,
            domain: dom,
            sharedKeywordsCount: stat.sharedKeywords.size,
            outrankingCount: stat.outrankingCount,
            outrankedByUsCount: stat.outrankedByUsCount,
            averagePosition: avgPos,
            visibilityIndex: visIndex,
            isDirectCompetitor: check.isDirectCompetitor,
            isPlatform: check.isPlatform,
            isExcluded: check.isExcluded,
            exclusionReason: check.exclusionReason,
            lastCalculatedAt: new Date(),
            provenanceSource: 'DISCOVERY_ENGINE',
            provenanceMethod: 'SERP_OVERLAP_ANALYSIS',
          },
        });
      }

      // Record daily fact
      const existingFact = await prisma.competitorDailyFact.findFirst({
        where: { competitorId: compRecord.id, date: today },
      });

      const visDiff = parseFloat((ourTotalVisibility - visIndex).toFixed(2));

      if (existingFact) {
        await prisma.competitorDailyFact.update({
          where: { id: existingFact.id },
          data: {
            sharedKeywords: stat.sharedKeywords.size,
            top3Keywords: stat.top3Count,
            top10Keywords: stat.top10Count,
            averagePosition: avgPos,
            visibilityScore: visIndex,
            visibilityDifference: visDiff,
          },
        });
      } else {
        await prisma.competitorDailyFact.create({
          data: {
            websiteId,
            competitorId: compRecord.id,
            date: today,
            sharedKeywords: stat.sharedKeywords.size,
            top3Keywords: stat.top3Count,
            top10Keywords: stat.top10Count,
            averagePosition: avgPos,
            visibilityScore: visIndex,
            visibilityDifference: visDiff,
          },
        });
      }

      updatedCompetitors.push(compRecord);
    }

    return {
      totalCompetitorsProcessed: updatedCompetitors.length,
      ourTotalVisibility: parseFloat(ourTotalVisibility.toFixed(2)),
      competitors: updatedCompetitors,
    };
  }

  static async getKeywordGapMatrix(websiteId: string, competitorDomain: string) {
    const norm = CompetitorExclusionEngine.normalizeDomain(competitorDomain);

    const snapshots = await prisma.serpSnapshot.findMany({
      where: { websiteId },
      include: {
        serpItems: { where: { domain: norm } },
        keyword: true,
      },
    });

    const gapKeywords = [];
    for (const snap of snapshots) {
      const serpItems = (snap as any).serpItems || (await prisma.serpItem.findMany({ where: { snapshotId: snap.id, domain: norm } }));
      const compItem = serpItems.find((i: any) => CompetitorExclusionEngine.normalizeDomain(i.domain) === norm);
      const kw = (snap as any).keyword || (await prisma.keywordUniverse.findUnique({ where: { id: snap.keywordId } }));

      if (compItem && compItem.position <= 10 && kw) {
        const ourRank = snap.ourRank;
        // Gap: Competitor is Top 10, and we are unranked or > 20
        if (!ourRank || ourRank > 20) {
          gapKeywords.push({
            keywordId: snap.keywordId,
            keyword: snap.keywordText,
            searchIntent: kw.searchIntent,
            businessValue: kw.businessValue,
            searchVolume: kw.searchVolume,
            competitorPosition: compItem.position,
            ourPosition: ourRank,
            opportunityGap: ourRank ? ourRank - compItem.position : 100 - compItem.position,
          });
        }
      }
    }

    return gapKeywords.sort((a, b) => b.opportunityGap - a.opportunityGap);
  }
}
