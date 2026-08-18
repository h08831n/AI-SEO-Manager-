import { describe, it, expect } from 'vitest';
import { TenancyAuthorization, AuthenticatedPrincipal } from '../server/security/tenancyAuthorization';

describe('Tenancy & RBAC Authorization Policy', () => {
  const tenantA: AuthenticatedPrincipal = {
    userId: 'user-tenant-a-1',
    email: 'alice@tenant-a.com',
    workspaceMemberships: [
      { workspaceId: 'ws-tenant-a', role: 'ADMIN' },
    ],
  };

  const tenantB: AuthenticatedPrincipal = {
    userId: 'user-tenant-b-1',
    email: 'bob@tenant-b.com',
    workspaceMemberships: [
      { workspaceId: 'ws-tenant-b', role: 'OWNER' },
    ],
  };

  const editorUser: AuthenticatedPrincipal = {
    userId: 'user-tenant-a-editor',
    email: 'editor@tenant-a.com',
    workspaceMemberships: [
      { workspaceId: 'ws-tenant-a', role: 'EDITOR' },
    ],
  };

  it('Tenant A cannot read Tenant B website or workspace data', () => {
    const authResult = TenancyAuthorization.authorizeWebsiteAccess(tenantA, 'ws-tenant-b', 'VIEWER');
    expect(authResult.authorized).toBe(false);
    expect(authResult.reason).toBe('CROSS_TENANT_ACCESS_DENIED');
  });

  it('Tenant A cannot mutate Tenant B website settings or tasks', () => {
    const authResult = TenancyAuthorization.authorizeWebsiteAccess(tenantA, 'ws-tenant-b', 'ADMIN');
    expect(authResult.authorized).toBe(false);
    expect(authResult.reason).toBe('CROSS_TENANT_ACCESS_DENIED');
  });

  it('Tenant A cannot read Tenant B tasks or crawl data', () => {
    const authResult = TenancyAuthorization.authorizeWebsiteAccess(tenantA, 'ws-tenant-b', 'ANALYST');
    expect(authResult.authorized).toBe(false);
    expect(authResult.reason).toBe('CROSS_TENANT_ACCESS_DENIED');
  });

  it('Tenant B cannot access Tenant A resources', () => {
    const authResult = TenancyAuthorization.authorizeWebsiteAccess(tenantB, 'ws-tenant-a', 'VIEWER');
    expect(authResult.authorized).toBe(false);
    expect(authResult.reason).toBe('CROSS_TENANT_ACCESS_DENIED');
  });

  it('EDITOR cannot perform OWNER-only operation', () => {
    const authResult = TenancyAuthorization.authorizeWorkspace(editorUser, 'ws-tenant-a', 'OWNER');
    expect(authResult.authorized).toBe(false);
    expect(authResult.reason).toContain('INSUFFICIENT_ROLE_PRIVILEGE');
  });

  it('ADMIN can perform EDITOR-level operations within their workspace', () => {
    const authResult = TenancyAuthorization.authorizeWorkspace(tenantA, 'ws-tenant-a', 'EDITOR');
    expect(authResult.authorized).toBe(true);
    expect(authResult.memberRole).toBe('ADMIN');
  });
});
