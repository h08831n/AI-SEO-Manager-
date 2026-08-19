import { prisma } from '../../db/prisma';
import { AnalyticsRepository } from '../../repositories/analyticsRepository';

export interface DateWindow {
  startDate: Date;
  endDate: Date;
}

export interface MetricDelta {
  current: number;
  previous: number;
  delta: number;
  percentChange: number; // e.g. +15.5 for +15.5%, -20.0 for -20%
}

export interface PeriodComparisonResult {
  currentWindow: { startDate: string; endDate: string };
  previousWindow: { startDate: string; endDate: string };
  gsc: {
    clicks: MetricDelta;
    impressions: MetricDelta;
    ctr: MetricDelta;
    position: MetricDelta;
  };
  ga4: {
    sessions: MetricDelta;
    engagedSessions: MetricDelta;
    activeUsers: MetricDelta;
    keyEvents: MetricDelta;
    totalRevenue: MetricDelta;
    engagementRate: MetricDelta;
  };
  gainers: Array<{ query: string; clicksDiff: number; currentClicks: number; previousClicks: number; currentPos: number }>;
  decliners: Array<{ query: string; clicksDiff: number; currentClicks: number; previousClicks: number; currentPos: number }>;
  strikingDistanceKeywords: Array<{ query: string; position: number; impressions: number; clicks: number; ctr: number }>;
  highImpressionLowCtr: Array<{ query: string; position: number; impressions: number; clicks: number; ctr: number }>;
}

export class PeriodComparisonEngine {
  /**
   * Calculates comprehensive period-over-period comparison metrics.
   */
  public static async comparePeriods(params: {
    websiteId: string;
    currentStart: Date;
    currentEnd: Date;
    previousStart?: Date;
    previousEnd?: Date;
  }): Promise<PeriodComparisonResult> {
    const { websiteId, currentStart, currentEnd } = params;

    // If previous dates not provided, compute equal duration immediately preceding currentStart
    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = params.previousEnd || new Date(currentStart.getTime() - 86400000);
    const prevStart = params.previousStart || new Date(prevEnd.getTime() - durationMs);

    // 1. Fetch GSC Totals for both windows
    const [currGsc, prevGsc] = await Promise.all([
      AnalyticsRepository.getGscTotals(websiteId, currentStart, currentEnd),
      AnalyticsRepository.getGscTotals(websiteId, prevStart, prevEnd),
    ]);

    // 2. Fetch GA4 Totals for both windows
    const [currGa4, prevGa4] = await Promise.all([
      AnalyticsRepository.getGa4Totals(websiteId, currentStart, currentEnd),
      AnalyticsRepository.getGa4Totals(websiteId, prevStart, prevEnd),
    ]);

    // 3. Top Queries comparison (Gainers & Decliners)
    const [currQueries, prevQueries] = await Promise.all([
      AnalyticsRepository.getTopQueries(websiteId, currentStart, currentEnd, 200),
      AnalyticsRepository.getTopQueries(websiteId, prevStart, prevEnd, 200),
    ]);

    const prevQueryMap = new Map<string, { clicks: number; impressions: number; avgPosition: number }>();
    for (const q of prevQueries) {
      prevQueryMap.set(q.query, q);
    }

    const deltas: Array<{
      query: string;
      clicksDiff: number;
      currentClicks: number;
      previousClicks: number;
      currentPos: number;
      impressions: number;
      ctr: number;
    }> = [];

    const strikingDistanceKeywords: Array<{ query: string; position: number; impressions: number; clicks: number; ctr: number }> = [];
    const highImpressionLowCtr: Array<{ query: string; position: number; impressions: number; clicks: number; ctr: number }> = [];

    for (const q of currQueries) {
      const prev = prevQueryMap.get(q.query) || { clicks: 0, impressions: 0, avgPosition: 0 };
      const diff = q.clicks - prev.clicks;

      deltas.push({
        query: q.query,
        clicksDiff: diff,
        currentClicks: q.clicks,
        previousClicks: prev.clicks,
        currentPos: q.avgPosition,
        impressions: q.impressions,
        ctr: q.ctr,
      });

      // Striking distance: Position 10.5 - 20.0 with at least 50 impressions
      if (q.avgPosition >= 10.5 && q.avgPosition <= 20.4 && q.impressions >= 50) {
        strikingDistanceKeywords.push({
          query: q.query,
          position: q.avgPosition,
          impressions: q.impressions,
          clicks: q.clicks,
          ctr: q.ctr,
        });
      }

      // High impressions (>100) with low CTR (<1.5%) on top 10 positions
      if (q.avgPosition <= 10.4 && q.impressions >= 100 && q.ctr < 1.5) {
        highImpressionLowCtr.push({
          query: q.query,
          position: q.avgPosition,
          impressions: q.impressions,
          clicks: q.clicks,
          ctr: q.ctr,
        });
      }
    }

    const gainers = deltas
      .filter((d) => d.clicksDiff > 0)
      .sort((a, b) => b.clicksDiff - a.clicksDiff)
      .slice(0, 10);

    const decliners = deltas
      .filter((d) => d.clicksDiff < 0)
      .sort((a, b) => a.clicksDiff - b.clicksDiff)
      .slice(0, 10);

    return {
      currentWindow: {
        startDate: currentStart.toISOString().split('T')[0],
        endDate: currentEnd.toISOString().split('T')[0],
      },
      previousWindow: {
        startDate: prevStart.toISOString().split('T')[0],
        endDate: prevEnd.toISOString().split('T')[0],
      },
      gsc: {
        clicks: this.calcDelta(currGsc.totalClicks, prevGsc.totalClicks),
        impressions: this.calcDelta(currGsc.totalImpressions, prevGsc.totalImpressions),
        ctr: this.calcDelta(currGsc.weightedCtr, prevGsc.weightedCtr),
        position: this.calcDelta(currGsc.weightedPosition, prevGsc.weightedPosition, true), // Inverted for position (lower is better)
      },
      ga4: {
        sessions: this.calcDelta(currGa4.totalSessions, prevGa4.totalSessions),
        engagedSessions: this.calcDelta(currGa4.engagedSessions, prevGa4.engagedSessions),
        activeUsers: this.calcDelta(currGa4.activeUsers, prevGa4.activeUsers),
        keyEvents: this.calcDelta(currGa4.keyEvents, prevGa4.keyEvents),
        totalRevenue: this.calcDelta(currGa4.totalRevenue, prevGa4.totalRevenue),
        engagementRate: this.calcDelta(currGa4.engagementRate, prevGa4.engagementRate),
      },
      gainers,
      decliners,
      strikingDistanceKeywords: strikingDistanceKeywords.slice(0, 10),
      highImpressionLowCtr: highImpressionLowCtr.slice(0, 10),
    };
  }

  private static calcDelta(current: number, previous: number, invertSentiment = false): MetricDelta {
    const delta = current - previous;
    let percentChange = 0;
    if (previous > 0) {
      percentChange = (delta / previous) * 100;
    } else if (current > 0) {
      percentChange = 100;
    }

    return {
      current: parseFloat(current.toFixed(2)),
      previous: parseFloat(previous.toFixed(2)),
      delta: parseFloat(delta.toFixed(2)),
      percentChange: parseFloat(percentChange.toFixed(2)),
    };
  }
}
