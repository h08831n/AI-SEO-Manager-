import { SafeUrlPolicy } from '../../security/safeUrlPolicy';

export interface RobotsRuleGroup {
  userAgents: string[];
  allow: string[];
  disallow: string[];
}

export interface ParsedRobotsTxt {
  ruleGroups: RobotsRuleGroup[];
  sitemaps: string[];
  crawlDelay?: number;
  rawContent: string;
}

export class RobotsService {
  /**
   * Fetches and parses robots.txt safely for a given base origin
   */
  public static async fetchAndParseRobots(
    originUrl: string,
    userAgent = 'AISEOManagerBot'
  ): Promise<{ parsed: ParsedRobotsTxt; fetchStatus: number; error?: string }> {
    try {
      const parsedUrl = new URL(originUrl);
      const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;

      const res = await SafeUrlPolicy.safeFetch(robotsUrl, {
        timeoutMs: 6000,
        maxRedirects: 3,
        maxResponseBytes: 512 * 1024,
        allowedContentTypes: ['text/plain', 'text/html', '*/*'],
      });

      if (res.statusCode === 200) {
        const parsed = this.parseRobotsTxt(res.body);
        return { parsed, fetchStatus: 200 };
      } else if (res.statusCode === 404 || res.statusCode === 410) {
        return {
          parsed: { ruleGroups: [], sitemaps: [], rawContent: '' },
          fetchStatus: res.statusCode,
        };
      } else {
        return {
          parsed: { ruleGroups: [], sitemaps: [], rawContent: '' },
          fetchStatus: res.statusCode,
        };
      }
    } catch (err: any) {
      return {
        parsed: { ruleGroups: [], sitemaps: [], rawContent: '' },
        fetchStatus: 0,
        error: err.message,
      };
    }
  }

  /**
   * Parses raw robots.txt content according to RFC 9309 rules (grouping consecutive User-agent lines)
   */
  public static parseRobotsTxt(content: string): ParsedRobotsTxt {
    const lines = content.split(/\r?\n/);
    const ruleGroups: RobotsRuleGroup[] = [];
    const sitemaps: string[] = [];
    let currentGroup: RobotsRuleGroup | null = null;
    let crawlDelay: number | undefined;
    let isPreviousLineUserAgent = false;

    for (const rawLine of lines) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const directive = line.substring(0, colonIdx).trim().toLowerCase();
      const value = line.substring(colonIdx + 1).trim();

      if (directive === 'user-agent') {
        const ua = value.toLowerCase();
        if (isPreviousLineUserAgent && currentGroup) {
          // Consecutive User-agent line belongs to the same rule group
          if (!currentGroup.userAgents.includes(ua)) {
            currentGroup.userAgents.push(ua);
          }
        } else {
          // New rule group
          currentGroup = { userAgents: [ua], allow: [], disallow: [] };
          ruleGroups.push(currentGroup);
        }
        isPreviousLineUserAgent = true;
      } else {
        isPreviousLineUserAgent = false;

        if (directive === 'disallow' && currentGroup) {
          if (value) currentGroup.disallow.push(value);
        } else if (directive === 'allow' && currentGroup) {
          if (value) currentGroup.allow.push(value);
        } else if (directive === 'sitemap') {
          if (value && !sitemaps.includes(value)) sitemaps.push(value);
        } else if (directive === 'crawl-delay') {
          const parsedDelay = parseFloat(value);
          if (!isNaN(parsedDelay)) crawlDelay = parsedDelay;
        }
      }
    }

    return { ruleGroups, sitemaps, crawlDelay, rawContent: content };
  }

  /**
   * Evaluates if a given URL is allowed for a user-agent according to RFC 9309 (longest match in most specific group)
   */
  public static isAllowed(
    parsedRobots: ParsedRobotsTxt,
    urlToCheck: string,
    userAgent = 'AISEOManagerBot'
  ): { allowed: boolean; matchedRule?: string } {
    if (!parsedRobots || parsedRobots.ruleGroups.length === 0) {
      return { allowed: true };
    }

    let parsed: URL;
    try {
      parsed = new URL(urlToCheck);
    } catch {
      return { allowed: false, matchedRule: 'INVALID_URL' };
    }

    const pathAndQuery = `${parsed.pathname}${parsed.search}`;
    const targetUa = userAgent.toLowerCase();

    // 1. Find matching rule group by specificity
    let bestGroup: RobotsRuleGroup | null = null;
    let bestGroupMatchLength = -1;
    let wildcardGroup: RobotsRuleGroup | null = null;

    for (const group of parsedRobots.ruleGroups) {
      for (const ua of group.userAgents) {
        if (ua === '*') {
          wildcardGroup = group;
        } else if (targetUa.includes(ua) || ua.includes(targetUa)) {
          if (ua.length > bestGroupMatchLength) {
            bestGroupMatchLength = ua.length;
            bestGroup = group;
          }
        }
      }
    }

    const activeGroup = bestGroup || wildcardGroup;
    if (!activeGroup) {
      return { allowed: true };
    }

    // 2. RFC 9309: Longest matching path rule in active group wins. If tie, ALLOW wins.
    let longestMatchLen = -1;
    let allowedByLongestMatch = true;
    let matchedDirective = '';

    for (const allowPattern of activeGroup.allow) {
      if (this.pathMatches(pathAndQuery, allowPattern)) {
        if (allowPattern.length >= longestMatchLen) {
          longestMatchLen = allowPattern.length;
          allowedByLongestMatch = true;
          matchedDirective = `Allow: ${allowPattern}`;
        }
      }
    }

    for (const disallowPattern of activeGroup.disallow) {
      if (this.pathMatches(pathAndQuery, disallowPattern)) {
        if (disallowPattern.length > longestMatchLen) { // Strict inequality ensures Allow wins tie
          longestMatchLen = disallowPattern.length;
          allowedByLongestMatch = false;
          matchedDirective = `Disallow: ${disallowPattern}`;
        }
      }
    }

    return {
      allowed: allowedByLongestMatch,
      matchedRule: longestMatchLen >= 0 ? matchedDirective : undefined,
    };
  }

  public static pathMatches(pathAndQuery: string, pattern: string): boolean {
    if (!pattern) return false;
    if (pattern === '/') return true;

    // Handle end-of-pattern anchor $
    const hasEndAnchor = pattern.endsWith('$');
    const cleanPattern = hasEndAnchor ? pattern.slice(0, -1) : pattern;

    // Escape regex chars except wildcard *
    const escaped = cleanPattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    const regex = new RegExp(`^${escaped}${hasEndAnchor ? '$' : ''}`);
    return regex.test(pathAndQuery);
  }
}
