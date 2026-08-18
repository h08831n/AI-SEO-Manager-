import React, { useState } from 'react';
import { ContentPlanItem, ContentPipelineStage } from '../types';
import { exportToWordPress } from '../services/api';
import {
  FileText,
  Users,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface ContentPipelinePlannerProps {
  items: ContentPlanItem[];
  onOpenStudioWithItem: (item: ContentPlanItem) => void;
  onUpdateStage: (itemId: string, newStage: ContentPipelineStage) => void;
  onAddNewIdea: () => void;
}

const LIFECYCLE_STAGES: ContentPipelineStage[] = [
  'IDEA',
  'RESEARCH',
  'BRIEF',
  'WRITING',
  'REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'MONITORING',
  'REFRESH_REQUIRED',
];

export const ContentPipelinePlanner: React.FC<ContentPipelinePlannerProps> = ({
  items,
  onOpenStudioWithItem,
  onUpdateStage,
  onAddNewIdea,
}) => {
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('ALL');
  const [publishingRateTarget, setPublishingRateTarget] = useState(4); // 4 articles/week
  const [activeWriters, setActiveWriters] = useState(3);
  const [activeEditors, setActiveEditors] = useState(2);
  const [wpSyncMessage, setWpSyncMessage] = useState<string | null>(null);

  // Capacity calculation
  const weeklyProductionCapacity = activeWriters * 1.5; // ~4.5 articles/week
  const capacityStatus = weeklyProductionCapacity >= publishingRateTarget ? 'ON_TRACK' : 'AT_RISK';

  const handleSyncWordPress = async (item: ContentPlanItem) => {
    try {
      const res = await exportToWordPress({
        title: item.title,
        content: `<!-- Auto generated from AI SEO Manager -->\n<h1>${item.title}</h1>\n<p>Targeting keyword: ${item.primaryKeyword}</p>`,
        status: 'draft',
      });
      setWpSyncMessage(res.message || 'WordPress payload preview generated.');
      setTimeout(() => setWpSyncMessage(null), 4000);
    } catch (err: any) {
      setWpSyncMessage(`WordPress sync failed: ${err.message}`);
      setTimeout(() => setWpSyncMessage(null), 4000);
    }
  };

  const filteredItems = items.filter((item) => {
    return selectedStageFilter === 'ALL' || item.stage === selectedStageFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <FileText className="h-4 w-4" />
            <span>10-STAGE EDITORIAL CALENDAR & VELOCITY ENGINE</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Content Pipeline & Capacity Planner
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Track organic content velocity from Ideation to Publishing and Post-launch Monitoring. Calculate team throughput and prevent editorial bottlenecks.
          </p>
        </div>

        <button
          onClick={onAddNewIdea}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 shadow transition-all shrink-0"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Content Idea</span>
        </button>
      </div>

      {/* WordPress Sync Feedback Toast */}
      {wpSyncMessage && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-xs font-semibold text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{wpSyncMessage}</span>
        </div>
      )}

      {/* SECTION 18: CAPACITY PLANNER BENCHMARK */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">Content Velocity & Capacity Planner</h2>
          </div>
          <span
            className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold ${
              capacityStatus === 'ON_TRACK'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {capacityStatus === 'ON_TRACK' ? 'VELOCITY ON TRACK' : 'CAPACITY AT RISK'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-[10px]">Publishing Target</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <input
                type="number"
                value={publishingRateTarget}
                onChange={(e) => setPublishingRateTarget(parseInt(e.target.value) || 1)}
                className="w-12 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white font-mono font-bold text-sm"
              />
              <span className="text-slate-400 text-[10px]">articles / wk</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-[10px]">Active Writers</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <input
                type="number"
                value={activeWriters}
                onChange={(e) => setActiveWriters(parseInt(e.target.value) || 1)}
                className="w-12 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white font-mono font-bold text-sm"
              />
              <span className="text-slate-400 text-[10px]">authors</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-[10px]">Active Editors</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <input
                type="number"
                value={activeEditors}
                onChange={(e) => setActiveEditors(parseInt(e.target.value) || 1)}
                className="w-12 px-1 py-0.5 bg-slate-900 border border-slate-700 rounded text-white font-mono font-bold text-sm"
              />
              <span className="text-slate-400 text-[10px]">reviewers</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-[10px]">Estimated Velocity</span>
            <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
              {weeklyProductionCapacity.toFixed(1)} / wk
            </div>
          </div>
        </div>
      </div>

      {/* Stage Filter Tabs */}
      <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none border-b border-slate-800 pb-2">
        <button
          onClick={() => setSelectedStageFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            selectedStageFilter === 'ALL'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Items ({items.length})
        </button>
        {LIFECYCLE_STAGES.map((stg) => (
          <button
            key={stg}
            onClick={() => setSelectedStageFilter(stg)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedStageFilter === stg
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {stg} ({items.filter((i) => i.stage === stg).length})
          </button>
        ))}
      </div>

      {/* Content Pipeline Cards */}
      <div className="space-y-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-slate-900 p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all space-y-4"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] px-2.5 py-0.5 rounded font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    STAGE: {item.stage}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {item.contentType}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    Target: {item.wordCountTarget?.toLocaleString() || 2000} words
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                    {item.searchIntent}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mt-1">{item.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span><strong>Primary Keyword:</strong> <span className="text-emerald-400 font-mono">{item.primaryKeyword}</span></span>
                  <span>•</span>
                  <span><strong>Writer:</strong> {item.writer || 'Unassigned'}</span>
                  <span>•</span>
                  <span><strong>Due:</strong> {item.targetDate}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  aria-label="Change Lifecycle Stage"
                  value={item.stage}
                  onChange={(e) => onUpdateStage(item.id, e.target.value as ContentPipelineStage)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
                >
                  {LIFECYCLE_STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <button
                  onClick={() => onOpenStudioWithItem(item)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Open in AI Studio</span>
                </button>

                <button
                  onClick={() => handleSyncWordPress(item)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1 border border-slate-700 transition-all"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Sync WP</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

