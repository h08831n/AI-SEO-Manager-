/**
 * Phase A: Decision Evaluation Service
 * 
 * Central authoritative service for evaluating SEO signals, diagnosing opportunities,
 * resolving contextual Bayesian policy weights, and synthesizing actionable recommendations.
 */

import { prisma } from '../../db/prisma';
import { SignalAggregatorService } from './signalAggregator';
import { DiagnosisEngine } from './diagnosisEngine';
import { RecommendationSynthesizer } from './recommendationSynthesizer';
import { DiagnosisRuleCatalog } from './rules/diagnosisRuleCatalog';
import { RuleWeightResolver } from '../bayesian/ruleWeightResolver';
import { ProblemContext, ScoredOpportunity } from './decisionTypes';
import { OutboxDispatcher } from '../outbox/outboxDispatcher';

export interface DecisionEvaluationOptions {
  websiteId: string;
  contexts?: ProblemContext[];
  targetUrl?: string;
  targetKeyword?: string;
  cmsProvider?: string;
  pageArchetype?: string;
  persist?: boolean;
  correlationId?: string;
}

export interface DecisionEvaluationResult {
  status: 'COMPLETED' | 'EMPTY';
  websiteId: string;
  evaluatedContextsCount: number;
  opportunitiesCount: number;
  bayesianWeightsApplied: Record<string, number>;
  persisted?: {
    recommendationsCount: number;
    tasksCount: number;
    items: Array<{ recommendationId: string; taskId: string; title: string; score: number }>;
  };
  topOpportunities: ScoredOpportunity[];
  correlationId?: string;
}

export class DecisionEvaluationService {
  /**
   * Authoritative decision evaluation executing the closed loop:
   * Signals -> Contexts -> Contextual Bayesian Weights -> Diagnoses -> Scored Opportunities -> Recommendations
   */
  public static async evaluateDecisions(options: DecisionEvaluationOptions): Promise<DecisionEvaluationResult> {
    const {
      websiteId,
      contexts: inputContexts,
      targetUrl,
      targetKeyword,
      cmsProvider = 'ALL',
      pageArchetype = 'ALL',
      persist = true,
      correlationId = `dec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    } = options;

    // 1. Gather or aggregate problem contexts
    let contexts: ProblemContext[] = [];
    if (inputContexts && inputContexts.length > 0) {
      contexts = inputContexts;
    } else {
      contexts = await SignalAggregatorService.aggregateProblemContexts(websiteId);
    }

    if (targetUrl) {
      contexts = contexts.filter((c) => c.url === targetUrl);
    }
    if (targetKeyword) {
      contexts = contexts.filter((c) => c.keyword === targetKeyword);
    }

    if (contexts.length === 0) {
      return {
        status: 'EMPTY',
        websiteId,
        evaluatedContextsCount: 0,
        opportunitiesCount: 0,
        bayesianWeightsApplied: {},
        topOpportunities: [],
        correlationId,
      };
    }

    // 2. Resolve contextual Bayesian rule weights for all active rules
    const allRules = DiagnosisRuleCatalog.getAllRules();
    const ruleKeys = allRules.map((r) => r.id);
    const resolvedWeights = await RuleWeightResolver.resolveWeightsForRules(
      websiteId,
      ruleKeys,
      cmsProvider,
      pageArchetype
    );

    // 3. Diagnose problem contexts into scored opportunities using resolved Bayesian weights
    const opportunities = DiagnosisEngine.evaluateContexts(contexts, {
      ruleWeights: resolvedWeights,
    });

    // 4. Optionally synthesize and persist recommendations and tasks
    let persistedResult: any = undefined;
    if (persist && opportunities.length > 0) {
      persistedResult = await RecommendationSynthesizer.synthesizeAndPersist(websiteId, opportunities);

      // Emit outbox event for audit and downstream scheduling
      try {
        await OutboxDispatcher.recordEvent({
          aggregateType: 'DecisionEvaluation',
          aggregateId: websiteId,
          eventType: 'DECISION_EVALUATION_COMPLETED',
          payload: {
            websiteId,
            evaluatedContextsCount: contexts.length,
            opportunitiesCount: opportunities.length,
            correlationId,
            timestamp: new Date().toISOString(),
          },
        });
      } catch {
        // Outbox failure logged
      }
    }

    return {
      status: 'COMPLETED',
      websiteId,
      evaluatedContextsCount: contexts.length,
      opportunitiesCount: opportunities.length,
      bayesianWeightsApplied: resolvedWeights,
      persisted: persistedResult,
      topOpportunities: opportunities.slice(0, 15),
      correlationId,
    };
  }
}
