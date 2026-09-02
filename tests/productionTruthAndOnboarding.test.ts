import { describe, it, expect } from 'vitest';
import { ProductionAuthenticationProvider } from '../server/security/authenticationProvider';
import { WebsiteRepository } from '../server/repositories/websiteRepository';

describe('SaaS Production Truth & First-Customer Journey Lifecycle', () => {
  it('authenticates session and produces a verifiable JWT with tenancy claims', async () => {
    const email = `founder-${Date.now()}@acme-saas.com`;
    const token = ProductionAuthenticationProvider.signJwt({
      userId: 'usr-101',
      email,
      workspaceMemberships: [{ workspaceId: 'ws-acme-1', role: 'OWNER' }],
    });

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = ProductionAuthenticationProvider.verifyJwt(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.email).toBe(email);
    expect(decoded?.workspaceMemberships[0].workspaceId).toBe('ws-acme-1');
  });

  it('rejects expired or tampered JWTs', async () => {
    const email = 'user@example.com';
    const expiredToken = ProductionAuthenticationProvider.signJwt({
      userId: 'usr-exp',
      email,
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    });

    const decodedExpired = ProductionAuthenticationProvider.verifyJwt(expiredToken);
    expect(decodedExpired).toBeNull();

    // Tampered payload
    const validToken = ProductionAuthenticationProvider.signJwt({
      userId: 'usr-valid',
      email,
    });
    const parts = validToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'admin-override', email })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const decodedTampered = ProductionAuthenticationProvider.verifyJwt(tamperedToken);
    expect(decodedTampered).toBeNull();
  });

  it('rejects cross-tenant website access', async () => {
    const ws1 = `ws-alpha-${Date.now()}`;
    const ws2 = `ws-beta-${Date.now()}`;

    const siteAlpha = await WebsiteRepository.createWebsite({
      workspaceId: ws1,
      domain: `alpha-${Date.now()}.com`,
      name: 'Alpha Systems',
      productionUrl: 'https://alpha.com',
      defaultLanguage: 'en-US',
    });

    expect(siteAlpha.id).toBeDefined();
    expect(siteAlpha.workspaceId).toBe(ws1);

    // Verify workspace 1 can read its own site
    const foundSite = await WebsiteRepository.getById(siteAlpha.id, ws1);
    expect(foundSite).not.toBeNull();
    expect(foundSite?.id).toBe(siteAlpha.id);

    // Verify workspace 2 CANNOT access workspace 1's website
    const crossTenantSite = await WebsiteRepository.getById(siteAlpha.id, ws2);
    expect(crossTenantSite).toBeNull();
  });

  it('handles domain verification and CMS connection lifecycle', async () => {
    const wsId = `ws-lifecycle-${Date.now()}`;
    const site = await WebsiteRepository.createWebsite({
      workspaceId: wsId,
      domain: `app-${Date.now()}.io`,
      name: 'App IO',
      productionUrl: 'https://app.io',
      defaultLanguage: 'en-US',
    });

    expect(site.isDomainVerified).toBe(false);
    expect(site.cmsConnected).toBe(false);

    // Verify domain
    const verifiedSite = await WebsiteRepository.verifyDomainOwnership(site.id, wsId);
    expect(verifiedSite).not.toBeNull();
    expect(verifiedSite?.isDomainVerified).toBe(true);
    expect(verifiedSite?.domainVerifiedAt).toBeDefined();

    // Connect CMS
    const cmsConnectedSite = await WebsiteRepository.connectCms(site.id, wsId, 'wordpress');
    expect(cmsConnectedSite).not.toBeNull();
    expect(cmsConnectedSite?.cmsConnected).toBe(true);
    expect(cmsConnectedSite?.cmsPlatform).toBe('wordpress');
  });
});
