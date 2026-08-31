import {
  ICmsActionProvider,
  CmsPlatformType,
  CmsProviderMode,
  CmsOperationResult,
  CmsConnectionConfig,
} from './cmsActionProviderInterface';
import { WordPressSimulationProvider } from './wordPressSimulationProvider';
import { WordPressProductionProvider } from './wordPressProductionProvider';
import { isProductionMode } from '../../../config/runtimeMode';

export class WordPressCmsProvider implements ICmsActionProvider {
  readonly platform: CmsPlatformType = 'WORDPRESS';
  readonly mode: CmsProviderMode;
  private delegate: ICmsActionProvider;

  constructor(mode?: CmsProviderMode, config?: CmsConnectionConfig) {
    this.mode = mode || (isProductionMode() ? 'PRODUCTION' : 'SIMULATION');
    if (this.mode === 'PRODUCTION' && config && config.endpointUrl) {
      this.delegate = new WordPressProductionProvider(config);
    } else {
      this.delegate = new WordPressSimulationProvider(config);
    }
  }

  testConnection(websiteId: string, domain: string, config?: CmsConnectionConfig) {
    return this.delegate.testConnection(websiteId, domain, config);
  }

  getCanonicalUrl(targetUrl: string) {
    return this.delegate.getCanonicalUrl(targetUrl);
  }

  setCanonicalUrl(targetUrl: string, canonicalUrl: string) {
    return this.delegate.setCanonicalUrl(targetUrl, canonicalUrl);
  }

  revertCanonicalUrl(targetUrl: string, previousCanonicalUrl: string | null) {
    return this.delegate.revertCanonicalUrl(targetUrl, previousCanonicalUrl);
  }

  getMetaTags(targetUrl: string) {
    return this.delegate.getMetaTags(targetUrl);
  }

  setMetaTags(targetUrl: string, meta: { title?: string; description?: string; robotsMeta?: string }) {
    return this.delegate.setMetaTags(targetUrl, meta);
  }

  revertMetaTags(targetUrl: string, previousMeta: { title?: string | null; description?: string | null; robotsMeta?: string | null }) {
    return this.delegate.revertMetaTags(targetUrl, previousMeta);
  }

  getStructuredData(targetUrl: string) {
    return this.delegate.getStructuredData(targetUrl);
  }

  injectStructuredData(targetUrl: string, schema: Record<string, any>) {
    return this.delegate.injectStructuredData(targetUrl, schema);
  }

  revertStructuredData(targetUrl: string, previousSchemas: Record<string, any>[]) {
    return this.delegate.revertStructuredData(targetUrl, previousSchemas);
  }

  getRedirectRule(sourceUrl: string) {
    return this.delegate.getRedirectRule(sourceUrl);
  }

  createRedirectRule(sourceUrl: string, destinationUrl: string, statusCode?: number) {
    return this.delegate.createRedirectRule(sourceUrl, destinationUrl, statusCode);
  }

  revertRedirectRule(sourceUrl: string, previousRule: { destinationUrl: string; statusCode: number } | null) {
    return this.delegate.revertRedirectRule(sourceUrl, previousRule);
  }

  getInternalLinks(sourceUrl: string) {
    return this.delegate.getInternalLinks(sourceUrl);
  }

  injectInternalLink(sourceUrl: string, targetUrl: string, anchorText: string) {
    return this.delegate.injectInternalLink(sourceUrl, targetUrl, anchorText);
  }

  revertInternalLinks(sourceUrl: string, previousLinks: Array<{ targetUrl: string; anchorText: string }>) {
    return this.delegate.revertInternalLinks(sourceUrl, previousLinks);
  }
}
