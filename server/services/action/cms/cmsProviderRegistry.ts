import { ICmsActionProvider, CmsPlatformType, CmsProviderMode, CmsConnectionConfig } from './cmsActionProviderInterface';
import { WordPressCmsProvider } from './wordPressCmsProvider';
import { WordPressSimulationProvider } from './wordPressSimulationProvider';
import { WordPressProductionProvider } from './wordPressProductionProvider';
import { ShopifyCmsProvider } from './shopifyCmsProvider';
import { CustomApiCmsProvider } from './customApiCmsProvider';
import { StaticSiteCmsProvider } from './staticSiteCmsProvider';
import { prisma } from '../../../db/prisma';
import { SecretVault } from '../../../security/secretVault';
import { isProductionMode } from '../../../config/runtimeMode';

export class CmsProviderRegistry {
  private static defaultSimulationProvider: ICmsActionProvider = new WordPressCmsProvider('SIMULATION');
  private static providers: Map<CmsPlatformType, ICmsActionProvider> = new Map();

  static {
    this.providers.set('WORDPRESS', this.defaultSimulationProvider);
    this.providers.set('SHOPIFY', new ShopifyCmsProvider('SIMULATION'));
    this.providers.set('CUSTOM_API', new CustomApiCmsProvider());
    this.providers.set('STATIC_SITE', new StaticSiteCmsProvider());
  }

  /**
   * Retrieves a CMS action provider by explicit platform type.
   */
  public static getProvider(platform?: CmsPlatformType | string): ICmsActionProvider {
    if (!platform) return this.defaultSimulationProvider;
    const normalized = platform.toUpperCase() as CmsPlatformType;
    return this.providers.get(normalized) || this.defaultSimulationProvider;
  }

  /**
   * Automatically resolves the authoritative CMS Action Provider for a given website based on its integrations or configuration.
   * Fails closed in PRODUCTION mode if integration is missing, inactive, or un-decryptable.
   */
  public static async getProviderForWebsite(websiteId: string, requestedMode?: CmsProviderMode): Promise<ICmsActionProvider> {
    const isProd = (requestedMode === 'PRODUCTION') || (!requestedMode && isProductionMode());

    // 1. In SIMULATION mode, return dedicated simulation provider
    if (!isProd) {
      const website = await prisma.website.findUnique({ where: { id: websiteId } });
      if (website?.domain?.includes('myshopify.com')) {
        return new ShopifyCmsProvider('SIMULATION');
      }
      return new WordPressSimulationProvider();
    }

    // 2. In PRODUCTION mode: Must resolve credentials via SecretVault from an active Integration record
    const integration = await prisma.integration.findFirst({
      where: {
        websiteId,
        status: 'CONNECTED',
      },
    });

    if (!integration) {
      throw new Error(
        `CMS_INTEGRATION_NOT_FOUND: Website "${websiteId}" does not have an active CONNECTED integration. Production action execution blocked (fail-closed).`
      );
    }

    if (!integration.encryptedCredentials) {
      throw new Error(
        `CMS_CREDENTIALS_MISSING: Integration "${integration.id}" on website "${websiteId}" lacks encryptedCredentials. Production action execution blocked (fail-closed).`
      );
    }

    let decryptedConfig: CmsConnectionConfig;
    try {
      const parsedPayload = JSON.parse(integration.encryptedCredentials);
      const decryptedString = SecretVault.decrypt(parsedPayload);
      decryptedConfig = JSON.parse(decryptedString);
    } catch (err: any) {
      throw new Error(
        `CMS_CREDENTIALS_DECRYPTION_FAILED: Failed to decrypt credentials for integration "${integration.id}" on website "${websiteId}": ${err.message}. Fail closed.`
      );
    }

    if (String(integration.provider) === 'SHOPIFY' || decryptedConfig.shopDomain) {
      return new ShopifyCmsProvider('PRODUCTION');
    }

    return new WordPressProductionProvider(decryptedConfig);
  }

  /**
   * Registers or replaces a custom CMS Action Provider instance.
   */
  public static registerProvider(platform: CmsPlatformType, provider: ICmsActionProvider): void {
    this.providers.set(platform, provider);
  }

  /**
   * Lists all supported CMS platform types.
   */
  public static getSupportedPlatforms(): CmsPlatformType[] {
    return Array.from(this.providers.keys());
  }
}
