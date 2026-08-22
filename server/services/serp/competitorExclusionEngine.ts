export interface DomainExclusionCheck {
  domain: string;
  isDirectCompetitor: boolean;
  isPlatform: boolean;
  isExcluded: boolean;
  exclusionReason?: string;
}

export class CompetitorExclusionEngine {
  private static GLOBAL_PLATFORM_DOMAINS = new Set([
    'wikipedia.org',
    'en.wikipedia.org',
    'youtube.com',
    'www.youtube.com',
    'reddit.com',
    'www.reddit.com',
    'quora.com',
    'www.quora.com',
    'amazon.com',
    'www.amazon.com',
    'linkedin.com',
    'www.linkedin.com',
    'twitter.com',
    'x.com',
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'pinterest.com',
    'medium.com',
    'github.com',
    'stackoverflow.com',
    'apple.com',
    'google.com',
    'yelp.com',
    'tripadvisor.com',
    'gov',
    'edu',
  ]);

  private static AGGREGATOR_PATTERNS = [
    /\.gov$/,
    /\.edu$/,
    /dictionary\./,
    /thesaurus\./,
    /wiktionary\./,
    /news\./,
    /bbc\.co/,
    /cnn\.com/,
    /forbes\.com/,
    /nytimes\.com/,
  ];

  static normalizeDomain(domainOrUrl: string): string {
    let d = domainOrUrl.trim().toLowerCase();
    d = d.replace(/^https?:\/\//, '');
    d = d.replace(/^www\./, '');
    d = d.split('/')[0];
    d = d.split(':')[0];
    return d;
  }

  static evaluateDomain(domain: string, userExcludedDomains: string[] = []): DomainExclusionCheck {
    const norm = this.normalizeDomain(domain);

    // 1. Check user defined exclusions
    const isUserExcluded = userExcludedDomains.some((u) => this.normalizeDomain(u) === norm);
    if (isUserExcluded) {
      return {
        domain: norm,
        isDirectCompetitor: false,
        isPlatform: false,
        isExcluded: true,
        exclusionReason: 'USER_CUSTOM_EXCLUSION',
      };
    }

    // 2. Check global platform blacklist
    if (this.GLOBAL_PLATFORM_DOMAINS.has(norm)) {
      return {
        domain: norm,
        isDirectCompetitor: false,
        isPlatform: true,
        isExcluded: true,
        exclusionReason: 'GLOBAL_PLATFORM_BLACKLIST',
      };
    }

    // 3. Check aggregator / media / government pattern
    for (const pat of this.AGGREGATOR_PATTERNS) {
      if (pat.test(norm)) {
        return {
          domain: norm,
          isDirectCompetitor: false,
          isPlatform: true,
          isExcluded: true,
          exclusionReason: 'NEWS_OR_GOVERNMENT_AGGREGATOR',
        };
      }
    }

    // Direct Competitor Candidate
    return {
      domain: norm,
      isDirectCompetitor: true,
      isPlatform: false,
      isExcluded: false,
    };
  }
}
