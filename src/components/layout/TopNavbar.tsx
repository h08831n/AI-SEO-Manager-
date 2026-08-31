import React, { useState } from 'react';
import {
  Globe,
  Plus,
  Search,
  Sparkles,
  Play,
  Bell,
  User,
  ChevronDown,
  Building2,
  Check,
  Shield,
  Key,
  LogOut,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Website } from '../../types';

interface TopNavbarProps {
  websites: Website[];
  selectedWebsite: Website;
  onSelectWebsite: (site: Website) => void;
  onOpenAddWebsiteModal: () => void;
  onOpenCommandPalette: () => void;
  onOpenCopilot: () => void;
  onRunDailyLoop: () => void;
  isLoopRunning: boolean;
  activeWorkspaceName?: string;
  onSelectWorkspace?: (wsId: string) => void;
  systemAlertsCount?: number;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  websites,
  selectedWebsite,
  onSelectWebsite,
  onOpenAddWebsiteModal,
  onOpenCommandPalette,
  onOpenCopilot,
  onRunDailyLoop,
  isLoopRunning,
  activeWorkspaceName = 'TechScale Global Org',
  systemAlertsCount = 2,
}) => {
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);

  const workspaces = [
    { id: 'ws-techscale-org', name: 'TechScale Global Org', tier: 'Enterprise Plan', current: true },
    { id: 'ws-growth-ventures', name: 'Acme Media Labs', tier: 'Pro Plan', current: false },
    { id: 'ws-client-portfolio', name: 'Agency Client Suite', tier: 'Scale Plan', current: false },
  ];

  return (
    <header className="sticky top-0 z-30 h-14 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-md px-4 flex items-center justify-between select-none">
      {/* Left: Workspace & Website Selectors */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Workspace Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen);
              setIsSiteDropdownOpen(false);
              setIsUserDropdownOpen(false);
              setIsAlertsOpen(false);
            }}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 transition-all cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="max-w-[130px] truncate">{activeWorkspaceName}</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {isWorkspaceDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-60 rounded-xl bg-slate-900 border border-slate-800 shadow-xl p-1.5 space-y-1 z-50 animate-in fade-in zoom-in-95">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Workspaces
              </div>
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  onClick={() => setIsWorkspaceDropdownOpen(false)}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer ${
                    ws.current ? 'bg-indigo-500/10 text-indigo-300 font-semibold' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-medium">{ws.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{ws.tier}</div>
                  </div>
                  {ws.current && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <span className="text-slate-700">/</span>

        {/* Website Selector */}
        <div className="relative">
          <button
            onClick={() => {
              setIsSiteDropdownOpen(!isSiteDropdownOpen);
              setIsWorkspaceDropdownOpen(false);
              setIsUserDropdownOpen(false);
              setIsAlertsOpen(false);
            }}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-emerald-400 transition-all cursor-pointer font-mono"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="max-w-[140px] truncate">{selectedWebsite?.domain || 'Select Site'}</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {isSiteDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-72 rounded-xl bg-slate-900 border border-slate-800 shadow-xl p-1.5 space-y-1 z-50 animate-in fade-in zoom-in-95">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Managed Domains ({websites.length})
              </div>

              <div className="max-h-56 overflow-y-auto space-y-0.5">
                {websites.map((site) => {
                  const isCurrent = site.id === selectedWebsite?.id;
                  return (
                    <div
                      key={site.id}
                      onClick={() => {
                        onSelectWebsite(site);
                        setIsSiteDropdownOpen(false);
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer ${
                        isCurrent
                          ? 'bg-emerald-500/10 text-emerald-300 font-semibold'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <div className={`w-1.5 h-1.5 rounded-full ${site.gscConnected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                        <span className="font-mono truncate">{site.domain}</span>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>

              <div className="pt-1.5 border-t border-slate-800">
                <button
                  onClick={() => {
                    setIsSiteDropdownOpen(false);
                    onOpenAddWebsiteModal();
                  }}
                  className="w-full flex items-center space-x-2 p-2 rounded-lg text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Domain...</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Command Palette Trigger */}
      <button
        onClick={onOpenCommandPalette}
        className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-all cursor-pointer shadow-inner w-64 justify-between"
      >
        <div className="flex items-center space-x-2">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <span>Quick actions & search...</span>
        </div>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
          ⌘K
        </kbd>
      </button>

      {/* Right: Actions, Alerts & User Profile */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Daily Autonomous SEO Loop CTA */}
        <button
          onClick={onRunDailyLoop}
          disabled={isLoopRunning}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer ${
            isLoopRunning
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
          }`}
        >
          <Play className={`w-3.5 h-3.5 ${isLoopRunning ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isLoopRunning ? 'Continuous Loop Running...' : 'Execute Daily SEO Loop'}</span>
          <span className="sm:hidden">{isLoopRunning ? 'Running' : 'Run'}</span>
        </button>

        {/* AI Copilot Drawer Button */}
        <button
          onClick={onOpenCopilot}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-950/40 transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">AI Copilot</span>
        </button>

        {/* Alerts Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setIsAlertsOpen(!isAlertsOpen);
              setIsWorkspaceDropdownOpen(false);
              setIsSiteDropdownOpen(false);
              setIsUserDropdownOpen(false);
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all cursor-pointer relative"
          >
            <Bell className="w-4 h-4" />
            {systemAlertsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-950" />
            )}
          </button>

          {isAlertsOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-80 rounded-xl bg-slate-900 border border-slate-800 shadow-xl p-3 space-y-2 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">System Alerts</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-semibold">
                  {systemAlertsCount} Active
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-amber-400">
                    <span>Rank Volatility Detected</span>
                    <span className="text-[10px] text-slate-500">10m ago</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    2 commercial queries dropped outside Top 3 following algorithmic update.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-emerald-400">
                    <span>Bayesian Rule Confidence High</span>
                    <span className="text-[10px] text-slate-500">1h ago</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Canonical consolidation verified with +14.2% organic CTR lift.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setIsUserDropdownOpen(!isUserDropdownOpen);
              setIsWorkspaceDropdownOpen(false);
              setIsSiteDropdownOpen(false);
              setIsAlertsOpen(false);
            }}
            className="flex items-center space-x-2 p-1 pl-1.5 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center font-mono">
              HN
            </div>
            <ChevronDown className="w-3 h-3 text-slate-500 hidden sm:block" />
          </button>

          {isUserDropdownOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-64 rounded-xl bg-slate-900 border border-slate-800 shadow-xl p-2 space-y-1 z-50 animate-in fade-in zoom-in-95 text-xs">
              <div className="p-2.5 border-b border-slate-800">
                <div className="font-bold text-white">Hossein N.</div>
                <div className="text-[11px] text-slate-400 font-mono">hosseinnaghneh1@gmail.com</div>
                <div className="mt-1.5 inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                  <Shield className="w-2.5 h-2.5" />
                  <span>Senior SEO Architect (Owner)</span>
                </div>
              </div>

              <button
                onClick={() => setIsUserDropdownOpen(false)}
                className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>API Keys & Security Tokens</span>
              </button>

              <button
                onClick={() => setIsUserDropdownOpen(false)}
                className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Tenant Isolation Settings</span>
              </button>

              <div className="pt-1 border-t border-slate-800">
                <button
                  onClick={() => setIsUserDropdownOpen(false)}
                  className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Switch Workspace / Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
