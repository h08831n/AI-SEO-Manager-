import { IssueSeverity } from '@prisma/client';

export interface EvaluatedIssue {
  ruleKey: string;
  ruleVersion: string;
  type: string;
  severity: IssueSeverity;
  message: string;
  evidence: Record<string, any>;
  impact: string;
}

export class TechnicalIssueDetector {
  public static readonly VERSION = '1.0.0';

  /**
   * Deterministically evaluates a crawled page and associated graph context for SEO defects
   */
  public static detectIssues(page: {
    url: string;
    statusCode: number;
    title?: string | null;
    metaDescription?: string | null;
    h1Tags: string[];
    h2Count: number;
    wordCount: number;
    isIndexable: boolean;
    metaRobots?: string | null;
    xRobotsTag?: string | null;
    canonicalUrl?: string | null;
    canonicalMatch: boolean;
    redirectCount: number;
    redirectLoop?: boolean;
    imagesCount: number;
    missingAltCount: number;
    schemaStatus: string;
    schemaTypes: string[];
    isExactDuplicate?: boolean;
    isNearDuplicate?: boolean;
    isOrphanCandidate?: boolean;
    crawlDepth?: number;
    brokenOutlinksCount?: number;
  }): EvaluatedIssue[] {
    const issues: EvaluatedIssue[] = [];

    // 1. HTTP Status Issues
    if (page.statusCode >= 400 && page.statusCode < 500) {
      issues.push({
        ruleKey: 'RULE_HTTP_4XX_CLIENT_ERROR',
        ruleVersion: this.VERSION,
        type: page.statusCode === 404 ? '404_NOT_FOUND' : 'HTTP_4XX_CLIENT_ERROR',
        severity: 'CRITICAL',
        message: `HTTP server response returned client error status ${page.statusCode}.`,
        evidence: { statusCode: page.statusCode, url: page.url },
        impact: 'Search engines drop unavailable URLs from index; broken user experience.',
      });
    } else if (page.statusCode >= 500) {
      issues.push({
        ruleKey: 'RULE_HTTP_5XX_SERVER_ERROR',
        ruleVersion: this.VERSION,
        type: 'HTTP_5XX_SERVER_ERROR',
        severity: 'CRITICAL',
        message: `HTTP server response returned fatal server error status ${page.statusCode}.`,
        evidence: { statusCode: page.statusCode, url: page.url },
        impact: 'Crawlers will temporarily back off and eventually drop pages if 5xx persists.',
      });
    }

    // 2. Redirect Issues
    if (page.redirectLoop) {
      issues.push({
        ruleKey: 'RULE_REDIRECT_LOOP',
        ruleVersion: this.VERSION,
        type: 'REDIRECT_LOOP',
        severity: 'CRITICAL',
        message: 'Circular redirect loop detected during request execution.',
        evidence: { url: page.url, redirectCount: page.redirectCount },
        impact: 'Page is unreachable by bots and browsers.',
      });
    } else if (page.redirectCount > 3) {
      issues.push({
        ruleKey: 'RULE_LONG_REDIRECT_CHAIN',
        ruleVersion: this.VERSION,
        type: 'LONG_REDIRECT_CHAIN',
        severity: 'MEDIUM',
        message: `Redirect chain contains ${page.redirectCount} hops. Recommended <= 1 hop.`,
        evidence: { redirectCount: page.redirectCount, url: page.url },
        impact: 'Wastes crawl budget and degrades page load latency.',
      });
    }

    // 3. Title Issues (for 200 OK pages)
    if (page.statusCode === 200) {
      if (!page.title || page.title.trim().length === 0) {
        issues.push({
          ruleKey: 'RULE_MISSING_TITLE_TAG',
          ruleVersion: this.VERSION,
          type: 'MISSING_TITLE',
          severity: 'CRITICAL',
          message: 'Page is missing a `<title>` tag in HTML head.',
          evidence: { title: null },
          impact: 'Critical search engine ranking factor missing; lower click-through rate.',
        });
      } else if (page.title.length < 10) {
        issues.push({
          ruleKey: 'RULE_SHORT_TITLE_TAG',
          ruleVersion: this.VERSION,
          type: 'SHORT_TITLE',
          severity: 'MEDIUM',
          message: `Title length (${page.title.length} chars) is sub-optimally short. Target: 40-60 chars.`,
          evidence: { title: page.title, length: page.title.length },
          impact: 'Sub-optimal keyword relevance and SERP real-estate utilization.',
        });
      } else if (page.title.length > 65) {
        issues.push({
          ruleKey: 'RULE_LONG_TITLE_TAG',
          ruleVersion: this.VERSION,
          type: 'LONG_TITLE',
          severity: 'LOW',
          message: `Title length (${page.title.length} chars) exceeds standard Google pixel display width.`,
          evidence: { title: page.title, length: page.title.length },
          impact: 'Title snippet will be truncated with ellipsis on search engine result pages.',
        });
      }

      // 4. Meta Description Issues
      if (!page.metaDescription || page.metaDescription.trim().length === 0) {
        issues.push({
          ruleKey: 'RULE_MISSING_META_DESCRIPTION',
          ruleVersion: this.VERSION,
          type: 'MISSING_META_DESCRIPTION',
          severity: 'HIGH',
          message: 'Page is missing a meta description.',
          evidence: { metaDescription: null },
          impact: 'Search engines will display random text snippets, hurting organic CTR.',
        });
      }

      // 5. Headings (H1)
      if (page.h1Tags.length === 0) {
        issues.push({
          ruleKey: 'RULE_MISSING_H1_HEADING',
          ruleVersion: this.VERSION,
          type: 'MISSING_H1',
          severity: 'HIGH',
          message: 'Page does not contain an `<h1>` heading element.',
          evidence: { h1Count: 0 },
          impact: 'Weakens primary topical signal and page content hierarchy.',
        });
      } else if (page.h1Tags.length > 1) {
        issues.push({
          ruleKey: 'RULE_MULTIPLE_H1_HEADINGS',
          ruleVersion: this.VERSION,
          type: 'MULTIPLE_H1',
          severity: 'MEDIUM',
          message: `Page defines ${page.h1Tags.length} separate \`<h1>\` tags.`,
          evidence: { h1Tags: page.h1Tags },
          impact: 'Dilutes topical focus across competing top-level headings.',
        });
      }

      // 6. Canonicalization
      if (!page.canonicalMatch) {
        issues.push({
          ruleKey: 'RULE_CANONICAL_MISMATCH',
          ruleVersion: this.VERSION,
          type: 'CANONICAL_MISMATCH',
          severity: 'HIGH',
          message: `Canonical URL points to a different target: ${page.canonicalUrl}`,
          evidence: { pageUrl: page.url, canonicalUrl: page.canonicalUrl },
          impact: 'Search engines will attribute search ranking signals to the canonical target instead.',
        });
      }

      // 7. Image Alt Text
      if (page.missingAltCount > 0) {
        issues.push({
          ruleKey: 'RULE_MISSING_IMAGE_ALT',
          ruleVersion: this.VERSION,
          type: 'MISSING_IMAGE_ALT',
          severity: 'LOW',
          message: `${page.missingAltCount} out of ${page.imagesCount} images lack descriptive \`alt\` attributes.`,
          evidence: { missingAltCount: page.missingAltCount, imagesCount: page.imagesCount },
          impact: 'Degrades Google Images search visibility and accessibility compliance.',
        });
      }

      // 8. Thin Content Signal
      if (page.wordCount < 150) {
        issues.push({
          ruleKey: 'RULE_LOW_CONTENT_SIGNAL',
          ruleVersion: this.VERSION,
          type: 'LOW_CONTENT_SIGNAL',
          severity: 'MEDIUM',
          message: `Page copy has very low text volume (${page.wordCount} words).`,
          evidence: { wordCount: page.wordCount },
          impact: 'Higher susceptibility to low-quality algorithmic filtering on thin pages.',
        });
      }

      // 9. Structured Data Issues
      if (page.schemaStatus === 'JSON_INVALID') {
        issues.push({
          ruleKey: 'RULE_MALFORMED_STRUCTURED_DATA',
          ruleVersion: this.VERSION,
          type: 'MALFORMED_SCHEMA',
          severity: 'MEDIUM',
          message: 'Malformed JSON-LD syntax encountered in structured data block.',
          evidence: { schemaStatus: page.schemaStatus },
          impact: 'Search engines will ignore invalid structured data, losing rich results.',
        });
      }

      // 10. Duplicate Content
      if (page.isExactDuplicate) {
        issues.push({
          ruleKey: 'RULE_EXACT_DUPLICATE_CONTENT',
          ruleVersion: this.VERSION,
          type: 'EXACT_DUPLICATE_CONTENT',
          severity: 'HIGH',
          message: 'Page body text is an exact 100% duplicate of another indexed page.',
          evidence: { isExactDuplicate: true },
          impact: 'Search engines will consolidate or filter duplicate pages from SERP display.',
        });
      }

      // 11. Graph Issues (Orphan Candidate & Depth)
      if (page.isOrphanCandidate) {
        issues.push({
          ruleKey: 'RULE_ORPHAN_PAGE_CANDIDATE',
          ruleVersion: this.VERSION,
          type: 'CRAWL_GRAPH_ORPHAN_CANDIDATE',
          severity: 'HIGH',
          message: 'Page was discovered via sitemap/seed but has 0 internal inlinks from the crawled site graph.',
          evidence: { inlinksCount: 0 },
          impact: 'Page receives zero internal PageRank equity and is difficult for crawlers to discover organically.',
        });
      }

      if (page.crawlDepth !== undefined && page.crawlDepth > 4) {
        issues.push({
          ruleKey: 'RULE_EXCESSIVE_CLICK_DEPTH',
          ruleVersion: this.VERSION,
          type: 'EXCESSIVE_CLICK_DEPTH',
          severity: 'LOW',
          message: `Page requires ${page.crawlDepth} clicks from seed to reach. Recommended <= 3 clicks.`,
          evidence: { crawlDepth: page.crawlDepth },
          impact: 'Deep pages receive less crawler attention and lower internal equity distribution.',
        });
      }
    }

    return issues;
  }
}
