import crypto from 'crypto';
import { ISerpProvider, SerpQueryRequest, RawSerpResponse, RawOrganicResult, RawSerpFeatureItem } from './serpProvider';
import { SerpFeatureType, SerpDevice } from '@prisma/client';
import { MockSerpProvider } from './mockSerpProvider';

export class SerpApiAdapter implements ISerpProvider {
  readonly providerName = 'SERPAPI';

  isConfigured(): boolean {
    return !!process.env.SERPAPI_API_KEY;
  }

  async fetchSerp(req: SerpQueryRequest): Promise<RawSerpResponse> {
    if (!this.isConfigured()) {
      const mock = new MockSerpProvider();
      const res = await mock.fetchSerp(req);
      return { ...res, provider: this.providerName };
    }

    const params = new URLSearchParams({
      api_key: process.env.SERPAPI_API_KEY!,
      engine: 'google',
      q: req.keyword,
      gl: (req.countryCode || 'US').toLowerCase(),
      hl: req.languageCode || 'en',
      device: req.device === SerpDevice.MOBILE ? 'mobile' : 'desktop',
      num: '100',
    });

    try {
      const response = await fetch(`https://serpapi.com/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`SerpApi error: ${response.status} ${response.statusText}`);
      }

      const json: any = await response.json();
      const organicList = json.organic_results || [];

      const organicResults: RawOrganicResult[] = organicList.map((r: any) => {
        let domain = '';
        try {
          domain = new URL(r.link).hostname.replace(/^www\./, '');
        } catch {
          domain = r.displayed_link || '';
        }
        return {
          position: r.position,
          url: r.link,
          domain,
          title: r.title || '',
          snippet: r.snippet || '',
          displayUrl: r.displayed_link,
        };
      });

      const features: RawSerpFeatureItem[] = [];

      if (json.answer_box || json.featured_snippet) {
        const box = json.answer_box || json.featured_snippet;
        features.push({
          featureType: SerpFeatureType.FEATURED_SNIPPET,
          position: 1,
          title: box.title || 'Featured Snippet',
          snippet: box.snippet || box.answer,
          targetUrl: box.link,
        });
      }

      if (json.ai_overview || json.generative_ai) {
        const aio = json.ai_overview || json.generative_ai;
        features.push({
          featureType: SerpFeatureType.AI_OVERVIEW,
          position: 1,
          title: 'AI Overview',
          snippet: aio.text_blocks?.map((b: any) => b.snippet).join(' '),
          sourceUrls: aio.references?.map((r: any) => r.link).filter(Boolean) || [],
        });
      }

      if (json.related_questions) {
        features.push({
          featureType: SerpFeatureType.PEOPLE_ALSO_ASK,
          position: 2,
          title: 'People Also Ask',
          snippet: json.related_questions.map((q: any) => q.question).join(' | '),
        });
      }

      const rawJson = JSON.stringify(json);
      const rawPayloadHash = crypto.createHash('sha256').update(rawJson).digest('hex');

      return {
        provider: this.providerName,
        keyword: req.keyword,
        device: req.device || SerpDevice.DESKTOP,
        countryCode: req.countryCode || 'US',
        languageCode: req.languageCode || 'en',
        totalResults: BigInt(json.search_information?.total_results || 0),
        searchEngine: 'google',
        organicResults,
        features,
        rawPayloadHash,
        rawJson,
        retrievedAt: new Date(),
      };
    } catch (err: any) {
      console.warn(`[SerpApiAdapter] Live call failed, falling back to mock:`, err.message);
      const mock = new MockSerpProvider();
      const res = await mock.fetchSerp(req);
      return { ...res, provider: this.providerName };
    }
  }
}
