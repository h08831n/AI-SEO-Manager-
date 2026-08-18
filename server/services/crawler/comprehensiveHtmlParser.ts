import * as cheerio from 'cheerio';
import { UrlNormalizer } from './urlNormalizer';

export interface ExtractedImage {
  src: string;
  normalizedSrc: string;
  alt: string | null;
  hasEmptyAlt: boolean;
  isMissingAlt: boolean;
  width?: number;
  height?: number;
  loading?: string;
}

export interface ExtractedLink {
  href: string;
  normalizedTarget: string;
  anchorText: string;
  rel?: string;
  isNofollow: boolean;
  isUgc: boolean;
  isSponsored: boolean;
  isInternal: boolean;
}

export interface ExtractedHreflang {
  lang: string;
  href: string;
  normalizedHref: string;
  isValidSyntax: boolean;
}

export interface ComprehensiveParsedHtml {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescLength: number;
  htmlLang: string | null;
  metaRobots: string | null;
  canonicalUrl: string | null;
  normalizedCanonicalUrl: string | null;
  canonicalMatch: boolean;
  hasMultipleCanonicals: boolean;
  canonicalTagsCount: number;

  h1Tags: string[];
  h2Tags: string[];
  h3Count: number;
  h4to6Count: number;

  viewport: string | null;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: string;

  visibleText: string;
  wordCount: number;

  links: ExtractedLink[];
  internalLinks: ExtractedLink[];
  externalLinks: ExtractedLink[];

  images: ExtractedImage[];
  missingAltCount: number;
  emptyAltCount: number;

  hreflangs: ExtractedHreflang[];
  relNext?: string;
  relPrev?: string;

  schemaStatus: 'PARSED' | 'JSON_INVALID' | 'NO_SCHEMA';
  schemaTypes: string[];
  rawJsonLdBlocks: any[];
}

export class ComprehensiveHtmlParser {
  private static readonly BANNED_PROTOCOLS = new Set(['javascript:', 'mailto:', 'tel:', 'data:', 'sms:']);

  public static parse(
    html: string,
    currentUrl: string,
    originUrl: string
  ): ComprehensiveParsedHtml {
    const $ = cheerio.load(html);

    // 1. Language & Viewport
    const htmlLang = $('html').attr('lang') || null;
    const viewport = $('meta[name="viewport" i]').attr('content') || null;

    // 2. Title
    const titleRaw = $('title').first().text().trim();
    const title = titleRaw.length > 0 ? titleRaw : null;
    const titleLength = title ? title.length : 0;

    // 3. Meta Description
    const metaDescTag = $('meta[name="description" i]').attr('content');
    const metaDescription = metaDescTag ? metaDescTag.trim() : null;
    const metaDescLength = metaDescription ? metaDescription.length : 0;

    // 4. Meta Robots
    const metaRobotsTag = $('meta[name="robots" i]').attr('content');
    const metaRobots = metaRobotsTag ? metaRobotsTag.trim() : null;

    // 5. Canonicals (Detect multiple canonicals)
    const canonicalElements = $('link[rel="canonical" i]');
    const canonicalTagsCount = canonicalElements.length;
    const hasMultipleCanonicals = canonicalTagsCount > 1;
    const rawCanonicalHref = canonicalElements.first().attr('href') || null;

    let canonicalUrl: string | null = null;
    let normalizedCanonicalUrl: string | null = null;
    let canonicalMatch = true;

    if (rawCanonicalHref) {
      try {
        const resolved = new URL(rawCanonicalHref, currentUrl).toString();
        canonicalUrl = rawCanonicalHref;
        normalizedCanonicalUrl = UrlNormalizer.normalize(resolved);
        canonicalMatch = normalizedCanonicalUrl === UrlNormalizer.normalize(currentUrl);
      } catch {
        canonicalUrl = rawCanonicalHref;
        canonicalMatch = false;
      }
    }

    // 6. Open Graph & Twitter Cards
    const ogTitle = $('meta[property="og:title" i]').attr('content') || undefined;
    const ogDescription = $('meta[property="og:description" i]').attr('content') || undefined;
    const ogImage = $('meta[property="og:image" i]').attr('content') || undefined;
    const twitterCard = $('meta[name="twitter:card" i]').attr('content') || undefined;

    // 7. Headings
    const h1Tags: string[] = [];
    $('h1').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text) h1Tags.push(text);
    });

    const h2Tags: string[] = [];
    $('h2').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text) h2Tags.push(text);
    });

    const h3Count = $('h3').length;
    const h4to6Count = $('h4, h5, h6').length;

    // 8. Hreflang
    const hreflangs: ExtractedHreflang[] = [];
    $('link[rel="alternate"][hreflang]').each((_, el) => {
      const lang = $(el).attr('hreflang')?.trim();
      const href = $(el).attr('href')?.trim();
      if (lang && href) {
        let normalizedHref = href;
        try {
          normalizedHref = UrlNormalizer.resolveAndNormalize(href, currentUrl);
        } catch {}
        // Basic ISO-639-1 / BCP 47 syntax validation
        const isValidSyntax = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/i.test(lang) || lang.toLowerCase() === 'x-default';
        hreflangs.push({
          lang,
          href,
          normalizedHref,
          isValidSyntax,
        });
      }
    });

    const relNext = $('link[rel="next" i]').attr('href') || undefined;
    const relPrev = $('link[rel="prev" i]').attr('href') || undefined;

    // 9. Links (internal vs external, anchor, rel annotations)
    const links: ExtractedLink[] = [];
    const internalLinks: ExtractedLink[] = [];
    const externalLinks: ExtractedLink[] = [];

    const originHostname = new URL(originUrl).hostname.toLowerCase();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href) return;

      const lowerHref = href.toLowerCase();
      for (const banned of ComprehensiveHtmlParser.BANNED_PROTOCOLS) {
        if (lowerHref.startsWith(banned)) return;
      }

      const rel = $(el).attr('rel')?.toLowerCase();
      const isNofollow = Boolean(rel && rel.includes('nofollow'));
      const isUgc = Boolean(rel && rel.includes('ugc'));
      const isSponsored = Boolean(rel && rel.includes('sponsored'));
      const anchorText = $(el).text().replace(/\s+/g, ' ').trim();

      try {
        const resolved = new URL(href, currentUrl);
        const isInternal = resolved.hostname.toLowerCase() === originHostname;
        const normalizedTarget = UrlNormalizer.normalize(resolved.toString());

        const linkRecord: ExtractedLink = {
          href,
          normalizedTarget,
          anchorText,
          rel,
          isNofollow,
          isUgc,
          isSponsored,
          isInternal,
        };

        links.push(linkRecord);
        if (isInternal) {
          internalLinks.push(linkRecord);
        } else {
          externalLinks.push(linkRecord);
        }
      } catch {
        // malformed URL
      }
    });

    // 10. Images & Alt Evaluation
    const images: ExtractedImage[] = [];
    let missingAltCount = 0;
    let emptyAltCount = 0;

    $('img').each((_, el) => {
      const src = $(el).attr('src')?.trim();
      if (!src) return;

      const altAttr = $(el).attr('alt');
      const isMissingAlt = altAttr === undefined;
      const hasEmptyAlt = altAttr !== undefined && altAttr.trim() === '';
      const alt = altAttr !== undefined && altAttr.trim().length > 0 ? altAttr.trim() : null;

      if (isMissingAlt) missingAltCount++;
      if (hasEmptyAlt) emptyAltCount++;

      let normalizedSrc = src;
      try {
        normalizedSrc = new URL(src, currentUrl).toString();
      } catch {}

      const width = parseInt($(el).attr('width') || '', 10);
      const height = parseInt($(el).attr('height') || '', 10);
      const loading = $(el).attr('loading')?.toLowerCase();

      images.push({
        src,
        normalizedSrc,
        alt,
        hasEmptyAlt,
        isMissingAlt,
        width: isNaN(width) ? undefined : width,
        height: isNaN(height) ? undefined : height,
        loading,
      });
    });

    // 11. Structured Data JSON-LD
    let schemaStatus: 'PARSED' | 'JSON_INVALID' | 'NO_SCHEMA' = 'NO_SCHEMA';
    const schemaTypes: string[] = [];
    const rawJsonLdBlocks: any[] = [];

    const jsonLdScripts = $('script[type="application/ld+json"]');
    if (jsonLdScripts.length > 0) {
      jsonLdScripts.each((_, el) => {
        const rawJson = $(el).html();
        if (rawJson && rawJson.trim().length > 0) {
          try {
            const parsed = JSON.parse(rawJson);
            rawJsonLdBlocks.push(parsed);
            schemaStatus = 'PARSED';

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
          } catch {
            schemaStatus = 'JSON_INVALID';
          }
        }
      });
    }

    // 12. Clean visible text extraction (stripping structural chrome, scripts, styles)
    const clone$ = cheerio.load(html);
    clone$('script, style, noscript, svg, nav, footer, header, form, iframe').remove();
    const visibleText = clone$('body').text().replace(/\s+/g, ' ').trim();
    const words = visibleText ? visibleText.split(' ').filter(Boolean) : [];
    const wordCount = words.length;

    return {
      title,
      titleLength,
      metaDescription,
      metaDescLength,
      htmlLang,
      metaRobots,
      canonicalUrl,
      normalizedCanonicalUrl,
      canonicalMatch,
      hasMultipleCanonicals,
      canonicalTagsCount,
      h1Tags,
      h2Tags,
      h3Count,
      h4to6Count,
      viewport,
      ogTitle,
      ogDescription,
      ogImage,
      twitterCard,
      visibleText,
      wordCount,
      links,
      internalLinks,
      externalLinks,
      images,
      missingAltCount,
      emptyAltCount,
      hreflangs,
      relNext,
      relPrev,
      schemaStatus,
      schemaTypes: Array.from(new Set(schemaTypes)),
      rawJsonLdBlocks,
    };
  }
}
