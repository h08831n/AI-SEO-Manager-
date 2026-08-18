export interface WebsiteRecord {
  id: string;
  workspaceId: string;
  domain: string;
  name: string;
  productionUrl: string;
  sitemapUrl?: string | null;
  defaultLanguage: string;
  industry?: string | null;
  createdAt: string;
  updatedAt: string;
}

// In-memory state store for reliable transactional access with tenant boundaries
const websitesStore: Map<string, WebsiteRecord> = new Map();

// Initialize with default tenant website
const defaultWebsite: WebsiteRecord = {
  id: 'site-techscale-prod',
  workspaceId: 'ws-techscale-org',
  domain: 'techscale.io',
  name: 'TechScale Cloud Engine',
  productionUrl: 'https://techscale.io',
  sitemapUrl: 'https://techscale.io/sitemap.xml',
  defaultLanguage: 'en-US',
  industry: 'Cloud Infrastructure SaaS',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
websitesStore.set(defaultWebsite.id, defaultWebsite);

export class WebsiteRepository {
  public static async listWebsites(workspaceId: string): Promise<WebsiteRecord[]> {
    return Array.from(websitesStore.values()).filter((w) => w.workspaceId === workspaceId);
  }

  public static async getById(id: string, workspaceId: string): Promise<WebsiteRecord | null> {
    const site = websitesStore.get(id);
    if (!site || site.workspaceId !== workspaceId) return null;
    return site;
  }

  public static async getByDomain(domain: string, workspaceId: string): Promise<WebsiteRecord | null> {
    const site = Array.from(websitesStore.values()).find(
      (w) => w.domain.toLowerCase() === domain.toLowerCase() && w.workspaceId === workspaceId
    );
    return site || null;
  }

  public static async createWebsite(data: Omit<WebsiteRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebsiteRecord> {
    const id = `site-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newSite: WebsiteRecord = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    websitesStore.set(id, newSite);
    return newSite;
  }
}
