import { CrawlFrontier } from './crawlFrontier';
import { UrlNormalizer } from './urlNormalizer';
import { UrlScopePolicy, CrawlScopeConfig } from './urlScopePolicy';
import { RobotsService, ParsedRobotsTxt } from './robotsService';
import { SitemapService } from './sitemapService';
import { SafeUrlPolicy } from '../../security/safeUrlPolicy';
import { HtmlParser } from './htmlParser';
import { RedirectAnalyzer, RedirectHop } from './redirectAnalyzer';
import { IndexabilityAnalyzer } from './indexabilityAnalyzer';
import { DuplicateContentAnalyzer } from './duplicateContentAnalyzer';
import { LinkGraphBuilder, DiscoveredLink } from './linkGraphBuilder';
import { TechnicalIssueDetector, EvaluatedIssue } from './technicalIssueDetector';
import { CrawlSnapshotComparator, CrawledPageSnapshot } from './crawlSnapshotComparator';
import { CrawlRepository, CrawledPageRecord, CrawlIssueRecord, InternalLinkEdgeRecord, SeoEventRecord } from '../../repositories/crawlRepository';

export interface CrawlConfiguration {
  websiteId: string;
  seedUrl: string;
  userAgent?: string;
  maxUrls?: number;
  maxDepth?: number;
  maxConcurrency?: number;
  requestsPerSecond?: number;
  requestTimeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
  respectRobots?: boolean;
  crawlSitemaps?: boolean;
  includeSubdomains?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export class CrawlCoordinator {
  private static activeCrawlControllers: Map<string, AbortController> = new Map();
  private static pausedCrawls: Set<string> = new Set();

  public static cancelCrawl(crawlRunId: string): boolean {
    const controller = this.activeCrawlControllers.get(crawlRunId);
    if (controller) {
      controller.abort();
      this.activeCrawlControllers.delete(crawlRunId);
      return true;
    }
    return false;
  }

  public static pauseCrawl(crawlRunId: string): boolean {
    this.pausedCrawls.add(crawlRunId);
    return true;
  }

  public static resumeCrawl(crawlRunId: string): boolean {
    this.pausedCrawls.delete(crawlRunId);
    return true;
  }

  public static async executeCrawl(config: CrawlConfiguration): Promise<{
    crawlRunId: string;
    totalPages: number;
    totalIssues: number;
    durationMs: number;
    status: string;
  }> {
    const {
      websiteId,
      seedUrl,
      userAgent = 'AISEOManagerBot/2.0 (+https://techscale.io/bot)',
      maxUrls = 50,
      maxDepth = 3,
      maxConcurrency = 2,
      requestTimeoutMs = 8000,
      maxResponseBytes = 4 * 1024 * 1024,
      maxRedirects = 5,
      respectRobots = true,
      crawlSitemaps = true,
      includeSubdomains = false,
      includePatterns = [],
      excludePatterns = [],
    } = config;

    const normalizedSeed = UrlNormalizer.normalize(seedUrl);
    const parsedSeed = new URL(normalizedSeed);
    const originUrl = `${parsedSeed.protocol}//${parsedSeed.host}`;

    // 1. Create CrawlRun in Repository
    const crawlRun = await CrawlRepository.createCrawlRun({
      websiteId,
      seedUrl: normalizedSeed,
      config,
    });

    const crawlRunId = crawlRun.id;
    const abortController = new AbortController();
    this.activeCrawlControllers.set(crawlRunId, abortController);
    const startTime = Date.now();

    const scopeConfig: CrawlScopeConfig = {
      allowedHost: parsedSeed.hostname,
      allowSubdomains: includeSubdomains,
      includePatterns,
      excludePatterns,
      maxDepth,
    };

    const frontier = new CrawlFrontier();
    let robotsParsed: ParsedRobotsTxt = { rules: [], sitemaps: [], rawContent: '' };

    // 2. Fetch & Parse robots.txt
    if (respectRobots) {
      const robotsRes = await RobotsService.fetchAndParseRobots(originUrl, userAgent);
      robotsParsed = robotsRes.parsed;
      await CrawlRepository.updateCrawlRun(crawlRunId, {
        robotsTxtStatus: robotsRes.fetchStatus ? `HTTP_${robotsRes.fetchStatus}` : 'FETCH_FAILED',
        robotsTxtHash: robotsParsed.rawContent ? DuplicateContentAnalyzer.generateExactHash(robotsParsed.rawContent) : undefined,
      });
    }

    // 3. Discover Sitemaps
    const sitemapsDiscovered: string[] = [];
    if (crawlSitemaps) {
      const candidateSitemaps = [
        ...robotsParsed.sitemaps,
        `${originUrl}/sitemap.xml`,
        `${originUrl}/sitemap_index.xml`,
      ];
      const uniqueSitemaps = Array.from(new Set(candidateSitemaps));

      for (const smUrl of uniqueSitemaps) {
        if (frontier.size() >= maxUrls) break;
        const smResult = await SitemapService.discoverUrlsFromSitemap(smUrl);
        if (smResult.totalUrls > 0) {
          sitemapsDiscovered.push(smUrl);
          for (const discovered of smResult.discoveredUrls) {
            const scopeCheck = UrlScopePolicy.isUrlInScope(discovered.normalizedUrl, 1, scopeConfig);
            if (scopeCheck.allowed) {
              frontier.enqueue(
                crawlRunId,
                discovered.loc,
                discovered.normalizedUrl,
                1,
                'SITEMAP',
                discovered.priority ? Math.round(discovered.priority * 10) : 10
              );
            }
          }
        }
      }
    }

    // Always seed the entrypoint
    frontier.enqueue(crawlRunId, seedUrl, normalizedSeed, 0, 'SEED', 20);

    const crawledPagesBuffer: CrawledPageRecord[] = [];
    const discoveredLinkEdges: DiscoveredLink[] = [];
    const detectedIssuesBuffer: CrawlIssueRecord[] = [];

    // 4. Crawl Execution Loop
    try {
      while (frontier.size() > 0 && crawledPagesBuffer.length < maxUrls) {
        if (abortController.signal.aborted) {
          await CrawlRepository.updateCrawlRun(crawlRunId, { status: 'CANCELLED' });
          break;
        }

        while (this.pausedCrawls.has(crawlRunId)) {
          await new Promise((r) => setTimeout(r, 500));
          if (abortController.signal.aborted) break;
        }

        const nextItem = frontier.dequeue();
        if (!nextItem) break;

        // Check Robots
        if (respectRobots) {
          const robotsCheck = RobotsService.isAllowed(robotsParsed, nextItem.url, userAgent);
          if (!robotsCheck.allowed) {
            frontier.markBlocked(nextItem.normalizedUrl, 'ROBOTS');
            continue;
          }
        }

        // Fetch URL
        let fetchResult: any;
        const redirectChain: RedirectHop[] = [];

        try {
          fetchResult = await SafeUrlPolicy.safeFetch(nextItem.url, {
            timeoutMs: requestTimeoutMs,
            maxRedirects,
            maxResponseBytes,
            userAgent,
          });
        } catch (fetchErr: any) {
          frontier.markFailed(nextItem.normalizedUrl, fetchErr.message);
          continue;
        }

        // Parse HTML
        const parsedHtml = HtmlParser.parse(
          fetchResult.body,
          fetchResult.finalUrl,
          fetchResult.statusCode,
          fetchResult.headers
        );

        // Indexability Evaluation
        const indexability = IndexabilityAnalyzer.evaluate({
          statusCode: fetchResult.statusCode,
          isNoIndexMeta: Boolean(parsedHtml.metaRobots && parsedHtml.metaRobots.toLowerCase().includes('noindex')),
          isNoIndexHeader: Boolean(parsedHtml.xRobotsTag && parsedHtml.xRobotsTag.toLowerCase().includes('noindex')),
          isRobotsBlocked: false,
          hasCanonical: Boolean(parsedHtml.canonicalUrl),
          isSelfCanonical: parsedHtml.canonicalMatch,
          canonicalTargetUrl: parsedHtml.canonicalUrl || undefined,
          isErrorStatus: fetchResult.statusCode >= 400,
        });

        // Content Hashing
        const contentHash = DuplicateContentAnalyzer.generateExactHash(fetchResult.body);
        const simHash = DuplicateContentAnalyzer.generateSimHash64(fetchResult.body);

        const pageRecord: CrawledPageRecord = {
          id: `page-${crawledPagesBuffer.length + 1}`,
          websiteId,
          crawlRunId,
          url: nextItem.url,
          normalizedUrl: nextItem.normalizedUrl,
          pathname: new URL(nextItem.normalizedUrl).pathname,
          statusCode: fetchResult.statusCode,
          finalUrl: fetchResult.finalUrl,
          redirectCount: fetchResult.redirectCount,
          redirectChainJson: JSON.stringify(redirectChain),
          loadTimeMs: fetchResult.loadTimeMs,
          contentLengthBytes: fetchResult.body.length,
          isIndexable: indexability.isIndexable,
          indexabilityStatus: indexability.indexabilityStatus,
          indexabilityReasons: indexability.reasons,
          canonicalUrl: parsedHtml.canonicalUrl || undefined,
          normalizedCanonicalUrl: parsedHtml.canonicalUrl ? UrlNormalizer.normalize(parsedHtml.canonicalUrl, originUrl) : undefined,
          canonicalMatch: parsedHtml.canonicalMatch,
          title: parsedHtml.title || undefined,
          titleLength: parsedHtml.titleLength,
          metaDescription: parsedHtml.metaDescription || undefined,
          metaDescLength: parsedHtml.metaDescLength,
          metaRobots: parsedHtml.metaRobots || undefined,
          xRobotsTag: parsedHtml.xRobotsTag || undefined,
          h1Tags: parsedHtml.h1Tags,
          h2Count: parsedHtml.h2Count,
          h3Count: 0,
          wordCount: parsedHtml.wordCount,
          contentHash,
          simHash,
          isExactDuplicate: false,
          isThinContent: parsedHtml.wordCount < 150,
          isPossibleSoft404: false,
          soft404Confidence: 0.0,
          internalInlinksCount: 0,
          internalOutlinksCount: parsedHtml.internalOutlinksCount,
          externalOutlinksCount: parsedHtml.externalOutlinksCount,
          imagesCount: parsedHtml.imagesCount,
          missingAltCount: parsedHtml.missingAltCount,
          schemaTypes: parsedHtml.schemaTypes,
          schemaStatus: parsedHtml.schemaTypes.length > 0 ? 'PARSED' : 'NO_SCHEMA',
          crawlDepth: nextItem.depth,
          crawledAt: new Date().toISOString(),
        };

        crawledPagesBuffer.push(pageRecord);
        frontier.markCompleted(nextItem.normalizedUrl);

        // Discover and enqueue outgoing links
        for (const outlink of parsedHtml.internalOutlinksSample) {
          try {
            const normalizedOutlink = UrlNormalizer.resolveAndNormalize(outlink, originUrl);
            discoveredLinkEdges.push({
              sourceUrl: nextItem.normalizedUrl,
              targetUrl: outlink,
              normalizedTarget: normalizedOutlink,
              isInternal: true,
              isNofollow: false,
            });

            const nextDepth = nextItem.depth + 1;
            const scopeCheck = UrlScopePolicy.isUrlInScope(normalizedOutlink, nextDepth, scopeConfig);

            if (scopeCheck.allowed && !frontier.isVisited(normalizedOutlink)) {
              frontier.enqueue(crawlRunId, outlink, normalizedOutlink, nextDepth, 'HTML_LINK', 10, nextItem.url);
            }
          } catch {
            // invalid link ignore
          }
        }
      }

      // 5. Compute Link Graph Metrics (Inlinks, Outlinks, Click Depth, Orphan Candidates)
      const allKnownUrls = crawledPagesBuffer.map((p) => p.normalizedUrl);
      const graphNodes = LinkGraphBuilder.computeGraphMetrics(discoveredLinkEdges, [normalizedSeed], allKnownUrls);

      for (const page of crawledPagesBuffer) {
        const node = graphNodes.get(page.normalizedUrl);
        if (node) {
          page.internalInlinksCount = node.inlinksCount;
          page.internalOutlinksCount = node.outlinksCount;
          page.externalOutlinksCount = node.externalOutlinksCount;
          page.crawlDepth = node.crawlDepth;
        }

        // 6. Detect Technical Issues per Page
        const evaluatedIssues = TechnicalIssueDetector.detectIssues({
          url: page.url,
          statusCode: page.statusCode,
          title: page.title,
          metaDescription: page.metaDescription,
          h1Tags: page.h1Tags,
          h2Count: page.h2Count,
          wordCount: page.wordCount,
          isIndexable: page.isIndexable,
          canonicalUrl: page.canonicalUrl,
          canonicalMatch: page.canonicalMatch,
          redirectCount: page.redirectCount,
          imagesCount: page.imagesCount,
          missingAltCount: page.missingAltCount,
          schemaStatus: page.schemaStatus,
          schemaTypes: page.schemaTypes,
          isExactDuplicate: page.isExactDuplicate,
          isOrphanCandidate: node?.isOrphanCandidate,
          crawlDepth: page.crawlDepth,
        });

        for (const issue of evaluatedIssues) {
          detectedIssuesBuffer.push({
            id: `issue-${detectedIssuesBuffer.length + 1}`,
            crawlRunId,
            ruleKey: issue.ruleKey,
            ruleVersion: issue.ruleVersion,
            type: issue.type,
            severity: issue.severity,
            message: issue.message,
            evidence: JSON.stringify(issue.evidence),
            impact: issue.impact,
            resolved: false,
            createdAt: new Date().toISOString(),
          });
        }
      }

      // 7. Persist Crawled Pages, Issues, and Edges
      await CrawlRepository.saveCrawledPagesBatch(crawlRunId, websiteId, crawledPagesBuffer);
      await CrawlRepository.saveIssuesBatch(crawlRunId, detectedIssuesBuffer);
      await CrawlRepository.saveLinkEdgesBatch(
        crawlRunId,
        discoveredLinkEdges.map((e) => ({
          crawlRunId,
          sourceUrl: e.sourceUrl,
          targetUrl: e.targetUrl,
          normalizedTarget: e.normalizedTarget,
          anchorText: e.anchorText,
          isInternal: e.isInternal,
          rel: e.rel,
          isNofollow: e.isNofollow,
          isBroken: false,
          createdAt: new Date().toISOString(),
        }))
      );

      // 8. Historical Snapshot Comparison & SEO Event Generation
      const previousRuns = await CrawlRepository.listCrawlRuns(websiteId);
      const lastCompleted = previousRuns.find((r) => r.id !== crawlRunId && r.status === 'COMPLETED');

      if (lastCompleted) {
        const previousPages = await CrawlRepository.getCrawledPages(lastCompleted.id);
        const currSnapshots: CrawledPageSnapshot[] = crawledPagesBuffer.map((p) => ({
          url: p.url,
          normalizedUrl: p.normalizedUrl,
          statusCode: p.statusCode,
          finalUrl: p.finalUrl,
          title: p.title,
          metaDescription: p.metaDescription,
          h1Tags: p.h1Tags,
          canonicalUrl: p.canonicalUrl,
          isIndexable: p.isIndexable,
          contentHash: p.contentHash,
          inlinksCount: p.internalInlinksCount,
        }));
        const prevSnapshots: CrawledPageSnapshot[] = previousPages.map((p) => ({
          url: p.url,
          normalizedUrl: p.normalizedUrl,
          statusCode: p.statusCode,
          finalUrl: p.finalUrl,
          title: p.title,
          metaDescription: p.metaDescription,
          h1Tags: p.h1Tags,
          canonicalUrl: p.canonicalUrl,
          isIndexable: p.isIndexable,
          contentHash: p.contentHash,
          inlinksCount: p.internalInlinksCount,
        }));

        const events = CrawlSnapshotComparator.compareSnapshots(websiteId, crawlRunId, currSnapshots, prevSnapshots);
        if (events.length > 0) {
          await CrawlRepository.saveSeoEventsBatch(
            websiteId,
            events.map((ev) => ({
              websiteId,
              crawlRunId,
              eventType: ev.eventType,
              entityType: ev.entityType,
              entityUrl: ev.entityUrl,
              beforeValue: ev.beforeValue,
              afterValue: ev.afterValue,
              deltaNotes: ev.deltaNotes,
              severity: ev.severity,
              source: ev.source,
              detectedAt: new Date().toISOString(),
            }))
          );
        }
      }

      // 9. Mark Crawl Run Complete
      const durationMs = Date.now() - startTime;
      await CrawlRepository.updateCrawlRun(crawlRunId, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        durationMs,
        totalPages: crawledPagesBuffer.length,
        totalIssues: detectedIssuesBuffer.length,
        urlsDiscovered: frontier.getAllItems().length,
        urlsFetched: crawledPagesBuffer.length,
        sitemapsDiscovered,
      });

      this.activeCrawlControllers.delete(crawlRunId);

      return {
        crawlRunId,
        totalPages: crawledPagesBuffer.length,
        totalIssues: detectedIssuesBuffer.length,
        durationMs,
        status: 'COMPLETED',
      };
    } catch (err: any) {
      await CrawlRepository.updateCrawlRun(crawlRunId, {
        status: 'FAILED',
        completedAt: new Date().toISOString(),
      });
      this.activeCrawlControllers.delete(crawlRunId);
      throw err;
    }
  }
}
