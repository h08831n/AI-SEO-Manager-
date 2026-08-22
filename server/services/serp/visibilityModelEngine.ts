import { SerpDevice, SerpFeatureType } from '@prisma/client';

export interface VisibilityCalculationInput {
  position: number | null; // 1-100 or null
  device: SerpDevice;
  searchVolume?: number | null;
  featuresPresent: SerpFeatureType[];
  isTargetCitedInAiOverview?: boolean;
  isTargetFeaturedSnippetOwner?: boolean;
  customCtrModel?: string;
}

export interface VisibilityCalculationResult {
  visibilityWeight: number; // 0.0 to 1.0 CTR estimate
  visibilityScore: number; // visibilityWeight * searchVolume
  baseCtr: number;
  displacementFactor: number;
  ctrModelUsed: string;
}

export class VisibilityModelEngine {
  private static BASE_DESKTOP_CTR: Record<number, number> = {
    1: 0.316,
    2: 0.158,
    3: 0.098,
    4: 0.062,
    5: 0.043,
    6: 0.031,
    7: 0.024,
    8: 0.019,
    9: 0.015,
    10: 0.012,
  };

  private static BASE_MOBILE_CTR: Record<number, number> = {
    1: 0.352,
    2: 0.174,
    3: 0.092,
    4: 0.051,
    5: 0.034,
    6: 0.023,
    7: 0.017,
    8: 0.013,
    9: 0.010,
    10: 0.008,
  };

  static calculate(input: VisibilityCalculationInput): VisibilityCalculationResult {
    const { position, device, searchVolume = 0, featuresPresent = [] } = input;
    const modelName = input.customCtrModel || 'DYNAMIC_SERP_DISPLACEMENT_V1';

    if (!position || position > 100 || position < 1) {
      return {
        visibilityWeight: 0,
        visibilityScore: 0,
        baseCtr: 0,
        displacementFactor: 1.0,
        ctrModelUsed: modelName,
      };
    }

    // 1. Determine Base CTR
    const table = device === SerpDevice.MOBILE ? this.BASE_MOBILE_CTR : this.BASE_DESKTOP_CTR;
    let baseCtr: number;
    if (position <= 10) {
      baseCtr = table[position] || 0.01;
    } else if (position <= 20) {
      baseCtr = Math.max(0.002, 0.03 / position);
    } else {
      baseCtr = Math.max(0.0005, 0.01 / position);
    }

    // 2. Compute Displacement Factors from SERP Features
    let displacementFactor = 1.0;

    // AI Overview Effect
    if (featuresPresent.includes(SerpFeatureType.AI_OVERVIEW)) {
      if (input.isTargetCitedInAiOverview) {
        displacementFactor *= 1.25; // Bonus visibility from citation card
      } else {
        displacementFactor *= 0.65; // Organic displacement down the viewport
      }
    }

    // Featured Snippet Effect
    if (featuresPresent.includes(SerpFeatureType.FEATURED_SNIPPET)) {
      if (input.isTargetFeaturedSnippetOwner) {
        displacementFactor *= 1.35; // Position 0 capture
      } else {
        displacementFactor *= 0.80; // Competing snippet pushes organic clicks down
      }
    }

    // Local Pack / PAA / Video Displacement
    if (featuresPresent.includes(SerpFeatureType.LOCAL_PACK)) {
      displacementFactor *= 0.78;
    }
    if (featuresPresent.includes(SerpFeatureType.VIDEO_CAROUSEL)) {
      displacementFactor *= 0.90;
    }

    const visibilityWeight = parseFloat(Math.min(1.0, baseCtr * displacementFactor).toFixed(4));
    const vol = searchVolume && searchVolume > 0 ? searchVolume : 100;
    const visibilityScore = parseFloat((visibilityWeight * vol).toFixed(2));

    return {
      visibilityWeight,
      visibilityScore,
      baseCtr: parseFloat(baseCtr.toFixed(4)),
      displacementFactor: parseFloat(displacementFactor.toFixed(3)),
      ctrModelUsed: modelName,
    };
  }
}
