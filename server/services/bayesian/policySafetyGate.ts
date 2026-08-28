/**
 * Phase 6.2 Policy Safety Gate
 * 
 * Enforces production invariants on Bayesian rule weight recalibrations:
 * 1. Locked State Protection: If a rule is LOCKED, automated recalibration cannot mutate applied weight.
 * 2. Step-Delta Rate Limiting: Bounds maximum shift (|delta| <= MAX_WEIGHT_DELTA_PER_CYCLE).
 * 3. Absolute Boundary Clamping: Strictly encloses applied weights in [MIN_RULE_WEIGHT, MAX_RULE_WEIGHT].
 * 4. Auto-Damping: Automatically caps and flags rules with persistently negative attribution outcomes.
 * 5. Drift Flagging: Requires manual review (PENDING_REVIEW) if raw weight diverges sharply from current.
 */

import {
  MIN_RULE_WEIGHT,
  MAX_RULE_WEIGHT,
  MAX_POLICY_CHANGE_PER_CYCLE,
  MAX_WEIGHT_DELTA_PER_CYCLE,
  MINIMUM_EVIDENCE_THRESHOLD,
  DRIFT_REVIEW_THRESHOLD,
  AUTO_DAMP_LOSS_THRESHOLD,
  AUTO_DAMP_WIN_RATE_THRESHOLD,
  MIN_OBSERVATIONS_FOR_AUTO_DAMP,
  DAMPED_WEIGHT_CEILING,
  DEFAULT_ALPHA_PRIOR,
  DEFAULT_BETA_PRIOR,
  BayesianApprovalStatus,
} from '../../config/bayesianConstants';

export interface PolicyGateEvaluationInput {
  currentAppliedWeight: number;
  currentApprovalStatus: BayesianApprovalStatus | string;
  rawCalculatedWeight: number;
  posteriorWinRate: number;
  observedWins: number;
  observedLosses: number;
  alphaPosterior?: number;
  betaPosterior?: number;
  isCurrentlyDamped?: boolean;
  minEvidenceThreshold?: number;
  maxStepDelta?: number;
}

export interface PolicyGateEvaluationResult {
  rawCalculatedWeight: number;
  approvedAppliedWeight: number;
  approvalStatus: BayesianApprovalStatus;
  isAutoDamped: boolean;
  dampedReason?: string | null;
  driftDetected: boolean;
  deltaApplied: number;
  insufficientEvidence?: boolean;
  auditExplanation?: string;
}

export class PolicySafetyGate {
  /**
   * Dedicated P0 weight adjustment evaluation with strict evidence threshold & policy clamping.
   */
  public static evaluateWeightAdjustment(params: {
    ruleKey: string;
    currentWeight: number;
    proposedWeight: number;
    alphaPosterior: number;
    betaPosterior: number;
    minEvidenceThreshold?: number;
  }): {
    isApproved: boolean;
    appliedWeight: number;
    wasClamped: boolean;
    rejectionReason?: string;
  } {
    const minThreshold = params.minEvidenceThreshold ?? MINIMUM_EVIDENCE_THRESHOLD;
    const totalEvidence = params.alphaPosterior + params.betaPosterior;

    if (totalEvidence < minThreshold) {
      return {
        isApproved: false,
        appliedWeight: params.currentWeight,
        wasClamped: false,
        rejectionReason: `INSUFFICIENT_EVIDENCE: Total evidence ${totalEvidence} is below required threshold ${minThreshold}.`,
      };
    }

    const rawDelta = params.proposedWeight - params.currentWeight;
    let appliedDelta = rawDelta;
    let wasClamped = false;

    if (Math.abs(rawDelta) > MAX_POLICY_CHANGE_PER_CYCLE) {
      appliedDelta = rawDelta > 0 ? MAX_POLICY_CHANGE_PER_CYCLE : -MAX_POLICY_CHANGE_PER_CYCLE;
      wasClamped = true;
    }

    let appliedWeight = params.currentWeight + appliedDelta;
    appliedWeight = Math.min(MAX_RULE_WEIGHT, Math.max(MIN_RULE_WEIGHT, appliedWeight));

    return {
      isApproved: true,
      appliedWeight: Number(appliedWeight.toFixed(3)),
      wasClamped,
    };
  }

  /**
   * Evaluates a proposed Bayesian raw weight through the policy safety gate.
   */
  public static evaluateWeightUpdate(input: PolicyGateEvaluationInput): PolicyGateEvaluationResult {
    const {
      currentAppliedWeight,
      currentApprovalStatus,
      rawCalculatedWeight,
      posteriorWinRate,
      observedWins,
      observedLosses,
      alphaPosterior,
      betaPosterior,
      isCurrentlyDamped = false,
      minEvidenceThreshold,
      maxStepDelta,
    } = input;

    const totalObs = observedWins + observedLosses;
    const totalEvidence = (alphaPosterior !== undefined && betaPosterior !== undefined)
      ? (alphaPosterior + betaPosterior)
      : (DEFAULT_ALPHA_PRIOR + DEFAULT_BETA_PRIOR + totalObs);

    const effectiveMinEvidence = minEvidenceThreshold !== undefined ? minEvidenceThreshold : MINIMUM_EVIDENCE_THRESHOLD;
    const effectiveMaxDelta = maxStepDelta !== undefined ? maxStepDelta : MAX_POLICY_CHANGE_PER_CYCLE;

    // 1. Invariant 1: Locked State Protection
    if (currentApprovalStatus === 'LOCKED') {
      return {
        rawCalculatedWeight: Number(rawCalculatedWeight.toFixed(3)),
        approvedAppliedWeight: Number(currentAppliedWeight.toFixed(3)),
        approvalStatus: 'LOCKED',
        isAutoDamped: isCurrentlyDamped,
        dampedReason: isCurrentlyDamped ? 'Rule is locked in damped state' : null,
        driftDetected: false,
        deltaApplied: 0,
        insufficientEvidence: false,
        auditExplanation: 'Rule is in LOCKED status. Automated weight updates are strictly prevented.',
      };
    }

    // 2. Invariant 2: Auto-Damping Assessment (Safety Protection against failing rules)
    const meetsLossDamp = observedLosses >= AUTO_DAMP_LOSS_THRESHOLD && posteriorWinRate < 0.40;
    const meetsWinRateDamp = totalObs >= MIN_OBSERVATIONS_FOR_AUTO_DAMP && posteriorWinRate < AUTO_DAMP_WIN_RATE_THRESHOLD;
    const shouldDamp = meetsLossDamp || meetsWinRateDamp;

    if (shouldDamp) {
      const dampedWeight = Math.min(DAMPED_WEIGHT_CEILING, rawCalculatedWeight, currentAppliedWeight);
      const boundedDampedWeight = Math.max(MIN_RULE_WEIGHT, Number(dampedWeight.toFixed(3)));
      const dampReason = meetsLossDamp
        ? `Observed ${observedLosses} losses (win rate ${(posteriorWinRate * 100).toFixed(1)}%) exceeds loss threshold`
        : `Posterior win rate ${(posteriorWinRate * 100).toFixed(1)}% below threshold ${(AUTO_DAMP_WIN_RATE_THRESHOLD * 100).toFixed(1)}%`;

      return {
        rawCalculatedWeight: Number(rawCalculatedWeight.toFixed(3)),
        approvedAppliedWeight: boundedDampedWeight,
        approvalStatus: 'PENDING_REVIEW',
        isAutoDamped: true,
        dampedReason: dampReason,
        driftDetected: Math.abs(rawCalculatedWeight - currentAppliedWeight) >= DRIFT_REVIEW_THRESHOLD,
        deltaApplied: Number((boundedDampedWeight - currentAppliedWeight).toFixed(3)),
        insufficientEvidence: false,
        auditExplanation: `Auto-damped due to poor attribution outcomes: ${dampReason}. Clamped to ${boundedDampedWeight}.`,
      };
    }

    // 3. Invariant 3: Minimum Evidence Check (Gating positive weight adjustments)
    if (totalEvidence < effectiveMinEvidence) {
      return {
        rawCalculatedWeight: Number(rawCalculatedWeight.toFixed(3)),
        approvedAppliedWeight: Number(currentAppliedWeight.toFixed(3)),
        approvalStatus: currentApprovalStatus === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : 'ACTIVE',
        isAutoDamped: false,
        dampedReason: null,
        driftDetected: false,
        deltaApplied: 0,
        insufficientEvidence: true,
        auditExplanation: `Evidence (total α+β = ${totalEvidence.toFixed(1)}) is below minimum required threshold (${effectiveMinEvidence}). Weight held constant at ${currentAppliedWeight}.`,
      };
    }

    // 4. Invariant 4: Drift & Divergence Check
    const driftDelta = Math.abs(rawCalculatedWeight - currentAppliedWeight);
    const driftDetected = driftDelta >= DRIFT_REVIEW_THRESHOLD;

    // 5. Invariant 5: Rate-Limited Step Clamping
    const rawDelta = rawCalculatedWeight - currentAppliedWeight;
    let clampedDelta = rawDelta;
    if (Math.abs(rawDelta) > effectiveMaxDelta) {
      clampedDelta = rawDelta > 0 ? effectiveMaxDelta : -effectiveMaxDelta;
    }

    let nextAppliedWeight = currentAppliedWeight + clampedDelta;

    // 6. Invariant 6: Absolute Safe Boundary Clamping [MIN_RULE_WEIGHT, MAX_RULE_WEIGHT]
    nextAppliedWeight = Math.min(MAX_RULE_WEIGHT, Math.max(MIN_RULE_WEIGHT, nextAppliedWeight));
    nextAppliedWeight = Number(nextAppliedWeight.toFixed(3));

    // If drift is detected or previously pending review, maintain review status
    let approvalStatus: BayesianApprovalStatus = 'AUTO_APPROVED';
    if (currentApprovalStatus === 'PENDING_REVIEW') {
      approvalStatus = 'PENDING_REVIEW';
    } else if (driftDetected) {
      approvalStatus = 'PENDING_REVIEW';
    } else {
      approvalStatus = 'ACTIVE';
    }

    return {
      rawCalculatedWeight: Number(rawCalculatedWeight.toFixed(3)),
      approvedAppliedWeight: nextAppliedWeight,
      approvalStatus,
      isAutoDamped: false,
      dampedReason: null,
      driftDetected,
      deltaApplied: Number((nextAppliedWeight - currentAppliedWeight).toFixed(3)),
      insufficientEvidence: false,
      auditExplanation: `Weight updated from ${currentAppliedWeight} to ${nextAppliedWeight} (raw calculated: ${rawCalculatedWeight.toFixed(3)}, clamped delta: ${clampedDelta.toFixed(3)}, drift: ${driftDetected}). Status: ${approvalStatus}.`,
    };
  }
}
