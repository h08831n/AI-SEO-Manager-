import { prisma } from '../../db/prisma';
import { ActionStatus } from '@prisma/client';
import { VerificationCheckResult } from './actionTypes';
import { CanonicalActionExecutor } from './executors/canonicalActionExecutor';
import { MetaTagsActionExecutor } from './executors/metaTagsActionExecutor';
import { StructuredDataActionExecutor } from './executors/structuredDataActionExecutor';
import { RedirectActionExecutor } from './executors/redirectActionExecutor';
import { InternalLinkActionExecutor } from './executors/internalLinkActionExecutor';
import { LearningLoopEngine } from '../decision/learningLoopEngine';

export class VerificationEngine {
  /**
   * Executes Tier 1 Immediate Synthetic Verification (T + 60 seconds).
   * Verifies that the deployed tag/directive is live and matching expected state.
   */
  public static async runTier1ImmediateVerification(params: {
    actionExecutionId: string;
    websiteId: string;
    actionType: string;
    targetUrl: string;
    expectedState: Record<string, any>;
    ruleKey?: string;
  }): Promise<VerificationCheckResult> {
    const { actionExecutionId, actionType, targetUrl, expectedState, ruleKey, websiteId } = params;

    let observedData: Record<string, any> = {};
    let passed = false;
    let varianceDetails: string | undefined;

    switch (actionType) {
      case 'SET_CANONICAL_URL': {
        const deployed = CanonicalActionExecutor.getDeployedCanonical(targetUrl);
        observedData = { canonicalUrl: deployed };
        passed = deployed === expectedState.canonicalUrl;
        if (!passed) {
          varianceDetails = `Expected canonical "${expectedState.canonicalUrl}", but observed "${deployed || '<none>'}"`;
        }
        break;
      }

      case 'SET_META_TAGS': {
        const meta = MetaTagsActionExecutor.getDeployedMeta(targetUrl);
        observedData = meta || {};
        const titleMatch = expectedState.title ? meta?.title === expectedState.title : true;
        const descMatch = expectedState.description ? meta?.description === expectedState.description : true;
        passed = Boolean(meta && titleMatch && descMatch);
        if (!passed) {
          varianceDetails = `Meta tags mismatch: expected title="${expectedState.title}", observed="${meta?.title}"`;
        }
        break;
      }

      case 'INJECT_STRUCTURED_DATA': {
        const schemas = StructuredDataActionExecutor.getDeployedSchemas(targetUrl);
        observedData = { schemasCount: schemas.length, schemas };
        passed = schemas.length > 0;
        if (!passed) {
          varianceDetails = 'No structured data schemas found deployed on target URL';
        }
        break;
      }

      case 'CREATE_REDIRECT_RULE': {
        const redirect = RedirectActionExecutor.getDeployedRedirect(targetUrl);
        observedData = redirect || {};
        passed = Boolean(redirect && redirect.destinationUrl === expectedState.destinationUrl);
        if (!passed) {
          varianceDetails = `Redirect mismatch: expected destination "${expectedState.destinationUrl}", observed "${redirect?.destinationUrl}"`;
        }
        break;
      }

      case 'INJECT_INTERNAL_LINK': {
        const links = InternalLinkActionExecutor.getDeployedLinks(targetUrl);
        observedData = { linksCount: links.length, links };
        passed = links.length > 0;
        break;
      }

      default:
        observedData = { defaultCheck: 'PASSED' };
        passed = true;
    }

    const requiresRollback = !passed;
    const finalStatus = passed ? ActionStatus.VERIFIED_COMPLETED : ActionStatus.FAILED;

    // 1. Record ActionVerification entity in DB
    await prisma.actionVerification.create({
      data: {
        actionExecutionId,
        status: finalStatus,
        expectedStateJson: JSON.stringify(expectedState),
        observedStateJson: JSON.stringify(observedData),
        isMatch: passed,
        varianceNotes: varianceDetails,
        verifiedAt: new Date(),
      },
    });

    // 2. Update ActionExecution state
    await prisma.actionExecution.update({
      where: { id: actionExecutionId },
      data: {
        state: finalStatus,
        verifiedAt: new Date(),
        afterEvidenceJson: JSON.stringify(observedData),
        failureReason: varianceDetails,
      },
    });

    // 3. Update Rule Learning Loop
    if (ruleKey) {
      await LearningLoopEngine.recordActionOutcome({
        ruleKey,
        websiteId,
        outcome: passed ? 'SUCCESS' : 'FAILED',
      });
    }

    return {
      tier: 'TIER_1_IMMEDIATE',
      passed,
      status: finalStatus,
      observedData,
      expectedData: expectedState,
      varianceDetails,
      requiresRollback,
      verifiedAt: new Date(),
    };
  }

  /**
   * Executes Tier 3 Long-Term Impact Verification (T + 30 days).
   * Compares 30-day pre vs post search analytics metrics.
   */
  public static async runTier3ImpactVerification(params: {
    actionExecutionId: string;
    websiteId: string;
    ruleKey: string;
    preClicks: number;
    postClicks: number;
  }): Promise<{ impactPositive: boolean; clicksLiftPct: number }> {
    const { actionExecutionId, websiteId, ruleKey, preClicks, postClicks } = params;

    const deltaClicks = postClicks - preClicks;
    const clicksLiftPct = preClicks > 0 ? Number(((deltaClicks / preClicks) * 100).toFixed(1)) : 0;
    const impactPositive = deltaClicks >= 0;

    await LearningLoopEngine.recordActionOutcome({
      ruleKey,
      websiteId,
      outcome: impactPositive ? 'SUCCESS' : 'FAILED',
      metricDeltaPct: clicksLiftPct,
    });

    return {
      impactPositive,
      clicksLiftPct,
    };
  }
}
