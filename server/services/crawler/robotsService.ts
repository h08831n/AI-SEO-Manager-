import { SafeUrlPolicy } from '../../security/safeUrlPolicy';

export interface RobotsRule {
  userAgent: string;
  allow: string[];
  disallow: string[];
}

export interface ParsedRobotsTxt {
  rules: RobotsRule[];
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
          parsed: { rules: [], sitemaps: [], rawContent: '' },
          fetchStatus: res.statusCode,
        };
      } else {
        return {
          parsed: { rules: [], sitemaps: [], rawContent: '' },
          fetchStatus: res.statusCode,
        };
      }
    } catch (err: any) {
      return {
        parsed: { rules: [], sitemaps: [], rawContent: '' },
        fetchStatus: 0,
        error: err.message,
      };
    }
  }

  /**
   * Parses raw robots.txt content according to RFC 9309 rules
   */
  public static parseRobotsTxt(content: string): ParsedRobotsTxt {
    const lines = content.split(/\r?\n/);
    const rules: RobotsRule[] = [];
    const sitemaps: string[] = [];
    let currentRule: RobotsRule | null = null;
    let crawlDelay: number | undefined;

    for (const rawLine of lines) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const directive = line.substring(0, colonIdx).trim().toLowerCase();
      const value = line.substring(colonIdx + 1).trim();

      if (directive === 'user-agent') {
        const ua = value.toLowerCase();
        currentRule = { userAgent: ua, allow: [], disallow: [] };
        rules.push(currentRule);
      } else if (directive === 'disallow' && currentRule) {
        if (value) currentRule.disallow.push(value);
      } else if (directive === 'allow' && currentRule) {
        if (value) currentRule.allow.push(value);
      } else if (directive === 'sitemap') {
        if (value) sitemaps.push(value);
      } else if (directive === 'crawl-delay') {
        const parsedDelay = parseFloat(value);
        if (!isNaN(parsedDelay)) crawlDelay = parsedDelay;
      }
    }

    return { rules, sitemaps, crawlDelay, rawContent: content };
  }

  /**
   * Evaluates if a given URL is allowed for a user-agent according to longest-match rule in RFC 9309
   */
  public static isAllowed(
    parsedRobots: ParsedRobotsTxt,
    urlToCheck: string,
    userAgent = 'AISEOManagerBot'
  ): { allowed: boolean; matchedRule?: string } {
    if (!parsedRobots || parsedRobots.rules.length === 0) {
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

    // 1. Find matching rules for specific UA, fallback to '*'
    const matchedRules = parsedRobots.rules.filter(
      (r) => targetUa.includes(r.userAgent) || r.userAgent === '*'
    );

    if (matchedRules.length === 0) {
      return { allowed: true };
    }

    // Sort: specific UA takes precedence over wildcard '*'
    matchedRules.sort((a, b) => {
      if (a.userAgent === '*' && b.userAgent !== '*') return 1;
      if (a.userAgent !== '*' && b.userAgent === '*') return -1;
      return 0;
    });

    const activeRule = matchedRules[0];

    // RFC 9309: Longest matching rule wins. If length tie, ALLOW wins.
    let longestMatchLen = -1;
    let allowedByLongestMatch = true;
    let matchedDirective = '';

    for (const allowPattern of activeRule.allow) {
      if (this.pathMatches(pathAndQuery, allowPattern)) {
        if (allowPattern.length >= longestMatchLen) { // Tie-break: Allow wins or takes precedence
          longestMatchLen = allowPattern.length;
          allowedByLongestMatch = true;
          matchedDirective = `Allow: ${allowPattern}`;
        }
      }
    }

    for (const disallowPattern of activeRule.disallow) {
      if (this.pathMatches(pathAndQuery, disallowPattern)) {
        if (disallowPattern.length > longestMatchLen) { // Strict inequality so Allow wins ties
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
