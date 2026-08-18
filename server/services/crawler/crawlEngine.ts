import { SafeUrlPolicy } from '../../security/safeUrlPolicy';
import { HtmlParser } from './htmlParser';
import { CrawlUrlResponse } from '../../../src/shared/contracts';

export class CrawlEngine {
  public static async crawlSingleUrl(targetUrl: string): Promise<CrawlUrlResponse> {
    const fetchResult = await SafeUrlPolicy.safeFetch(targetUrl, {
      timeoutMs: 8000,
      maxRedirects: 5,
      maxResponseBytes: 4 * 1024 * 1024,
    });

    const parsed = HtmlParser.parse(
      fetchResult.body,
      fetchResult.finalUrl,
      fetchResult.statusCode,
      fetchResult.headers
    );

    return {
      status: 'SUCCESS',
      requestedUrl: fetchResult.requestedUrl,
      finalUrl: fetchResult.finalUrl,
      redirectCount: fetchResult.redirectCount,
      statusCode: fetchResult.statusCode,
      loadTimeMs: fetchResult.loadTimeMs,
      isIndexable: parsed.isIndexable,
      canonicalUrl: parsed.canonicalUrl,
      canonicalMatch: parsed.canonicalMatch,
      title: parsed.title,
      titleLength: parsed.titleLength,
      metaDescription: parsed.metaDescription,
      metaDescLength: parsed.metaDescLength,
      metaRobots: parsed.metaRobots,
      xRobotsTag: parsed.xRobotsTag,
      h1Tags: parsed.h1Tags,
      h2Count: parsed.h2Count,
      wordCount: parsed.wordCount,
      internalInlinks: 'DATA_UNAVAILABLE', // Inlinks strictly require full sitewide crawl graph
      internalOutlinksCount: parsed.internalOutlinksCount,
      externalOutlinksCount: parsed.externalOutlinksCount,
      imagesCount: parsed.imagesCount,
      missingAltCount: parsed.missingAltCount,
      schemaTypes: parsed.schemaTypes,
      issues: parsed.issues,
      crawledAt: new Date().toISOString(),
      provenance: 'MEASURED_REAL',
    };
  }
}
