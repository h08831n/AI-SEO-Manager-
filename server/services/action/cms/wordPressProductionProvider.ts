import {
  ICmsActionProvider,
  CmsPlatformType,
  CmsProviderMode,
  CmsOperationResult,
  CmsConnectionConfig,
} from './cmsActionProviderInterface';
import { SafeUrlPolicy, SafeMutationHttpClient } from '../../../security/safeUrlPolicy';

export class WordPressProductionProvider implements ICmsActionProvider {
  readonly platform: CmsPlatformType = 'WORDPRESS';
  readonly mode: CmsProviderMode = 'PRODUCTION';
  private config: CmsConnectionConfig;

  constructor(config: CmsConnectionConfig) {
    if (!config || !config.endpointUrl) {
      throw new Error('WORDPRESS_PRODUCTION_CONFIG_REQUIRED: WordPress production provider requires a valid endpoint URL.');
    }
    this.config = config;
  }

  private getAuthHeader(): string {
    if (this.config.accessToken) {
      return `Bearer ${this.config.accessToken}`;
    }
    if (this.config.username && this.config.applicationPassword) {
      const creds = Buffer.from(`${this.config.username}:${this.config.applicationPassword}`).toString('base64');
      return `Basic ${creds}`;
    }
    if (this.config.apiKey) {
      return `Bearer ${this.config.apiKey}`;
    }
    throw new Error('WORDPRESS_AUTH_REQUIRED: Valid WordPress REST API credentials (application password, access token, or API key) are required.');
  }

  private extractSlug(url: string): string {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/').filter(Boolean);
      return segments[segments.length - 1] || 'home';
    } catch {
      throw new Error(`INVALID_TARGET_URL: Cannot extract WordPress slug from target URL "${url}"`);
    }
  }

  private async resolveWordPressObjectId(targetUrl: string, auth: string): Promise<{ id: number; type: 'posts' | 'pages' }> {
    const slug = this.extractSlug(targetUrl);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    // 1. Check posts
    const postRes = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}`,
      method: 'GET',
      headers: { Authorization: auth, 'User-Agent': 'TechScale-SEO-Worker/2.0' },
      timeoutMs: 8000,
    });

    if (postRes.statusCode >= 200 && postRes.statusCode < 300 && Array.isArray(postRes.json) && postRes.json.length > 0 && postRes.json[0].id) {
      return { id: postRes.json[0].id, type: 'posts' };
    }

    // 2. Check pages
    const pageRes = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}`,
      method: 'GET',
      headers: { Authorization: auth, 'User-Agent': 'TechScale-SEO-Worker/2.0' },
      timeoutMs: 8000,
    });

    if (pageRes.statusCode >= 200 && pageRes.statusCode < 300 && Array.isArray(pageRes.json) && pageRes.json.length > 0 && pageRes.json[0].id) {
      return { id: pageRes.json[0].id, type: 'pages' };
    }

    throw new Error(`WORDPRESS_OBJECT_NOT_FOUND: Could not resolve WordPress post or page for slug "${slug}" on target URL "${targetUrl}". Fail closed.`);
  }

  async testConnection(websiteId: string, domain: string, config?: CmsConnectionConfig): Promise<{
    connected: boolean;
    version?: string;
    message?: string;
  }> {
    const activeConfig = config || this.config;
    if (!activeConfig?.endpointUrl) {
      return { connected: false, message: 'WordPress endpoint URL is not configured' };
    }

    try {
      const endpoint = activeConfig.endpointUrl.replace(/\/+$/, '');
      const auth = this.getAuthHeader();
      const headers: Record<string, string> = {
        'User-Agent': 'TechScale-SEO-Worker/2.0',
        Authorization: auth,
      };

      const result = await SafeUrlPolicy.safeFetch(`${endpoint}/wp-json/wp/v2`, {
        timeoutMs: 8000,
        headers,
      });

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return {
          connected: true,
          version: 'WordPress REST API v2 Connected',
          message: `Successfully verified WordPress production REST API connection for ${domain}`,
        };
      }

      return {
        connected: false,
        message: `WordPress REST API responded with status ${result.statusCode}: ${result.body?.substring(0, 200)}`,
      };
    } catch (err: any) {
      return {
        connected: false,
        message: `WordPress connection failed: ${err.message}`,
      };
    }
  }

  async getCanonicalUrl(targetUrl: string): Promise<string | null> {
    const auth = this.getAuthHeader();
    const { id, type } = await this.resolveWordPressObjectId(targetUrl, auth);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const res = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'GET',
      headers: { Authorization: auth, 'User-Agent': 'TechScale-SEO-Worker/2.0' },
      timeoutMs: 8000,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`WORDPRESS_API_ERROR: Failed to fetch WordPress object (${res.statusCode}): ${JSON.stringify(res.json)}`);
    }

    if (res.json?.yoast_head_json?.canonical) {
      return res.json.yoast_head_json.canonical;
    }
    if (res.json?.meta?._yoast_wpseo_canonical) {
      return res.json.meta._yoast_wpseo_canonical;
    }
    return null;
  }

  async setCanonicalUrl(targetUrl: string, canonicalUrl: string): Promise<CmsOperationResult<{ canonicalUrl: string }>> {
    const auth = this.getAuthHeader();
    const { id, type } = await this.resolveWordPressObjectId(targetUrl, auth);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const res = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        'User-Agent': 'TechScale-SEO-Worker/2.0',
      },
      body: {
        meta: {
          _yoast_wpseo_canonical: canonicalUrl,
        },
      },
      timeoutMs: 10000,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`WORDPRESS_MUTATION_FAILED: Failed to update canonical URL on WordPress object ${id} (${res.statusCode}): ${JSON.stringify(res.json)}`);
    }

    return {
      success: true,
      provider: this.platform,
      targetUrl,
      appliedData: { canonicalUrl },
      rawResponse: {
        status: res.statusCode,
        wpObjectId: id,
        capabilityUsed: 'YOAST_WPSEO_CANONICAL',
        observedResponse: res.json,
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Production REST API] Updated post #${id} canonical URL to ${canonicalUrl}`,
      diffSummary: `WP Canonical: -> ${canonicalUrl}`,
      executedAt: new Date(),
    };
  }

  async revertCanonicalUrl(targetUrl: string, previousCanonicalUrl: string | null): Promise<CmsOperationResult<{ canonicalUrl: string | null }>> {
    const auth = this.getAuthHeader();
    const { id, type } = await this.resolveWordPressObjectId(targetUrl, auth);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const res = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        'User-Agent': 'TechScale-SEO-Worker/2.0',
      },
      body: {
        meta: {
          _yoast_wpseo_canonical: previousCanonicalUrl || '',
        },
      },
      timeoutMs: 10000,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`WORDPRESS_ROLLBACK_FAILED: Failed to revert canonical URL on WordPress object ${id} (${res.statusCode}): ${JSON.stringify(res.json)}`);
    }

    return {
      success: true,
      provider: this.platform,
      targetUrl,
      appliedData: { canonicalUrl: previousCanonicalUrl },
      rawResponse: {
        status: res.statusCode,
        wpObjectId: id,
        capabilityUsed: 'YOAST_WPSEO_CANONICAL_REVERT',
        observedResponse: res.json,
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Production REST API] Reverted canonical tag on ${targetUrl}`,
      executedAt: new Date(),
    };
  }

  async getMetaTags(targetUrl: string): Promise<{ title?: string | null; description?: string | null; robotsMeta?: string | null }> {
    const auth = this.getAuthHeader();
    const { id, type } = await this.resolveWordPressObjectId(targetUrl, auth);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const res = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'GET',
      headers: { Authorization: auth, 'User-Agent': 'TechScale-SEO-Worker/2.0' },
      timeoutMs: 8000,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`WORDPRESS_API_ERROR: Failed to fetch metadata for object ${id} (${res.statusCode}): ${JSON.stringify(res.json)}`);
    }

    return {
      title: res.json?.title?.rendered || res.json?.meta?._yoast_wpseo_title || null,
      description: res.json?.meta?._yoast_wpseo_metadesc || null,
      robotsMeta: res.json?.meta?._yoast_wpseo_meta_robots_noindex === '1' ? 'noindex' : null,
    };
  }

  async setMetaTags(
    targetUrl: string,
    meta: { title?: string; description?: string; robotsMeta?: string }
  ): Promise<CmsOperationResult<{ title?: string; description?: string; robotsMeta?: string }>> {
    const auth = this.getAuthHeader();
    const { id, type } = await this.resolveWordPressObjectId(targetUrl, auth);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const metaUpdate: Record<string, any> = {};
    if (meta.title !== undefined) metaUpdate._yoast_wpseo_title = meta.title;
    if (meta.description !== undefined) metaUpdate._yoast_wpseo_metadesc = meta.description;
    if (meta.robotsMeta !== undefined) {
      metaUpdate._yoast_wpseo_meta_robots_noindex = meta.robotsMeta?.includes('noindex') ? '1' : '0';
    }

    const res = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        'User-Agent': 'TechScale-SEO-Worker/2.0',
      },
      body: { meta: metaUpdate },
      timeoutMs: 10000,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`WORDPRESS_MUTATION_FAILED: Failed to update metadata on WordPress object ${id} (${res.statusCode}): ${JSON.stringify(res.json)}`);
    }

    return {
      success: true,
      provider: this.platform,
      targetUrl,
      appliedData: meta,
      rawResponse: {
        status: res.statusCode,
        wpObjectId: id,
        capabilityUsed: 'YOAST_WPSEO_META',
        observedResponse: res.json,
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Production REST API] Updated metadata on post #${id}`,
      diffSummary: `WP Title: "${meta.title || ''}" | WP Desc: "${meta.description || ''}"`,
      executedAt: new Date(),
    };
  }

  async revertMetaTags(
    targetUrl: string,
    previousMeta: { title?: string | null; description?: string | null; robotsMeta?: string | null }
  ): Promise<CmsOperationResult> {
    const auth = this.getAuthHeader();
    const { id, type } = await this.resolveWordPressObjectId(targetUrl, auth);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const metaUpdate: Record<string, any> = {
      _yoast_wpseo_title: previousMeta.title || '',
      _yoast_wpseo_metadesc: previousMeta.description || '',
      _yoast_wpseo_meta_robots_noindex: previousMeta.robotsMeta?.includes('noindex') ? '1' : '0',
    };

    const res = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        'User-Agent': 'TechScale-SEO-Worker/2.0',
      },
      body: { meta: metaUpdate },
      timeoutMs: 10000,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`WORDPRESS_ROLLBACK_FAILED: Failed to revert metadata on WordPress object ${id} (${res.statusCode}): ${JSON.stringify(res.json)}`);
    }

    return {
      success: true,
      provider: this.platform,
      targetUrl,
      appliedData: previousMeta,
      rawResponse: {
        status: res.statusCode,
        wpObjectId: id,
        capabilityUsed: 'YOAST_WPSEO_META_REVERT',
        observedResponse: res.json,
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Production REST API] Reverted metadata on post #${id}`,
      executedAt: new Date(),
    };
  }

  async getStructuredData(targetUrl: string): Promise<Record<string, any>[]> {
    const auth = this.getAuthHeader();
    const { id, type } = await this.resolveWordPressObjectId(targetUrl, auth);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const res = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'GET',
      headers: { Authorization: auth, 'User-Agent': 'TechScale-SEO-Worker/2.0' },
      timeoutMs: 8000,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`WORDPRESS_API_ERROR: Failed to fetch structured data on object ${id} (${res.statusCode})`);
    }

    const schemaRaw = res.json?.meta?._schema_json_ld;
    if (schemaRaw) {
      try {
        const parsed = JSON.parse(schemaRaw);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }
    return [];
  }

  async injectStructuredData(
    targetUrl: string,
    schema: Record<string, any>
  ): Promise<CmsOperationResult<{ schema: Record<string, any> }>> {
    const auth = this.getAuthHeader();
    const { id, type } = await this.resolveWordPressObjectId(targetUrl, auth);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const existingSchemas = await this.getStructuredData(targetUrl);
    existingSchemas.push(schema);

    const res = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        'User-Agent': 'TechScale-SEO-Worker/2.0',
      },
      body: {
        meta: {
          _schema_json_ld: JSON.stringify(existingSchemas),
        },
      },
      timeoutMs: 10000,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`WORDPRESS_MUTATION_FAILED: Failed to inject schema on WordPress object ${id} (${res.statusCode})`);
    }

    return {
      success: true,
      provider: this.platform,
      targetUrl,
      appliedData: { schema },
      rawResponse: {
        status: res.statusCode,
        wpObjectId: id,
        capabilityUsed: 'SCHEMA_JSON_LD',
        observedResponse: res.json,
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Production REST API] Injected structured data into post #${id}`,
      diffSummary: `WP Schema: +${schema['@type'] || 'CustomSchema'}`,
      executedAt: new Date(),
    };
  }

  async revertStructuredData(
    targetUrl: string,
    previousSchemas: Record<string, any>[]
  ): Promise<CmsOperationResult<{ schemas: Record<string, any>[] }>> {
    const auth = this.getAuthHeader();
    const { id, type } = await this.resolveWordPressObjectId(targetUrl, auth);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const res = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        'User-Agent': 'TechScale-SEO-Worker/2.0',
      },
      body: {
        meta: {
          _schema_json_ld: JSON.stringify(previousSchemas),
        },
      },
      timeoutMs: 10000,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`WORDPRESS_ROLLBACK_FAILED: Failed to revert schema on WordPress object ${id} (${res.statusCode})`);
    }

    return {
      success: true,
      provider: this.platform,
      targetUrl,
      appliedData: { schemas: previousSchemas },
      rawResponse: {
        status: res.statusCode,
        wpObjectId: id,
        capabilityUsed: 'SCHEMA_JSON_LD_REVERT',
        observedResponse: res.json,
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Production REST API] Reverted structured data on post #${id}`,
      executedAt: new Date(),
    };
  }

  async getRedirectRule(sourceUrl: string): Promise<{ destinationUrl: string; statusCode: number } | null> {
    const auth = this.getAuthHeader();
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const res = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/redirection/v1/redirect?filterBy[url]=${encodeURIComponent(sourceUrl)}`,
      method: 'GET',
      headers: { Authorization: auth, 'User-Agent': 'TechScale-SEO-Worker/2.0' },
      timeoutMs: 8000,
    });

    if (res.statusCode >= 200 && res.statusCode < 300 && res.json?.items?.length > 0) {
      const match = res.json.items[0];
      return {
        destinationUrl: match.action_data?.url || match.target,
        statusCode: match.action_code || 301,
      };
    }
    return null;
  }

  async createRedirectRule(
    sourceUrl: string,
    destinationUrl: string,
    statusCode: number = 301
  ): Promise<CmsOperationResult<{ sourceUrl: string; destinationUrl: string; statusCode: number }>> {
    const auth = this.getAuthHeader();
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const res = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/redirection/v1/redirect`,
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        'User-Agent': 'TechScale-SEO-Worker/2.0',
      },
      body: {
        url: sourceUrl,
        action_data: { url: destinationUrl },
        action_type: 'url',
        action_code: statusCode,
        match_type: 'url',
        group_id: 1,
      },
      timeoutMs: 10000,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`WORDPRESS_MUTATION_FAILED: Failed to create redirect rule (${res.statusCode}): ${JSON.stringify(res.json)}`);
    }

    return {
      success: true,
      provider: this.platform,
      targetUrl: sourceUrl,
      appliedData: { sourceUrl, destinationUrl, statusCode },
      rawResponse: {
        status: res.statusCode,
        wpObjectId: res.json?.id || 'redirect-rule',
        capabilityUsed: 'WP_REDIRECTION_PLUGIN',
        observedResponse: res.json,
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Production REST API] Created ${statusCode} redirect from ${sourceUrl} to ${destinationUrl}`,
      diffSummary: `WP 301 Redirect: ${sourceUrl} -> ${destinationUrl}`,
      executedAt: new Date(),
    };
  }

  async revertRedirectRule(
    sourceUrl: string,
    previousRule: { destinationUrl: string; statusCode: number } | null
  ): Promise<CmsOperationResult> {
    const auth = this.getAuthHeader();
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const existing = await this.getRedirectRule(sourceUrl);
    if (!existing && !previousRule) {
      return {
        success: true,
        provider: this.platform,
        targetUrl: sourceUrl,
        appliedData: previousRule,
        message: `[WordPress Production REST API] No redirect rule to revert for ${sourceUrl}`,
        executedAt: new Date(),
      };
    }

    if (previousRule) {
      return this.createRedirectRule(sourceUrl, previousRule.destinationUrl, previousRule.statusCode);
    } else {
      const deleteRes = await SafeMutationHttpClient.execute({
        url: `${endpoint}/wp-json/redirection/v1/redirect?filterBy[url]=${encodeURIComponent(sourceUrl)}`,
        method: 'DELETE',
        headers: { Authorization: auth, 'User-Agent': 'TechScale-SEO-Worker/2.0' },
        timeoutMs: 10000,
      });

      if (deleteRes.statusCode < 200 || deleteRes.statusCode >= 300) {
        throw new Error(`WORDPRESS_ROLLBACK_FAILED: Failed to delete redirect rule (${deleteRes.statusCode})`);
      }

      return {
        success: true,
        provider: this.platform,
        targetUrl: sourceUrl,
        appliedData: previousRule,
        rawResponse: {
          status: deleteRes.statusCode,
          wpObjectId: 'redirect-rule',
          capabilityUsed: 'WP_REDIRECTION_DELETE',
          observedResponse: deleteRes.json,
          timestamp: new Date().toISOString(),
        },
        message: `[WordPress Production REST API] Reverted redirect rule for ${sourceUrl}`,
        executedAt: new Date(),
      };
    }
  }

  async getInternalLinks(sourceUrl: string): Promise<Array<{ targetUrl: string; anchorText: string }>> {
    const auth = this.getAuthHeader();
    const { id, type } = await this.resolveWordPressObjectId(sourceUrl, auth);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const res = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'GET',
      headers: { Authorization: auth, 'User-Agent': 'TechScale-SEO-Worker/2.0' },
      timeoutMs: 8000,
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`WORDPRESS_API_ERROR: Failed to fetch content for internal links (${res.statusCode})`);
    }

    const content = res.json?.content?.rendered || '';
    const linkMatches = content.matchAll(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1[^>]*>(.*?)<\/a>/gi);
    const links: Array<{ targetUrl: string; anchorText: string }> = [];
    for (const match of linkMatches) {
      links.push({ targetUrl: match[2], anchorText: match[3].replace(/<[^>]+>/g, '').trim() });
    }
    return links;
  }

  async injectInternalLink(
    sourceUrl: string,
    targetUrl: string,
    anchorText: string
  ): Promise<CmsOperationResult<{ sourceUrl: string; targetUrl: string; anchorText: string }>> {
    const auth = this.getAuthHeader();
    const { id, type } = await this.resolveWordPressObjectId(sourceUrl, auth);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const getRes = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'GET',
      headers: { Authorization: auth, 'User-Agent': 'TechScale-SEO-Worker/2.0' },
      timeoutMs: 8000,
    });

    if (getRes.statusCode < 200 || getRes.statusCode >= 300) {
      throw new Error(`WORDPRESS_API_ERROR: Failed to fetch content for object ${id}`);
    }

    let content = getRes.json?.content?.raw || getRes.json?.content?.rendered || '';
    const anchorRegex = new RegExp(`\\b(${anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i');
    if (!anchorRegex.test(content)) {
      content += `\n<p>Learn more: <a href="${targetUrl}">${anchorText}</a></p>`;
    } else {
      content = content.replace(anchorRegex, `<a href="${targetUrl}">$1</a>`);
    }

    const updateRes = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        'User-Agent': 'TechScale-SEO-Worker/2.0',
      },
      body: { content },
      timeoutMs: 10000,
    });

    if (updateRes.statusCode < 200 || updateRes.statusCode >= 300) {
      throw new Error(`WORDPRESS_MUTATION_FAILED: Failed to update post content for internal link (${updateRes.statusCode})`);
    }

    return {
      success: true,
      provider: this.platform,
      targetUrl: sourceUrl,
      appliedData: { sourceUrl, targetUrl, anchorText },
      rawResponse: {
        status: updateRes.statusCode,
        wpObjectId: id,
        capabilityUsed: 'WP_CONTENT_LINK_INJECTION',
        observedResponse: updateRes.json,
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Production REST API] Injected internal link to ${targetUrl} into post #${id}`,
      diffSummary: `WP Link: [${anchorText}](${targetUrl})`,
      executedAt: new Date(),
    };
  }

  async revertInternalLinks(
    sourceUrl: string,
    previousLinks: Array<{ targetUrl: string; anchorText: string }>
  ): Promise<CmsOperationResult> {
    const auth = this.getAuthHeader();
    const { id, type } = await this.resolveWordPressObjectId(sourceUrl, auth);
    const endpoint = this.config.endpointUrl!.replace(/\/+$/, '');

    const getRes = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'GET',
      headers: { Authorization: auth, 'User-Agent': 'TechScale-SEO-Worker/2.0' },
      timeoutMs: 8000,
    });

    if (getRes.statusCode < 200 || getRes.statusCode >= 300) {
      throw new Error(`WORDPRESS_API_ERROR: Failed to fetch post #${id} for link revert`);
    }

    let content = getRes.json?.content?.raw || getRes.json?.content?.rendered || '';
    content = content.replace(/<a\s+(?:[^>]*?\s+)?href=["'][^"']*["'][^>]*>(.*?)<\/a>/gi, '$1');

    const updateRes = await SafeMutationHttpClient.execute({
      url: `${endpoint}/wp-json/wp/v2/${type}/${id}`,
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        'User-Agent': 'TechScale-SEO-Worker/2.0',
      },
      body: { content },
      timeoutMs: 10000,
    });

    if (updateRes.statusCode < 200 || updateRes.statusCode >= 300) {
      throw new Error(`WORDPRESS_ROLLBACK_FAILED: Failed to revert content links on post #${id}`);
    }

    return {
      success: true,
      provider: this.platform,
      targetUrl: sourceUrl,
      appliedData: { previousLinks },
      rawResponse: {
        status: updateRes.statusCode,
        wpObjectId: id,
        capabilityUsed: 'WP_CONTENT_LINK_REVERT',
        observedResponse: updateRes.json,
        timestamp: new Date().toISOString(),
      },
      message: `[WordPress Production REST API] Reverted internal hyperlinks on post #${id}`,
      executedAt: new Date(),
    };
  }
}
