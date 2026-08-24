/**
 * Phase 6.2 Bayesian Recalibration Worker
 * 
 * Scheduled / on-demand worker service that runs periodic Bayesian rule weight
 * recalibration across active websites.
 */

import { prisma } from '../../db/prisma';
import { BayesianRuleLearningEngine, RecalibrationSummary } from '../bayesian/bayesianRuleLearningEngine';

export class BayesianRecalibrationWorker {
  private static isRunning = false;

  /**
   * Executes a recalibration run for all active websites with completed attribution facts.
   */
  public static async executeRecalibrationSweep(options?: { now?: Date }): Promise<RecalibrationSummary[]> {
    if (this.isRunning) {
      return [];
    }

    this.isRunning = true;
    try {
      const websites = await prisma.website.findMany({
        select: { id: true },
      });

      const summaries: RecalibrationSummary[] = [];

      for (const site of websites) {
        const summary = await BayesianRuleLearningEngine.recalibrateRuleWeights(site.id, options);
        if (summary.totalRuleStatesUpdated > 0) {
          summaries.push(summary);
        }
      }

      return summaries;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Recalibrates a single website immediately.
   */
  public static async recalibrateWebsite(websiteId: string, options?: { now?: Date }): Promise<RecalibrationSummary> {
    return BayesianRuleLearningEngine.recalibrateRuleWeights(websiteId, options);
  }
}
