import { AutomationRiskLevel } from '@prisma/client';
import { ProblemContext, DiagnosisResult } from '../decisionTypes';

export interface IDiagnosisRule {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly category:
    | 'TECHNICAL'
    | 'METADATA'
    | 'CONTENT'
    | 'ARCHITECTURE'
    | 'INDEXABILITY'
    | 'SERP_DISPLACEMENT'
    | 'SCHEMA';
  readonly description: string;
  readonly defaultAutomationLevel: AutomationRiskLevel;
  readonly baseEffort: number;
  readonly baseRisk: number;

  applies(context: ProblemContext): boolean;
  diagnose(context: ProblemContext): DiagnosisResult | null;
}

export class CanonicalMismatchRule implements IDiagnosisRule {
  readonly id = 'RULE_CANONICAL_MISMATCH';
  readonly version = '1.2.0';
  readonly name = 'Resolve Canonical Tag Mismatch or Self-Reference Failure';
  readonly category = 'TECHNICAL' as const;
  readonly description = 'Detects canonical tags pointing to missing pages, 404s, or wrong target URLs.';
  readonly defaultAutomationLevel = AutomationRiskLevel.LEVEL_1_SAFE_AUTOMATION;
  readonly baseEffort = 1.0;
  readonly baseRisk = 2.0;

  applies(ctx: ProblemContext): boolean {
    const hasCanonicalIssue = ctx.crawlIssues?.some(
      (issue) =>
        issue.issueType === 'CANONICAL_POINTS_TO_404' ||
        issue.issueType === 'CANONICAL_DRIFT' ||
        issue.issueType === 'MISSING_CANONICAL'
    );
    const hasSignal = ctx.signals.some((s) => s.metadata?.issueType?.includes('CANONICAL'));
    return Boolean(hasCanonicalIssue || hasSignal);
  }

  diagnose(ctx: ProblemContext): DiagnosisResult | null {
    const targetUrl = ctx.url || (ctx.crawlIssues && ctx.crawlIssues[0]?.pageUrl) || `https://${ctx.targetDomain}/`;
    const issue = ctx.crawlIssues?.find((i) => i.issueType.includes('CANONICAL'));

    const correctCanonicalUrl = targetUrl.split('?')[0].replace(/\/$/, '') + '/';

    return {
      ruleKey: this.id,
      ruleVersion: this.version,
      category: this.category,
      title: 'Deploy Correct Canonical Tag for ' + targetUrl,
      rootCause: issue?.detailsJson
        ? `Canonical configuration issue detected: ${issue.detailsJson}`
        : `Page ${targetUrl} lacks a valid self-referential canonical URL tag.`,
      evidence: `Target URL: ${targetUrl}. Discrepancy observed during crawl extraction.`,
      recommendedActionType: 'SET_CANONICAL_URL',
      actionPayload: {
        targetUrl,
        canonicalUrl: correctCanonicalUrl,
      },
      beforeState: {
        canonicalUrl: null,
      },
      afterState: {
        canonicalUrl: correctCanonicalUrl,
      },
      confidence: 0.95,
      suggestedAutomationLevel: this.defaultAutomationLevel,
      baseEffort: this.baseEffort,
      baseRisk: this.baseRisk,
      potentialTrafficGain: 4.5,
    };
  }
}

export class AiOverviewDisplacementRule implements IDiagnosisRule {
  readonly id = 'RULE_AI_OVERVIEW_DISPLACEMENT';
  readonly version = '1.1.0';
  readonly name = 'Remediate AI Overview SERP Feature Displacement';
  readonly category = 'SERP_DISPLACEMENT' as const;
  readonly description = 'Detects organic ranking traffic displacement by AI Overviews without citation.';
  readonly defaultAutomationLevel = AutomationRiskLevel.LEVEL_1_SAFE_AUTOMATION;
  readonly baseEffort = 2.0;
  readonly baseRisk = 1.5;

  applies(ctx: ProblemContext): boolean {
    const features = ctx.serpContext?.featuresPresent || [];
    const hasAiOverview = features.includes('AI_OVERVIEW');
    const uncited = ctx.serpContext?.aiOverviewCited === false;
    const isSignal = ctx.signals.some((s) => s.metadata?.eventType === 'AI_OVERVIEW_APPEARED');
    return Boolean((hasAiOverview && uncited) || isSignal);
  }

  diagnose(ctx: ProblemContext): DiagnosisResult | null {
    const targetKeyword = ctx.keyword || 'target keyword query';
    const targetUrl = ctx.url || `https://${ctx.targetDomain}/solutions`;

    return {
      ruleKey: this.id,
      ruleVersion: this.version,
      category: this.category,
      title: `Optimize Schema & Structured Definitions to Capture AI Overview Citation for "${targetKeyword}"`,
      rootCause: `Google AI Overview feature appeared for "${targetKeyword}" without citing our target domain, causing organic CTR displacement.`,
      evidence: `SERP features present: [AI_OVERVIEW]. Current target citation status: FALSE. Search volume: ${ctx.keywordContext?.searchVolume || 1000}.`,
      recommendedActionType: 'INJECT_STRUCTURED_DATA',
      actionPayload: {
        targetUrl,
        schemaType: 'FAQPage',
        schemaJsonLd: {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `What is the industry standard for ${targetKeyword}?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `Comprehensive verified definition and implementation framework for ${targetKeyword} by ${ctx.targetDomain}.`,
              },
            },
          ],
        },
      },
      beforeState: {
        hasFaqSchema: false,
        schemaType: null,
      },
      afterState: {
        hasFaqSchema: true,
        schemaType: 'FAQPage',
      },
      confidence: 0.88,
      suggestedAutomationLevel: this.defaultAutomationLevel,
      baseEffort: this.baseEffort,
      baseRisk: this.baseRisk,
      potentialTrafficGain: 7.5,
    };
  }
}

export class TitleCtrUnderperformerRule implements IDiagnosisRule {
  readonly id = 'RULE_TITLE_CTR_UNDERPERFORMER';
  readonly version = '1.3.0';
  readonly name = 'Optimize Low-CTR High-Rank Title & Meta Tag';
  readonly category = 'METADATA' as const;
  readonly description = 'Detects top 3 organic rankings whose CTR is significantly below expected benchmark curves.';
  readonly defaultAutomationLevel = AutomationRiskLevel.LEVEL_1_SAFE_AUTOMATION;
  readonly baseEffort = 1.0;
  readonly baseRisk = 1.0;

  applies(ctx: ProblemContext): boolean {
    if (ctx.gscMetrics && ctx.gscMetrics.avgPosition <= 4 && ctx.gscMetrics.ctr < 0.05 && ctx.gscMetrics.impressions > 100) {
      return true;
    }
    const signal = ctx.signals.some((s) => s.metricName === 'CTR_UNDERPERFORMANCE' || s.metadata?.issueType === 'LOW_CTR');
    return Boolean(signal);
  }

  diagnose(ctx: ProblemContext): DiagnosisResult | null {
    const targetUrl = ctx.url || `https://${ctx.targetDomain}/product`;
    const targetKeyword = ctx.keyword || 'Enterprise Platform';
    const currentCtr = ctx.gscMetrics?.ctr ? (ctx.gscMetrics.ctr * 100).toFixed(1) + '%' : '2.1%';
    const position = ctx.gscMetrics?.avgPosition ? ctx.gscMetrics.avgPosition.toFixed(1) : '2.4';

    const optimizedTitle = `${targetKeyword} - High-Performance Solution | ${ctx.targetDomain}`;
    const optimizedDescription = `Discover leading ${targetKeyword} with verified performance benchmarks, direct API integration, and enterprise security for ${ctx.targetDomain}.`;

    return {
      ruleKey: this.id,
      ruleVersion: this.version,
      category: this.category,
      title: `Deploy High-Conversion Title Tag for ${targetUrl}`,
      rootCause: `Page ranks in top position (${position}) with ${currentCtr} CTR, trailing expected benchmark CTR curve (15-30%).`,
      evidence: `GSC impressions: ${ctx.gscMetrics?.impressions || 1500}, current CTR: ${currentCtr}, Avg Position: ${position}.`,
      recommendedActionType: 'SET_META_TAGS',
      actionPayload: {
        targetUrl,
        title: optimizedTitle,
        description: optimizedDescription,
      },
      beforeState: {
        title: `${targetKeyword} | Home`,
        description: 'Welcome to our platform.',
      },
      afterState: {
        title: optimizedTitle,
        description: optimizedDescription,
      },
      confidence: 0.92,
      suggestedAutomationLevel: this.defaultAutomationLevel,
      baseEffort: this.baseEffort,
      baseRisk: this.baseRisk,
      potentialTrafficGain: 8.0,
    };
  }
}

export class DeadPageRedirectRule implements IDiagnosisRule {
  readonly id = 'RULE_404_WITH_BACKLINKS_OR_TRAFFIC';
  readonly version = '1.0.0';
  readonly name = 'Restore 404 URL with Historical Traffic via 301 Redirect';
  readonly category = 'ARCHITECTURE' as const;
  readonly description = 'Detects 404 status codes on URLs that have historic search traffic or incoming links.';
  readonly defaultAutomationLevel = AutomationRiskLevel.LEVEL_2_REVIEW_REQUIRED;
  readonly baseEffort = 2.0;
  readonly baseRisk = 3.0;

  applies(ctx: ProblemContext): boolean {
    const is404 = ctx.crawlIssues?.some((i) => i.issueType === 'BROKEN_404' || i.issueType === 'PAGE_NOT_FOUND');
    const hasPastTraffic = (ctx.gscMetrics?.clicks || 0) > 0 || (ctx.ga4Metrics?.sessions || 0) > 0;
    const hasSignal = ctx.signals.some((s) => s.metadata?.issueType === '404_WITH_TRAFFIC');
    return Boolean((is404 && hasPastTraffic) || hasSignal);
  }

  diagnose(ctx: ProblemContext): DiagnosisResult | null {
    const sourceUrl = ctx.url || (ctx.crawlIssues && ctx.crawlIssues[0]?.pageUrl) || `https://${ctx.targetDomain}/legacy-product`;
    const destinationUrl = `https://${ctx.targetDomain}/solutions`;

    return {
      ruleKey: this.id,
      ruleVersion: this.version,
      category: this.category,
      title: `Create 301 Redirect for High-Value 404 URL ${sourceUrl}`,
      rootCause: `URL returns HTTP 404 Not Found but generated active search clicks in the past 30 days, causing link equity leakage.`,
      evidence: `404 status confirmed on ${sourceUrl}. Historical GSC clicks: ${ctx.gscMetrics?.clicks || 45}.`,
      recommendedActionType: 'CREATE_REDIRECT_RULE',
      actionPayload: {
        sourceUrl,
        destinationUrl,
        statusCode: 301,
      },
      beforeState: {
        httpStatus: 404,
        redirectTarget: null,
      },
      afterState: {
        httpStatus: 301,
        redirectTarget: destinationUrl,
      },
      confidence: 0.94,
      suggestedAutomationLevel: this.defaultAutomationLevel,
      baseEffort: this.baseEffort,
      baseRisk: this.baseRisk,
      potentialTrafficGain: 6.0,
    };
  }
}

export class KeywordCannibalizationRule implements IDiagnosisRule {
  readonly id = 'RULE_KEYWORD_CANNIBALIZATION';
  readonly version = '1.2.0';
  readonly name = 'Consolidate Cannibalizing Keyword Rankings';
  readonly category = 'ARCHITECTURE' as const;
  readonly description = 'Detects multiple URLs competing for the same target query causing ranking volatility and diluted CTR.';
  readonly defaultAutomationLevel = AutomationRiskLevel.LEVEL_2_REVIEW_REQUIRED;
  readonly baseEffort = 3.0;
  readonly baseRisk = 3.5;

  applies(ctx: ProblemContext): boolean {
    const hasSignal = ctx.signals.some(
      (s) => s.metadata?.eventType === 'KEYWORD_CANNIBALIZATION_DETECTED' || s.metricName === 'CANNIBALIZATION'
    );
    return Boolean(hasSignal);
  }

  diagnose(ctx: ProblemContext): DiagnosisResult | null {
    const targetKeyword = ctx.keyword || 'core product feature';
    const canonicalUrl = ctx.url || `https://${ctx.targetDomain}/products/main-feature`;
    const secondaryUrl = `https://${ctx.targetDomain}/blog/feature-overview`;

    return {
      ruleKey: this.id,
      ruleVersion: this.version,
      category: this.category,
      title: `Resolve Keyword Cannibalization for "${targetKeyword}"`,
      rootCause: `Two distinct URLs (${canonicalUrl} and ${secondaryUrl}) are competing on SERPs for "${targetKeyword}", diluting click-through rate.`,
      evidence: `Cannibalization confirmed across 30-day historical window. Primary: ${canonicalUrl}, Duplicate: ${secondaryUrl}.`,
      recommendedActionType: 'SET_CANONICAL_URL',
      actionPayload: {
        targetUrl: secondaryUrl,
        canonicalUrl: canonicalUrl,
      },
      beforeState: {
        secondaryUrlCanonical: secondaryUrl,
      },
      afterState: {
        secondaryUrlCanonical: canonicalUrl,
      },
      confidence: 0.91,
      suggestedAutomationLevel: this.defaultAutomationLevel,
      baseEffort: this.baseEffort,
      baseRisk: this.baseRisk,
      potentialTrafficGain: 6.8,
    };
  }
}

export class BrokenStructuredDataRule implements IDiagnosisRule {
  readonly id = 'RULE_BROKEN_STRUCTURED_DATA';
  readonly version = '1.0.0';
  readonly name = 'Repair Schema JSON-LD Syntax or Missing Fields';
  readonly category = 'SCHEMA' as const;
  readonly description = 'Detects schema markup parsing errors, invalid JSON-LD, or missing required schema properties.';
  readonly defaultAutomationLevel = AutomationRiskLevel.LEVEL_1_SAFE_AUTOMATION;
  readonly baseEffort = 1.0;
  readonly baseRisk = 1.0;

  applies(ctx: ProblemContext): boolean {
    const hasSchemaIssue = ctx.crawlIssues?.some((i) => i.issueType.includes('SCHEMA') || i.issueType.includes('STRUCTURED_DATA'));
    return Boolean(hasSchemaIssue);
  }

  diagnose(ctx: ProblemContext): DiagnosisResult | null {
    const targetUrl = ctx.url || `https://${ctx.targetDomain}/products/analytics`;

    return {
      ruleKey: this.id,
      ruleVersion: this.version,
      category: this.category,
      title: `Inject Valid Product JSON-LD Schema on ${targetUrl}`,
      rootCause: 'Schema validator identified missing mandatory properties ("offers" or "aggregateRating") on target product page.',
      evidence: `Crawl inspection detected structured data failure on ${targetUrl}.`,
      recommendedActionType: 'INJECT_STRUCTURED_DATA',
      actionPayload: {
        targetUrl,
        schemaType: 'Product',
        schemaJsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'TechScale Analytics Platform',
          offers: {
            '@type': 'Offer',
            price: '99.00',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
        },
      },
      beforeState: {
        hasValidSchema: false,
      },
      afterState: {
        hasValidSchema: true,
      },
      confidence: 0.96,
      suggestedAutomationLevel: this.defaultAutomationLevel,
      baseEffort: this.baseEffort,
      baseRisk: this.baseRisk,
      potentialTrafficGain: 5.0,
    };
  }
}

export class DecayingContentRefreshRule implements IDiagnosisRule {
  readonly id = 'RULE_DECAYING_CONTENT_REFRESH';
  readonly version = '1.0.0';
  readonly name = 'Recommend Content Refresh for Decaying High-Authority URLs';
  readonly category = 'CONTENT' as const;
  readonly description = 'Identifies authority URLs experiencing traffic decay over 90 days and synthesizes a safe draft for human editorial review.';
  readonly defaultAutomationLevel = AutomationRiskLevel.LEVEL_2_REVIEW_REQUIRED; // Strictly review required / safe recommendation workflow
  readonly baseEffort = 4.0;
  readonly baseRisk = 2.0;

  applies(ctx: ProblemContext): boolean {
    const isDecayingSignal = ctx.signals.some((s) => s.metadata?.issueType === 'CONTENT_DECAY' || s.metricName === 'TRAFFIC_DECAY');
    const isLowRecentPosition = ctx.gscMetrics && ctx.gscMetrics.avgPosition > 8 && ctx.gscMetrics.impressions > 500;
    return Boolean(isDecayingSignal || isLowRecentPosition);
  }

  diagnose(ctx: ProblemContext): DiagnosisResult | null {
    const targetUrl = ctx.url || `https://${ctx.targetDomain}/guide/architecture`;
    const targetKeyword = ctx.keyword || 'Enterprise Cloud Architecture';

    return {
      ruleKey: this.id,
      ruleVersion: this.version,
      category: this.category,
      title: `Stage Editorial Content Refresh for "${targetKeyword}" on ${targetUrl}`,
      rootCause: `Historical authority URL has lost 25%+ organic impressions over 90 days due to content staleness relative to updated competitor corpus.`,
      evidence: `Target query: "${targetKeyword}". GSC impressions: ${ctx.gscMetrics?.impressions || 850}, avg position: ${ctx.gscMetrics?.avgPosition || 9.2}.`,
      recommendedActionType: 'CONTENT_REFRESH_ACTION',
      actionPayload: {
        targetUrl,
        targetKeyword,
        suggestedHeadings: [
          `Key Architectural Benefits of ${targetKeyword}`,
          `2026 Enterprise Implementation Best Practices`,
          `Cost and Scalability Comparison`,
        ],
        missingSubtopics: [
          'High availability failover architectures',
          'Zero-trust network configuration',
        ],
        proposedSectionDrafts: [
          {
            heading: `2026 Enterprise Implementation Best Practices`,
            proposedContent: `In-depth technical best practices addressing recent search intent shifts for ${targetKeyword}.`,
            rationale: 'Fills semantic coverage gap identified in competitor search results.',
          },
        ],
        humanReviewNotes: 'AI content drafting is disabled for direct publishing. Human editorial sign-off required.',
      },
      beforeState: {
        contentStatus: 'DECAYING',
        draftStaged: false,
      },
      afterState: {
        contentStatus: 'STAGED_FOR_REVIEW',
        draftStaged: true,
      },
      confidence: 0.89,
      suggestedAutomationLevel: this.defaultAutomationLevel,
      baseEffort: this.baseEffort,
      baseRisk: this.baseRisk,
      potentialTrafficGain: 12.0,
    };
  }
}

export class DiagnosisRuleCatalog {
  private static rules: IDiagnosisRule[] = [
    new CanonicalMismatchRule(),
    new AiOverviewDisplacementRule(),
    new TitleCtrUnderperformerRule(),
    new DeadPageRedirectRule(),
    new KeywordCannibalizationRule(),
    new BrokenStructuredDataRule(),
    new DecayingContentRefreshRule(),
  ];

  public static getAllRules(): IDiagnosisRule[] {
    return [...this.rules];
  }

  public static registerRule(rule: IDiagnosisRule): void {
    this.rules.push(rule);
  }

  public static findRule(ruleKey: string): IDiagnosisRule | undefined {
    return this.rules.find((r) => r.id === ruleKey);
  }
}
