import { describe, it, expect, vi } from 'vitest';
import { PeriodComparisonEngine } from '../server/services/analytics/periodComparisonEngine';
import { AnalyticsRepository } from '../server/repositories/analyticsRepository';

describe('Phase 3: PeriodComparisonEngine Test Suite', () => {
  it('correctly calculates delta metrics and percentage changes for GSC and GA4', async () => {
    vi.spyOn(AnalyticsRepository, 'getGscTotals').mockImplementation(async (websiteId, start, end) => {
      // Return 5000 clicks for current, 4000 for previous
      if (start.getTime() > new Date('2026-08-01').getTime()) {
        return { totalClicks: 5000, totalImpressions: 100000, weightedCtr: 5.0, weightedPosition: 12.0 };
      }
      return { totalClicks: 4000, totalImpressions: 80000, weightedCtr: 5.0, weightedPosition: 14.0 };
    });

    vi.spyOn(AnalyticsRepository, 'getGa4Totals').mockImplementation(async (websiteId, start, end) => {
      if (start.getTime() > new Date('2026-08-01').getTime()) {
        return {
          totalSessions: 3000,
          engagedSessions: 2100,
          activeUsers: 2500,
          newUsers: 1800,
          keyEvents: 120,
          totalRevenue: 24000,
          engagementRate: 70.0,
        };
      }
      return {
        totalSessions: 2000,
        engagedSessions: 1200,
        activeUsers: 1600,
        newUsers: 1100,
        keyEvents: 80,
        totalRevenue: 16000,
        engagementRate: 60.0,
      };
    });

    vi.spyOn(AnalyticsRepository, 'getTopQueries').mockImplementation(async (websiteId, start) => {
      if (start.getTime() > new Date('2026-08-01').getTime()) {
        return [
          { query: 'cloud migration', clicks: 1200, impressions: 10000, ctr: 12.0, avgPosition: 3.2, sourceGrain: 'QUERY_DAILY' },
          { query: 'striking kw', clicks: 50, impressions: 5000, ctr: 1.0, avgPosition: 14.5, sourceGrain: 'QUERY_DAILY' },
          { query: 'low ctr hero', clicks: 30, impressions: 8000, ctr: 0.375, avgPosition: 4.1, sourceGrain: 'QUERY_DAILY' },
        ];
      }
      return [
        { query: 'cloud migration', clicks: 800, impressions: 8000, ctr: 10.0, avgPosition: 4.5, sourceGrain: 'QUERY_DAILY' },
        { query: 'striking kw', clicks: 40, impressions: 4000, ctr: 1.0, avgPosition: 15.0, sourceGrain: 'QUERY_DAILY' },
      ];
    });

    const result = await PeriodComparisonEngine.comparePeriods({
      websiteId: 'website-123',
      currentStart: new Date('2026-08-02'),
      currentEnd: new Date('2026-08-29'),
      previousStart: new Date('2026-07-05'),
      previousEnd: new Date('2026-08-01'),
    });

    // Clicks: 5000 vs 4000 = +1000 (+25%)
    expect(result.gsc.clicks.current).toBe(5000);
    expect(result.gsc.clicks.previous).toBe(4000);
    expect(result.gsc.clicks.delta).toBe(1000);
    expect(result.gsc.clicks.percentChange).toBe(25);

    // Revenue: 24000 vs 16000 = +8000 (+50%)
    expect(result.ga4.totalRevenue.delta).toBe(8000);
    expect(result.ga4.totalRevenue.percentChange).toBe(50);

    // Gainers: cloud migration gained 400 clicks
    expect(result.gainers).toHaveLength(3);
    expect(result.gainers[0].query).toBe('cloud migration');
    expect(result.gainers[0].clicksDiff).toBe(400);

    // Striking Distance: striking kw is at position 14.5
    expect(result.strikingDistanceKeywords).toHaveLength(1);
    expect(result.strikingDistanceKeywords[0].query).toBe('striking kw');

    // High Impression Low CTR: low ctr hero is pos 4.1 with 0.375% CTR
    expect(result.highImpressionLowCtr).toHaveLength(1);
    expect(result.highImpressionLowCtr[0].query).toBe('low ctr hero');
  });
});
