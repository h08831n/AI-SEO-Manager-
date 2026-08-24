import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../server/db/prisma';
import { AttributionLineageService } from '../server/services/attribution/attributionLineageService';
import { SyntheticControlEngine } from '../server/services/attribution/syntheticControlEngine';
import { CausalAttributionEngine } from '../server/services/attribution/causalAttributionEngine';
import { AttributionEvaluationWorker } from '../server/services/worker/attributionEvaluationWorker';
import { AttributionQueueProducer } from '../server/queues/attributionQueueProducer';
import { OutboxDispatcher } from '../server/services/outbox/outboxDispatcher';
import { ActionStatus } from '@prisma/client';

describe('Phase 6.1: Causal Attribution Engine & Synthetic Control Matching', () => {
  const testWebsiteId = 'site-attr-test-01';

  beforeEach(async () => {
    // Reset or seed test website
    await prisma.website.upsert({
      where: { id: testWebsiteId },
      update: { domain: 'acme-analytics.io' },
      create: {
        id: testWebsiteId,
        workspaceId: 'ws-attr-default',
        productionUrl: 'https://acme-analytics.io',
        domain: 'acme-analytics.io',
        name: 'Acme Analytics Corp',
      },
    });
  });

  describe('1. Lineage Chain & Entity Identity Resolution', () => {
    it('normalizes URLs and correctly derives page archetypes', () => {
      const u1 = AttributionLineageService.normalizeUrl('https://acme-analytics.io/product/enterprise-crm?utm_source=test/');
      expect(u1.normalizedUrl).toBe('https://acme-analytics.io/product/enterprise-crm');
      expect(u1.pathname).toBe('/product/enterprise-crm');
      expect(AttributionLineageService.derivePageArchetype(u1.pathname)).toBe('PRODUCT_PAGE');

      const u2 = AttributionLineageService.normalizeUrl('https://acme-analytics.io/blog/scaling-postgresql');
      expect(AttributionLineageService.derivePageArchetype(u2.pathname)).toBe('BLOG_POST');

      const u3 = AttributionLineageService.normalizeUrl('https://acme-analytics.io/pricing');
      expect(AttributionLineageService.derivePageArchetype(u3.pathname)).toBe('PRICING_PAGE');
    });

    it('resolves end-to-end lineage linking ActionExecution -> UrlIdentity -> Keyword -> SeoEvent', async () => {
      const targetUrl = 'https://acme-analytics.io/product/reporting-suite';
      const normalized = 'https://acme-analytics.io/product/reporting-suite';

      // Seed Keyword
      const kw = await prisma.keywordUniverse.create({
        data: {
          websiteId: testWebsiteId,
          keyword: 'reporting suite enterprise',
          normalizedKeyword: 'reporting suite enterprise',
          targetUrl: normalized,
          searchIntent: 'COMMERCIAL',
        },
      });

      // Seed ActionExecution
      const execution = await prisma.actionExecution.create({
        data: {
          websiteId: testWebsiteId,
          actionType: 'TITLE_TAG_OPTIMIZATION',
          targetUrl,
          idempotencyKey: `lineage-test-exec-${Date.now()}`,
          state: ActionStatus.VERIFIED_COMPLETED,
          executedAt: new Date(),
          verifiedAt: new Date(),
          beforeEvidenceJson: JSON.stringify({ title: 'Old Title' }),
          afterEvidenceJson: JSON.stringify({ title: 'New Optimized Title' }),
        },
      });

      const lineage = await AttributionLineageService.resolveLineage(execution.id);

      expect(lineage.actionExecutionId).toBe(execution.id);
      expect(lineage.websiteId).toBe(testWebsiteId);
      expect(lineage.urlIdentityId).toBeDefined();
      expect(lineage.primaryKeywordId).toBe(kw.id);
      expect(lineage.primaryKeywordText).toBe('reporting suite enterprise');
      expect(lineage.pageArchetype).toBe('PRODUCT_PAGE');
      expect(lineage.seoEventId).toBeDefined();

      // Verify SeoEvent history was created
      const seoEvent = await prisma.seoEvent.findUnique({
        where: { id: lineage.seoEventId! },
      });
      expect(seoEvent).toBeDefined();
      expect(seoEvent?.eventType).toBe('ACTION_VERIFIED_COMPLETED');
      expect(seoEvent?.entityUrl).toBe(targetUrl);
    });
  });

  describe('2. Synthetic Control Group Selection Algorithm', () => {
    it('computes multi-factor similarity and enforces strict exclusion rules', async () => {
      const execDate = new Date('2026-06-01T00:00:00Z');

      // Treatment URL
      const treatment = await prisma.urlIdentity.create({
        data: {
          websiteId: testWebsiteId,
          normalizedUrl: 'https://acme-analytics.io/product/cloud-bi',
          pathname: '/product/cloud-bi',
          minCrawlDepth: 2,
          inlinksCount: 15,
        },
      });

      // Treatment Primary Keyword
      const treatKw = await prisma.keywordUniverse.create({
        data: {
          websiteId: testWebsiteId,
          keyword: 'cloud bi software',
          normalizedKeyword: 'cloud bi software',
          targetUrlIdentityId: treatment.id,
        },
      });

      // Valid Candidate 1: Same archetype, similar traffic, similar depth
      const cand1 = await prisma.urlIdentity.create({
        data: {
          websiteId: testWebsiteId,
          normalizedUrl: 'https://acme-analytics.io/product/dashboards',
          pathname: '/product/dashboards',
          minCrawlDepth: 2,
          inlinksCount: 14,
        },
      });

      // Valid Candidate 2: Blog post (different archetype, lower similarity)
      const cand2 = await prisma.urlIdentity.create({
        data: {
          websiteId: testWebsiteId,
          normalizedUrl: 'https://acme-analytics.io/blog/bi-trends-2026',
          pathname: '/blog/bi-trends-2026',
          minCrawlDepth: 3,
          inlinksCount: 5,
        },
      });

      // Candidate 3: Excluded because it had a recent ActionExecution within 60 days
      const cand3 = await prisma.urlIdentity.create({
        data: {
          websiteId: testWebsiteId,
          normalizedUrl: 'https://acme-analytics.io/product/data-prep',
          pathname: '/product/data-prep',
          minCrawlDepth: 2,
          inlinksCount: 12,
        },
      });
      await prisma.actionExecution.create({
        data: {
          websiteId: testWebsiteId,
          actionType: 'META_DESCRIPTION_OPTIMIZATION',
          targetUrl: 'https://acme-analytics.io/product/data-prep',
          idempotencyKey: `recent-exec-${Date.now()}`,
          state: ActionStatus.VERIFIED_COMPLETED,
          executedAt: new Date('2026-05-15T00:00:00Z'), // within 60 days of June 1
        },
      });

      // Candidate 4: Excluded because it shares the same primary keyword (cannibalization guard)
      const cand4 = await prisma.urlIdentity.create({
        data: {
          websiteId: testWebsiteId,
          normalizedUrl: 'https://acme-analytics.io/product/cloud-bi-v2',
          pathname: '/product/cloud-bi-v2',
          minCrawlDepth: 2,
          inlinksCount: 10,
        },
      });
      await prisma.keywordUniverse.create({
        data: {
          websiteId: testWebsiteId,
          keyword: 'cloud bi software',
          normalizedKeyword: 'cloud bi software',
          targetUrlIdentityId: cand4.id,
        },
      });

      // Seed baseline GSC facts for treatment and cand1
      const preDate = new Date('2026-05-10T00:00:00Z');
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: testWebsiteId,
          urlIdentityId: treatment.id,
          date: preDate,
          clicks: 100,
          impressions: 2000,
          position: 12.0,
        },
      });
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: testWebsiteId,
          urlIdentityId: cand1.id,
          date: preDate,
          clicks: 95,
          impressions: 1900,
          position: 13.0,
        },
      });

      const matches = await SyntheticControlEngine.selectSyntheticControls({
        websiteId: testWebsiteId,
        treatmentUrlId: treatment.id,
        treatmentNormalizedUrl: treatment.normalizedUrl,
        treatmentPrimaryKeywordId: treatKw.id,
        executionDate: execDate,
        k: 3,
      });

      // Assertions
      const matchedIds = matches.map(m => m.controlUrlId);
      expect(matchedIds).toContain(cand1.id);
      expect(matchedIds).toContain(cand2.id);
      expect(matchedIds).not.toContain(cand3.id); // Excluded due to recent execution
      expect(matchedIds).not.toContain(cand4.id); // Excluded due to keyword collision

      // cand1 (same archetype, close volume/depth) should have higher similarity than cand2 (blog)
      const cand1Match = matches.find(m => m.controlUrlId === cand1.id)!;
      const cand2Match = matches.find(m => m.controlUrlId === cand2.id)!;
      expect(cand1Match.similarityScore).toBeGreaterThan(cand2Match.similarityScore);
      expect(cand1Match.features.archetypeSimilarity).toBe(1.0);
    });
  });

  describe('3. Deterministic Causal DiD Attribution Engine', () => {
    it('evaluates a WIN when treatment out-lifts synthetic control cohort', async () => {
      const winWebsiteId = 'site-attr-win-01';
      await prisma.website.upsert({
        where: { id: winWebsiteId },
        update: { domain: 'acme-analytics.io' },
        create: {
          id: winWebsiteId,
          workspaceId: 'ws-attr-default',
          productionUrl: 'https://acme-analytics.io',
          domain: 'acme-analytics.io',
          name: 'Acme Analytics Corp',
        },
      });

      const execDate = new Date('2026-05-01T00:00:00Z');

      // 1. Treatment URL & Execution
      const treatUrl = await prisma.urlIdentity.create({
        data: {
          websiteId: winWebsiteId,
          normalizedUrl: 'https://acme-analytics.io/product/sql-editor',
          pathname: '/product/sql-editor',
        },
      });

      const exec = await prisma.actionExecution.create({
        data: {
          websiteId: winWebsiteId,
          actionType: 'STRUCTURED_DATA_INJECTION',
          targetUrl: treatUrl.normalizedUrl,
          idempotencyKey: `eval-exec-${Date.now()}`,
          state: ActionStatus.VERIFIED_COMPLETED,
          executedAt: execDate,
          verifiedAt: execDate,
        },
      });

      // 2. Control Twin URL
      const ctrlUrl = await prisma.urlIdentity.create({
        data: {
          websiteId: winWebsiteId,
          normalizedUrl: 'https://acme-analytics.io/product/query-builder',
          pathname: '/product/query-builder',
        },
      });

      // 3. Treatment Pre (100 clicks, pos 14) -> Post (250 clicks, pos 8) = +150 clicks, +6 pos
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: winWebsiteId,
          urlIdentityId: treatUrl.id,
          date: new Date('2026-04-15T00:00:00Z'),
          clicks: 100,
          impressions: 2000,
          position: 14.0,
        },
      });
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: winWebsiteId,
          urlIdentityId: treatUrl.id,
          date: new Date('2026-05-20T00:00:00Z'),
          clicks: 250,
          impressions: 3500,
          position: 8.0,
        },
      });

      // 4. Control Pre (80 clicks) -> Post (90 clicks) = +10 clicks (market trend)
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: winWebsiteId,
          urlIdentityId: ctrlUrl.id,
          date: new Date('2026-04-15T00:00:00Z'),
          clicks: 80,
          impressions: 1600,
          position: 15.0,
        },
      });
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: winWebsiteId,
          urlIdentityId: ctrlUrl.id,
          date: new Date('2026-05-20T00:00:00Z'),
          clicks: 90,
          impressions: 1700,
          position: 15.0,
        },
      });

      // Run Evaluation
      const result = await CausalAttributionEngine.evaluateActionExecution(exec.id, 30);

      // Delta Treatment = 250 - 100 = 150
      // Delta Control = 90 - 80 = 10
      // Net Causal Lift = 150 - 10 = 140
      expect(result.clickLiftDelta).toBe(150);
      expect(result.syntheticControlDelta).toBe(10);
      expect(result.netCausalLift).toBe(140);
      expect(result.rankDelta).toBe(6.0); // 14.0 - 8.0 = +6 positions
      expect(result.outcomeCategory).toBe('WIN');
      expect(result.confidenceScore).toBeGreaterThan(0.5);

      // Verify persisted ActionAttributionFact
      const savedFact = await prisma.actionAttributionFact.findUnique({
        where: { actionExecutionId: exec.id },
      });
      expect(savedFact).toBeDefined();
      expect(savedFact?.outcomeCategory).toBe('WIN');
      expect(savedFact?.netCausalLift).toBe(140);
    });

    it('evaluates a LOSS when treatment underperforms control baseline', async () => {
      const lossWebsiteId = 'site-attr-loss-01';
      await prisma.website.upsert({
        where: { id: lossWebsiteId },
        update: { domain: 'acme-analytics.io' },
        create: {
          id: lossWebsiteId,
          workspaceId: 'ws-attr-default',
          productionUrl: 'https://acme-analytics.io',
          domain: 'acme-analytics.io',
          name: 'Acme Analytics Corp',
        },
      });

      const execDate = new Date('2026-05-01T00:00:00Z');

      const treatUrl = await prisma.urlIdentity.create({
        data: {
          websiteId: lossWebsiteId,
          normalizedUrl: 'https://acme-analytics.io/product/slow-loader',
          pathname: '/product/slow-loader',
        },
      });

      const exec = await prisma.actionExecution.create({
        data: {
          websiteId: lossWebsiteId,
          actionType: 'REDIRECT_CHAIN_REMEDIATION',
          targetUrl: treatUrl.normalizedUrl,
          idempotencyKey: `loss-exec-${Date.now()}`,
          state: ActionStatus.VERIFIED_COMPLETED,
          executedAt: execDate,
          verifiedAt: execDate,
        },
      });

      const ctrlUrl = await prisma.urlIdentity.create({
        data: {
          websiteId: lossWebsiteId,
          normalizedUrl: 'https://acme-analytics.io/product/stable-app',
          pathname: '/product/stable-app',
        },
      });

      // Treatment Pre (100 clicks, pos 5) -> Post (40 clicks, pos 15) = -60 clicks, -10 pos
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: lossWebsiteId,
          urlIdentityId: treatUrl.id,
          date: new Date('2026-04-15T00:00:00Z'),
          clicks: 100,
          impressions: 2000,
          position: 5.0,
        },
      });
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: lossWebsiteId,
          urlIdentityId: treatUrl.id,
          date: new Date('2026-05-20T00:00:00Z'),
          clicks: 40,
          impressions: 900,
          position: 15.0,
        },
      });

      // Control Pre (100 clicks) -> Post (105 clicks) = +5 clicks
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: lossWebsiteId,
          urlIdentityId: ctrlUrl.id,
          date: new Date('2026-04-15T00:00:00Z'),
          clicks: 100,
          impressions: 2000,
          position: 6.0,
        },
      });
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: lossWebsiteId,
          urlIdentityId: ctrlUrl.id,
          date: new Date('2026-05-20T00:00:00Z'),
          clicks: 105,
          impressions: 2050,
          position: 6.0,
        },
      });

      const result = await CausalAttributionEngine.evaluateActionExecution(exec.id, 30);

      expect(result.clickLiftDelta).toBe(-60);
      expect(result.netCausalLift).toBe(-65);
      expect(result.rankDelta).toBe(-10.0);
      expect(result.outcomeCategory).toBe('LOSS');
    });

    it('evaluates INCONCLUSIVE when observation window is too short (< 14 days) or data is insufficient', async () => {
      const inconcWebsiteId = 'site-attr-inconc-01';
      await prisma.website.upsert({
        where: { id: inconcWebsiteId },
        update: { domain: 'acme-analytics.io' },
        create: {
          id: inconcWebsiteId,
          workspaceId: 'ws-attr-default',
          productionUrl: 'https://acme-analytics.io',
          domain: 'acme-analytics.io',
          name: 'Acme Analytics Corp',
        },
      });

      const execDate = new Date('2026-05-01T00:00:00Z');

      const treatUrl = await prisma.urlIdentity.create({
        data: {
          websiteId: inconcWebsiteId,
          normalizedUrl: 'https://acme-analytics.io/product/new-draft',
          pathname: '/product/new-draft',
        },
      });

      const exec = await prisma.actionExecution.create({
        data: {
          websiteId: inconcWebsiteId,
          actionType: 'TITLE_TAG_OPTIMIZATION',
          targetUrl: treatUrl.normalizedUrl,
          idempotencyKey: `inconc-exec-${Date.now()}`,
          state: ActionStatus.VERIFIED_COMPLETED,
          executedAt: execDate,
          verifiedAt: execDate,
        },
      });

      // Window is 7 days (< 14 days minimum requirement)
      const shortWindowResult = await CausalAttributionEngine.evaluateActionExecution(exec.id, 7);
      expect(shortWindowResult.outcomeCategory).toBe('INCONCLUSIVE');

      const savedFact = await prisma.actionAttributionFact.findUnique({
        where: { actionExecutionId: exec.id },
      });
      expect(savedFact?.outcomeCategory).toBe('INCONCLUSIVE');
    });

    it('evaluates INCONCLUSIVE when SERP volatility update is detected during the evaluation window', async () => {
      const volatileWebsiteId = 'site-attr-vol-01';
      await prisma.website.upsert({
        where: { id: volatileWebsiteId },
        update: { domain: 'acme-analytics.io' },
        create: {
          id: volatileWebsiteId,
          workspaceId: 'ws-attr-default',
          productionUrl: 'https://acme-analytics.io',
          domain: 'acme-analytics.io',
          name: 'Acme Analytics Corp',
        },
      });

      const execDate = new Date('2026-05-01T00:00:00Z');

      const treatUrl = await prisma.urlIdentity.create({
        data: {
          websiteId: volatileWebsiteId,
          normalizedUrl: 'https://acme-analytics.io/product/volatile-page',
          pathname: '/product/volatile-page',
        },
      });

      const kw = await prisma.keywordUniverse.create({
        data: {
          websiteId: volatileWebsiteId,
          keyword: 'volatile analytics keyword',
          normalizedKeyword: 'volatile analytics keyword',
        },
      });

      const exec = await prisma.actionExecution.create({
        data: {
          websiteId: volatileWebsiteId,
          actionType: 'CONTENT_EXPANSION',
          targetUrl: treatUrl.normalizedUrl,
          idempotencyKey: `vol-exec-${Date.now()}`,
          state: ActionStatus.VERIFIED_COMPLETED,
          executedAt: execDate,
          verifiedAt: execDate,
        },
      });

      // Inject SERP Volatility event
      await prisma.serpSnapshotEvent.create({
        data: {
          websiteId: volatileWebsiteId,
          keywordId: kw.id,
          eventType: 'ALGORITHM_UPDATE_DETECTED' as any,
          severity: 'CRITICAL',
          description: 'Major Google Core Algorithm Update roll-out',
          metadataJson: JSON.stringify({ impact: 'HIGH_TURBULENCE' }),
          createdAt: new Date('2026-05-15T00:00:00Z'),
        },
      });

      const result = await CausalAttributionEngine.evaluateActionExecution(exec.id, 30);
      expect(result.outcomeCategory).toBe('INCONCLUSIVE');
    });
  });

  describe('5. End-to-End Lineage & Bayesian Learning Input Compatibility', () => {
    it('verifies ActionExecution -> SeoEvent -> AttributionFact -> Bayesian learning input compatibility', async () => {
      const e2eWebsiteId = 'site-attr-e2e-bayesian';
      await prisma.website.upsert({
        where: { id: e2eWebsiteId },
        update: { domain: 'acme-e2e.io' },
        create: {
          id: e2eWebsiteId,
          workspaceId: 'ws-attr-default',
          productionUrl: 'https://acme-e2e.io',
          domain: 'acme-e2e.io',
          name: 'Acme E2E Learning Corp',
        },
      });

      const execDate = new Date('2026-05-01T00:00:00Z');

      // 1. URL and Primary Keyword
      const pageUrl = await prisma.urlIdentity.create({
        data: {
          websiteId: e2eWebsiteId,
          normalizedUrl: 'https://acme-e2e.io/features/bayesian-modeling',
          pathname: '/features/bayesian-modeling',
        },
      });

      const kw = await prisma.keywordUniverse.create({
        data: {
          websiteId: e2eWebsiteId,
          keyword: 'bayesian seo modeling',
          normalizedKeyword: 'bayesian seo modeling',
          targetUrlIdentityId: pageUrl.id,
        },
      });

      // 2. Control twin for synthetic control matching
      const ctrlUrl = await prisma.urlIdentity.create({
        data: {
          websiteId: e2eWebsiteId,
          normalizedUrl: 'https://acme-e2e.io/features/linear-modeling',
          pathname: '/features/linear-modeling',
        },
      });

      // 3. Create SeoEvent (Action Applied)
      const seoEvent = await prisma.seoEvent.create({
        data: {
          websiteId: e2eWebsiteId,
          eventType: 'ACTION_APPLIED',
          entityType: 'URL',
          entityId: pageUrl.id,
          source: 'ACTION_ENGINE',
          severity: 'INFO',
          eventDate: execDate,
          deltaNotes: 'Applied Schema Markup Injection',
          details: JSON.stringify({ actionType: 'STRUCTURED_DATA_INJECTION', ruleKey: 'RULE_SCHEMA_PRODUCT' }),
        },
      });

      // 4. Create Recommendation and ActionExecution linked to SeoEvent
      const rec = await prisma.seoRecommendation.create({
        data: {
          websiteId: e2eWebsiteId,
          ruleKey: 'RULE_SCHEMA_PRODUCT',
          title: 'Inject Product Schema',
          targetUrl: pageUrl.normalizedUrl,
          status: 'APPLIED',
        },
      });

      const actionExec = await prisma.actionExecution.create({
        data: {
          websiteId: e2eWebsiteId,
          actionType: 'STRUCTURED_DATA_INJECTION',
          recommendationId: rec.id,
          targetUrl: pageUrl.normalizedUrl,
          idempotencyKey: `e2e-exec-${Date.now()}`,
          state: ActionStatus.VERIFIED_COMPLETED,
          executedAt: execDate,
          verifiedAt: execDate,
          seoEventId: seoEvent.id,
        },
      });

      // 5. Pre & Post GSC analytics facts
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: e2eWebsiteId,
          urlIdentityId: pageUrl.id,
          date: new Date('2026-04-10T00:00:00Z'),
          clicks: 50,
          impressions: 1000,
          position: 12.0,
        },
      });
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: e2eWebsiteId,
          urlIdentityId: pageUrl.id,
          date: new Date('2026-05-20T00:00:00Z'),
          clicks: 180,
          impressions: 2500,
          position: 6.0,
        },
      });

      // Control facts
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: e2eWebsiteId,
          urlIdentityId: ctrlUrl.id,
          date: new Date('2026-04-10T00:00:00Z'),
          clicks: 40,
          impressions: 900,
          position: 14.0,
        },
      });
      await prisma.gscSearchAnalyticsFact.create({
        data: {
          websiteId: e2eWebsiteId,
          urlIdentityId: ctrlUrl.id,
          date: new Date('2026-05-20T00:00:00Z'),
          clicks: 45,
          impressions: 950,
          position: 14.0,
        },
      });

      // 6. Execute Causal Attribution Engine
      const evalResult = await CausalAttributionEngine.evaluateActionExecution(actionExec.id, 30);
      expect(evalResult.outcomeCategory).toBe('WIN');
      expect(evalResult.confidenceScore).toBeGreaterThanOrEqual(0.50);

      // 7. Verify ActionAttributionFact was created and links back to SeoEvent
      const attributionFact = await prisma.actionAttributionFact.findUnique({
        where: { actionExecutionId: actionExec.id },
        include: {
          seoEvent: true,
          actionExecution: true,
          urlIdentity: true,
        },
      });

      expect(attributionFact).toBeDefined();
      expect(attributionFact?.seoEventId).toBe(seoEvent.id);
      expect(attributionFact?.ruleKey).toBe('RULE_SCHEMA_PRODUCT');
      expect(attributionFact?.outcomeCategory).toBe('WIN');

      // 8. Validate compatibility with Phase 6.2 Bayesian Learning inputs
      // Phase 6.2 consumes (websiteId, ruleKey, cmsProvider, pageArchetype, outcomeCategory, confidenceScore)
      const bayesianInputPayload = {
        websiteId: attributionFact!.websiteId,
        ruleKey: attributionFact!.ruleKey,
        cmsProvider: attributionFact!.cmsProvider,
        pageArchetype: attributionFact!.pageArchetype,
        outcome: attributionFact!.outcomeCategory as 'WIN' | 'LOSS' | 'NEUTRAL' | 'INCONCLUSIVE',
        confidenceScore: attributionFact!.confidenceScore,
        netCausalLift: attributionFact!.netCausalLift,
      };

      expect(bayesianInputPayload.websiteId).toBe(e2eWebsiteId);
      expect(bayesianInputPayload.ruleKey).toBe('RULE_SCHEMA_PRODUCT');
      expect(['WIN', 'LOSS', 'NEUTRAL', 'INCONCLUSIVE']).toContain(bayesianInputPayload.outcome);
      expect(typeof bayesianInputPayload.confidenceScore).toBe('number');
      expect(bayesianInputPayload.confidenceScore).toBeGreaterThan(0);
    });
  });

  describe('4. Event-Driven Outbox & Worker Lifecycle', () => {
    it('enqueues attribution job via AttributionQueueProducer and records Outbox event', async () => {
      const enqueueRes = await AttributionQueueProducer.enqueueAttributionEvaluation({
        jobType: 'EVALUATE_ATTRIBUTION',
        websiteId: testWebsiteId,
        actionExecutionId: 'test-exec-123',
        horizonDays: 30,
      });

      expect(enqueueRes.jobId).toBeDefined();
      expect(enqueueRes.deduplicated).toBe(false);

      // Verify JobRun was registered
      const jobRun = await prisma.jobRun.findFirst({
        where: { jobId: enqueueRes.jobId },
      });
      expect(jobRun).toBeDefined();
      expect(jobRun?.queueName).toBe('attribution-evaluation-queue');
      expect(jobRun?.status).toBe('PENDING');
    });

    it('processes batch evaluations for mature executions reaching 14+ days', async () => {
      const oldDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000); // 20 days ago

      const treatUrl = await prisma.urlIdentity.create({
        data: {
          websiteId: testWebsiteId,
          normalizedUrl: 'https://acme-analytics.io/product/mature-page',
          pathname: '/product/mature-page',
        },
      });

      const matureExec = await prisma.actionExecution.create({
        data: {
          websiteId: testWebsiteId,
          actionType: 'INTERNAL_LINK_INJECTION',
          targetUrl: treatUrl.normalizedUrl,
          idempotencyKey: `mature-exec-${Date.now()}`,
          state: ActionStatus.VERIFIED_COMPLETED,
          executedAt: oldDate,
          verifiedAt: oldDate,
        },
      });

      const batchRes = await AttributionEvaluationWorker.batchEvaluateMatureExecutions(testWebsiteId);
      expect(batchRes.evaluatedCount).toBeGreaterThanOrEqual(1);

      const foundResult = batchRes.results.find(r => r.actionExecutionId === matureExec.id);
      expect(foundResult).toBeDefined();
    });
  });
});
