import React, { useState } from 'react';
import { Website } from '../types';
import {
  BarChart3,
  Search,
  Globe,
  Smartphone,
  Monitor,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Filter,
  Download,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface SearchConsoleAnalyticsProps {
  website: Website;
}

export const SearchConsoleAnalytics: React.FC<SearchConsoleAnalyticsProps> = ({ website }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '28d' | '3m' | '6m' | '12m'>('28d');
  const [activeDimension, setActiveDimension] = useState<'QUERIES' | 'PAGES' | 'CONVERSIONS' | 'COUNTRIES' | 'DEVICES'>('QUERIES');
  const [tableSearch, setTableSearch] = useState('');

  // 28-day sample GSC trend data
  const trendData = [
    { date: 'Jul 21', clicks: 1420, impressions: 38200, ctr: 3.71, position: 15.2, conversions: 12 },
    { date: 'Jul 25', clicks: 1510, impressions: 39500, ctr: 3.82, position: 14.9, conversions: 14 },
    { date: 'Jul 29', clicks: 1480, impressions: 40100, ctr: 3.69, position: 14.8, conversions: 11 },
    { date: 'Aug 02', clicks: 1590, impressions: 41200, ctr: 3.85, position: 14.6, conversions: 16 },
    { date: 'Aug 06', clicks: 1620, impressions: 42000, ctr: 3.85, position: 14.4, conversions: 15 },
    { date: 'Aug 10', clicks: 1580, impressions: 41800, ctr: 3.77, position: 14.5, conversions: 13 },
    { date: 'Aug 14', clicks: 1690, impressions: 43500, ctr: 3.88, position: 14.1, conversions: 19 },
    { date: 'Aug 17', clicks: 1740, impressions: 44200, ctr: 3.93, position: 14.0, conversions: 21 },
  ];

  const queriesData = [
    { query: 'b2b enterprise workflow automation', clicks: 1480, impressions: 34200, ctr: 4.32, position: 6.2, conv: 24, rev: '$4,800' },
    { query: 'cloud infrastructure cost optimization', clicks: 3650, impressions: 48900, ctr: 7.46, position: 4.1, conv: 58, rev: '$11,600' },
    { query: 'kubernetes cluster monitoring tools', clicks: 840, impressions: 19800, ctr: 4.24, position: 12.4, conv: 9, rev: '$1,800' },
    { query: 'saas metric tracking', clicks: 620, impressions: 12400, ctr: 5.0, position: 8.9, conv: 14, rev: '$2,800' },
    { query: 'multi cloud disaster recovery architecture', clicks: 1890, impressions: 11200, ctr: 16.87, position: 2.4, conv: 32, rev: '$6,400' },
    { query: 'opentelemetry distributed tracing best practices', clicks: 495, impressions: 14600, ctr: 3.39, position: 13.8, conv: 4, rev: '$800' },
    { query: 'techscale cloud pricing', clicks: 2420, impressions: 3150, ctr: 76.8, position: 1.1, conv: 92, rev: '$18,400' },
  ];

  const pagesData = [
    { page: '/', clicks: 14200, impressions: 120000, ctr: 11.83, position: 3.2, conv: 180, rev: '$36,000', commercialTier: 'HIGH_COMMERCIAL' },
    { page: '/pricing', clicks: 8900, impressions: 38000, ctr: 23.42, position: 2.1, conv: 142, rev: '$28,400', commercialTier: 'HIGH_COMMERCIAL' },
    { page: '/platform/workflow-engine', clicks: 3420, impressions: 34200, ctr: 10.0, position: 6.2, conv: 44, rev: '$8,800', commercialTier: 'HIGH_COMMERCIAL' },
    { page: '/guides/multi-cloud-dr', clicks: 2890, impressions: 18400, ctr: 15.7, position: 2.4, conv: 22, rev: '$4,400', commercialTier: 'MEDIUM_COMMERCIAL' },
    { page: '/blog/saas-metrics-guide', clicks: 1840, impressions: 22000, ctr: 8.36, position: 8.9, conv: 6, rev: '$1,200', commercialTier: 'TRAFFIC_ONLY' },
    { page: '/guides/cloud-security-compliance', clicks: 820, impressions: 14200, ctr: 5.77, position: 18.2, conv: 2, rev: '$400', commercialTier: 'DECAYING' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <BarChart3 className="h-4 w-4" />
            <span>GOOGLE SEARCH CONSOLE & GA4 UNIFIED ENGINE</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Search Performance & Conversion Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Correlate organic search impressions and SERP CTR directly with GA4 leads, pipeline conversions, and qualified business revenue.
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(['7d', '28d', '3m', '6m', '12m'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1 rounded text-xs font-semibold uppercase transition-all ${
                selectedPeriod === period
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Core Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Total Clicks</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-white">48,200</span>
            <span className="text-xs font-semibold text-emerald-400">+8.4%</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Trailing 28 days organic</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Total Impressions</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-white">1,240,000</span>
            <span className="text-xs font-semibold text-emerald-400">+11.2%</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Expanded category reach</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Average CTR</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-white">3.89%</span>
            <span className="text-xs font-semibold text-amber-400">-0.2%</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Page 2 additions diluted average</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Organic Revenue Pipeline</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-emerald-400">$92,400</span>
            <span className="text-xs font-semibold text-emerald-400">+14.2%</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">412 qualified demo conversions</p>
        </div>
      </div>

      {/* Chart: Historical Performance Curve */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white tracking-tight">Organic Search Trendline (Trailing {selectedPeriod})</h2>
          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="flex items-center space-x-1 text-emerald-400">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Clicks</span>
            </div>
            <div className="flex items-center space-x-1 text-sky-400">
              <div className="h-2 w-2 rounded-full bg-sky-400" />
              <span>Impressions (/10)</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Dimension Selector Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveDimension('QUERIES')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeDimension === 'QUERIES'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Top Queries ({queriesData.length})
        </button>
        <button
          onClick={() => setActiveDimension('PAGES')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeDimension === 'PAGES'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Landing Pages & Commercial ROI ({pagesData.length})
        </button>
      </div>

      {/* Dimension Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        {activeDimension === 'QUERIES' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="py-2.5 px-4">Search Query</th>
                  <th className="py-2.5 px-4 text-right">Clicks</th>
                  <th className="py-2.5 px-4 text-right">Impressions</th>
                  <th className="py-2.5 px-4 text-right">CTR</th>
                  <th className="py-2.5 px-4 text-right">Position</th>
                  <th className="py-2.5 px-4 text-right">Leads</th>
                  <th className="py-2.5 px-4 text-right">Attributed Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {queriesData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-850 transition-colors">
                    <td className="py-3 px-4 font-medium text-emerald-400">{row.query}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">{row.clicks.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">{row.impressions.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">{row.ctr}%</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">{row.position}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sky-400">{row.conv}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">{row.rev}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeDimension === 'PAGES' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="py-2.5 px-4">Landing Page Path</th>
                  <th className="py-2.5 px-4">Commercial Tier</th>
                  <th className="py-2.5 px-4 text-right">Clicks</th>
                  <th className="py-2.5 px-4 text-right">Impressions</th>
                  <th className="py-2.5 px-4 text-right">CTR</th>
                  <th className="py-2.5 px-4 text-right">Position</th>
                  <th className="py-2.5 px-4 text-right">Pipeline Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {pagesData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-850 transition-colors">
                    <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">{row.page}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          row.commercialTier === 'HIGH_COMMERCIAL'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : row.commercialTier === 'MEDIUM_COMMERCIAL'
                            ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                            : row.commercialTier === 'TRAFFIC_ONLY'
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {row.commercialTier}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">{row.clicks.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">{row.impressions.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono">{row.ctr}%</td>
                    <td className="py-3 px-4 text-right font-mono">{row.position}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">{row.rev}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
