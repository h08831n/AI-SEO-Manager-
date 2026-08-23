import { BusinessValueTier } from '@prisma/client';
import { OpportunityScoreBreakdown } from './decisionTypes';

export class OpportunityScoreEngine {
  /**
   * Business Value Tier mapping to 1.0 - 5.0 scale
   */
  public static mapBusinessValueTierToWeight(tier?: BusinessValueTier | string): number {
    switch (tier) {
      case BusinessValueTier.TIER_1_CRITICAL:
      case 'TIER_1_CRITICAL':
        return 5.0;
      case BusinessValueTier.TIER_2_HIGH:
      case 'TIER_2_HIGH':
        return 4.0;
      case BusinessValueTier.TIER_3_MEDIUM:
      case 'TIER_3_MEDIUM':
        return 2.5;
      case BusinessValueTier.TIER_4_LOW:
      case 'TIER_4_LOW':
        return 1.5;
      case BusinessValueTier.TIER_5_BENCHMARK:
      case 'TIER_5_BENCHMARK':
      default:
        return 1.0;
    }
  }

  /**
   * Computes potential traffic gain factor on a 1.0 to 10.0 scale
   * using search volume and target position delta.
   */
  public static calculatePotentialTrafficGain(params: {
    searchVolume?: number;
    currentRank?: number | null;
    targetRank?: number;
    gscImpressions?: number;
  }): number {
    const volume = params.searchVolume || params.gscImpressions || 100;
    // Log scale volume factor from 1.0 to 5.0
    const volumeFactor = Math.min(5.0, Math.max(1.0, Math.log10(Math.max(10, volume)) / 1.2));

    let rankImprovementFactor = 1.5;
    if (params.currentRank !== undefined && params.currentRank !== null) {
      if (params.currentRank > 10) {
        rankImprovementFactor = 2.0; // Moving into page 1
      } else if (params.currentRank >= 4) {
        rankImprovementFactor = 1.8; // Moving into top 3
      } else if (params.currentRank >= 2) {
        rankImprovementFactor = 1.2; // Moving to #1
      }
    }

    const trafficGain = Number((volumeFactor * rankImprovementFactor).toFixed(2));
    return Math.min(10.0, Math.max(1.0, trafficGain));
  }

  /**
   * Deterministic Opportunity Score Calculation:
   * OpportunityScore = min(100, ((TrafficFactor * BusinessValue * Confidence) / (Effort * Risk)) * 10)
   */
  public static calculateScore(params: {
    potentialTrafficGain: number; // 1.0 to 10.0
    businessValueTier?: BusinessValueTier | string;
    businessValueWeight?: number; // 1.0 to 5.0
    confidenceScore: number; // 0.1 to 1.0
    effortScore: number; // 1.0 to 5.0
    riskScore: number; // 1.0 to 5.0
  }): OpportunityScoreBreakdown {
    const potentialTrafficGain = Math.min(10.0, Math.max(1.0, params.potentialTrafficGain));
    const businessValueWeight =
      params.businessValueWeight !== undefined
        ? Math.min(5.0, Math.max(1.0, params.businessValueWeight))
        : this.mapBusinessValueTierToWeight(params.businessValueTier);

    const confidenceScore = Math.min(1.0, Math.max(0.1, params.confidenceScore));
    const effortWeight = Math.min(5.0, Math.max(1.0, params.effortScore));
    const riskWeight = Math.min(5.0, Math.max(1.0, params.riskScore));

    const numerator = potentialTrafficGain * businessValueWeight * confidenceScore;
    const denominator = effortWeight * riskWeight;
    const rawScore = (numerator / denominator) * 10.0;
    const score = Number(Math.min(100.0, Math.max(1.0, rawScore)).toFixed(1));

    let priority: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW';
    if (score >= 80.0 || (riskWeight <= 1.5 && businessValueWeight >= 4.5 && score >= 70.0)) {
      priority = 'P0_CRITICAL';
    } else if (score >= 65.0) {
      priority = 'P1_HIGH';
    } else if (score >= 40.0) {
      priority = 'P2_MEDIUM';
    } else {
      priority = 'P3_LOW';
    }

    const formulaDetails = `(${potentialTrafficGain} * ${businessValueWeight} * ${confidenceScore}) / (${effortWeight} * ${riskWeight}) * 10 = ${score}`;

    return {
      score,
      priority,
      potentialTrafficGain,
      businessValueWeight,
      confidenceScore,
      effortWeight,
      riskWeight,
      formulaDetails,
    };
  }
}
