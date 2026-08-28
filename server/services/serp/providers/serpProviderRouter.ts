import { ISerpProvider } from './serpProvider';
import { MockSerpProvider } from './mockSerpProvider';
import { DataForSeoAdapter } from './dataForSeoAdapter';
import { SerpApiAdapter } from './serpApiAdapter';
import { isProductionMode } from '../../../config/runtimeMode';

export class SerpProviderRouter {
  private static mockProvider: ISerpProvider = new MockSerpProvider();
  private static dataForSeo: ISerpProvider = new DataForSeoAdapter();
  private static serpApi: ISerpProvider = new SerpApiAdapter();
  private static customProviders = new Map<string, ISerpProvider>();

  static registerProvider(provider: ISerpProvider): void {
    this.customProviders.set(provider.providerName.toUpperCase(), provider);
  }

  static getProvider(preferred?: string): ISerpProvider {
    if (preferred) {
      const upper = preferred.toUpperCase();
      if (this.customProviders.has(upper)) {
        const custom = this.customProviders.get(upper)!;
        if (custom.isConfigured() || !isProductionMode()) {
          return custom;
        }
      }
      if (upper === 'DATAFORSEO') {
        if (this.dataForSeo.isConfigured()) return this.dataForSeo;
        if (isProductionMode()) {
          throw new Error('SERP_PROVIDER_UNAVAILABLE: DataForSEO provider requested but not configured in PRODUCTION mode.');
        }
      }
      if (upper === 'SERPAPI') {
        if (this.serpApi.isConfigured()) return this.serpApi;
        if (isProductionMode()) {
          throw new Error('SERP_PROVIDER_UNAVAILABLE: SerpApi provider requested but not configured in PRODUCTION mode.');
        }
      }
    }

    if (this.dataForSeo.isConfigured()) {
      return this.dataForSeo;
    }
    if (this.serpApi.isConfigured()) {
      return this.serpApi;
    }

    if (isProductionMode()) {
      throw new Error('SERP_PROVIDER_UNAVAILABLE: No live SERP provider (DataForSEO / SerpApi) is configured in PRODUCTION mode.');
    }

    return this.mockProvider;
  }
}
