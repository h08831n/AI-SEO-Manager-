import React from 'react';
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
  ArrowRight,
} from 'lucide-react';
import { SEOAgent, AgentRole } from '../types';

interface AgentSwarmPulseProps {
  agents: SEOAgent[];
  onSelectAgent?: (agentId: string) => void;
  onNavigateToAgents?: () => void;
}

export const AgentSwarmPulse: React.FC<AgentSwarmPulseProps> = ({
  agents,
  onSelectAgent,
  onNavigateToAgents,
}) => {
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
        return { label: 'Analyzing', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
      case 'EXECUTING':
        return { label: 'Executing', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'MONITORING':
        return { label: 'Monitoring', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' };
      case 'LEARNING':
        return { label: 'Learning', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      default:
        return { label: 'Active', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Virtual SEO Department Swarm
              </h3>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              6 Specialized AI Agents working simultaneously on your website
            </p>
          </div>
        </div>

        {onNavigateToAgents && (
          <button
            onClick={onNavigateToAgents}
            className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors self-start sm:self-center cursor-pointer"
          >
            <span>Agent Performance & Diagnostics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Grid of 6 agents */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((agent) => {
          const Icon = getAgentIcon(agent.role);
          const badge = getStatusBadge(agent.status);

          return (
            <div
              key={agent.id}
              onClick={() => onSelectAgent?.(agent.id)}
              className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className={`w-8 h-8 rounded-lg ${agent.avatarColor} flex items-center justify-center text-white shadow-sm shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                      {agent.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {agent.title}
                    </p>
                  </div>
                </div>

                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${badge.color}`}>
                  {badge.label}
                </span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] text-slate-300 line-clamp-1">
                  <span className="text-slate-500 font-mono">Task: </span>
                  {agent.currentTask}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>{agent.issuesSolvedCount} issues fixed</span>
                  <span className="text-emerald-400 font-semibold">{agent.successRate}% success</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
