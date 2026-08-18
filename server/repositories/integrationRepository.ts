import { IntegrationStatus, IntegrationConnection } from '../../src/shared/contracts';
import { SecretVault } from '../security/secretVault';

export interface IntegrationEntity {
  id: string;
  websiteId: string;
  provider: string; // GSC, GA4, WORDPRESS, SHEETS, RANK_TRACKER
  status: IntegrationStatus;
  lastSyncAt: string | null;
  message: string;
  accountIdentifier: string | null;
  encryptedCredentials?: string;
  updatedAt: string;
}

const integrationsStore: Map<string, IntegrationEntity> = new Map();

// Default unconfigured integrations for default website
const defaultProviders = ['GSC', 'GA4', 'WORDPRESS', 'SHEETS', 'RANK_TRACKER'];
defaultProviders.forEach((provider) => {
  const key = `site-techscale-prod:${provider}`;
  integrationsStore.set(key, {
    id: `integ-${provider.toLowerCase()}-1`,
    websiteId: 'site-techscale-prod',
    provider,
    status: 'NOT_CONFIGURED',
    lastSyncAt: null,
    message: `${provider} is not connected. Requires OAuth verification and credentials.`,
    accountIdentifier: null,
    updatedAt: new Date().toISOString(),
  });
});

export class IntegrationRepository {
  public static async listForWebsite(websiteId: string): Promise<IntegrationConnection[]> {
    const list = Array.from(integrationsStore.values()).filter((i) => i.websiteId === websiteId);
    return list.map((i) => ({
      provider: i.provider,
      status: i.status,
      lastSyncAt: i.lastSyncAt,
      message: i.message,
      accountIdentifier: i.accountIdentifier,
    }));
  }

  public static async getStatus(websiteId: string, provider: string): Promise<IntegrationConnection> {
    const key = `${websiteId}:${provider.toUpperCase()}`;
    const found = integrationsStore.get(key);
    if (!found) {
      return {
        provider: provider.toUpperCase(),
        status: 'NOT_CONFIGURED',
        lastSyncAt: null,
        message: `${provider} is not configured.`,
        accountIdentifier: null,
      };
    }
    return {
      provider: found.provider,
      status: found.status,
      lastSyncAt: found.lastSyncAt,
      message: found.message,
      accountIdentifier: found.accountIdentifier,
    };
  }

  public static async updateConnection(
    websiteId: string,
    provider: string,
    status: IntegrationStatus,
    message: string,
    accountIdentifier?: string | null,
    rawSecret?: string
  ): Promise<IntegrationConnection> {
    const key = `${websiteId}:${provider.toUpperCase()}`;
    let encryptedCreds: string | undefined;

    if (rawSecret) {
      const encryptedPayload = SecretVault.encrypt(rawSecret);
      encryptedCreds = JSON.stringify(encryptedPayload);
    }

    const updated: IntegrationEntity = {
      id: `integ-${provider.toLowerCase()}-${Date.now()}`,
      websiteId,
      provider: provider.toUpperCase(),
      status,
      lastSyncAt: status === 'CONNECTED' ? new Date().toISOString() : null,
      message,
      accountIdentifier: accountIdentifier || null,
      encryptedCredentials: encryptedCreds,
      updatedAt: new Date().toISOString(),
    };

    integrationsStore.set(key, updated);

    return {
      provider: updated.provider,
      status: updated.status,
      lastSyncAt: updated.lastSyncAt,
      message: updated.message,
      accountIdentifier: updated.accountIdentifier,
    };
  }
}
