import { describe, it, expect } from 'vitest';
import { VersionedOpportunityScorer } from '../server/domain/scoring/opportunityScorer';
import { VersionedRuleEngine } from '../server/domain/rules/ruleEngine';
import { CrawlUrlResponse } from '../src/shared/contracts';

describe('VersionedOpportunityScorer', () => {
  it('calculates deterministic scores for striking distance keywords', () => {
    const result = VersionedOpportunityScorer.calculateScore({
      searchVolume: 12000,
      currentPosition: 6.5,
      businessRelevance: 9,
      conversionPotential: 8,
      strategicImportance: 9,
      confidence: 0.9,
      effort: 2,
      risk: 1,
    });

    expect(result.scoreVersion).toBe('1.0.0');
    expect(result.provenance).toBe('CALCULATED');
    expect(result.totalOpportunityScore).toBeGreaterThan(0);
    expect(result.totalOpportunityScore).toBeLessThanOrEqual(100);
    expect(result.subScores.rankingProbability).toBe(1.0);
  });

  it('produces identical scores for identical inputs (determinism)', () => {
    const input = {
      searchVolume: 5000,
      currentPosition: 12.0,
      businessRelevance: 7,
      conversionPotential: 6,
      strategicImportance: 8,
      confidence: 0.85,
      effort: 3,
      risk: 1,
    };

    const res1 = VersionedOpportunityScorer.calculateScore(input);
    const res2 = VersionedOpportunityScorer.calculateScore(input);

    expect(res1.totalOpportunityScore).toBe(res2.totalOpportunityScore);
    expect(res1.subScores).toEqual(res2.subScores);
  });
});

describe('VersionedRuleEngine', () => {
  it('detects missing single H1 heading issues', () => {
    const mockCrawlData: CrawlUrlResponse = {
      status: 'SUCCESS',
      requestedUrl: 'https://example.com/blog',
      finalUrl: 'https://example.com/blog',
      redirectCount: 0,
      statusCode: 200,
      loadTimeMs: 240,
      isIndexable: true,
      canonicalUrl: 'https://example.com/blog',
      canonicalMatch: true,
      title: 'Example Blog Post Title That Has Sufficient Length',
      titleLength: 52,
      metaDescription: 'A valid meta description with appropriate length to pass the standard validation check.',
      metaDescLength: 88,
      metaRobots: 'index, follow',
      xRobotsTag: null,
      h1Tags: [], // Missing H1
      h2Count: 4,
      wordCount: 1200,
      internalInlinks: 'DATA_UNAVAILABLE',
      internalOutlinksCount: 12,
      externalOutlinksCount: 3,
      imagesCount: 2,
      missingAltCount: 0,
      schemaTypes: ['Article'],
      provenance: 'MEASURED_REAL',
      crawledAt: new Date().toISOString(),
      issues: [],
    };

    const evaluatedIssues = VersionedRuleEngine.evaluateAllRules(mockCrawlData);
    const h1Issue = evaluatedIssues.find((i) => i.type === 'RULE_SINGLE_H1_HEADING');

    expect(h1Issue).toBeDefined();
    expect(h1Issue?.severity).toBe('MEDIUM');
  });

  it('passes cleanly when all critical technical factors are valid', () => {
    const validCrawlData: CrawlUrlResponse = {
      status: 'SUCCESS',
      requestedUrl: 'https://example.com/perfect-page',
      finalUrl: 'https://example.com/perfect-page',
      redirectCount: 0,
      statusCode: 200,
      loadTimeMs: 180,
      isIndexable: true,
      canonicalUrl: 'https://example.com/perfect-page',
      canonicalMatch: true,
      title: 'Valid Optimized Title for Commercial Landing Page',
      titleLength: 51,
      metaDescription: 'A comprehensive and concise description describing the product capabilities and pricing tiers accurately.',
      metaDescLength: 108,
      metaRobots: 'index, follow',
      xRobotsTag: null,
      h1Tags: ['Optimized Single Primary Headline'],
      h2Count: 3,
      wordCount: 1500,
      internalInlinks: 'DATA_UNAVAILABLE',
      internalOutlinksCount: 10,
      externalOutlinksCount: 2,
      imagesCount: 3,
      missingAltCount: 0,
      schemaTypes: ['Product'],
      provenance: 'MEASURED_REAL',
      crawledAt: new Date().toISOString(),
      issues: [],
    };

    const evaluatedIssues = VersionedRuleEngine.evaluateAllRules(validCrawlData);
    expect(evaluatedIssues.length).toBe(0);
  });
});
