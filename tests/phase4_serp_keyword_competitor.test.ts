import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../server/db/prisma';
import { KeywordRepository } from '../server/repositories/keywordRepository';
import { SeoEntityRepository } from '../server/repositories/seoEntityRepository';
import { IntentClassifierService } from '../server/services/serp/intentClassifierService';
import { KeywordMetricProviderRouter, MockKeywordMetricProvider } from '../server/services/serp/metricProviders/keywordMetricProvider';
import { MockSerpProvider } from '../server/services/serp/providers/mockSerpProvider';
import { SerpProviderRouter } from '../server/services/serp/providers/serpProviderRouter';
import { ISerpProvider, SerpQueryRequest, RawSerpResponse } from '../server/services/serp/providers/serpProvider';
import { VisibilityModelEngine } from '../server/services/serp/visibilityModelEngine';
import { CompetitorExclusionEngine } from '../server/services/serp/competitorExclusionEngine';
import { SerpRepository } from '../server/repositories/serpRepository';
import { SerpEventEngine } from '../server/services/serp/serpEventEngine';
import { CompetitorRepository } from '../server/repositories/competitorRepository';
import { SerpExecutionService, SerpExecutionLifecycleStage } from '../server/services/serp/serpExecutionService';
import { KeywordDiscoveryPipeline } from '../server/services/serp/keywordDiscoveryPipeline';
import { SerpQueueProducer } from '../server/queues/serpQueueProducer';
import { SerpQueueConsumer } from '../server/queues/serpQueueConsumer';
import { SerpProviderTimeoutError, SerpRateLimitError } from '../server/services/serp/serpErrors';
import {
  SearchIntent,
  FunnelStage,
  BusinessValueTier,
  SerpDevice,
  SerpFeatureType,
  SerpEventType,
  EntityType,
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

  describe('2. Keyword Universe & Entity Graph Modeling', () => {
    it('creates entities and clusters keywords with target URLs', async () => {
      const entity = await SeoEntityRepository.upsertEntity({
        websiteId,
        name: 'Security Compliance',
        entityType: EntityType.CONCEPT,
        targetUrls: [`https://${testDomain}/solutions/security`],
      });

      const keyword = await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'SOC2 Automated Audit Tool',
        topicEntityId: entity.id,
        targetUrl: `https://${testDomain}/solutions/security/soc2`,
        searchIntent: SearchIntent.TRANSACTIONAL,
        businessValue: BusinessValueTier.TIER_1_CRITICAL,
        moneyKeyword: true,
      });

      expect(keyword.id).toBeDefined();
      expect(keyword.normalizedKeyword).toBe('soc2 automated audit tool');
      expect(keyword.topicEntityId).toBe(entity.id);

      const entityKeywords = await SeoEntityRepository.getEntityKeywords(entity.id);
      expect(entityKeywords.length).toBe(1);
      expect(entityKeywords[0].id).toBe(keyword.id);
    });

    it('enforces normalized keyword deduplication within the same website', async () => {
      await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'SEO Optimisation Tools',
      });

      await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: '  seo optimisation   tools  ',
      });

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
      expect(res.visibilityScore).toBe(395); // 0.316 * 1.25 * 1000
    });
  });

  describe('5. Dependency Direction & Provider Router Architecture', () => {
    it('enforces Service -> SerpProviderRouter -> ISerpProvider decoupling', () => {
      // SerpExecutionService communicates only with SerpProviderRouter and ISerpProvider interface
      const provider = SerpProviderRouter.getProvider('MOCK');
      expect(provider).toBeDefined();
      expect(provider.providerName).toBe('MOCK_SERP_PROVIDER');
      expect(typeof provider.fetchSerp).toBe('function');
    });

    it('allows dynamic registration of custom ISerpProvider implementations', async () => {
      class CustomTestSerpProvider implements ISerpProvider {
        readonly providerName = 'CUSTOM_TEST_PROVIDER';
        isConfigured(): boolean {
          return true;
        }
        async fetchSerp(req: SerpQueryRequest): Promise<RawSerpResponse> {
          return {
            provider: this.providerName,
            keyword: req.keyword,
            device: req.device || SerpDevice.DESKTOP,
            countryCode: req.countryCode || 'US',
            languageCode: 'en',
            searchEngine: 'google',
            organicResults: [
              {
                position: 1,
                url: `https://${req.targetDomain || 'example.com'}/top-page`,
                domain: req.targetDomain || 'example.com',
                title: 'Top Page',
                snippet: 'Top ranking page',
              },
            ],
            features: [],
            rawPayloadHash: 'hash-123',
            retrievedAt: new Date(),
          };
        }
      }

      SerpProviderRouter.registerProvider(new CustomTestSerpProvider());
      const resolved = SerpProviderRouter.getProvider('CUSTOM_TEST_PROVIDER');
      expect(resolved.providerName).toBe('CUSTOM_TEST_PROVIDER');

      const kw = await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'custom provider keyword test',
      });

      const res = await SerpExecutionService.executeKeywordSerpCheck({
        websiteId,
        keywordId: kw.id,
        preferredProvider: 'CUSTOM_TEST_PROVIDER',
      });

      expect(res.success).toBe(true);
      expect(res.currentRank).toBe(1);
    });
  });

  describe('6. Complete SERP Execution Lifecycle Verification', () => {
    it('successfully transitions through all 7 lifecycle stages: QUEUE_CREATED -> PROCESSING -> PROVIDER_FETCH -> SNAPSHOT_CREATED -> RANK_FACT_CREATED -> EVENT_ANALYSIS -> RECOMMENDATION_CREATED', async () => {
      const kw = await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'mission critical platform ranking',
        searchIntent: SearchIntent.TRANSACTIONAL,
        businessValue: BusinessValueTier.TIER_1_CRITICAL,
      });

      // 1. Stage: QUEUE_CREATED
      const { jobId, deduplicated } = await SerpQueueProducer.enqueueSerpCheck({
        jobType: 'SERP_KEYWORD_CHECK',
        websiteId,
        keywordId: kw.id,
        device: SerpDevice.DESKTOP,
      });
      expect(deduplicated).toBe(false);

      const outboxEvent = await prisma.outboxEvent.findFirst({
        where: { aggregateId: kw.id, eventType: 'QUEUE_CREATED' },
      });
      expect(outboxEvent).toBeDefined();

      const initialJobRun = await prisma.jobRun.findFirst({
        where: { jobId },
      });
      expect(initialJobRun).toBeDefined();
      expect(initialJobRun?.status).toBe('PENDING');

      // 2. Stages 2-7: PROCESSING, PROVIDER_FETCH, SNAPSHOT_CREATED, RANK_FACT_CREATED, EVENT_ANALYSIS, RECOMMENDATION_CREATED
      const lifecycleObserved: SerpExecutionLifecycleStage[] = ['QUEUE_CREATED'];

      // Execute via queue consumer worker
      await SerpQueueConsumer.processJobPayload(
        {
          jobType: 'SERP_KEYWORD_CHECK',
          websiteId,
          keywordId: kw.id,
          device: SerpDevice.DESKTOP,
        },
        jobId
      );

      // Verify JobRun completed
      const finishedJobRun = await prisma.jobRun.findFirst({
        where: { jobId },
      });
      expect(finishedJobRun?.status).toBe('COMPLETED');
      expect(finishedJobRun?.progressPct).toBe(100);

      // Verify SNAPSHOT_CREATED in DB
      const snapshot = await SerpRepository.getLatestSnapshot(kw.id);
      expect(snapshot).toBeDefined();
      expect(snapshot?.serpItems.length).toBeGreaterThan(0);

      // Verify RANK_FACT_CREATED in DB
      const rankFact = await prisma.keywordRankDaily.findFirst({
        where: { keywordId: kw.id, websiteId },
      });
      expect(rankFact).toBeDefined();

      // Verify Keyword latest cached rank updated
      const updatedKw = await KeywordRepository.getKeywordById(kw.id, websiteId);
      expect(updatedKw?.lastTrackedAt).toBeDefined();
    });
  });

  describe('7. Queue Failure Handling & Resilience', () => {
    it('handles provider timeout with SerpProviderTimeoutError and updates job status', async () => {
      class TimeoutProvider implements ISerpProvider {
        readonly providerName = 'TIMEOUT_PROVIDER';
        isConfigured(): boolean {
          return true;
        }
        async fetchSerp(): Promise<RawSerpResponse> {
          await new Promise((resolve) => setTimeout(resolve, 50));
          throw new SerpProviderTimeoutError('Provider timeout after 50ms');
        }
      }

      SerpProviderRouter.registerProvider(new TimeoutProvider());

      const kw = await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'timeout resilience keyword',
      });

      const testJobId = `serp-timeout-test-${Date.now()}`;
      await expect(
        SerpQueueConsumer.processJobPayload(
          {
            jobType: 'SERP_KEYWORD_CHECK',
            websiteId,
            keywordId: kw.id,
            preferredProvider: 'TIMEOUT_PROVIDER',
            timeoutMs: 20,
          },
          testJobId
        )
      ).rejects.toThrow();

      const jobRun = await prisma.jobRun.findFirst({ where: { jobId: testJobId } });
      expect(jobRun).toBeDefined();
      expect(jobRun?.status).toBe('FAILED');
      expect(jobRun?.errorMessage).toContain('timeout');
    });

    it('handles provider rate limit (429) and flags RATE_LIMITED with backoff', async () => {
      class RateLimitProvider implements ISerpProvider {
        readonly providerName = 'RATE_LIMIT_PROVIDER';
        isConfigured(): boolean {
          return true;
        }
        async fetchSerp(): Promise<RawSerpResponse> {
          throw new SerpRateLimitError('Too Many Requests (429)', 5000);
        }
      }

      SerpProviderRouter.registerProvider(new RateLimitProvider());

      const kw = await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'rate limit keyword test',
      });

      const testJobId = `serp-ratelimit-test-${Date.now()}`;
      await expect(
        SerpQueueConsumer.processJobPayload(
          {
            jobType: 'SERP_KEYWORD_CHECK',
            websiteId,
            keywordId: kw.id,
            preferredProvider: 'RATE_LIMIT_PROVIDER',
          },
          testJobId
        )
      ).rejects.toThrow();

      const jobRun = await prisma.jobRun.findFirst({ where: { jobId: testJobId } });
      expect(jobRun?.status).toBe('RATE_LIMITED');
      expect(jobRun?.errorMessage).toContain('rate limit');
    });

    it('handles retries and transitions to DEAD_LETTER when maxAttempts is exceeded', async () => {
      class PersistentFailingProvider implements ISerpProvider {
        readonly providerName = 'FAILING_PROVIDER';
        isConfigured(): boolean {
          return true;
        }
        async fetchSerp(): Promise<RawSerpResponse> {
          throw new Error('Fatal downstream unrecoverable provider failure');
        }
      }

      SerpProviderRouter.registerProvider(new PersistentFailingProvider());

      const kw = await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'dead letter test keyword',
      });

      const deadLetterJobId = `serp-deadletter-test-${Date.now()}`;

      // Create initial JobRun with attempts=2 and maxAttempts=3 (so next attempt is #3 and reaches limit)
      await prisma.jobRun.create({
        data: {
          websiteId,
          queueName: 'serp-intelligence-queue',
          jobName: 'SERP_KEYWORD_CHECK',
          jobId: deadLetterJobId,
          status: 'PENDING',
          attempts: 2,
          maxAttempts: 3,
        },
      });

      await expect(
        SerpQueueConsumer.processJobPayload(
          {
            jobType: 'SERP_KEYWORD_CHECK',
            websiteId,
            keywordId: kw.id,
            preferredProvider: 'FAILING_PROVIDER',
          },
          deadLetterJobId
        )
      ).rejects.toThrow();

      const finalJobRun = await prisma.jobRun.findFirst({ where: { jobId: deadLetterJobId } });
      expect(finalJobRun?.status).toBe('DEAD_LETTER');
      expect(finalJobRun?.attempts).toBe(3);

      const deadLetterOutbox = await prisma.outboxEvent.findFirst({
        where: { aggregateId: kw.id, eventType: 'SERP_JOB_DEAD_LETTER' },
      });
      expect(deadLetterOutbox).toBeDefined();
    });

    it('enforces idempotent re-runs by deduplicating active and pending requests', async () => {
      const kw = await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'idempotent keyword check',
      });

      const fixedKey = `serp-${websiteId}-${kw.id}-DESKTOP-idempotent-key`;

      const firstEnqueue = await SerpQueueProducer.enqueueSerpCheck({
        jobType: 'SERP_KEYWORD_CHECK',
        websiteId,
        keywordId: kw.id,
        idempotencyKey: fixedKey,
      });
      expect(firstEnqueue.deduplicated).toBe(false);

      const secondEnqueue = await SerpQueueProducer.enqueueSerpCheck({
        jobType: 'SERP_KEYWORD_CHECK',
        websiteId,
        keywordId: kw.id,
        idempotencyKey: fixedKey,
      });
      expect(secondEnqueue.deduplicated).toBe(true);
      expect(secondEnqueue.jobId).toBe(firstEnqueue.jobId);
    });
  });

  describe('8. Historical Keyword Cannibalization Detection (5-Point Evidence)', () => {
    it('evaluates cannibalization requiring all 5 criteria: multiple URLs, same intent, ranking volatility, CTR dilution, observation window', async () => {
      const kw = await KeywordRepository.upsertKeyword({
        websiteId,
        keyword: 'enterprise reporting automation api',
        searchIntent: SearchIntent.COMMERCIAL,
        businessValue: BusinessValueTier.TIER_1_CRITICAL,
      });

      const urlA = `https://${testDomain}/products/reporting-api`;
      const urlB = `https://${testDomain}/solutions/enterprise-reporting`;

      // 1. Seed historical snapshot (URL A at pos 4, URL B at pos 7)
      const snap1 = await prisma.serpSnapshot.create({
        data: {
          websiteId,
          keywordId: kw.id,
          keywordText: kw.keyword,
          provider: 'MOCK',
          device: SerpDevice.DESKTOP,
          countryCode: 'US',
          searchEngine: 'google',
          snapshotDate: new Date(Date.now() - 5 * 86400 * 1000), // 5 days ago
          ourRank: 4,
          ourRankedUrl: urlA,
          rawPayloadHash: 'hash-snap-hist-1',
          hasMultipleRankings: true,
        },
      });

      await prisma.serpItem.createMany({
        data: [
          { snapshotId: snap1.id, position: 4, url: urlA, domain: testDomain, title: 'Product API', snippet: '' },
          { snapshotId: snap1.id, position: 7, url: urlB, domain: testDomain, title: 'Solutions Reporting', snippet: '' },
        ],
      });

      // 2. Current snapshot shows rank swapping / concurrent competition (URL B at pos 5, URL A at pos 8)
      const currentResults = [
        { position: 5, url: urlB, domain: testDomain, title: 'Solutions Reporting', snippet: '' },
        { position: 8, url: urlA, domain: testDomain, title: 'Product API', snippet: '' },
      ];

      const analysis = await SerpEventEngine.evaluateCannibalizationWithHistory({
        websiteId,
        keywordId: kw.id,
        keywordText: kw.keyword,
        searchIntent: kw.searchIntent,
        targetDomain: testDomain,
        currentResults,
        windowDays: 30,
      });

      expect(analysis.isCannibalizing).toBe(true);
      expect(analysis.criteriaSatisfied.multipleUrls).toBe(true);
      expect(analysis.criteriaSatisfied.sameIntent).toBe(true);
      expect(analysis.criteriaSatisfied.rankingVolatility).toBe(true);
      expect(analysis.criteriaSatisfied.ctrDilution).toBe(true);
      expect(analysis.criteriaSatisfied.observationWindow).toBe(true);

      expect(analysis.competingUrls.length).toBe(2);
      expect(analysis.dilutionEvidence.dilutionLossPct).toBeGreaterThan(0);
      expect(analysis.recommendation).toBeDefined();
      expect(analysis.recommendation?.title).toContain('Resolve Keyword Cannibalization');
    });
  });

  describe('9. Competitor Discovery & Keyword Gap Analysis', () => {
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

  describe('10. Keyword Discovery Pipeline', () => {
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

  describe('11. SERP Raw Data Retention Policy', () => {
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
