import { describe, it, expect, beforeEach } from 'vitest';
import { UrlNormalizer } from '../server/services/crawler/urlNormalizer';
import { UrlScopePolicy } from '../server/services/crawler/urlScopePolicy';
import { RobotsService } from '../server/services/crawler/robotsService';
import { SitemapService } from '../server/services/crawler/sitemapService';
import { ComprehensiveHtmlParser } from '../server/services/crawler/comprehensiveHtmlParser';
import { CanonicalAnalyzer } from '../server/services/crawler/canonicalAnalyzer';
import { HreflangAnalyzer } from '../server/services/crawler/hreflangAnalyzer';
import { Soft404Detector } from '../server/services/crawler/soft404Detector';
import { ExpandedTechnicalIssueDetector } from '../server/services/crawler/expandedTechnicalIssueDetector';
import { DuplicateContentAnalyzer } from '../server/services/crawler/duplicateContentAnalyzer';
import { LinkGraphBuilder } from '../server/services/crawler/linkGraphBuilder';
import { CrawlSnapshotComparator } from '../server/services/crawler/crawlSnapshotComparator';
import { CrawlCoordinator } from '../server/services/crawler/crawlCoordinator';
import { CrawlRepository } from '../server/repositories/crawlRepository';

describe('Phase 2 Production Crawler Intelligence Unit & Lifecycle Tests', () => {
  beforeEach(async () => {
    await CrawlRepository.clearForTesting();
  });

  describe('1. Comprehensive HTML Parser & Structured Metadata', () => {
    it('extracts OpenGraph, JSON-LD, hreflang, multiple H1s, viewport, and alt metrics', () => {
      const html = `
        <!DOCTYPE html>
        <html lang="en-GB">
          <head>
            <title>Enterprise Cloud Security &amp; Observability</title>
            <meta name="description" content="State of the art cloud security and automated compliance monitoring.">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="robots" content="noindex, follow">
            <link rel="canonical" href="https://techscale.io/products/security/">
            <link rel="alternate" hreflang="en-US" href="https://techscale.io/us/security">
            <link rel="alternate" hreflang="de" href="https://techscale.io/de/security">
            <link rel="alternate" hreflang="x-default" href="https://techscale.io/products/security">
            <meta property="og:title" content="Enterprise Cloud Security">
            <meta property="og:description" content="OG Description Text">
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                "name": "TechScale Engine"
              }
            </script>
          </head>
          <body>
            <h1>Primary Heading</h1>
            <h1>Compromised Duplicate Heading</h1>
            <h2>Feature Breakdown</h2>
            <p>TechScale provides zero trust architecture monitoring for distributed engineering systems.</p>
            <a href="/pricing" rel="nofollow">Pricing Overview</a>
            <a href="https://external-partner.com" rel="sponsored">Partner Hub</a>
            <img src="/assets/hero.png" width="800" height="600" loading="lazy">
            <img src="/assets/decorative.png" alt="">
            <img src="/assets/diagram.png" alt="Architecture Diagram">
          </body>
        </html>
      `;

      const parsed = ComprehensiveHtmlParser.parse(html, 'https://techscale.io/products/security', 'https://techscale.io');

      expect(parsed.title).toBe('Enterprise Cloud Security & Observability');
      expect(parsed.metaDescription).toBe('State of the art cloud security and automated compliance monitoring.');
      expect(parsed.htmlLang).toBe('en-GB');
      expect(parsed.metaRobots).toBe('noindex, follow');
      expect(parsed.canonicalMatch).toBe(true);
      expect(parsed.h1Tags.length).toBe(2);
      expect(parsed.h2Tags.length).toBe(1);
      expect(parsed.schemaStatus).toBe('PARSED');
      expect(parsed.schemaTypes).toContain('SoftwareApplication');
      expect(parsed.hreflangs.length).toBe(3);
      expect(parsed.internalLinks.length).toBe(1);
      expect(parsed.internalLinks[0].isNofollow).toBe(true);
      expect(parsed.externalLinks.length).toBe(1);
      expect(parsed.externalLinks[0].isSponsored).toBe(true);
      expect(parsed.missingAltCount).toBe(1);
      expect(parsed.emptyAltCount).toBe(1);
    });
  });

  describe('2. Canonical & Hreflang Analyzers', () => {
    it('detects missing, self-referential, and external canonical targets', () => {
      const selfRes = CanonicalAnalyzer.analyze(
        'https://techscale.io/pricing',
        'https://techscale.io/pricing',
        1,
        'https://techscale.io'
      );
      expect(selfRes.isSelfCanonical).toBe(true);
      expect(selfRes.classification).toBe('SELF_CANONICAL');

      const extRes = CanonicalAnalyzer.analyze(
        'https://techscale.io/pricing',
        'https://external-domain.com/pricing',
        1,
        'https://techscale.io'
      );
      expect(extRes.isExternal).toBe(true);
      expect(extRes.classification).toBe('EXTERNAL_CANONICAL_TARGET');

      const multiRes = CanonicalAnalyzer.analyze(
        'https://techscale.io/pricing',
        'https://techscale.io/pricing',
        2,
        'https://techscale.io'
      );
      expect(multiRes.hasMultipleCanonicals).toBe(true);
      expect(multiRes.classification).toBe('MULTIPLE_CANONICALS');
    });

    it('identifies invalid hreflang syntax, duplicates, and missing self-references', () => {
      const res = HreflangAnalyzer.analyze('https://techscale.io/us/pricing', [
        { lang: 'en-US', href: 'https://techscale.io/us/pricing', normalizedHref: 'https://techscale.io/us/pricing', isValidSyntax: true },
        { lang: 'INVALID_LANG_CODE_9999', href: 'https://techscale.io/xx', normalizedHref: 'https://techscale.io/xx', isValidSyntax: false },
        { lang: 'en-US', href: 'https://techscale.io/duplicate', normalizedHref: 'https://techscale.io/duplicate', isValidSyntax: true },
      ]);

      expect(res.hasSelfReference).toBe(true);
      expect(res.issues.some((i) => i.type === 'INVALID_LANGUAGE_CODE')).toBe(true);
      expect(res.issues.some((i) => i.type === 'DUPLICATE_LANGUAGE_CODE')).toBe(true);
    });
  });

  describe('3. Soft 404 Detection & Issue Engine', () => {
    it('accurately catches Soft 404 signals on HTTP 200 responses', () => {
      const soft404Page = {
        statusCode: 200,
        title: 'Error 404 - Page Not Found',
        h1Tags: ['Page Not Found'],
        visibleText: 'We couldn’t find that page in our database directory.',
        wordCount: 45,
      };

      const result = Soft404Detector.evaluate(soft404Page);
      expect(result.isPossibleSoft404).toBe(true);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7);

      const realPage = {
        statusCode: 200,
        title: 'TechScale Enterprise Pricing & Tier Comparison',
        h1Tags: ['Transparent Pricing for Modern Engineering Teams'],
        visibleText: 'TechScale offers flexible monthly and annual subscriptions with unlimited seats and audit runs.',
        wordCount: 650,
      };

      const realResult = Soft404Detector.evaluate(realPage);
      expect(realResult.isPossibleSoft404).toBe(false);
    });

    it('triggers technical issue detections with versioned rules', () => {
      const issues = ExpandedTechnicalIssueDetector.detectIssues({
        url: 'https://techscale.io/broken',
        statusCode: 404,
        h1Tags: [],
        wordCount: 0,
        isIndexable: false,
        canonicalMatch: false,
        redirectCount: 0,
        imagesCount: 0,
        missingAltCount: 0,
        schemaStatus: 'NO_SCHEMA',
        schemaTypes: [],
      });

      expect(issues.some((i) => i.ruleKey === 'RULE_HTTP_404_NOT_FOUND')).toBe(true);
    });
  });

  describe('4. Crawl Lifecycle: Pause, Resume, and Cancel', () => {
    it('handles pause, resume, and cancel signals gracefully', async () => {
      const runId = 'crawl-run-mock-123';
      expect(CrawlCoordinator.pauseCrawl(runId)).toBe(true);
      expect(CrawlCoordinator.resumeCrawl(runId)).toBe(true);
      expect(await CrawlCoordinator.cancelCrawl(runId)).toBe(true);
    });
  });
});
