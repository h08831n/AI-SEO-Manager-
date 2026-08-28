/**
 * Centralized Thresholds and Versioning Constants for Causal Attribution & Bayesian Learning (Phase 6.1 & 6.2)
 */

export const ATTRIBUTION_MODEL_VERSION = 'causal-did-v1';

// Canonical Observation Windows & Lags
export const ATTRIBUTION_LAG_DAYS = 14;
export const ATTRIBUTION_WINDOW_DAYS = 30;
export const MINIMUM_OBSERVATION_COMPLETENESS = 0.80; // 80% daily data completeness required per window

// Minimum observation horizon (days) required for valid attribution inference
export const MIN_ATTRIBUTION_HORIZON_DAYS = 14;

// Synthetic Control Selection Thresholds
export const MIN_CONTROL_SIMILARITY = 0.50; // Controls below 0.50 similarity score are rejected
export const MIN_CONTROL_HISTORY_DAYS = 14; // Minimum history days required for candidate control

// Confidence score thresholds
export const ATTRIBUTION_MIN_CONFIDENCE_THRESHOLD = 0.50; // Gate for assigning WIN / LOSS and Bayesian ingestion
export const ATTRIBUTION_INCONCLUSIVE_CONFIDENCE_THRESHOLD = 0.45; // Below this is strictly INCONCLUSIVE

// Metric Delta Thresholds for WIN / LOSS assignment
export const WIN_CLICK_LIFT_DELTA_THRESHOLD = 5.0; // >= +5 clicks
export const WIN_RANK_DELTA_THRESHOLD = 1.5; // >= +1.5 positions
export const LOSS_CLICK_LIFT_DELTA_THRESHOLD = -5.0; // <= -5 clicks
export const LOSS_RANK_DELTA_THRESHOLD = -1.5; // <= -1.5 positions

// Volatility dampening
export const SERP_VOLATILITY_PENALTY_MULTIPLIER = 0.50;

// Valid Outcome Category States
export type AttributionOutcomeCategory =
  | 'PENDING_DATA'
  | 'MEASURING'
  | 'WIN'
  | 'LOSS'
  | 'NEUTRAL'
  | 'INCONCLUSIVE';

/**
 * Deterministic Version-Aware Evaluation Key Generator
 * 
 * Format:
 * attr:v1:{websiteId}:{actionExecutionId}:{evaluationStartDate}:{evaluationEndDate}:{modelVersion}
 */
export function buildAttributionEvaluationKey(params: {
  websiteId: string;
  actionExecutionId: string;
  evaluationStartDate: Date | string;
  evaluationEndDate: Date | string;
  modelVersion?: string;
}): string {
  const startStr = typeof params.evaluationStartDate === 'string'
    ? params.evaluationStartDate.slice(0, 10)
    : params.evaluationStartDate.toISOString().slice(0, 10);
  const endStr = typeof params.evaluationEndDate === 'string'
    ? params.evaluationEndDate.slice(0, 10)
    : params.evaluationEndDate.toISOString().slice(0, 10);
  const modelVersion = params.modelVersion || ATTRIBUTION_MODEL_VERSION;

  return `attr:v1:${params.websiteId}:${params.actionExecutionId}:${startStr}:${endStr}:${modelVersion}`;
}
