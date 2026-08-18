import * as cheerio from 'cheerio';
import { CrawlIssue, CrawlUrlResponse } from '../../../src/shared/contracts';

export interface ParsedHtmlResult {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescLength: number;
  canonicalUrl: string | null;
  canonicalMatch: boolean;
  metaRobots: string | null;
  xRobotsTag: string | null;
  h1Tags: string[];
  h2Count: number;
  wordCount: number;
  internalOutlinksCount: number;
  externalOutlinksCount: number;
  internalOutlinksSample: string[];
  externalOutlinksSample: string[];
  imagesCount: number;
  missingAltCount: number;
  schemaTypes: string[];
  isIndexable: boolean;
  issues: CrawlIssue[];
}

export class HtmlParser {
  /**
   * Normalizes a URL for comparison (removing trailing slashes, default ports, fragments).
   */
  public static normalizeUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl);
      let pathname = parsed.pathname;
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname}${parsed.search}`;
    } catch {
      return rawUrl.trim().toLowerCase();
    }
  }

  public static parse(html: string, finalUrl: string, statusCode: number, headers: Record<string, string>): ParsedHtmlResult {
    const $ = cheerio.load(html);
    const issues: CrawlIssue[] = [];

    // Title
    const titleText = $('title').first().text().trim();
    const title = titleText.length > 0 ? titleText : null;
    const titleLength = title ? title.length : 0;

    if (!title && statusCode === 200) {
      issues.push({
        id: `issue-missing-title-${Date.now()}`,
        type: 'MISSING_TITLE',
        severity: 'CRITICAL',
        message: 'Page is missing a `<title>` tag in HTML head.',
        evidence: '<title> tag not found',
        impact: 'Search engines cannot determine page subject; poor SERP click-through rate.',
      });
    } else if (title && titleLength < 10 && statusCode === 200) {
      issues.push({
        id: `issue-short-title-${Date.now()}`,
        type: 'SHORT_TITLE',
        severity: 'MEDIUM',
        message: `Title is critically short (${titleLength} chars). Recommended: 40-60 chars.`,
        evidence: `Title: "${title}"`,
        impact: 'Wasted SERP real estate and sub-optimal search ranking relevancy.',
      });
    } else if (title && titleLength > 65) {
      issues.push({
        id: `issue-long-title-${Date.now()}`,
        type: 'LONG_TITLE',
        severity: 'LOW',
        message: `Title length (${titleLength} chars) exceeds standard Google desktop display pixel width.`,
        evidence: `Title: "${title}"`,
        impact: 'Title will be truncated with ellipsis in SERP results.',
      });
    }

    // Meta Description
    const metaDescTag = $('meta[name="description" i]').attr('content') || $('meta[property="og:description" i]').attr('content');
    const metaDescription = metaDescTag ? metaDescTag.trim() : null;
    const metaDescLength = metaDescription ? metaDescription.length : 0;

    if (!metaDescription && statusCode === 200) {
      issues.push({
        id: `issue-missing-meta-${Date.now()}`,
        type: 'MISSING_META_DESCRIPTION',
        severity: 'HIGH',
        message: 'Page is missing a meta description.',
        evidence: '<meta name="description"> tag missing',
        impact: 'Google will auto-extract random snippets; lower SERP CTR.',
      });
    }

    // Canonical
    const canonicalHref = $('link[rel="canonical" i]').attr('href');
    const canonicalUrl = canonicalHref ? canonicalHref.trim() : null;
    let canonicalMatch = true;

    if (canonicalUrl) {
      const normalizedCanonical = this.normalizeUrl(new URL(canonicalUrl, finalUrl).toString());
      const normalizedFinal = this.normalizeUrl(finalUrl);
      canonicalMatch = normalizedCanonical === normalizedFinal;

      if (!canonicalMatch && statusCode === 200) {
        issues.push({
          id: `issue-canonical-mismatch-${Date.now()}`,
          type: 'CANONICAL_MISMATCH',
          severity: 'HIGH',
          message: `Page declares a non-self-referential canonical URL. Target: ${canonicalUrl}`,
          evidence: `Current URL: ${finalUrl} vs Canonical: ${canonicalUrl}`,
          impact: 'Signals to search engines that this page is a duplicate and should not be indexed directly.',
        });
      }
    } else if (statusCode === 200) {
      issues.push({
        id: `issue-missing-canonical-${Date.now()}`,
        type: 'MISSING_CANONICAL',
        severity: 'LOW',
        message: 'No canonical URL declared.',
        evidence: '<link rel="canonical"> tag missing',
        impact: 'Vulnerable to duplicate content attribution from query parameters or trailing slash variations.',
      });
    }

    // Meta Robots & X-Robots-Tag
    const metaRobotsTag = $('meta[name="robots" i]').attr('content');
    const metaRobots = metaRobotsTag ? metaRobotsTag.trim() : null;
    const xRobotsTag = headers['x-robots-tag'] || null;

    const isNoIndex =
      (metaRobots && metaRobots.toLowerCase().includes('noindex')) ||
      (xRobotsTag && xRobotsTag.toLowerCase().includes('noindex'));

    const isIndexable = statusCode === 200 && !isNoIndex && canonicalMatch;

    if (isNoIndex) {
      issues.push({
        id: `issue-noindex-${Date.now()}`,
        type: 'NOINDEX_DIRECTIVE',
        severity: 'CRITICAL',
        message: 'Page contains a `noindex` directive blocking search engine indexing.',
        evidence: `Robots directive: ${metaRobots || xRobotsTag}`,
        impact: 'Page will not appear in organic Google search results.',
      });
    }

    if (statusCode >= 400) {
      issues.push({
        id: `issue-http-status-${Date.now()}`,
        type: statusCode === 404 ? '404_NOT_FOUND' : 'SERVER_ERROR',
        severity: 'CRITICAL',
        message: `HTTP server response returned error status code ${statusCode}.`,
        evidence: `Status Code: ${statusCode}`,
        impact: 'Search engines will drop page from index and users see broken error.',
      });
    }

    // Headings (H1 & H2)
    const h1Tags: string[] = [];
    $('h1').each((_, el) => {
      const text = $(el).text().trim();
      if (text) h1Tags.push(text);
    });

    if (h1Tags.length === 0 && statusCode === 200) {
      issues.push({
        id: `issue-missing-h1-${Date.now()}`,
        type: 'MISSING_H1',
        severity: 'HIGH',
        message: 'Page has no `<h1>` heading tag.',
        evidence: '0 <h1> elements found',
        impact: 'Hurts on-page content hierarchy and keyword relevance scoring.',
      });
    } else if (h1Tags.length > 1) {
      issues.push({
        id: `issue-multiple-h1-${Date.now()}`,
        type: 'MULTIPLE_H1',
        severity: 'MEDIUM',
        message: `Page contains ${h1Tags.length} distinct <h1> tags.`,
        evidence: h1Tags.map((h, i) => `H1 #${i + 1}: "${h}"`).join(' | '),
        impact: 'Dilutes topical focus across multiple competing top-level headings.',
      });
    }

    const h2Count = $('h2').length;

    // Word Count (Clean text without scripts/styles)
    $('script, style, noscript, svg, nav, footer, header').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const words = bodyText ? bodyText.split(' ').filter(Boolean) : [];
    const wordCount = words.length;

    if (wordCount < 200 && statusCode === 200) {
      issues.push({
        id: `issue-thin-content-${Date.now()}`,
        type: 'THIN_CONTENT',
        severity: 'MEDIUM',
        message: `Page contains very low body copy (${wordCount} words).`,
        evidence: `Word count: ${wordCount}`,
        impact: 'May trigger "Thin Content" algorithmic quality penalties on Google.',
      });
    }

    // Links (Internal vs External Outlinks)
    const finalOrigin = new URL(finalUrl).origin;
    const internalOutlinks: string[] = [];
    const externalOutlinks: string[] = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      try {
        const resolved = new URL(href, finalUrl);
        if (resolved.origin === finalOrigin) {
          internalOutlinks.push(resolved.pathname);
        } else {
          externalOutlinks.push(resolved.href);
        }
      } catch {
        // invalid URL ignore
      }
    });

    // Images & Missing Alt
    let imagesCount = 0;
    let missingAltCount = 0;

    $('img').each((_, el) => {
      imagesCount++;
      const alt = $(el).attr('alt');
      if (!alt || alt.trim().length === 0) {
        missingAltCount++;
      }
    });

    if (missingAltCount > 0) {
      issues.push({
        id: `issue-missing-alt-${Date.now()}`,
        type: 'MISSING_IMAGE_ALT',
        severity: 'LOW',
        message: `${missingAltCount} of ${imagesCount} images are missing descriptive \`alt\` text.`,
        evidence: `${missingAltCount} images without alt tags`,
        impact: 'Hurts image search SEO and accessibility compliance.',
      });
    }

    // Schema JSON-LD detection
    const schemaTypes: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const rawJson = $(el).html();
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          if (parsed['@type']) {
            if (Array.isArray(parsed['@type'])) {
              schemaTypes.push(...parsed['@type']);
            } else {
              schemaTypes.push(parsed['@type']);
            }
          } else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
            parsed['@graph'].forEach((item: any) => {
              if (item['@type']) schemaTypes.push(item['@type']);
            });
          }
        }
      } catch {
        issues.push({
          id: `issue-invalid-jsonld-${Date.now()}`,
          type: 'INVALID_JSON_LD',
          severity: 'MEDIUM',
          message: 'Found malformed JSON-LD structured data block in HTML.',
          evidence: 'JSON parse error in <script type="application/ld+json">',
          impact: 'Search engines will ignore invalid structured data; rich snippet loss.',
        });
      }
    });

    return {
      title,
      titleLength,
      metaDescription,
      metaDescLength,
      canonicalUrl,
      canonicalMatch,
      metaRobots,
      xRobotsTag,
      h1Tags,
      h2Count,
      wordCount,
      internalOutlinksCount: internalOutlinks.length,
      externalOutlinksCount: externalOutlinks.length,
      internalOutlinksSample: Array.from(new Set(internalOutlinks)).slice(0, 10),
      externalOutlinksSample: Array.from(new Set(externalOutlinks)).slice(0, 10),
      imagesCount,
      missingAltCount,
      schemaTypes: Array.from(new Set(schemaTypes)),
      isIndexable,
      issues,
    };
  }
}
