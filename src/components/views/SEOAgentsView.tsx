import React, { useState } from 'react';
import {
  Bot,
  Wrench,
  FileText,
  TrendingUp,
  ShieldAlert,
  Activity,
  Layers,
  CheckCircle2,
  Cpu,
  Zap,
  Play,
  RotateCcw,
  Sparkles,
  Terminal,
  Shield,
  Clock,
  Send,
  Sliders,
  ChevronRight,
  Database,
} from 'lucide-react';
import { SEOAgent, AgentRole, Website } from '../../types';

interface SEOAgentsViewProps {
  website: Website;
  agents: SEOAgent[];
  onTriggerAgentTask: (agentId: string) => void;
  onOpenCopilotWithAgent: (agentName: string, context: string) => void;
}

export const SEOAgentsView: React.FC<SEOAgentsViewProps> = ({
  website,
  agents,
  onTriggerAgentTask,
  onOpenCopilotWithAgent,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || 'agent-1');
  const [delegatePrompt, setDelegatePrompt] = useState('');
  const [isDelegating, setIsDelegating] = useState(false);
  const [delegationSuccess, setDelegationSuccess] = useState(false);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  const getAgentIcon = (role: AgentRole) => {
    switch (role) {
      case 'TECHNICAL_AGENT':
        return Wrench;
      case 'CONTENT_STRATEGY_AGENT':
        return FileText;
      case 'GROWTH_AGENT':
        return TrendingUp;
      case 'COMPETITOR_AGENT':
        return ShieldAlert;
      case 'AUDITOR_AGENT':
        return Activity;
      case 'AUTOMATION_MANAGER':
        return Layers;
      default:
        return Bot;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ANALYZING':
        return { label: 'Analyzing DOM', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
      case 'EXECUTING':
        return { label: 'Executing Mutation', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'MONITORING':
        return { label: 'Monitoring SERP', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' };
      case 'LEARNING':
        return { label: 'Calibrating Posterior', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      default:
        return { label: 'Idle / Ready', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
    }
  };

  const handleDelegate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegatePrompt.trim()) return;
    setIsDelegating(true);
    setTimeout(() => {
      setIsDelegating(false);
      setDelegationSuccess(true);
      setTimeout(() => {
        setDelegationSuccess(false);
        setDelegatePrompt('');
      }, 3000);
    }, 800);
  };

  const SelectedIcon = selectedAgent ? getAgentIcon(selectedAgent.role) : Bot;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              VIRTUAL SEO DEPARTMENT
            </span>
            <span className="text-xs text-slate-400 font-mono">
              6 Swarm Sub-Agents Active for {website.domain}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            SEO Agent Performance & Swarm Diagnostics
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Each AI agent possesses specialized responsibilities, Bayesian learning weights, autonomous execution permissions, and 6-stage verification loops.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenCopilotWithAgent('Autonomous Swarm', `Provide an executive swarm review across all 6 agents for ${website.domain}`)}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Swarm Intelligence Briefing</span>
          </button>
        </div>
      </div>

      {/* Agents Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const Icon = getAgentIcon(agent.role);
          const badge = getStatusBadge(agent.status);
          const isSelected = agent.id === selectedAgentId;

          return (
            <div
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-slate-900/95 border-emerald-500/60 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/40'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/90'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full pointer-events-none" />
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl ${agent.avatarColor} flex items-center justify-center text-white shadow-md shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      {agent.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      {agent.title}
                    </p>
                  </div>
                </div>

                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${badge.color}`}>
                  {badge.label}
                </span>
              </div>

              <p className="text-xs text-slate-300 mt-3 line-clamp-2 leading-relaxed">
                {agent.description}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                <div className="text-[11px] text-slate-300">
                  <span className="text-slate-500 font-mono">Active Task: </span>
                  <span className="font-medium text-slate-200">{agent.currentTask}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Solved</div>
                    <div className="text-xs font-bold text-white mt-0.5">{agent.issuesSolvedCount}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Success</div>
                    <div className="text-xs font-bold text-emerald-400 mt-0.5">{agent.successRate}%</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60">
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Learning</div>
                    <div className="text-xs font-bold text-indigo-400 mt-0.5">{agent.learningProgress}%</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Agent Drilldown & Terminal Stream */}
      {selectedAgent && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Inspector & Delegation Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl ${selectedAgent.avatarColor} flex items-center justify-center text-white shadow-md`}>
                  <SelectedIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {selectedAgent.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedAgent.title}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="text-slate-400 font-semibold uppercase tracking-wider font-mono text-[10px]">
                  Governed SEO Pillars
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAgent.activePillars.map((pillar) => (
                    <span
                      key={pillar}
                      className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-mono"
                    >
                      {pillar}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Bayesian Posterior Calibration</span>
                  <span className="font-mono text-emerald-400 font-bold">{selectedAgent.learningProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${selectedAgent.learningProgress}%` }}
                  />
                </div>
              </div>

              {/* Delegate Custom Task Form */}
              <form onSubmit={handleDelegate} className="pt-3 border-t border-slate-800 space-y-2.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Bot className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Delegate Direct Objective</span>
                </label>
                <textarea
                  value={delegatePrompt}
                  onChange={(e) => setDelegatePrompt(e.target.value)}
                  placeholder={`e.g., "Scan all /pricing paths for missing self-referencing canonicals"`}
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                />
                <div className="flex items-center justify-between">
                  <button
                    type="submit"
                    disabled={isDelegating || !delegatePrompt.trim()}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isDelegating ? 'Assigning...' : 'Dispatch Task'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onTriggerAgentTask(selectedAgent.id)}
                    className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>Run Routine</span>
                  </button>
                </div>

                {delegationSuccess && (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Task dispatched into background execution queue!</span>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Real-time Agent Activity Stream & Terminal */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    {selectedAgent.name} Live Activity Log & Reasoning Stream
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  Updated {selectedAgent.lastActivityTimestamp}
                </span>
              </div>

              {/* Terminal log window */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-xs space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
                {selectedAgent.recentLogs.map((log, i) => (
                  <div key={i} className="flex items-start space-x-2 text-slate-300">
                    <span className="text-slate-600 select-none">&gt;</span>
                    <span className={log.includes('VERIFIED') || log.includes('Success') ? 'text-emerald-400' : log.includes('Anomaly') || log.includes('Risk') ? 'text-amber-400' : 'text-slate-300'}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>

              {/* Verification & Rollback Safeguard Box */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2.5">
                  <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-slate-300">
                    Governed by 6-Stage Automated Verification & Zero-Downtime Rollback Engine.
                  </span>
                </div>
                <button
                  onClick={() => onOpenCopilotWithAgent(selectedAgent.name, `Explain recent actions and verification logs for ${selectedAgent.name}`)}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold whitespace-nowrap cursor-pointer"
                >
                  Inspect Agent Audit Trail &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
