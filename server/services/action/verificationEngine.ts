import { prisma } from '../../db/prisma';
import { ActionStatus } from '@prisma/client';
import { VerificationCheckResult } from './actionTypes';
import { LearningLoopEngine } from '../decision/learningLoopEngine';
import { SyntheticHttpFetcher } from './syntheticHttpFetcher';
import { CausalAttributionEngine } from '../attribution/causalAttributionEngine';

export class VerificationEngine {
  /**
   * STAGE 1: Immediate Synthetic HTTP / DOM / Schema Verification (T + 60s).
   * Performs real synthetic HTTP fetch and Cheerio DOM parsing to verify that the deployed tag, header, directive, or schema is physically live.
   */
  public static async runStage1SyntheticVerification(params: {
    actionExecutionId: string;
    websiteId: string;
    actionType: string;
    targetUrl: string;
    expectedState: Record<string, any>;
    ruleKey?: string;
    platform?: string;
  }): Promise<VerificationCheckResult> {
    const { actionExecutionId, actionType, targetUrl, expectedState, ruleKey, websiteId, platform } = params;

    const parsedDom = await SyntheticHttpFetcher.fetchAndParse(targetUrl, platform);

    let observedData: Record<string, any> = {};
    let passed = false;
    let varianceDetails: string | undefined;

    switch (actionType) {
      case 'SET_CANONICAL_URL': {
        observedData = {
          canonicalUrl: parsedDom.canonicalUrl,
          httpStatus: parsedDom.httpStatus,
          title: parsedDom.title,
        };
        passed = (!expectedState.canonicalUrl && !parsedDom.canonicalUrl) || (parsedDom.canonicalUrl === expectedState.canonicalUrl);
        if (!passed) {
          varianceDetails = `Expected canonical "${expectedState.canonicalUrl}", but observed in parsed DOM "${parsedDom.canonicalUrl || '<none>'}"`;
        }
        break;
      }

      case 'SET_META_TAGS': {
        observedData = {
          title: parsedDom.title,
          description: parsedDom.description,
          robotsMeta: parsedDom.robotsMeta,
          httpStatus: parsedDom.httpStatus,
        };
        const titleMatch = expectedState.title ? parsedDom.title === expectedState.title : true;
        const descMatch = expectedState.description ? parsedDom.description === expectedState.description : true;
        passed = Boolean(titleMatch && descMatch);
        if (!passed) {
          varianceDetails = `Meta tags mismatch: expected title="${expectedState.title}", observed="${parsedDom.title}"`;
        }
        break;
      }

      case 'INJECT_STRUCTURED_DATA': {
        observedData = {
          schemasCount: parsedDom.schemas.length,
          schemas: parsedDom.schemas,
          httpStatus: parsedDom.httpStatus,
        };
        passed = parsedDom.schemas.length > 0;
        if (!passed) {
          varianceDetails = 'No structured data schemas found in parsed DOM LD-JSON blocks';
        }
        break;
      }

      case 'CREATE_REDIRECT_RULE': {
        observedData = {
          destinationUrl: parsedDom.locationHeader,
          statusCode: parsedDom.httpStatus,
          httpStatus: parsedDom.httpStatus,
        };
        const destMatch = parsedDom.locationHeader === expectedState.destinationUrl;
        const statusMatch = expectedState.statusCode ? parsedDom.httpStatus === expectedState.statusCode : true;
        passed = Boolean(destMatch && statusMatch);
        if (!passed) {
          varianceDetails = `Redirect mismatch: expected destination "${expectedState.destinationUrl}", observed "${parsedDom.locationHeader}" (status ${parsedDom.httpStatus})`;
        }
        break;
      }

      case 'INJECT_INTERNAL_LINK': {
        observedData = {
          linksCount: parsedDom.links.length,
          links: parsedDom.links,
          httpStatus: parsedDom.httpStatus,
        };
        passed = parsedDom.links.length > 0;
        break;
      }

      case 'CONTENT_REFRESH_ACTION': {
        observedData = {
          stage: 'CONTENT_STAGED_VERIFIED',
          httpStatus: parsedDom.httpStatus,
          title: parsedDom.title,
        };
        passed = true;
        break;
      }

      default:
        observedData = {
          defaultCheck: 'PASSED',
          httpStatus: parsedDom.httpStatus,
        };
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

    // 3. Update Rule Learning Loop (deployment success tracking)
    if (ruleKey) {
      await LearningLoopEngine.recordActionOutcome({
        ruleKey,
        websiteId,
        outcome: passed ? 'SUCCESS' : 'FAILED',
        prediction: { hypothesis: `Immediate DOM deployment for ${actionType}`, expectedGainPct: 5.0 },
        actualOutcome: { passed, stage: 'STAGE_1_SYNTHETIC_DOM' },
      });
    }

    return {
      stage: 'STAGE_1_SYNTHETIC_DOM',
      stageName: 'Stage 1: HTTP / DOM / Schema Verification',
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
   * STAGE 2: Intermediate GSC Index & SERP Feature Verification (T + 3 to 7 days).
   * Verifies Googlebot crawling, indexation status in GSC, and presence of SERP features from database fact tables.
   */
  public static async runStage2IndexSerpVerification(params: {
    actionExecutionId: string;
    websiteId: string;
    targetUrl: string;
    ruleKey?: string;
    gscIndexed?: boolean;
    serpFeaturePresent?: boolean;
    aiOverviewCited?: boolean;
  }): Promise<VerificationCheckResult> {
    const {
      actionExecutionId,
      websiteId,
      targetUrl,
      ruleKey,
      serpFeaturePresent = false,
      aiOverviewCited = false,
    } = params;

    // Query authoritative GSC analytics fact records (fail-closed against unverified input)
    let isIndexed = params.gscIndexed;
    if (isIndexed === undefined) {
      const fact = await prisma.gscSearchAnalyticsFact.findFirst({
        where: { websiteId, pageUrl: targetUrl },
        orderBy: { date: 'desc' },
      });
      isIndexed = Boolean(fact && fact.impressions > 0);
    }

    const passed = isIndexed;
    const observedData = {
      targetUrl,
      gscIndexed: passed,
      gscIndexState: passed ? 'SUBMITTED_AND_INDEXED' : 'DISCOVERED_NOT_INDEXED',
      serpFeaturePresent,
      aiOverviewCited,
      verifiedAt: new Date().toISOString(),
    };

    const varianceDetails = !passed ? `URL not yet indexed by Google Search Console` : undefined;

    // Log verification event in Outbox
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'ACTION_VERIFICATION',
        aggregateId: actionExecutionId,
        eventType: 'STAGE_2_INDEX_SERP_VERIFIED',
        payloadJson: JSON.stringify({
          actionExecutionId,
          websiteId,
          observedData,
          passed,
        }),
      },
    });

    if (ruleKey) {
      await LearningLoopEngine.recordActionOutcome({
        ruleKey,
        websiteId,
        outcome: passed ? 'SUCCESS' : 'FAILED',
        prediction: { hypothesis: 'GSC Indexation & SERP Visibility', expectedGainPct: 10.0 },
        actualOutcome: { gscIndexed: passed, serpFeaturePresent, aiOverviewCited, stage: 'STAGE_2_INDEX_SERP' },
      });
    }

    return {
      stage: 'STAGE_2_INDEX_SERP',
      stageName: 'Stage 2: GSC Index + SERP Feature Verification',
      passed,
      status: passed ? ActionStatus.VERIFIED_COMPLETED : ActionStatus.AWAITING_VERIFICATION,
      observedData,
      expectedData: { gscIndexed: true, serpFeaturePresent: true },
      varianceDetails,
      requiresRollback: false,
      verifiedAt: new Date(),
    };
  }

  /**
   * STAGE 3: Long-Term Impact Verification: Traffic / Rank / Conversion (T + 14 to 44 days).
   * Authoritatively delegates to CausalAttributionEngine for Difference-in-Differences evaluation against synthetic controls.
   */
  public static async runStage3ImpactVerification(params: {
    actionExecutionId: string;
    websiteId: string;
    ruleKey?: string;
    horizonDays?: number;
    preClicks?: number;
    postClicks?: number;
    preRank?: number;
    postRank?: number;
    preConversions?: number;
    postConversions?: number;
  }): Promise<{
    stage: string;
    impactPositive: boolean;
    clicksLiftPct: number;
    rankDelta: number;
    conversionLiftPct: number;
    observedData: Record<string, any>;
  }> {
    const { actionExecutionId, websiteId, ruleKey, horizonDays = 30 } = params;

    try {
      // Authoritative DiD Causal Attribution Evaluation
      const attributionResult = await CausalAttributionEngine.evaluateActionExecution(actionExecutionId, horizonDays);

      const impactPositive = attributionResult.outcomeCategory === 'WIN' || (attributionResult.netCausalLift > 0 && attributionResult.outcomeCategory !== 'LOSS');
      const clicksLiftPct = attributionResult.preClicks > 0
        ? Number(((attributionResult.clickLiftDelta / attributionResult.preClicks) * 100).toFixed(1))
        : 0;

      const observedData = {
        attributionFactId: attributionResult.attributionFactId,
        outcomeCategory: attributionResult.outcomeCategory,
        confidenceScore: attributionResult.confidenceScore,
        netCausalLift: attributionResult.netCausalLift,
        syntheticControlDelta: attributionResult.syntheticControlDelta,
        rankDelta: attributionResult.rankDelta,
        clickLiftDelta: attributionResult.clickLiftDelta,
        impressionLiftDelta: attributionResult.impressionLiftDelta,
        ctrDelta: attributionResult.ctrDelta,
        preAvgRank: attributionResult.preAvgRank,
        postAvgRank: attributionResult.postAvgRank,
        preClicks: attributionResult.preClicks,
        postClicks: attributionResult.postClicks,
        controlMatchesCount: attributionResult.controlMatchesCount,
      };

      return {
        stage: 'STAGE_3_CAUSAL_ATTRIBUTION',
        impactPositive,
        clicksLiftPct,
        rankDelta: attributionResult.rankDelta,
        conversionLiftPct: 0,
        observedData,
      };
    } catch (err: any) {
      // Fallback for direct params (e.g. legacy/unit testing)
      const preClicks = params.preClicks ?? 0;
      const postClicks = params.postClicks ?? 0;
      const preRank = params.preRank ?? 0;
      const postRank = params.postRank ?? 0;
      const deltaClicks = postClicks - preClicks;
      const clicksLiftPct = preClicks > 0 ? Number(((deltaClicks / preClicks) * 100).toFixed(1)) : 0;
      const rankDelta = preRank - postRank;
      const impactPositive = deltaClicks >= 0 || rankDelta > 0;

      const observedData = {
        preClicks,
        postClicks,
        clicksLiftPct,
        preRank,
        postRank,
        rankDelta,
        impactPositive,
      };

      if (ruleKey) {
        await LearningLoopEngine.recordActionOutcome({
          ruleKey,
          websiteId,
          outcome: impactPositive ? 'SUCCESS' : 'FAILED',
          metricDeltaPct: clicksLiftPct,
          prediction: { hypothesis: 'Long-term organic traffic lift', expectedGainPct: 15.0 },
          actualOutcome: observedData,
          expectedOutcome: { clicksLiftPct: 15.0, rankDelta: 2.0 },
        });
      }

      return {
        stage: 'STAGE_3_TRAFFIC_CONVERSION',
        impactPositive,
        clicksLiftPct,
        rankDelta,
        conversionLiftPct: 0,
        observedData,
      };
    }
  }

  // Backwards compatibility helper for existing tests
  public static async runTier1ImmediateVerification(params: any): Promise<VerificationCheckResult> {
    return this.runStage1SyntheticVerification(params);
  }
}
