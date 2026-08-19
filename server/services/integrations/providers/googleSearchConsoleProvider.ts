import {
  SearchConsoleProvider,
  SearchConsoleProperty,
  SearchAnalyticsQueryOptions,
  SearchAnalyticsBatchResult,
  SearchAnalyticsRow,
} from './searchConsoleProvider';

export class GoogleSearchConsoleProvider implements SearchConsoleProvider {
  private static readonly API_BASE = 'https://www.googleapis.com/webmasters/v3';

  /**
   * Discovers all Search Console sites/properties accessible by the user.
   */
  public async listAccessibleProperties(accessToken: string): Promise<SearchConsoleProperty[]> {
    const url = `${GoogleSearchConsoleProvider.API_BASE}/sites`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new Error(`GSC_AUTH_ERROR (${res.status}): Access token invalid or insufficient scopes: ${err}`);
      }
      if (res.status === 429) {
        throw new Error(`GSC_RATE_LIMITED (${res.status}): Search Console API quota exceeded: ${err}`);
      }
      throw new Error(`GSC_API_ERROR (${res.status}): Failed to list Search Console properties: ${err}`);
    }

    const data = (await res.json()) as any;
    const siteEntries = data.siteEntry || [];

    return siteEntries.map((entry: any) => {
      const siteUrl = entry.siteUrl || '';
      const isDomain = siteUrl.startsWith('sc-domain:');
      return {
        siteUrl,
        permissionLevel: entry.permissionLevel || 'siteRestrictedUser',
        propertyType: isDomain ? 'DOMAIN' : 'URL_PREFIX',
      };
    });
  }

  /**
   * Queries search performance analytics from the Google Search Console API.
   */
  public async querySearchAnalytics(
    accessToken: string,
    propertyId: string,
    options: SearchAnalyticsQueryOptions
  ): Promise<SearchAnalyticsBatchResult> {
    const encodedProperty = encodeURIComponent(propertyId);
    const url = `${GoogleSearchConsoleProvider.API_BASE}/sites/${encodedProperty}/searchAnalytics/query`;

    const rowLimit = Math.min(options.rowLimit || 25000, 25000);
    const startRow = options.startRow || 0;

    const payload: Record<string, any> = {
      startDate: options.startDate,
      endDate: options.endDate,
      rowLimit,
      startRow,
    };

    if (options.dimensions && options.dimensions.length > 0) {
      payload.dimensions = options.dimensions;
    }

    if (options.searchType) {
      payload.type = options.searchType;
    }

    if (options.dataState) {
      payload.dataState = options.dataState;
    }

    if (options.aggregationType) {
      payload.aggregationType = options.aggregationType;
    }

    if (options.dimensionFilterGroups && options.dimensionFilterGroups.length > 0) {
      payload.dimensionFilterGroups = options.dimensionFilterGroups;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        throw new Error(`GSC_AUTH_ERROR (${res.status}): Search Console permission denied or token expired: ${err}`);
      }
      if (res.status === 429) {
        throw new Error(`GSC_RATE_LIMITED (${res.status}): Search Console API quota exceeded: ${err}`);
      }
      throw new Error(`GSC_QUERY_FAILED (${res.status}): Search Console searchAnalytics query failed: ${err}`);
    }

    const data = (await res.json()) as any;
    const rawRows = data.rows || [];
    const responseAggregationType = data.responseAggregationType;

    const parsedRows: SearchAnalyticsRow[] = rawRows.map((r: any) => {
      const keys: string[] = r.keys || [];
      const rowObj: SearchAnalyticsRow = {
        keys,
        clicks: Math.round(r.clicks || 0),
        impressions: Math.round(r.impressions || 0),
        ctr: typeof r.ctr === 'number' ? r.ctr : 0,
        position: typeof r.position === 'number' ? r.position : 0,
      };

      if (options.dimensions) {
        options.dimensions.forEach((dim, idx) => {
          const val = keys[idx] || '';
          if (dim === 'date') rowObj.date = val;
          else if (dim === 'query') rowObj.query = val;
          else if (dim === 'page') rowObj.page = val;
          else if (dim === 'country') rowObj.country = val;
          else if (dim === 'device') rowObj.device = val;
          else if (dim === 'searchAppearance') rowObj.searchAppearance = val;
        });
      }

      return rowObj;
    });

    const hasMore = parsedRows.length === rowLimit;
    const nextStartRow = hasMore ? startRow + parsedRows.length : undefined;

    let dataStateResult: 'FINALIZED' | 'FRESH' | 'HOURLY_PARTIAL' = 'FINALIZED';
    if (options.dataState === 'all') {
      dataStateResult = 'FRESH';
    } else if (options.dataState === 'hourly') {
      dataStateResult = 'HOURLY_PARTIAL';
    }

    return {
      rows: parsedRows,
      totalRows: parsedRows.length,
      responseAggregationType,
      dataState: dataStateResult,
      isComplete: !hasMore,
      hasMore,
      nextStartRow,
      retrievedAt: new Date().toISOString(),
      provenance: 'MEASURED_PROVIDER',
    };
  }

  /**
   * Verifies that the given property is accessible by the credentials.
   */
  public async verifyPropertyAccess(
    accessToken: string,
    propertyId: string
  ): Promise<{ accessible: boolean; permissionLevel?: string; propertyType?: string; error?: string }> {
    try {
      const properties = await this.listAccessibleProperties(accessToken);
      const matched = properties.find(
        (p) =>
          p.siteUrl.toLowerCase() === propertyId.toLowerCase() ||
          p.siteUrl.toLowerCase() === `sc-domain:${propertyId.toLowerCase()}`
      );

      if (!matched) {
        return {
          accessible: false,
          error: `Property '${propertyId}' was not found in the accessible properties for this Google account.`,
        };
      }

      return {
        accessible: true,
        permissionLevel: matched.permissionLevel,
        propertyType: matched.propertyType,
      };
    } catch (err: any) {
      return {
        accessible: false,
        error: err.message || 'Failed to verify property access.',
      };
    }
  }
}
