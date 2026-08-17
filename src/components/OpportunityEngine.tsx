import React, { useState } from 'react';
import { KeywordOpportunity } from '../types';
import {
  Zap,
  Search,
  ArrowRight,
  TrendingUp,
  Target,
  Sparkles,
  Play,
  CheckCircle2,
} from 'lucide-react';

interface OpportunityEngineProps {
  opportunities: KeywordOpportunity[];
  onOptimizeKeyword: (opp: KeywordOpportunity) => void;
  onGenerateBrief: (opp: KeywordOpportunity) => void;
}

export const OpportunityEngine: React.FC<OpportunityEngineProps> = ({
  opportunities,
  onOptimizeKeyword,
  onGenerateBrief,
}) => {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesSearch = opp.keyword.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          opp.url.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesType = typeFilter === 'ALL' || opp.opportunityType === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalPotentialGain = opportunities.reduce((acc, o) => acc + o.potentialMonthlyClicks, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <Zap className="h-4 w-4" />
            <span>ALGORITHMIC OPPORTUNITY DISCOVERY & STRIKING DISTANCE</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Keyword Opportunity Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Detect high-impact low-hanging opportunities: Page 2 striking distance queries (positions 11-20), high impression / low CTR queries (positions 4-10), and rising search queries.
          </p>
        </div>

        {/* Aggregate Potential Gain */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shrink-0 text-center sm:text-left">
          <span className="text-[11px] text-slate-400 uppercase font-mono">Estimated Monthly Click Uplift</span>
          <div className="flex items-baseline space-x-1.5 mt-0.5">
            <span className="text-3xl font-black text-emerald-400">+{totalPotentialGain.toLocaleString()}</span>
            <span className="text-xs text-slate-400">clicks / mo</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Across {opportunities.length} high-confidence opportunities</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search opportunity keywords or URLs..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label="Filter by Opportunity Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Opportunity Types</option>
            <option value="HIGH_IMP_LOW_CTR">High Impressions / Low CTR (Pos 4-10)</option>
            <option value="STRIKING_DISTANCE_PAGE_2">Page 2 Striking Distance (Pos 11-20)</option>
            <option value="UNOPTIMIZED_RELEVANCE">Unoptimized Relevance</option>
          </select>
        </div>
      </div>

      {/* Opportunity Cards List */}
      <div className="space-y-4">
        {filteredOpportunities.map((opp) => (
          <div
            key={opp.id}
            className="bg-slate-900 p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase ${
                    opp.priority === 'CRITICAL'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : opp.priority === 'HIGH'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}
                >
                  {opp.priority} Priority
                </span>

                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {opp.opportunityType.replace(/_/g, ' ')}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{opp.keyword}</h3>
                <p className="text-xs text-emerald-400 font-mono mt-0.5">{opp.url}</p>
              </div>

              <p className="text-xs text-slate-300">{opp.recommendedAction}</p>
              <p className="text-[11px] text-slate-400 font-mono">Evidence: {opp.evidence}</p>
            </div>

            {/* Metrics Breakdown */}
            <div className="flex flex-wrap items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800/80 shrink-0">
              <div className="text-center min-w-[70px]">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Current Pos</span>
                <p className="text-base font-bold text-white font-mono mt-0.5">#{opp.currentPosition}</p>
              </div>
              <div className="h-8 w-[1px] bg-slate-800" />
              <div className="text-center min-w-[70px]">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Impressions</span>
                <p className="text-base font-bold text-slate-300 font-mono mt-0.5">{opp.impressions.toLocaleString()}</p>
              </div>
              <div className="h-8 w-[1px] bg-slate-800" />
              <div className="text-center min-w-[70px]">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Actual CTR</span>
                <p className="text-base font-bold text-amber-400 font-mono mt-0.5">{opp.currentCtr}%</p>
              </div>
              <div className="h-8 w-[1px] bg-slate-800" />
              <div className="text-center min-w-[80px]">
                <span className="text-[10px] text-emerald-400 uppercase font-mono">Potential</span>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">+{opp.potentialMonthlyClicks} Clicks</p>
              </div>

              {/* Action Trigger CTAs */}
              <div className="flex flex-col gap-1.5 w-full sm:w-auto mt-2 sm:mt-0">
                <button
                  onClick={() => onOptimizeKeyword(opp)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 shadow transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Optimize Title & CTR</span>
                </button>
                <button
                  onClick={() => onGenerateBrief(opp)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition-all"
                >
                  <span>Create Content Brief</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
