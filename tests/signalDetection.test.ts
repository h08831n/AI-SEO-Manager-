import { describe, it, expect, vi } from 'vitest';
import { SignalDetectionEngine } from '../server/services/analytics/signalDetectionEngine';
import { PeriodComparisonEngine } from '../server/services/analytics/periodComparisonEngine';
import { prisma } from '../server/db/prisma';

describe('Phase 3: SignalDetectionEngine Test Suite', () => {
  it('detects ORGANIC_TRAFFIC_DROP signal when period clicks decrease by over 25%', async () => {
    vi.spyOn(PeriodComparisonEngine, 'comparePeriods').mockResolvedValueOnce({
      currentWindow: { startDate: '2026-08-01', endDate: '2026-08-28' },
      previousWindow: { startDate: '2026-07-04', endDate: '2026-07-31' },
      gsc: {
        clicks: { current: 300, previous: 600, delta: -300, percentChange: -50.0 },
        impressions: { current: 10000, previous: 20000, delta: -10000, percentChange: -50.0 },
        ctr: { current: 3.0, previous: 3.0, delta: 0, percentChange: 0 },
        position: { current: 18.0, previous: 12.0, delta: 6.0, percentChange: 50.0 },
      },
      ga4: {
        sessions: { current: 200, previous: 400, delta: -200, percentChange: -50.0 },
        engagedSessions: { current: 140, previous: 280, delta: -140, percentChange: -50.0 },
        activeUsers: { current: 180, previous: 360, delta: -180, percentChange: -50.0 },
        keyEvents: { current: 10, previous: 20, delta: -10, percentChange: -50.0 },
        totalRevenue: { current: 2000, previous: 4000, delta: -2000, percentChange: -50.0 },
        engagementRate: { current: 70, previous: 70, delta: 0, percentChange: 0 },
      },
      gainers: [],
      decliners: [
        { query: 'high traffic core query', clicksDiff: -150, currentClicks: 50, previousClicks: 200, currentPos: 9.2 },
      ],
      strikingDistanceKeywords: [
        { query: 'striking kw 1', position: 12.4, impressions: 800, clicks: 10, ctr: 1.25 },
      ],
      highImpressionLowCtr: [
        { query: 'low ctr query 1', position: 3.2, impressions: 5000, clicks: 25, ctr: 0.5 },
      ],
    });

    vi.spyOn(prisma.urlIdentity, 'findMany').mockResolvedValueOnce([] as any);
    vi.spyOn(prisma, '$transaction').mockResolvedValueOnce([] as any);

    const signals = await SignalDetectionEngine.evaluateSignals({
      websiteId: 'website-123',
      currentStart: new Date('2026-08-01'),
      currentEnd: new Date('2026-08-28'),
    });

    expect(signals.length).toBeGreaterThanOrEqual(3);

    const dropSignal = signals.find((s) => s.eventType === 'CLICKS_DROP');
    expect(dropSignal).toBeDefined();
    expect(dropSignal?.severity).toBe('CRITICAL');
    expect(dropSignal?.source).toBe('GOOGLE_SEARCH_CONSOLE');
    expect(dropSignal?.provenance).toBe('CALCULATED');

    const decaySignal = signals.find((s) => s.eventType === 'CONTENT_DECAY_CANDIDATE');
    expect(decaySignal).toBeDefined();
    expect(decaySignal?.details.query).toBe('high traffic core query');

    const strikingSignal = signals.find((s) => s.eventType === 'STRIKING_DISTANCE_OPPORTUNITY');
    expect(strikingSignal).toBeDefined();
    expect(strikingSignal?.details.query).toBe('striking kw 1');
  });
});
