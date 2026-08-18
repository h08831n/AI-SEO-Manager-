export interface IndexabilityEvidence {
  statusCode: number;
  isNoIndexMeta: boolean;
  isNoIndexHeader: boolean;
  isRobotsBlocked: boolean;
  robotsMatchedRule?: string;
  hasCanonical: boolean;
  isSelfCanonical: boolean;
  canonicalTargetUrl?: string;
  isErrorStatus: boolean;
}

export interface IndexabilityResult {
  isIndexable: boolean;
  indexabilityStatus: 'INDEXABLE' | 'NON_INDEXABLE' | 'BLOCKED_ROBOTS' | 'CANONICALIZED_ELSEWHERE' | 'HTTP_ERROR';
  reasons: string[];
}

export class IndexabilityAnalyzer {
  public static evaluate(evidence: IndexabilityEvidence): IndexabilityResult {
    const reasons: string[] = [];

    if (evidence.statusCode >= 400 || evidence.statusCode === 0) {
      reasons.push(`HTTP status ${evidence.statusCode} prevents search indexing`);
      return {
        isIndexable: false,
        indexabilityStatus: 'HTTP_ERROR',
        reasons,
      };
    }

    if (evidence.isRobotsBlocked) {
      reasons.push(`Disallowed by robots.txt rule: ${evidence.robotsMatchedRule || 'Disallow'}`);
      return {
        isIndexable: false,
        indexabilityStatus: 'BLOCKED_ROBOTS',
        reasons,
      };
    }

    if (evidence.isNoIndexMeta || evidence.isNoIndexHeader) {
      if (evidence.isNoIndexMeta) reasons.push('Blocked by <meta name="robots" content="noindex">');
      if (evidence.isNoIndexHeader) reasons.push('Blocked by X-Robots-Tag: noindex HTTP header');
      return {
        isIndexable: false,
        indexabilityStatus: 'NON_INDEXABLE',
        reasons,
      };
    }

    // Canonicalization note: If a page points canonical elsewhere, Google will consolidate signals,
    // but the URL itself is evaluated separately from binary indexability.
    if (evidence.hasCanonical && !evidence.isSelfCanonical) {
      reasons.push(`Canonical points to distinct URL: ${evidence.canonicalTargetUrl}`);
      return {
        isIndexable: true, // Still indexable candidate, but consolidated
        indexabilityStatus: 'CANONICALIZED_ELSEWHERE',
        reasons,
      };
    }

    reasons.push('HTTP 200 OK, indexable directives permitted, self-referential or default canonical');
    return {
      isIndexable: true,
      indexabilityStatus: 'INDEXABLE',
      reasons,
    };
  }
}
