export type CmsPlatformType = 'WORDPRESS' | 'SHOPIFY' | 'CUSTOM_API' | 'STATIC_SITE';
export type CmsProviderMode = 'SIMULATION' | 'SANDBOX' | 'PRODUCTION';

export interface CmsConnectionConfig {
  apiKey?: string;
  apiSecret?: string;
  endpointUrl?: string;
  webhookUrl?: string;
  accessToken?: string;
  username?: string;
  applicationPassword?: string;
  shopDomain?: string;
  branchName?: string;
  repository?: string;
}

export interface CmsOperationResult<T = any> {
  success: boolean;
  provider: CmsPlatformType;
  appliedData: T;
  rawResponse?: any;
  message?: string;
  diffSummary?: string;
  targetUrl: string;
  executedAt: Date;
}

export interface ICmsActionProvider {
  readonly platform: CmsPlatformType;
  readonly mode: CmsProviderMode;

  /**
   * Validates credentials and verifies connectivity to the CMS/Platform.
   */
  testConnection(websiteId: string, domain: string, config?: CmsConnectionConfig): Promise<{
    connected: boolean;
    version?: string;
    message?: string;
  }>;

  // --- Canonical Operations ---
  getCanonicalUrl(targetUrl: string): Promise<string | null>;
  setCanonicalUrl(targetUrl: string, canonicalUrl: string): Promise<CmsOperationResult<{ canonicalUrl: string }>>;
  revertCanonicalUrl(targetUrl: string, previousCanonicalUrl: string | null): Promise<CmsOperationResult<{ canonicalUrl: string | null }>>;

  // --- Meta Tags Operations ---
  getMetaTags(targetUrl: string): Promise<{ title?: string | null; description?: string | null; robotsMeta?: string | null }>;
  setMetaTags(targetUrl: string, meta: { title?: string; description?: string; robotsMeta?: string }): Promise<CmsOperationResult<{ title?: string; description?: string; robotsMeta?: string }>>;
  revertMetaTags(targetUrl: string, previousMeta: { title?: string | null; description?: string | null; robotsMeta?: string | null }): Promise<CmsOperationResult>;

  // --- Structured Data / Schema Operations ---
  getStructuredData(targetUrl: string): Promise<Record<string, any>[]>;
  injectStructuredData(targetUrl: string, schema: Record<string, any>): Promise<CmsOperationResult<{ schema: Record<string, any> }>>;
  revertStructuredData(targetUrl: string, previousSchemas: Record<string, any>[]): Promise<CmsOperationResult<{ schemas: Record<string, any>[] }>>;

  // --- URL Redirect Operations ---
  getRedirectRule(sourceUrl: string): Promise<{ destinationUrl: string; statusCode: number } | null>;
  createRedirectRule(sourceUrl: string, destinationUrl: string, statusCode?: number): Promise<CmsOperationResult<{ sourceUrl: string; destinationUrl: string; statusCode: number }>>;
  revertRedirectRule(sourceUrl: string, previousRule: { destinationUrl: string; statusCode: number } | null): Promise<CmsOperationResult>;

  // --- Internal Link Injection Operations ---
  getInternalLinks(sourceUrl: string): Promise<Array<{ targetUrl: string; anchorText: string }>>;
  injectInternalLink(sourceUrl: string, targetUrl: string, anchorText: string): Promise<CmsOperationResult<{ sourceUrl: string; targetUrl: string; anchorText: string }>>;
  revertInternalLinks(sourceUrl: string, previousLinks: Array<{ targetUrl: string; anchorText: string }>): Promise<CmsOperationResult>;
}
