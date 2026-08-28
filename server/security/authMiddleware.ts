import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthenticatedPrincipal, TenancyAuthorization } from './tenancyAuthorization';
import { isProductionMode } from '../config/runtimeMode';
import { getPrismaClient } from '../db/prismaClient';
import { WebsiteRepository, WebsiteRecord } from '../repositories/websiteRepository';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
      workspaceId?: string;
      website?: WebsiteRecord;
    }
  }
}

import { AuthenticationProviderFactory, DEV_DEFAULT_PRINCIPAL } from './authenticationProvider';
export { DEV_DEFAULT_PRINCIPAL };

export async function resolvePrincipal(req: Request): Promise<AuthenticatedPrincipal | null> {
  const provider = AuthenticationProviderFactory.getProvider();
  return await provider.authenticate(req);
}

export function requireWorkspaceAuth(minRole: UserRole = 'VIEWER') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const principal = await resolvePrincipal(req);
      if (!principal) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid authentication credentials are required.',
        });
      }

      req.principal = principal;
      const requestedWorkspaceId =
        (req.headers['x-workspace-id'] as string) ||
        (req.query.workspaceId as string) ||
        (req.body && req.body.workspaceId) ||
        'default-workspace';

      req.workspaceId = requestedWorkspaceId;

      const authCheck = TenancyAuthorization.authorizeWorkspace(principal, requestedWorkspaceId, minRole);
      if (!authCheck.authorized) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          reason: authCheck.reason,
          message: 'You do not have sufficient permissions for this workspace.',
        });
      }

      return next();
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_AUTH_ERROR', message: err.message });
    }
  };
}

export function requireWebsiteAccess(minRole: UserRole = 'VIEWER') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const principal = await resolvePrincipal(req);
      if (!principal) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Valid authentication credentials are required.',
        });
      }

      req.principal = principal;
      const websiteId =
        req.params.websiteId ||
        (req.query.websiteId as string) ||
        (req.body && req.body.websiteId);

      if (!websiteId) {
        return res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Target websiteId parameter is required.',
        });
      }

      const website = await WebsiteRepository.findGlobalById(websiteId);
      if (!website) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `Website with ID '${websiteId}' was not found.`,
        });
      }

      req.website = website;
      req.workspaceId = website.workspaceId;

      const authCheck = TenancyAuthorization.authorizeWebsiteAccess(
        principal,
        website.workspaceId,
        minRole
      );

      if (!authCheck.authorized) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          reason: authCheck.reason,
          message: 'You do not have sufficient permissions to access this website resource.',
        });
      }

      return next();
    } catch (err: any) {
      return res.status(500).json({ error: 'INTERNAL_AUTH_ERROR', message: err.message });
    }
  };
}

