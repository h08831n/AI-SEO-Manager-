import React, { useState } from 'react';
import { DecayingContentItem } from '../types';
import { generateRefresh } from '../services/api';
import { ContentRefreshResponse } from '../shared/contracts';
import {
  Layers,
  Sparkles,
  PlusCircle,
  HelpCircle,
  CheckCircle2,
  ListOrdered,
} from 'lucide-react';

interface ContentDecayRefreshProps {
  decayingPages: DecayingContentItem[];
  onAddToPipeline: (page: DecayingContentItem, diagnosis: any) => void;
}

export const ContentDecayRefresh: React.FC<ContentDecayRefreshProps> = ({
  decayingPages,
  onAddToPipeline,
}) => {
  const [selectedPage, setSelectedPage] = useState<DecayingContentItem>(decayingPages[0]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [refreshDiagnosis, setRefreshDiagnosis] = useState<ContentRefreshResponse | null>(null);

  const handleRunAiDiagnosis = async (page: DecayingContentItem) => {
    setIsDiagnosing(true);
    try {
      const data = await generateRefresh({
        targetUrl: page.url,
        currentTitle: page.title,
        dropPercentage: page.dropPercentage,
        historicalClicks: page.peakClicks,
        currentClicks: page.currentClicks,
      });
      setRefreshDiagnosis(data);
    } catch (err) {
      console.error('Refresh diagnosis error:', err);
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <Layers className="h-4 w-4" />
            <span>ALGORITHMIC CONTENT DECAY & REFRESH WORKBENCH</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Content Decay Detection & AI Refresh Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Detect historical high-performing URLs that have lost organic search velocity. Synthesize granular revision blueprints: obsolete data points, missing semantic subtopics, and structural upgrades.
          </p>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Decaying URLs List (Left) */}
        <div className="lg:col-span-5 space-y-3">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider text-[11px]">
            Decaying Assets Flagged ({decayingPages.length})
          </span>

          {decayingPages.map((page) => {
            const isSelected = selectedPage?.id === page.id;
            return (
              <div
                key={page.id}
                onClick={() => {
                  setSelectedPage(page);
                  setRefreshDiagnosis(null);
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-850 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    -{page.dropPercentage}% Drop
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Over {page.decayPeriod || 'Trailing 90 Days'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white mt-2 leading-snug">{page.title}</h3>
                <p className="text-xs text-emerald-400 font-mono mt-0.5 truncate">{page.url}</p>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-800 text-xs font-mono text-center">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Peak Volume</span>
                    <span className="text-white font-bold">{page.peakClicks} clicks/mo</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Current Velocity</span>
                    <span className="text-rose-400 font-bold">{page.currentClicks} clicks/mo</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Asset Deep Diagnosis Panel (Right) */}
        <div className="lg:col-span-7 bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
          {selectedPage ? (
            <>
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-rose-400 font-bold">DECAY DIAGNOSTIC REPORT</span>
                  <button
                    onClick={() => handleRunAiDiagnosis(selectedPage)}
                    disabled={isDiagnosing}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow transition-all cursor-pointer"
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
                    <span>{isDiagnosing ? 'Generating Diagnostic...' : 'Generate AI Refresh Plan'}</span>
                  </button>
                </div>
                <h2 className="text-base font-bold text-white mt-2">{selectedPage.title}</h2>
                <p className="text-xs text-emerald-400 font-mono mt-0.5 break-all">{selectedPage.url}</p>
              </div>

              {/* Display Initial / Generated Diagnosis */}
              {refreshDiagnosis ? (
                <div className="space-y-4">
                  {/* Summary Box */}
                  <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                    <span className="text-emerald-400 font-bold font-mono text-[10px] block uppercase">Root Cause Diagnosis:</span>
                    <p className="text-slate-200 mt-1">{refreshDiagnosis.diagnosisSummary}</p>
                    {refreshDiagnosis.proposedNewTitle && (
                      <p className="text-slate-300 mt-2 font-mono text-[11px]">
                        <strong className="text-emerald-400">Proposed New Title:</strong> {refreshDiagnosis.proposedNewTitle}
                      </p>
                    )}
                    {refreshDiagnosis.proposedNewMetaDescription && (
                      <p className="text-slate-400 mt-1 font-mono text-[11px]">
                        <strong className="text-emerald-400">Proposed Meta:</strong> {refreshDiagnosis.proposedNewMetaDescription}
                      </p>
                    )}
                  </div>

                  {/* Missing Topics Box */}
                  {refreshDiagnosis.missingTopics && refreshDiagnosis.missingTopics.length > 0 && (
                    <div className="p-3.5 bg-slate-950 rounded-lg border border-emerald-950/60 text-xs space-y-2">
                      <div className="flex items-center space-x-1 text-emerald-400 font-bold text-[11px] uppercase">
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span>Missing Topics & Entities to Cover</span>
                      </div>
                      <ul className="list-disc list-inside text-slate-300 space-y-1">
                        {refreshDiagnosis.missingTopics.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Plan */}
                  {refreshDiagnosis.actionPlan && refreshDiagnosis.actionPlan.length > 0 && (
                    <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2">
                      <div className="flex items-center space-x-1 text-indigo-400 font-bold text-[11px] uppercase">
                        <ListOrdered className="h-3.5 w-3.5" />
                        <span>Step-by-Step Refresh Plan</span>
                      </div>
                      <ul className="list-decimal list-inside text-slate-300 space-y-1">
                        {refreshDiagnosis.actionPlan.map((step: string, i: number) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* FAQ Additions */}
                  {refreshDiagnosis.newFaqsToAdd && refreshDiagnosis.newFaqsToAdd.length > 0 && (
                    <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2">
                      <div className="flex items-center space-x-1 text-indigo-400 font-bold text-[11px] uppercase">
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>Recommended FAQ Additions (Schema Ready)</span>
                      </div>
                      <div className="space-y-2">
                        {refreshDiagnosis.newFaqsToAdd.map((faq: any, i: number) => (
                          <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800">
                            <span className="font-bold text-white block">Q: {faq.question}</span>
                            <p className="text-slate-400 text-[11px] mt-0.5">A: {faq.answer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Queue to Content Pipeline */}
                  <div className="pt-2">
                    <button
                      onClick={() => onAddToPipeline(selectedPage, refreshDiagnosis)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 shadow transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Push Refresh Project to Content Calendar</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-950 rounded-xl border border-slate-800 p-6 space-y-3">
                  <Sparkles className="h-8 w-8 text-emerald-400 mx-auto" />
                  <h3 className="text-sm font-bold text-white">Generate Exact Content Refresh Blueprint</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Click "Generate AI Refresh Plan" above to perform deep semantic comparison against top ranking competitors and generate concrete heading, data, and FAQ updates.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">Select a decaying page to review</div>
          )}
        </div>
      </div>
    </div>
  );
};
