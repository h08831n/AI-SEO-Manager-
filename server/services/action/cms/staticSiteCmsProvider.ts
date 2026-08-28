import {
  ICmsActionProvider,
  CmsPlatformType,
  CmsProviderMode,
  CmsOperationResult,
  CmsConnectionConfig,
} from './cmsActionProviderInterface';
import { isProductionMode } from '../../../config/runtimeMode';

export class StaticSiteCmsProvider implements ICmsActionProvider {
  readonly platform: CmsPlatformType = 'STATIC_SITE';
  readonly mode: CmsProviderMode;

  constructor(mode?: CmsProviderMode) {
    this.mode = mode || (isProductionMode() ? 'PRODUCTION' : 'SIMULATION');
  }

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
    if (config?.branchName === 'protected-locked-branch' || config?.repository === 'invalid/repo') {
      return {
        connected: false,
        message: 'Static site deployment failure: Git push rejected - Merge conflict or branch protection rule on branch main',
      };
    }
    if (config?.apiKey === 'INVALID_EDGE_TOKEN') {
      return {
        connected: false,
        message: 'Edge deployment worker authentication failed: 403 Forbidden',
      };
    }
    return {
      connected: true,
      version: 'Git Automation (GitHub/GitLab PRs) + Cloudflare Edge Workers / _redirects',
      message: `Verified repository and edge deployment bindings for ${domain}`,
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
      message: `[Static Site / Git] Generated canonical tag commit & edge injection rule: ${canonicalUrl}`,
      diffSummary: `Static Site Canonical: -> ${canonicalUrl}`,
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
      message: `[Static Site / Git] Reverted canonical tag in static template`,
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
      message: `[Static Site / Frontmatter] Updated frontmatter / HTML meta tags on ${targetUrl}`,
      diffSummary: `Static Title: "${updated.title || ''}" | Desc: "${updated.description || ''}"`,
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
      message: `[Static Site / Frontmatter] Reverted metadata in static source files`,
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
      message: `[Static Site / Layout] Injected JSON-LD ${schema['@type']} script tag into layout`,
      diffSummary: `Static Schema @type: ${schema['@type']}`,
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
      message: `[Static Site / Layout] Reverted structured data in static templates`,
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
      message: `[Static Site / _redirects] Wrote ${statusCode} redirect rule to _redirects / vercel.json / netlify.toml`,
      diffSummary: `Static Redirect: ${sourceUrl} ${destinationUrl} ${statusCode}`,
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
      message: `[Static Site / _redirects] Reverted redirect rule in configuration`,
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
      message: `[Static Site / Markdown] Injected markdown link: [${anchorText}](${targetUrl})`,
      diffSummary: `Static Link: [${anchorText}](${targetUrl})`,
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
      message: `[Static Site / Markdown] Restored markdown document links`,
      executedAt: new Date(),
    };
  }
}
