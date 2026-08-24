/**
 * Phase 6.2 Bayesian Rule Learning & Policy Safety Gate Constants
 * 
 * Defines mathematical parameters for Beta-Binomial conjugate updating
 * and policy safety gate bounds.
 */

export const DEFAULT_ALPHA_PRIOR = 2.0;
export const DEFAULT_BETA_PRIOR = 2.0;

// Policy Safety Bounds
export const MIN_RULE_WEIGHT = 0.20;
export const MAX_RULE_WEIGHT = 2.50;
export const MAX_WEIGHT_DELTA_PER_CYCLE = 0.35; // Maximum step change per recalibration cycle

// Drift & Review Triggers
export const DRIFT_REVIEW_THRESHOLD = 0.50; // If raw weight shifts from current by > 0.50, flag for review

// Auto-Damping Triggers
export const AUTO_DAMP_LOSS_THRESHOLD = 3; // 3 or more losses with low win rate triggers damping
export const AUTO_DAMP_WIN_RATE_THRESHOLD = 0.35; // Win rate < 35% with >= 3 observations triggers damping
export const MIN_OBSERVATIONS_FOR_AUTO_DAMP = 3;
export const DAMPED_WEIGHT_CEILING = 0.40; // Clamped weight cap when a rule is auto-damped

export type BayesianApprovalStatus = 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'LOCKED';
