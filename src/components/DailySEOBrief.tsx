import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquareCode,
  Flame,
  Search,
} from 'lucide-react';
import { DailySEOBriefData, Website } from '../types';

interface DailySEOBriefProps {
  website: Website;
  briefData?: DailySEOBriefData;
  onApproveAction: (actionId: string) => void;
  onOpenCopilotWithContext: (context: string) => void;
  onNavigateToDecisions?: () => void;
  onNavigateToAgents?: () => void;
}

export const DailySEOBrief: React.FC<DailySEOBriefProps> = ({
  website,
  briefData,
  onApproveAction,
  onOpenCopilotWithContext,
  onNavigateToDecisions,
  onNavigateToAgents,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);

  // Generate sensible dynamic brief from current website context if briefData not explicitly passed
  const brief: DailySEOBriefData = briefData || {
    id: `brief-${website.id}`,
    generatedAt: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    websiteDomain: website.domain,
    headline: `Your Virtual SEO Team completed overnight audit for ${website.domain}`,
    summary: `Autonomous crawl analyzed 48 pages across 17 health pillars. Detected 3 canonical anomalies, resolved 2 high-impact CTR snippet optimizations, and verified a +14.8% ranking surge for high-intent commercial keywords.`,
    problemsDetectedCount: 3,
    actionsCompletedCount: 4,
    rankingChanges: {
      rising: 18,
      falling: 2,
      unchanged: 34,
    },
    trafficChanges: {
      clicks: 1420,
      clicksChangePct: 14.8,
      impressions: 48900,
      impressionsChangePct: 8.4,
      avgPosition: 6.4,
      avgPositionChange: -1.2, // lower is better
      ctr: 4.6,
    },
    newOpportunities: [
      {
        id: 'opp-1',
        title: 'Striking Distance: Rank #5 → Top 3 for "autonomous seo platform"',
        category: 'Growth & Rankings',
        potentialLift: '+650 monthly visits',
        confidence: 0.94,
        priority: 'CRITICAL',
        actionType: 'TITLE_CTR_OPTIMIZATION',
      },
      {
        id: 'opp-2',
        title: 'High-Intent Semantic Cluster Expansion for Enterprise Tier',
        category: 'Content Strategy',
        potentialLift: '+18% Topical Authority',
        confidence: 0.91,
        priority: 'HIGH',
        actionType: 'SCHEMA_INJECTION',
      },
    ],
    recommendedPriorities: [
      {
        id: 'rec-1',
        title: 'Inject Self-Referencing Canonical on Trailing Slash URLs',
        pillar: 'Technical SEO',
        impact: '+12% Search Visibility',
        confidence: 0.96,
        risk: 'LOW',
        targetUrl: `${website.productionUrl}/docs/cloud-api`,
        reason: 'Prevents indexation splitting between canonical and slash variants.',
      },
      {
        id: 'rec-2',
        title: 'Refine Meta Title & Action Hook for Pricing Page',
        pillar: 'Growth & CTR',
        impact: '+18.4% Organic CTR',
        confidence: 0.92,
        risk: 'LOW',
        targetUrl: `${website.productionUrl}/pricing`,
        reason: 'Bayesian posterior predicts high CTR boost with action verb phrasing.',
      },
    ],
  };

  const handleExecute = (id: string) => {
    setExecutingId(id);
    setTimeout(() => {
      onApproveAction(id);
      setExecutingId(null);
    }, 600);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 shadow-xl">
      {/* Decorative Accent Glow */}
      <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-bl from-emerald-500/10 via-indigo-500/5 to-transparent rounded-bl-full pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="p-5 sm:p-6 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                DAILY SEO BRIEF
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {brief.generatedAt}
              </span>
              <span className="text-xs text-emerald-400/90 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Swarm Audit Verified
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-1">
              {brief.headline}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              {brief.summary}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center">
          <button
            onClick={() => onOpenCopilotWithContext(`Explain the overnight SEO brief for ${website.domain} and breakdown top ranking drivers`)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-sm"
          >
            <MessageSquareCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ask Swarm AI</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 transition-all cursor-pointer"
            title={isExpanded ? 'Collapse Brief' : 'Expand Brief'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-5 sm:p-6 space-y-6 relative z-10">
          {/* Key Dynamics Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Problems & Actions */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
                <span>Overnight Audit</span>
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-white">{brief.actionsCompletedCount}</span>
                <span className="text-xs text-emerald-400 font-semibold">executed</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-2">
                <span>Issues Flagged</span>
                <span className="font-mono font-bold text-amber-400">{brief.problemsDetectedCount} priority</span>
              </div>
            </div>

            {/* Ranking Velocity */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
                <span>SERP Velocity (24h)</span>
                <TrendingUp className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-emerald-400">+{brief.rankingChanges.rising}</span>
                <span className="text-xs text-slate-400 font-medium">keywords up</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-2">
                <span>Dropping: <strong className="text-rose-400">{brief.rankingChanges.falling}</strong></span>
                <span>Unchanged: <strong className="text-slate-300">{brief.rankingChanges.unchanged}</strong></span>
              </div>
            </div>

            {/* Organic Traffic Changes */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
                <span>Organic Clicks (Est.)</span>
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-white">{brief.trafficChanges.clicks.toLocaleString()}</span>
                <span className="text-xs font-bold text-emerald-400">+{brief.trafficChanges.clicksChangePct}%</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-2">
                <span>Impressions</span>
                <span className="font-mono text-slate-300">+{brief.trafficChanges.impressionsChangePct}% lift</span>
              </div>
            </div>

            {/* Average Position & CTR */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
                <span>Avg SERP Position</span>
                <Search className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-black text-white">#{brief.trafficChanges.avgPosition}</span>
                <span className="text-xs font-bold text-emerald-400">
                  {brief.trafficChanges.avgPositionChange < 0 ? `▲ ${Math.abs(brief.trafficChanges.avgPositionChange)} pos` : 'Steady'}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-2">
                <span>Average CTR</span>
                <span className="font-mono text-emerald-400 font-bold">{brief.trafficChanges.ctr}%</span>
              </div>
            </div>
          </div>

          {/* Recommended Priorities & Fast Action Block */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Column 1: Priority AI Recommendations to Execute */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    High-Confidence Recommendations
                  </h3>
                </div>
                {onNavigateToDecisions && (
                  <button
                    onClick={onNavigateToDecisions}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>All Decisions</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {brief.recommendedPriorities.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                          {rec.pillar}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">
                          {Math.round(rec.confidence * 100)}% Confidence
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-slate-100 truncate">
                        {rec.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-1">
                        {rec.reason}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleExecute(rec.id)}
                        disabled={executingId === rec.id}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Zap className="w-3 h-3 fill-current" />
                        <span>{executingId === rec.id ? 'Deploying...' : '1-Click Fix'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: New Opportunities Detected */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    High-Impact Growth Vectors
                  </h3>
                </div>
                {onNavigateToAgents && (
                  <button
                    onClick={onNavigateToAgents}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>View Swarm</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {brief.newOpportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                          {opp.category}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-amber-400">
                          Est. Lift: {opp.potentialLift}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-slate-100 truncate">
                        {opp.title}
                      </h4>
                    </div>

                    <button
                      onClick={() => onOpenCopilotWithContext(`Guide me on how to execute opportunity: "${opp.title}" with expected impact ${opp.potentialLift}`)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer shrink-0"
                    >
                      Inspect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
