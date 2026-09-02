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
  isDomainVerified?: boolean;
  domainVerifiedAt?: string | null;
  cmsPlatform?: string | null;
  cmsConnected?: boolean;
  createdAt: string;
  updatedAt: string;
}

// In-memory state store for fallback
const devWebsitesStore: Map<string, WebsiteRecord> = new Map();

export class WebsiteRepository {
  public static async listWebsites(workspaceId: string): Promise<WebsiteRecord[]> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const rows = await prisma.website.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'asc' },
        });
        return rows.map((w: any) => ({
          id: w.id,
          workspaceId: w.workspaceId,
          domain: w.domain,
          name: w.name,
          productionUrl: w.productionUrl,
          sitemapUrl: w.sitemapUrl,
          defaultLanguage: w.defaultLanguage,
          industry: w.industry,
          isDomainVerified: w.isDomainVerified ?? false,
          domainVerifiedAt: w.domainVerifiedAt ? new Date(w.domainVerifiedAt).toISOString() : null,
          cmsPlatform: w.cmsPlatform || null,
          cmsConnected: w.cmsConnected ?? false,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        }));
      } catch (err) {
        if (isProductionMode()) {
          throw new Error(`PERSISTENCE_UNAVAILABLE: listWebsites failed: ${err}`);
        }
      }
    }

    // Fallback: check in-memory prisma
    try {
      const { prisma: dbPrisma } = await import('../db/prisma');
      const rows = await dbPrisma.website.findMany({ where: { workspaceId } });
      if (rows && rows.length > 0) {
        return rows.map((w: any) => ({
          id: w.id,
          workspaceId: w.workspaceId,
          domain: w.domain,
          name: w.name,
          productionUrl: w.productionUrl || `https://${w.domain}`,
          sitemapUrl: w.sitemapUrl,
          defaultLanguage: w.defaultLanguage || 'en-US',
          industry: w.industry,
          isDomainVerified: w.isDomainVerified ?? false,
          domainVerifiedAt: w.domainVerifiedAt ? new Date(w.domainVerifiedAt).toISOString() : null,
          cmsPlatform: w.cmsPlatform || null,
          cmsConnected: w.cmsConnected ?? false,
          createdAt: (w.createdAt || new Date()).toISOString(),
          updatedAt: (w.updatedAt || new Date()).toISOString(),
        }));
      }
    } catch {
      // fallback
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
        const wAny = w as any;
        return {
          id: w.id,
          workspaceId: w.workspaceId,
          domain: w.domain,
          name: w.name,
          productionUrl: w.productionUrl,
          sitemapUrl: w.sitemapUrl,
          defaultLanguage: w.defaultLanguage,
          industry: w.industry,
          isDomainVerified: wAny.isDomainVerified ?? false,
          domainVerifiedAt: wAny.domainVerifiedAt ? new Date(wAny.domainVerifiedAt).toISOString() : null,
          cmsPlatform: wAny.cmsPlatform || null,
          cmsConnected: wAny.cmsConnected ?? false,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        };
      } catch (err) {
        if (isProductionMode()) {
          throw new Error(`PERSISTENCE_UNAVAILABLE: getById failed: ${err}`);
        }
      }
    }

    // Fallback: check in-memory prisma
    try {
      const { prisma: dbPrisma } = await import('../db/prisma');
      const w: any = await dbPrisma.website.findFirst({ where: { id, workspaceId } });
      if (w) {
        return {
          id: w.id,
          workspaceId: w.workspaceId,
          domain: w.domain,
          name: w.name,
          productionUrl: w.productionUrl || `https://${w.domain}`,
          sitemapUrl: w.sitemapUrl,
          defaultLanguage: w.defaultLanguage || 'en-US',
          industry: w.industry,
          isDomainVerified: w.isDomainVerified ?? false,
          domainVerifiedAt: w.domainVerifiedAt ? new Date(w.domainVerifiedAt).toISOString() : null,
          cmsPlatform: w.cmsPlatform || null,
          cmsConnected: w.cmsConnected ?? false,
          createdAt: (w.createdAt || new Date()).toISOString(),
          updatedAt: (w.updatedAt || new Date()).toISOString(),
        };
      }
    } catch {
      // fallback
    }

    const site = devWebsitesStore.get(id);
    if (!site || site.workspaceId !== workspaceId) return null;
    return site;
  }

  public static async findGlobalById(id: string): Promise<WebsiteRecord | null> {
    const prismaClient = getPrismaClient();
    if (prismaClient) {
      try {
        const w = await prismaClient.website.findUnique({
          where: { id },
        });
        if (!w) return null;
        const wAny = w as any;
        return {
          id: w.id,
          workspaceId: w.workspaceId,
          domain: w.domain,
          name: w.name,
          productionUrl: w.productionUrl,
          sitemapUrl: w.sitemapUrl,
          defaultLanguage: w.defaultLanguage,
          industry: w.industry,
          isDomainVerified: wAny.isDomainVerified ?? false,
          domainVerifiedAt: wAny.domainVerifiedAt ? new Date(wAny.domainVerifiedAt).toISOString() : null,
          cmsPlatform: wAny.cmsPlatform || null,
          cmsConnected: wAny.cmsConnected ?? false,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        };
      } catch (err) {
        if (isProductionMode()) {
          throw new Error(`PERSISTENCE_UNAVAILABLE: findGlobalById failed: ${err}`);
        }
      }
    }

    // Fallback: check in-memory prisma
    try {
      const { prisma: dbPrisma } = await import('../db/prisma');
      const w: any = await dbPrisma.website.findUnique({ where: { id } });
      if (w) {
        return {
          id: w.id,
          workspaceId: w.workspaceId,
          domain: w.domain,
          name: w.name,
          productionUrl: w.productionUrl || `https://${w.domain}`,
          sitemapUrl: w.sitemapUrl,
          defaultLanguage: w.defaultLanguage || 'en',
          industry: w.industry,
          isDomainVerified: w.isDomainVerified ?? false,
          domainVerifiedAt: w.domainVerifiedAt ? new Date(w.domainVerifiedAt).toISOString() : null,
          cmsPlatform: w.cmsPlatform || null,
          cmsConnected: w.cmsConnected ?? false,
          createdAt: (w.createdAt || new Date()).toISOString(),
          updatedAt: (w.updatedAt || new Date()).toISOString(),
        };
      }
    } catch {
      // fallback
    }

    const site = devWebsitesStore.get(id);
    return site || null;
  }

  public static async verifyDomainOwnership(id: string, workspaceId: string): Promise<WebsiteRecord | null> {
    const site = await this.getById(id, workspaceId);
    if (!site) return null;

    const now = new Date();
    site.isDomainVerified = true;
    site.domainVerifiedAt = now.toISOString();

    try {
      const { prisma: dbPrisma } = await import('../db/prisma');
      await dbPrisma.website.update({
        where: { id },
        data: {
          ...(site as any),
        },
      });
    } catch {
      // ignore
    }

    devWebsitesStore.set(id, site);
    return site;
  }

  public static async connectCms(id: string, workspaceId: string, cmsPlatform: string): Promise<WebsiteRecord | null> {
    const site = await this.getById(id, workspaceId);
    if (!site) return null;

    site.cmsConnected = true;
    site.cmsPlatform = cmsPlatform;

    try {
      const { prisma: dbPrisma } = await import('../db/prisma');
      await dbPrisma.website.update({
        where: { id },
        data: {
          ...(site as any),
        },
      });
    } catch {
      // ignore
    }

    devWebsitesStore.set(id, site);
    return site;
  }

  public static async isDomainVerified(id: string): Promise<boolean> {
    const site = await this.findGlobalById(id);
    return !!site?.isDomainVerified;
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
        const wAny = w as any;
        return {
          id: w.id,
          workspaceId: w.workspaceId,
          domain: w.domain,
          name: w.name,
          productionUrl: w.productionUrl,
          sitemapUrl: w.sitemapUrl,
          defaultLanguage: w.defaultLanguage,
          industry: w.industry,
          isDomainVerified: wAny.isDomainVerified ?? false,
          domainVerifiedAt: wAny.domainVerifiedAt ? new Date(wAny.domainVerifiedAt).toISOString() : null,
          cmsPlatform: wAny.cmsPlatform || null,
          cmsConnected: wAny.cmsConnected ?? false,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        };
      } catch (err) {
        if (isProductionMode()) {
          throw new Error(`PERSISTENCE_UNAVAILABLE: getByDomain failed: ${err}`);
        }
      }
    }

    try {
      const { prisma: dbPrisma } = await import('../db/prisma');
      const w: any = await dbPrisma.website.findFirst({
        where: {
          workspaceId,
          domain: { equals: domain, mode: 'insensitive' },
        },
      });
      if (w) {
        return {
          id: w.id,
          workspaceId: w.workspaceId,
          domain: w.domain,
          name: w.name,
          productionUrl: w.productionUrl || `https://${w.domain}`,
          sitemapUrl: w.sitemapUrl,
          defaultLanguage: w.defaultLanguage || 'en-US',
          industry: w.industry,
          isDomainVerified: w.isDomainVerified ?? false,
          domainVerifiedAt: w.domainVerifiedAt ? new Date(w.domainVerifiedAt).toISOString() : null,
          cmsPlatform: w.cmsPlatform || null,
          cmsConnected: w.cmsConnected ?? false,
          createdAt: (w.createdAt || new Date()).toISOString(),
          updatedAt: (w.updatedAt || new Date()).toISOString(),
        };
      }
    } catch {
      // fallback
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
        const cAny = created as any;
        return {
          id: created.id,
          workspaceId: created.workspaceId,
          domain: created.domain,
          name: created.name,
          productionUrl: created.productionUrl,
          sitemapUrl: created.sitemapUrl,
          defaultLanguage: created.defaultLanguage,
          industry: created.industry,
          isDomainVerified: cAny.isDomainVerified ?? false,
          domainVerifiedAt: cAny.domainVerifiedAt ? new Date(cAny.domainVerifiedAt).toISOString() : null,
          cmsPlatform: cAny.cmsPlatform || null,
          cmsConnected: cAny.cmsConnected ?? false,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        };
      } catch (err) {
        if (isProductionMode()) {
          throw new Error(`PERSISTENCE_UNAVAILABLE: createWebsite failed: ${err}`);
        }
      }
    }

    try {
      const { prisma: dbPrisma } = await import('../db/prisma');
      const created: any = await dbPrisma.website.create({
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
        isDomainVerified: false,
        domainVerifiedAt: null,
        cmsPlatform: null,
        cmsConnected: false,
        createdAt: (created.createdAt || new Date()).toISOString(),
        updatedAt: (created.updatedAt || new Date()).toISOString(),
      };
    } catch {
      // in memory fallback
    }

    const newSite: WebsiteRecord = {
      ...data,
      id,
      isDomainVerified: false,
      domainVerifiedAt: null,
      cmsPlatform: null,
      cmsConnected: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    devWebsitesStore.set(id, newSite);
    return newSite;
  }
}
