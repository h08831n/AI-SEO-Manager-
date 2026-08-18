import * as cheerio from 'cheerio';
import zlib from 'zlib';
import { promisify } from 'util';
import { SafeUrlPolicy } from '../../security/safeUrlPolicy';
import { UrlNormalizer } from './urlNormalizer';

const gunzipAsync = promisify(zlib.gunzip);

export interface DiscoveredSitemapUrl {
  loc: string;
  normalizedUrl: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export interface SitemapDiscoveryResult {
  discoveredUrls: DiscoveredSitemapUrl[];
  sitemapIndexUrls: string[];
  totalUrls: number;
  errors: string[];
}

export class SitemapService {
  private static MAX_SITEMAP_BYTES = 10 * 1024 * 1024; // 10MB max raw bytes
  private static MAX_DECOMPRESSED_BYTES = 50 * 1024 * 1024; // 50MB decompressed max (decompression bomb protection)
  private static MAX_TOTAL_URLS = 50000;
  private static MAX_SITEMAP_INDEX_DEPTH = 3;

  /**
   * Fetches and parses a sitemap XML or sitemap index with full SSRF and safety protection
   */
  public static async discoverUrlsFromSitemap(
    sitemapUrl: string,
    currentDepth = 0,
    visitedSitemaps: Set<string> = new Set()
  ): Promise<SitemapDiscoveryResult> {
    const result: SitemapDiscoveryResult = {
      discoveredUrls: [],
      sitemapIndexUrls: [],
      totalUrls: 0,
      errors: [],
    };

    if (currentDepth > this.MAX_SITEMAP_INDEX_DEPTH) {
      result.errors.push(`Maximum sitemap index nesting depth of ${this.MAX_SITEMAP_INDEX_DEPTH} exceeded`);
      return result;
    }

    if (visitedSitemaps.has(sitemapUrl)) {
      return result;
    }
    visitedSitemaps.add(sitemapUrl);

    try {
      const fetchResult = await SafeUrlPolicy.safeFetch(sitemapUrl, {
        timeoutMs: 10000,
        maxRedirects: 3,
        maxResponseBytes: this.MAX_SITEMAP_BYTES,
        allowedContentTypes: ['application/xml', 'text/xml', 'application/gzip', 'application/x-gzip', 'text/plain', '*/*'],
      });

      let xmlContent = fetchResult.body;

      // Handle gzip compressed sitemaps (.xml.gz)
      if (
        sitemapUrl.endsWith('.gz') ||
        fetchResult.contentType.includes('gzip') ||
        fetchResult.contentType.includes('octet-stream')
      ) {
        try {
          const rawBuffer = Buffer.from(fetchResult.body, 'binary');
          const decompressed = await gunzipAsync(rawBuffer);
          if (decompressed.length > this.MAX_DECOMPRESSED_BYTES) {
            throw new Error(`Decompressed sitemap size exceeded safety limit of ${this.MAX_DECOMPRESSED_BYTES} bytes`);
          }
          xmlContent = decompressed.toString('utf-8');
        } catch (decompErr: any) {
          // If already plain text, proceed, else record error
          if (!xmlContent.includes('<?xml') && !xmlContent.includes('<urlset') && !xmlContent.includes('<sitemapindex')) {
            result.errors.push(`Failed to decompress gzipped sitemap: ${decompErr.message}`);
            return result;
          }
        }
      }

      const $ = cheerio.load(xmlContent, { xmlMode: true });

      // 1. Check if it is a Sitemap Index (<sitemapindex>)
      const sitemapTags = $('sitemapindex > sitemap');
      if (sitemapTags.length > 0) {
        const nestedSitemaps: string[] = [];
        sitemapTags.each((_, el) => {
          const loc = $(el).find('loc').text().trim();
          if (loc) nestedSitemaps.push(loc);
        });

        result.sitemapIndexUrls.push(...nestedSitemaps);

        // Recursively fetch nested sitemaps
        for (const nestedUrl of nestedSitemaps) {
          if (result.discoveredUrls.length >= this.MAX_TOTAL_URLS) break;
          const subResult = await this.discoverUrlsFromSitemap(nestedUrl, currentDepth + 1, visitedSitemaps);
          result.discoveredUrls.push(...subResult.discoveredUrls);
          result.sitemapIndexUrls.push(...subResult.sitemapIndexUrls);
          result.errors.push(...subResult.errors);
        }
      } else {
        // 2. Standard URL set (<urlset > url>)
        $('urlset > url').each((_, el) => {
          if (result.discoveredUrls.length >= this.MAX_TOTAL_URLS) return;

          const loc = $(el).find('loc').text().trim();
          if (!loc) return;

          try {
            const normalized = UrlNormalizer.normalize(loc);
            const lastmod = $(el).find('lastmod').text().trim() || undefined;
            const changefreq = $(el).find('changefreq').text().trim() || undefined;
            const priorityText = $(el).find('priority').text().trim();
            const priority = priorityText ? parseFloat(priorityText) : undefined;

            result.discoveredUrls.push({
              loc,
              normalizedUrl: normalized,
              lastmod,
              changefreq,
              priority: isNaN(priority || 0) ? undefined : priority,
            });
          } catch {
            // Malformed URL in sitemap ignored
          }
        });
      }

      result.totalUrls = result.discoveredUrls.length;
      return result;
    } catch (err: any) {
      result.errors.push(`Error fetching sitemap ${sitemapUrl}: ${err.message}`);
      return result;
    }
  }
}
