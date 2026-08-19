import { prisma } from '../db/prisma';
import { SecretVault } from '../security/secretVault';
import { GoogleOAuthClient, GoogleOAuthTokens } from '../services/integrations/providers/googleOAuthClient';
import { IntegrationStatus, IntegrationProvider } from '@prisma/client';

export interface DecryptedGoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scopes: string[];
  email?: string;
}

export interface GscBindingInput {
  websiteId: string;
  providerPropertyId: string; // e.g. "sc-domain:example.com" or "https://example.com/"
  providerPropertyType: 'DOMAIN' | 'URL_PREFIX';
  permissionLevel?: string;
}

export interface Ga4BindingInput {
  websiteId: string;
  providerAccountId?: string;
  providerAccountName?: string;
  providerPropertyId: string; // e.g. "properties/123456789"
  providerDisplayName?: string;
  timeZone?: string;
  currencyCode?: string;
  customKeyEvents?: string[];
}

export class GoogleIntegrationRepository {
  /**
   * Saves or updates the Google OAuth connection for a website.
   * Credentials (refresh token & access token) are encrypted via AES-256-GCM.
   */
  public static async saveGoogleConnection(params: {
    websiteId: string;
    tokens: GoogleOAuthTokens;
    accountEmail?: string;
    scopes: string[];
  }): Promise<{ integrationId: string; status: IntegrationStatus }> {
    const expiresAt = new Date(Date.now() + params.tokens.expiresIn * 1000);
    const rawSecretPayload = JSON.stringify({
      accessToken: params.tokens.accessToken,
      refreshToken: params.tokens.refreshToken,
      expiresAt: expiresAt.toISOString(),
      scopes: params.scopes,
      email: params.accountEmail,
    });

    const encrypted = SecretVault.encrypt(rawSecretPayload);
    const encryptedCredentials = JSON.stringify(encrypted);

    const integration = await prisma.integration.upsert({
      where: {
        websiteId_provider: {
          websiteId: params.websiteId,
          provider: 'GSC',
        },
      },
      update: {
        status: 'CONNECTED',
        connectedAccount: params.accountEmail || null,
        accountIdentifier: params.accountEmail || null,
        grantedScopes: params.scopes,
        tokenExpiry: expiresAt,
        connectedAt: new Date(),
        lastRefreshAt: new Date(),
        lastSuccessfulApiCallAt: new Date(),
        lastError: null,
        message: `Connected as ${params.accountEmail || 'Google Account'}`,
        encryptedCredentials,
      },
      create: {
        websiteId: params.websiteId,
        provider: 'GSC',
        status: 'CONNECTED',
        connectedAccount: params.accountEmail || null,
        accountIdentifier: params.accountEmail || null,
        grantedScopes: params.scopes,
        tokenExpiry: expiresAt,
        connectedAt: new Date(),
        lastRefreshAt: new Date(),
        lastSuccessfulApiCallAt: new Date(),
        lastError: null,
        message: `Connected as ${params.accountEmail || 'Google Account'}`,
        encryptedCredentials,
      },
    });

    return { integrationId: integration.id, status: integration.status };
  }

  /**
   * Retrieves decrypted Google tokens, automatically refreshing the access token if expired.
   */
  public static async getValidAccessToken(websiteId: string): Promise<{
    accessToken: string;
    email?: string;
    scopes: string[];
    integrationId: string;
  }> {
    const integration = await prisma.integration.findUnique({
      where: {
        websiteId_provider: {
          websiteId,
          provider: 'GSC',
        },
      },
    });

    if (!integration || !integration.encryptedCredentials || integration.status !== 'CONNECTED') {
      throw new Error(`GOOGLE_NOT_CONNECTED: Google integration is not active or credentials are missing for website ${websiteId}`);
    }

    let payload: DecryptedGoogleTokens;
    try {
      const encryptedObj = JSON.parse(integration.encryptedCredentials);
      const decryptedStr = SecretVault.decrypt(encryptedObj);
      const parsed = JSON.parse(decryptedStr);
      payload = {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        expiresAt: new Date(parsed.expiresAt),
        scopes: parsed.scopes || [],
        email: parsed.email,
      };
    } catch (err: any) {
      await this.markDegraded(websiteId, `Failed to decrypt Google credentials: ${err.message}`);
      throw new Error(`CREDENTIAL_DECRYPTION_ERROR: Failed to decrypt credentials for website ${websiteId}`);
    }

    // Check if token expires within 5 minutes
    const isExpiringSoon = payload.expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
    if (isExpiringSoon && payload.refreshToken) {
      try {
        const refreshed = await GoogleOAuthClient.refreshAccessToken(payload.refreshToken);
        const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);

        const updatedSecretPayload = JSON.stringify({
          accessToken: refreshed.accessToken,
          refreshToken: payload.refreshToken,
          expiresAt: newExpiresAt.toISOString(),
          scopes: payload.scopes,
          email: payload.email,
        });

        const newEncrypted = SecretVault.encrypt(updatedSecretPayload);

        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            tokenExpiry: newExpiresAt,
            lastRefreshAt: new Date(),
            lastSuccessfulApiCallAt: new Date(),
            lastError: null,
            encryptedCredentials: JSON.stringify(newEncrypted),
          },
        });

        return {
          accessToken: refreshed.accessToken,
          email: payload.email,
          scopes: payload.scopes,
          integrationId: integration.id,
        };
      } catch (refreshErr: any) {
        if (refreshErr.message.includes('TOKEN_REVOKED_OR_INVALID')) {
          await this.markRevoked(websiteId, refreshErr.message);
        } else {
          await this.markDegraded(websiteId, refreshErr.message);
        }
        throw refreshErr;
      }
    }

    return {
      accessToken: payload.accessToken,
      email: payload.email,
      scopes: payload.scopes,
      integrationId: integration.id,
    };
  }

  /**
   * Binds a verified Search Console property to a website.
   */
  public static async bindGscProperty(params: GscBindingInput): Promise<any> {
    const integration = await prisma.integration.findUnique({
      where: {
        websiteId_provider: {
          websiteId: params.websiteId,
          provider: 'GSC',
        },
      },
    });

    if (!integration) {
      throw new Error(`Cannot bind Search Console property: Google integration not found for website ${params.websiteId}`);
    }

    return prisma.searchConsolePropertyBinding.upsert({
      where: { websiteId: params.websiteId },
      update: {
        integrationId: integration.id,
        providerPropertyId: params.providerPropertyId,
        providerPropertyType: params.providerPropertyType,
        permissionLevel: params.permissionLevel || 'siteRestrictedUser',
        verifiedAt: new Date(),
      },
      create: {
        websiteId: params.websiteId,
        integrationId: integration.id,
        providerPropertyId: params.providerPropertyId,
        providerPropertyType: params.providerPropertyType,
        permissionLevel: params.permissionLevel || 'siteRestrictedUser',
        verifiedAt: new Date(),
      },
    });
  }

  /**
   * Binds a verified GA4 property to a website.
   */
  public static async bindGa4Property(params: Ga4BindingInput): Promise<any> {
    const integration = await prisma.integration.findUnique({
      where: {
        websiteId_provider: {
          websiteId: params.websiteId,
          provider: 'GSC', // Google OAuth provides both GSC and GA4
        },
      },
    });

    if (!integration) {
      throw new Error(`Cannot bind GA4 property: Google integration not found for website ${params.websiteId}`);
    }

    return prisma.ga4PropertyBinding.upsert({
      where: { websiteId: params.websiteId },
      update: {
        integrationId: integration.id,
        providerAccountId: params.providerAccountId || null,
        providerAccountName: params.providerAccountName || null,
        providerPropertyId: params.providerPropertyId,
        providerDisplayName: params.providerDisplayName || null,
        timeZone: params.timeZone || 'UTC',
        currencyCode: params.currencyCode || 'USD',
        customKeyEvents: params.customKeyEvents || [],
        verifiedAt: new Date(),
      },
      create: {
        websiteId: params.websiteId,
        integrationId: integration.id,
        providerAccountId: params.providerAccountId || null,
        providerAccountName: params.providerAccountName || null,
        providerPropertyId: params.providerPropertyId,
        providerDisplayName: params.providerDisplayName || null,
        timeZone: params.timeZone || 'UTC',
        currencyCode: params.currencyCode || 'USD',
        customKeyEvents: params.customKeyEvents || [],
        verifiedAt: new Date(),
      },
    });
  }

  /**
   * Disconnects and revokes Google integration for a website.
   */
  public static async disconnectGoogle(websiteId: string): Promise<void> {
    const integration = await prisma.integration.findUnique({
      where: {
        websiteId_provider: {
          websiteId,
          provider: 'GSC',
        },
      },
    });

    if (integration && integration.encryptedCredentials) {
      try {
        const encryptedObj = JSON.parse(integration.encryptedCredentials);
        const decryptedStr = SecretVault.decrypt(encryptedObj);
        const parsed = JSON.parse(decryptedStr);
        if (parsed.refreshToken) {
          await GoogleOAuthClient.revokeToken(parsed.refreshToken);
        } else if (parsed.accessToken) {
          await GoogleOAuthClient.revokeToken(parsed.accessToken);
        }
      } catch {
        // Continue disconnect cleanup
      }
    }

    await prisma.$transaction([
      prisma.searchConsolePropertyBinding.deleteMany({ where: { websiteId } }),
      prisma.ga4PropertyBinding.deleteMany({ where: { websiteId } }),
      prisma.integration.updateMany({
        where: { websiteId, provider: 'GSC' },
        data: {
          status: 'DISCONNECTED',
          encryptedCredentials: null,
          connectedAccount: null,
          accountIdentifier: null,
          message: 'Google integration disconnected by user.',
          lastError: null,
        },
      }),
    ]);
  }

  /**
   * Saves a single-use short-lived OAuth state session with PKCE verifier.
   */
  public static async createOAuthStateSession(params: {
    state: string;
    codeVerifier?: string;
    workspaceId: string;
    userId: string;
    websiteId?: string;
    redirectUri: string;
    expiresInMinutes?: number;
  }): Promise<void> {
    const expiresAt = new Date(Date.now() + (params.expiresInMinutes || 10) * 60 * 1000);
    await prisma.oAuthStateSession.create({
      data: {
        state: params.state,
        codeVerifier: params.codeVerifier || null,
        workspaceId: params.workspaceId,
        userId: params.userId,
        websiteId: params.websiteId || null,
        redirectUri: params.redirectUri,
        expiresAt,
      },
    });
  }

  /**
   * Consumes and verifies an OAuth state session (single-use).
   */
  public static async consumeOAuthStateSession(state: string): Promise<{
    workspaceId: string;
    userId: string;
    websiteId?: string | null;
    codeVerifier?: string | null;
    redirectUri: string;
  }> {
    const session = await prisma.oAuthStateSession.findUnique({
      where: { state },
    });

    if (!session) {
      throw new Error('INVALID_OAUTH_STATE: OAuth state parameter was not found or was forged.');
    }

    if (session.usedAt) {
      throw new Error('OAUTH_STATE_ALREADY_USED: OAuth state token has already been consumed.');
    }

    if (new Date() > session.expiresAt) {
      throw new Error('OAUTH_STATE_EXPIRED: OAuth state session has expired.');
    }

    // Mark as used atomically
    await prisma.oAuthStateSession.update({
      where: { id: session.id },
      data: { usedAt: new Date() },
    });

    return {
      workspaceId: session.workspaceId,
      userId: session.userId,
      websiteId: session.websiteId,
      codeVerifier: session.codeVerifier,
      redirectUri: session.redirectUri,
    };
  }

  public static async markDegraded(websiteId: string, error: string): Promise<void> {
    await prisma.integration.updateMany({
      where: { websiteId, provider: 'GSC' },
      data: {
        status: 'DEGRADED',
        lastError: error,
        message: `Integration degraded: ${error}`,
      },
    });
  }

  public static async markRevoked(websiteId: string, error: string): Promise<void> {
    await prisma.integration.updateMany({
      where: { websiteId, provider: 'GSC' },
      data: {
        status: 'REVOKED',
        lastError: error,
        message: `Google authorization was revoked or expired. Please reconnect.`,
      },
    });
  }
}
