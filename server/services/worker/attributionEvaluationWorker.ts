import { ActionStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { CausalAttributionEngine, AttributionEvaluationResult } from '../attribution/causalAttributionEngine';

export class AttributionEvaluationWorker {
  /**
   * Processes an attribution evaluation job for a single execution.
   */
  public static async evaluateSingleExecution(
    actionExecutionId: string,
    horizonDays: number = 30
  ): Promise<AttributionEvaluationResult> {
    return await CausalAttributionEngine.evaluateActionExecution(actionExecutionId, horizonDays);
  }

  /**
   * Scans for action executions that have matured (passed the 14-day or 45-day lag horizon)
   * and runs causal attribution evaluations.
   */
  public static async batchEvaluateMatureExecutions(
    websiteId?: string
  ): Promise<{ evaluatedCount: number; results: AttributionEvaluationResult[] }> {
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Find executions older than 14 days
    const executions = await prisma.actionExecution.findMany({
      where: {
        ...(websiteId ? { websiteId } : {}),
        executedAt: { lte: fourteenDaysAgo },
        state: ActionStatus.VERIFIED_COMPLETED,
      },
    });

    const results: AttributionEvaluationResult[] = [];

    for (const exec of executions) {
      const existingFact = await prisma.actionAttributionFact.findFirst({
        where: { actionExecutionId: exec.id },
        orderBy: { evaluationEndDate: 'desc' },
      });

      // Evaluate if not yet evaluated, or if mature (45+ days) and previous evaluation was early (< 30d)
      const needsEvaluation =
        !existingFact ||
        (now.getTime() - new Date(exec.executedAt || exec.createdAt).getTime() >= 45 * 24 * 60 * 60 * 1000 &&
          new Date(existingFact.evaluationEndDate).getTime() < now.getTime() - 15 * 24 * 60 * 60 * 1000);

      if (needsEvaluation) {
        try {
          const res = await CausalAttributionEngine.evaluateActionExecution(exec.id, 30);
          results.push(res);
        } catch (err) {
          console.error(`[AttributionEvaluationWorker] Failed evaluation for execution ${exec.id}:`, err);
        }
      }
    }

    return {
      evaluatedCount: results.length,
      results,
    };
  }

  /**
   * Event-driven consumer hook to handle outbox events reactively.
   */
  public static async handleEvent(eventType: string, payload: any): Promise<void> {
    if (eventType === 'ATTRIBUTION_EVALUATION_REQUESTED') {
      const { actionExecutionId, websiteId, horizonDays } = payload;
      if (actionExecutionId) {
        await this.evaluateSingleExecution(actionExecutionId, horizonDays || 30);
      } else if (websiteId) {
        await this.batchEvaluateMatureExecutions(websiteId);
      }
    } else if (eventType === 'GSC_SYNC_COMPLETED') {
      // When new GSC performance facts arrive, re-check mature executions
      const { websiteId } = payload;
      if (websiteId) {
        await this.batchEvaluateMatureExecutions(websiteId);
      }
    }
  }
}
