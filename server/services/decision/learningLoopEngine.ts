import { prisma } from '../../db/prisma';
import { RuleLearningProfile } from './decisionTypes';
import { ActionStatus } from '@prisma/client';

export class LearningLoopEngine {
  private static learningStore: Map<string, RuleLearningProfile> = new Map();

  /**
   * Records the outcome of an action execution for learning calibration.
   */
  public static async recordActionOutcome(params: {
    ruleKey: string;
    websiteId: string;
    outcome: 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';
    metricDeltaPct?: number;
  }): Promise<RuleLearningProfile> {
    const { ruleKey, outcome, websiteId } = params;

    let profile = this.learningStore.get(ruleKey);
    if (!profile) {
      profile = {
        ruleKey,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        rolledBackExecutions: 0,
        effectivenessRate: 1.0,
        calibratedConfidence: 0.9,
        lastCalibratedAt: new Date(),
      };
      this.learningStore.set(ruleKey, profile);
    }

    profile.totalExecutions += 1;
    if (outcome === 'SUCCESS') {
      profile.successfulExecutions += 1;
    } else if (outcome === 'FAILED') {
      profile.failedExecutions += 1;
    } else if (outcome === 'ROLLED_BACK') {
      profile.rolledBackExecutions += 1;
    }

    // Recalculate Effectiveness Rate
    profile.effectivenessRate = Number(
      (profile.successfulExecutions / Math.max(1, profile.totalExecutions)).toFixed(3)
    );

    // Calibrate Confidence: decay if rollbacks occur, boost if consistently positive
    let baseConfidence = 0.85;
    const successRatio = profile.successfulExecutions / profile.totalExecutions;
    const rollbackRatio = profile.rolledBackExecutions / profile.totalExecutions;

    baseConfidence = baseConfidence * successRatio - rollbackRatio * 0.3;
    profile.calibratedConfidence = Number(Math.min(0.99, Math.max(0.3, baseConfidence)).toFixed(2));
    profile.lastCalibratedAt = new Date();

    // Emit outbox event for learning calibration audit
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'DECISION_ENGINE',
        aggregateId: ruleKey,
        eventType: 'RULE_CONFIDENCE_CALIBRATED',
        payloadJson: JSON.stringify({
          ruleKey,
          websiteId,
          outcome,
          metricDeltaPct: params.metricDeltaPct,
          profile,
        }),
      },
    });

    return profile;
  }

  /**
   * Retrieves the dynamic learning profile for a rule.
   */
  public static getRuleProfile(ruleKey: string): RuleLearningProfile {
    return (
      this.learningStore.get(ruleKey) || {
        ruleKey,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        rolledBackExecutions: 0,
        effectivenessRate: 1.0,
        calibratedConfidence: 0.9,
        lastCalibratedAt: new Date(),
      }
    );
  }

  /**
   * Returns all active rule learning profiles.
   */
  public static getAllProfiles(): RuleLearningProfile[] {
    return Array.from(this.learningStore.values());
  }
}
