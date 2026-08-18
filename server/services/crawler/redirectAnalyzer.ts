export interface RedirectHop {
  sourceUrl: string;
  destinationUrl: string;
  statusCode: number;
  hopIndex: number;
}

export interface RedirectAnalysisResult {
  hasRedirect: boolean;
  redirectCount: number;
  initialUrl: string;
  finalUrl: string;
  chain: RedirectHop[];
  isLoop: boolean;
  isTooLong: boolean;
  isDowngradeToHttp: boolean;
  hasErrors: boolean;
  errorReason?: string;
}

export class RedirectAnalyzer {
  public static readonly MAX_RECOMMENDED_HOPS = 3;
  public static readonly MAX_PERMISSIBLE_HOPS = 5;

  public static analyze(chain: RedirectHop[], initialUrl: string, finalUrl: string): RedirectAnalysisResult {
    const redirectCount = chain.length;
    const hasRedirect = redirectCount > 0;

    let isLoop = false;
    const visitedUrls = new Set<string>();

    for (const hop of chain) {
      if (visitedUrls.has(hop.sourceUrl)) {
        isLoop = true;
        break;
      }
      visitedUrls.add(hop.sourceUrl);
    }

    if (visitedUrls.has(finalUrl)) {
      isLoop = true;
    }

    const isTooLong = redirectCount > this.MAX_RECOMMENDED_HOPS;
    let isDowngradeToHttp = false;

    try {
      const initProtocol = new URL(initialUrl).protocol;
      const finalProtocol = new URL(finalUrl).protocol;
      if (initProtocol === 'https:' && finalProtocol === 'http:') {
        isDowngradeToHttp = true;
      }
    } catch {
      // url parse error
    }

    let errorReason: string | undefined;
    if (isLoop) {
      errorReason = 'Redirect loop detected in execution path';
    } else if (redirectCount >= this.MAX_PERMISSIBLE_HOPS) {
      errorReason = `Redirect chain exceeded limit of ${this.MAX_PERMISSIBLE_HOPS} hops`;
    } else if (isDowngradeToHttp) {
      errorReason = 'Redirect downgrades from secure HTTPS to unencrypted HTTP';
    }

    return {
      hasRedirect,
      redirectCount,
      initialUrl,
      finalUrl,
      chain,
      isLoop,
      isTooLong,
      isDowngradeToHttp,
      hasErrors: Boolean(isLoop || isDowngradeToHttp || redirectCount >= this.MAX_PERMISSIBLE_HOPS),
      errorReason,
    };
  }
}
