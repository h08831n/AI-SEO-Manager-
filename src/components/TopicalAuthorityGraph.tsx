import React, { useState } from 'react';
import { TopicCluster } from '../types';
import {
  GitBranch,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  PlusCircle,
} from 'lucide-react';

interface TopicalAuthorityGraphProps {
  clusters: TopicCluster[];
  onGenerateBriefForSubtopic: (pillar: string, subtopic: string) => void;
}

export const TopicalAuthorityGraph: React.FC<TopicalAuthorityGraphProps> = ({
  clusters,
  onGenerateBriefForSubtopic,
}) => {
  const [selectedClusterId, setSelectedClusterId] = useState<string>(clusters[0]?.id || '');

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId) || clusters[0];

  const getLiveArticles = (cluster: TopicCluster) => {
    if (cluster.supportingArticles) return cluster.supportingArticles;
    if (cluster.subtopics) {
      return cluster.subtopics
        .filter((s) => s.status === 'PUBLISHED')
        .map((s) => ({
          title: s.name,
          url: s.url || `${cluster.pillarUrl}/${s.id}`,
          internalInlinksFromPillar: s.internalInlinksFromPillar ?? true,
        }));
    }
    return [];
  };

  const getMissingSubtopics = (cluster: TopicCluster) => {
    if (cluster.missingSubtopics) return cluster.missingSubtopics;
    if (cluster.subtopics) {
      return cluster.subtopics
        .filter((s) => s.status === 'GAP' || s.status === 'PLANNED' || s.status === 'DRAFT')
        .map((s) => s.name);
    }
    return [];
  };

  const selectedLiveArticles = selectedCluster ? getLiveArticles(selectedCluster) : [];
  const selectedMissingSubtopics = selectedCluster ? getMissingSubtopics(selectedCluster) : [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <GitBranch className="h-4 w-4" />
            <span>TOPICAL CLUSTERS & ENTITY ONTOLOGY GRAPH</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Topical Authority & Semantic Completeness
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Map overarching pillar hubs to supporting subtopic clusters, evaluate entity coverage scores, and identify missing knowledge nodes required for SERP domain dominance.
          </p>
        </div>
      </div>

      {/* Cluster Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {clusters.map((cluster) => {
          const isSelected = cluster.id === selectedCluster.id;
          const liveArts = getLiveArticles(cluster);
          const missingNodes = getMissingSubtopics(cluster);
          return (
            <div
              key={cluster.id}
              onClick={() => setSelectedClusterId(cluster.id)}
              className={`p-5 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-slate-850 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">{cluster.pillarName}</span>
                <span className="text-xs font-mono font-bold text-emerald-400">{cluster.coverageScore}% Complete</span>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${cluster.coverageScore}%` }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>{liveArts.length} Live Articles</span>
                <span className="text-amber-400">{missingNodes.length} Missing Nodes</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Cluster Topology (Split Grid) */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono text-emerald-400">ACTIVE PILLAR HUB</span>
            <h2 className="text-lg font-bold text-white mt-0.5">{selectedCluster.pillarName}</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{selectedCluster.pillarUrl}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 uppercase font-mono block">Topical Strength</span>
            <span className="text-xl font-bold font-mono text-emerald-400">{selectedCluster.coverageScore}/100</span>
          </div>
        </div>

        {/* Supporting Articles & Missing Subtopics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Supporting Articles (Left) */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-300 uppercase tracking-wider">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Existing Supporting Articles ({selectedLiveArticles.length})</span>
            </div>

            <div className="space-y-2">
              {selectedLiveArticles.map((art, idx) => (
                <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-200 block">{art.title}</span>
                    <span className="font-mono text-[11px] text-emerald-400 mt-0.5 block">{art.url}</span>
                  </div>
                  <div className="text-right font-mono shrink-0 ml-3">
                    <span className="text-[10px] text-slate-400 block">Inlinks from Pillar</span>
                    <span className="text-white font-bold">{art.internalInlinksFromPillar ? 'Linked' : 'Missing Link'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Missing Entity Subtopics (Right) */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span>Missing Entity Subtopics Required for 100% Authority</span>
            </div>

            <div className="space-y-2">
              {selectedMissingSubtopics.map((subtopic, idx) => (
                <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-amber-950/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-200 block">{subtopic}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Uncovered Entity Node</span>
                  </div>
                  <button
                    onClick={() => onGenerateBriefForSubtopic(selectedCluster.pillarName, subtopic)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shrink-0 ml-3 shadow transition-all"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Create Brief</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
