import React, { useState } from 'react';
import { CannibalizationCase } from '../types';
import {
  AlertTriangle,
  GitMerge,
  ArrowRight,
  ShieldCheck,
  Search,
  CheckCircle2,
  Play,
  Layers,
} from 'lucide-react';

interface CannibalizationDetectorProps {
  issues: CannibalizationCase[];
  onResolveIssue: (issue: CannibalizationCase, chosenStrategy: string) => void;
}

export const CannibalizationDetector: React.FC<CannibalizationDetectorProps> = ({
  issues,
  onResolveIssue,
}) => {
  const [selectedIssue, setSelectedIssue] = useState<CannibalizationCase>(issues[0]);
  const [chosenStrategy, setChosenStrategy] = useState<string>(selectedIssue?.recommendedStrategy || 'DIFFERENTIATE_INTENT');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <span>MULTI-URL QUERY CLASH & INTENT COLLISION RESOLVER</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Keyword Cannibalization Detector
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Detect competing internal URLs splitting search equity for identical queries. Classify similarity, evaluate traffic dilution, and prescribe targeted structural consolidation.
          </p>
        </div>
      </div>

      {/* Issues Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Issues List (Left) */}
        <div className="lg:col-span-5 space-y-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider text-[11px]">
            Active Cannibalization Clashes ({issues.length})
          </span>

          {issues.map((issue) => {
            const isSelected = selectedIssue?.id === issue.id;
            return (
              <div
                key={issue.id}
                onClick={() => {
                  setSelectedIssue(issue);
                  setChosenStrategy(issue.recommendedStrategy);
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-850 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                      (issue.severity || 'HIGH') === 'HIGH'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {issue.severity || 'HIGH'} Severity
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Similarity: {issue.contentSimilarityScore ?? 85}%</span>
                </div>

                <h3 className="text-sm font-bold text-white mt-2">"{issue.query}"</h3>
                <p className="text-xs text-slate-400 mt-1">{issue.competingUrls.length} URLs competing for rank</p>

                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Rec. Strategy:</span>
                  <span className="font-mono font-semibold text-emerald-400">{issue.recommendedStrategy.replace(/_/g, ' ')}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Issue Diagnostic & Resolution Workbench (Right) */}
        <div className="lg:col-span-7 bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
          {selectedIssue ? (
            <>
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono text-slate-400">Target Query:</span>
                  <h2 className="text-base font-bold text-white">"{selectedIssue.query}"</h2>
                </div>
                <p className="text-xs text-slate-300 mt-1">{selectedIssue.reason || selectedIssue.intentCollisionSummary}</p>
              </div>

              {/* Competing URLs Comparison Table */}
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Competing URLs & Traffic Distribution
                </span>
                <div className="space-y-2.5 mt-2">
                  {selectedIssue.competingUrls.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                      <div className="max-w-[320px]">
                        <span className="font-mono text-emerald-400 font-medium break-all">{item.url}</span>
                      </div>
                      <div className="flex items-center space-x-4 shrink-0 font-mono">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Position</span>
                          <span className="text-white font-bold">#{item.avgPosition ?? item.position}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Clicks</span>
                          <span className="text-emerald-400 font-bold">{item.clicks}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Share</span>
                          <span className="text-sky-400 font-bold">{item.trafficShare}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strategy Prescription Selector */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                  Choose Structural Remediation Strategy
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'DIFFERENTIATE_INTENT', label: 'Differentiate Search Intent', desc: 'Rewire H1/title so Page A serves Commercial and Page B serves Informational' },
                    { id: 'CANONICALIZE', label: 'Canonicalize to Primary URL', desc: 'Set canonical header on secondary page to point to authority root' },
                    { id: '301_REDIRECT', label: '301 Permanent Redirect', desc: 'Redirect secondary URL to authority URL and pass link equity' },
                    { id: 'MERGE', label: 'Merge Content & Consolidate', desc: 'Combine unique sections into primary pillar and redirect old slug' },
                  ].map((strat) => (
                    <div
                      key={strat.id}
                      onClick={() => setChosenStrategy(strat.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        chosenStrategy === strat.id
                          ? 'bg-slate-850 border-emerald-500/50 shadow'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold text-white block">{strat.label}</span>
                      <p className="text-[11px] text-slate-400 mt-1">{strat.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-3">
                  <button
                    onClick={() => onResolveIssue(selectedIssue, chosenStrategy)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 shadow transition-all"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Apply Resolution Strategy & Queue Action</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">Select a cannibalization issue to view details</div>
          )}
        </div>
      </div>
    </div>
  );
};
