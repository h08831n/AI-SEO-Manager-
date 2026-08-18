import { CrawlUrlResponse, CrawlIssue } from '../../../src/shared/contracts';

export interface RuleDefinition {
  ruleKey: string;
  version: string;
  category: 'INDEXABILITY' | 'TECHNICAL' | 'METADATA' | 'CONTENT' | 'LINKS';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  description: string;
  requiredEvidence: string[];
  recommendedAction: string;
  automationLevel: 'LEVEL_0_READ_ONLY' | 'LEVEL_1_SAFE_AUTOMATION' | 'LEVEL_2_APPROVAL_REQUIRED' | 'LEVEL_3_HIGH_RISK';
  falsePositiveRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  enabled: boolean;
}

export interface RuleEvaluationResult {
  ruleKey: string;
  version: string;
  passed: boolean;
  issue?: CrawlIssue;
}

export class VersionedRuleEngine {
  public static readonly VERSION = '1.0.0';

  private static rules: RuleDefinition[] = [
    {
      ruleKey: 'RULE_HTTP_STATUS_200',
      version: '1.0.0',
      category: 'TECHNICAL',
      severity: 'CRITICAL',
      description: 'Page must return a successful 200 OK HTTP status code.',
      requiredEvidence: ['statusCode'],
      recommendedAction: 'Investigate web server logs and fix 4xx/5xx responses.',
      automationLevel: 'LEVEL_0_READ_ONLY',
      falsePositiveRisk: 'LOW',
      enabled: true,
    },
    {
      ruleKey: 'RULE_INDEXABILITY_NOINDEX',
      version: '1.0.0',
      category: 'INDEXABILITY',
      severity: 'CRITICAL',
      description: 'Commercial landing pages must not contain noindex directives.',
      requiredEvidence: ['metaRobots', 'xRobotsTag'],
      recommendedAction: 'Remove noindex directive from page HTML head or HTTP headers.',
      automationLevel: 'LEVEL_2_APPROVAL_REQUIRED',
      falsePositiveRisk: 'LOW',
      enabled: true,
    },
    {
      ruleKey: 'RULE_CANONICAL_MATCH',
      version: '1.0.0',
      category: 'INDEXABILITY',
      severity: 'HIGH',
      description: 'Page must specify a canonical URL matching its requested address.',
      requiredEvidence: ['canonicalUrl', 'finalUrl'],
      recommendedAction: 'Update <link rel="canonical"> to reference the self-referential canonical URL.',
      automationLevel: 'LEVEL_2_APPROVAL_REQUIRED',
      falsePositiveRisk: 'LOW',
      enabled: true,
    },
    {
      ruleKey: 'RULE_TITLE_EXISTS_AND_LENGTH',
      version: '1.0.0',
      category: 'METADATA',
      severity: 'HIGH',
      description: 'Page must possess a title tag between 15 and 65 characters.',
      requiredEvidence: ['title', 'titleLength'],
      recommendedAction: 'Draft and deploy an informative, keyword-focused title tag.',
      automationLevel: 'LEVEL_1_SAFE_AUTOMATION',
      falsePositiveRisk: 'LOW',
      enabled: true,
    },
    {
      ruleKey: 'RULE_META_DESCRIPTION_EXISTS',
      version: '1.0.0',
      category: 'METADATA',
      severity: 'MEDIUM',
      description: 'Page should possess a compelling meta description between 50 and 160 characters.',
      requiredEvidence: ['metaDescription', 'metaDescLength'],
      recommendedAction: 'Write and publish a search-intent aligned meta description.',
      automationLevel: 'LEVEL_1_SAFE_AUTOMATION',
      falsePositiveRisk: 'LOW',
      enabled: true,
    },
    {
      ruleKey: 'RULE_SINGLE_H1_HEADING',
      version: '1.0.0',
      category: 'CONTENT',
      severity: 'MEDIUM',
      description: 'Page must have exactly one <h1> tag establishing primary hierarchy.',
      requiredEvidence: ['h1Tags'],
      recommendedAction: 'Consolidate multiple H1 headings into subheadings (H2/H3) or add missing H1.',
      automationLevel: 'LEVEL_1_SAFE_AUTOMATION',
      falsePositiveRisk: 'LOW',
      enabled: true,
    },
  ];

  public static getRegisteredRules(): RuleDefinition[] {
    return [...this.rules];
  }

  public static evaluateCrawl(crawl: CrawlUrlResponse): RuleEvaluationResult[] {
    const results: RuleEvaluationResult[] = [];

    // RULE_HTTP_STATUS_200
    const ruleHttpStatus = this.rules.find((r) => r.ruleKey === 'RULE_HTTP_STATUS_200')!;
    if (crawl.statusCode !== 200) {
      results.push({
        ruleKey: ruleHttpStatus.ruleKey,
        version: ruleHttpStatus.version,
        passed: false,
        issue: {
          id: `eval-${ruleHttpStatus.ruleKey}-${Date.now()}`,
          type: 'HTTP_STATUS_ERROR',
          severity: ruleHttpStatus.severity,
          message: `Page returned HTTP status code ${crawl.statusCode}`,
          evidence: `Status: ${crawl.statusCode}`,
          impact: 'Search engines drop non-200 pages from search indices.',
        },
      });
    } else {
      results.push({ ruleKey: ruleHttpStatus.ruleKey, version: ruleHttpStatus.version, passed: true });
    }

    // RULE_INDEXABILITY_NOINDEX
    const ruleNoIndex = this.rules.find((r) => r.ruleKey === 'RULE_INDEXABILITY_NOINDEX')!;
    const isNoIndex =
      (crawl.metaRobots && crawl.metaRobots.toLowerCase().includes('noindex')) ||
      (crawl.xRobotsTag && crawl.xRobotsTag.toLowerCase().includes('noindex'));

    if (isNoIndex) {
      results.push({
        ruleKey: ruleNoIndex.ruleKey,
        version: ruleNoIndex.version,
        passed: false,
        issue: {
          id: `eval-${ruleNoIndex.ruleKey}-${Date.now()}`,
          type: 'NOINDEX_BLOCK',
          severity: ruleNoIndex.severity,
          message: 'Page is blocked from indexation by noindex directive.',
          evidence: `Robots: ${crawl.metaRobots || crawl.xRobotsTag}`,
          impact: 'Page will not generate search impressions or organic traffic.',
        },
      });
    } else {
      results.push({ ruleKey: ruleNoIndex.ruleKey, version: ruleNoIndex.version, passed: true });
    }

    // RULE_CANONICAL_MATCH
    const ruleCanonical = this.rules.find((r) => r.ruleKey === 'RULE_CANONICAL_MATCH')!;
    if (!crawl.canonicalMatch && crawl.statusCode === 200) {
      results.push({
        ruleKey: ruleCanonical.ruleKey,
        version: ruleCanonical.version,
        passed: false,
        issue: {
          id: `eval-${ruleCanonical.ruleKey}-${Date.now()}`,
          type: 'CANONICAL_MISMATCH',
          severity: ruleCanonical.severity,
          message: `Page declares non-self canonical URL: ${crawl.canonicalUrl}`,
          evidence: `Final URL: ${crawl.finalUrl} != Canonical: ${crawl.canonicalUrl}`,
          impact: 'Direct indexation is diverted to canonical destination.',
        },
      });
    } else {
      results.push({ ruleKey: ruleCanonical.ruleKey, version: ruleCanonical.version, passed: true });
    }

    // RULE_TITLE_EXISTS_AND_LENGTH
    const ruleTitle = this.rules.find((r) => r.ruleKey === 'RULE_TITLE_EXISTS_AND_LENGTH')!;
    if (!crawl.title || crawl.titleLength < 10 || crawl.titleLength > 70) {
      results.push({
        ruleKey: ruleTitle.ruleKey,
        version: ruleTitle.version,
        passed: false,
        issue: {
          id: `eval-${ruleTitle.ruleKey}-${Date.now()}`,
          type: !crawl.title ? 'MISSING_TITLE' : 'SUBOPTIMAL_TITLE_LENGTH',
          severity: ruleTitle.severity,
          message: !crawl.title
            ? 'Page title is missing.'
            : `Page title length is ${crawl.titleLength} characters (recommended: 40-60).`,
          evidence: `Title: "${crawl.title || ''}" (${crawl.titleLength} chars)`,
          impact: 'Suboptimal SERP presentation and keyword ranking relevancy.',
        },
      });
    } else {
      results.push({ ruleKey: ruleTitle.ruleKey, version: ruleTitle.version, passed: true });
    }

    // RULE_META_DESCRIPTION_EXISTS
    const ruleMetaDesc = this.rules.find((r) => r.ruleKey === 'RULE_META_DESCRIPTION_EXISTS')!;
    if (!crawl.metaDescription || crawl.metaDescLength < 30 || crawl.metaDescLength > 180) {
      results.push({
        ruleKey: ruleMetaDesc.ruleKey,
        version: ruleMetaDesc.version,
        passed: false,
        issue: {
          id: `eval-${ruleMetaDesc.ruleKey}-${Date.now()}`,
          type: !crawl.metaDescription ? 'MISSING_META_DESCRIPTION' : 'SUBOPTIMAL_META_DESCRIPTION',
          severity: ruleMetaDesc.severity,
          message: !crawl.metaDescription
            ? 'Page meta description is missing.'
            : `Meta description length is ${crawl.metaDescLength} characters.`,
          evidence: `Meta: "${crawl.metaDescription || ''}" (${crawl.metaDescLength} chars)`,
          impact: 'Lower CTR in search engine results snippets.',
        },
      });
    } else {
      results.push({ ruleKey: ruleMetaDesc.ruleKey, version: ruleMetaDesc.version, passed: true });
    }

    // RULE_SINGLE_H1_HEADING
    const ruleH1 = this.rules.find((r) => r.ruleKey === 'RULE_SINGLE_H1_HEADING')!;
    if (!crawl.h1Tags || crawl.h1Tags.length !== 1) {
      results.push({
        ruleKey: ruleH1.ruleKey,
        version: ruleH1.version,
        passed: false,
        issue: {
          id: `eval-${ruleH1.ruleKey}-${Date.now()}`,
          type: 'RULE_SINGLE_H1_HEADING',
          severity: ruleH1.severity,
          message:
            !crawl.h1Tags || crawl.h1Tags.length === 0
              ? 'Page is missing an H1 heading.'
              : `Page has ${crawl.h1Tags.length} H1 headings (should have exactly 1).`,
          evidence: `Found ${crawl.h1Tags?.length || 0} H1 tags.`,
          impact: 'Search engines rely on H1 to understand page hierarchy and core theme.',
        },
      });
    } else {
      results.push({ ruleKey: ruleH1.ruleKey, version: ruleH1.version, passed: true });
    }

    return results;
  }

  public static evaluateAllRules(crawl: CrawlUrlResponse): CrawlIssue[] {
    const results = this.evaluateCrawl(crawl);
    return results
      .filter((r) => !r.passed && r.issue !== undefined)
      .map((r) => r.issue!);
  }
}
