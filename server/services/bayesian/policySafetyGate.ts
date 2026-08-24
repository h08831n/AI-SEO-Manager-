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
  MAX_WEIGHT_DELTA_PER_CYCLE,
  DRIFT_REVIEW_THRESHOLD,
  AUTO_DAMP_LOSS_THRESHOLD,
  AUTO_DAMP_WIN_RATE_THRESHOLD,
  MIN_OBSERVATIONS_FOR_AUTO_DAMP,
  DAMPED_WEIGHT_CEILING,
  BayesianApprovalStatus,
} from '../../config/bayesianConstants';

export interface PolicyGateEvaluationInput {
  currentAppliedWeight: number;
  currentApprovalStatus: BayesianApprovalStatus | string;
  rawCalculatedWeight: number;
  posteriorWinRate: number;
  observedWins: number;
  observedLosses: number;
  isCurrentlyDamped?: boolean;
}

export interface PolicyGateEvaluationResult {
  rawCalculatedWeight: number;
  approvedAppliedWeight: number;
  approvalStatus: BayesianApprovalStatus;
  isAutoDamped: boolean;
  dampedReason?: string | null;
  driftDetected: boolean;
  deltaApplied: number;
}

export class PolicySafetyGate {
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
      isCurrentlyDamped = false,
    } = input;

    const totalObs = observedWins + observedLosses;

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
      };
    }

    // 2. Invariant 2: Auto-Damping Assessment
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
      };
    }

    // 3. Invariant 3: Drift & Divergence Check
    const driftDelta = Math.abs(rawCalculatedWeight - currentAppliedWeight);
    const driftDetected = driftDelta >= DRIFT_REVIEW_THRESHOLD;

    // 4. Invariant 4: Rate-Limited Step Clamping
    const rawDelta = rawCalculatedWeight - currentAppliedWeight;
    let clampedDelta = rawDelta;
    if (Math.abs(rawDelta) > MAX_WEIGHT_DELTA_PER_CYCLE) {
      clampedDelta = rawDelta > 0 ? MAX_WEIGHT_DELTA_PER_CYCLE : -MAX_WEIGHT_DELTA_PER_CYCLE;
    }

    let nextAppliedWeight = currentAppliedWeight + clampedDelta;

    // 5. Invariant 5: Absolute Safe Boundary Clamping [MIN_RULE_WEIGHT, MAX_RULE_WEIGHT]
    nextAppliedWeight = Math.min(MAX_RULE_WEIGHT, Math.max(MIN_RULE_WEIGHT, nextAppliedWeight));
    nextAppliedWeight = Number(nextAppliedWeight.toFixed(3));

    // If drift is detected and previously was not pending, flag for review, but apply clamped step
    const approvalStatus: BayesianApprovalStatus = driftDetected ? 'PENDING_REVIEW' : 'AUTO_APPROVED';

    return {
      rawCalculatedWeight: Number(rawCalculatedWeight.toFixed(3)),
      approvedAppliedWeight: nextAppliedWeight,
      approvalStatus,
      isAutoDamped: false,
      dampedReason: null,
      driftDetected,
      deltaApplied: Number((nextAppliedWeight - currentAppliedWeight).toFixed(3)),
    };
  }
}
