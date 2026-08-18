import { describe, it, expect } from 'vitest';
import { VersionedOpportunityScorer } from '../server/domain/scoring/opportunityScorer';
import { VersionedRuleEngine } from '../server/domain/rules/ruleEngine';

describe('Rule & Scoring Engine Versioning and Determinism', () => {
  it('Opportunity Scorer produces deterministic outputs with explicit version metadata', () => {
    const input = {
      searchVolume: 8500,
      currentPosition: 5.4,
      businessRelevance: 8,
      conversionPotential: 9,
      strategicImportance: 8,
      confidence: 0.95,
      effort: 2,
      risk: 1,
    };

    const run1 = VersionedOpportunityScorer.calculateScore(input);
    const run2 = VersionedOpportunityScorer.calculateScore(input);

    expect(run1.scoreVersion).toBe('1.0.0');
    expect(run1.provenance).toBe('CALCULATED');
    expect(run1.totalOpportunityScore).toBe(run2.totalOpportunityScore);
    expect(run1.subScores).toEqual(run2.subScores);
  });

  it('Rule Engine returns registered rules with explicit versions and severities', () => {
    expect(VersionedRuleEngine.VERSION).toBe('1.0.0');
    const rules = VersionedRuleEngine.getRegisteredRules();

    expect(rules.length).toBeGreaterThan(0);
    const h1Rule = rules.find((r) => r.ruleKey === 'RULE_SINGLE_H1_HEADING');
    expect(h1Rule).toBeDefined();
    expect(h1Rule?.version).toBe('1.0.0');
    expect(h1Rule?.severity).toBe('MEDIUM');
  });
});
