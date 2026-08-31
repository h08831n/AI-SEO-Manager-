import {
  ICmsActionProvider,
  CmsPlatformType,
  CmsProviderMode,
  CmsOperationResult,
  CmsConnectionConfig,
} from './cmsActionProviderInterface';

export class WordPressSimulationProvider implements ICmsActionProvider {
  readonly platform: CmsPlatformType = 'WORDPRESS';
  readonly mode: CmsProviderMode = 'SIMULATION';
  private config?: CmsConnectionConfig;

  // In-memory backing store for sandbox / simulation
  private deployedCanonicals: Map<string, string> = new Map();
  private deployedMeta: Map<string, { title?: string; description?: string; robotsMeta?: string }> = new Map();
  private deployedSchemas: Map<string, Record<string, any>[]> = new Map();
  private deployedRedirects: Map<string, { destinationUrl: string; statusCode: number }> = new Map();
  private deployedLinks: Map<string, Array<{ targetUrl: string; anchorText: string }>> = new Map();

  constructor(config?: CmsConnectionConfig) {
    this.config = config;
  }

  async testConnection(websiteId: string, domain: string, config?: CmsConnectionConfig): Promise<{
    connected: boolean;
    version?: string;
    message?: string;
  }> {
    const activeConfig = config || this.config;
    if (activeConfig?.apiKey === 'INVALID_KEY' || activeConfig?.apiKey === 'EXPIRED_CREDENTIALS') {
      return {
        connected: false,
        message: 'WordPress REST API authentication failed: 401 Unauthorized - Invalid Application Password',
      };
    }
    if (activeConfig?.endpointUrl?.includes('invalid-wp-host') || activeConfig?.endpointUrl?.includes('500')) {
      return {
        connected: false,
        message: 'WordPress REST API endpoint unreachable: 500 Internal Server Error',
      };
    }

    return {
      connected: true,
      version: 'WordPress 6.6.1 + Yoast SEO 23.4 (Simulation Mode)',
      message: `Verified WordPress REST API simulation connection for ${domain}`,
    };
  }

  async getCanonicalUrl(targetUrl: string): Promise<string | null> {
    return this.deployedCanonicals.get(targetUrl) || null;
  }

  async setCanonicalUrl(targetUrl: string, canonicalUrl: string): Promise<CmsOperationResult<{ canonicalUrl: string }>> {
    this.deployedCanonicals.set(targetUrl, canonicalUrl);
    return {
      success: true,
      provider: this.platform,
      targetUrl,
      appliedData: { canonicalUrl },
      rawResponse: {
        status: 200,
        wpObjectId: 'sim-post-1',
        capabilityUsed: 'SIMULATION_YOAST_CANONICAL',
        observedResponse: { canonicalUrl },
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Simulation] Updated post canonical URL to ${canonicalUrl}`,
      diffSummary: `WP Canonical: -> ${canonicalUrl}`,
      executedAt: new Date(),
    };
  }

  async revertCanonicalUrl(targetUrl: string, previousCanonicalUrl: string | null): Promise<CmsOperationResult<{ canonicalUrl: string | null }>> {
    if (previousCanonicalUrl) {
      this.deployedCanonicals.set(targetUrl, previousCanonicalUrl);
    } else {
      this.deployedCanonicals.delete(targetUrl);
    }
    return {
      success: true,
      provider: this.platform,
      targetUrl,
      appliedData: { canonicalUrl: previousCanonicalUrl },
      rawResponse: {
        status: 200,
        wpObjectId: 'sim-post-1',
        capabilityUsed: 'SIMULATION_YOAST_CANONICAL_REVERT',
        observedResponse: { canonicalUrl: previousCanonicalUrl },
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Simulation] Reverted canonical tag on ${targetUrl}`,
      executedAt: new Date(),
    };
  }

  async getMetaTags(targetUrl: string): Promise<{ title?: string | null; description?: string | null; robotsMeta?: string | null }> {
    const meta = this.deployedMeta.get(targetUrl);
    return {
      title: meta?.title || null,
      description: meta?.description || null,
      robotsMeta: meta?.robotsMeta || null,
    };
  }

  async setMetaTags(
    targetUrl: string,
    meta: { title?: string; description?: string; robotsMeta?: string }
  ): Promise<CmsOperationResult<{ title?: string; description?: string; robotsMeta?: string }>> {
    const current = this.deployedMeta.get(targetUrl) || {};
    const updated = {
      title: meta.title !== undefined ? meta.title : current.title,
      description: meta.description !== undefined ? meta.description : current.description,
      robotsMeta: meta.robotsMeta !== undefined ? meta.robotsMeta : current.robotsMeta,
    };
    this.deployedMeta.set(targetUrl, updated);

    return {
      success: true,
      provider: this.platform,
      targetUrl,
      appliedData: updated,
      rawResponse: {
        status: 200,
        wpObjectId: 'sim-post-1',
        capabilityUsed: 'SIMULATION_YOAST_META',
        observedResponse: updated,
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Simulation] Updated SEO title and description for ${targetUrl}`,
      diffSummary: `WP Title: "${updated.title || ''}" | WP Desc: "${updated.description || ''}"`,
      executedAt: new Date(),
    };
  }

  async revertMetaTags(
    targetUrl: string,
    previousMeta: { title?: string | null; description?: string | null; robotsMeta?: string | null }
  ): Promise<CmsOperationResult> {
    if (previousMeta.title || previousMeta.description || previousMeta.robotsMeta) {
      this.deployedMeta.set(targetUrl, {
        title: previousMeta.title || undefined,
        description: previousMeta.description || undefined,
        robotsMeta: previousMeta.robotsMeta || undefined,
      });
    } else {
      this.deployedMeta.delete(targetUrl);
    }
    return {
      success: true,
      provider: this.platform,
      targetUrl,
      appliedData: previousMeta,
      rawResponse: {
        status: 200,
        wpObjectId: 'sim-post-1',
        capabilityUsed: 'SIMULATION_YOAST_META_REVERT',
        observedResponse: previousMeta,
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Simulation] Reverted SEO metadata on ${targetUrl}`,
      executedAt: new Date(),
    };
  }

  async getStructuredData(targetUrl: string): Promise<Record<string, any>[]> {
    return this.deployedSchemas.get(targetUrl) || [];
  }

  async injectStructuredData(
    targetUrl: string,
    schema: Record<string, any>
  ): Promise<CmsOperationResult<{ schema: Record<string, any> }>> {
    const schemas = this.deployedSchemas.get(targetUrl) || [];
    schemas.push(schema);
    this.deployedSchemas.set(targetUrl, schemas);

    return {
      success: true,
      provider: this.platform,
      targetUrl,
      appliedData: { schema },
      rawResponse: {
        status: 200,
        wpObjectId: 'sim-post-1',
        capabilityUsed: 'SIMULATION_SCHEMA_INJECTION',
        observedResponse: { schema },
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Simulation] Injected JSON-LD structured data into header on ${targetUrl}`,
      diffSummary: `WP Schema: +${schema['@type'] || 'CustomSchema'}`,
      executedAt: new Date(),
    };
  }

  async revertStructuredData(
    targetUrl: string,
    previousSchemas: Record<string, any>[]
  ): Promise<CmsOperationResult<{ schemas: Record<string, any>[] }>> {
    this.deployedSchemas.set(targetUrl, previousSchemas);
    return {
      success: true,
      provider: this.platform,
      targetUrl,
      appliedData: { schemas: previousSchemas },
      rawResponse: {
        status: 200,
        wpObjectId: 'sim-post-1',
        capabilityUsed: 'SIMULATION_SCHEMA_REVERT',
        observedResponse: { schemas: previousSchemas },
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Simulation] Reverted structured data schemas on ${targetUrl}`,
      executedAt: new Date(),
    };
  }

  async getRedirectRule(sourceUrl: string): Promise<{ destinationUrl: string; statusCode: number } | null> {
    return this.deployedRedirects.get(sourceUrl) || null;
  }

  async createRedirectRule(
    sourceUrl: string,
    destinationUrl: string,
    statusCode: number = 301
  ): Promise<CmsOperationResult<{ sourceUrl: string; destinationUrl: string; statusCode: number }>> {
    this.deployedRedirects.set(sourceUrl, { destinationUrl, statusCode });
    return {
      success: true,
      provider: this.platform,
      targetUrl: sourceUrl,
      appliedData: { sourceUrl, destinationUrl, statusCode },
      rawResponse: {
        status: 200,
        wpObjectId: 'sim-redirect-1',
        capabilityUsed: 'SIMULATION_REDIRECT_RULE',
        observedResponse: { sourceUrl, destinationUrl, statusCode },
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Simulation] Created ${statusCode} redirect from ${sourceUrl} to ${destinationUrl}`,
      diffSummary: `WP 301 Redirect: ${sourceUrl} -> ${destinationUrl}`,
      executedAt: new Date(),
    };
  }

  async revertRedirectRule(
    sourceUrl: string,
    previousRule: { destinationUrl: string; statusCode: number } | null
  ): Promise<CmsOperationResult> {
    if (previousRule) {
      this.deployedRedirects.set(sourceUrl, previousRule);
    } else {
      this.deployedRedirects.delete(sourceUrl);
    }
    return {
      success: true,
      provider: this.platform,
      targetUrl: sourceUrl,
      appliedData: previousRule,
      rawResponse: {
        status: 200,
        wpObjectId: 'sim-redirect-1',
        capabilityUsed: 'SIMULATION_REDIRECT_REVERT',
        observedResponse: previousRule,
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Simulation] Reverted redirect rule for ${sourceUrl}`,
      executedAt: new Date(),
    };
  }

  async getInternalLinks(sourceUrl: string): Promise<Array<{ targetUrl: string; anchorText: string }>> {
    return this.deployedLinks.get(sourceUrl) || [];
  }

  async injectInternalLink(
    sourceUrl: string,
    targetUrl: string,
    anchorText: string
  ): Promise<CmsOperationResult<{ sourceUrl: string; targetUrl: string; anchorText: string }>> {
    const links = this.deployedLinks.get(sourceUrl) || [];
    links.push({ targetUrl, anchorText });
    this.deployedLinks.set(sourceUrl, links);

    return {
      success: true,
      provider: this.platform,
      targetUrl: sourceUrl,
      appliedData: { sourceUrl, targetUrl, anchorText },
      rawResponse: {
        status: 200,
        wpObjectId: 'sim-post-1',
        capabilityUsed: 'SIMULATION_INTERNAL_LINK',
        observedResponse: { sourceUrl, targetUrl, anchorText },
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Simulation] Injected internal contextual hyperlink to ${targetUrl}`,
      diffSummary: `WP Link: [${anchorText}](${targetUrl})`,
      executedAt: new Date(),
    };
  }

  async revertInternalLinks(
    sourceUrl: string,
    previousLinks: Array<{ targetUrl: string; anchorText: string }>
  ): Promise<CmsOperationResult> {
    this.deployedLinks.set(sourceUrl, previousLinks);
    return {
      success: true,
      provider: this.platform,
      targetUrl: sourceUrl,
      appliedData: { previousLinks },
      rawResponse: {
        status: 200,
        wpObjectId: 'sim-post-1',
        capabilityUsed: 'SIMULATION_INTERNAL_LINK_REVERT',
        observedResponse: { previousLinks },
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Simulation] Reverted internal hyperlinks on ${sourceUrl}`,
      executedAt: new Date(),
    };
  }
}
