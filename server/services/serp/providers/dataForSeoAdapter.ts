import crypto from 'crypto';
import { ISerpProvider, SerpQueryRequest, RawSerpResponse, RawOrganicResult, RawSerpFeatureItem } from './serpProvider';
import { SerpFeatureType, SerpDevice } from '@prisma/client';
import { MockSerpProvider } from './mockSerpProvider';
import { isProductionMode } from '../../../config/runtimeMode';

export class DataForSeoAdapter implements ISerpProvider {
  readonly providerName = 'DATAFORSEO';

  isConfigured(): boolean {
    return !!process.env.DATAFORSEO_API_LOGIN && !!process.env.DATAFORSEO_API_PASSWORD;
  }

  async fetchSerp(req: SerpQueryRequest): Promise<RawSerpResponse> {
    if (!this.isConfigured()) {
      if (isProductionMode()) {
        throw new Error('SERP_PROVIDER_NOT_CONFIGURED: DataForSEO API credentials missing in PRODUCTION mode.');
      }
      const mock = new MockSerpProvider();
      const res = await mock.fetchSerp(req);
      return { ...res, provider: this.providerName, dataProvenance: 'MOCK' };
    }

    const auth = Buffer.from(
      `${process.env.DATAFORSEO_API_LOGIN}:${process.env.DATAFORSEO_API_PASSWORD}`
    ).toString('base64');

    const postData = [
      {
        keyword: req.keyword,
        location_code: 2840, // US
        language_code: req.languageCode || 'en',
        device: req.device === SerpDevice.MOBILE ? 'mobile' : 'desktop',
        depth: 100,
      },
    ];

    try {
      const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        throw new Error(`DataForSEO API error: ${response.status} ${response.statusText}`);
      }

      const json: any = await response.json();
      const task = json.tasks?.[0];
      const items = task?.result?.[0]?.items || [];

      const organicResults: RawOrganicResult[] = [];
      const features: RawSerpFeatureItem[] = [];

      for (const item of items) {
        if (item.type === 'organic') {
          organicResults.push({
            position: item.rank_group || item.rank_absolute,
            url: item.url,
            domain: item.domain,
            title: item.title,
            snippet: item.description,
            displayUrl: item.breadcrumb,
            pixelTop: item.rectangle?.y,
            pixelHeight: item.rectangle?.height,
          });
        } else if (item.type === 'featured_snippet') {
          features.push({
            featureType: SerpFeatureType.FEATURED_SNIPPET,
            position: 1,
            title: item.title,
            snippet: item.description,
            targetUrl: item.url,
            domain: item.domain,
            sourceUrls: item.url ? [item.url] : [],
          });
        } else if (item.type === 'people_also_ask') {
          features.push({
            featureType: SerpFeatureType.PEOPLE_ALSO_ASK,
            position: item.rank_group || 2,
            title: 'People Also Ask',
            snippet: item.items?.map((i: any) => i.title).join(' | '),
          });
        } else if (item.type === 'ai_overview' || item.type === 'generative_ai') {
          features.push({
            featureType: SerpFeatureType.AI_OVERVIEW,
            position: 1,
            title: 'AI Overview',
            snippet: item.description,
            sourceUrls: item.items?.map((i: any) => i.url).filter(Boolean) || [],
          });
        }
      }

      const rawJson = JSON.stringify(json);
      const rawPayloadHash = crypto.createHash('sha256').update(rawJson).digest('hex');

      return {
        provider: this.providerName,
        keyword: req.keyword,
        device: req.device || SerpDevice.DESKTOP,
        countryCode: req.countryCode || 'US',
        languageCode: req.languageCode || 'en',
        totalResults: BigInt(task?.result?.[0]?.se_results_count || 0),
        searchEngine: 'google',
        organicResults,
        features,
        rawPayloadHash,
        rawJson,
        retrievedAt: new Date(),
        dataProvenance: 'LIVE',
      };
    } catch (err: any) {
      if (isProductionMode()) {
        throw new Error(`SERP_FETCH_FAILED: DataForSEO query failed in PRODUCTION mode: ${err.message}`);
      }
      console.warn(`[DataForSeoAdapter] Live call failed, falling back to mock in non-prod:`, err.message);
      const mock = new MockSerpProvider();
      const res = await mock.fetchSerp(req);
      return { ...res, provider: this.providerName, dataProvenance: 'MOCK' };
    }
  }
}
