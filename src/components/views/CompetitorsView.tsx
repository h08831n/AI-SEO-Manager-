import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  Plus,
  ExternalLink,
  Check,
  X,
  Sparkles,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { CompetitorGapItem } from '../../types';

interface CompetitorsViewProps {
  websiteId: string;
  competitors: any[];
  onRefresh: () => void;
  onToggleExclusion: (domain: string, isExcluded: boolean) => void;
}

export const CompetitorsView: React.FC<CompetitorsViewProps> = ({
  websiteId,
  competitors,
  onRefresh,
  onToggleExclusion,
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'gaps'>('matrix');

  const defaultCompetitors = [
    { domain: 'semrush.com', authority: 89, overlap: '34%', sharedKw: 1420, gapKw: 850, isDirect: true },
    { domain: 'ahrefs.com', authority: 91, overlap: '41%', sharedKw: 1890, gapKw: 920, isDirect: true },
    { domain: 'conductor.com', authority: 76, overlap: '28%', sharedKw: 640, gapKw: 410, isDirect: true },
    { domain: 'brightedge.com', authority: 79, overlap: '25%', sharedKw: 580, gapKw: 390, isDirect: false },
  ];

  const contentGaps: CompetitorGapItem[] = [
    {
      id: 'gap-1',
      competitorDomain: 'ahrefs.com',
      topic: 'Autonomous SEO Agent Architecture',
      keyword: 'ai seo agent framework',
      searchVolume: 3200,
      intent: 'Commercial',
      competitorPosition: 2,
      ourPosition: 14,
      difficulty: 42,
      businessValue: 'High',
      trafficPotential: 1800,
      priority: 'CRITICAL',
      recommendedArticleAngle: 'Technical Teardown: Deterministic vs LLM Search Optimizers',
    },
    {
      id: 'gap-2',
      competitorDomain: 'semrush.com',
      topic: 'Core Web Vitals INP Optimization',
      keyword: 'how to pass interaction to next paint',
      searchVolume: 5400,
      intent: 'Informational',
      competitorPosition: 1,
      ourPosition: null,
      difficulty: 38,
      businessValue: 'High',
      trafficPotential: 2600,
      priority: 'HIGH',
      recommendedArticleAngle: 'Step-by-Step Developer Guide: Solving JavaScript Long Tasks',
    },
    {
      id: 'gap-3',
      competitorDomain: 'conductor.com',
      topic: 'Enterprise Headless CMS SEO Sync',
      keyword: 'automated cms schema sync',
      searchVolume: 1900,
      intent: 'Commercial',
      competitorPosition: 3,
      ourPosition: null,
      difficulty: 29,
      businessValue: 'High',
      trafficPotential: 1100,
      priority: 'HIGH',
      recommendedArticleAngle: 'Production Checklist: Webhooks vs Polling for Real-Time Indexation',
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Competitor Intelligence & Content Gaps</h2>
          <p className="text-xs text-slate-400">
            Automated SERP overlap matrix, authority benchmarks, and high-value keyword gap opportunities.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Rescan Competitors</span>
        </button>
      </div>

      {/* Competitors Overlap Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {defaultCompetitors.map((comp, idx) => (
          <div
            key={idx}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-white font-mono">{comp.domain}</h4>
                <div className="text-[10px] text-slate-500">{comp.isDirect ? 'Direct Competitor' : 'Adjacent Brand'}</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                DA: {comp.authority}
              </span>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>SERP Overlap:</span>
                <span className="text-emerald-400 font-mono font-bold">{comp.overlap}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shared Keywords:</span>
                <span className="text-slate-300 font-mono">{comp.sharedKw.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>High-Value Gaps:</span>
                <span className="text-cyan-400 font-mono font-bold">+{comp.gapKw} keywords</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content Gap Opportunities */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">High-Priority Keyword Gap Opportunities</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">Rank 1-3 Capture Potential</span>
        </div>

        <div className="space-y-3 pt-2">
          {contentGaps.map((gap) => (
            <div
              key={gap.id}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {gap.priority}
                    </span>
                    <span className="text-xs font-bold text-white">{gap.topic}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">Target: "{gap.keyword}"</div>
                </div>

                <div className="flex items-center space-x-3 text-xs font-mono">
                  <span className="text-slate-400">Vol: <strong className="text-white">{gap.searchVolume.toLocaleString()}</strong></span>
                  <span className="text-slate-400">Potential: <strong className="text-emerald-400">+{gap.trafficPotential} clicks/mo</strong></span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <span className="text-slate-500 font-semibold uppercase text-[10px] block mb-0.5">Recommended Article Angle:</span>
                {gap.recommendedArticleAngle}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
