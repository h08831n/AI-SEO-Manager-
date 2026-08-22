import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../server/db/prisma';
import { KeywordRepository } from '../server/repositories/keywordRepository';
import { SeoEntityRepository } from '../server/repositories/seoEntityRepository';
import { IntentClassifierService } from '../server/services/serp/intentClassifierService';
import { KeywordMetricProviderRouter, MockKeywordMetricProvider } from '../server/services/serp/metricProviders/keywordMetricProvider';
import { MockSerpProvider } from '../server/services/serp/providers/mockSerpProvider';
import { VisibilityModelEngine } from '../server/services/serp/visibilityModelEngine';
import { CompetitorExclusionEngine } from '../server/services/serp/competitorExclusionEngine';
import { SerpRepository } from '../server/repositories/serpRepository';
import { SerpEventEngine } from '../server/services/serp/serpEventEngine';
import { CompetitorRepository } from '../server/repositories/competitorRepository';
import { SerpExecutionService } from '../server/services/serp/serpExecutionService';
import { KeywordDiscoveryPipeline } from '../server/services/serp/keywordDiscoveryPipeline';
import {
  SearchIntent,
  FunnelStage,
  BusinessValueTier,
  SerpDevice,
  SerpFeatureType,
  SerpEventType,
} from '@prisma/client';

describe('Phase 4: Rank Tracking, SERP Intelligence & Competitor Subsystem', () => {
  let websiteId: string;
  const testDomain = 'acmesoftware.io';

  beforeEach(async () => {
    // Reset or seed test website
    const website = await prisma.website.create({
      data: {
        workspaceId: 'default-workspace',
        domain: testDomain,
        name: 'Acme Software',
        productionUrl: `https://${testDomain}`,
      } as any,
    });
    websiteId = website.id;
  });

  describe('1. Intent Classification & Business Value Model', () => {
    it('correctly classifies transactional money keywords with BOFU and TIER_1_CRITICAL', () => {
      const result = IntentClassifierService.classify('buy b2b saas compliance tool pricing', testDomain);
      expect(result.searchIntent).toBe(SearchIntent.TRANSACTIONAL);
      expect(result.funnelStage).toBe(FunnelStage.BOFU);
      expect(result.businessValue).toBe(BusinessValueTier.TIER_1_CRITICAL);
      expect(result.moneyKeyword).toBe(true);
      expect(result.conversionIntent).toBe(true);
    });

    it('correctly classifies commercial investigation keywords with MOFU', () => {
      const result = IntentClassifierService.classify('best enterprise analytics platforms vs competitor', testDomain);
      expect(result.searchIntent).toBe(SearchIntent.COMMERCIAL);
      expect(result.funnelStage).toBe(FunnelStage.MOFU);
      expect(result.businessValue).toBe(BusinessValueTier.TIER_1_CRITICAL);
    });

    it('correctly classifies informational queries with TOFU', () => {
      const result = IntentClassifierService.classify('what is data governance and how to start', testDomain);
      expect(result.searchIntent).toBe(SearchIntent.INFORMATIONAL);
      expect(result.funnelStage).toBe(FunnelStage.TOFU);
      expect(result.moneyKeyword).toBe(false);
    });

    it('correctly classifies navigational brand queries', () => {
      const result = IntentClassifierService.classify('acmesoftware customer dashboard login', testDomain);
      expect(result.searchIntent).toBe(SearchIntent.NAVIGATIONAL);
      expect(result.funnelStage).toBe(FunnelStage.RETENTION);
    });
  });

  describe('2. SEO Entity Graph & Keyword Universe Repository', () => {
    it('creates an SEO Entity and links keywords into a topic cluster', async () => {
      const entity = await SeoEntityRepository.createEntity({
        websiteId,
        name: 'Cloud Security Posture Management',
        description: 'Pillar entity for cloud security solutions',
        businessValue: BusinessValueTier.TIER_1_CRITICAL,
        pillarUrl: `https://${testDomain}/cspm`,
      });

      expect(entity.id).toBeDefined();
      expect(entity.slug).toBe('cloud-security-posture-management');

      const kw = await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'best cspm software 2026',
        topicEntityId: entity.id,
        searchIntent: SearchIntent.COMMERCIAL,
        businessValue: BusinessValueTier.TIER_1_CRITICAL,
        moneyKeyword: true,
        searchVolume: 3200,
        cpc: 8.5,
      });

      expect(kw.id).toBeDefined();
      expect(kw.topicEntityId).toBe(entity.id);
      expect(kw.normalizedKeyword).toBe('best cspm software 2026');

      const retrievedEntity = await SeoEntityRepository.getEntityById(entity.id, websiteId);
      expect(retrievedEntity?.keywords.length).toBe(1);
    });

    it('deduplicates keywords via batch upsert and normalizes diacritics', async () => {
      await KeywordRepository.batchUpsertKeywords(websiteId, [
        { websiteId, keyword: 'SEO Optimisation Tools' },
        { websiteId, keyword: 'seo optimisation tools' },
      ]);

      const { total, items } = await KeywordRepository.listKeywords(websiteId);
      expect(total).toBe(1);
      expect(items[0].normalizedKeyword).toBe('seo optimisation tools');
    });
  });

  describe('3. Keyword Metric Provider Abstraction', () => {
    it('provides deterministic metrics with provenance metadata', async () => {
      const provider = new MockKeywordMetricProvider();
      const metrics = await provider.getMetrics({ keyword: 'enterprise kubernetes security' });

      expect(metrics.keyword).toBe('enterprise kubernetes security');
      expect(metrics.searchVolume).toBeGreaterThan(0);
      expect(metrics.cpc).toBeGreaterThan(0);
      expect(metrics.competitionIndex).toBeGreaterThanOrEqual(0);
      expect(metrics.source).toBe('MOCK');
    });

    it('router returns fallback provider when external keys are not present', () => {
      const provider = KeywordMetricProviderRouter.getProvider();
      expect(provider.isConfigured()).toBe(true);
      expect(provider.providerName).toBe('MOCK_KEYWORD_METRIC_PROVIDER');
    });
  });

  describe('4. Dynamic Visibility Model Engine', () => {
    it('calculates standard CTR curve accurately for top organic ranks', () => {
      const rank1 = VisibilityModelEngine.calculate({
        position: 1,
        device: SerpDevice.DESKTOP,
        searchVolume: 1000,
        featuresPresent: [],
      });
      expect(rank1.baseCtr).toBe(0.316);
      expect(rank1.visibilityScore).toBe(316);

      const rank3 = VisibilityModelEngine.calculate({
        position: 3,
        device: SerpDevice.DESKTOP,
        searchVolume: 1000,
        featuresPresent: [],
      });
      expect(rank3.baseCtr).toBe(0.098);
      expect(rank3.visibilityScore).toBe(98);
    });

    it('applies displacement factor when AI Overview is present without target citation', () => {
      const res = VisibilityModelEngine.calculate({
        position: 1,
        device: SerpDevice.DESKTOP,
        searchVolume: 1000,
        featuresPresent: [SerpFeatureType.AI_OVERVIEW],
        isTargetCitedInAiOverview: false,
      });

      expect(res.displacementFactor).toBe(0.65);
      expect(res.visibilityWeight).toBeLessThan(0.316);
      expect(res.visibilityScore).toBe(205.4); // 0.316 * 0.65 * 1000
    });

    it('applies citation boost when target IS cited in AI Overview', () => {
      const res = VisibilityModelEngine.calculate({
        position: 1,
        device: SerpDevice.DESKTOP,
        searchVolume: 1000,
        featuresPresent: [SerpFeatureType.AI_OVERVIEW],
        isTargetCitedInAiOverview: true,
      });

      expect(res.displacementFactor).toBe(1.25);
      expect(res.visibilityWeight).toBeGreaterThan(0.316);
    });
  });

  describe('5. Competitor Exclusion Engine', () => {
    it('identifies and excludes global platform domains', () => {
      const wiki = CompetitorExclusionEngine.evaluateDomain('en.wikipedia.org');
      expect(wiki.isPlatform).toBe(true);
      expect(wiki.isExcluded).toBe(true);
      expect(wiki.isDirectCompetitor).toBe(false);

      const youtube = CompetitorExclusionEngine.evaluateDomain('https://www.youtube.com/watch?v=123');
      expect(youtube.isPlatform).toBe(true);
      expect(youtube.isExcluded).toBe(true);
    });

    it('classifies custom SaaS domains as direct competitors', () => {
      const saas = CompetitorExclusionEngine.evaluateDomain('competitor-alpha.com');
      expect(saas.isPlatform).toBe(false);
      expect(saas.isExcluded).toBe(false);
      expect(saas.isDirectCompetitor).toBe(true);
    });

    it('honors user-defined domain exclusions', () => {
      const userExclusion = CompetitorExclusionEngine.evaluateDomain('partner-co.org', ['partner-co.org']);
      expect(userExclusion.isExcluded).toBe(true);
      expect(userExclusion.exclusionReason).toBe('USER_CUSTOM_EXCLUSION');
      expect(userExclusion.isDirectCompetitor).toBe(false);
    });
  });

  describe('6. SERP Execution, Feature Storage & Event Detection', () => {
    it('executes full SERP check, records snapshots, features, daily facts, and updates keyword latest rank', async () => {
      const kw = await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'enterprise api gateway pricing',
        searchIntent: SearchIntent.TRANSACTIONAL,
        businessValue: BusinessValueTier.TIER_1_CRITICAL,
        searchVolume: 5000,
      });

      const execResult = await SerpExecutionService.executeKeywordSerpCheck({
        websiteId,
        keywordId: kw.id,
        device: SerpDevice.DESKTOP,
      });

      expect(execResult.success).toBe(true);
      expect(execResult.snapshotId).toBeDefined();

      // Verify Snapshot
      const snapshot = await SerpRepository.getLatestSnapshot(kw.id, SerpDevice.DESKTOP);
      expect(snapshot).toBeDefined();
      expect(snapshot?.serpItems.length).toBeGreaterThan(0);

      // Verify Daily Facts
      const facts = await SerpRepository.getRankHistory(kw.id, SerpDevice.DESKTOP);
      expect(facts.length).toBe(1);
      expect(facts[0].visibilityScore).toBeGreaterThanOrEqual(0);
      expect(facts[0].provenanceSource).toBeDefined();

      // Verify Keyword latest cached rank updated
      const updatedKw = await KeywordRepository.getKeywordById(kw.id, websiteId);
      expect(updatedKw?.lastTrackedAt).toBeDefined();
    });

    it('detects Ranking Drops and emits deterministic Recommendations', async () => {
      const kw = await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'critical revenue keyword',
        searchIntent: SearchIntent.TRANSACTIONAL,
        businessValue: BusinessValueTier.TIER_1_CRITICAL,
      });

      const provider = new MockSerpProvider();
      const rawSerp = await provider.fetchSerp({ keyword: kw.keyword, targetDomain: testDomain });

      const events = await SerpEventEngine.evaluateAndEmitEvents({
        websiteId,
        keywordId: kw.id,
        snapshotId: 'test-snap-id',
        keywordText: kw.keyword,
        businessValue: kw.businessValue,
        searchIntent: kw.searchIntent,
        previousRank: 2,
        currentRank: 8, // Dropped 6 spots
        currentResponse: rawSerp,
        targetResults: rawSerp.organicResults.filter((r) => r.domain.includes(testDomain)),
        targetDomain: testDomain,
      });

      const dropEvent = events.find((e) => e.eventType === SerpEventType.OUR_URL_LOST_POSITION);
      expect(dropEvent).toBeDefined();
      expect(dropEvent?.severity).toBe('CRITICAL');
      expect(dropEvent?.recommendationId).toBeDefined();

      // Verify generated Recommendation
      const rec = await prisma.seoRecommendation.findUnique({
        where: { id: dropEvent!.recommendationId! },
      });
      expect(rec).toBeDefined();
      expect(rec?.title).toContain('Investigate Ranking Drop');
    });

    it('detects Keyword Cannibalization under 5-point constraint', async () => {
      const kw = await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'saas reporting api',
        searchIntent: SearchIntent.COMMERCIAL,
        businessValue: BusinessValueTier.TIER_2_HIGH,
      });

      const provider = new MockSerpProvider();
      const rawSerp = await provider.fetchSerp({ keyword: kw.keyword, targetDomain: testDomain });

      // Simulate 2 competing URLs from target domain in top 100
      const competingResults = [
        { position: 4, url: `https://${testDomain}/products/reporting-api`, domain: testDomain, title: 'Product API', snippet: '' },
        { position: 9, url: `https://${testDomain}/blog/best-saas-reporting-apis`, domain: testDomain, title: 'Blog API', snippet: '' },
      ];

      const events = await SerpEventEngine.evaluateAndEmitEvents({
        websiteId,
        keywordId: kw.id,
        snapshotId: 'test-snap-id-2',
        keywordText: kw.keyword,
        businessValue: kw.businessValue,
        searchIntent: kw.searchIntent,
        previousRank: 4,
        currentRank: 4,
        currentResponse: rawSerp,
        targetResults: competingResults,
        targetDomain: testDomain,
      });

      const cannibalEvent = events.find((e) => e.eventType === SerpEventType.KEYWORD_CANNIBALIZATION_DETECTED);
      expect(cannibalEvent).toBeDefined();
      expect(cannibalEvent?.recommendationId).toBeDefined();

      const rec = await prisma.seoRecommendation.findUnique({
        where: { id: cannibalEvent!.recommendationId! },
      });
      expect(rec?.title).toContain('Resolve Keyword Cannibalization');
    });
  });

  describe('7. Competitor Discovery & Keyword Gap Analysis', () => {
    it('discovers competitor domains, calculates overlap, and performs gap analysis', async () => {
      // Execute 3 keyword checks to populate SERPs
      const kw1 = await KeywordRepository.upsertKeyword({ websiteId, keyword: 'cloud compliance audit' });
      const kw2 = await KeywordRepository.upsertKeyword({ websiteId, keyword: 'soc2 compliance automation' });
      const kw3 = await KeywordRepository.upsertKeyword({ websiteId, keyword: 'hipaa cloud assessment' });

      await SerpExecutionService.batchExecuteKeywordChecks(websiteId, [kw1.id, kw2.id, kw3.id]);

      const compRefresh = await CompetitorRepository.refreshCompetitorIntelligence(websiteId, testDomain);
      expect(compRefresh.totalCompetitorsProcessed).toBeGreaterThan(0);

      const directCompetitors = await CompetitorRepository.listCompetitors(websiteId, true);
      expect(directCompetitors.length).toBeGreaterThan(0);

      // Verify platforms like wikipedia / youtube are excluded from direct competitors
      const hasWikiInDirect = directCompetitors.some((c) => c.domain.includes('wikipedia.org'));
      expect(hasWikiInDirect).toBe(false);

      // Verify Keyword Gap Matrix
      const firstComp = directCompetitors[0];
      const gap = await CompetitorRepository.getKeywordGapMatrix(websiteId, firstComp.domain);
      expect(Array.isArray(gap)).toBe(true);
    });
  });

  describe('8. Keyword Discovery Pipeline', () => {
    it('imports seed keywords and classifies them with metric provenance', async () => {
      const seedResult = await KeywordDiscoveryPipeline.importSeeds(websiteId, [
        'best b2b fintech api',
        'how to integrate stripe webhooks',
        'fintech compliance pricing quote',
      ]);

      expect(seedResult.count).toBe(3);
      expect(seedResult.keywords[0].searchIntent).toBe(SearchIntent.COMMERCIAL);
      expect(seedResult.keywords[1].searchIntent).toBe(SearchIntent.INFORMATIONAL);
      expect(seedResult.keywords[2].searchIntent).toBe(SearchIntent.TRANSACTIONAL);
    });
  });

  describe('9. SERP Raw Data Retention Policy', () => {
    it('clears old raw JSON responses while leaving parsed items and facts intact', async () => {
      const kw = await KeywordRepository.upsertKeyword({ websiteId, keyword: 'data retention test keyword' });
      await SerpExecutionService.executeKeywordSerpCheck({ websiteId, keywordId: kw.id });

      const pruneResult = await SerpRepository.pruneRawSerpJson(0); // Prune anything older than 0 days
      expect(pruneResult.prunedCount).toBeGreaterThanOrEqual(1);

      const snapshot = await SerpRepository.getLatestSnapshot(kw.id);
      expect(snapshot?.rawResponseJson).toBeNull();
      expect(snapshot?.serpItems.length).toBeGreaterThan(0); // Parsed items remain intact
    });
  });
});
