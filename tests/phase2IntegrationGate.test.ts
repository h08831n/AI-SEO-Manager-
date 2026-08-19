import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { createApp } from '../server/app';
import { CrawlerQueueRegistry } from '../server/queues/crawlerQueue';
import { CrawlRepository } from '../server/repositories/crawlRepository';
import { WebsiteRepository } from '../server/repositories/websiteRepository';
import { CrawlCoordinator } from '../server/services/crawler/crawlCoordinator';
import { ComprehensiveHtmlParser } from '../server/services/crawler/comprehensiveHtmlParser';
import { LinkGraphBuilder } from '../server/services/crawler/linkGraphBuilder';

// Helper to make native HTTP requests to express app without supertest
function makeRequest(
  server: http.Server,
  options: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: any;
  }
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const reqOptions: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: address.port,
      path: options.path,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode || 500,
          body: parsed,
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

describe('Phase 2 Full Pipeline & Integration Gate Tests', () => {
  let server: http.Server;

  beforeEach(async () => {
    await CrawlRepository.clearForTesting();
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('1. Production Fail-Closed Queue & Asynchronous 202 Enqueue', () => {
    it('rejects in-process crawl queue in production mode when Redis is absent', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalAppMode = process.env.APP_MODE;
      const originalRedis = process.env.REDIS_URL;

      try {
        process.env.NODE_ENV = 'production';
        process.env.APP_MODE = 'PRODUCTION';
        delete process.env.REDIS_URL;

        await expect(
          CrawlerQueueRegistry.enqueueCoordinatorJob('site-1', 'run-1', {
            websiteId: 'site-1',
            seedUrl: 'https://example.com',
          })
        ).rejects.toThrow('QUEUE_UNAVAILABLE');
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.APP_MODE = originalAppMode;
        if (originalRedis) process.env.REDIS_URL = originalRedis;
      }
    });

    it('POST /api/websites/:websiteId/crawls returns HTTP 202 immediately and queues crawlRun', async () => {
      const site = await WebsiteRepository.createWebsite({
        workspaceId: 'ws-techscale-org',
        domain: 'async-pipeline.com',
        name: 'Async Pipeline Site',
        productionUrl: 'https://async-pipeline.com',
        defaultLanguage: 'en-US',
      });

      const response = await makeRequest(server, {
        method: 'POST',
        path: `/api/websites/${site.id}/crawls`,
        headers: { 'x-workspace-id': 'ws-techscale-org' },
        body: {
          seedUrl: 'https://async-pipeline.com',
          maxUrls: 5,
        },
      });

      expect(response.status).toBe(202);
      expect(response.body.crawlRunId).toBeDefined();
      expect(['PENDING', 'QUEUED']).toContain(response.body.status);

      // Verify crawlRun was persisted in repository
      const crawlRun = await CrawlRepository.getCrawlRun(response.body.crawlRunId);
      expect(crawlRun).not.toBeNull();
      expect(crawlRun?.websiteId).toBe(site.id);
    });
  });

  describe('2. 25+ Link Regression Test & Full Link Graph Build', () => {
    it('processes all 25 internal link edges without UI sampling loss', () => {
      const linksHtml = Array.from({ length: 28 }, (_, i) => `<a href="/target-page-${i + 1}">Link Target ${i + 1}</a>`).join('\n');
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>25 Link Test Suite</title></head>
          <body>
            <h1>Extensive Internal Link Hub</h1>
            ${linksHtml}
          </body>
        </html>
      `;

      const parsed = ComprehensiveHtmlParser.parse(html, 'https://techscale.io/hub', 'https://techscale.io');
      expect(parsed.internalLinks.length).toBe(28);

      const discovered = parsed.internalLinks.map((l) => ({
        sourceUrl: 'https://techscale.io/hub',
        targetUrl: l.href,
        normalizedTarget: `https://techscale.io${l.href}`,
        anchorText: l.anchorText,
        isInternal: true,
        isNofollow: false,
      }));

      const graph = LinkGraphBuilder.computeGraphMetrics(
        discovered,
        ['https://techscale.io/hub'],
        ['https://techscale.io/hub', ...discovered.map((d) => d.normalizedTarget)]
      );

      expect(graph.get('https://techscale.io/hub')?.outlinksCount).toBe(28);
    });
  });

  describe('3. Terminal Cancelled State Preservation', () => {
    it('preserves CANCELLED status on abort and never overwrites with COMPLETED', async () => {
      const run = await CrawlRepository.createCrawlRun({
        websiteId: 'site-cancel-test',
        seedUrl: 'https://example.com',
        config: {},
      });

      CrawlCoordinator.cancelCrawl(run.id);

      const updated = await CrawlRepository.getCrawlRun(run.id);
      expect(updated?.status).toBe('CANCELLED');
    });
  });

  describe('4. Tenant Isolation & Protected Route Verification', () => {
    it('prevents Workspace B from reading or starting crawls for Workspace A sites', async () => {
      const siteA = await WebsiteRepository.createWebsite({
        workspaceId: 'workspace-a',
        domain: 'tenant-a.com',
        name: 'Tenant A',
        productionUrl: 'https://tenant-a.com',
        defaultLanguage: 'en-US',
      });

      // Attempt access from Workspace B
      const unauthorizedGet = await makeRequest(server, {
        method: 'GET',
        path: `/api/websites/${siteA.id}`,
        headers: { 'x-workspace-id': 'workspace-b' },
      });

      expect(unauthorizedGet.status).toBe(404);

      const unauthorizedPost = await makeRequest(server, {
        method: 'POST',
        path: `/api/websites/${siteA.id}/crawls`,
        headers: { 'x-workspace-id': 'workspace-b' },
        body: { seedUrl: 'https://tenant-a.com' },
      });

      expect(unauthorizedPost.status).toBe(404);
    });
  });

  describe('5. Database-Level Pagination', () => {
    it('respects page and limit options in repository queries', async () => {
      const runId = 'run-page-test-123';
      const mockPages = Array.from({ length: 15 }, (_, i) => ({
        websiteId: 'site-1',
        crawlRunId: runId,
        url: `https://example.com/p-${i + 1}`,
        normalizedUrl: `https://example.com/p-${i + 1}`,
        pathname: `/p-${i + 1}`,
        statusCode: 200,
        redirectCount: 0,
        loadTimeMs: 100,
        contentLengthBytes: 500,
        isIndexable: true,
        indexabilityStatus: 'INDEXABLE',
        indexabilityReasons: [],
        canonicalMatch: true,
        titleLength: 20,
        metaDescLength: 50,
        h1Tags: ['Heading'],
        h2Count: 1,
        h3Count: 0,
        wordCount: 300,
        isExactDuplicate: false,
        isThinContent: false,
        isPossibleSoft404: false,
        soft404Confidence: 0,
        internalInlinksCount: 1,
        internalOutlinksCount: 2,
        externalOutlinksCount: 0,
        imagesCount: 1,
        missingAltCount: 0,
        schemaTypes: [],
        schemaStatus: 'NO_SCHEMA',
        crawlDepth: 1,
        crawledAt: new Date().toISOString(),
      }));

      await CrawlRepository.saveCrawledPagesBatch(runId, 'site-1', mockPages);

      const page1 = await CrawlRepository.getCrawledPages(runId, { offset: 0, limit: 5 });
      expect(page1.total).toBe(15);
      expect(page1.pages.length).toBe(5);
      expect(page1.pages[0].url).toBe('https://example.com/p-1');

      const page2 = await CrawlRepository.getCrawledPages(runId, { offset: 5, limit: 5 });
      expect(page2.pages.length).toBe(5);
      expect(page2.pages[0].url).toBe('https://example.com/p-6');
    });
  });
});
