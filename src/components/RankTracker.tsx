import React, { useState } from 'react';
import { RankedKeyword } from '../types';
import {
  TrendingUp,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  SlidersHorizontal,
  Flame,
  ShieldAlert,
} from 'lucide-react';

interface RankTrackerProps {
  keywords: RankedKeyword[];
}

export const RankTracker: React.FC<RankTrackerProps> = ({ keywords }) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [intentFilter, setIntentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeyword, setSelectedKeyword] = useState<RankedKeyword | null>(keywords[0] || null);

  const filteredKeywords = keywords.filter((k) => {
    const matchesSearch = k.keyword.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          k.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || k.status === statusFilter;
    const matchesIntent = intentFilter === 'ALL' || k.searchIntent === intentFilter;
    return matchesSearch && matchesStatus && matchesIntent;
  });

  const risingCount = keywords.filter((k) => k.status === 'RISING').length;
  const decliningCount = keywords.filter((k) => k.status === 'DECLINING').length;
  const stableCount = keywords.filter((k) => k.status === 'STABLE').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <TrendingUp className="h-4 w-4" />
            <span>DAILY RANKING INTELLIGENCE & SERP VOLATILITY</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Daily SERP Rank Tracking & Volatility Monitor
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Track daily SERP movements across desktop and mobile, monitor rich snippet capture (PAA, P0 Snippets), and diagnose isolated vs sitewide ranking shifts.
          </p>
        </div>

        {/* Volatility Index Gauge */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
          <Flame className="h-6 w-6 text-emerald-400" />
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-white">SERP Volatility:</span>
              <span className="text-xs font-mono font-bold text-emerald-400">Low (2.4 / 10)</span>
            </div>
            <p className="text-[10px] text-slate-400">Stable landscape. No algorithmic penalty indicated.</p>
          </div>
        </div>
      </div>

      {/* Movement Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 font-medium">Tracked Keywords</span>
          <div className="text-xl font-bold text-white mt-0.5">{keywords.length} Active</div>
        </div>
        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-emerald-400 font-medium">Rising Positions</span>
          <div className="text-xl font-bold text-emerald-400 mt-0.5">{risingCount} Keywords</div>
        </div>
        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-rose-400 font-medium">Declining Positions</span>
          <div className="text-xl font-bold text-rose-400 mt-0.5">{decliningCount} Keywords</div>
        </div>
        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-sky-400 font-medium">Stable Positions</span>
          <div className="text-xl font-bold text-sky-400 mt-0.5">{stableCount} Keywords</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search keywords or URLs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by Movement Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Movements</option>
            <option value="RISING">Rising Only</option>
            <option value="DECLINING">Declining Only</option>
            <option value="STABLE">Stable Only</option>
          </select>

          <select
            aria-label="Filter by Search Intent"
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Search Intents</option>
            <option value="Commercial">Commercial</option>
            <option value="Informational">Informational</option>
            <option value="Transactional">Transactional</option>
          </select>
        </div>
      </div>

      {/* Table & Detailed Historical Line (Split Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="py-2.5 px-4">Keyword & Intent</th>
                  <th className="py-2.5 px-4">Current SERP</th>
                  <th className="py-2.5 px-4">Change</th>
                  <th className="py-2.5 px-4 text-right">Volume</th>
                  <th className="py-2.5 px-4 text-right">Clicks</th>
                  <th className="py-2.5 px-4">Features</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredKeywords.map((kw) => {
                  const isSelected = selectedKeyword?.id === kw.id;
                  return (
                    <tr
                      key={kw.id}
                      onClick={() => setSelectedKeyword(kw)}
                      className={`hover:bg-slate-850 cursor-pointer transition-colors ${
                        isSelected ? 'bg-slate-850 font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-4 max-w-[260px]">
                        <p className="font-semibold text-emerald-400 truncate">{kw.keyword}</p>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-mono">{kw.searchIntent}</span>
                          <span>•</span>
                          <span className="truncate">{kw.url.replace('https://techscale.io', '')}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white text-sm">
                        #{kw.position.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {kw.change > 0 && (
                          <span className="flex items-center text-emerald-400 font-bold">
                            <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                            +{kw.change.toFixed(1)}
                          </span>
                        )}
                        {kw.change < 0 && (
                          <span className="flex items-center text-rose-400 font-bold">
                            <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
                            {kw.change.toFixed(1)}
                          </span>
                        )}
                        {kw.change === 0 && (
                          <span className="flex items-center text-slate-400">
                            <Minus className="h-3.5 w-3.5 mr-0.5" />
                            0.0
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        {kw.monthlySearchVolume.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {kw.clicks.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {kw.serpFeatures.map((feat, i) => (
                            <span key={i} className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300">
                              {feat}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Keyword Detailed Inspector & History (Right) */}
        <div className="lg:col-span-4 bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
          {selectedKeyword ? (
            <>
              <div className="border-b border-slate-800 pb-3">
                <span className="text-xs font-mono text-slate-400">Keyword Inspector</span>
                <h3 className="text-base font-bold text-white mt-1">{selectedKeyword.keyword}</h3>
                <p className="text-xs text-emerald-400 font-mono mt-0.5 break-all">{selectedKeyword.url}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-slate-400 text-[10px]">Current Position</span>
                  <p className="font-mono text-xl font-bold text-white mt-0.5">#{selectedKeyword.position.toFixed(1)}</p>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-slate-400 text-[10px]">Monthly Search Vol</span>
                  <p className="font-mono text-xl font-bold text-emerald-400 mt-0.5">{selectedKeyword.monthlySearchVolume.toLocaleString()}</p>
                </div>
              </div>

              {/* Historical Position Trail */}
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider text-[11px]">Trailing Position Log</span>
                <div className="space-y-1.5 mt-2">
                  {selectedKeyword.history.map((hist, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">{hist.date}</span>
                      <span className="text-white font-bold">Pos #{hist.position}</span>
                      <span className="text-emerald-400 font-semibold">{hist.clicks} Clicks</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">Select a keyword to view history</div>
          )}
        </div>
      </div>
    </div>
  );
};
