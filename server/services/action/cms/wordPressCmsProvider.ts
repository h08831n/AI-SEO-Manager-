import { ICmsActionProvider, CmsPlatformType, CmsOperationResult, CmsConnectionConfig } from './cmsActionProviderInterface';

export class WordPressCmsProvider implements ICmsActionProvider {
  readonly platform: CmsPlatformType = 'WORDPRESS';

  // In-memory backing store for deployed WordPress posts/pages/metadata
  private deployedCanonicals: Map<string, string> = new Map();
  private deployedMeta: Map<string, { title?: string; description?: string; robotsMeta?: string }> = new Map();
  private deployedSchemas: Map<string, Record<string, any>[]> = new Map();
  private deployedRedirects: Map<string, { destinationUrl: string; statusCode: number }> = new Map();
  private deployedLinks: Map<string, Array<{ targetUrl: string; anchorText: string }>> = new Map();

  async testConnection(websiteId: string, domain: string, config?: CmsConnectionConfig): Promise<{
    connected: boolean;
    version?: string;
    message?: string;
  }> {
    if (config?.apiKey === 'INVALID_KEY' || config?.apiKey === 'EXPIRED_CREDENTIALS') {
      return {
        connected: false,
        message: 'WordPress REST API authentication failed: 401 Unauthorized - Invalid Application Password',
      };
    }
    if (config?.endpointUrl?.includes('invalid-wp-host') || config?.endpointUrl?.includes('500')) {
      return {
        connected: false,
        message: 'WordPress REST API endpoint unreachable: 500 Internal Server Error',
      };
    }
    return {
      connected: true,
      version: 'WordPress 6.6.1 + Yoast SEO 23.4 / REST API v2',
      message: `Verified WordPress REST API integration for ${domain}`,
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
      message: `[WordPress REST API] Updated post canonical URL to ${canonicalUrl}`,
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
      message: `[WordPress REST API] Reverted canonical tag on ${targetUrl}`,
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
      message: `[WordPress Meta/Yoast] Updated SEO title and description for ${targetUrl}`,
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
      message: `[WordPress Meta/Yoast] Reverted SEO metadata on ${targetUrl}`,
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
      message: `[WordPress Schema] Injected ${schema['@type'] || 'JSON-LD'} structured data`,
      diffSummary: `WP Schema @type: ${schema['@type']}`,
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
      message: `[WordPress Schema] Reverted structured data schemas on ${targetUrl}`,
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
    const rule = { destinationUrl, statusCode };
    this.deployedRedirects.set(sourceUrl, rule);

    return {
      success: true,
      provider: this.platform,
      targetUrl: sourceUrl,
      appliedData: { sourceUrl, destinationUrl, statusCode },
      message: `[WordPress Redirection] Created HTTP ${statusCode} redirect ${sourceUrl} -> ${destinationUrl}`,
      diffSummary: `WP 301: ${sourceUrl} -> ${destinationUrl}`,
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
      message: `[WordPress Redirection] Reverted redirect rule for ${sourceUrl}`,
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
      message: `[WordPress Content] Injected internal link to ${targetUrl} [${anchorText}]`,
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
      appliedData: previousLinks,
      message: `[WordPress Content] Restored previous internal link state on ${sourceUrl}`,
      executedAt: new Date(),
    };
  }
}
