import * as cheerio from 'cheerio';
import { CmsProviderRegistry } from './cms/cmsProviderRegistry';

export interface ParsedDomResult {
  httpStatus: number;
  headers: Record<string, string>;
  rawHtml?: string;
  canonicalUrl: string | null;
  title: string | null;
  description: string | null;
  robotsMeta: string | null;
  schemas: Record<string, any>[];
  links: Array<{ targetUrl: string; anchorText: string }>;
  locationHeader?: string | null;
}

export class SyntheticHttpFetcher {
  /**
   * Performs a synthetic or live HTTP fetch and parses the returned HTML document DOM using Cheerio.
   */
  public static async fetchAndParse(targetUrl: string, platform?: string): Promise<ParsedDomResult> {
    let rawHtml: string = '';
    let httpStatus = 200;
    const headers: Record<string, string> = {
      'content-type': 'text/html; charset=utf-8',
      'user-agent': 'TechScale-Synthetic-Verification-Bot/1.0',
    };
    let locationHeader: string | null = null;

    // 1. Attempt live HTTP request if target URL is a live or localhost endpoint
    let liveFetched = false;
    if (targetUrl.startsWith('http://localhost') || targetUrl.startsWith('http://127.0.0.1')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(targetUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'TechScale-Synthetic-Verification-Bot/1.0',
          },
        });
        clearTimeout(timeoutId);

        httpStatus = response.status;
        locationHeader = response.headers.get('location');
        response.headers.forEach((val, key) => {
          headers[key.toLowerCase()] = val;
        });

        if (response.status >= 300 && response.status < 400 && locationHeader) {
          rawHtml = `<html><head><meta http-equiv="refresh" content="0;url=${locationHeader}"></head><body>Redirecting to ${locationHeader}</body></html>`;
        } else {
          rawHtml = await response.text();
        }
        liveFetched = true;
      } catch (err) {
        liveFetched = false;
      }
    }

    // 2. If not live-fetched (e.g. synthetic test URL / mock provider deployment), synthesize the wire response from CMS provider state
    if (!liveFetched) {
      const provider = CmsProviderRegistry.getProvider(platform);
      const redirect = await provider.getRedirectRule(targetUrl);

      if (redirect) {
        httpStatus = redirect.statusCode || 301;
        locationHeader = redirect.destinationUrl;
        headers['location'] = redirect.destinationUrl;
        rawHtml = `<!DOCTYPE html><html><head><title>301 Moved Permanently</title></head><body>Redirecting to <a href="${redirect.destinationUrl}">${redirect.destinationUrl}</a></body></html>`;
      } else {
        const canonical = await provider.getCanonicalUrl(targetUrl);
        const meta = await provider.getMetaTags(targetUrl);
        const schemas = await provider.getStructuredData(targetUrl);
        const links = await provider.getInternalLinks(targetUrl);

        httpStatus = 200;
        rawHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  ${meta?.title ? `<title>${meta.title}</title>` : '<title>Default Title</title>'}
  ${meta?.description ? `<meta name="description" content="${meta.description}" />` : ''}
  ${meta?.robotsMeta ? `<meta name="robots" content="${meta.robotsMeta}" />` : ''}
  ${canonical ? `<link rel="canonical" href="${canonical}" />` : ''}
  ${schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n  ')}
</head>
<body>
  <header><h1>TechScale Live DOM</h1></header>
  <main>
    ${links.map((l) => `<a href="${l.targetUrl}">${l.anchorText}</a>`).join('\n    ')}
  </main>
</body>
</html>`;
      }
    }

    // 3. Real Cheerio DOM Parsing & Metadata Extraction
    const $ = cheerio.load(rawHtml);
    const canonicalUrl = $('link[rel="canonical"]').attr('href') || null;
    const title = $('title').text().trim() || null;
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || null;
    const robotsMeta = $('meta[name="robots"]').attr('content') || null;

    const extractedSchemas: Record<string, any>[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const content = $(el).text().trim();
        if (content) {
          extractedSchemas.push(JSON.parse(content));
        }
      } catch (err) {
        // malformed json-ld
      }
    });

    const extractedLinks: Array<{ targetUrl: string; anchorText: string }> = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        extractedLinks.push({
          targetUrl: href,
          anchorText: $(el).text().trim(),
        });
      }
    });

    return {
      httpStatus,
      headers,
      rawHtml,
      canonicalUrl,
      title,
      description,
      robotsMeta,
      schemas: extractedSchemas,
      links: extractedLinks,
      locationHeader,
    };
  }
}
