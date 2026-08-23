import { ProblemContext, DiagnosisResult, ScoredOpportunity } from './decisionTypes';
import { DiagnosisRuleCatalog } from './rules/diagnosisRuleCatalog';
import { OpportunityScoreEngine } from './opportunityScoreEngine';
import { ActionStatus } from '@prisma/client';

export class DiagnosisEngine {
  /**
   * Evaluates problem contexts against the rule catalog and produces prioritized ScoredOpportunities.
   */
  public static evaluateContexts(contexts: ProblemContext[]): ScoredOpportunity[] {
    const rules = DiagnosisRuleCatalog.getAllRules();
    const scoredOpportunities: ScoredOpportunity[] = [];

    for (const ctx of contexts) {
      for (const rule of rules) {
        if (rule.applies(ctx)) {
          const diagnosis: DiagnosisResult | null = rule.diagnose(ctx);
          if (diagnosis) {
            // Calculate Opportunity Score
            const businessValueTier = ctx.keywordContext?.businessValue;
            const scoring = OpportunityScoreEngine.calculateScore({
              potentialTrafficGain: diagnosis.potentialTrafficGain,
              businessValueTier,
              confidenceScore: diagnosis.confidence,
              effortScore: diagnosis.baseEffort,
              riskScore: diagnosis.baseRisk,
            });

            const oppId = `opp-${rule.id.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

            scoredOpportunities.push({
              id: oppId,
              websiteId: ctx.websiteId,
              diagnosis,
              scoring,
              targetUrl: ctx.url,
              targetKeyword: ctx.keyword,
              automationLevel: diagnosis.suggestedAutomationLevel,
              status: ActionStatus.RECOMMENDED,
              evidenceBundle: {
                signalsCount: ctx.signals.length,
                crawlIssues: ctx.crawlIssues,
                gscMetrics: ctx.gscMetrics,
                serpContext: ctx.serpContext,
                keywordContext: ctx.keywordContext,
              },
              createdAt: new Date(),
            });
          }
        }
      }
    }

    // Sort by Opportunity Score descending (P0 Critical first)
    return scoredOpportunities.sort((a, b) => b.scoring.score - a.scoring.score);
  }
}
