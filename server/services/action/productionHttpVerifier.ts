import * as cheerio from 'cheerio';
import { SafeUrlPolicy, SafeFetchResult } from '../../security/safeUrlPolicy';
import { ParsedDomResult } from './syntheticHttpFetcher';

export interface VerificationObservation {
  url: string;
  httpStatus: number;
  headers: Record<string, string>;
  canonicalUrl: string | null;
  title: string | null;
  description: string | null;
  robotsMeta: string | null;
  schemas: Record<string, any>[];
  links: Array<{ targetUrl: string; anchorText: string }>;
  locationHeader: string | null;
  loadTimeMs: number;
}

/**
 * ProductionHttpVerifier
 * Performs live, SSRF-safe HTTP probes to verify deployed changes against real web servers.
 */
export class ProductionHttpVerifier {
  public static async verifyLiveUrl(targetUrl: string, options?: { timeoutMs?: number }): Promise<VerificationObservation> {
    const fetchResult: SafeFetchResult = await SafeUrlPolicy.safeFetch(targetUrl, {
      timeoutMs: options?.timeoutMs || 8000,
      maxRedirects: 3,
      userAgent: 'TechScale-Live-Verification-Bot/1.0 (SEO-Audit; +https://techscale.local/bot)',
    });

    const rawHtml = fetchResult.body || '';
    const $ = cheerio.load(rawHtml);

    const canonicalUrl = $('link[rel="canonical"]').attr('href') || null;
    const title = $('title').text().trim() || null;
    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      null;
    const robotsMeta = $('meta[name="robots"]').attr('content') || null;

    const schemas: Record<string, any>[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const text = $(el).text().trim();
        if (text) {
          schemas.push(JSON.parse(text));
        }
      } catch (_) {
        // malformed json-ld skipped
      }
    });

    const links: Array<{ targetUrl: string; anchorText: string }> = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        links.push({
          targetUrl: href,
          anchorText: $(el).text().trim(),
        });
      }
    });

    const locationHeader =
      fetchResult.headers['location'] ||
      (fetchResult.redirectChain.length > 0
        ? fetchResult.redirectChain[fetchResult.redirectChain.length - 1].targetUrl
        : null);

    return {
      url: fetchResult.finalUrl,
      httpStatus: fetchResult.statusCode,
      headers: fetchResult.headers,
      canonicalUrl,
      title,
      description,
      robotsMeta,
      schemas,
      links,
      locationHeader,
      loadTimeMs: fetchResult.loadTimeMs,
    };
  }
}
