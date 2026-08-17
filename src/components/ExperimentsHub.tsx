import React, { useState } from 'react';
import { SEOExperiment } from '../types';
import {
  Activity,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowUpRight,
  PlusCircle,
  Sparkles,
  BarChart2,
} from 'lucide-react';

interface ExperimentsHubProps {
  experiments: SEOExperiment[];
  onCreateExperiment: () => void;
}

export const ExperimentsHub: React.FC<ExperimentsHubProps> = ({
  experiments,
  onCreateExperiment,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RUNNING' | 'CONCLUDED'>('ALL');

  const filteredExperiments = experiments.filter((exp) => {
    return statusFilter === 'ALL' || exp.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <Activity className="h-4 w-4" />
            <span>CONTROLLED GROUP A/B TESTING & CAUSAL INFERENCE</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Controlled SEO A/B Experiments Tracker
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Run scientific SEO split tests (Variant URLs vs Synthetic Control Group). Measure true incremental click lift, CTR changes, and position deltas while filtering out external seasonality.
          </p>
        </div>

        <button
          onClick={onCreateExperiment}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 shadow transition-all shrink-0"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Launch New SEO Experiment</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'ALL'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Experiments ({experiments.length})
        </button>
        <button
          onClick={() => setStatusFilter('RUNNING')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'RUNNING'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Active Tests ({experiments.filter((e) => e.status === 'RUNNING').length})
        </button>
        <button
          onClick={() => setStatusFilter('CONCLUDED')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'CONCLUDED'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Concluded & Proven ({experiments.filter((e) => e.status === 'CONCLUDED').length})
        </button>
      </div>

      {/* Experiments Cards */}
      <div className="space-y-4">
        {filteredExperiments.map((exp) => (
          <div
            key={exp.id}
            className="bg-slate-900 p-6 rounded-xl border border-slate-800 hover:border-slate-700 transition-all space-y-4"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded font-mono font-bold uppercase ${
                      exp.status === 'CONCLUDED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {exp.status} ({exp.testDurationDays} Days Test)
                  </span>

                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    Hypothesis Type: {exp.type}
                  </span>

                  {exp.confidenceLevel && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                      {exp.confidenceLevel}% Statistical Confidence
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-white mt-1">{exp.title}</h3>
                <p className="text-xs text-slate-300">{exp.hypothesis}</p>
              </div>

              {/* Measured Lift Badge */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center sm:text-right shrink-0">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Measured Click Lift</span>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5 flex items-center justify-center sm:justify-end">
                  <ArrowUpRight className="h-5 w-5 mr-1" />
                  {exp.measuredLiftPct > 0 ? `+${exp.measuredLiftPct}%` : `${exp.measuredLiftPct}%`}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Controlled vs Baseline</span>
              </div>
            </div>

            {/* Test Group URLs vs Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-950 p-3.5 rounded-lg border border-slate-800/80 font-mono">
              <div>
                <span className="text-[10px] text-emerald-400 uppercase font-bold">Variant Test URLs (Group A)</span>
                <ul className="list-disc list-inside text-slate-300 space-y-0.5 mt-1">
                  {exp.targetUrls.map((u, i) => (
                    <li key={i} className="truncate">{u}</li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Control Benchmark Group (Group B)</span>
                <ul className="list-disc list-inside text-slate-400 space-y-0.5 mt-1">
                  {exp.controlUrls.map((u, i) => (
                    <li key={i} className="truncate">{u}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Structured Learnings Log */}
            {exp.learningLog && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs">
                <span className="font-bold text-emerald-400 block uppercase text-[10px] font-mono">Institutional SEO Learning:</span>
                <p className="text-slate-200 mt-0.5">{exp.learningLog}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
