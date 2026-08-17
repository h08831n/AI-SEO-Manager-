import React, { useState } from 'react';
import { SEOHealthState, HealthPillarDetail } from '../types';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Search,
  Filter,
} from 'lucide-react';

interface HealthScoreDashboardProps {
  healthState: SEOHealthState;
}

export const HealthScoreDashboard: React.FC<HealthScoreDashboardProps> = ({ healthState }) => {
  const [selectedPillarKey, setSelectedPillarKey] = useState<string>('technical');
  const [searchFilter, setSearchFilter] = useState('');
  const [trendFilter, setTrendFilter] = useState<'ALL' | 'UP' | 'DOWN' | 'NEUTRAL'>('ALL');

  const pillarsArray: HealthPillarDetail[] = Object.values(healthState.pillars);

  const filteredPillars = pillarsArray.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          p.evidence.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesTrend = trendFilter === 'ALL' ||
                         (trendFilter === 'UP' && p.trend === 'up') ||
                         (trendFilter === 'DOWN' && p.trend === 'down') ||
                         (trendFilter === 'NEUTRAL' && p.trend === 'neutral');
    return matchesSearch && matchesTrend;
  });

  const selectedPillar: HealthPillarDetail = healthState.pillars[selectedPillarKey as keyof typeof healthState.pillars] || pillarsArray[0];

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    if (score >= 75) return 'text-sky-400 border-sky-500/40 bg-sky-500/10';
    if (score >= 60) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
  };

  const getScoreBadgeBg = (score: number) => {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 75) return 'bg-sky-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <Activity className="h-4 w-4" />
            <span>CONTINUOUS MULTI-DIMENSIONAL AUDIT MATRIX</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            17-Pillar SEO Health Architecture
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            A comprehensive diagnostic system. Each pillar delivers granular metrics, evidence logs, root problems, and actionable recommendations.
          </p>
        </div>

        {/* Overall Score Badge */}
        <div className="flex items-center space-x-4 bg-slate-950 p-3.5 rounded-xl border border-slate-800 shrink-0">
          <div className="text-center">
            <span className="text-[11px] text-slate-400 uppercase font-mono">Weighted Health Score</span>
            <div className="flex items-baseline justify-center space-x-1.5 mt-0.5">
              <span className="text-3xl font-black text-white">{healthState.overallScore}</span>
              <span className="text-xs text-slate-400">/100</span>
            </div>
          </div>
          <div className="h-10 w-[1px] bg-slate-800" />
          <div className="text-left text-xs">
            <div className="flex items-center text-emerald-400 font-bold">
              <TrendingUp className="h-3.5 w-3.5 mr-1" />
              <span>+{healthState.overallScore - healthState.previousScore} pts</span>
            </div>
            <span className="text-[10px] text-slate-400">vs previous audit</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search pillars, problems, or evidence..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-1.5 self-end sm:self-center">
          <Filter className="h-3.5 w-3.5 text-slate-400 mr-1" />
          {(['ALL', 'UP', 'DOWN', 'NEUTRAL'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setTrendFilter(mode)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                trendFilter === mode
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Pillar List (Left) + Detail Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pillar Cards List */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
          {filteredPillars.map((pillar) => {
            const isSelected = selectedPillarKey === pillar.key;
            return (
              <div
                key={pillar.key}
                onClick={() => setSelectedPillarKey(pillar.key)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-850 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs border ${getScoreColor(
                        pillar.score
                      )}`}
                    >
                      {pillar.score}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">{pillar.name}</h3>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="flex items-center">
                          {pillar.trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-400 mr-1" />}
                          {pillar.trend === 'down' && <TrendingDown className="h-3 w-3 text-rose-400 mr-1" />}
                          {pillar.trend === 'neutral' && <Minus className="h-3 w-3 text-slate-400 mr-1" />}
                          <span className="capitalize">{pillar.trend} Trend</span>
                        </span>
                        <span>•</span>
                        <span>Weight {pillar.weight}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-16">
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getScoreBadgeBg(pillar.score)}`}
                        style={{ width: `${pillar.score}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Pillar Inspector Panel */}
        <div className="lg:col-span-7 bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
          <div className="flex items-start justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">{selectedPillar.name}</h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono border ${getScoreColor(
                    selectedPillar.score
                  )}`}
                >
                  Score: {selectedPillar.score}/100
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Weight in overall domain health model: {selectedPillar.weight}%</p>
            </div>
          </div>

          {/* Section: Evidence */}
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Diagnostic Evidence & Verified Data</span>
            </div>
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed">
              {selectedPillar.evidence}
            </div>
          </div>

          {/* Section: Problems Discovered */}
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>Identified Defects & Friction Points ({selectedPillar.problems.length})</span>
            </div>
            <div className="space-y-2">
              {selectedPillar.problems.map((prob, i) => (
                <div key={i} className="p-3 rounded-lg bg-slate-950 border border-rose-950/60 flex items-start space-x-2">
                  <div className="h-2 w-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <span className="text-xs text-rose-200">{prob}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Recommendations */}
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-300 uppercase tracking-wider mb-2">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <span>Actionable Senior SEO Recommendations</span>
            </div>
            <div className="space-y-2">
              {selectedPillar.recommendations.map((rec, i) => (
                <div key={i} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start space-x-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span className="text-xs text-slate-200">{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
