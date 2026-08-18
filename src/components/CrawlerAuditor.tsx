import React, { useState } from 'react';
import { CrawlSnapshot, CrawledUrl } from '../types';
import { crawlUrl, exportToCsv } from '../services/api';
import {
  Cpu,
  Search,
  Download,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Layers,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Code,
  Link2,
} from 'lucide-react';

interface CrawlerAuditorProps {
  currentSnapshot: CrawlSnapshot;
  previousSnapshot: CrawlSnapshot;
  onAddCrawledUrl?: (urlData: CrawledUrl) => void;
}

export const CrawlerAuditor: React.FC<CrawlerAuditorProps> = ({
  currentSnapshot,
  previousSnapshot,
  onAddCrawledUrl,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'URLS' | 'SNAPSHOT_DIFF' | 'LIVE_AUDIT'>('URLS');
  const [liveUrlInput, setLiveUrlInput] = useState('https://techscale.io/pricing/enterprise');
  const [isCrawling, setIsCrawling] = useState(false);
  const [liveCrawlResult, setLiveCrawlResult] = useState<any>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [indexableFilter, setIndexableFilter] = useState<string>('ALL');
  const [selectedUrl, setSelectedUrl] = useState<CrawledUrl | null>(currentSnapshot.urls[0] || null);

  const handleRunLiveCrawl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!liveUrlInput.trim()) return;

    setIsCrawling(true);
    setCrawlError(null);
    try {
      const data = await crawlUrl(liveUrlInput.trim());
      setLiveCrawlResult(data);
      const targetUrl = data.finalUrl || data.requestedUrl;
      if (onAddCrawledUrl && targetUrl) {
        let pathname = '/';
        try {
          pathname = new URL(targetUrl).pathname;
        } catch {
          pathname = targetUrl;
        }

        const newCrawledUrl: CrawledUrl = {
          url: targetUrl,
          path: pathname,
          status: data.statusCode || 200,
          loadTimeMs: data.loadTimeMs || 0,
          isIndexable: data.isIndexable,
          canonical: data.canonicalUrl || targetUrl,
          canonicalSelfReferential: (data.canonicalUrl || targetUrl) === targetUrl,
          title: data.title || '',
          metaDescription: data.metaDescription || '',
          metaRobots: data.metaRobots || 'index, follow',
          h1: data.h1Tags || [],
          h2Count: data.h2Count || 0,
          wordCount: data.wordCount || 0,
          schemaTypes: data.schemaTypes || [],
          internalInlinks: 0,
          internalOutlinks: data.internalOutlinksCount || 0,
          externalLinks: data.externalOutlinksCount || 0,
          imagesCount: data.imagesCount || 0,
          missingAltCount: data.missingAltCount || 0,
          isOrphan: false,
          clickDepth: 1,
          lastCrawled: data.crawledAt,
          firstDiscovered: data.crawledAt,
          lastChanged: data.crawledAt,
          issues: (data.issues || []).map((i: any) => ({
            type: i.type,
            severity: i.severity,
            message: i.message,
            impact: i.impact || 'Evaluated from live server response',
          })),
        };
        onAddCrawledUrl(newCrawledUrl);
        setSelectedUrl(newCrawledUrl);
      }
    } catch (err: any) {
      setCrawlError(err.message || 'Crawl failed to complete');
    } finally {
      setIsCrawling(false);
    }
  };

  const handleExportCsv = () => {
    const rows = currentSnapshot.urls.map((u) => ({
      URL: u.url,
      Status: u.status,
      Indexable: u.isIndexable ? 'YES' : 'NO',
      Title: u.title,
      MetaDescription: u.metaDescription,
      H1: (u.h1 || []).join(' | '),
      Canonical: u.canonical,
      SelfReferentialCanonical: u.canonicalSelfReferential ? 'YES' : 'NO',
      WordCount: u.wordCount,
      LoadTimeMs: u.loadTimeMs,
      Inlinks: u.internalInlinks,
      Outlinks: u.internalOutlinks,
      ImagesWithoutAlt: u.missingAltCount,
      IssuesCount: u.issues.length,
      LastCrawled: u.lastCrawled,
    }));
    exportToCsv(rows);
  };

  const filteredUrls = currentSnapshot.urls.filter((u) => {
    const matchesSearch =
      u.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === '200' && u.status === 200) ||
      (statusFilter === '3xx' && u.status >= 300 && u.status < 400) ||
      (statusFilter === '4xx' && u.status >= 400 && u.status < 500) ||
      (statusFilter === '5xx' && u.status >= 500);
    const matchesIndexable =
      indexableFilter === 'ALL' ||
      (indexableFilter === 'INDEXABLE' && u.isIndexable) ||
      (indexableFilter === 'NON_INDEXABLE' && !u.isIndexable) ||
      (indexableFilter === 'HAS_ISSUES' && u.issues.length > 0) ||
      (indexableFilter === 'ORPHAN' && u.isOrphan);

    return matchesSearch && matchesStatus && matchesIndexable;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <Cpu className="h-4 w-4" />
            <span>REAL-TIME TECHNICAL AUDIT & CRAWL DATABASE</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Technical SEO Crawler & Snapshot Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Inspect response codes, canonicalization integrity, robots directives, schema validation, orphan pages, and compare historical crawl diffs.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Crawl CSV</span>
          </button>
        </div>
      </div>

      {/* Subtabs Header */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('URLS')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'URLS'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          Crawled URLs Database ({currentSnapshot.urls.length})
        </button>
        <button
          onClick={() => setActiveSubTab('SNAPSHOT_DIFF')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'SNAPSHOT_DIFF'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          Crawl Snapshot Comparison (Diff)
        </button>
        <button
          onClick={() => setActiveSubTab('LIVE_AUDIT')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'LIVE_AUDIT'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          Live URL Deep Inspector
        </button>
      </div>

      {/* VIEW 1: CRAWLED URLS DATABASE */}
      {activeSubTab === 'URLS' && (
        <div className="space-y-4">
          {/* Status Breakdown KPI Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Total Discovered</span>
              <div className="text-xl font-bold text-white mt-0.5">{currentSnapshot.totalUrls} URLs</div>
            </div>
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[11px] text-emerald-400 font-medium">200 OK Indexable</span>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">{currentSnapshot.statusCodes[200]}</div>
            </div>
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[11px] text-sky-400 font-medium">3xx Redirects</span>
              <div className="text-xl font-bold text-sky-400 mt-0.5">{currentSnapshot.statusCodes[301] + currentSnapshot.statusCodes[302]}</div>
            </div>
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[11px] text-amber-400 font-medium">4xx Client Errors</span>
              <div className="text-xl font-bold text-amber-400 mt-0.5">{currentSnapshot.statusCodes[404]}</div>
            </div>
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[11px] text-rose-400 font-medium">Critical Issues</span>
              <div className="text-xl font-bold text-rose-400 mt-0.5">{currentSnapshot.issuesSummary.critical}</div>
            </div>
          </div>

          {/* Table Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by URL or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by HTTP Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">All HTTP Codes</option>
                <option value="200">200 OK Only</option>
                <option value="3xx">3xx Redirects</option>
                <option value="4xx">4xx Broken Links</option>
                <option value="5xx">5xx Server Errors</option>
              </select>

              <select
                aria-label="Filter by Technical Category"
                value={indexableFilter}
                onChange={(e) => setIndexableFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">All States</option>
                <option value="INDEXABLE">Indexable Only</option>
                <option value="NON_INDEXABLE">Non-Indexable</option>
                <option value="HAS_ISSUES">Has Technical Issues</option>
                <option value="ORPHAN">Orphan Pages (0 inlinks)</option>
              </select>
            </div>
          </div>

          {/* URLs Table & Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Path & Title</th>
                      <th className="py-2.5 px-3">Inlinks</th>
                      <th className="py-2.5 px-3">Issues</th>
                      <th className="py-2.5 px-3 text-right">Load Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {filteredUrls.map((u) => {
                      const isSelected = selectedUrl?.url === u.url;
                      return (
                        <tr
                          key={u.url}
                          onClick={() => setSelectedUrl(u)}
                          className={`hover:bg-slate-850 cursor-pointer transition-colors ${
                            isSelected ? 'bg-slate-850 font-medium' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                u.status === 200
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : u.status >= 300 && u.status < 400
                                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 max-w-[280px]">
                            <p className="font-mono text-emerald-400 truncate">{u.path}</p>
                            <p className="text-[11px] text-slate-400 truncate">{u.title || '(No Title Tag)'}</p>
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {u.isOrphan ? (
                              <span className="text-amber-400 font-bold">0 (Orphan)</span>
                            ) : (
                              <span>{u.internalInlinks}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {u.issues.length === 0 ? (
                              <span className="text-emerald-400 text-[11px] flex items-center">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Clean
                              </span>
                            ) : (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                  u.issues.some((i) => i.severity === 'CRITICAL')
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {u.issues.length} {u.issues.length === 1 ? 'Issue' : 'Issues'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">{u.loadTimeMs}ms</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* URL Inspector Drawer (Right) */}
            <div className="lg:col-span-5 bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
              {selectedUrl ? (
                <>
                  <div className="border-b border-slate-800 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-400">URL Inspector</span>
                      <a
                        href={selectedUrl.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center"
                      >
                        <span>Open Page</span>
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </div>
                    <h3 className="text-sm font-bold text-white break-all mt-1">{selectedUrl.url}</h3>
                  </div>

                  {/* Issues Box */}
                  {selectedUrl.issues.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                        Issues Flagged ({selectedUrl.issues.length})
                      </span>
                      {selectedUrl.issues.map((iss, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-rose-950/60 text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300">
                              {iss.severity}
                            </span>
                            <span className="font-semibold text-rose-200">{iss.type}</span>
                          </div>
                          <p className="text-slate-300 mt-1">{iss.message}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Impact: {iss.impact}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Technical Metadata Matrix */}
                  <div className="space-y-2 text-xs">
                    <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Metadata & Headings</span>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase">Title Tag ({selectedUrl.title.length} chars)</span>
                        <p className="text-slate-200 font-medium">{selectedUrl.title || '(Missing Title)'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase">Meta Description ({selectedUrl.metaDescription.length} chars)</span>
                        <p className="text-slate-300 text-[11px]">{selectedUrl.metaDescription || '(Missing Meta Description)'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase">Canonical Tag</span>
                        <p className={`font-mono text-[11px] break-all ${selectedUrl.canonicalSelfReferential ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
                          {selectedUrl.canonical || '(None)'}
                          {!selectedUrl.canonicalSelfReferential && ' [MISMATCH WITH URL]'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase">H1 Headings ({selectedUrl.h1.length})</span>
                        <ul className="list-disc list-inside text-slate-200 text-[11px]">
                          {selectedUrl.h1.map((h, idx) => (
                            <li key={idx}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Topology & Content Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 text-[10px]">Word Count</span>
                      <p className="font-mono font-bold text-white mt-0.5">{selectedUrl.wordCount}</p>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 text-[10px]">Internal Inlinks</span>
                      <p className="font-mono font-bold text-emerald-400 mt-0.5">{selectedUrl.internalInlinks}</p>
                    </div>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 text-[10px]">Schemas</span>
                      <p className="font-mono font-bold text-sky-400 mt-0.5">{selectedUrl.schemaTypes.length}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Select a URL from the crawl list to inspect technical attributes
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SNAPSHOT COMPARISON (DIFF) */}
      {activeSubTab === 'SNAPSHOT_DIFF' && (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Crawl Comparison: Current vs Previous Snapshot
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Comparing <strong>{currentSnapshot.label}</strong> against <strong>{previousSnapshot.label}</strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400">Discovered URLs</span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-bold text-emerald-400">+2</span>
                <span className="text-xs text-slate-400">new pages</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">/integrations/kubernetes & /case-studies/fintech-scale</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400">Resolved Issues</span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-bold text-emerald-400">2</span>
                <span className="text-xs text-slate-400">closed</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Fixed duplicate H1 on homepage and 1 301 redirect chain</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400">New Technical Defects</span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-bold text-rose-400">+1</span>
                <span className="text-xs text-slate-400">broken 404</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">/docs/legacy-api-v1 returned 404 with 4 active inlinks</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400">Canonical Integrity Delta</span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-bold text-amber-400">1</span>
                <span className="text-xs text-slate-400">flagged</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">/pricing/enterprise points to parent /pricing</p>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: LIVE URL DEEP AUDITOR */}
      {activeSubTab === 'LIVE_AUDIT' && (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Live URL Deep Technical Inspector</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter any real URL to perform an instant live HTTP request, parse HTML headings, metadata, schema, and detect SEO defects.
            </p>
          </div>

          <form onSubmit={handleRunLiveCrawl} className="flex gap-2">
            <input
              type="text"
              value={liveUrlInput}
              onChange={(e) => setLiveUrlInput(e.target.value)}
              placeholder="https://example.com/target-page"
              className="flex-1 px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              disabled={isCrawling}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isCrawling ? 'animate-spin' : ''}`} />
              <span>{isCrawling ? 'Crawling...' : 'Crawl Live URL'}</span>
            </button>
          </form>

          {crawlError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300">
              {crawlError}
            </div>
          )}

          {liveCrawlResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-400">HTTP Status</span>
                  <p className="font-mono text-base font-bold text-emerald-400 mt-0.5">{liveCrawlResult.status}</p>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-400">Load Time</span>
                  <p className="font-mono text-base font-bold text-white mt-0.5">{liveCrawlResult.loadTimeMs} ms</p>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-400">Word Count</span>
                  <p className="font-mono text-base font-bold text-white mt-0.5">{liveCrawlResult.wordCount}</p>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-400">Indexable</span>
                  <p className={`font-mono text-base font-bold mt-0.5 ${liveCrawlResult.isIndexable ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {liveCrawlResult.isIndexable ? 'YES' : 'NO'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 font-mono text-[10px]">Title:</span>
                  <p className="text-white font-medium">{liveCrawlResult.title || '(None)'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-mono text-[10px]">Meta Description:</span>
                  <p className="text-slate-300">{liveCrawlResult.metaDescription || '(None)'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-mono text-[10px]">Canonical:</span>
                  <p className="text-slate-300 font-mono">{liveCrawlResult.canonical || '(None)'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-mono text-[10px]">H1 Tag(s):</span>
                  <p className="text-white font-medium">{(liveCrawlResult.h1 || []).join(' | ') || '(None)'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
