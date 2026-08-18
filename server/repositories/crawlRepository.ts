import { CrawlRunLifecycle } from '@prisma/client';
import { getPrismaClient } from '../db/prismaClient';

export interface CrawlRunRecord {
  id: string;
  websiteId: string;
  status: CrawlRunLifecycle;
  seedUrl: string;
  configJson: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  totalPages: number;
  totalIssues: number;
  urlsDiscovered: number;
  urlsQueued: number;
  urlsFetched: number;
  urlsSkipped: number;
  urlsFailed: number;
  robotsTxtStatus?: string;
  robotsTxtHash?: string;
  sitemapsDiscovered: string[];
  triggerSource: string;
}

export interface UrlIdentityRecord {
  id: string;
  websiteId: string;
  normalizedUrl: string;
  pathname: string;
  firstDiscoveredAt: string;
  lastSeenAt: string;
  discoverySources: string[];
  inlinksCount: number;
  outlinksCount: number;
  minCrawlDepth: number;
  isOrphanCandidate: boolean;
}

export interface CrawledPageRecord {
  id: string;
  websiteId: string;
  crawlRunId: string;
  url: string;
  normalizedUrl: string;
  pathname: string;
  statusCode: number;
  finalUrl?: string;
  redirectCount: number;
  redirectChainJson?: string;
  loadTimeMs: number;
  contentLengthBytes: number;
  isIndexable: boolean;
  indexabilityStatus: string;
  indexabilityReasons: string[];
  canonicalUrl?: string;
  normalizedCanonicalUrl?: string;
  canonicalMatch: boolean;
  title?: string;
  titleLength: number;
  metaDescription?: string;
  metaDescLength: number;
  metaRobots?: string;
  xRobotsTag?: string;
  h1Tags: string[];
  h2Count: number;
  h3Count: number;
  wordCount: number;
  contentHash?: string;
  simHash?: string;
  isExactDuplicate: boolean;
  duplicateClusterId?: string;
  isThinContent: boolean;
  isPossibleSoft404: boolean;
  soft404Confidence: number;
  internalInlinksCount: number;
  internalOutlinksCount: number;
  externalOutlinksCount: number;
  imagesCount: number;
  missingAltCount: number;
  schemaTypes: string[];
  schemaStatus: string;
  openGraphJson?: string;
  twitterCardJson?: string;
  hreflangsJson?: string;
  crawlDepth: number;
  crawledAt: string;
}

export interface CrawlIssueRecord {
  id: string;
  crawlRunId: string;
  crawledPageId?: string;
  ruleKey: string;
  ruleVersion: string;
  type: string;
  severity: string;
  message: string;
  evidence: string;
  impact: string;
  resolved: boolean;
  createdAt: string;
}

export interface InternalLinkEdgeRecord {
  id: string;
  crawlRunId: string;
  sourceUrl: string;
  targetUrl: string;
  normalizedTarget: string;
  anchorText?: string;
  isInternal: boolean;
  rel?: string;
  isNofollow: boolean;
  targetStatusCode?: number;
  isBroken: boolean;
  createdAt: string;
}

export interface SeoEventRecord {
  id: string;
  websiteId: string;
  crawlRunId?: string;
  eventType: string;
  entityType: string;
  entityUrl: string;
  beforeValue?: string;
  afterValue?: string;
  deltaNotes?: string;
  severity: string;
  source: string;
  detectedAt: string;
}

// In-Memory Store for DEV/TEST
const devUrlIdentities: Map<string, UrlIdentityRecord> = new Map();
const devCrawlRuns: Map<string, CrawlRunRecord> = new Map();
const devCrawledPages: Map<string, CrawledPageRecord[]> = new Map();
const devCrawlIssues: Map<string, CrawlIssueRecord[]> = new Map();
const devLinkEdges: Map<string, InternalLinkEdgeRecord[]> = new Map();
const devSeoEvents: Map<string, SeoEventRecord[]> = new Map();

export class CrawlRepository {
  public static async getOrCreateUrlIdentity(
    websiteId: string,
    normalizedUrl: string,
    discoverySource: string
  ): Promise<UrlIdentityRecord> {
    const prisma = getPrismaClient();
    const pathname = new URL(normalizedUrl).pathname;
    const now = new Date();

    if (prisma) {
      try {
        const existing = await prisma.urlIdentity.findUnique({
          where: { websiteId_normalizedUrl: { websiteId, normalizedUrl } },
        });

        if (existing) {
          const updated = await prisma.urlIdentity.update({
            where: { id: existing.id },
            data: {
              lastSeenAt: now,
              discoverySources: Array.from(new Set([...existing.discoverySources, discoverySource])),
            },
          });
          return {
            id: updated.id,
            websiteId: updated.websiteId,
            normalizedUrl: updated.normalizedUrl,
            pathname: updated.pathname,
            firstDiscoveredAt: updated.firstDiscoveredAt.toISOString(),
            lastSeenAt: updated.lastSeenAt.toISOString(),
            discoverySources: updated.discoverySources,
            inlinksCount: updated.inlinksCount,
            outlinksCount: updated.outlinksCount,
            minCrawlDepth: updated.minCrawlDepth,
            isOrphanCandidate: updated.isOrphanCandidate,
          };
        }

        const created = await prisma.urlIdentity.create({
          data: {
            id: `url-id-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            websiteId,
            normalizedUrl,
            pathname,
            firstDiscoveredAt: now,
            lastSeenAt: now,
            discoverySources: [discoverySource],
            inlinksCount: 0,
            outlinksCount: 0,
            minCrawlDepth: 0,
            isOrphanCandidate: discoverySource === 'SITEMAP',
          },
        });

        return {
          id: created.id,
          websiteId: created.websiteId,
          normalizedUrl: created.normalizedUrl,
          pathname: created.pathname,
          firstDiscoveredAt: created.firstDiscoveredAt.toISOString(),
          lastSeenAt: created.lastSeenAt.toISOString(),
          discoverySources: created.discoverySources,
          inlinksCount: created.inlinksCount,
          outlinksCount: created.outlinksCount,
          minCrawlDepth: created.minCrawlDepth,
          isOrphanCandidate: created.isOrphanCandidate,
        };
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: UrlIdentity write failed: ${err}`);
        }
      }
    }

    const key = `${websiteId}:${normalizedUrl}`;
    const existing = devUrlIdentities.get(key);
    if (existing) {
      existing.lastSeenAt = now.toISOString();
      if (!existing.discoverySources.includes(discoverySource)) {
        existing.discoverySources.push(discoverySource);
      }
      return existing;
    }

    const record: UrlIdentityRecord = {
      id: `url-id-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      websiteId,
      normalizedUrl,
      pathname,
      firstDiscoveredAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      discoverySources: [discoverySource],
      inlinksCount: 0,
      outlinksCount: 0,
      minCrawlDepth: 0,
      isOrphanCandidate: discoverySource === 'SITEMAP',
    };
    devUrlIdentities.set(key, record);
    return record;
  }

  public static async createCrawlRun(params: {
    websiteId: string;
    seedUrl: string;
    config: any;
    triggerSource?: string;
  }): Promise<CrawlRunRecord> {
    const prisma = getPrismaClient();
    const id = `crawl-run-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const configJson = JSON.stringify(params.config);

    if (prisma) {
      try {
        const record = await prisma.crawlRun.create({
          data: {
            id,
            websiteId: params.websiteId,
            status: 'RUNNING',
            seedUrl: params.seedUrl,
            configJson,
            triggerSource: params.triggerSource || 'MANUAL',
            urlsDiscovered: 1,
            urlsQueued: 1,
          },
        });
        return record as unknown as CrawlRunRecord;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: Database write failed in production mode: ${err}`);
        }
      }
    }

    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
      throw new Error('PERSISTENCE_UNAVAILABLE: PostgreSQL required in production but unreachable');
    }

    const devRecord: CrawlRunRecord = {
      id,
      websiteId: params.websiteId,
      status: 'RUNNING',
      seedUrl: params.seedUrl,
      configJson,
      startedAt: new Date().toISOString(),
      totalPages: 0,
      totalIssues: 0,
      urlsDiscovered: 1,
      urlsQueued: 1,
      urlsFetched: 0,
      urlsSkipped: 0,
      urlsFailed: 0,
      sitemapsDiscovered: [],
      triggerSource: params.triggerSource || 'MANUAL',
    };

    devCrawlRuns.set(id, devRecord);
    return devRecord;
  }

  public static async updateCrawlRun(
    id: string,
    updates: Partial<CrawlRunRecord>
  ): Promise<CrawlRunRecord | null> {
    const prisma = getPrismaClient();

    if (prisma) {
      try {
        const updated = await prisma.crawlRun.update({
          where: { id },
          data: updates as any,
        });
        return updated as unknown as CrawlRunRecord;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: ${err}`);
        }
      }
    }

    const current = devCrawlRuns.get(id);
    if (!current) return null;

    const merged = { ...current, ...updates };
    devCrawlRuns.set(id, merged);
    return merged;
  }

  public static async getCrawlRun(id: string): Promise<CrawlRunRecord | null> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const res = await prisma.crawlRun.findUnique({ where: { id } });
        if (res) return res as unknown as CrawlRunRecord;
      } catch {
        // Fallback
      }
    }
    return devCrawlRuns.get(id) || null;
  }

  public static async listCrawlRuns(websiteId: string): Promise<CrawlRunRecord[]> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const res = await prisma.crawlRun.findMany({
          where: { websiteId },
          orderBy: { startedAt: 'desc' },
        });
        return res as unknown as CrawlRunRecord[];
      } catch {
        // Fallback
      }
    }
    return Array.from(devCrawlRuns.values())
      .filter((r) => r.websiteId === websiteId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  public static async saveCrawledPagesBatch(
    crawlRunId: string,
    websiteId: string,
    pages: Omit<CrawledPageRecord, 'id'>[]
  ): Promise<void> {
    const prisma = getPrismaClient();
    const recordsWithId = pages.map((p) => ({
      ...p,
      id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    }));

    if (prisma) {
      try {
        await prisma.crawledPage.createMany({
          data: recordsWithId.map((p) => ({
            ...p,
            h1Tags: p.h1Tags || [],
            indexabilityReasons: p.indexabilityReasons || [],
            schemaTypes: p.schemaTypes || [],
            crawledAt: new Date(p.crawledAt),
          })),
          skipDuplicates: true,
        });
        return;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: ${err}`);
        }
      }
    }

    const currentPages = devCrawledPages.get(crawlRunId) || [];
    devCrawledPages.set(crawlRunId, [...currentPages, ...recordsWithId]);
  }

  public static async saveIssuesBatch(
    crawlRunId: string,
    issues: Omit<CrawlIssueRecord, 'id'>[]
  ): Promise<void> {
    const prisma = getPrismaClient();
    const records = issues.map((i) => ({
      ...i,
      id: `issue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    }));

    if (prisma) {
      try {
        await prisma.crawlIssue.createMany({
          data: records.map((r) => ({
            ...r,
            severity: r.severity as any,
            createdAt: new Date(r.createdAt),
          })),
          skipDuplicates: true,
        });
        return;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: ${err}`);
        }
      }
    }

    const current = devCrawlIssues.get(crawlRunId) || [];
    devCrawlIssues.set(crawlRunId, [...current, ...records]);
  }

  public static async saveLinkEdgesBatch(
    crawlRunId: string,
    edges: Omit<InternalLinkEdgeRecord, 'id'>[]
  ): Promise<void> {
    const prisma = getPrismaClient();
    const records = edges.map((e) => ({
      ...e,
      id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    }));

    if (prisma) {
      try {
        await prisma.internalLinkEdge.createMany({
          data: records.map((r) => ({
            ...r,
            createdAt: new Date(r.createdAt),
          })),
          skipDuplicates: true,
        });
        return;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: ${err}`);
        }
      }
    }

    const current = devLinkEdges.get(crawlRunId) || [];
    devLinkEdges.set(crawlRunId, [...current, ...records]);
  }

  public static async saveSeoEventsBatch(
    websiteId: string,
    events: Omit<SeoEventRecord, 'id'>[]
  ): Promise<void> {
    const prisma = getPrismaClient();
    const records = events.map((ev) => ({
      ...ev,
      id: `sevt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    }));

    if (prisma) {
      try {
        await prisma.seoEvent.createMany({
          data: records.map((r) => ({
            ...r,
            detectedAt: new Date(r.detectedAt),
          })),
          skipDuplicates: true,
        });
        return;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`PERSISTENCE_UNAVAILABLE: ${err}`);
        }
      }
    }

    const current = devSeoEvents.get(websiteId) || [];
    devSeoEvents.set(websiteId, [...current, ...records]);
  }

  // Database-Level Pagination
  public static async getCrawledPages(
    crawlRunId: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<{ total: number; pages: CrawledPageRecord[] }> {
    const { offset = 0, limit = 50 } = options;
    const prisma = getPrismaClient();

    if (prisma) {
      try {
        const total = await prisma.crawledPage.count({ where: { crawlRunId } });
        const rows = await prisma.crawledPage.findMany({
          where: { crawlRunId },
          orderBy: { crawledAt: 'asc' },
          skip: offset,
          take: limit,
        });
        return { total, pages: rows as unknown as CrawledPageRecord[] };
      } catch {
        // Fallback
      }
    }

    const all = devCrawledPages.get(crawlRunId) || [];
    return {
      total: all.length,
      pages: all.slice(offset, offset + limit),
    };
  }

  public static async getCrawlIssues(
    crawlRunId: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<{ total: number; issues: CrawlIssueRecord[] }> {
    const { offset = 0, limit = 100 } = options;
    const prisma = getPrismaClient();

    if (prisma) {
      try {
        const total = await prisma.crawlIssue.count({ where: { crawlRunId } });
        const rows = await prisma.crawlIssue.findMany({
          where: { crawlRunId },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        });
        return { total, issues: rows as unknown as CrawlIssueRecord[] };
      } catch {
        // Fallback
      }
    }

    const all = devCrawlIssues.get(crawlRunId) || [];
    return {
      total: all.length,
      issues: all.slice(offset, offset + limit),
    };
  }

  public static async getSeoEvents(
    websiteId: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<{ total: number; events: SeoEventRecord[] }> {
    const { offset = 0, limit = 100 } = options;
    const prisma = getPrismaClient();

    if (prisma) {
      try {
        const total = await prisma.seoEvent.count({ where: { websiteId } });
        const rows = await prisma.seoEvent.findMany({
          where: { websiteId },
          orderBy: { detectedAt: 'desc' },
          skip: offset,
          take: limit,
        });
        return { total, events: rows as unknown as SeoEventRecord[] };
      } catch {
        // Fallback
      }
    }

    const all = devSeoEvents.get(websiteId) || [];
    return {
      total: all.length,
      events: all.slice(offset, offset + limit),
    };
  }

  public static async getLinkEdges(
    crawlRunId: string,
    options: { offset?: number; limit?: number } = {}
  ): Promise<{ total: number; links: InternalLinkEdgeRecord[] }> {
    const { offset = 0, limit = 100 } = options;
    const prisma = getPrismaClient();

    if (prisma) {
      try {
        const total = await prisma.internalLinkEdge.count({ where: { crawlRunId } });
        const rows = await prisma.internalLinkEdge.findMany({
          where: { crawlRunId },
          skip: offset,
          take: limit,
        });
        return { total, links: rows as unknown as InternalLinkEdgeRecord[] };
      } catch {
        // Fallback
      }
    }

    const all = devLinkEdges.get(crawlRunId) || [];
    return {
      total: all.length,
      links: all.slice(offset, offset + limit),
    };
  }

  public static async clearForTesting(): Promise<void> {
    devUrlIdentities.clear();
    devCrawlRuns.clear();
    devCrawledPages.clear();
    devCrawlIssues.clear();
    devLinkEdges.clear();
    devSeoEvents.clear();
  }
}
