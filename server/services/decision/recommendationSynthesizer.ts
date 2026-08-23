import { prisma } from '../../db/prisma';
import { ScoredOpportunity } from './decisionTypes';
import { ActionStatus } from '@prisma/client';

export class RecommendationSynthesizer {
  /**
   * Persists scored opportunities into the database as SeoRecommendation and SeoTask models.
   */
  public static async synthesizeAndPersist(websiteId: string, opportunities: ScoredOpportunity[]): Promise<{
    recommendationsCount: number;
    tasksCount: number;
    items: Array<{ recommendationId: string; taskId: string; title: string; score: number }>;
  }> {
    const results = [];

    for (const opp of opportunities) {
      const { diagnosis, scoring, targetUrl, targetKeyword } = opp;
      const idempotencyKey = `task-${websiteId}-${diagnosis.ruleKey}-${targetUrl || targetKeyword || 'global'}`;

      // 1. Upsert SeoRecommendation
      const recommendation = await prisma.seoRecommendation.create({
        data: {
          websiteId,
          title: diagnosis.title,
          category: diagnosis.category,
          actionType: diagnosis.recommendedActionType,
          evidence: diagnosis.evidence,
          source: `RuleEngine:${diagnosis.ruleKey}`,
          ruleKey: diagnosis.ruleKey,
          ruleVersion: diagnosis.ruleVersion,
          confidenceScore: scoring.confidenceScore,
          impactScore: Math.round(scoring.potentialTrafficGain),
          effortScore: Math.round(scoring.effortWeight),
          riskScore: Math.round(scoring.riskWeight),
          businessValue: Math.round(scoring.businessValueWeight),
          automationLevel: opp.automationLevel,
          status: ActionStatus.RECOMMENDED,
        },
      });

      // 2. Check if a task with this idempotency key already exists
      let task = await prisma.seoTask.findFirst({
        where: { idempotencyKey },
      });

      if (!task) {
        task = await prisma.seoTask.create({
          data: {
            websiteId,
            recommendationId: recommendation.id,
            title: diagnosis.title,
            category: diagnosis.category,
            priority: scoring.priority.replace('_', ' ').split(' ')[0], // P0, P1, P2, P3
            opportunityScore: scoring.score,
            automationLevel: opp.automationLevel,
            status: ActionStatus.RECOMMENDED,
            reason: diagnosis.rootCause,
            evidence: diagnosis.evidence,
            affectedUrls: targetUrl ? [targetUrl] : [],
            actionType: diagnosis.recommendedActionType,
            actionPayloadJson: JSON.stringify(diagnosis.actionPayload),
            beforeStateJson: JSON.stringify(diagnosis.beforeState),
            afterStateJson: JSON.stringify(diagnosis.afterState),
            idempotencyKey,
          },
        });
      }

      results.push({
        recommendationId: recommendation.id,
        taskId: task.id,
        title: recommendation.title,
        score: scoring.score,
      });
    }

    return {
      recommendationsCount: results.length,
      tasksCount: results.length,
      items: results,
    };
  }
}
