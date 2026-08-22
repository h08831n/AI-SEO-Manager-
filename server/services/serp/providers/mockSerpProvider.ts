import crypto from 'crypto';
import { ISerpProvider, SerpQueryRequest, RawSerpResponse, RawOrganicResult, RawSerpFeatureItem } from './serpProvider';
import { SerpFeatureType, SerpDevice } from '@prisma/client';

export class MockSerpProvider implements ISerpProvider {
  readonly providerName = 'MOCK_SERP_PROVIDER';

  isConfigured(): boolean {
    return true;
  }

  private hash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  async fetchSerp(req: SerpQueryRequest): Promise<RawSerpResponse> {
    const keyword = req.keyword.trim();
    const device = req.device || SerpDevice.DESKTOP;
    const countryCode = req.countryCode || 'US';
    const languageCode = req.languageCode || 'en';
    const targetDomain = (req.targetDomain || 'example.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

    const seed = this.hash(`${keyword}:${device}:${countryCode}`);
    const rawPayloadHash = crypto.createHash('sha256').update(`${keyword}:${device}:${seed}`).digest('hex');

    // Generate Competitor Pool
    const competitorDomains = [
      'competitor-alpha.com',
      'competitor-beta.io',
      'marketleader.com',
      'global-solutions.org',
      'techreview-hub.com',
      'cloudplatform.net',
      'industrystandard.co',
      'saasbenchmark.com',
      'wikipedia.org',
      'youtube.com',
    ];

    const organicResults: RawOrganicResult[] = [];
    const features: RawSerpFeatureItem[] = [];

    // 1. Determine Target Website Rank (e.g. pos 1 to 25 or unranked)
    const targetPositionIndex = (seed % 15) + 1; // 1 to 15
    const hasTargetRanking = seed % 10 !== 0; // 90% chance ranked in top 100

    let currentPixelTop = 150;

    // 2. Feature Detection: AI Overview (30% chance for informational / tech queries)
    const hasAiOverview = (seed % 3 === 0);
    if (hasAiOverview) {
      const citedUrls = [
        `https://${targetDomain}/guides/${encodeURIComponent(keyword.replace(/\s+/g, '-'))}`,
        `https://${competitorDomains[0]}/insights`,
        `https://${competitorDomains[1]}/docs`,
      ];
      features.push({
        featureType: SerpFeatureType.AI_OVERVIEW,
        position: 1,
        title: `AI Overview for ${keyword}`,
        snippet: `AI Generated synthesized summary detailing the core components of ${keyword} and industry standard implementations.`,
        sourceUrls: citedUrls,
        pixelHeight: 380,
        pixelTop: currentPixelTop,
        rawFeatureJson: JSON.stringify({ citedSourcesCount: 3, modelVersion: 'gemini-1.5-pro' }),
      });
      currentPixelTop += 400;
    }

    // 3. Feature Detection: Featured Snippet (25% chance)
    const hasFeaturedSnippet = (seed % 4 === 0) && !hasAiOverview;
    if (hasFeaturedSnippet) {
      const snippetOwner = (seed % 2 === 0) ? targetDomain : competitorDomains[0];
      features.push({
        featureType: SerpFeatureType.FEATURED_SNIPPET,
        position: 1,
        title: `Comprehensive Guide to ${keyword}`,
        snippet: `Here is a step-by-step breakdown: 1. Architecture analysis. 2. Automated crawler ingestion. 3. Real-time metric correlation.`,
        targetUrl: `https://${snippetOwner}/blog/${encodeURIComponent(keyword.replace(/\s+/g, '-'))}`,
        domain: snippetOwner,
        sourceUrls: [`https://${snippetOwner}`],
        pixelHeight: 220,
        pixelTop: currentPixelTop,
      });
      currentPixelTop += 240;
    }

    // 4. Feature Detection: People Also Ask (60% chance)
    if (seed % 5 !== 0) {
      features.push({
        featureType: SerpFeatureType.PEOPLE_ALSO_ASK,
        position: hasAiOverview || hasFeaturedSnippet ? 3 : 2,
        title: 'People Also Ask',
        snippet: `What is the best way to optimize ${keyword}? How much does ${keyword} cost?`,
        pixelHeight: 180,
        pixelTop: currentPixelTop,
      });
      currentPixelTop += 190;
    }

    // 5. Generate 10 Organic Results
    let rankCounter = 1;
    for (let i = 0; i < 10; i++) {
      let resultDomain: string;
      let resultUrl: string;

      if (hasTargetRanking && i + 1 === targetPositionIndex) {
        resultDomain = targetDomain;
        resultUrl = `https://${targetDomain}/solutions/${encodeURIComponent(keyword.replace(/\s+/g, '-'))}`;
      } else {
        const compIndex = (i + seed) % competitorDomains.length;
        resultDomain = competitorDomains[compIndex];
        resultUrl = `https://${resultDomain}/articles/${encodeURIComponent(keyword.replace(/\s+/g, '-'))}`;
      }

      organicResults.push({
        position: rankCounter,
        domain: resultDomain,
        url: resultUrl,
        title: `${keyword.toUpperCase()} - Official Guide & Platform | ${resultDomain}`,
        snippet: `Learn everything about ${keyword}. Compare features, integration speed, and enterprise reliability on ${resultDomain}.`,
        displayUrl: `${resultDomain} > solutions > ${keyword.toLowerCase()}`,
        pixelTop: currentPixelTop,
        pixelHeight: 110,
      });

      currentPixelTop += 120;
      rankCounter++;
    }

    // Short-term JSON payload for audit/debugging
    const rawJson = JSON.stringify({
      query: keyword,
      device,
      country: countryCode,
      organicCount: organicResults.length,
      featuresCount: features.length,
      generatedAt: new Date().toISOString(),
    });

    return {
      provider: this.providerName,
      keyword,
      device,
      countryCode,
      languageCode,
      totalResults: BigInt(12500000),
      searchEngine: 'google',
      organicResults,
      features,
      rawPayloadHash,
      rawJson,
      retrievedAt: new Date(),
    };
  }
}
