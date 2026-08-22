import { ISerpProvider } from './serpProvider';
import { MockSerpProvider } from './mockSerpProvider';
import { DataForSeoAdapter } from './dataForSeoAdapter';
import { SerpApiAdapter } from './serpApiAdapter';

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
        return this.customProviders.get(upper)!;
      }
      if (upper === 'DATAFORSEO' && this.dataForSeo.isConfigured()) {
        return this.dataForSeo;
      }
      if (upper === 'SERPAPI' && this.serpApi.isConfigured()) {
        return this.serpApi;
      }
    }

    if (this.dataForSeo.isConfigured()) {
      return this.dataForSeo;
    }
    if (this.serpApi.isConfigured()) {
      return this.serpApi;
    }

    return this.mockProvider;
  }
}
