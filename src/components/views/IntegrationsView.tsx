import React, { useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Zap,
  Globe,
  Database,
  Download,
  Key,
  Shield,
} from 'lucide-react';
import { Website } from '../../types';
import { triggerIntegrationSync, bindGscProperty } from '../../services/api';

interface IntegrationsViewProps {
  website: Website;
  onRefreshIntegrations: () => void;
  onExportCsv: () => void;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
  website,
  onRefreshIntegrations,
  onExportCsv,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      await triggerIntegrationSync(website.id, 'ALL', 'MANUAL_RESYNC');
      setSyncStatusMsg('All integration channels successfully synchronized!');
      onRefreshIntegrations();
    } catch (err: any) {
      setSyncStatusMsg(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const integrationsList = [
    {
      id: 'gsc',
      name: 'Google Search Console API',
      category: 'Search Engine Authority',
      status: website.gscConnected ? 'CONNECTED' : 'DISCONNECTED',
      property: website.gscConnected ? `sc-domain:${website.domain}` : 'No property bound',
      description: 'Fetches real organic click performance, impressions, average SERP rankings, and indexing state.',
      iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      id: 'ga4',
      name: 'Google Analytics 4 Data Stream',
      category: 'Traffic & Conversions',
      status: website.ga4Connected ? 'CONNECTED' : 'DISCONNECTED',
      property: website.ga4Connected ? `GA4-STREAM-${website.domain.replace('.', '-')}` : 'Stream not configured',
      description: 'Monitors real user sessions, bounce rates, engaged sessions, and downstream revenue conversions.',
      iconColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    },
    {
      id: 'wp',
      name: 'WordPress REST API / Headless Sync',
      category: 'CMS Automation',
      status: website.wpConnected ? 'CONNECTED' : 'ACTIVE_REST',
      property: `${website.productionUrl}/wp-json/wp/v2`,
      description: 'Enables 1-click autonomous metadata injection, schema tag updates, and content refresh publication.',
      iconColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    },
    {
      id: 'shopify',
      name: 'Shopify Storefront & Admin GraphQL',
      category: 'E-Commerce Schema',
      status: 'AVAILABLE',
      property: 'Storefront Access Token',
      description: 'Syncs product structured data, rich snippet prices, and canonical product collection redirects.',
      iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      id: 'webhooks',
      name: 'Real-time Autonomous Webhooks',
      category: 'Developer APIs',
      status: 'ARMED',
      property: 'POST https://api.techscale.io/webhooks/seo-audit',
      description: 'Sends real-time payloads to Slack, Discord, or CI/CD pipelines upon algorithmic volatility.',
      iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Integrations & Data Connectors</h2>
          <p className="text-xs text-slate-400">
            Connect live search engine telemetry, CMS automated publishers, and webhook notifications.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Resyncing Channels...' : 'Sync All Integrations'}</span>
          </button>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-xs font-mono">
          {syncStatusMsg}
        </div>
      )}

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrationsList.map((item) => {
          const isConnected = item.status === 'CONNECTED' || item.status === 'ACTIVE_REST' || item.status === 'ARMED';

          return (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-xl border ${item.iconColor}`}>
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{item.name}</h3>
                      <div className="text-[10px] text-slate-500 font-mono">{item.category}</div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                      isConnected
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed font-sans">{item.description}</p>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 font-mono truncate">
                  <span className="text-slate-500">Binding: </span>
                  <span className="text-slate-300">{item.property}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">2-Way Autonomous Sync</span>
                <button
                  onClick={() => alert(`Initiating connection flow for ${item.name}`)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                >
                  Configure
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Export Utility Box */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white">Full SEO Data & Audit Exporter</h3>
          <p className="text-xs text-slate-400">
            Export all ranked keywords, 17-pillar diagnostics, and action timelines in formatted CSV or JSON.
          </p>
        </div>

        <button
          onClick={onExportCsv}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Download Audit CSV</span>
        </button>
      </div>
    </div>
  );
};
