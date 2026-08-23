import { AutomationRiskLevel } from '@prisma/client';
import { prisma } from '../../db/prisma';

export interface GovernanceCheckResult {
  allowed: boolean;
  requiresManualApproval: boolean;
  gracePeriodSeconds?: number;
  circuitBreakerTripped: boolean;
  dailyQuotaRemaining: number;
  reason?: string;
}

export class GovernanceEngine {
  private static readonly MAX_DAILY_AUTONOMOUS_ACTIONS = 25;
  private static readonly CIRCUIT_BREAKER_ROLLBACK_THRESHOLD_PCT = 0.10; // 10%

  /**
   * Evaluates governance rules before executing an action.
   */
  public static async evaluateExecutionGovernance(params: {
    websiteId: string;
    actionType: string;
    automationLevel: AutomationRiskLevel;
    isManualTrigger?: boolean;
    userRole?: string;
  }): Promise<GovernanceCheckResult> {
    const { websiteId, automationLevel, isManualTrigger = false, userRole } = params;

    // 1. If manually triggered by authorized user (OWNER, ADMIN, EDITOR, SEO_MANAGER)
    if (isManualTrigger) {
      return {
        allowed: true,
        requiresManualApproval: false,
        circuitBreakerTripped: false,
        dailyQuotaRemaining: this.MAX_DAILY_AUTONOMOUS_ACTIONS,
      };
    }

    // 2. Check 24-hour Blast Radius Quota
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentExecutionsCount = await prisma.actionExecution.count({
      where: {
        websiteId,
        createdAt: { gte: oneDayAgo },
        state: { notIn: ['RECOMMENDED', 'BLOCKED'] },
      },
    });

    const quotaRemaining = Math.max(0, this.MAX_DAILY_AUTONOMOUS_ACTIONS - recentExecutionsCount);

    if (quotaRemaining <= 0) {
      return {
        allowed: false,
        requiresManualApproval: true,
        circuitBreakerTripped: false,
        dailyQuotaRemaining: 0,
        reason: `Daily blast radius limit (${this.MAX_DAILY_AUTONOMOUS_ACTIONS} actions/day) reached. Manual approval required.`,
      };
    }

    // 3. Check 7-Day Rollback Rate Circuit Breaker
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const executions7d = await prisma.actionExecution.findMany({
      where: {
        websiteId,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const total7d = executions7d.length;
    const rollbacks7d = executions7d.filter((e) => e.rollbackExecutionId || e.state === 'REVERTED_RESTORED').length;
    const rollbackRate = total7d > 0 ? rollbacks7d / total7d : 0;

    const circuitBreakerTripped = total7d >= 5 && rollbackRate > this.CIRCUIT_BREAKER_ROLLBACK_THRESHOLD_PCT;

    if (circuitBreakerTripped) {
      return {
        allowed: false,
        requiresManualApproval: true,
        circuitBreakerTripped: true,
        dailyQuotaRemaining: quotaRemaining,
        reason: `Circuit Breaker Tripped: 7-day rollback rate is ${(rollbackRate * 100).toFixed(1)}% (exceeds 10% safety threshold). Autonomous actions downgraded to Manual Review.`,
      };
    }

    // 4. Automation Risk Level Rules
    switch (automationLevel) {
      case AutomationRiskLevel.LEVEL_0_SUGGESTION_ONLY:
      case AutomationRiskLevel.LEVEL_3_HIGH_RISK_MANUAL_ONLY:
        return {
          allowed: false,
          requiresManualApproval: true,
          circuitBreakerTripped: false,
          dailyQuotaRemaining: quotaRemaining,
          reason: 'Automation level requires explicit manual approval.',
        };

      case AutomationRiskLevel.LEVEL_2_REVIEW_REQUIRED:
        return {
          allowed: true,
          requiresManualApproval: false,
          gracePeriodSeconds: 86400, // 24-hour grace period
          circuitBreakerTripped: false,
          dailyQuotaRemaining: quotaRemaining,
          reason: 'Autonomous execution scheduled after 24-hour grace period.',
        };

      case AutomationRiskLevel.LEVEL_1_SAFE_AUTOMATION:
      default:
        return {
          allowed: true,
          requiresManualApproval: false,
          circuitBreakerTripped: false,
          dailyQuotaRemaining: quotaRemaining,
          reason: 'Safe low-risk automation permitted.',
        };
    }
  }
}
