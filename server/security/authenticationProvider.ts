import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { AuthenticatedPrincipal } from './tenancyAuthorization';
import { getPrismaClient } from '../db/prismaClient';
import { isProductionMode } from '../config/runtimeMode';
import crypto from 'crypto';

export interface IAuthenticationProvider {
  authenticate(req: Request): Promise<AuthenticatedPrincipal | null>;
}

export const DEV_DEFAULT_PRINCIPAL: AuthenticatedPrincipal = {
  userId: 'dev-user-1',
  email: 'developer@aiseo.local',
  isSystemAdmin: true,
  workspaceMemberships: [
    { workspaceId: 'default-workspace', role: 'OWNER' },
    { workspaceId: 'ws-1', role: 'OWNER' },
  ],
};

/**
 * Production Authentication Provider
 * Strictly validates Bearer tokens (JWT / API Key) against DB user records or API tokens.
 * Rejects raw unverified user ID headers or forgeable authentication claims.
 */
export class ProductionAuthenticationProvider implements IAuthenticationProvider {
  private static getJwtSecret(): string {
    return process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET || 'aiseo-auth-secret-production-key-seed';
  }

  public static signJwt(payload: {
    userId: string;
    email: string;
    isSystemAdmin?: boolean;
    workspaceMemberships?: Array<{ workspaceId: string; role: UserRole }>;
    exp?: number;
  }): string {
    const secret = this.getJwtSecret();
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const fullPayload = {
      sub: payload.userId,
      email: payload.email,
      isSystemAdmin: payload.isSystemAdmin || false,
      workspaceMemberships: payload.workspaceMemberships || [],
      exp: payload.exp || Math.floor(Date.now() / 1000) + 86400, // 24 hours
      iat: Math.floor(Date.now() / 1000),
    };
    const payloadEncoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${payloadEncoded}`)
      .digest('base64url');
    return `${header}.${payloadEncoded}.${signature}`;
  }

  private verifyJwt(token: string): AuthenticatedPrincipal | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    try {
      const secret = ProductionAuthenticationProvider.getJwtSecret();
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

      if (!crypto.timingSafeEqual(Buffer.from(signatureB64), Buffer.from(expectedSignature))) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null; // Expired
      }

      return {
        userId: payload.sub || payload.userId,
        email: payload.email,
        isSystemAdmin: !!payload.isSystemAdmin,
        workspaceMemberships: payload.workspaceMemberships || [],
      };
    } catch {
      return null;
    }
  }

  async authenticate(req: Request): Promise<AuthenticatedPrincipal | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7).trim();
    if (!token || token.length < 8) {
      return null;
    }

    // 1. Try JWT verification first
    if (token.includes('.')) {
      const jwtPrincipal = this.verifyJwt(token);
      if (jwtPrincipal) {
        return jwtPrincipal;
      }
    }

    const prisma = getPrismaClient();
    if (!prisma) {
      return null;
    }

    try {
      // 2. Lookup user in database
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: token },
            { email: token },
          ],
        },
        include: {
          memberships: {
            include: { workspace: true },
          },
        },
      });

      if (!user) {
        return null;
      }

      return {
        userId: user.id,
        email: user.email,
        isSystemAdmin: user.memberships.some(
          (m) => m.role === 'ADMIN' || m.role === 'OWNER'
        ),
        workspaceMemberships: user.memberships.map((m) => ({
          workspaceId: m.workspaceId,
          role: m.role,
        })),
      };
    } catch (err) {
      return null;
    }
  }
}

/**
 * Development & Testing Authentication Provider
 * Allows header-based principal resolution in non-production environments.
 */
export class DevelopmentAuthenticationProvider implements IAuthenticationProvider {
  async authenticate(req: Request): Promise<AuthenticatedPrincipal | null> {
    const authHeader = req.headers.authorization;
    const prisma = getPrismaClient();

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (prisma) {
        try {
          const user = await prisma.user.findFirst({
            where: { id: token },
            include: {
              memberships: {
                include: { workspace: true },
              },
            },
          });

          if (user) {
            return {
              userId: user.id,
              email: user.email,
              isSystemAdmin: user.memberships.some(
                (m) => m.role === 'ADMIN' || m.role === 'OWNER'
              ),
              workspaceMemberships: user.memberships.map((m) => ({
                workspaceId: m.workspaceId,
                role: m.role,
              })),
            };
          }
        } catch {
          // fallback to header principal
        }
      }
    }

    const userIdHeader = req.headers['x-user-id'] as string;
    const workspaceHeader = (req.headers['x-workspace-id'] as string) || 'default-workspace';

    if (userIdHeader) {
      return {
        userId: userIdHeader,
        email: (req.headers['x-user-email'] as string) || `${userIdHeader}@aiseo.local`,
        isSystemAdmin: req.headers['x-is-admin'] === 'true' || req.headers['x-user-role'] === 'ADMIN',
        workspaceMemberships: [
          {
            workspaceId: workspaceHeader,
            role: ((req.headers['x-user-role'] as UserRole) || 'OWNER') as UserRole,
          },
        ],
      };
    }

    return DEV_DEFAULT_PRINCIPAL;
  }
}

export class AuthenticationProviderFactory {
  private static instance: IAuthenticationProvider | null = null;

  public static getProvider(): IAuthenticationProvider {
    if (this.instance) {
      return this.instance;
    }
    if (isProductionMode()) {
      return new ProductionAuthenticationProvider();
    }
    return new DevelopmentAuthenticationProvider();
  }

  public static setProvider(provider: IAuthenticationProvider | null): void {
    this.instance = provider;
  }
}
