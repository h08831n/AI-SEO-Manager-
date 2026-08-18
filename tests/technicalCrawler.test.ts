import { describe, it, expect, beforeEach } from 'vitest';
import { UrlNormalizer } from '../server/services/crawler/urlNormalizer';
import { UrlScopePolicy } from '../server/services/crawler/urlScopePolicy';
import { RobotsService } from '../server/services/crawler/robotsService';
import { DuplicateContentAnalyzer } from '../server/services/crawler/duplicateContentAnalyzer';
import { LinkGraphBuilder } from '../server/services/crawler/linkGraphBuilder';
import { TechnicalIssueDetector } from '../server/services/crawler/technicalIssueDetector';
import { CrawlSnapshotComparator } from '../server/services/crawler/crawlSnapshotComparator';

describe('Technical Crawler Subsystem Tests', () => {
  describe('UrlNormalizer', () => {
    it('normalizes trailing slashes, tracking parameters, and sorts query parameters', () => {
      const input = 'https://TechScale.io:443/products/saas/?utm_source=google&b_param=2&a_param=1#fragment';
      const normalized = UrlNormalizer.normalize(input);
      expect(normalized).toBe('https://techscale.io/products/saas?a_param=1&b_param=2');
    });

    it('preserves root slash and handles relative path normalization', () => {
      const root = UrlNormalizer.normalize('https://techscale.io/');
      expect(root).toBe('https://techscale.io/');

      const resolved = UrlNormalizer.resolveAndNormalize('/about-us', 'https://techscale.io/products');
      expect(resolved).toBe('https://techscale.io/about-us');
    });
  });

  describe('UrlScopePolicy', () => {
    it('restricts crawl to allowed hostname and evaluates max depth', () => {
      const scopeConfig = {
        allowedHost: 'techscale.io',
        allowSubdomains: false,
        maxDepth: 3,
        excludePatterns: ['/admin', '/api/*'],
      };

      const inScope = UrlScopePolicy.isUrlInScope('https://techscale.io/pricing', 1, scopeConfig);
      expect(inScope.allowed).toBe(true);

      const externalDomain = UrlScopePolicy.isUrlInScope('https://google.com/search', 1, scopeConfig);
      expect(externalDomain.allowed).toBe(false);
      expect(externalDomain.reason).toBe('EXTERNAL_DOMAIN');

      const maxDepthExceeded = UrlScopePolicy.isUrlInScope('https://techscale.io/deep/p4', 4, scopeConfig);
      expect(maxDepthExceeded.allowed).toBe(false);

      const excluded = UrlScopePolicy.isUrlInScope('https://techscale.io/admin/settings', 1, scopeConfig);
      expect(excluded.allowed).toBe(false);
    });
  });

  describe('RobotsService (RFC 9309)', () => {
    it('correctly respects User-Agent directives and longest match priority', () => {
      const robotsContent = `
        User-agent: *
        Disallow: /private/
        Allow: /private/public-doc

        User-agent: Googlebot
        Disallow: /
      `;

      const parsed = RobotsService.parseRobotsTxt(robotsContent);

      const allowedSpecific = RobotsService.isAllowed(parsed, 'https://techscale.io/private/public-doc', 'AISEOManagerBot');
      expect(allowedSpecific.allowed).toBe(true);

      const disallowedGeneral = RobotsService.isAllowed(parsed, 'https://techscale.io/private/secret', 'AISEOManagerBot');
      expect(disallowedGeneral.allowed).toBe(false);
    });
  });

  describe('DuplicateContentAnalyzer (Exact Hash & SimHash64)', () => {
    it('identifies exact text match via SHA-256 and detects near-duplicates using SimHash distance', () => {
      const textA = 'TechScale enterprise search engine optimization platform audit automated workflow';
      const textB = 'TechScale enterprise search engine optimization platform audit automated workflow';
      const textC = 'TechScale enterprise search engine optimization platform audit automated workflow updated';

      const hashA = DuplicateContentAnalyzer.generateExactHash(textA);
      const hashB = DuplicateContentAnalyzer.generateExactHash(textB);
      expect(hashA).toBe(hashB);

      const simA = DuplicateContentAnalyzer.generateSimHash64(textA);
      const simB = DuplicateContentAnalyzer.generateSimHash64(textB);
      expect(simA).toBe(simB);

      const simC = DuplicateContentAnalyzer.generateSimHash64(textC);
      const dist = DuplicateContentAnalyzer.hammingDistance(simA, simC);
      expect(dist).toBeLessThanOrEqual(10);
      expect(dist).toBeGreaterThanOrEqual(0);
    });
  });

  describe('LinkGraphBuilder (Inlinks, Outlinks, Click Depth, Orphans)', () => {
    it('computes internal inlinks and accurately flags orphan candidate URLs', () => {
      const seed = 'https://techscale.io/';
      const p1 = 'https://techscale.io/pricing';
      const p2 = 'https://techscale.io/features';
      const orphan = 'https://techscale.io/orphan-landing';

      const edges = [
        { sourceUrl: seed, targetUrl: p1, normalizedTarget: p1, isInternal: true, isNofollow: false },
        { sourceUrl: p1, targetUrl: p2, normalizedTarget: p2, isInternal: true, isNofollow: false },
      ];

      const graph = LinkGraphBuilder.computeGraphMetrics(edges, [seed], [seed, p1, p2, orphan]);

      expect(graph.get(p1)?.inlinksCount).toBe(1);
      expect(graph.get(p1)?.crawlDepth).toBe(1);
      expect(graph.get(p2)?.crawlDepth).toBe(2);
      expect(graph.get(orphan)?.isOrphanCandidate).toBe(true);
      expect(graph.get(orphan)?.inlinksCount).toBe(0);
    });
  });

  describe('TechnicalIssueDetector & CrawlSnapshotComparator', () => {
    it('detects canonical mismatches, missing titles, and generates SEO events across crawl diffs', () => {
      const issues = TechnicalIssueDetector.detectIssues({
        url: 'https://techscale.io/blog',
        statusCode: 200,
        title: null, // missing title
        metaDescription: 'Valid meta description',
        h1Tags: ['TechScale Blog', 'Secondary Heading'], // multiple H1s
        h2Count: 3,
        wordCount: 500,
        isIndexable: true,
        canonicalUrl: 'https://techscale.io/canonical-target',
        canonicalMatch: false,
        redirectCount: 0,
        imagesCount: 2,
        missingAltCount: 1,
        schemaStatus: 'VALID',
        schemaTypes: ['Article'],
      });

      const missingTitle = issues.find((i) => i.type === 'MISSING_TITLE');
      const canonicalMismatch = issues.find((i) => i.type === 'CANONICAL_MISMATCH');
      const multipleH1 = issues.find((i) => i.type === 'MULTIPLE_H1');
      const missingAlt = issues.find((i) => i.type === 'MISSING_IMAGE_ALT');

      expect(missingTitle).toBeDefined();
      expect(missingTitle?.severity).toBe('CRITICAL');
      expect(canonicalMismatch).toBeDefined();
      expect(multipleH1).toBeDefined();
      expect(missingAlt).toBeDefined();

      // Snapshot comparator diff
      const current = [
        {
          url: 'https://techscale.io/page',
          normalizedUrl: 'https://techscale.io/page',
          statusCode: 404,
          title: 'Not Found',
          h1Tags: [],
          isIndexable: false,
          inlinksCount: 1,
        },
      ];
      const previous = [
        {
          url: 'https://techscale.io/page',
          normalizedUrl: 'https://techscale.io/page',
          statusCode: 200,
          title: 'Live Page',
          h1Tags: ['Live'],
          isIndexable: true,
          inlinksCount: 1,
        },
      ];

      const diffEvents = CrawlSnapshotComparator.compareSnapshots('site-test', 'crawl-02', current, previous);
      const new404Event = diffEvents.find((e) => e.eventType === 'NEW_404');
      expect(new404Event).toBeDefined();
      expect(new404Event?.severity).toBe('CRITICAL');
    });
  });
});
