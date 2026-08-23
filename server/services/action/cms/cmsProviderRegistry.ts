import { ICmsActionProvider, CmsPlatformType } from './cmsActionProviderInterface';
import { WordPressCmsProvider } from './wordPressCmsProvider';
import { ShopifyCmsProvider } from './shopifyCmsProvider';
import { CustomApiCmsProvider } from './customApiCmsProvider';
import { StaticSiteCmsProvider } from './staticSiteCmsProvider';
import { prisma } from '../../../db/prisma';

export class CmsProviderRegistry {
  private static providers: Map<CmsPlatformType, ICmsActionProvider> = new Map();
  private static defaultProvider: ICmsActionProvider;

  static {
    const wp = new WordPressCmsProvider();
    const shopify = new ShopifyCmsProvider();
    const custom = new CustomApiCmsProvider();
    const staticSite = new StaticSiteCmsProvider();

    this.providers.set('WORDPRESS', wp);
    this.providers.set('SHOPIFY', shopify);
    this.providers.set('CUSTOM_API', custom);
    this.providers.set('STATIC_SITE', staticSite);

    // Default to WordPress provider for general simulated operations
    this.defaultProvider = wp;
  }

  /**
   * Retrieves a CMS action provider by explicit platform type.
   */
  public static getProvider(platform?: CmsPlatformType | string): ICmsActionProvider {
    if (!platform) return this.defaultProvider;
    const normalized = platform.toUpperCase() as CmsPlatformType;
    return this.providers.get(normalized) || this.defaultProvider;
  }

  /**
   * Automatically resolves the appropriate CMS Action Provider for a given website based on its integrations or configuration.
   */
  public static async getProviderForWebsite(websiteId: string): Promise<ICmsActionProvider> {
    try {
      const integration = await prisma.integration.findFirst({
        where: {
          websiteId,
          status: 'CONNECTED',
        },
      });

      if (integration) {
        return this.getProvider('WORDPRESS');
      }

      const website = await prisma.website.findUnique({
        where: { id: websiteId },
      });

      // If website metadata indicates platform
      if (website?.domain?.includes('myshopify.com')) {
        return this.getProvider('SHOPIFY');
      }

      return this.defaultProvider;
    } catch {
      return this.defaultProvider;
    }
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
