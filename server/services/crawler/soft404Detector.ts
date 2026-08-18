export interface Soft404Evaluation {
  isPossibleSoft404: boolean;
  confidenceScore: number;
  signalsDetected: string[];
}

export class Soft404Detector {
  private static readonly NOT_FOUND_PATTERNS = [
    /\b404\s+not\s+found\b/i,
    /\bpage\s+not\s+found\b/i,
    /\bpage\s+cannot\s+be\s+found\b/i,
    /\bthis\s+page\s+does\s+not\s+exist\b/i,
    /\bwe\s+couldn't\s+find\s+that\s+page\b/i,
    /\berror\s+404\b/i,
    /\bthe\s+requested\s+url\s+was\s+not\s+found\b/i,
  ];

  public static evaluate(page: {
    statusCode: number;
    title: string | null;
    h1Tags: string[];
    visibleText: string;
    wordCount: number;
  }): Soft404Evaluation {
    const signals: string[] = [];
    let score = 0;

    // Only 200 OK responses can be Soft 404s
    if (page.statusCode !== 200) {
      return {
        isPossibleSoft404: false,
        confidenceScore: 0,
        signalsDetected: [],
      };
    }

    // Title signal
    if (page.title) {
      for (const pattern of this.NOT_FOUND_PATTERNS) {
        if (pattern.test(page.title)) {
          signals.push(`Title tag contains explicit not-found phrasing: "${page.title}"`);
          score += 0.45;
          break;
        }
      }
    }

    // H1 signal
    for (const h1 of page.h1Tags) {
      for (const pattern of this.NOT_FOUND_PATTERNS) {
        if (pattern.test(h1)) {
          signals.push(`H1 heading contains not-found phrasing: "${h1}"`);
          score += 0.35;
          break;
        }
      }
    }

    // Body copy signals
    if (page.wordCount < 60) {
      signals.push(`Extremely thin content volume (${page.wordCount} words) on HTTP 200 response`);
      score += 0.2;
    }

    for (const pattern of this.NOT_FOUND_PATTERNS) {
      if (pattern.test(page.visibleText)) {
        signals.push('Body copy contains explicit not-found or page missing phrasing');
        score += 0.25;
        break;
      }
    }

    const normalizedScore = Math.min(1.0, Math.round(score * 100) / 100);
    const isPossibleSoft404 = normalizedScore >= 0.55;

    return {
      isPossibleSoft404,
      confidenceScore: normalizedScore,
      signalsDetected: signals,
    };
  }
}
