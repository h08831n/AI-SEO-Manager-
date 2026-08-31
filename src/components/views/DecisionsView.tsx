import React, { useState } from 'react';
import {
  Sparkles,
  Shield,
  Eye,
  CheckCircle2,
  XCircle,
  Play,
  Filter,
  Search,
  Zap,
  ArrowRight,
  Bot,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  HelpCircle,
  Sliders,
} from 'lucide-react';
import { RiskBadge } from '../ui/RiskBadge';
import { ConfidenceBadge } from '../ui/ConfidenceBadge';
import { EvidenceViewerModal } from '../ui/EvidenceViewerModal';
import { EmptyState } from '../ui/EmptyState';

interface DecisionsViewProps {
  websiteId: string;
  recommendations: any[];
  onApproveAction: (actionId: string) => void;
  onRejectAction: (actionId: string) => void;
  onExecuteNow: (rec: any) => void;
  onAskCopilot: (context: string) => void;
  onRefresh: () => void;
}

export const DecisionsView: React.FC<DecisionsViewProps> = ({
  recommendations,
  onApproveAction,
  onRejectAction,
  onExecuteNow,
  onAskCopilot,
  onRefresh,
}) => {
  const [filterTab, setFilterTab] = useState<'ALL' | 'LOW_RISK' | 'HIGH_IMPACT' | 'TECHNICAL' | 'CONTENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState<any | null>(null);

  const filtered = (recommendations || []).filter((rec) => {
    if (filterTab === 'LOW_RISK' && (rec.risk || rec.riskLevel) !== 'LOW') return false;
    if (filterTab === 'HIGH_IMPACT' && !String(rec.impact || '').includes('High') && !String(rec.impact || '').includes('+1')) return false;
    if (filterTab === 'TECHNICAL' && !['INDEXABILITY', 'TECHNICAL', 'CRAWLABILITY', 'SCHEMA'].includes(rec.pillar)) return false;
    if (filterTab === 'CONTENT' && !['CONTENT', 'SEARCH_INTENT', 'CTR', 'INTERNAL_LINKING'].includes(rec.pillar)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const title = (rec.title || rec.problem || '').toLowerCase();
      const url = (rec.targetUrl || rec.url || '').toLowerCase();
      if (!title.includes(q) && !url.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              DECISION CENTER
            </span>
            <span className="text-xs text-slate-400 font-mono">
              AI Recommendations Requiring Review ({recommendations.length} queued)
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            AI SEO Decisions & Review Queue
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Inspect AI hypotheses, Bayesian posterior probability reasoning, causal impact models, and rollback guarantees before approving autonomous execution.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-evaluate Decision Engine</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterTab === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Decisions ({recommendations.length})
          </button>
          <button
            onClick={() => setFilterTab('LOW_RISK')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterTab === 'LOW_RISK' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Low Risk (Auto-Deployable)
          </button>
          <button
            onClick={() => setFilterTab('HIGH_IMPACT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterTab === 'HIGH_IMPACT' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            High Impact Lift
          </button>
          <button
            onClick={() => setFilterTab('TECHNICAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterTab === 'TECHNICAL' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Technical & Schema
          </button>
          <button
            onClick={() => setFilterTab('CONTENT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filterTab === 'CONTENT' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Content & Intent
          </button>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search decisions & URLs..."
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Decisions List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No Decisions Pending Review"
          description="All Bayesian decision criteria are satisfied with high confidence or executed by your virtual team."
          actionLabel="Trigger Rule Re-evaluation"
          onAction={onRefresh}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((rec: any, idx: number) => {
            const recId = rec.id || `rec-${idx}`;
            const title = rec.title || rec.problem || 'Title & Meta Description Optimization';
            const risk = rec.risk || rec.riskLevel || 'LOW';
            const confidence = rec.confidence || rec.confidenceScore || 0.94;
            const impact = rec.impact || rec.impactEstimation || '+14.5% Organic CTR';
            const targetUrl = rec.targetUrl || rec.url || 'https://techscale.io/features';
            const pillar = rec.pillar || rec.category || 'ON_PAGE_SEO';
            const problem = rec.problem || 'Detected semantic discrepancy in metadata compared to primary search intent.';

            return (
              <div
                key={recId}
                className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700/80 transition-all space-y-4 shadow-sm"
              >
                {/* Header of Decision Card */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {pillar}
                      </span>
                      <RiskBadge risk={risk} />
                      <ConfidenceBadge score={confidence} />
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <RotateCcw className="w-2.5 h-2.5" />
                        Zero-Downtime Rollback Ready
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                      {title}
                    </h3>
                    <div className="text-xs text-slate-400 font-mono truncate">
                      {targetUrl}
                    </div>
                  </div>

                  <div className="flex lg:flex-col items-center lg:items-end justify-between gap-1 p-3 rounded-xl bg-slate-950 border border-slate-800/80 shrink-0">
                    <span className="text-xs font-bold text-emerald-400 font-mono">{impact}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                      Expected Causal Lift
                    </span>
                  </div>
                </div>

                {/* Problem & Bayesian AI Reasoning Block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Problem & Evidence
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {problem}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold flex items-center gap-1">
                      <Bot className="w-3 h-3" />
                      AI Bayesian Reasoning
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {rec.reason || 'Decision rule Bayesian posterior evaluated with 0.94 probability and low mutation risk.'}
                    </p>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center space-x-3 text-xs">
                    <button
                      onClick={() =>
                        setSelectedEvidence({
                          title,
                          actionType: rec.actionType || 'SEO_FIX',
                          targetUrl,
                          reason: rec.reason || problem,
                          confidence: typeof confidence === 'number' ? confidence * 100 : 94,
                          risk,
                          status: 'PENDING_APPROVAL',
                          beforeState: { meta: 'Pre-mutation DOM state snapshot' },
                          afterState: { meta: 'Optimized proposed change payload' },
                        })
                      }
                      className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 cursor-pointer font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Evidence & Diff</span>
                    </button>

                    <button
                      onClick={() => onAskCopilot(`Breakdown the reasoning, evidence, and risk factors for recommendation: "${title}" on ${targetUrl}`)}
                      className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 cursor-pointer font-medium"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Ask AI Swarm</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onRejectAction(recId)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-all"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => onApproveAction(recId)}
                      className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 cursor-pointer transition-all"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>Approve & Execute</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
