import { ExtractedHreflang } from './comprehensiveHtmlParser';

export interface HreflangIssue {
  type: 'INVALID_LANGUAGE_CODE' | 'DUPLICATE_LANGUAGE_CODE' | 'MISSING_HREF' | 'MISSING_SELF_REFERENCE' | 'MISSING_X_DEFAULT';
  lang: string;
  href?: string;
  message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface HreflangAnalysisResult {
  hasHreflang: boolean;
  entriesCount: number;
  hasSelfReference: boolean;
  hasXDefault: boolean;
  validEntries: ExtractedHreflang[];
  issues: HreflangIssue[];
}

export class HreflangAnalyzer {
  public static analyze(
    currentUrl: string,
    hreflangs: ExtractedHreflang[]
  ): HreflangAnalysisResult {
    const issues: HreflangIssue[] = [];
    const validEntries: ExtractedHreflang[] = [];
    const seenLangs = new Set<string>();

    let hasSelfReference = false;
    let hasXDefault = false;

    if (hreflangs.length === 0) {
      return {
        hasHreflang: false,
        entriesCount: 0,
        hasSelfReference: false,
        hasXDefault: false,
        validEntries: [],
        issues: [],
      };
    }

    for (const entry of hreflangs) {
      const lowerLang = entry.lang.toLowerCase();

      if (!entry.isValidSyntax) {
        issues.push({
          type: 'INVALID_LANGUAGE_CODE',
          lang: entry.lang,
          href: entry.href,
          message: `Invalid ISO-639 / BCP-47 hreflang format: "${entry.lang}"`,
          severity: 'HIGH',
        });
        continue;
      }

      if (seenLangs.has(lowerLang)) {
        issues.push({
          type: 'DUPLICATE_LANGUAGE_CODE',
          lang: entry.lang,
          href: entry.href,
          message: `Duplicate hreflang declaration for language "${entry.lang}" on same page`,
          severity: 'MEDIUM',
        });
      } else {
        seenLangs.add(lowerLang);
      }

      if (lowerLang === 'x-default') {
        hasXDefault = true;
      }

      if (entry.normalizedHref === currentUrl) {
        hasSelfReference = true;
      }

      validEntries.push(entry);
    }

    if (!hasSelfReference && validEntries.length > 0) {
      issues.push({
        type: 'MISSING_SELF_REFERENCE',
        lang: 'self',
        message: 'Hreflang cluster does not contain a self-referencing alternate link for the current page',
        severity: 'MEDIUM',
      });
    }

    return {
      hasHreflang: true,
      entriesCount: hreflangs.length,
      hasSelfReference,
      hasXDefault,
      validEntries,
      issues,
    };
  }
}
