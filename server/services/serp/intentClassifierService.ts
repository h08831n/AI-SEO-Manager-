import { SearchIntent, FunnelStage, BusinessValueTier } from '@prisma/client';

export interface IntentClassificationResult {
  searchIntent: SearchIntent;
  intentConfidence: number;
  funnelStage: FunnelStage;
  businessValue: BusinessValueTier;
  conversionIntent: boolean;
  moneyKeyword: boolean;
  topicEntity?: string;
  conversionGoal?: string;
  matchedPatterns: string[];
}

export class IntentClassifierService {
  private static TRANSACTIONAL_PATTERNS = [
    /\b(buy|purchase|order|checkout|discount|coupon|deal|quote|pricing|hire|subscribe|book|demo|trial)\b/i,
    /\b(cost|cheap|affordable|expensive|pay|service)\b/i,
  ];

  private static COMMERCIAL_PATTERNS = [
    /\b(best|top|vs|versus|compare|comparison|review|reviews|alternative|alternatives|platform|software|tool|tools|agency|solution|solutions)\b/i,
  ];

  private static NAVIGATIONAL_PATTERNS = [
    /\b(login|signin|sign in|log in|portal|dashboard|support|contact|account|helpdesk|status page)\b/i,
  ];

  private static INFORMATIONAL_PATTERNS = [
    /\b(how to|what is|why|when|guide|tutorial|examples|tips|definition|learn|template|checklist|meaning|overview)\b/i,
  ];

  private static HIGH_VALUE_PATTERNS = [
    /\b(enterprise|security|compliance|b2b|api|integration|automation|saas|analytics|management|platform)\b/i,
  ];

  static classify(keyword: string, domainName?: string): IntentClassificationResult {
    const raw = keyword.toLowerCase().trim();
    const matchedPatterns: string[] = [];

    // 1. Check Navigational
    let isNavigational = false;
    if (domainName) {
      const cleanDomain = domainName.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0].toLowerCase();
      if (cleanDomain && raw.includes(cleanDomain)) {
        isNavigational = true;
        matchedPatterns.push('DOMAIN_BRAND_MATCH');
      }
    }
    for (const pat of this.NAVIGATIONAL_PATTERNS) {
      if (pat.test(raw)) {
        isNavigational = true;
        matchedPatterns.push(`NAVIGATIONAL:${pat.source}`);
      }
    }

    if (isNavigational) {
      return {
        searchIntent: SearchIntent.NAVIGATIONAL,
        intentConfidence: 0.92,
        funnelStage: FunnelStage.RETENTION,
        businessValue: BusinessValueTier.TIER_2_HIGH,
        conversionIntent: false,
        moneyKeyword: false,
        conversionGoal: 'Account Login / Brand Navigation',
        matchedPatterns,
      };
    }

    // 2. Check Transactional
    let isTransactional = false;
    for (const pat of this.TRANSACTIONAL_PATTERNS) {
      if (pat.test(raw)) {
        isTransactional = true;
        matchedPatterns.push(`TRANSACTIONAL:${pat.source}`);
      }
    }

    // 3. Check Commercial
    let isCommercial = false;
    for (const pat of this.COMMERCIAL_PATTERNS) {
      if (pat.test(raw)) {
        isCommercial = true;
        matchedPatterns.push(`COMMERCIAL:${pat.source}`);
      }
    }

    // 4. Check Informational
    let isInformational = false;
    for (const pat of this.INFORMATIONAL_PATTERNS) {
      if (pat.test(raw)) {
        isInformational = true;
        matchedPatterns.push(`INFORMATIONAL:${pat.source}`);
      }
    }

    // High Value Keywords
    let hasHighValueTokens = false;
    for (const pat of this.HIGH_VALUE_PATTERNS) {
      if (pat.test(raw)) {
        hasHighValueTokens = true;
        matchedPatterns.push(`HIGH_VALUE:${pat.source}`);
      }
    }

    // Decision Logic
    if (isTransactional) {
      return {
        searchIntent: SearchIntent.TRANSACTIONAL,
        intentConfidence: 0.88,
        funnelStage: FunnelStage.BOFU,
        businessValue: BusinessValueTier.TIER_1_CRITICAL,
        conversionIntent: true,
        moneyKeyword: true,
        conversionGoal: 'Demo Request / Direct Checkout',
        matchedPatterns,
      };
    }

    if (isCommercial) {
      return {
        searchIntent: SearchIntent.COMMERCIAL,
        intentConfidence: 0.85,
        funnelStage: FunnelStage.MOFU,
        businessValue: hasHighValueTokens ? BusinessValueTier.TIER_1_CRITICAL : BusinessValueTier.TIER_2_HIGH,
        conversionIntent: true,
        moneyKeyword: hasHighValueTokens,
        conversionGoal: 'Solution Comparison / Trial Signup',
        matchedPatterns,
      };
    }

    if (isInformational || raw.split(' ').length > 4) {
      return {
        searchIntent: SearchIntent.INFORMATIONAL,
        intentConfidence: isInformational ? 0.9 : 0.75,
        funnelStage: FunnelStage.TOFU,
        businessValue: hasHighValueTokens ? BusinessValueTier.TIER_3_MEDIUM : BusinessValueTier.TIER_4_LOW,
        conversionIntent: false,
        moneyKeyword: false,
        conversionGoal: 'Newsletter / Content Engagement',
        matchedPatterns,
      };
    }

    // Default Fallback
    return {
      searchIntent: SearchIntent.INFORMATIONAL,
      intentConfidence: 0.7,
      funnelStage: FunnelStage.TOFU,
      businessValue: hasHighValueTokens ? BusinessValueTier.TIER_2_HIGH : BusinessValueTier.TIER_3_MEDIUM,
      conversionIntent: false,
      moneyKeyword: hasHighValueTokens,
      conversionGoal: undefined,
      matchedPatterns,
    };
  }
}
