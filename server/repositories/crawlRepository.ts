import { CrawlRunLifecycle } from '@prisma/client';
import { getPrismaClient } from '../db/prismaClient';
import { UrlNormalizer } from '../services/crawler/urlNormalizer';

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

// In-Memory Dev / Standalone Store (strictly documented and isolated)
const devCrawlRuns: Map<string, CrawlRunRecord> = new Map();
const devCrawledPages: Map<string, CrawledPageRecord[]> = new Map(); // crawlRunId -> pages
const devCrawlIssues: Map<string, CrawlIssueRecord[]> = new Map(); // crawlRunId -> issues
const devLinkEdges: Map<string, InternalLinkEdgeRecord[]> = new Map(); // crawlRunId -> links
const devSeoEvents: Map<string, SeoEventRecord[]> = new Map(); // websiteId -> events

export class CrawlRepository {
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
        // Fallback to dev store if not in prod
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
        // Fallback to dev store
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

  public static async getCrawledPages(crawlRunId: string): Promise<CrawledPageRecord[]> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const res = await prisma.crawledPage.findMany({
          where: { crawlRunId },
          orderBy: { crawledAt: 'asc' },
        });
        return res as unknown as CrawledPageRecord[];
      } catch {
        // Fallback
      }
    }
    return devCrawledPages.get(crawlRunId) || [];
  }

  public static async getCrawlIssues(crawlRunId: string): Promise<CrawlIssueRecord[]> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const res = await prisma.crawlIssue.findMany({
          where: { crawlRunId },
          orderBy: { createdAt: 'desc' },
        });
        return res as unknown as CrawlIssueRecord[];
      } catch {
        // Fallback
      }
    }
    return devCrawlIssues.get(crawlRunId) || [];
  }

  public static async getSeoEvents(websiteId: string): Promise<SeoEventRecord[]> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const res = await prisma.seoEvent.findMany({
          where: { websiteId },
          orderBy: { detectedAt: 'desc' },
        });
        return res as unknown as SeoEventRecord[];
      } catch {
        // Fallback
      }
    }
    return devSeoEvents.get(websiteId) || [];
  }

  public static async getLinkEdges(crawlRunId: string): Promise<InternalLinkEdgeRecord[]> {
    const prisma = getPrismaClient();
    if (prisma) {
      try {
        const res = await prisma.internalLinkEdge.findMany({
          where: { crawlRunId },
        });
        return res as unknown as InternalLinkEdgeRecord[];
      } catch {
        // Fallback
      }
    }
    return devLinkEdges.get(crawlRunId) || [];
  }

  public static async clearForTesting(): Promise<void> {
    devCrawlRuns.clear();
    devCrawledPages.clear();
    devCrawlIssues.clear();
    devLinkEdges.clear();
    devSeoEvents.clear();
  }
}
