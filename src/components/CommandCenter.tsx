import React from 'react';
import { Website, DailySEOReport, SEOTask } from '../types';
import {
  TrendingUp,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Play,
  Layers,
  Search,
  Sparkles,
} from 'lucide-react';

interface CommandCenterProps {
  website: Website;
  dailyReport: DailySEOReport;
  tasks: SEOTask[];
  onExecuteTask: (task: SEOTask) => void;
  onNavigateTab: (tabId: string) => void;
  onOpenCopilot: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  website,
  dailyReport,
  tasks,
  onExecuteTask,
  onNavigateTab,
  onOpenCopilot,
}) => {
  const pendingSafeTasks = tasks.filter((t) => t.automationLevel === 'AUTOMATIC' || t.automationLevel === 'ONE_CLICK');
  const approvalTasks = tasks.filter((t) => t.automationLevel === 'MANUAL' || t.automationLevel === 'ASSISTED');

  return (
    <div className="space-y-6">
      {/* Morning Briefing Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
              <Clock className="h-3.5 w-3.5" />
              <span>MORNING SEO DISPATCH • {dailyReport.date} (AUTOMATED RUN #1,482)</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              SEO Command Center: <span className="text-emerald-400">{website.domain}</span>
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              The autonomous SEO engine audited 248 crawled URLs, synced Google Search Console & GA4 logs, evaluated SERP ranking distributions, and synthesized today's prioritized directives.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenCopilot}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span>Ask Senior SEO Copilot</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: WHAT HAPPENED? (Key Metrics & Momentum) */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">1. WHAT HAPPENED YESTERDAY?</h2>
          </div>
          <span className="text-xs text-slate-400">Comparing trailing 24h vs previous period baseline</span>
        </div>

        {/* 4 Core Velocity Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium">Organic Clicks</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-white">{dailyReport.clicks.toLocaleString()}</span>
              <span className="flex items-center text-xs font-semibold text-emerald-400">
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                +{dailyReport.trafficChangePct}%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Steady upward momentum across cloud pillars</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium">Average SERP Position</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-white">{dailyReport.avgPosition}</span>
              <span className="flex items-center text-xs font-semibold text-emerald-400">
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                +{dailyReport.avgPositionChange} pos
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Improved across 14 commercial keywords</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium">Search Impressions</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-white">{dailyReport.impressions.toLocaleString()}</span>
              <span className="flex items-center text-xs font-semibold text-emerald-400">
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                +11.2%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Expanded visibility on Page 2 queries</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium">Average CTR</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-bold text-white">{dailyReport.ctr}%</span>
              <span className="flex items-center text-xs font-semibold text-amber-400">
                <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
                {dailyReport.ctrChangePct}%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Underperforming on 8 high-impression SERPs</p>
          </div>
        </div>

        {/* Top Wins & Top Losses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 rounded-lg border border-emerald-950/60">
            <div className="flex items-center space-x-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Top SERP & Traffic Wins</h3>
            </div>
            <div className="space-y-2">
              {dailyReport.topWins.map((w, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/40 last:border-0">
                  <span className="text-slate-200 font-medium truncate max-w-[260px]">{w.queryOrUrl}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-semibold">
                    {w.change}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-rose-950/60">
            <div className="flex items-center space-x-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">Top Losses & Decay Signals</h3>
            </div>
            <div className="space-y-2">
              {dailyReport.topLosses.map((l, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/40 last:border-0">
                  <span className="text-slate-200 font-medium truncate max-w-[260px]">{l.queryOrUrl}</span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono font-semibold">
                    {l.change}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 & 3: WHAT IS WRONG? & WHAT CHANGED? */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* WHAT IS WRONG? */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              <h2 className="text-base font-bold text-white tracking-tight">2. WHAT IS WRONG?</h2>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono">
              {dailyReport.technicalIssuesCount + dailyReport.decayDetectedCount + dailyReport.cannibalizationCount} Issues Flagged
            </span>
          </div>
          <div className="space-y-3">
            <div
              onClick={() => onNavigateTab('crawler')}
              className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all flex items-start justify-between"
            >
              <div>
                <span className="text-xs font-bold text-rose-400 uppercase">Critical Technical Flaw</span>
                <p className="text-xs font-semibold text-slate-200 mt-0.5">Non-self canonical on /pricing/enterprise</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Canonical points to parent /pricing, suppressing indexation of high-ticket tier.</p>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Inspect Crawler &rarr;</span>
            </div>

            <div
              onClick={() => onNavigateTab('decay-refresh')}
              className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all flex items-start justify-between"
            >
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase">Severe Content Decay</span>
                <p className="text-xs font-semibold text-slate-200 mt-0.5">Cloud Security Compliance Guide (-71% clicks)</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Outdated 2024 compliance regulations displaced by competitor updates.</p>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Open Refresh &rarr;</span>
            </div>

            <div
              onClick={() => onNavigateTab('cannibalization')}
              className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all flex items-start justify-between"
            >
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase">Keyword Cannibalization</span>
                <p className="text-xs font-semibold text-slate-200 mt-0.5">"saas metric tracking" query split</p>
                <p className="text-[11px] text-slate-400 mt-0.5">/features/analytics (Pos 8.9) and /blog/saas-metrics-guide (Pos 14.2) oscillate rank.</p>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Resolve Clash &rarr;</span>
            </div>
          </div>
        </div>

        {/* WHAT CHANGED? */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Layers className="h-5 w-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white tracking-tight">3. WHAT CHANGED?</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Crawl Snapshot Diff</span>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-xs font-bold text-slate-300">Crawl Snapshot Delta vs 7 Days Ago</span>
              <div className="grid grid-cols-3 gap-2 mt-2 text-center text-xs">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-emerald-400 font-bold font-mono">+2 URLs</span>
                  <p className="text-[10px] text-slate-400">Discovered</p>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-emerald-400 font-bold font-mono">2 Resolved</span>
                  <p className="text-[10px] text-slate-400">Issues Closed</p>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-amber-400 font-bold font-mono">1 New 404</span>
                  <p className="text-[10px] text-slate-400">/docs/legacy-api-v1</p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-xs font-bold text-slate-300">SERP Volatility & Algorithmic Environment</span>
              <p className="text-xs text-slate-300 mt-1">
                Category volatility is <strong>Low (2.4/10)</strong>. No core algorithmic penalty detected. Fluctuations are isolated to legacy content decay and cannibalization clusters.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-300">A/B SEO Experiment #1 Concluded</span>
                <p className="text-[11px] text-slate-400">Pricing page title optimization delivered +23.1% clicks lift.</p>
              </div>
              <button
                onClick={() => onNavigateTab('experiments')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-xs font-semibold"
              >
                View Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: TODAY'S TOP 5 PRIORITIZED ACTIONS */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-tight">4. WHAT SHOULD WE DO FIRST? (TODAY'S PRIORITIES)</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Ranked by ICE Prioritization Engine</span>
        </div>

        <div className="space-y-3">
          {tasks.slice(0, 5).map((task, idx) => (
            <div
              key={task.id}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start space-x-3">
                <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0 mt-0.5">
                  #{idx + 1}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                        task.priority === 'CRITICAL'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : task.priority === 'HIGH'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                      }`}
                    >
                      {task.priority}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">ICE Score: {task.iceScore.toFixed(1)}</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400 font-mono">{task.category}</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1">{task.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{task.reason}</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">Evidence: {task.evidence}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                {task.status === 'COMPLETED' ? (
                  <span className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Executed & Logged</span>
                  </span>
                ) : (
                  <button
                    onClick={() => onExecuteTask(task)}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-all"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{task.automationLevel === 'AUTOMATIC' || task.automationLevel === 'ONE_CLICK' ? '1-Click Execute' : 'Review & Approve'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 5 & 6: AUTOMATION TIERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* WHAT CAN THE AI FIX SAFELY? */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-2 mb-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">5. WHAT CAN THE AI FIX SAFELY?</h2>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Pre-authorized automated actions with zero infrastructure risk and reversible rollback states.
          </p>

          <div className="space-y-2">
            {pendingSafeTasks.map((t) => (
              <div key={t.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200">{t.title}</span>
                  <p className="text-[10px] text-emerald-400 font-mono">1-Click Auto Deploy with Instant Rollback</p>
                </div>
                <button
                  onClick={() => onExecuteTask(t)}
                  disabled={t.status === 'COMPLETED'}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    t.status === 'COMPLETED'
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {t.status === 'COMPLETED' ? 'Done' : 'Execute'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* WHAT REQUIRES HUMAN APPROVAL? */}
        <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-tight">6. WHAT REQUIRES HUMAN APPROVAL?</h2>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            High-impact structural changes (canonicals, 301 redirects, content merges, production publishing).
          </p>

          <div className="space-y-2">
            {approvalTasks.map((t) => (
              <div key={t.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200">{t.title}</span>
                  <p className="text-[10px] text-amber-400 font-mono">Requires Explicit Senior Review</p>
                </div>
                <button
                  onClick={() => onExecuteTask(t)}
                  disabled={t.status === 'COMPLETED'}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    t.status === 'COMPLETED'
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {t.status === 'COMPLETED' ? 'Approved' : 'Review & Approve'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
