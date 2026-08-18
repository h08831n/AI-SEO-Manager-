import { UrlNormalizer } from './urlNormalizer';

export interface CanonicalAnalysisResult {
  hasCanonical: boolean;
  rawCanonical: string | null;
  normalizedCanonical: string | null;
  isSelfCanonical: boolean;
  isInternal: boolean;
  isExternal: boolean;
  hasMultipleCanonicals: boolean;
  canonicalTagsCount: number;
  isMalformed: boolean;
  classification:
    | 'SELF_CANONICAL'
    | 'INTERNAL_CANONICAL_TARGET'
    | 'EXTERNAL_CANONICAL_TARGET'
    | 'MISSING_CANONICAL'
    | 'MULTIPLE_CANONICALS'
    | 'MALFORMED_CANONICAL';
  evidence: Record<string, any>;
}

export class CanonicalAnalyzer {
  public static analyze(
    pageUrl: string,
    canonicalHref: string | null,
    canonicalTagsCount: number,
    originUrl: string
  ): CanonicalAnalysisResult {
    const normalizedPageUrl = UrlNormalizer.normalize(pageUrl);
    const originHostname = new URL(originUrl).hostname.toLowerCase();

    if (canonicalTagsCount > 1) {
      return {
        hasCanonical: true,
        rawCanonical: canonicalHref,
        normalizedCanonical: null,
        isSelfCanonical: false,
        isInternal: false,
        isExternal: false,
        hasMultipleCanonicals: true,
        canonicalTagsCount,
        isMalformed: false,
        classification: 'MULTIPLE_CANONICALS',
        evidence: { canonicalTagsCount, rawCanonical: canonicalHref },
      };
    }

    if (!canonicalHref || canonicalHref.trim().length === 0) {
      return {
        hasCanonical: false,
        rawCanonical: null,
        normalizedCanonical: null,
        isSelfCanonical: false,
        isInternal: false,
        isExternal: false,
        hasMultipleCanonicals: false,
        canonicalTagsCount: 0,
        isMalformed: false,
        classification: 'MISSING_CANONICAL',
        evidence: { message: 'No <link rel="canonical"> tag found in HTML head' },
      };
    }

    let normalizedCanonical: string;
    let isInternal = false;

    try {
      const resolved = new URL(canonicalHref, pageUrl);
      normalizedCanonical = UrlNormalizer.normalize(resolved.toString());
      isInternal = resolved.hostname.toLowerCase() === originHostname;
    } catch {
      return {
        hasCanonical: true,
        rawCanonical: canonicalHref,
        normalizedCanonical: null,
        isSelfCanonical: false,
        isInternal: false,
        isExternal: false,
        hasMultipleCanonicals: false,
        canonicalTagsCount: 1,
        isMalformed: true,
        classification: 'MALFORMED_CANONICAL',
        evidence: { rawCanonical: canonicalHref, parseError: 'Invalid URL format' },
      };
    }

    const isSelfCanonical = normalizedCanonical === normalizedPageUrl;
    const isExternal = !isInternal;

    let classification: CanonicalAnalysisResult['classification'] = 'SELF_CANONICAL';
    if (!isSelfCanonical) {
      classification = isInternal ? 'INTERNAL_CANONICAL_TARGET' : 'EXTERNAL_CANONICAL_TARGET';
    }

    return {
      hasCanonical: true,
      rawCanonical: canonicalHref,
      normalizedCanonical,
      isSelfCanonical,
      isInternal,
      isExternal,
      hasMultipleCanonicals: false,
      canonicalTagsCount: 1,
      isMalformed: false,
      classification,
      evidence: {
        pageUrl: normalizedPageUrl,
        canonicalTarget: normalizedCanonical,
        isSelfCanonical,
        isInternal,
      },
    };
  }
}
