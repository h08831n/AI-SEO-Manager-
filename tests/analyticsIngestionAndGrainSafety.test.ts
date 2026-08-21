import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../server/db/prisma';
import { AnalyticsRepository } from '../server/repositories/analyticsRepository';
import { UrlNormalizer } from '../server/services/crawler/urlNormalizer';
import { SignalDetectionEngine } from '../server/services/analytics/signalDetectionEngine';

describe('Phase 3: Analytics Ingestion, Grain Safety & Signal Engine Test Suite', () => {
  const testWebsiteId = 'test-website-grain-safety-1';

  beforeEach(async () => {
    // Ensure test website exists
    await prisma.website.upsert({
      where: { id: testWebsiteId },
      update: {},
      create: {
        id: testWebsiteId,
        workspaceId: 'ws-test-grain',
        domain: 'grain-test.com',
        name: 'Grain Safety Test Site',
        productionUrl: 'https://grain-test.com',
        defaultLanguage: 'en-US',
      },
    });

    // Create a known UrlIdentity
    const normUrl = UrlNormalizer.normalize('https://grain-test.com/pricing');
    await prisma.urlIdentity.upsert({
      where: {
        websiteId_normalizedUrl: {
          websiteId: testWebsiteId,
          normalizedUrl: normUrl,
        },
      },
      update: {},
      create: {
        websiteId: testWebsiteId,
        normalizedUrl: normUrl,
        pathname: '/pricing',
        discoverySources: ['SEED'],
      },
    });
  });

  describe('1. Grain Safety & Double Counting Prevention', () => {
    it('does not double count clicks when both SITE_DAILY and PAGE_DAILY facts exist', async () => {
      const targetDate = new Date('2026-08-15T00:00:00Z');

      // Insert 1 SITE_DAILY record with 100 clicks
      await AnalyticsRepository.upsertGscFacts([
        {
          websiteId: testWebsiteId,
          date: targetDate,
          grain: 'SITE_DAILY',
          clicks: 100,
          impressions: 1000,
          ctr: 0.1,
          position: 5.0,
        },
      ]);

      // Insert 3 PAGE_DAILY records (each with 30 clicks = 90 clicks)
      await AnalyticsRepository.upsertGscFacts([
        {
          websiteId: testWebsiteId,
          date: targetDate,
          grain: 'PAGE_DAILY',
          pageUrl: 'https://grain-test.com/page1',
          clicks: 30,
          impressions: 300,
          ctr: 0.1,
          position: 4.0,
        },
        {
          websiteId: testWebsiteId,
          date: targetDate,
          grain: 'PAGE_DAILY',
          pageUrl: 'https://grain-test.com/page2',
          clicks: 30,
          impressions: 300,
          ctr: 0.1,
          position: 4.0,
        },
        {
          websiteId: testWebsiteId,
          date: targetDate,
          grain: 'PAGE_DAILY',
          pageUrl: 'https://grain-test.com/pricing',
          clicks: 40,
          impressions: 400,
          ctr: 0.1,
          position: 4.0,
        },
      ]);

      // Query totals for that day
      const totals = await AnalyticsRepository.getGscTotals(testWebsiteId, targetDate, targetDate);

      // Must strictly report 100 clicks from SITE_DAILY (NOT 100 + 90 = 190)
      expect(totals.totalClicks).toBe(100);
      expect(totals.totalImpressions).toBe(1000);
    });

    it('queries Top Queries from single source grain without mixing PAGE_QUERY_DAILY', async () => {
      const targetDate = new Date('2026-08-16T00:00:00Z');

      // Insert QUERY_DAILY fact
      await AnalyticsRepository.upsertGscFacts([
        {
          websiteId: testWebsiteId,
          date: targetDate,
          grain: 'QUERY_DAILY',
          query: 'cloud security pricing',
          clicks: 50,
          impressions: 500,
          ctr: 0.1,
          position: 3.0,
        },
      ]);

      // Insert PAGE_QUERY_DAILY fact for the same query on different pages
      await AnalyticsRepository.upsertGscFacts([
        {
          websiteId: testWebsiteId,
          date: targetDate,
          grain: 'PAGE_QUERY_DAILY',
          pageUrl: 'https://grain-test.com/page1',
          query: 'cloud security pricing',
          clicks: 25,
          impressions: 250,
          ctr: 0.1,
          position: 3.0,
        },
      ]);

      const topQueries = await AnalyticsRepository.getTopQueries(testWebsiteId, targetDate, targetDate);
      const queryMatch = topQueries.find((q) => q.query === 'cloud security pricing');

      expect(queryMatch).toBeDefined();
      expect(queryMatch?.clicks).toBe(50); // Single grain QUERY_DAILY used exclusively
      expect(queryMatch?.sourceGrain).toBe('QUERY_DAILY');
    });
  });

  describe('2. URL Reconciliation & Identity Linking', () => {
    it('reconciles raw and trailing-slash URLs to canonical UrlIdentity with UrlNormalizer', async () => {
      const targetDate = new Date('2026-08-17T00:00:00Z');

      // Ingest GSC fact with uppercase/trailing slash
      await AnalyticsRepository.upsertGscFacts([
        {
          websiteId: testWebsiteId,
          date: targetDate,
          grain: 'PAGE_DAILY',
          pageUrl: 'https://grain-test.com/pricing/',
          clicks: 45,
          impressions: 450,
          ctr: 0.1,
          position: 2.5,
        },
      ]);

      // Verify it linked to UrlIdentity
      const facts = await prisma.gscSearchAnalyticsFact.findMany({
        where: {
          websiteId: testWebsiteId,
          grain: 'PAGE_DAILY',
          date: targetDate,
        },
      });

      expect(facts.length).toBe(1);
      expect(facts[0].urlMatchStatus).toBe('MATCHED_URL_IDENTITY');
      expect(facts[0].urlIdentityId).toBeDefined();
    });
  });

  describe('3. GA4 Channel Filtering Correctness', () => {
    it('aggregates organic totals exclusively from Organic Search channel group', async () => {
      const targetDate = new Date('2026-08-18T00:00:00Z');

      // Insert Organic Search channel daily
      await AnalyticsRepository.upsertGa4Channels([
        {
          websiteId: testWebsiteId,
          date: targetDate,
          defaultChannelGroup: 'Organic Search',
          sessions: 500,
          engagedSessions: 350,
          users: 400,
          newUsers: 200,
          keyEvents: 25,
          totalRevenue: 2500,
        },
        {
          websiteId: testWebsiteId,
          date: targetDate,
          defaultChannelGroup: 'Direct',
          sessions: 1200,
          engagedSessions: 800,
          users: 900,
          newUsers: 100,
          keyEvents: 50,
          totalRevenue: 5000,
        },
        {
          websiteId: testWebsiteId,
          date: targetDate,
          defaultChannelGroup: 'Paid Search',
          sessions: 300,
          engagedSessions: 200,
          users: 250,
          newUsers: 150,
          keyEvents: 10,
          totalRevenue: 1000,
        },
      ]);

      const ga4Totals = await AnalyticsRepository.getGa4Totals(testWebsiteId, targetDate, targetDate);

      // Total Organic sessions must be 500 (NOT 500 + 1200 + 300 = 2000)
      expect(ga4Totals.totalSessions).toBe(500);
      expect(ga4Totals.keyEvents).toBe(25);
      expect(ga4Totals.totalRevenue).toBe(2500);
    });
  });

  describe('4. Deterministic Signal & Recommendation Deduplication', () => {
    it('evaluates analytics signals and does not duplicate recommendations on repeat runs', async () => {
      const currentStart = new Date('2026-08-01');
      const currentEnd = new Date('2026-08-28');

      // Run signal detection 1st time
      await SignalDetectionEngine.evaluateSignals({
        websiteId: testWebsiteId,
        currentStart,
        currentEnd,
      });

      const recsCount1 = await prisma.seoRecommendation.count({
        where: { websiteId: testWebsiteId, category: 'ANALYTICS_SIGNAL' },
      });

      // Run signal detection 2nd time with the same window
      await SignalDetectionEngine.evaluateSignals({
        websiteId: testWebsiteId,
        currentStart,
        currentEnd,
      });

      const recsCount2 = await prisma.seoRecommendation.count({
        where: { websiteId: testWebsiteId, category: 'ANALYTICS_SIGNAL' },
      });

      // Count must be identical (no duplicate rows inserted)
      expect(recsCount2).toBe(recsCount1);
    });
  });
});
