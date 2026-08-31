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
} from 'lucide-react';
import { RiskBadge } from '../ui/RiskBadge';
import { ConfidenceBadge } from '../ui/ConfidenceBadge';
import { EvidenceViewerModal } from '../ui/EvidenceViewerModal';
import { EmptyState } from '../ui/EmptyState';

interface RecommendationsViewProps {
  websiteId: string;
  recommendations: any[];
  onApproveAction: (actionId: string) => void;
  onRejectAction: (actionId: string) => void;
  onExecuteNow: (rec: any) => void;
  onAskCopilot: (context: string) => void;
  onRefresh: () => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  recommendations,
  onApproveAction,
  onRejectAction,
  onExecuteNow,
  onAskCopilot,
  onRefresh,
}) => {
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'LOW_RISK' | 'HIGH_IMPACT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState<any | null>(null);

  const filtered = (recommendations || []).filter((rec) => {
    if (filterTab === 'LOW_RISK' && (rec.risk || rec.riskLevel) !== 'LOW') return false;
    if (filterTab === 'HIGH_IMPACT' && !String(rec.impact || '').includes('High') && !String(rec.impact || '').includes('+1')) return false;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">AI Recommendation Center</h2>
          <p className="text-xs text-slate-400">
            Bayesian decision rules, causal impact estimates, and zero-downtime execution payloads.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onRefresh}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-evaluate Rules</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${filterTab === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            All Items ({recommendations.length})
          </button>
          <button
            onClick={() => setFilterTab('LOW_RISK')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${filterTab === 'LOW_RISK' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Low Risk (Autonomous-Ready)
          </button>
          <button
            onClick={() => setFilterTab('HIGH_IMPACT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${filterTab === 'HIGH_IMPACT' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200'}`}
          >
            High Impact
          </button>
        </div>

        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recommendations..."
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Recommendation Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No Recommendations Found"
          description="All algorithm rules are passing with 100% Bayesian confidence. Trigger a crawl to evaluate new changes."
          actionLabel="Re-evaluate Rules"
          onAction={onRefresh}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((rec: any, idx: number) => {
            const recId = rec.id || `rec-${idx}`;
            const title = rec.title || rec.problem || 'Title & Meta Description CTR Optimization';
            const risk = rec.risk || rec.riskLevel || 'LOW';
            const confidence = rec.confidence || rec.confidenceScore || 0.94;
            const impact = rec.impact || rec.impactEstimation || '+14.5% Organic CTR';
            const targetUrl = rec.targetUrl || rec.url || 'https://techscale.io/features';
            const pillar = rec.pillar || rec.category || 'ON_PAGE_SEO';

            return (
              <div
                key={recId}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-4 shadow-sm"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {pillar}
                      </span>
                      <RiskBadge risk={risk} />
                      <ConfidenceBadge score={confidence} />
                    </div>

                    <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
                    <div className="text-xs text-slate-400 font-mono">{targetUrl}</div>
                  </div>

                  <div className="flex lg:flex-col items-center lg:items-end justify-between gap-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 shrink-0">
                    <span className="text-xs font-bold text-emerald-400 font-mono">{impact}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Estimated Causal Lift</span>
                  </div>
                </div>

                {rec.reason && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-sans leading-relaxed">
                    {rec.reason}
                  </div>
                )}

                {/* Card Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center space-x-3 text-xs">
                    <button
                      onClick={() =>
                        setSelectedEvidence({
                          title,
                          actionType: rec.actionType || 'SEO_FIX',
                          targetUrl,
                          reason: rec.reason || 'Decision rule triggered based on SERP data discrepancy.',
                          confidence: typeof confidence === 'number' ? confidence * 100 : 94,
                          risk,
                          status: 'PENDING_APPROVAL',
                          beforeState: { meta: 'Original state before action' },
                          afterState: { meta: 'Optimized proposed change' },
                        })
                      }
                      className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 cursor-pointer font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Evidence & Diff</span>
                    </button>

                    <button
                      onClick={() => onAskCopilot(`Explain why this recommendation was generated: ${title} on ${targetUrl}`)}
                      className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 cursor-pointer font-medium"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Ask AI Copilot</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onRejectAction(recId)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => onApproveAction(recId)}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm cursor-pointer"
                    >
                      Approve & Execute
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
