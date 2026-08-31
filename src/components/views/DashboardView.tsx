import React, { useState } from 'react';
import {
  Activity,
  Sparkles,
  TrendingUp,
  Globe,
  CheckCircle2,
  Shield,
  Zap,
  ArrowRight,
  Eye,
  RotateCcw,
  Play,
  Clock,
  Layers,
  FileCheck,
  AlertTriangle,
  Cpu,
  Bot,
  Sliders,
} from 'lucide-react';
import { MetricCard } from '../ui/MetricCard';
import { SEOScore } from '../ui/SEOScore';
import { RiskBadge } from '../ui/RiskBadge';
import { ConfidenceBadge } from '../ui/ConfidenceBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { EvidenceViewerModal } from '../ui/EvidenceViewerModal';
import { DailySEOBrief } from '../DailySEOBrief';
import { AgentSwarmPulse } from '../AgentSwarmPulse';
import { Website, SEOHealthState, RankedKeyword, SEOAgent, AutonomyMode } from '../../types';
import { SaaSTabId } from '../layout/Sidebar';

interface DashboardViewProps {
  website: Website;
  healthState: SEOHealthState;
  keywords: RankedKeyword[];
  recommendations: any[];
  actions: any[];
  agents?: SEOAgent[];
  autonomyMode?: AutonomyMode;
  onSetAutonomyMode?: (mode: AutonomyMode) => void;
  onNavigateTab: (tab: SaaSTabId) => void;
  onApproveAction: (actionId: string) => void;
  onRejectAction: (actionId: string) => void;
  onRollbackAction: (actionId: string) => void;
  onRunDailyLoop: () => void;
  isLoopRunning: boolean;
  onOpenCopilotWithContext: (context: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  website,
  healthState,
  keywords,
  recommendations,
  actions,
  agents = [
    {
      id: 'agent-1',
      role: 'TECHNICAL_AGENT',
      name: 'Technical SEO Agent',
      title: 'HTML, Canonical & Web Vitals Specialist',
      avatarColor: 'bg-emerald-600',
      description: 'Continuously validates canonical tags, XML sitemaps, indexability, 301 redirect chains, and Core Web Vitals.',
      status: 'ANALYZING',
      currentTask: 'Inspecting trailing-slash canonical consistency on /pricing',
      issuesSolvedCount: 42,
      actionsExecutedCount: 38,
      successRate: 98.6,
      learningProgress: 95.4,
      activePillars: ['Indexability', 'Crawlability', 'Technical', 'Core Web Vitals'],
      lastActivityTimestamp: '2 mins ago',
      recentLogs: [
        'DOM inspection completed for 48 URLs',
        'VERIFIED: Self-referencing canonical active on /docs/cloud-api',
        'Crawl budget efficiency: 99.4%',
      ],
    },
    {
      id: 'agent-2',
      role: 'CONTENT_STRATEGY_AGENT',
      name: 'Content Strategy Agent',
      title: 'Decay, Clustering & Semantic Authority Specialist',
      avatarColor: 'bg-indigo-600',
      description: 'Monitors content decay velocity, detects keyword cannibalization, and identifies high-intent topic cluster gaps.',
      status: 'MONITORING',
      currentTask: 'Calculating topical authority vector for "autonomous seo"',
      issuesSolvedCount: 29,
      actionsExecutedCount: 24,
      successRate: 96.2,
      learningProgress: 92.1,
      activePillars: ['Content Quality', 'Search Intent', 'Semantic Coverage', 'Freshness'],
      lastActivityTimestamp: '4 mins ago',
      recentLogs: [
        'Content decay scan completed across 12 evergreen posts',
        'High-intent semantic gap identified in Enterprise comparison tier',
      ],
    },
    {
      id: 'agent-3',
      role: 'GROWTH_AGENT',
      name: 'Growth & SERP Agent',
      title: 'Rank Velocity & CTR Optimization Specialist',
      avatarColor: 'bg-cyan-600',
      description: 'Identifies striking-distance keywords (pos 4-15), tests high-CTR meta titles, and captures Featured Snippets.',
      status: 'EXECUTING',
      currentTask: 'Deploying high-intent meta title hook on /pricing',
      issuesSolvedCount: 37,
      actionsExecutedCount: 35,
      successRate: 97.4,
      learningProgress: 94.8,
      activePillars: ['CTR', 'Ranking Health', 'Conversion', 'UX'],
      lastActivityTimestamp: 'Just now',
      recentLogs: [
        'SERP difference-in-differences test verified +18.4% CTR lift',
        'Striking distance keyword "autonomous seo platform" promoted to Pos #3',
      ],
    },
    {
      id: 'agent-4',
      role: 'COMPETITOR_AGENT',
      name: 'Competitor Intelligence Agent',
      title: 'SERP Overlap & Gap Interception Specialist',
      avatarColor: 'bg-rose-600',
      description: 'Monitors competitor keyword surges, backlink velocity, content gaps, and algorithmic market-share shifts.',
      status: 'ANALYZING',
      currentTask: 'Analyzing SERP overlap gap against ahrefs.com',
      issuesSolvedCount: 19,
      actionsExecutedCount: 16,
      successRate: 95.0,
      learningProgress: 91.0,
      activePillars: ['External Authority', 'Competitive Gaps', 'Market Share'],
      lastActivityTimestamp: '8 mins ago',
      recentLogs: [
        'Discovered 4 new high-volume commercial keywords with low difficulty',
        'Outranking vulnerability detected on competitor core landing page',
      ],
    },
    {
      id: 'agent-5',
      role: 'AUDITOR_AGENT',
      name: 'SEO Auditor Agent',
      title: '17-Pillar Health Score & Compliance Specialist',
      avatarColor: 'bg-amber-600',
      description: 'Aggregates 17 health pillars into Bayesian diagnostic score, detects Google Core Update turbulence, and audits EEAT.',
      status: 'LEARNING',
      currentTask: 'Recalibrating Bayesian posterior weights across 17 pillars',
      issuesSolvedCount: 64,
      actionsExecutedCount: 61,
      successRate: 99.1,
      learningProgress: 97.8,
      activePillars: ['17 Health Pillars', 'EEAT', 'Compliance'],
      lastActivityTimestamp: '1 min ago',
      recentLogs: [
        'Overall 17-pillar health score evaluated: 88/100 (+6pts)',
        'Zero critical compliance regressions detected',
      ],
    },
    {
      id: 'agent-6',
      role: 'AUTOMATION_MANAGER',
      name: 'Automation Manager',
      title: '6-Stage Verification & Safety Gate Governor',
      avatarColor: 'bg-teal-600',
      description: 'Governs multi-stage verification pipelines, canary rollouts, rate limits, zero-downtime rollbacks, and circuit breakers.',
      status: 'MONITORING',
      currentTask: 'Tracking Stage 3 Traffic DiD verification window',
      issuesSolvedCount: 51,
      actionsExecutedCount: 51,
      successRate: 100.0,
      learningProgress: 98.9,
      activePillars: ['Execution Pipeline', 'Canary Rollout', 'Rollback Journal'],
      lastActivityTimestamp: 'Just now',
      recentLogs: [
        'Zero-downtime rollback journal snapshot captured for act-103',
        'Circuit breakers armed and nominal. 0 anomalies detected.',
      ],
    },
  ],
  autonomyMode = 'SUPERVISED',
  onSetAutonomyMode,
  onNavigateTab,
  onApproveAction,
  onRejectAction,
  onRollbackAction,
  onRunDailyLoop,
  isLoopRunning,
  onOpenCopilotWithContext,
}) => {
  const [selectedEvidence, setSelectedEvidence] = useState<any | null>(null);

  // Compute summary stats from real data
  const top10Keywords = keywords.filter((k) => k.position <= 10).length;
  const totalClicks = keywords.reduce((sum, k) => sum + (k.clicks || 0), 0);
  const totalImpressions = keywords.reduce((sum, k) => sum + (k.impressions || 0), 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '4.6';

  const pendingRecs = recommendations.slice(0, 4);
  const recentActions = actions.slice(0, 5);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner: SEO Health & Autonomous Swarm Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-sm">
        <div className="flex items-center space-x-4">
          <SEOScore
            score={healthState.overallScore || 88}
            previousScore={healthState.previousScore || 82}
            size="lg"
          />
          <div className="hidden sm:block h-10 w-[1px] bg-slate-800" />
          <div className="hidden sm:block space-y-1">
            <div className="text-xs text-slate-400 font-medium">Virtual SEO Department Status</div>
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono font-semibold text-emerald-400">
                6 Agents Active • Continuous Swarm Loop
              </span>
            </div>
          </div>
        </div>

        {/* Autonomy Selector & Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-500 uppercase px-2">Autonomy:</span>
            {(['MANUAL', 'SUPERVISED', 'AUTONOMOUS'] as AutonomyMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onSetAutonomyMode?.(mode)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                  autonomyMode === mode
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'MANUAL' ? 'Manual' : mode === 'SUPERVISED' ? 'Supervised' : 'Autonomous'}
              </button>
            ))}
          </div>

          <button
            onClick={() => onOpenCopilotWithContext('Diagnose overall website health score, agent actions, and top 3 priority opportunities')}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Executive Brief</span>
          </button>

          <button
            onClick={onRunDailyLoop}
            disabled={isLoopRunning}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isLoopRunning ? 'Swarm Running...' : 'Run Swarm Audit'}</span>
          </button>
        </div>
      </div>

      {/* 1. Daily SEO Brief Component */}
      <DailySEOBrief
        website={website}
        onApproveAction={onApproveAction}
        onOpenCopilotWithContext={onOpenCopilotWithContext}
        onNavigateToDecisions={() => onNavigateTab('decisions')}
        onNavigateToAgents={() => onNavigateTab('agents')}
      />

      {/* 2. Virtual SEO Department Swarm Pulse Component */}
      <AgentSwarmPulse
        agents={agents}
        onSelectAgent={() => onNavigateTab('agents')}
        onNavigateToAgents={() => onNavigateTab('agents')}
      />

      {/* 3. Core Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Top 10 Rankings"
          value={top10Keywords || 24}
          change={6}
          changeLabel="vs last week"
          trend="up"
          icon={TrendingUp}
          subtitle="High-Intent Commercial"
        />
        <MetricCard
          title="Organic Traffic (Est.)"
          value={totalClicks ? totalClicks.toLocaleString() : '14,820'}
          change={14.8}
          changeLabel="vs last 28 days"
          trend="up"
          icon={Activity}
          subtitle="Last 28 Days"
        />
        <MetricCard
          title="Search Impressions"
          value={totalImpressions ? totalImpressions.toLocaleString() : '324,500'}
          change={8.4}
          changeLabel="vs last period"
          trend="up"
          icon={Globe}
          subtitle="Google SERP Universe"
        />
        <MetricCard
          title="Organic Click-Through Rate"
          value={`${avgCtr}%`}
          change={1.2}
          changeLabel="vs last period"
          trend="up"
          icon={Zap}
          subtitle="SERP Snippet Performance"
        />
      </div>

      {/* 4. Two-Column Layout: Priority Decisions & Recent Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Decisions Requiring Review */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Decisions Requiring Review
              </h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {pendingRecs.length} Queued
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('decisions')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {pendingRecs.map((rec: any, idx: number) => {
              const recId = rec.id || `rec-${idx}`;
              const title = rec.title || rec.problem || 'Title & Meta Description Optimization';
              const risk = rec.risk || 'LOW';
              const confidence = rec.confidence || 0.94;
              const impact = rec.impact || '+14.5% Organic CTR';
              const targetUrl = rec.targetUrl || rec.url || 'https://techscale.io/features';
              const pillar = rec.pillar || 'ON_PAGE';

              return (
                <div
                  key={recId}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {pillar}
                        </span>
                        <RiskBadge risk={risk} />
                        <ConfidenceBadge score={confidence} />
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 truncate">{title}</h4>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{targetUrl}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-emerald-400 font-mono">{impact}</span>
                      <div className="text-[9px] text-slate-500 uppercase font-mono">Est. Lift</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                    <button
                      onClick={() =>
                        setSelectedEvidence({
                          title,
                          actionType: rec.actionType || 'SEO_FIX',
                          targetUrl,
                          reason: rec.reason || 'Bayesian rule triggered with high posterior confidence.',
                          confidence: typeof confidence === 'number' ? confidence * 100 : 94,
                          risk,
                          status: 'PENDING_APPROVAL',
                          beforeState: { meta: 'Pre-mutation DOM baseline snapshot' },
                          afterState: { meta: 'Optimized proposed change payload' },
                        })
                      }
                      className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 cursor-pointer font-medium"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Inspect Diff</span>
                    </button>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => onRejectAction(recId)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => onApproveAction(recId)}
                        className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm cursor-pointer"
                      >
                        <Zap className="w-3 h-3 fill-current" />
                        <span>Approve</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Executed Actions & Multi-Stage Verification Timeline */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Autonomous Action Timeline
              </h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                1-Click Rollback Enabled
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('actions')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <span>View History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {recentActions.map((act: any) => {
              const actionId = act.id || `act-${Math.random()}`;
              const actionType = act.actionType || 'SEO_OPTIMIZATION';
              const status = act.status || 'VERIFIED';
              const targetUrl = act.targetUrl || 'https://techscale.io/pricing';
              const correlationId = act.correlationId || 'corr-849201';

              return (
                <div
                  key={actionId}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <StatusBadge status={status} />
                        <span className="text-[10px] font-mono text-slate-500">{correlationId}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 truncate">{actionType}</h4>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{targetUrl}</p>
                    </div>

                    <button
                      onClick={() => onRollbackAction(actionId)}
                      disabled={status === 'REVERTED'}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold disabled:opacity-40 cursor-pointer shrink-0 transition-all"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{status === 'REVERTED' ? 'Reverted' : 'Rollback'}</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 font-sans line-clamp-1 border-t border-slate-800/60 pt-2">
                    {act.reason || 'Verified via Stage 1 DOM check & Stage 2 Google Search Console indexing.'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Evidence Viewer Modal */}
      {selectedEvidence && (
        <EvidenceViewerModal
          isOpen={true}
          onClose={() => setSelectedEvidence(null)}
          {...selectedEvidence}
        />
      )}
    </div>
  );
};
