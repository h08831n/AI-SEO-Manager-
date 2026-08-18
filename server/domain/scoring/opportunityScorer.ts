import { DataSourceProvenance } from '../../../src/shared/contracts';

export interface OpportunityDimensions {
  searchVolume: number;        // e.g. 1,000 to 100,000
  currentPosition: number;     // e.g. 1.0 to 100.0
  businessRelevance: number;   // 1 to 10
  conversionPotential: number; // 1 to 10 (Commercial/Transactional = 8-10, Informational = 3-5)
  strategicImportance: number; // 1 to 10
  confidence: number;          // 0.1 to 1.0
  effort: number;              // 1 to 5
  risk: number;                // 1 to 3
}

export interface OpportunityScoreResult {
  scoreVersion: string;
  totalOpportunityScore: number; // 0 to 100
  subScores: {
    demandScore: number;
    rankingProbability: number;
    businessValueScore: number;
    effortPenalty: number;
  };
  provenance: DataSourceProvenance;
}

export class VersionedOpportunityScorer {
  public static readonly VERSION = '1.0.0';

  /**
   * Deterministic opportunity scoring formula:
   * Same inputs + same version = exactly same output
   */
  public static calculateScore(input: OpportunityDimensions): OpportunityScoreResult {
    // 1. Demand score (Logarithmic scaling of volume)
    const normalizedVolume = Math.max(10, input.searchVolume);
    const demandScore = Math.min(10, Math.log10(normalizedVolume) * 2);

    // 2. Ranking Probability (Striking distance pos 4-20 gets highest multiplier)
    let rankingProbability = 0.2;
    if (input.currentPosition >= 4 && input.currentPosition <= 10) {
      rankingProbability = 1.0; // High probability Page 1 win
    } else if (input.currentPosition > 10 && input.currentPosition <= 20) {
      rankingProbability = 0.75; // Page 2 striking distance
    } else if (input.currentPosition > 20 && input.currentPosition <= 50) {
      rankingProbability = 0.45;
    } else if (input.currentPosition < 4 && input.currentPosition >= 1) {
      rankingProbability = 0.3; // Already top 3, incremental gain is lower
    }

    // 3. Business Value Score
    const businessValueScore =
      (input.businessRelevance * 0.4 +
        input.conversionPotential * 0.4 +
        input.strategicImportance * 0.2); // Range: 1 to 10

    // 4. Effort & Risk Penalty denominator
    const effort = Math.max(1, input.effort);
    const risk = Math.max(1, input.risk);
    const effortPenalty = effort * 0.6 + risk * 0.4; // Range: 1.0 to 4.2

    // Composite Raw Score
    const rawScore =
      ((demandScore * rankingProbability * businessValueScore * input.confidence) / effortPenalty) * 3.5;

    const totalOpportunityScore = Math.min(100, Math.max(1, Math.round(rawScore * 10) / 10));

    return {
      scoreVersion: this.VERSION,
      totalOpportunityScore,
      subScores: {
        demandScore: Math.round(demandScore * 10) / 10,
        rankingProbability,
        businessValueScore: Math.round(businessValueScore * 10) / 10,
        effortPenalty: Math.round(effortPenalty * 10) / 10,
      },
      provenance: 'CALCULATED',
    };
  }
}
