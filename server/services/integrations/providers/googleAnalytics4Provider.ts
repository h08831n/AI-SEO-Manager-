import {
  AnalyticsProvider,
  Ga4Account,
  Ga4Property,
  Ga4ReportOptions,
  Ga4BatchResult,
  Ga4Row,
} from './analyticsProvider';

export class GoogleAnalytics4Provider implements AnalyticsProvider {
  private static readonly ADMIN_API_BASE = 'https://analyticsadmin.googleapis.com/v1beta';
  private static readonly DATA_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';

  /**
   * Lists all Google Analytics 4 accounts and properties accessible to the authenticated user.
   */
  public async listAccessibleAccountsAndProperties(
    accessToken: string
  ): Promise<{ accounts: Ga4Account[]; properties: Ga4Property[] }> {
    const url = `${GoogleAnalytics4Provider.ADMIN_API_BASE}/accountSummaries?pageSize=200`;
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
        throw new Error(`GA4_AUTH_ERROR (${res.status}): Google Analytics access token invalid or lacks analytics scopes: ${err}`);
      }
      if (res.status === 429) {
        throw new Error(`GA4_RATE_LIMITED (${res.status}): Google Analytics Admin API quota exceeded: ${err}`);
      }
      throw new Error(`GA4_API_ERROR (${res.status}): Failed to list GA4 accounts and properties: ${err}`);
    }

    const data = (await res.json()) as any;
    const summaries = data.accountSummaries || [];

    const accounts: Ga4Account[] = [];
    const properties: Ga4Property[] = [];

    for (const acc of summaries) {
      const accountName = acc.account || acc.name || '';
      const accountId = accountName.replace('accounts/', '');
      accounts.push({
        id: accountName,
        name: accountName,
        displayName: acc.displayName || `Account ${accountId}`,
      });

      const propSummaries = acc.propertySummaries || [];
      for (const prop of propSummaries) {
        const fullPropName = prop.property || ''; // "properties/123456789"
        const cleanId = fullPropName.replace('properties/', '');
        properties.push({
          id: fullPropName,
          propertyId: cleanId,
          displayName: prop.displayName || `Property ${cleanId}`,
          parentAccount: accountName,
          timeZone: 'UTC', // Default until metadata query
          currencyCode: 'USD',
          propertyType: prop.propertyType || 'PROPERTY_TYPE_ORDINARY',
        });
      }
    }

    return { accounts, properties };
  }

  /**
   * Executes a GA4 Data API v1 runReport request.
   */
  public async runReport(
    accessToken: string,
    propertyId: string,
    options: Ga4ReportOptions
  ): Promise<Ga4BatchResult> {
    const cleanId = propertyId.replace(/^properties\//, '');
    const url = `${GoogleAnalytics4Provider.DATA_API_BASE}/properties/${cleanId}:runReport`;

    const limit = Math.min(options.limit || 10000, 100000);
    const offset = options.offset || 0;

    const payload: Record<string, any> = {
      dateRanges: [{ startDate: options.startDate, endDate: options.endDate }],
      dimensions: options.dimensions.map((name) => ({ name })),
      metrics: options.metrics.map((name) => ({ name })),
      limit,
      offset,
      keepEmptyRows: options.keepEmptyRows ?? false,
    };

    if (options.dimensionFilter) {
      payload.dimensionFilter = options.dimensionFilter;
    }
    if (options.metricFilter) {
      payload.metricFilter = options.metricFilter;
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
        throw new Error(`GA4_AUTH_ERROR (${res.status}): Permission denied or token expired for property ${propertyId}: ${err}`);
      }
      if (res.status === 429) {
        throw new Error(`GA4_RATE_LIMITED (${res.status}): GA4 Data API quota exceeded: ${err}`);
      }
      throw new Error(`GA4_REPORT_FAILED (${res.status}): GA4 runReport failed: ${err}`);
    }

    const data = (await res.json()) as any;
    const dimensionHeaders = data.dimensionHeaders || [];
    const metricHeaders = data.metricHeaders || [];
    const rawRows = data.rows || [];
    const totalRowsReported = data.rowCount || rawRows.length;
    const metadata = data.metadata || {};

    const rows: Ga4Row[] = rawRows.map((r: any) => ({
      dimensionValues: (r.dimensionValues || []).map((dv: any) => dv.value || ''),
      metricValues: (r.metricValues || []).map((mv: any) => parseFloat(mv.value || '0')),
    }));

    const hasMore = rows.length === limit && offset + rows.length < totalRowsReported;
    const nextOffset = hasMore ? offset + rows.length : undefined;

    return {
      dimensionHeaders,
      metricHeaders,
      rows,
      rowCount: rows.length,
      totalRowsReported,
      isComplete: !hasMore,
      hasMore,
      nextOffset,
      timeZone: metadata.timeZone || 'UTC',
      currencyCode: metadata.currencyCode || 'USD',
      retrievedAt: new Date().toISOString(),
      provenance: 'MEASURED_PROVIDER',
      samplingMetadata: metadata.samplingMetadatas,
    };
  }

  /**
   * Validates access to the specified GA4 property.
   */
  public async verifyPropertyAccess(
    accessToken: string,
    propertyId: string
  ): Promise<{ accessible: boolean; propertyName?: string; timeZone?: string; currencyCode?: string; error?: string }> {
    try {
      const cleanId = propertyId.replace(/^properties\//, '');
      const testReport = await this.runReport(accessToken, cleanId, {
        startDate: 'yesterday',
        endDate: 'yesterday',
        dimensions: ['date'],
        metrics: ['sessions'],
        limit: 1,
      });

      return {
        accessible: true,
        propertyName: `properties/${cleanId}`,
        timeZone: testReport.timeZone,
        currencyCode: testReport.currencyCode,
      };
    } catch (err: any) {
      return {
        accessible: false,
        error: err.message || 'Failed to access GA4 property.',
      };
    }
  }
}
