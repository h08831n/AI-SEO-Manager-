import React from 'react';
import {
  Globe,
  Plus,
  Play,
  CheckCircle2,
  ExternalLink,
  Shield,
  Activity,
  Layers,
  ArrowRight,
  Database,
} from 'lucide-react';
import { Website } from '../../types';

interface ProjectsViewProps {
  websites: Website[];
  selectedWebsite: Website;
  onSelectWebsite: (site: Website) => void;
  onOpenAddWebsiteModal: () => void;
  onStartCrawl: (websiteId: string) => void;
  onNavigateTab: (tab: any) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  websites,
  selectedWebsite,
  onSelectWebsite,
  onOpenAddWebsiteModal,
  onStartCrawl,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Managed Websites & Domains</h2>
          <p className="text-xs text-slate-400">
            Multi-tenant domain assets monitored by the autonomous SEO background engine.
          </p>
        </div>

        <button
          onClick={onOpenAddWebsiteModal}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Website</span>
        </button>
      </div>

      {/* Website Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {websites.map((site) => {
          const isSelected = site.id === selectedWebsite?.id;

          return (
            <div
              key={site.id}
              className={`rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-4">
                {/* Card Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-xl border ${isSelected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-mono">{site.domain}</h3>
                      <div className="text-[11px] text-slate-400">{site.name || site.industry}</div>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ACTIVE
                    </span>
                  )}
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                  <span className={`px-2 py-0.5 rounded border ${site.gscConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    GSC: {site.gscConnected ? 'Bound' : 'Disconnected'}
                  </span>
                  <span className={`px-2 py-0.5 rounded border ${site.ga4Connected ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    GA4: {site.ga4Connected ? 'Active' : 'Unset'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {site.defaultLanguage || 'en-US'}
                  </span>
                </div>

                {/* Metadata details */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Production URL:</span>
                    <a
                      href={site.productionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-300 hover:text-emerald-400 flex items-center space-x-1 font-mono truncate max-w-[150px]"
                    >
                      <span className="truncate">{site.productionUrl}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Industry:</span>
                    <span className="text-slate-300 font-medium">{site.industry || 'Technology'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Sitemap:</span>
                    <span className="text-slate-300 font-mono text-[11px] truncate max-w-[150px]">{site.sitemapUrl || 'Auto-Discovered'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => onStartCrawl(site.id)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                >
                  <Play className="w-3 h-3 text-emerald-400" />
                  <span>Start Crawl</span>
                </button>

                {isSelected ? (
                  <button
                    onClick={() => onNavigateTab('dashboard')}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    <span>View Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => onSelectWebsite(site)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                  >
                    Select Site
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
