import React from 'react';
import { Website, SEOHealthState } from '../types';
import {
  Activity,
  Search,
  Zap,
  TrendingUp,
  Cpu,
  FileText,
  Layers,
  Link2,
  GitBranch,
  ShieldCheck,
  Code,
  Terminal,
  Sparkles,
  BarChart3,
  Bot,
  AlertTriangle,
  Play,
} from 'lucide-react';

interface NavigationProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  websites: Website[];
  selectedWebsite: Website;
  onSelectWebsite: (site: Website) => void;
  healthState: SEOHealthState;
  onRunDailyLoop: () => void;
  isLoopRunning: boolean;
  onOpenCopilot: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  setCurrentTab,
  websites,
  selectedWebsite,
  onSelectWebsite,
  healthState,
  onRunDailyLoop,
  isLoopRunning,
  onOpenCopilot,
}) => {
  const navTabs = [
    { id: 'command-center', label: 'Command Center', icon: Terminal, badge: 'Daily' },
    { id: 'health-score', label: 'SEO Health (17 Pillars)', icon: Activity, badge: `${healthState.overallScore}%` },
    { id: 'crawler', label: 'Technical Crawler', icon: Cpu, badge: 'Live' },
    { id: 'gsc-analytics', label: 'Search Console & GA4', icon: BarChart3 },
    { id: 'rank-tracker', label: 'Rankings & Volatility', icon: TrendingUp },
    { id: 'opportunities', label: 'Keyword Opportunities', icon: Zap, badge: '19' },
    { id: 'ctr-optimizer', label: 'CTR Optimizer', icon: Search },
    { id: 'cannibalization', label: 'Cannibalization', icon: AlertTriangle, badge: '2' },
    { id: 'decay-refresh', label: 'Content Decay & Refresh', icon: Layers, badge: '3' },
    { id: 'competitor-gaps', label: 'Competitor Gaps', icon: ShieldCheck },
    { id: 'topic-authority', label: 'Topic Clusters', icon: GitBranch },
    { id: 'internal-links', label: 'Internal Links', icon: Link2, badge: '3' },
    { id: 'content-pipeline', label: 'Content Calendar', icon: FileText },
    { id: 'content-studio', label: 'AI Briefs & Studio', icon: Sparkles },
    { id: 'schema-studio', label: 'Schema JSON-LD', icon: Code },
    { id: 'experiments', label: 'SEO Experiments', icon: Activity },
    { id: 'tasks', label: 'Task Engine (ICE)', icon: ShieldCheck, badge: '5' },
    { id: 'audit-logs', label: 'Audit Trail & Rollback', icon: Terminal },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-md">
      {/* Top Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base tracking-tight text-white">AI SEO MANAGER</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                  Autonomous 24/7
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Autonomous Senior-Level SEO Operating System</p>
            </div>
          </div>

          {/* Website Switcher */}
          <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <span className="text-xs text-slate-400">Target Site:</span>
            <select
              aria-label="Select Target Website"
              value={selectedWebsite.id}
              onChange={(e) => {
                const found = websites.find((w) => w.id === e.target.value);
                if (found) onSelectWebsite(found);
              }}
              className="bg-transparent text-xs text-emerald-300 font-semibold focus:outline-none cursor-pointer"
            >
              {websites.map((site) => (
                <option key={site.id} value={site.id} className="bg-slate-900 text-slate-200">
                  {site.domain} ({site.industry})
                </option>
              ))}
            </select>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center space-x-3">
            {/* Run 42-Step Daily Loop */}
            <button
              id="btn-run-autonomous-loop"
              onClick={onRunDailyLoop}
              disabled={isLoopRunning}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition-all ${
                isLoopRunning
                  ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
              }`}
            >
              <Play className={`h-3.5 w-3.5 ${isLoopRunning ? 'animate-spin' : ''}`} />
              <span>{isLoopRunning ? 'Executing 42-Step Loop...' : 'Execute Daily SEO Loop'}</span>
            </button>

            {/* AI SEO Copilot Trigger */}
            <button
              id="btn-open-copilot"
              onClick={onOpenCopilot}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>SEO Copilot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Scrollable Tabs */}
      <div className="bg-slate-950/80 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8 overflow-x-auto scrollbar-none">
        <div className="flex space-x-1 py-1.5 min-w-max">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
