import React from 'react';
import {
  LayoutDashboard,
  Globe,
  Activity,
  Sparkles,
  Zap,
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Boxes,
  Bot,
  Settings,
  CreditCard,
  ChevronRight,
  Server,
  Layers,
  FileCheck,
} from 'lucide-react';

export type SaaSTabId =
  | 'dashboard'
  | 'projects'
  | 'health'
  | 'recommendations'
  | 'actions'
  | 'keywords'
  | 'analytics'
  | 'competitors'
  | 'integrations'
  | 'copilot'
  | 'settings'
  | 'billing';

interface SidebarProps {
  currentTab: SaaSTabId;
  onSelectTab: (tab: SaaSTabId) => void;
  recommendationsCount?: number;
  activeActionsCount?: number;
  seoScore?: number;
  observabilityStatus?: { db: string; redis: string; worker: string };
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  recommendationsCount = 0,
  activeActionsCount = 0,
  seoScore = 88,
  observabilityStatus = { db: 'UP', redis: 'UP', worker: 'UP' },
}) => {
  const navSections = [
    {
      title: 'CORE ENGINE',
      items: [
        { id: 'dashboard' as SaaSTabId, label: 'Dashboard', icon: LayoutDashboard, shortcut: 'D' },
        { id: 'projects' as SaaSTabId, label: 'Projects & Sites', icon: Globe, badge: 'Active' },
        { id: 'health' as SaaSTabId, label: 'SEO Health (17 Pillars)', icon: Activity, badge: `${seoScore}%` },
        { id: 'recommendations' as SaaSTabId, label: 'AI Recommendations', icon: Sparkles, badge: recommendationsCount > 0 ? String(recommendationsCount) : undefined, badgeColor: 'bg-indigo-500/20 text-indigo-300' },
        { id: 'actions' as SaaSTabId, label: 'Action Timeline', icon: Zap, badge: activeActionsCount > 0 ? String(activeActionsCount) : undefined, badgeColor: 'bg-emerald-500/20 text-emerald-300' },
      ],
    },
    {
      title: 'INTELLIGENCE & SERP',
      items: [
        { id: 'keywords' as SaaSTabId, label: 'Keywords Universe', icon: TrendingUp },
        { id: 'analytics' as SaaSTabId, label: 'Analytics & GSC/GA4', icon: BarChart3 },
        { id: 'competitors' as SaaSTabId, label: 'Competitor Gaps', icon: ShieldAlert },
      ],
    },
    {
      title: 'AUTONOMOUS PLATFORM',
      items: [
        { id: 'integrations' as SaaSTabId, label: 'Integrations', icon: Boxes },
        { id: 'copilot' as SaaSTabId, label: 'AI SEO Copilot', icon: Bot, badge: 'Live AI', badgeColor: 'bg-cyan-500/20 text-cyan-300' },
        { id: 'settings' as SaaSTabId, label: 'Settings & Safety', icon: Settings },
        { id: 'billing' as SaaSTabId, label: 'Billing & Plan', icon: CreditCard, badge: 'Enterprise' },
      ],
    },
  ];

  const isAllSystemsUp = observabilityStatus.db === 'UP' && observabilityStatus.worker === 'UP';

  return (
    <aside className="w-64 flex flex-col bg-slate-950 border-r border-slate-800/80 select-none shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-950/50">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm text-white tracking-tight">AI SEO Manager</span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                v3.2
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Autonomous SEO Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
              {section.title}
            </div>

            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`sidebar-tab-${item.id}`}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-slate-800/90 text-white font-semibold shadow-sm border border-slate-700/80'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                          item.badgeColor || (isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400')
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* System Status & Engine Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 space-y-2">
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[11px]">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isAllSystemsUp ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-300 font-medium font-mono">
              {isAllSystemsUp ? 'Engine Operational' : 'Engine Degradation'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">24/7 Loop</span>
        </div>
      </div>
    </aside>
  );
};
