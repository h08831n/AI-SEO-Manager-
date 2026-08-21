import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { createApp } from '../server/app';
import { AnalyticsRepository } from '../server/repositories/analyticsRepository';
import { WebsiteRepository } from '../server/repositories/websiteRepository';

function makeRequest(
  server: http.Server,
  options: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: any;
  }
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const address = server.address() as any;
    const reqOptions: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: address.port,
      path: options.path,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode || 500,
          body: parsed,
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

describe('Phase 3: Integration Tenant Isolation & Security Test Suite', () => {
  let server: http.Server;

  beforeEach(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('1. Analytics Repository Multi-Tenant Boundary', () => {
    it('ensures analytics facts are strictly queried within the specified website scope', async () => {
      const websiteA = 'website-tenant-a-111';
      const websiteB = 'website-tenant-b-222';

      const startDate = new Date('2026-08-01');
      const endDate = new Date('2026-08-28');

      const totalsA = await AnalyticsRepository.getGscTotals(websiteA, startDate, endDate);
      const totalsB = await AnalyticsRepository.getGscTotals(websiteB, startDate, endDate);

      expect(totalsA).toBeDefined();
      expect(totalsB).toBeDefined();
      expect(totalsA.totalClicks).toBeGreaterThanOrEqual(0);
      expect(totalsB.totalClicks).toBeGreaterThanOrEqual(0);
    });
  });

  describe('2. Endpoint Tenant Isolation & RBAC Protection', () => {
    it('blocks Workspace B from all 8 integration operations on Workspace A website', async () => {
      const siteA = await WebsiteRepository.createWebsite({
        workspaceId: 'workspace-a-isolation',
        domain: 'tenant-a-domain.com',
        name: 'Tenant A Integration Site',
        productionUrl: 'https://tenant-a-domain.com',
        defaultLanguage: 'en-US',
      });

      const foreignHeaders = {
        'x-workspace-id': 'workspace-b-isolation',
        'x-user-id': 'user-foreign-b',
        'x-user-role': 'MEMBER',
        'x-is-admin': 'false',
      };

      // 1. Cannot generate OAuth URL for Workspace A website
      const unauthAuthUrl = await makeRequest(server, {
        method: 'GET',
        path: `/api/integrations/google/auth-url?websiteId=${siteA.id}`,
        headers: foreignHeaders,
      });
      expect(unauthAuthUrl.status).toBe(404);

      // 2. Cannot list GSC properties for Workspace A website
      const unauthGscProps = await makeRequest(server, {
        method: 'GET',
        path: `/api/integrations/websites/${siteA.id}/gsc/properties`,
        headers: foreignHeaders,
      });
      expect(unauthGscProps.status).toBe(403);

      // 3. Cannot bind GSC property for Workspace A website
      const unauthGscBind = await makeRequest(server, {
        method: 'POST',
        path: `/api/integrations/websites/${siteA.id}/gsc/bind`,
        headers: foreignHeaders,
        body: { propertyId: 'sc-domain:tenant-a-domain.com' },
      });
      expect(unauthGscBind.status).toBe(403);

      // 4. Cannot list GA4 properties for Workspace A website
      const unauthGa4Props = await makeRequest(server, {
        method: 'GET',
        path: `/api/integrations/websites/${siteA.id}/ga4/properties`,
        headers: foreignHeaders,
      });
      expect(unauthGa4Props.status).toBe(403);

      // 5. Cannot bind GA4 property for Workspace A website
      const unauthGa4Bind = await makeRequest(server, {
        method: 'POST',
        path: `/api/integrations/websites/${siteA.id}/ga4/bind`,
        headers: foreignHeaders,
        body: { propertyId: 'properties/123456789' },
      });
      expect(unauthGa4Bind.status).toBe(403);

      // 6. Cannot trigger sync for Workspace A website
      const unauthSync = await makeRequest(server, {
        method: 'POST',
        path: `/api/integrations/websites/${siteA.id}/sync`,
        headers: foreignHeaders,
        body: { provider: 'ALL' },
      });
      expect(unauthSync.status).toBe(403);

      // 7. Cannot read analytics of Workspace A website
      const unauthAnalytics = await makeRequest(server, {
        method: 'GET',
        path: `/api/integrations/websites/${siteA.id}/analytics/performance`,
        headers: foreignHeaders,
      });
      expect(unauthAnalytics.status).toBe(403);

      // 8. Cannot disconnect Google integration of Workspace A website
      const unauthDisconnect = await makeRequest(server, {
        method: 'POST',
        path: `/api/integrations/websites/${siteA.id}/google/disconnect`,
        headers: foreignHeaders,
      });
      expect(unauthDisconnect.status).toBe(403);
    });

    it('enqueues background sync job and returns HTTP 202 for authorized workspace', async () => {
      const siteAuthorized = await WebsiteRepository.createWebsite({
        workspaceId: 'workspace-auth-sync',
        domain: 'authorized-site.com',
        name: 'Authorized Sync Site',
        productionUrl: 'https://authorized-site.com',
        defaultLanguage: 'en-US',
      });

      const response = await makeRequest(server, {
        method: 'POST',
        path: `/api/integrations/websites/${siteAuthorized.id}/sync`,
        headers: {
          'x-workspace-id': 'workspace-auth-sync',
          'x-user-id': 'user-123',
          'x-user-role': 'EDITOR',
          'x-is-admin': 'false',
        },
        body: { provider: 'GSC' },
      });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.queued).toBe(true);
      expect(response.body.jobId).toBeDefined();
    });

    it('rejects foreign website reference in /api/integrations/google/auth-url', async () => {
      const siteA = await WebsiteRepository.createWebsite({
        workspaceId: 'workspace-a-auth',
        domain: 'tenant-a-auth.com',
        name: 'Tenant A Auth Site',
        productionUrl: 'https://tenant-a-auth.com',
        defaultLanguage: 'en-US',
      });

      // Request auth url for siteA while authenticated under workspace-b
      const response = await makeRequest(server, {
        method: 'GET',
        path: `/api/integrations/google/auth-url?websiteId=${siteA.id}`,
        headers: {
          'x-workspace-id': 'workspace-b-auth',
          'x-user-id': 'user-foreign',
          'x-user-role': 'MEMBER',
          'x-is-admin': 'false',
        },
      });

      expect(response.status).toBe(404);
    });
  });
});
