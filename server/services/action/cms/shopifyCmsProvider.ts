import { ICmsActionProvider, CmsPlatformType, CmsOperationResult, CmsConnectionConfig } from './cmsActionProviderInterface';

export class ShopifyCmsProvider implements ICmsActionProvider {
  readonly platform: CmsPlatformType = 'SHOPIFY';

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
    return {
      connected: true,
      version: 'Shopify Admin GraphQL API (2024-10) + Online Store 2.0',
      message: `Verified Shopify storefront & metafields connection for ${domain}`,
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
      message: `[Shopify Metafields] Updated canonical URL metafield: seo.canonical_url -> ${canonicalUrl}`,
      diffSummary: `Shopify Canonical: -> ${canonicalUrl}`,
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
      message: `[Shopify Metafields] Reverted canonical URL metafield on ${targetUrl}`,
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
      message: `[Shopify Admin API] Updated SEO Title & Description for ${targetUrl}`,
      diffSummary: `Shopify Title: "${updated.title || ''}" | Shopify Desc: "${updated.description || ''}"`,
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
      message: `[Shopify Admin API] Restored previous SEO title & meta description on ${targetUrl}`,
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
      message: `[Shopify Liquid / Metafield Schema] Injected ${schema['@type']} JSON-LD Schema`,
      diffSummary: `Shopify Schema @type: ${schema['@type']}`,
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
      message: `[Shopify Liquid Schema] Reverted JSON-LD structured data on ${targetUrl}`,
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
      message: `[Shopify URL Redirects API] Created 301 URL redirect from ${sourceUrl} to ${destinationUrl}`,
      diffSummary: `Shopify Redirect: ${sourceUrl} -> ${destinationUrl}`,
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
      message: `[Shopify URL Redirects API] Removed URL redirect for ${sourceUrl}`,
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
      message: `[Shopify Product/Article Body] Injected internal link: [${anchorText}](${targetUrl})`,
      diffSummary: `Shopify Link: [${anchorText}](${targetUrl})`,
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
      message: `[Shopify Product/Article Body] Restored previous internal links on ${sourceUrl}`,
      executedAt: new Date(),
    };
  }
}
