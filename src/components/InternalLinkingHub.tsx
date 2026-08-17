import React, { useState } from 'react';
import { InternalLinkOpportunity } from '../types';
import {
  Link2,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  ShieldCheck,
  Search,
  Zap,
} from 'lucide-react';

interface InternalLinkingHubProps {
  opportunities: InternalLinkOpportunity[];
  onExecuteLink: (link: InternalLinkOpportunity) => void;
}

export const InternalLinkingHub: React.FC<InternalLinkingHubProps> = ({
  opportunities,
  onExecuteLink,
}) => {
  const [safetyFilter, setSafetyFilter] = useState<string>('ALL');

  const filteredLinks = opportunities.filter((link) => {
    return safetyFilter === 'ALL' || link.safetyLevel === safetyFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <Link2 className="h-4 w-4" />
            <span>TOPOLOGY GRAPH & CONTEXTUAL LINK INJECTION</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Internal Linking Intelligence & Automation
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Audit inlink/outlink distribution, rescue orphan URLs, and inject high-relevance anchor text into existing sentences with automated safety classification.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 font-medium">Link Opportunities</span>
          <div className="text-xl font-bold text-white mt-0.5">{opportunities.length} Flagged</div>
        </div>
        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-emerald-400 font-medium">Safe 1-Click Auto</span>
          <div className="text-xl font-bold text-emerald-400 mt-0.5">
            {opportunities.filter((o) => o.safetyLevel === 'SAFE_AUTOMATION').length}
          </div>
        </div>
        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-amber-400 font-medium">Review Recommended</span>
          <div className="text-xl font-bold text-amber-400 mt-0.5">
            {opportunities.filter((o) => o.safetyLevel === 'REVIEW_RECOMMENDED').length}
          </div>
        </div>
        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-sky-400 font-medium">Orphan URLs Rescued</span>
          <div className="text-xl font-bold text-sky-400 mt-0.5">1 Target</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setSafetyFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            safetyFilter === 'ALL'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Recommendations ({opportunities.length})
        </button>
        <button
          onClick={() => setSafetyFilter('SAFE_AUTOMATION')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            safetyFilter === 'SAFE_AUTOMATION'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Safe Automation Only
        </button>
        <button
          onClick={() => setSafetyFilter('REVIEW_RECOMMENDED')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            safetyFilter === 'REVIEW_RECOMMENDED'
              ? 'bg-slate-800 text-amber-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Manual Review Required
        </button>
      </div>

      {/* Link Recommendations Cards */}
      <div className="space-y-4">
        {filteredLinks.map((opp) => (
          <div
            key={opp.id}
            className="bg-slate-900 p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                    opp.safetyLevel === 'SAFE_AUTOMATION'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {opp.safetyLevel.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-400 font-mono">Semantic Relevance: {opp.relevanceScore}%</span>
              </div>

              {opp.applied ? (
                <span className="flex items-center space-x-1 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold self-start sm:self-auto">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Injected & Audited</span>
                </span>
              ) : (
                <button
                  onClick={() => onExecuteLink(opp)}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition-all self-start sm:self-auto"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>{opp.safetyLevel === 'SAFE_AUTOMATION' ? '1-Click Auto Inject' : 'Review & Inject Link'}</span>
                </button>
              )}
            </div>

            {/* Source and Target Routing Map */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-950 p-3.5 rounded-lg border border-slate-800/80">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono">Source Page (Host)</span>
                <p className="font-mono text-slate-200 mt-0.5 break-all">{opp.sourceUrl}</p>
              </div>
              <div>
                <span className="text-[10px] text-emerald-400 uppercase font-mono">Target Page (Recipient)</span>
                <p className="font-mono text-emerald-400 font-semibold mt-0.5 break-all">{opp.targetUrl}</p>
              </div>
            </div>

            {/* In-Context Sentence Injection Preview */}
            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
              <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">Context Sentence & Anchor Text</span>
              <p className="text-slate-300 leading-relaxed">
                "...To mitigate multi-region failover issues, teams should establish a{' '}
                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/30 underline decoration-emerald-500">
                  {opp.recommendedAnchorText}
                </span>{' '}
                before deploying mission-critical containers..."
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
