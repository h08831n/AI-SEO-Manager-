import { UserRole } from '@prisma/client';

export interface AuthenticatedPrincipal {
  userId: string;
  email: string;
  isSystemAdmin?: boolean;
  workspaceMemberships: Array<{
    workspaceId: string;
    role: UserRole;
  }>;
}

const ROLE_RANKS: Record<UserRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  SEO_MANAGER: 30,
  EDITOR: 20,
  ANALYST: 10,
  VIEWER: 0,
};

export class TenancyAuthorization {
  /**
   * Evaluates if a principal has access to a workspace with at least minRole
   */
  public static authorizeWorkspace(
    principal: AuthenticatedPrincipal | null | undefined,
    workspaceId: string,
    minRole: UserRole = 'VIEWER'
  ): { authorized: boolean; reason?: string; memberRole?: UserRole } {
    if (!principal) {
      return { authorized: false, reason: 'AUTHENTICATION_REQUIRED' };
    }

    if (principal.isSystemAdmin) {
      return { authorized: true, memberRole: 'OWNER' };
    }

    const membership = principal.workspaceMemberships.find((m) => m.workspaceId === workspaceId);
    if (!membership) {
      return { authorized: false, reason: 'CROSS_TENANT_ACCESS_DENIED' };
    }

    const principalRank = ROLE_RANKS[membership.role] ?? 0;
    const requiredRank = ROLE_RANKS[minRole] ?? 0;

    if (principalRank < requiredRank) {
      return {
        authorized: false,
        reason: `INSUFFICIENT_ROLE_PRIVILEGE (Required: ${minRole}, Actual: ${membership.role})`,
        memberRole: membership.role,
      };
    }

    return { authorized: true, memberRole: membership.role };
  }

  /**
   * Resolves website tenancy and evaluates principal permissions
   */
  public static authorizeWebsiteAccess(
    principal: AuthenticatedPrincipal | null | undefined,
    websiteWorkspaceId: string,
    minRole: UserRole = 'VIEWER'
  ): { authorized: boolean; reason?: string; memberRole?: UserRole } {
    return this.authorizeWorkspace(principal, websiteWorkspaceId, minRole);
  }
}
