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

export class ExpandedTechnicalIssueDetector {
  public static readonly VERSION = '2.0.0';

  public static detectIssues(page: {
    url: string;
    statusCode: number;
    title?: string | null;
    metaDescription?: string | null;
    h1Tags: string[];
    h2Tags?: string[];
    h3Count?: number;
    wordCount: number;
    isIndexable: boolean;
    metaRobots?: string | null;
    xRobotsTag?: string | null;
    canonicalUrl?: string | null;
    canonicalMatch: boolean;
    hasMultipleCanonicals?: boolean;
    isMalformedCanonical?: boolean;
    redirectCount: number;
    redirectLoop?: boolean;
    isDowngradeToHttp?: boolean;
    imagesCount: number;
    missingAltCount: number;
    emptyAltCount?: number;
    schemaStatus: string;
    schemaTypes: string[];
    isExactDuplicate?: boolean;
    isNearDuplicate?: boolean;
    isPossibleSoft404?: boolean;
    soft404Confidence?: number;
    isOrphanCandidate?: boolean;
    crawlDepth?: number;
    hreflangIssues?: Array<{ type: string; message: string; lang: string }>;
    brokenOutlinksCount?: number;
  }): EvaluatedIssue[] {
    const issues: EvaluatedIssue[] = [];

    // 1. HTTP Status Codes
    if (page.statusCode === 404) {
      issues.push({
        ruleKey: 'RULE_HTTP_404_NOT_FOUND',
        ruleVersion: this.VERSION,
        type: '404_NOT_FOUND',
        severity: 'CRITICAL',
        message: 'HTTP response returned 404 Not Found.',
        evidence: { statusCode: 404, url: page.url },
        impact: 'Search engines drop missing URLs; broken user navigation journey.',
      });
    } else if (page.statusCode >= 400 && page.statusCode < 500) {
      issues.push({
        ruleKey: 'RULE_HTTP_4XX_CLIENT_ERROR',
        ruleVersion: this.VERSION,
        type: 'HTTP_4XX_CLIENT_ERROR',
        severity: 'CRITICAL',
        message: `HTTP server response returned client error ${page.statusCode}.`,
        evidence: { statusCode: page.statusCode, url: page.url },
        impact: 'Search engines cannot crawl or index client error endpoints.',
      });
    } else if (page.statusCode >= 500) {
      issues.push({
        ruleKey: 'RULE_HTTP_5XX_SERVER_ERROR',
        ruleVersion: this.VERSION,
        type: 'HTTP_5XX_SERVER_ERROR',
        severity: 'CRITICAL',
        message: `HTTP server returned fatal 5xx server error ${page.statusCode}.`,
        evidence: { statusCode: page.statusCode, url: page.url },
        impact: 'Crawlers reduce crawl frequency and drop unresolvable URLs.',
      });
    }

    // 2. Redirect Intelligence
    if (page.redirectLoop) {
      issues.push({
        ruleKey: 'RULE_REDIRECT_LOOP',
        ruleVersion: this.VERSION,
        type: 'REDIRECT_LOOP',
        severity: 'CRITICAL',
        message: 'Circular redirect loop detected during request execution.',
        evidence: { redirectCount: page.redirectCount, url: page.url },
        impact: 'URL is completely unreachable by crawlers and users.',
      });
    } else if (page.redirectCount > 3) {
      issues.push({
        ruleKey: 'RULE_LONG_REDIRECT_CHAIN',
        ruleVersion: this.VERSION,
        type: 'LONG_REDIRECT_CHAIN',
        severity: 'MEDIUM',
        message: `Redirect chain contains ${page.redirectCount} hops. Target <= 1 hop.`,
        evidence: { redirectCount: page.redirectCount, url: page.url },
        impact: 'Degrades TTFB and wastes search engine crawl budget.',
      });
    }

    if (page.isDowngradeToHttp) {
      issues.push({
        ruleKey: 'RULE_REDIRECT_HTTP_DOWNGRADE',
        ruleVersion: this.VERSION,
        type: 'REDIRECT_HTTP_DOWNGRADE',
        severity: 'HIGH',
        message: 'Secure HTTPS URL redirected to unencrypted HTTP destination.',
        evidence: { url: page.url },
        impact: 'Security vulnerability and negative HTTPS ranking signal.',
      });
    }

    // 3. Indexability & Robots Directives
    if (page.metaRobots && page.metaRobots.toLowerCase().includes('noindex')) {
      issues.push({
        ruleKey: 'RULE_NOINDEX_PAGE',
        ruleVersion: this.VERSION,
        type: 'NOINDEX_PAGE',
        severity: 'HIGH',
        message: 'HTML meta tag explicitly specifies "noindex" directive.',
        evidence: { metaRobots: page.metaRobots },
        impact: 'Prevents search engines from ranking this URL in search index.',
      });
    }

    if (page.xRobotsTag && page.xRobotsTag.toLowerCase().includes('noindex')) {
      issues.push({
        ruleKey: 'RULE_X_ROBOTS_NOINDEX',
        ruleVersion: this.VERSION,
        type: 'X_ROBOTS_NOINDEX',
        severity: 'HIGH',
        message: 'HTTP response header X-Robots-Tag specifies "noindex".',
        evidence: { xRobotsTag: page.xRobotsTag },
        impact: 'Blocks search engine indexing at the HTTP header layer.',
      });
    }

    // 4. On-Page Headings & Metadata (200 OK pages)
    if (page.statusCode === 200) {
      // Titles
      if (!page.title || page.title.trim().length === 0) {
        issues.push({
          ruleKey: 'RULE_MISSING_TITLE_TAG',
          ruleVersion: this.VERSION,
          type: 'MISSING_TITLE',
          severity: 'CRITICAL',
          message: 'Page is missing a `<title>` tag in HTML head.',
          evidence: { title: null },
          impact: 'Critical ranking factor missing; severely damages CTR.',
        });
      } else if (page.title.length < 10) {
        issues.push({
          ruleKey: 'RULE_SHORT_TITLE_TAG',
          ruleVersion: this.VERSION,
          type: 'SHORT_TITLE',
          severity: 'MEDIUM',
          message: `Title length (${page.title.length} chars) is sub-optimally short. Target: 40-60 chars.`,
          evidence: { title: page.title, length: page.title.length },
          impact: 'Sub-optimal keyword density and lower SERP prominence.',
        });
      } else if (page.title.length > 65) {
        issues.push({
          ruleKey: 'RULE_LONG_TITLE_TAG',
          ruleVersion: this.VERSION,
          type: 'LONG_TITLE',
          severity: 'LOW',
          message: `Title length (${page.title.length} chars) will truncate in Google search results.`,
          evidence: { title: page.title, length: page.title.length },
          impact: 'Truncated SERP snippet with trailing ellipsis.',
        });
      }

      // Meta Description
      if (!page.metaDescription || page.metaDescription.trim().length === 0) {
        issues.push({
          ruleKey: 'RULE_MISSING_META_DESCRIPTION',
          ruleVersion: this.VERSION,
          type: 'MISSING_META_DESCRIPTION',
          severity: 'HIGH',
          message: 'Page is missing a meta description.',
          evidence: { metaDescription: null },
          impact: 'Search engines display auto-generated text snippets; lowers CTR.',
        });
      }

      // Headings
      if (page.h1Tags.length === 0) {
        issues.push({
          ruleKey: 'RULE_MISSING_H1_HEADING',
          ruleVersion: this.VERSION,
          type: 'MISSING_H1',
          severity: 'HIGH',
          message: 'Page does not contain an `<h1>` heading tag.',
          evidence: { h1Count: 0 },
          impact: 'Hurts on-page semantic structure and core keyword signaling.',
        });
      } else if (page.h1Tags.length > 1) {
        issues.push({
          ruleKey: 'RULE_MULTIPLE_H1_HEADINGS',
          ruleVersion: this.VERSION,
          type: 'MULTIPLE_H1',
          severity: 'MEDIUM',
          message: `Page defines ${page.h1Tags.length} distinct \`<h1>\` tags.`,
          evidence: { h1Tags: page.h1Tags },
          impact: 'Dilutes topical focus across competing top-level headings.',
        });
      }

      // Canonicalization
      if (page.hasMultipleCanonicals) {
        issues.push({
          ruleKey: 'RULE_MULTIPLE_CANONICALS',
          ruleVersion: this.VERSION,
          type: 'MULTIPLE_CANONICALS',
          severity: 'CRITICAL',
          message: 'Page declares multiple conflicting `<link rel="canonical">` tags.',
          evidence: { multipleCanonicals: true },
          impact: 'Search engines ignore ambiguous canonicals, causing duplicate indexing.',
        });
      } else if (page.isMalformedCanonical) {
        issues.push({
          ruleKey: 'RULE_MALFORMED_CANONICAL',
          ruleVersion: this.VERSION,
          type: 'MALFORMED_CANONICAL',
          severity: 'HIGH',
          message: `Canonical tag contains an unparseable or invalid URL: ${page.canonicalUrl}`,
          evidence: { canonicalUrl: page.canonicalUrl },
          impact: 'Search engines cannot parse canonical target.',
        });
      } else if (!page.canonicalMatch && page.canonicalUrl) {
        issues.push({
          ruleKey: 'RULE_CANONICAL_CONFLICT',
          ruleVersion: this.VERSION,
          type: 'CANONICAL_CONFLICT',
          severity: 'HIGH',
          message: `Canonical points to distinct URL target: ${page.canonicalUrl}`,
          evidence: { pageUrl: page.url, canonicalUrl: page.canonicalUrl },
          impact: 'Search ranking signals will be consolidated onto canonical target.',
        });
      }

      // Image Alt Text
      if (page.missingAltCount > 0) {
        issues.push({
          ruleKey: 'RULE_MISSING_IMAGE_ALT',
          ruleVersion: this.VERSION,
          type: 'MISSING_IMAGE_ALT',
          severity: 'LOW',
          message: `${page.missingAltCount} of ${page.imagesCount} images lack \`alt\` attributes entirely.`,
          evidence: { missingAltCount: page.missingAltCount, imagesCount: page.imagesCount },
          impact: 'Degrades image search visibility and WCAG accessibility standards.',
        });
      }

      // Low Content Signal
      if (page.wordCount < 120) {
        issues.push({
          ruleKey: 'RULE_LOW_CONTENT_SIGNAL',
          ruleVersion: this.VERSION,
          type: 'LOW_CONTENT_SIGNAL',
          severity: 'MEDIUM',
          message: `Page body text volume (${page.wordCount} words) is thin.`,
          evidence: { wordCount: page.wordCount },
          impact: 'Risk of algorithmic low-quality filtering on thin landing pages.',
        });
      }

      // Possible Soft 404
      if (page.isPossibleSoft404) {
        issues.push({
          ruleKey: 'RULE_POSSIBLE_SOFT_404',
          ruleVersion: this.VERSION,
          type: 'POSSIBLE_SOFT_404',
          severity: 'HIGH',
          message: `Page returns HTTP 200 but exhibits not-found text signals (Confidence: ${(page.soft404Confidence || 0) * 100}%).`,
          evidence: { soft404Confidence: page.soft404Confidence },
          impact: 'Google flags Soft 404s and deindexes them from organic search results.',
        });
      }

      // Exact Duplicate Content
      if (page.isExactDuplicate) {
        issues.push({
          ruleKey: 'RULE_EXACT_DUPLICATE_CONTENT',
          ruleVersion: this.VERSION,
          type: 'EXACT_DUPLICATE_CONTENT',
          severity: 'HIGH',
          message: 'Page body copy is an exact 100% duplicate of another indexed page.',
          evidence: { isExactDuplicate: true },
          impact: 'Search engines filter duplicate URLs from primary search results.',
        });
      }

      // Schema Issues
      if (page.schemaStatus === 'JSON_INVALID') {
        issues.push({
          ruleKey: 'RULE_MALFORMED_JSON_LD',
          ruleVersion: this.VERSION,
          type: 'MALFORMED_JSON_LD',
          severity: 'MEDIUM',
          message: 'Encountered malformed JSON syntax in structured data block.',
          evidence: { schemaStatus: page.schemaStatus },
          impact: 'Search engines will ignore invalid structured data, losing rich results.',
        });
      }

      // Hreflang Issues
      if (page.hreflangIssues && page.hreflangIssues.length > 0) {
        for (const hRefIssue of page.hreflangIssues) {
          issues.push({
            ruleKey: 'RULE_INVALID_HREFLANG',
            ruleVersion: this.VERSION,
            type: 'INVALID_HREFLANG',
            severity: hRefIssue.type === 'INVALID_LANGUAGE_CODE' ? 'HIGH' : 'MEDIUM',
            message: hRefIssue.message,
            evidence: { lang: hRefIssue.lang },
            impact: 'International search engines cannot localize page targeting.',
          });
        }
      }

      // Site Graph: Orphan Candidate
      if (page.isOrphanCandidate) {
        issues.push({
          ruleKey: 'RULE_ORPHAN_CANDIDATE',
          ruleVersion: this.VERSION,
          type: 'CRAWL_GRAPH_ORPHAN_CANDIDATE',
          severity: 'HIGH',
          message: 'Discovered via sitemap/seed but receives 0 internal inlinks from the crawl graph.',
          evidence: { internalInlinks: 0 },
          impact: 'Receives zero PageRank equity and is isolated from crawler navigation.',
        });
      }

      // Site Graph: Deep Click Depth
      if (page.crawlDepth !== undefined && page.crawlDepth > 4) {
        issues.push({
          ruleKey: 'RULE_EXCESSIVE_CLICK_DEPTH',
          ruleVersion: this.VERSION,
          type: 'EXCESSIVE_CLICK_DEPTH',
          severity: 'LOW',
          message: `Page requires ${page.crawlDepth} clicks from seed to reach. Recommended <= 3 clicks.`,
          evidence: { crawlDepth: page.crawlDepth },
          impact: 'Deep pages receive less crawler budget and lower internal PageRank.',
        });
      }
    }

    return issues;
  }
}
