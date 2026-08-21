import React, { useState, useEffect } from 'react';
import { Website } from '../types';
import {
  BarChart3,
  Globe,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Link2,
  Settings2,
  XCircle,
  Unlink,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface SearchConsoleAnalyticsProps {
  website: Website;
}

export const SearchConsoleAnalytics: React.FC<SearchConsoleAnalyticsProps> = ({ website }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '28d' | '3m' | '6m' | '12m'>('28d');
  const [activeDimension, setActiveDimension] = useState<
    'QUERIES' | 'PAGES' | 'GAINERS_DECLINERS' | 'STRIKING_DISTANCE' | 'SYNC_LOGS'
  >('QUERIES');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [liveData, setLiveData] = useState<any>(null);
  const [syncRuns, setSyncRuns] = useState<any[]>([]);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [gscProperties, setGscProperties] = useState<any[]>([]);
  const [ga4Properties, setGa4Properties] = useState<any[]>([]);
  const [currentGscBinding, setCurrentGscBinding] = useState<any>(null);
  const [currentGa4Binding, setCurrentGa4Binding] = useState<any>(null);
  const [selectedGscProp, setSelectedGscProp] = useState('');
  const [selectedGa4Prop, setSelectedGa4Prop] = useState('');
  const [bindingGsc, setBindingGsc] = useState(false);
  const [bindingGa4, setBindingGa4] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch performance data
  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let days = 28;
      if (selectedPeriod === '7d') days = 7;
      else if (selectedPeriod === '28d') days = 28;
      else if (selectedPeriod === '3m') days = 90;
      else if (selectedPeriod === '6m') days = 180;
      else if (selectedPeriod === '12m') days = 365;

      const endDate = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
      const startDate = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0];

      const res = await fetch(`/api/websites/${website.id}/analytics/performance?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        setLiveData(data);
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: `Failed to fetch performance data: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncRuns = async () => {
    try {
      const res = await fetch(`/api/websites/${website.id}/sync-runs`);
      if (res.ok) {
        const data = await res.json();
        setSyncRuns(data.syncRuns || []);
      }
    } catch {
      // Ignore
    }
  };

  // Fetch discoverable properties for modal
  const fetchDiscoverableProperties = async () => {
    setLoadingProperties(true);
    try {
      const [gscRes, ga4Res] = await Promise.all([
        fetch(`/api/websites/${website.id}/gsc/properties`),
        fetch(`/api/websites/${website.id}/ga4/properties`),
      ]);

      if (gscRes.ok) {
        const gscData = await gscRes.json();
        setGscProperties(gscData.properties || []);
        setCurrentGscBinding(gscData.currentBinding || null);
        if (gscData.currentBinding?.providerPropertyId) {
          setSelectedGscProp(gscData.currentBinding.providerPropertyId);
        }
      }

      if (ga4Res.ok) {
        const ga4Data = await ga4Res.json();
        setGa4Properties(ga4Data.properties || []);
        setCurrentGa4Binding(ga4Data.currentBinding || null);
        if (ga4Data.currentBinding?.providerPropertyId) {
          setSelectedGa4Prop(ga4Data.currentBinding.providerPropertyId);
        }
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: `Failed to discover properties: ${err.message}` });
    } finally {
      setLoadingProperties(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
    fetchSyncRuns();
  }, [website.id, selectedPeriod]);

  // Trigger manual sync
  const handleTriggerSync = async () => {
    setSyncing(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/websites/${website.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'ALL', syncType: 'MANUAL_RESYNC' }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Sync job enqueued in background. Ingesting live data...' });
        // Poll sync-runs and performance
        setTimeout(() => {
          fetchPerformanceData();
          fetchSyncRuns();
        }, 2000);
      } else {
        setFeedbackMsg({ type: 'error', text: data.message || 'Sync failed.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Sync failed.' });
    } finally {
      setSyncing(false);
    }
  };

  // Google OAuth connect flow
  const handleConnectGoogle = async () => {
    try {
      const res = await fetch(`/api/integrations/google/auth-url?websiteId=${website.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else if (data.status === 'NOT_CONFIGURED') {
          setFeedbackMsg({
            type: 'error',
            text: 'Google OAuth Client credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are not configured in .env',
          });
        }
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Failed to initiate Google OAuth.' });
    }
  };

  // Bind GSC Property
  const handleBindGsc = async () => {
    if (!selectedGscProp) return;
    setBindingGsc(true);
    try {
      const propObj = gscProperties.find((p) => p.siteUrl === selectedGscProp);
      const res = await fetch(`/api/websites/${website.id}/gsc/bind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedGscProp,
          permissionLevel: propObj?.permissionLevel || 'siteOwner',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: `Search Console property '${selectedGscProp}' successfully bound and initial sync queued.` });
        setCurrentGscBinding(data.binding);
        fetchPerformanceData();
        fetchSyncRuns();
      } else {
        setFeedbackMsg({ type: 'error', text: data.message || 'Failed to bind Search Console property.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setBindingGsc(false);
    }
  };

  // Bind GA4 Property
  const handleBindGa4 = async () => {
    if (!selectedGa4Prop) return;
    setBindingGa4(true);
    try {
      const propObj = ga4Properties.find((p) => p.propertyId === selectedGa4Prop);
      const res = await fetch(`/api/websites/${website.id}/ga4/bind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedGa4Prop,
          accountId: propObj?.accountId,
          accountName: propObj?.accountName,
          displayName: propObj?.displayName,
          timeZone: propObj?.timeZone,
          currencyCode: propObj?.currencyCode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: `Google Analytics 4 property '${propObj?.displayName || selectedGa4Prop}' successfully bound and initial sync queued.` });
        setCurrentGa4Binding(data.binding);
        fetchPerformanceData();
        fetchSyncRuns();
      } else {
        setFeedbackMsg({ type: 'error', text: data.message || 'Failed to bind GA4 property.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setBindingGa4(false);
    }
  };

  // Disconnect Google
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Search Console and GA4 for this website? Stored credentials will be removed.')) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/websites/${website.id}/google/disconnect`, {
        method: 'POST',
      });
      if (res.ok) {
        setFeedbackMsg({ type: 'success', text: 'Google integration disconnected successfully.' });
        setIsManageModalOpen(false);
        fetchPerformanceData();
        fetchSyncRuns();
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setDisconnecting(false);
    }
  };

  // Status variables
  const isConnected = liveData?.integrationStatus === 'CONNECTED';
  const connectedAccount = liveData?.connectedAccount;
  const gscBound = Boolean(liveData?.gscBound);
  const ga4Bound = Boolean(liveData?.ga4Bound);

  // Exact data from database (no fake fallback numbers!)
  const hasGscTotals = liveData?.gscTotals !== null && liveData?.gscTotals !== undefined;
  const hasGa4Totals = liveData?.ga4Totals !== null && liveData?.ga4Totals !== undefined;

  const totalClicks: number = liveData?.gscTotals?.totalClicks ?? 0;
  const totalImpressions: number = liveData?.gscTotals?.totalImpressions ?? 0;
  const avgCtr: number = liveData?.gscTotals?.weightedCtr ?? 0;
  const avgPosition: number = liveData?.gscTotals?.weightedPosition ?? 0;

  const ga4Sessions: number = liveData?.ga4Totals?.totalSessions ?? 0;
  const ga4Revenue: number = liveData?.ga4Totals?.totalRevenue ?? 0;
  const ga4Conversions: number = liveData?.ga4Totals?.keyEvents ?? 0;

  const trendData: any[] = liveData?.timeSeries ?? [];
  const queriesData: any[] = liveData?.topQueries ?? [];
  const pagesData: any[] = liveData?.topPages ?? [];

  const gainers = liveData?.comparison?.gainers ?? [];
  const decliners = liveData?.comparison?.decliners ?? [];
  const strikingDistance = liveData?.comparison?.strikingDistanceKeywords ?? [];

  const latestSyncRun = syncRuns.length > 0 ? syncRuns[0] : null;
  const isLatestSyncFailed = latestSyncRun && latestSyncRun.status === 'FAILED';

  return (
    <div className="space-y-6" id="gsc-analytics-container">
      {/* Feedback Toast */}
      {feedbackMsg && (
        <div
          id="feedback-toast"
          className={`p-3 rounded-lg text-xs font-medium border flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button id="close-feedback-btn" onClick={() => setFeedbackMsg(null)} className="ml-4 opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4" id="analytics-header">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono mb-1">
            <div className="flex items-center space-x-1 text-emerald-400">
              <BarChart3 className="h-4 w-4" />
              <span>SEARCH CONSOLE & GA4 ENGINE</span>
            </div>
            {isConnected ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>CONNECTED: {connectedAccount || 'Google Account'}</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                STATUS: NOT CONFIGURED
              </span>
            )}
            {/* Independent Provider Badges */}
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                gscBound
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              GSC: {gscBound ? 'BOUND' : 'NOT BOUND'}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                ga4Bound
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              GA4: {ga4Bound ? 'BOUND' : 'NOT BOUND'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Search Performance & Conversion Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Strictly ingests verified Google Search Console performance facts and GA4 landing page conversions with automated signal detection.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector Tabs */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800" id="period-selector">
            {(['7d', '28d', '3m', '6m', '12m'] as const).map((period) => (
              <button
                key={period}
                id={`period-btn-${period}`}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 rounded text-xs font-semibold uppercase transition-all ${
                  selectedPeriod === period
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Manage Properties Button */}
          {isConnected && (
            <button
              id="manage-properties-btn"
              onClick={() => {
                setIsManageModalOpen(true);
                fetchDiscoverableProperties();
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-all"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>Properties</span>
            </button>
          )}

          {/* Connect / Sync Buttons */}
          {!isConnected ? (
            <button
              id="connect-google-btn"
              onClick={handleConnectGoogle}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow flex items-center space-x-1.5 transition-all"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>Connect Google</span>
            </button>
          ) : (
            <button
              id="sync-now-btn"
              onClick={handleTriggerSync}
              disabled={syncing}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow flex items-center space-x-1.5 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-white' : ''}`} />
              <span>{syncing ? 'Queuing Sync...' : 'Sync Now'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Failure Banner if applicable */}
      {isLatestSyncFailed && (
        <div id="sync-failure-banner" className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold">Sync Ingestion Alert:</span> The last synchronization run ({latestSyncRun?.provider} - {latestSyncRun?.dataset}) encountered an error:{' '}
              <span className="font-mono text-rose-200">{latestSyncRun?.errorDetails || 'Unknown provider error'}</span>
            </div>
          </div>
          <button
            id="retry-sync-btn"
            onClick={handleTriggerSync}
            className="px-3 py-1 bg-rose-900 hover:bg-rose-800 text-white rounded font-medium text-xs ml-4 shrink-0"
          >
            Retry Ingestion
          </button>
        </div>
      )}

      {/* Unconfigured State Prompt */}
      {!isConnected && (
        <div id="not-configured-card" className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
            <Globe className="h-6 w-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-white">Google Integration Not Configured</h3>
            <p className="text-xs text-slate-400">
              Connect your verified Google Search Console and Google Analytics 4 accounts to unlock live search queries, landing page clicks, impression rankings, and conversion attribution.
            </p>
          </div>
          <button
            id="connect-google-hero-btn"
            onClick={handleConnectGoogle}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow inline-flex items-center space-x-2"
          >
            <Link2 className="h-4 w-4" />
            <span>Connect Search Console & GA4</span>
          </button>
        </div>
      )}

      {/* Connected but Unbound State Prompt */}
      {isConnected && (!gscBound || !ga4Bound) && (
        <div id="unbound-warning-card" className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Property Binding Incomplete:</span> Google OAuth is connected, but{' '}
              {!gscBound && !ga4Bound
                ? 'neither GSC nor GA4 properties are bound.'
                : !gscBound
                ? 'Search Console property is not bound.'
                : 'Google Analytics 4 property is not bound.'}
            </div>
          </div>
          <button
            id="bind-properties-banner-btn"
            onClick={() => {
              setIsManageModalOpen(true);
              fetchDiscoverableProperties();
            }}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium text-xs ml-4 shrink-0"
          >
            Select Properties
          </button>
        </div>
      )}

      {/* 4 Core Measured Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" id="summary-cards-grid">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800" id="card-total-clicks">
          <span className="text-xs text-slate-400 font-medium">Total Clicks</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-white font-mono">{totalClicks.toLocaleString()}</span>
            {liveData?.comparison?.gsc?.clicks?.percentChange !== undefined && (
              <span
                className={`text-xs font-semibold ${
                  liveData.comparison.gsc.clicks.percentChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {liveData.comparison.gsc.clicks.percentChange >= 0 ? '+' : ''}
                {liveData.comparison.gsc.clicks.percentChange}%
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>Authoritative GSC SITE_DAILY</span>
            {hasGscTotals && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded">
                MEASURED
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800" id="card-total-impressions">
          <span className="text-xs text-slate-400 font-medium">Total Impressions</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-white font-mono">{totalImpressions.toLocaleString()}</span>
            {liveData?.comparison?.gsc?.impressions?.percentChange !== undefined && (
              <span
                className={`text-xs font-semibold ${
                  liveData.comparison.gsc.impressions.percentChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {liveData.comparison.gsc.impressions.percentChange >= 0 ? '+' : ''}
                {liveData.comparison.gsc.impressions.percentChange}%
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>Organic search reach</span>
            {hasGscTotals && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded">
                MEASURED
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800" id="card-weighted-ctr">
          <span className="text-xs text-slate-400 font-medium">Weighted CTR</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-white font-mono">{avgCtr.toFixed(2)}%</span>
            <span className="text-xs font-mono text-slate-400">Avg Pos: {avgPosition.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>Weighted clicks / impressions</span>
            {hasGscTotals && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded">
                CALCULATED
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800" id="card-ga4-conversions">
          <span className="text-xs text-slate-400 font-medium">GA4 Conversions & Organic Reach</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-bold text-emerald-400 font-mono">${ga4Revenue.toLocaleString()}</span>
            <span className="text-xs font-semibold text-emerald-400">{ga4Conversions} conv</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
            <span>{ga4Sessions.toLocaleString()} Organic Search sessions</span>
            {hasGa4Totals && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded">
                GA4_ORGANIC
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Chart: Historical Performance Curve */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4" id="trend-chart-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white tracking-tight">Organic Search Trendline (Trailing {selectedPeriod})</h2>
          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="flex items-center space-x-1 text-emerald-400">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Clicks</span>
            </div>
            <div className="flex items-center space-x-1 text-sky-400">
              <div className="h-2 w-2 rounded-full bg-sky-400" />
              <span>Impressions</span>
            </div>
          </div>
        </div>

        {trendData.length > 0 ? (
          <div className="h-64 w-full" id="area-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Area type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 w-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-2 border border-dashed border-slate-800 rounded-lg" id="chart-no-data">
            <BarChart3 className="h-8 w-8 text-slate-600" />
            <span>{isConnected ? 'No trendline data recorded for this period. Trigger a sync to ingest facts.' : 'Connect Google Search Console to view daily search performance curves.'}</span>
          </div>
        )}
      </div>

      {/* Dimension Selector Tabs */}
      <div className="flex flex-wrap items-center space-x-2 border-b border-slate-800 pb-2" id="dimension-tabs">
        <button
          id="tab-queries"
          onClick={() => setActiveDimension('QUERIES')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeDimension === 'QUERIES'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Top Queries ({queriesData.length})
        </button>
        <button
          id="tab-pages"
          onClick={() => setActiveDimension('PAGES')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeDimension === 'PAGES'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Landing Pages ({pagesData.length})
        </button>
        <button
          id="tab-gainers-decliners"
          onClick={() => setActiveDimension('GAINERS_DECLINERS')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeDimension === 'GAINERS_DECLINERS'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Gainers & Decliners
        </button>
        <button
          id="tab-striking-distance"
          onClick={() => setActiveDimension('STRIKING_DISTANCE')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeDimension === 'STRIKING_DISTANCE'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Striking Distance ({strikingDistance.length})
        </button>
        <button
          id="tab-sync-logs"
          onClick={() => setActiveDimension('SYNC_LOGS')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeDimension === 'SYNC_LOGS'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Sync Audit Runs ({syncRuns.length})
        </button>
      </div>

      {/* Dimension Tables */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden" id="dimension-content-panel">
        {/* 1. TOP QUERIES */}
        {activeDimension === 'QUERIES' && (
          <div className="overflow-x-auto" id="table-queries-wrapper">
            <table className="w-full text-left border-collapse text-xs" id="table-queries">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="py-2.5 px-4">Search Query</th>
                  <th className="py-2.5 px-4 text-right">Clicks</th>
                  <th className="py-2.5 px-4 text-right">Impressions</th>
                  <th className="py-2.5 px-4 text-right">Weighted CTR</th>
                  <th className="py-2.5 px-4 text-right">Avg Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {queriesData.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-850 transition-colors">
                    <td className="py-3 px-4 font-medium text-emerald-400 font-mono">{row.query}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">{row.clicks.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">{row.impressions.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">{row.ctr}%</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">{row.avgPosition || row.position}</td>
                  </tr>
                ))}
                {queriesData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      {isConnected
                        ? 'No search queries recorded for this period. Click "Sync Now" to pull data.'
                        : 'Connect Google Search Console to ingest query performance facts.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. LANDING PAGES */}
        {activeDimension === 'PAGES' && (
          <div className="overflow-x-auto" id="table-pages-wrapper">
            <table className="w-full text-left border-collapse text-xs" id="table-pages">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="py-2.5 px-4">Landing Page Path</th>
                  <th className="py-2.5 px-4">Identity Link Status</th>
                  <th className="py-2.5 px-4 text-right">Clicks</th>
                  <th className="py-2.5 px-4 text-right">Impressions</th>
                  <th className="py-2.5 px-4 text-right">CTR</th>
                  <th className="py-2.5 px-4 text-right">Avg Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {pagesData.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-850 transition-colors">
                    <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">{row.pageUrl || row.page}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          row.urlIdentityId
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {row.urlIdentityId ? 'IDENTITY_LINKED' : 'UNLINKED_URL'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">{row.clicks.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">{row.impressions.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono">{row.ctr}%</td>
                    <td className="py-3 px-4 text-right font-mono">{row.avgPosition || row.position}</td>
                  </tr>
                ))}
                {pagesData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {isConnected
                        ? 'No landing page analytics recorded for this period. Click "Sync Now" to pull data.'
                        : 'Connect Google Search Console to ingest page metrics.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. GAINERS & DECLINERS */}
        {activeDimension === 'GAINERS_DECLINERS' && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6" id="gainers-decliners-view">
            <div>
              <h3 className="text-xs font-bold font-mono text-emerald-400 mb-3 flex items-center space-x-1">
                <TrendingUp className="h-4 w-4" />
                <span>TOP GAINING QUERIES (PERIOD OVER PERIOD)</span>
              </h3>
              <div className="space-y-2">
                {gainers.length > 0 ? (
                  gainers.map((g: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-emerald-900/40 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-white font-mono">{g.query}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {g.previousClicks} → {g.currentClicks} clicks (Pos: {g.currentPos})
                        </div>
                      </div>
                      <span className="font-bold font-mono text-emerald-400">+{g.clicksDiff} clicks</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 text-xs py-4 text-center border border-dashed border-slate-800 rounded">
                    No query gains detected in this comparison window.
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold font-mono text-rose-400 mb-3 flex items-center space-x-1">
                <TrendingDown className="h-4 w-4" />
                <span>TOP DECLINING QUERIES (PERIOD OVER PERIOD)</span>
              </h3>
              <div className="space-y-2">
                {decliners.length > 0 ? (
                  decliners.map((d: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-rose-900/40 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-white font-mono">{d.query}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {d.previousClicks} → {d.currentClicks} clicks (Pos: {d.currentPos})
                        </div>
                      </div>
                      <span className="font-bold font-mono text-rose-400">{d.clicksDiff} clicks</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 text-xs py-4 text-center border border-dashed border-slate-800 rounded">
                    No significant query drops detected in this comparison window.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. STRIKING DISTANCE KEYWORDS */}
        {activeDimension === 'STRIKING_DISTANCE' && (
          <div className="p-4 space-y-3" id="striking-distance-view">
            <div className="text-xs text-slate-400">
              Keywords ranking on Page 2 (Positions 11–20) with high search impression volume. Targeting these via content optimization or internal linking can drive them to Page 1.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                    <th className="py-2.5 px-4">Opportunity Keyword</th>
                    <th className="py-2.5 px-4 text-right">Current Position</th>
                    <th className="py-2.5 px-4 text-right">Impressions</th>
                    <th className="py-2.5 px-4 text-right">Current Clicks</th>
                    <th className="py-2.5 px-4 text-right">Potential Gain</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {strikingDistance.map((kw: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-850 transition-colors">
                      <td className="py-3 px-4 font-medium text-amber-300 font-mono">{kw.query}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-sky-400">{kw.position}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">{kw.impressions.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono">{kw.clicks}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        +{(Math.round(kw.impressions * 0.08) - kw.clicks).toLocaleString()} clicks/mo
                      </td>
                    </tr>
                  ))}
                  {strikingDistance.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No striking distance queries currently detected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. SYNC AUDIT RUNS */}
        {activeDimension === 'SYNC_LOGS' && (
          <div className="overflow-x-auto" id="sync-audit-table-wrapper">
            <table className="w-full text-left border-collapse text-xs" id="sync-audit-table">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="py-2.5 px-4">Sync Run ID</th>
                  <th className="py-2.5 px-4">Provider</th>
                  <th className="py-2.5 px-4">Dataset</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Rows Fetched</th>
                  <th className="py-2.5 px-4 text-right">Rows Upserted</th>
                  <th className="py-2.5 px-4 text-right">Completed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {syncRuns.map((run: any) => (
                  <tr key={run.id} className="hover:bg-slate-850 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-300">{run.id.substring(0, 8)}...</td>
                    <td className="py-3 px-4 font-mono font-bold text-sky-400">{run.provider}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{run.dataset}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          run.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : run.status === 'RUNNING'
                            ? 'bg-sky-500/15 text-sky-300'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{run.rowsFetched}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">{run.rowsUpserted}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {run.completedAt ? new Date(run.completedAt).toLocaleTimeString() : 'In Progress'}
                    </td>
                  </tr>
                ))}
                {syncRuns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      No synchronization runs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Property Discovery & Binding Modal */}
      {isManageModalOpen && (
        <div id="property-manage-modal" className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Settings2 className="h-5 w-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Google Integration & Property Bindings</h2>
              </div>
              <button
                id="close-manage-modal-btn"
                onClick={() => setIsManageModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {loadingProperties ? (
              <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                <span>Discovering accessible Google Search Console and GA4 properties...</span>
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* 1. GSC Binding */}
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-white flex items-center space-x-2">
                      <span>Google Search Console Property</span>
                      {currentGscBinding && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          BOUND: {currentGscBinding.providerPropertyId}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Select the Search Console domain or URL-prefix property corresponding to this website.
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      id="select-gsc-property"
                      value={selectedGscProp}
                      onChange={(e) => setSelectedGscProp(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Select Search Console Property --</option>
                      {gscProperties.map((p, idx) => (
                        <option key={idx} value={p.siteUrl}>
                          {p.siteUrl} ({p.permissionLevel})
                        </option>
                      ))}
                    </select>
                    <button
                      id="bind-gsc-btn"
                      onClick={handleBindGsc}
                      disabled={!selectedGscProp || bindingGsc}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium disabled:opacity-50"
                    >
                      {bindingGsc ? 'Binding...' : 'Bind GSC'}
                    </button>
                  </div>
                </div>

                {/* 2. GA4 Binding */}
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-white flex items-center space-x-2">
                      <span>Google Analytics 4 Property</span>
                      {currentGa4Binding && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          BOUND: {currentGa4Binding.providerDisplayName || currentGa4Binding.providerPropertyId}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Select the GA4 data stream property to ingest organic session conversions and revenue metrics.
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      id="select-ga4-property"
                      value={selectedGa4Prop}
                      onChange={(e) => setSelectedGa4Prop(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Select GA4 Property --</option>
                      {ga4Properties.map((p, idx) => (
                        <option key={idx} value={p.propertyId}>
                          {p.displayName} ({p.propertyId}) - {p.accountName}
                        </option>
                      ))}
                    </select>
                    <button
                      id="bind-ga4-btn"
                      onClick={handleBindGa4}
                      disabled={!selectedGa4Prop || bindingGa4}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium disabled:opacity-50"
                    >
                      {bindingGa4 ? 'Binding...' : 'Bind GA4'}
                    </button>
                  </div>
                </div>

                {/* 3. Disconnect Section */}
                <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-900/40 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-rose-300">Disconnect Google Integration</div>
                    <div className="text-rose-400/70 text-[11px]">
                      Revokes access tokens and removes all Search Console and GA4 property bindings for this website.
                    </div>
                  </div>
                  <button
                    id="disconnect-google-btn"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="px-3 py-1.5 bg-rose-900 hover:bg-rose-800 text-white rounded font-medium text-xs flex items-center space-x-1"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    <span>{disconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                id="done-modal-btn"
                onClick={() => setIsManageModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
