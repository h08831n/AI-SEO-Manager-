import { prisma } from '../../db/prisma';
import { PeriodComparisonEngine } from './periodComparisonEngine';

export interface DetectedSignal {
  websiteId: string;
  eventType: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  source: 'GSC' | 'GA4' | 'CRAWLER';
  details: Record<string, any>;
}

export class SignalDetectionEngine {
  /**
   * Evaluates performance data for the given website and generates actionable SEO events.
   */
  public static async evaluateSignals(params: {
    websiteId: string;
    currentStart: Date;
    currentEnd: Date;
  }): Promise<DetectedSignal[]> {
    const { websiteId, currentStart, currentEnd } = params;

    const comparison = await PeriodComparisonEngine.comparePeriods({
      websiteId,
      currentStart,
      currentEnd,
    });

    const detectedSignals: DetectedSignal[] = [];

    // 1. Overall Traffic Drop Critical Alert
    if (comparison.gsc.clicks.percentChange <= -25 && comparison.gsc.clicks.previous >= 50) {
      detectedSignals.push({
        websiteId,
        eventType: 'ORGANIC_TRAFFIC_DROP',
        severity: comparison.gsc.clicks.percentChange <= -40 ? 'CRITICAL' : 'HIGH',
        source: 'GSC',
        details: {
          metric: 'clicks',
          currentClicks: comparison.gsc.clicks.current,
          previousClicks: comparison.gsc.clicks.previous,
          percentChange: comparison.gsc.clicks.percentChange,
          message: `Organic search clicks dropped by ${Math.abs(comparison.gsc.clicks.percentChange)}% compared to the prior period.`,
        },
      });
    }

    // 2. Steep Query Decliners
    for (const decliner of comparison.decliners) {
      if (decliner.clicksDiff <= -20 || (decliner.previousClicks >= 30 && decliner.clicksDiff <= -10)) {
        detectedSignals.push({
          websiteId,
          eventType: 'QUERY_RANKING_DECAY',
          severity: 'HIGH',
          source: 'GSC',
          details: {
            query: decliner.query,
            currentClicks: decliner.currentClicks,
            previousClicks: decliner.previousClicks,
            clicksLost: Math.abs(decliner.clicksDiff),
            currentPosition: decliner.currentPos,
            message: `Query '${decliner.query}' lost ${Math.abs(decliner.clicksDiff)} clicks in the current period.`,
          },
        });
      }
    }

    // 3. Striking Distance Keyword Opportunities (Page 2 ranks: Pos 11-20 with high impressions)
    for (const kw of comparison.strikingDistanceKeywords) {
      if (kw.impressions >= 100) {
        detectedSignals.push({
          websiteId,
          eventType: 'STRIKING_DISTANCE_OPPORTUNITY',
          severity: 'MEDIUM',
          source: 'GSC',
          details: {
            query: kw.query,
            position: kw.position,
            impressions: kw.impressions,
            clicks: kw.clicks,
            ctr: kw.ctr,
            message: `Query '${kw.query}' is ranking in striking distance (position ${kw.position.toFixed(1)}) with ${kw.impressions} impressions. Targeted on-page optimization could push it to page 1.`,
          },
        });
      }
    }

    // 4. High Impression / Low CTR Anomaly (Page 1 rank with sub-benchmark CTR)
    for (const anom of comparison.highImpressionLowCtr) {
      detectedSignals.push({
        websiteId,
        eventType: 'LOW_CTR_ANOMALY',
        severity: 'MEDIUM',
        source: 'GSC',
        details: {
          query: anom.query,
          position: anom.position,
          impressions: anom.impressions,
          clicks: anom.clicks,
          ctr: anom.ctr,
          message: `Query '${anom.query}' has ${anom.impressions} impressions at rank ${anom.position.toFixed(1)} but only ${anom.ctr.toFixed(2)}% CTR. Metadata optimization is recommended.`,
        },
      });
    }

    // 5. Orphan Pages with Organic Traffic
    const orphanPagesWithTraffic = await prisma.urlIdentity.findMany({
      where: {
        websiteId,
        isOrphanCandidate: true,
        gscFacts: {
          some: {
            date: { gte: currentStart, lte: currentEnd },
            clicks: { gt: 0 },
          },
        },
      },
      include: {
        gscFacts: {
          where: { date: { gte: currentStart, lte: currentEnd } },
          select: { clicks: true, impressions: true },
        },
      },
      take: 5,
    });

    for (const orphan of orphanPagesWithTraffic) {
      const totalClicks = orphan.gscFacts.reduce((sum, f) => sum + f.clicks, 0);
      detectedSignals.push({
        websiteId,
        eventType: 'ORPHAN_PAGE_RECEIVING_TRAFFIC',
        severity: 'HIGH',
        source: 'GSC',
        details: {
          url: orphan.normalizedUrl,
          pathname: orphan.pathname,
          clicks: totalClicks,
          message: `Orphan page '${orphan.pathname}' has 0 internal inlinks but received ${totalClicks} organic clicks. Add internal navigation links to preserve authority.`,
        },
      });
    }

    // Save detected signals to seoRecommendation and outboxEvent table
    if (detectedSignals.length > 0) {
      await prisma.$transaction([
        ...detectedSignals.map((sig) =>
          prisma.seoRecommendation.create({
            data: {
              websiteId: sig.websiteId,
              title: sig.details.message || sig.eventType,
              category: 'ANALYTICS_SIGNAL',
              actionType: sig.eventType,
              evidence: JSON.stringify(sig.details),
              source: sig.source,
              impactScore: sig.severity === 'CRITICAL' ? 9 : sig.severity === 'HIGH' ? 8 : 6,
              effortScore: 4,
              riskScore: 2,
              businessValue: sig.severity === 'CRITICAL' ? 10 : 7,
              status: 'RECOMMENDED',
            },
          })
        ),
        ...detectedSignals.map((sig) =>
          prisma.outboxEvent.create({
            data: {
              aggregateType: 'ANALYTICS_SIGNAL',
              aggregateId: `${sig.websiteId}:${sig.eventType}:${Date.now()}`,
              eventType: sig.eventType,
              payloadJson: JSON.stringify(sig),
              status: 'PENDING',
            },
          })
        ),
      ]);
    }

    return detectedSignals;
  }
}
