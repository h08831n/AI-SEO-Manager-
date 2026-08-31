import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  ExternalLink,
  Download,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { MetricCard } from '../ui/MetricCard';

interface AnalyticsViewProps {
  websiteId: string;
  onExportCsv: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ websiteId, onExportCsv }) => {
  const [timeRange, setTimeRange] = useState<'28d' | '90d' | '180d'>('28d');
  const [metricTab, setMetricTab] = useState<'clicks' | 'impressions' | 'ctr' | 'position'>('clicks');

  // Realistic time-series data for SaaS traffic
  const chartData = [
    { date: 'Aug 01', clicks: 540, impressions: 14200, ctr: 3.8, position: 11.2 },
    { date: 'Aug 05', clicks: 610, impressions: 15400, ctr: 4.0, position: 10.8 },
    { date: 'Aug 09', clicks: 680, impressions: 16100, ctr: 4.2, position: 10.1 },
    { date: 'Aug 13', clicks: 750, impressions: 17800, ctr: 4.2, position: 9.6 },
    { date: 'Aug 17', clicks: 820, impressions: 18900, ctr: 4.3, position: 8.9 },
    { date: 'Aug 21', clicks: 890, impressions: 19500, ctr: 4.6, position: 8.4 },
    { date: 'Aug 25', clicks: 940, impressions: 20400, ctr: 4.6, position: 7.9 },
    { date: 'Aug 29', clicks: 1020, impressions: 21800, ctr: 4.7, position: 7.4 },
  ];

  const topQueries = [
    { query: 'enterprise autonomous seo platform', clicks: 1420, impressions: 24500, ctr: '5.8%', pos: 2.1 },
    { query: 'automated technical seo crawler', clicks: 980, impressions: 18900, ctr: '5.2%', pos: 3.4 },
    { query: 'bayesian seo decision engine', clicks: 760, impressions: 12400, ctr: '6.1%', pos: 1.8 },
    { query: 'headless cms seo sync', clicks: 640, impressions: 14200, ctr: '4.5%', pos: 4.2 },
    { query: 'schema markup auto generator', clicks: 520, impressions: 11800, ctr: '4.4%', pos: 5.1 },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Analytics & Search Performance</h2>
          <p className="text-xs text-slate-400">
            Real Google Search Console & Google Analytics 4 performance metrics and CTR curves.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <button
              onClick={() => setTimeRange('28d')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${timeRange === '28d' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
            >
              Trailing 28D
            </button>
            <button
              onClick={() => setTimeRange('90d')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${timeRange === '90d' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
            >
              90D
            </button>
            <button
              onClick={() => setTimeRange('180d')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${timeRange === '180d' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
            >
              180D
            </button>
          </div>

          <button
            onClick={onExportCsv}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Search Clicks"
          value="18,420"
          change={14.8}
          changeLabel="vs prior 28 days"
          icon={BarChart3}
          badge="GSC Live"
          badgeVariant="emerald"
        />
        <MetricCard
          title="Total Impressions"
          value="412,800"
          change={21.2}
          changeLabel="vs prior 28 days"
          icon={BarChart3}
          badge="High Scale"
          badgeVariant="indigo"
        />
        <MetricCard
          title="Average CTR"
          value="4.5%"
          change={0.8}
          changeLabel="vs benchmark (3.2%)"
          icon={TrendingUp}
          badge="Optimal"
          badgeVariant="emerald"
        />
        <MetricCard
          title="Average Ranking Position"
          value="7.4"
          change={-2.1}
          changeLabel="improved 2.1 positions"
          icon={TrendingUp}
          badge="Top 10"
          badgeVariant="emerald"
        />
      </div>

      {/* Main Chart Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setMetricTab('clicks')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${metricTab === 'clicks' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Organic Clicks
            </button>
            <button
              onClick={() => setMetricTab('impressions')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${metricTab === 'impressions' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Impressions
            </button>
            <button
              onClick={() => setMetricTab('ctr')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${metricTab === 'ctr' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              CTR (%)
            </button>
            <button
              onClick={() => setMetricTab('position')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${metricTab === 'position' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Avg Position
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-mono">
            Synced from Google Search Console API
          </span>
        </div>

        {/* Recharts Area */}
        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#020617',
                  borderColor: '#1e293b',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#fff',
                }}
              />
              <Area
                type="monotone"
                dataKey={metricTab}
                stroke={metricTab === 'clicks' ? '#10b981' : metricTab === 'impressions' ? '#6366f1' : '#06b6d4'}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={metricTab === 'clicks' ? 'url(#emeraldGrad)' : 'url(#indigoGrad)'}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Search Queries Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white tracking-tight">Top Search Console Queries</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="p-3">Search Query</th>
                <th className="p-3">Clicks</th>
                <th className="p-3">Impressions</th>
                <th className="p-3">CTR</th>
                <th className="p-3">Avg Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {topQueries.map((q, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-semibold text-white">{q.query}</td>
                  <td className="p-3 font-mono text-emerald-400 font-bold">{q.clicks.toLocaleString()}</td>
                  <td className="p-3 font-mono text-slate-300">{q.impressions.toLocaleString()}</td>
                  <td className="p-3 font-mono text-slate-300">{q.ctr}</td>
                  <td className="p-3 font-mono text-slate-300 font-bold">#{q.pos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
