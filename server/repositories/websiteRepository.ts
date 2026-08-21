import { getPrismaClient } from '../db/prismaClient';
import { isProductionMode } from '../config/runtimeMode';

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

// In-memory state store for DEV/DEMO fallback
const devWebsitesStore: Map<string, WebsiteRecord> = new Map();

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
devWebsitesStore.set(defaultWebsite.id, defaultWebsite);

export class WebsiteRepository {
  public static async listWebsites(workspaceId: string): Promise<WebsiteRecord[]> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const rows = await prisma.website.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'asc' },
        });
        return rows.map((w) => ({
          id: w.id,
          workspaceId: w.workspaceId,
          domain: w.domain,
          name: w.name,
          productionUrl: w.productionUrl,
          sitemapUrl: w.sitemapUrl,
          defaultLanguage: w.defaultLanguage,
          industry: w.industry,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        }));
      } catch (err) {
        if (isProductionMode()) {
          throw new Error(`PERSISTENCE_UNAVAILABLE: listWebsites failed: ${err}`);
        }
      }
    }

    return Array.from(devWebsitesStore.values()).filter((w) => w.workspaceId === workspaceId);
  }

  public static async getById(id: string, workspaceId: string): Promise<WebsiteRecord | null> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const w = await prisma.website.findFirst({
          where: { id, workspaceId },
        });
        if (!w) return null;
        return {
          id: w.id,
          workspaceId: w.workspaceId,
          domain: w.domain,
          name: w.name,
          productionUrl: w.productionUrl,
          sitemapUrl: w.sitemapUrl,
          defaultLanguage: w.defaultLanguage,
          industry: w.industry,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        };
      } catch (err) {
        if (isProductionMode()) {
          throw new Error(`PERSISTENCE_UNAVAILABLE: getById failed: ${err}`);
        }
      }
    }

    const site = devWebsitesStore.get(id);
    if (!site || site.workspaceId !== workspaceId) return null;
    return site;
  }

  public static async findGlobalById(id: string): Promise<WebsiteRecord | null> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const w = await prisma.website.findUnique({
          where: { id },
        });
        if (!w) return null;
        return {
          id: w.id,
          workspaceId: w.workspaceId,
          domain: w.domain,
          name: w.name,
          productionUrl: w.productionUrl,
          sitemapUrl: w.sitemapUrl,
          defaultLanguage: w.defaultLanguage,
          industry: w.industry,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        };
      } catch (err) {
        if (isProductionMode()) {
          throw new Error(`PERSISTENCE_UNAVAILABLE: findGlobalById failed: ${err}`);
        }
      }
    }

    const site = devWebsitesStore.get(id);
    return site || null;
  }

  public static async getByDomain(domain: string, workspaceId: string): Promise<WebsiteRecord | null> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const w = await prisma.website.findFirst({
          where: {
            workspaceId,
            domain: { equals: domain, mode: 'insensitive' },
          },
        });
        if (!w) return null;
        return {
          id: w.id,
          workspaceId: w.workspaceId,
          domain: w.domain,
          name: w.name,
          productionUrl: w.productionUrl,
          sitemapUrl: w.sitemapUrl,
          defaultLanguage: w.defaultLanguage,
          industry: w.industry,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        };
      } catch (err) {
        if (isProductionMode()) {
          throw new Error(`PERSISTENCE_UNAVAILABLE: getByDomain failed: ${err}`);
        }
      }
    }

    const site = Array.from(devWebsitesStore.values()).find(
      (w) => w.domain.toLowerCase() === domain.toLowerCase() && w.workspaceId === workspaceId
    );
    return site || null;
  }

  public static async createWebsite(data: Omit<WebsiteRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebsiteRecord> {
    const prisma = getPrismaClient();
    const id = `site-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    if (prisma) {
      try {
        const created = await prisma.website.create({
          data: {
            id,
            workspaceId: data.workspaceId,
            domain: data.domain,
            name: data.name,
            productionUrl: data.productionUrl,
            sitemapUrl: data.sitemapUrl || null,
            defaultLanguage: data.defaultLanguage || 'en',
            industry: data.industry || null,
          },
        });
        return {
          id: created.id,
          workspaceId: created.workspaceId,
          domain: created.domain,
          name: created.name,
          productionUrl: created.productionUrl,
          sitemapUrl: created.sitemapUrl,
          defaultLanguage: created.defaultLanguage,
          industry: created.industry,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        };
      } catch (err) {
        if (isProductionMode()) {
          throw new Error(`PERSISTENCE_UNAVAILABLE: createWebsite failed: ${err}`);
        }
      }
    }

    const newSite: WebsiteRecord = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    devWebsitesStore.set(id, newSite);
    return newSite;
  }
}
