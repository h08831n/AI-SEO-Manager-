import { UrlNormalizer } from './urlNormalizer';

export interface CrawlScopeConfig {
  allowedHost: string;
  allowSubdomains?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
}

export class UrlScopePolicy {
  /**
   * Evaluates if a given URL is within the allowed crawl scope
   */
  public static isUrlInScope(
    candidateUrl: string,
    currentDepth: number,
    config: CrawlScopeConfig
  ): { allowed: boolean; reason?: string; isInternal: boolean } {
    let parsed: URL;
    try {
      parsed = new URL(candidateUrl);
    } catch {
      return { allowed: false, reason: 'INVALID_URL_SYNTAX', isInternal: false };
    }

    const candidateHost = parsed.hostname.toLowerCase();
    const allowedHost = config.allowedHost.toLowerCase();

    // 1. Host matching
    const isExactHost = candidateHost === allowedHost;
    const isSubdomain = config.allowSubdomains && candidateHost.endsWith(`.${allowedHost}`);
    const isInternal = isExactHost || Boolean(isSubdomain);

    if (!isInternal) {
      return {
        allowed: false,
        reason: 'EXTERNAL_DOMAIN',
        isInternal: false,
      };
    }

    // 2. Depth check
    if (config.maxDepth !== undefined && currentDepth > config.maxDepth) {
      return {
        allowed: false,
        reason: `MAX_DEPTH_EXCEEDED (Depth ${currentDepth} > ${config.maxDepth})`,
        isInternal: true,
      };
    }

    const pathname = parsed.pathname;

    // 3. Exclude patterns (Regex / substrings)
    if (config.excludePatterns && config.excludePatterns.length > 0) {
      for (const pattern of config.excludePatterns) {
        if (this.matchesPattern(pathname, pattern)) {
          return {
            allowed: false,
            reason: `EXCLUDED_BY_PATTERN (${pattern})`,
            isInternal: true,
          };
        }
      }
    }

    // 4. Include patterns
    if (config.includePatterns && config.includePatterns.length > 0) {
      const matched = config.includePatterns.some((pattern) => this.matchesPattern(pathname, pattern));
      if (!matched) {
        return {
          allowed: false,
          reason: 'NOT_MATCHED_IN_INCLUDE_PATTERNS',
          isInternal: true,
        };
      }
    }

    return { allowed: true, isInternal: true };
  }

  private static matchesPattern(pathname: string, pattern: string): boolean {
    if (pattern.startsWith('^') || pattern.endsWith('$') || pattern.includes('*')) {
      try {
        const regexStr = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
        const re = new RegExp(regexStr);
        return re.test(pathname);
      } catch {
        return pathname.includes(pattern);
      }
    }
    return pathname.includes(pattern);
  }
}
