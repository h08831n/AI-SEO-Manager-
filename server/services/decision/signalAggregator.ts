import { prisma } from '../../db/prisma';
import { ProblemContext, RawSignal } from './decisionTypes';
import { IssueSeverity, SearchIntent, BusinessValueTier } from '@prisma/client';

export class SignalAggregatorService {
  /**
   * Aggregates multi-source signals for a website and constructs normalized ProblemContexts.
   */
  public static async aggregateProblemContexts(websiteId: string): Promise<ProblemContext[]> {
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      include: {
        crawlRuns: {
          take: 1,
          orderBy: { startedAt: 'desc' },
          include: {
            issues: {
              take: 50,
            },
          },
        },
        keywords: {
          take: 50,
          include: {
            serpSnapshots: {
              take: 1,
              orderBy: { snapshotDate: 'desc' },
              include: { featureOccurrences: true },
            },
          },
        },
      },
    });

    if (!website) {
      return [];
    }

    const domain = website.domain;
    const contextsMap: Map<string, ProblemContext> = new Map();

    const getOrCreateContext = (key: string, url?: string, keyword?: string): ProblemContext => {
      if (!contextsMap.has(key)) {
        contextsMap.set(key, {
          websiteId,
          targetDomain: domain,
          url,
          keyword,
          signals: [],
          crawlIssues: [],
        });
      }
      return contextsMap.get(key)!;
    };

    // 1. Ingest Crawl Issues
    const latestCrawl = website.crawlRuns?.[0];
    if (latestCrawl && latestCrawl.issues) {
      for (const issue of latestCrawl.issues) {
        const urlKey = `crawl-issue-${issue.id}`;
        const ctx = getOrCreateContext(urlKey);

        ctx.crawlIssues?.push({
          issueType: issue.type,
          severity: issue.severity,
          pageUrl: issue.impact || '',
          detailsJson: issue.evidence || undefined,
        });

        ctx.signals.push({
          id: `sig-crawl-${issue.id}`,
          websiteId,
          source: 'CRAWL',
          sourceId: issue.id,
          severity: issue.severity,
          detectedAt: issue.createdAt,
          metadata: { issueType: issue.type },
        });
      }
    }

    // 2. Ingest Keyword Universe & SERP Snapshots
    for (const kw of website.keywords || []) {
      const kwKey = `kw-${kw.id}`;
      const ctx = getOrCreateContext(kwKey, kw.targetUrl || undefined, kw.keyword);

      ctx.keywordId = kw.id;
      ctx.keyword = kw.keyword;
      ctx.keywordContext = {
        searchVolume: kw.searchVolume || 0,
        searchIntent: kw.searchIntent as SearchIntent,
        businessValue: kw.businessValue as BusinessValueTier,
        moneyKeyword: kw.moneyKeyword,
      };

      const latestSnapshot = kw.serpSnapshots?.[0];
      if (latestSnapshot) {
        const features = (latestSnapshot.featureOccurrences || []).map((f: any) => f.featureType);
        const isCited = (latestSnapshot.featureOccurrences || []).some(
          (f: any) => f.featureType === 'AI_OVERVIEW' && f.isTargetDomainCited
        );

        ctx.serpContext = {
          rank: latestSnapshot.ourRank || 0,
          previousRank: kw.currentDesktopRank || undefined,
          visibilityScore: 0,
          featuresPresent: features,
          aiOverviewCited: isCited,
        };

        if (features.includes('AI_OVERVIEW') && !isCited) {
          ctx.signals.push({
            id: `sig-serp-ai-${latestSnapshot.id}`,
            websiteId,
            source: 'SERP',
            sourceId: latestSnapshot.id,
            keyword: kw.keyword,
            detectedAt: latestSnapshot.snapshotDate,
            metadata: { eventType: 'AI_OVERVIEW_APPEARED', cited: false },
          });
        }
      }
    }

    // 3. Ingest GSC Daily Facts
    const gscFacts = await prisma.gscSearchAnalyticsFact.findMany({
      where: { websiteId },
      take: 50,
      orderBy: { date: 'desc' },
    });

    for (const fact of gscFacts) {
      const pageKey = fact.pageUrl || `query-${fact.query}`;
      const ctx = getOrCreateContext(pageKey, fact.pageUrl || undefined, fact.query || undefined);

      ctx.gscMetrics = {
        clicks: fact.clicks,
        impressions: fact.impressions,
        ctr: fact.ctr,
        avgPosition: fact.position,
      };

      // Check for low CTR anomaly
      if (fact.position <= 4 && fact.ctr < 0.05 && fact.impressions > 100) {
        ctx.signals.push({
          id: `sig-gsc-ctr-${fact.id}`,
          websiteId,
          source: 'GSC',
          sourceId: fact.id,
          url: fact.pageUrl || undefined,
          keyword: fact.query || undefined,
          metricName: 'CTR_UNDERPERFORMANCE',
          currentValue: fact.ctr,
          detectedAt: fact.date,
          metadata: { impressions: fact.impressions, position: fact.position },
        });
      }
    }

    // 4. Ingest SeoEvents
    const recentEvents = await prisma.seoEvent.findMany({
      where: { websiteId },
      take: 30,
      orderBy: { detectedAt: 'desc' },
    });

    for (const ev of recentEvents) {
      const key = ev.entityUrl || `event-${ev.id}`;
      const ctx = getOrCreateContext(key, ev.entityUrl || undefined);

      ctx.signals.push({
        id: `sig-event-${ev.id}`,
        websiteId,
        source: 'SERP',
        sourceId: ev.id,
        severity: ev.severity as IssueSeverity,
        detectedAt: ev.detectedAt,
        metadata: { eventType: ev.eventType },
      });
    }

    return Array.from(contextsMap.values());
  }
}
