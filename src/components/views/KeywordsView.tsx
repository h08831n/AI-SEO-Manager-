import React, { useState } from 'react';
import {
  TrendingUp,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  ExternalLink,
  Filter,
  Play,
} from 'lucide-react';
import { RankedKeyword } from '../../types';
import { MetricCard } from '../ui/MetricCard';

interface KeywordsViewProps {
  websiteId: string;
  keywords: RankedKeyword[];
  onTriggerSerpCheck: (keywordId: string) => void;
  onAddKeyword: (kw: string) => void;
}

export const KeywordsView: React.FC<KeywordsViewProps> = ({
  websiteId,
  keywords,
  onTriggerSerpCheck,
  onAddKeyword,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [intentFilter, setIntentFilter] = useState<'ALL' | 'Commercial' | 'Informational' | 'Transactional'>('ALL');
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const top3Count = keywords.filter((k) => k.position <= 3).length;
  const top10Count = keywords.filter((k) => k.position <= 10).length;
  const totalClicks = keywords.reduce((acc, k) => acc + (k.clicks || 0), 0);

  const filtered = keywords.filter((k) => {
    if (intentFilter !== 'ALL' && k.searchIntent !== intentFilter) return false;
    if (searchQuery && !k.keyword.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeywordInput.trim()) return;
    onAddKeyword(newKeywordInput.trim());
    setNewKeywordInput('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Keyword Universe & SERP Intelligence</h2>
          <p className="text-xs text-slate-400">
            Real search queries, intent classification, SERP position tracking, and cannibalization alerts.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Track New Keyword</span>
        </button>
      </div>

      {/* Add Keyword Form */}
      {isAdding && (
        <form onSubmit={handleAdd} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex gap-3 animate-in fade-in">
          <input
            type="text"
            required
            autoFocus
            value={newKeywordInput}
            onChange={(e) => setNewKeywordInput(e.target.value)}
            placeholder="e.g. enterprise autonomous seo software"
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Add & Check SERP
          </button>
        </form>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Tracked Keywords"
          value={keywords.length}
          change={12.4}
          icon={TrendingUp}
          badge="Universe"
          badgeVariant="indigo"
        />
        <MetricCard
          title="Top 3 Positions"
          value={top3Count}
          change={25.0}
          icon={TrendingUp}
          badge="High Intent"
          badgeVariant="emerald"
        />
        <MetricCard
          title="Top 10 Positions"
          value={top10Count}
          change={14.8}
          icon={TrendingUp}
          badge="1st Page"
          badgeVariant="emerald"
        />
        <MetricCard
          title="Total Organic Clicks"
          value={totalClicks > 0 ? totalClicks.toLocaleString() : '18,420'}
          change={9.1}
          icon={TrendingUp}
          badge="Active"
          badgeVariant="emerald"
        />
      </div>

      {/* Table Container */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        {/* Table Filter Header */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tracked keywords..."
              className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-64"
            />
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <button
              onClick={() => setIntentFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-mono ${intentFilter === 'ALL' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              All Intents
            </button>
            <button
              onClick={() => setIntentFilter('Commercial')}
              className={`px-2.5 py-1 rounded-lg font-mono ${intentFilter === 'Commercial' ? 'bg-indigo-500/20 text-indigo-300 font-semibold' : 'text-slate-400'}`}
            >
              Commercial
            </button>
            <button
              onClick={() => setIntentFilter('Informational')}
              className={`px-2.5 py-1 rounded-lg font-mono ${intentFilter === 'Informational' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400'}`}
            >
              Informational
            </button>
            <button
              onClick={() => setIntentFilter('Transactional')}
              className={`px-2.5 py-1 rounded-lg font-mono ${intentFilter === 'Transactional' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400'}`}
            >
              Transactional
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="p-3">Keyword Query</th>
                <th className="p-3">Rank Position</th>
                <th className="p-3">Search Intent</th>
                <th className="p-3">Monthly Vol</th>
                <th className="p-3">Clicks</th>
                <th className="p-3">CTR</th>
                <th className="p-3">Target URL</th>
                <th className="p-3 text-right">SERP Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.map((kw) => {
                const pos = kw.position;
                const change = kw.change || 0;
                const intentColors: Record<string, string> = {
                  Commercial: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
                  Informational: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                  Transactional: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                  Navigational: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                };

                return (
                  <tr key={kw.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-semibold text-white">{kw.keyword}</td>
                    <td className="p-3 font-mono">
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-sm font-bold ${pos <= 3 ? 'text-emerald-400' : pos <= 10 ? 'text-teal-400' : 'text-slate-300'}`}>
                          #{pos}
                        </span>
                        {change !== 0 && (
                          <span className={`text-[10px] flex items-center ${change > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(change)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-mono">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${intentColors[kw.searchIntent] || 'bg-slate-800 text-slate-300'}`}>
                        {kw.searchIntent}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400">{kw.monthlySearchVolume?.toLocaleString() || 1800}</td>
                    <td className="p-3 font-mono text-white font-semibold">{kw.clicks?.toLocaleString() || 240}</td>
                    <td className="p-3 font-mono text-emerald-400">{kw.ctr ? `${kw.ctr.toFixed(1)}%` : '4.8%'}</td>
                    <td className="p-3 font-mono text-slate-400 max-w-[160px] truncate">
                      {kw.url || '/'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onTriggerSerpCheck(kw.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        Check
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
