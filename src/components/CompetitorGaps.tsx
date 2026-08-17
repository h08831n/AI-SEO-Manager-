import React, { useState } from 'react';
import { CompetitorGapItem } from '../types';
import {
  ShieldCheck,
  Search,
  Sparkles,
} from 'lucide-react';

interface CompetitorGapsProps {
  gaps: CompetitorGapItem[];
  onCreateArticleBrief: (gap: CompetitorGapItem) => void;
}

export const CompetitorGaps: React.FC<CompetitorGapsProps> = ({
  gaps,
  onCreateArticleBrief,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('ALL');

  const filteredGaps = gaps.filter((g) => {
    const angle = g.recommendedArticleAngle || '';
    const matchesSearch = g.keyword.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          angle.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesDiff = difficultyFilter === 'ALL' ||
                        (difficultyFilter === 'EASY' && g.difficulty <= 35) ||
                        (difficultyFilter === 'MEDIUM' && g.difficulty > 35 && g.difficulty <= 65) ||
                        (difficultyFilter === 'HARD' && g.difficulty > 65);
    return matchesSearch && matchesDiff;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <ShieldCheck className="h-4 w-4" />
            <span>COMPETITIVE INTELLIGENCE & SEMANTIC CONTENT DEFICIT</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Competitor Content & Keyword Gap Matrix
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Monitor ranking positions of direct market rivals, detect high-volume uncaptured keywords, and synthesize editorial briefs with strategic differentiation angles.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search competitor keywords or angles..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            aria-label="Filter by Keyword Difficulty"
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Difficulties</option>
            <option value="EASY">Low Difficulty (KD ≤ 35)</option>
            <option value="MEDIUM">Medium Difficulty (KD 36-65)</option>
            <option value="HARD">High Difficulty (KD &gt; 65)</option>
          </select>
        </div>
      </div>

      {/* Gap Matrix Cards */}
      <div className="space-y-4">
        {filteredGaps.map((gap) => (
          <div
            key={gap.id}
            className="bg-slate-900 p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase ${
                    gap.businessValue === 'High' || gap.businessValue === ('HIGH' as any)
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  }`}
                >
                  {gap.businessValue} Business Relevance
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  KD: {gap.difficulty}/100
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                  {gap.priority} Priority
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{gap.keyword}</h3>
                <p className="text-xs text-slate-300 mt-1">
                  <strong>Recommended Angle:</strong> {gap.recommendedArticleAngle}
                </p>
              </div>

              {/* Competitors Ranking Snapshot */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-400 font-mono">Top Rival Ranking:</span>
                <span className="px-2 py-0.5 rounded bg-slate-950 text-[10px] text-slate-300 border border-slate-800 font-mono">
                  {gap.competitorDomain}: <strong className="text-emerald-400">#{gap.competitorPosition}</strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-950 text-[10px] text-slate-300 border border-slate-800 font-mono">
                  Our Position: <strong className={gap.ourPosition ? 'text-amber-400' : 'text-slate-500'}>{gap.ourPosition ? `#${gap.ourPosition}` : 'Not Ranked'}</strong>
                </span>
              </div>
            </div>

            {/* Metrics & Action Button */}
            <div className="flex flex-wrap items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800/80 shrink-0">
              <div className="text-center min-w-[80px]">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Search Vol</span>
                <p className="text-base font-bold text-white font-mono mt-0.5">{gap.searchVolume.toLocaleString()}</p>
              </div>
              <div className="h-8 w-[1px] bg-slate-800" />
              <div className="text-center min-w-[70px]">
                <span className="text-[10px] text-slate-400 uppercase font-mono">KD Score</span>
                <p className="text-base font-bold text-amber-400 font-mono mt-0.5">{gap.difficulty}</p>
              </div>
              <div className="h-8 w-[1px] bg-slate-800" />
              <div className="text-center min-w-[80px]">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Traffic Est</span>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">+{gap.trafficPotential}/mo</p>
              </div>

              <button
                onClick={() => onCreateArticleBrief(gap)}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow transition-all"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Create Brief in AI Studio</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

