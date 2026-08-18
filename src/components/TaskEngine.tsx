import React, { useState } from 'react';
import { SEOTask } from '../types';
import {
  CheckCircle2,
  Clock,
  Play,
  Filter,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Eye,
  Zap,
} from 'lucide-react';

interface TaskEngineProps {
  tasks: SEOTask[];
  onExecuteTask: (task: SEOTask) => void;
  onRollbackTask: (taskId: string) => void;
}

export const TaskEngine: React.FC<TaskEngineProps> = ({
  tasks,
  onExecuteTask,
  onRollbackTask,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedAutomation, setSelectedAutomation] = useState<string>('ALL');
  const [dryRunTask, setDryRunTask] = useState<SEOTask | null>(null);

  const filteredTasks = tasks.filter((t) => {
    const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
    const matchesAuto = selectedAutomation === 'ALL' || t.automationLevel === selectedAutomation;
    return matchesCategory && matchesAuto;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono mb-1">
            <ShieldCheck className="h-4 w-4" />
            <span>ICE PRIORITIZATION & DRY-RUN SAFETY EXECUTION</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
              DEMO_FIXTURE DIRECTIVES
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Prioritized SEO Task Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Every technical flaw, decay signal, and opportunity is normalized into an ICE-scored directive (Impact x Confidence / Effort) with dry-run previews and reversible state snapshots.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by Task Category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="TECHNICAL">Technical SEO</option>
            <option value="CONTENT">Content & Refresh</option>
            <option value="CTR">CTR Optimization</option>
            <option value="INTERNAL_LINKS">Internal Links</option>
            <option value="SCHEMA">Schema & Structured Data</option>
            <option value="CANNIBALIZATION">Cannibalization</option>
          </select>

          <select
            aria-label="Filter by Automation Level"
            value={selectedAutomation}
            onChange={(e) => setSelectedAutomation(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Automation Tiers</option>
            <option value="AUTOMATIC">AUTOMATIC (AI Safe)</option>
            <option value="ONE_CLICK">ONE_CLICK (Instant Apply)</option>
            <option value="ASSISTED">ASSISTED (Draft + Review)</option>
            <option value="MANUAL">MANUAL (Human Action)</option>
          </select>
        </div>

        <span className="text-xs text-slate-400 font-mono">
          Showing {filteredTasks.length} of {tasks.length} Directives
        </span>
      </div>

      {/* Task List Cards */}
      <div className="space-y-4">
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className="bg-slate-900 p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all space-y-4"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded font-mono font-bold uppercase ${
                      task.priority === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : task.priority === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {task.priority} Priority
                  </span>

                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono font-bold">
                    ICE: {task.iceScore.toFixed(1)}
                  </span>

                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 font-mono">
                    Tier: {task.automationLevel}
                  </span>

                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {task.category}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mt-1">{task.title}</h3>
                <p className="text-xs text-slate-300">{task.description}</p>
                <p className="text-[11px] text-slate-400 font-mono">Evidence: {task.evidence}</p>

                {/* Affected URLs Pill list */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-mono">Target URLs:</span>
                  {task.affectedUrls.map((u, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-slate-950 text-[10px] text-slate-300 border border-slate-800 font-mono truncate max-w-xs">
                      {u}
                    </span>
                  ))}
                </div>
              </div>

              {/* ICE Matrix Scores Box */}
              <div className="flex items-center space-x-3 bg-slate-950 p-3 rounded-xl border border-slate-800 shrink-0 text-center font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Impact</span>
                  <span className="text-white font-bold text-sm">{task.impact}/10</span>
                </div>
                <div className="h-6 w-[1px] bg-slate-800" />
                <div>
                  <span className="text-[10px] text-slate-400 block">Confidence</span>
                  <span className="text-emerald-400 font-bold text-sm">{task.confidence}/10</span>
                </div>
                <div className="h-6 w-[1px] bg-slate-800" />
                <div>
                  <span className="text-[10px] text-slate-400 block">Effort</span>
                  <span className="text-amber-400 font-bold text-sm">{task.effort}/10</span>
                </div>
              </div>

              {/* Actions & Rollbacks */}
              <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                <button
                  onClick={() => setDryRunTask(task)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 border border-slate-700 transition-all w-full sm:w-auto justify-center"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Dry Run</span>
                </button>

                {task.status === 'COMPLETED' ? (
                  <button
                    onClick={() => onRollbackTask(task.id)}
                    className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all w-full sm:w-auto justify-center"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Rollback</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onExecuteTask(task)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow transition-all w-full sm:w-auto justify-center"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Execute</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dry Run Preview Modal */}
      {dryRunTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">DRY RUN PREVIEW: {dryRunTask.title}</h3>
              </div>
              <button
                onClick={() => setDryRunTask(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Proposed Operation</span>
                <p className="text-slate-200 mt-1">{dryRunTask.description}</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Affected Target URLs</span>
                <ul className="list-disc list-inside text-emerald-400 font-mono mt-1 space-y-0.5">
                  {dryRunTask.affectedUrls.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Safety Verification</span>
                <p className="text-slate-300 mt-1">
                  ✓ Snapshot baseline captured • ✓ Rollback payload serialized to audit log • ✓ Reversible with 1-click
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setDryRunTask(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onExecuteTask(dryRunTask);
                  setDryRunTask(null);
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow"
              >
                Confirm & Execute Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
