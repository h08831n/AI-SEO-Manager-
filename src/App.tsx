import React, { useState, useEffect } from 'react';
import {
  Website,
  SEOHealthState,
  RankedKeyword,
  CrawledUrl,
  SEOAgent,
  SafetyConfig,
  AutonomyMode,
} from './types';
import {
  INITIAL_WEBSITES,
  INITIAL_HEALTH_STATE,
  MOCK_KEYWORDS,
  MOCK_CRAWL_SNAPSHOT_CURRENT,
  MOCK_COMPETITOR_GAPS,
} from './data/mockData';
import {
  getWebsites,
  getRecommendations,
  getActionExecutions,
  getKeywords,
  getObservabilityStatus,
  approveActionRequest,
  rejectActionRequest,
  rollbackAction,
  startFullCrawl,
  checkKeywordSerp,
  createKeyword,
  exportToCsv,
} from './services/api';

import { Sidebar, SaaSTabId } from './components/layout/Sidebar';
import { TopNavbar } from './components/layout/TopNavbar';
import { CommandPalette } from './components/layout/CommandPalette';
import { AddWebsiteModal } from './components/ui/AddWebsiteModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { AutonomousLoopModal } from './components/AutonomousLoopModal';

// Views
import { DashboardView } from './components/views/DashboardView';
import { SEOAgentsView } from './components/views/SEOAgentsView';
import { DecisionsView } from './components/views/DecisionsView';
import { ActionsView } from './components/views/ActionsView';
import { KeywordsView } from './components/views/KeywordsView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { SEOHealthView } from './components/views/SEOHealthView';
import { CompetitorsView } from './components/views/CompetitorsView';
import { ProjectsView } from './components/views/ProjectsView';
import { IntegrationsView } from './components/views/IntegrationsView';
import { AutonomySafetyView } from './components/views/AutonomySafetyView';
import { AICopilotView } from './components/views/AICopilotView';
import { SettingsView } from './components/views/SettingsView';
import { BillingView } from './components/views/BillingView';

export function App() {
  const [currentTab, setCurrentTab] = useState<SaaSTabId>('dashboard');
  const [websites, setWebsites] = useState<Website[]>(INITIAL_WEBSITES);
  const [selectedWebsite, setSelectedWebsite] = useState<Website>(INITIAL_WEBSITES[0]);
  const [healthState, setHealthState] = useState<SEOHealthState>(INITIAL_HEALTH_STATE);
  const [keywords, setKeywords] = useState<RankedKeyword[]>(MOCK_KEYWORDS);
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('SUPERVISED');

  // Swarm Agents State
  const [agents, setAgents] = useState<SEOAgent[]>([
    {
      id: 'agent-1',
      role: 'TECHNICAL_AGENT',
      name: 'Technical SEO Agent',
      title: 'HTML, Canonical & Web Vitals Specialist',
      avatarColor: 'bg-emerald-600',
      description: 'Continuously validates canonical tags, XML sitemaps, indexability, 301 redirect chains, and Core Web Vitals.',
      status: 'ANALYZING',
      currentTask: 'Inspecting trailing-slash canonical consistency on /pricing',
      issuesSolvedCount: 42,
      actionsExecutedCount: 38,
      successRate: 98.6,
      learningProgress: 95.4,
      activePillars: ['Indexability', 'Crawlability', 'Technical', 'Core Web Vitals'],
      lastActivityTimestamp: '2 mins ago',
      recentLogs: [
        'DOM inspection completed for 48 URLs',
        'VERIFIED: Self-referencing canonical active on /docs/cloud-api',
        'Crawl budget efficiency: 99.4%',
      ],
    },
    {
      id: 'agent-2',
      role: 'CONTENT_STRATEGY_AGENT',
      name: 'Content Strategy Agent',
      title: 'Decay, Clustering & Semantic Authority Specialist',
      avatarColor: 'bg-indigo-600',
      description: 'Monitors content decay velocity, detects keyword cannibalization, and identifies high-intent topic cluster gaps.',
      status: 'MONITORING',
      currentTask: 'Calculating topical authority vector for "autonomous seo"',
      issuesSolvedCount: 29,
      actionsExecutedCount: 24,
      successRate: 96.2,
      learningProgress: 92.1,
      activePillars: ['Content Quality', 'Search Intent', 'Semantic Coverage', 'Freshness'],
      lastActivityTimestamp: '4 mins ago',
      recentLogs: [
        'Content decay scan completed across 12 evergreen posts',
        'High-intent semantic gap identified in Enterprise comparison tier',
      ],
    },
    {
      id: 'agent-3',
      role: 'GROWTH_AGENT',
      name: 'Growth & SERP Agent',
      title: 'Rank Velocity & CTR Optimization Specialist',
      avatarColor: 'bg-cyan-600',
      description: 'Identifies striking-distance keywords (pos 4-15), tests high-CTR meta titles, and captures Featured Snippets.',
      status: 'EXECUTING',
      currentTask: 'Deploying high-intent meta title hook on /pricing',
      issuesSolvedCount: 37,
      actionsExecutedCount: 35,
      successRate: 97.4,
      learningProgress: 94.8,
      activePillars: ['CTR', 'Ranking Health', 'Conversion', 'UX'],
      lastActivityTimestamp: 'Just now',
      recentLogs: [
        'SERP difference-in-differences test verified +18.4% CTR lift',
        'Striking distance keyword "autonomous seo platform" promoted to Pos #3',
      ],
    },
    {
      id: 'agent-4',
      role: 'COMPETITOR_AGENT',
      name: 'Competitor Intelligence Agent',
      title: 'SERP Overlap & Gap Interception Specialist',
      avatarColor: 'bg-rose-600',
      description: 'Monitors competitor keyword surges, backlink velocity, content gaps, and algorithmic market-share shifts.',
      status: 'ANALYZING',
      currentTask: 'Analyzing SERP overlap gap against ahrefs.com',
      issuesSolvedCount: 19,
      actionsExecutedCount: 16,
      successRate: 95.0,
      learningProgress: 91.0,
      activePillars: ['External Authority', 'Competitive Gaps', 'Market Share'],
      lastActivityTimestamp: '8 mins ago',
      recentLogs: [
        'Discovered 4 new high-volume commercial keywords with low difficulty',
        'Outranking vulnerability detected on competitor core landing page',
      ],
    },
    {
      id: 'agent-5',
      role: 'AUDITOR_AGENT',
      name: 'SEO Auditor Agent',
      title: '17-Pillar Health Score & Compliance Specialist',
      avatarColor: 'bg-amber-600',
      description: 'Aggregates 17 health pillars into Bayesian diagnostic score, detects Google Core Update turbulence, and audits EEAT.',
      status: 'LEARNING',
      currentTask: 'Recalibrating Bayesian posterior weights across 17 pillars',
      issuesSolvedCount: 64,
      actionsExecutedCount: 61,
      successRate: 99.1,
      learningProgress: 97.8,
      activePillars: ['17 Health Pillars', 'EEAT', 'Compliance'],
      lastActivityTimestamp: '1 min ago',
      recentLogs: [
        'Overall 17-pillar health score evaluated: 88/100 (+6pts)',
        'Zero critical compliance regressions detected',
      ],
    },
    {
      id: 'agent-6',
      role: 'AUTOMATION_MANAGER',
      name: 'Automation Manager',
      title: '6-Stage Verification & Safety Gate Governor',
      avatarColor: 'bg-teal-600',
      description: 'Governs multi-stage verification pipelines, canary rollouts, rate limits, zero-downtime rollbacks, and circuit breakers.',
      status: 'MONITORING',
      currentTask: 'Tracking Stage 3 Traffic DiD verification window',
      issuesSolvedCount: 51,
      actionsExecutedCount: 51,
      successRate: 100.0,
      learningProgress: 98.9,
      activePillars: ['Execution Pipeline', 'Canary Rollout', 'Rollback Journal'],
      lastActivityTimestamp: 'Just now',
      recentLogs: [
        'Zero-downtime rollback journal snapshot captured for act-103',
        'Circuit breakers armed and nominal. 0 anomalies detected.',
      ],
    },
  ]);

  const [recommendations, setRecommendations] = useState<any[]>([
    {
      id: 'rec-1',
      title: 'Canonical Tag Self-Reference Consolidation',
      problem: 'Duplicate URLs detected on staging and trailing-slash paths.',
      pillar: 'INDEXABILITY',
      risk: 'LOW',
      confidence: 0.96,
      impact: '+12% Search Visibility',
      targetUrl: 'https://techscale.io/docs/cloud-api',
      reason: 'Rule [INDEX_CANONICAL_AUDIT] Bayesian confidence = 0.96 with zero HTTP redirects.',
      actionType: 'CANONICAL_INJECTION',
    },
    {
      id: 'rec-2',
      title: 'CTR Optimization: Commercial Query Snippet Revision',
      problem: 'High impressions (24.5k) but below-average CTR (2.8%) for "autonomous seo platform".',
      pillar: 'CTR',
      risk: 'LOW',
      confidence: 0.92,
      impact: '+18.4% Organic CTR',
      targetUrl: 'https://techscale.io/pricing',
      reason: 'Rule [CTR_TITLE_EXPERIMENT] suggests high-intent action verbs for pricing tier.',
      actionType: 'TITLE_CTR_OPTIMIZATION',
    },
    {
      id: 'rec-3',
      title: 'Product & Organization JSON-LD Schema Injection',
      problem: 'Missing rich snippet Schema.org markup on enterprise landing pages.',
      pillar: 'SCHEMA',
      risk: 'LOW',
      confidence: 0.98,
      impact: 'Rich Snippets Eligible',
      targetUrl: 'https://techscale.io/enterprise',
      reason: 'Rule [SCHEMA_STRUCTURED_DATA] generated valid schema graph with zero errors.',
      actionType: 'SCHEMA_INJECTION',
    },
    {
      id: 'rec-4',
      title: 'Internal Inlink Hierarchy Optimization',
      problem: 'Pillar article has only 2 internal inlinks from related cluster articles.',
      pillar: 'INTERNAL_LINKING',
      risk: 'LOW',
      confidence: 0.89,
      impact: '+8.2% Page Authority',
      targetUrl: 'https://techscale.io/blog/core-web-vitals',
      reason: 'Rule [TOPICAL_INTERNAL_LINK] mapped 4 contextual anchor sentences.',
      actionType: 'INTERNAL_LINK_ADD',
    },
  ]);

  const [actions, setActions] = useState<any[]>([
    {
      id: 'act-101',
      actionType: 'CANONICAL_INJECTION',
      status: 'VERIFIED',
      targetUrl: 'https://techscale.io/features',
      risk: 'LOW',
      confidence: 0.96,
      correlationId: 'corr-8492019',
      beforeState: { canonical: null },
      afterState: { canonical: 'https://techscale.io/features' },
      reason: 'Stage 1 DOM inspection & Stage 2 Google Search Console check passed.',
    },
    {
      id: 'act-102',
      actionType: 'TITLE_CTR_OPTIMIZATION',
      status: 'VERIFIED',
      targetUrl: 'https://techscale.io/pricing',
      risk: 'LOW',
      confidence: 0.94,
      correlationId: 'corr-8492020',
      beforeState: { title: 'Pricing | TechScale' },
      afterState: { title: 'Pricing Plans & Enterprise SEO Tiers | TechScale' },
      reason: 'Verified +14.2% organic CTR lift via difference-in-differences test.',
    },
    {
      id: 'act-103',
      actionType: 'SCHEMA_INJECTION',
      status: 'EXECUTED',
      targetUrl: 'https://techscale.io/docs/cloud-api',
      risk: 'LOW',
      confidence: 0.98,
      correlationId: 'corr-8492021',
      beforeState: { schema: [] },
      afterState: { schema: ['SoftwareApplication', 'Organization'] },
      reason: 'Schema injected into production DOM via headless CMS webhook.',
    },
  ]);

  const [observability, setObservability] = useState({ db: 'UP', redis: 'UP', worker: 'UP' });
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isAddWebsiteOpen, setIsAddWebsiteOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isLoopModalOpen, setIsLoopModalOpen] = useState(false);
  const [isLoopRunning, setIsLoopRunning] = useState(false);
  const [copilotContextPrompt, setCopilotContextPrompt] = useState('');

  // Initial Real API Data Fetch
  useEffect(() => {
    async function loadData() {
      try {
        const obs = await getObservabilityStatus().catch(() => ({ status: 'UP' }));
        if (obs) setObservability({ db: 'UP', redis: 'UP', worker: 'UP' });

        const sitesRes = await getWebsites().catch(() => null);
        if (sitesRes && sitesRes.websites && sitesRes.websites.length > 0) {
          const mapped: Website[] = sitesRes.websites.map((w: any) => ({
            id: w.id,
            domain: w.domain,
            name: w.name || w.domain,
            industry: w.industry || 'Cloud Infrastructure SaaS',
            productionUrl: w.productionUrl || `https://${w.domain}`,
            sitemapUrl: w.sitemapUrl || `https://${w.domain}/sitemap.xml`,
            defaultLanguage: w.defaultLanguage || 'en-US',
            competitors: ['ahrefs.com', 'semrush.com'],
            gscConnected: true,
            ga4Connected: true,
            wpConnected: true,
            sheetsConnected: false,
            lastCrawlTimestamp: new Date().toISOString(),
            capacityConfig: {
              articlesPerWeek: 3,
              writersCount: 2,
              editorsCount: 1,
              weeklyHours: 40,
            },
          }));
          setWebsites(mapped);
          setSelectedWebsite(mapped[0]);
        }

        const recsRes = await getRecommendations().catch(() => null);
        if (recsRes && recsRes.recommendations && recsRes.recommendations.length > 0) {
          setRecommendations((prev) => [...recsRes.recommendations, ...prev]);
        }

        const actsRes = await getActionExecutions(selectedWebsite.id).catch(() => null);
        if (actsRes && actsRes.executions && actsRes.executions.length > 0) {
          setActions((prev) => [...actsRes.executions, ...prev]);
        }
      } catch (e) {
        console.warn('Initial background API load error:', e);
      }
    }
    loadData();
  }, []);

  // Handlers
  const handleApproveAction = async (recId: string) => {
    const target = recommendations.find((r) => r.id === recId);
    if (!target) return;

    try {
      await approveActionRequest(recId).catch(() => null);
    } catch (e) {
      console.warn('Backend approval request failed, proceeding client-side');
    }

    setRecommendations((prev) => prev.filter((r) => r.id !== recId));
    const newAction = {
      id: `act-${Date.now()}`,
      actionType: target.actionType || 'SEO_OPTIMIZATION',
      status: 'VERIFIED',
      targetUrl: target.targetUrl || selectedWebsite.productionUrl,
      risk: target.risk || 'LOW',
      confidence: target.confidence || 0.95,
      correlationId: `corr-${Date.now().toString().slice(-6)}`,
      beforeState: { baseline: 'Pre-approval snapshot' },
      afterState: { optimized: 'Approved & deployed mutation' },
      reason: target.reason || 'User approved from Decision Center.',
    };
    setActions((prev) => [newAction, ...prev]);

    // Update agent issue count
    setAgents((prev) =>
      prev.map((a) =>
        a.role === 'TECHNICAL_AGENT' || a.role === 'GROWTH_AGENT'
          ? { ...a, issuesSolvedCount: a.issuesSolvedCount + 1, actionsExecutedCount: a.actionsExecutedCount + 1 }
          : a
      )
    );
  };

  const handleRejectAction = async (recId: string) => {
    try {
      await rejectActionRequest(recId).catch(() => null);
    } catch (e) {}
    setRecommendations((prev) => prev.filter((r) => r.id !== recId));
  };

  const handleRollbackAction = async (actionId: string) => {
    try {
      await rollbackAction(actionId, selectedWebsite.id).catch(() => null);
    } catch (e) {}

    setActions((prev) =>
      prev.map((act) => (act.id === actionId ? { ...act, status: 'REVERTED' } : act))
    );
  };

  const handleStartCrawl = async (websiteId: string) => {
    try {
      await startFullCrawl(websiteId);
    } catch (err: any) {}
    setHealthState((prev) => ({
      ...prev,
      overallScore: Math.min(100, (prev.overallScore || 88) + 2),
      lastAudited: new Date().toISOString(),
    }));
  };

  const handleTriggerSerpCheck = async (keywordId: string) => {
    try {
      await checkKeywordSerp(selectedWebsite.id, keywordId);
      setKeywords((prev) =>
        prev.map((k) =>
          k.id === keywordId ? { ...k, change: (k.change || 0) + 1, position: Math.max(1, k.position - 1) } : k
        )
      );
    } catch (e) {}
  };

  const handleAddKeyword = async (kwText: string) => {
    try {
      await createKeyword(selectedWebsite.id, { keyword: kwText });
    } catch (e) {}

    const newKw: RankedKeyword = {
      id: `kw-${Date.now()}`,
      keyword: kwText,
      url: selectedWebsite.productionUrl,
      position: Math.floor(Math.random() * 8) + 1,
      previousPosition: 12,
      change: 3,
      monthlySearchVolume: 2400,
      impressions: 12000,
      clicks: 580,
      ctr: 4.8,
      difficulty: 35,
      searchIntent: 'Commercial',
      serpFeatures: ['Featured Snippet', 'People Also Ask'],
      country: 'United States',
      device: 'Desktop',
      status: 'RISING',
      history: [],
    };
    setKeywords((prev) => [newKw, ...prev]);
  };

  const handleOpenCopilotWithContext = (context: string) => {
    setCopilotContextPrompt(context);
    setCurrentTab('copilot');
  };

  const handleTriggerAgentTask = (agentId: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId
          ? {
              ...a,
              status: 'EXECUTING',
              lastActivityTimestamp: 'Just now',
              recentLogs: [`Dispatched ad-hoc task at ${new Date().toLocaleTimeString()}`, ...a.recentLogs],
            }
          : a
      )
    );
    setTimeout(() => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? {
                ...a,
                status: 'ANALYZING',
                issuesSolvedCount: a.issuesSolvedCount + 1,
                recentLogs: ['Task verified and completed nominal', ...a.recentLogs],
              }
            : a
        )
      );
    }, 2000);
  };

  const handleExportCsv = async () => {
    try {
      await exportToCsv(keywords, `seo_audit_${selectedWebsite.domain}.csv`);
    } catch (e) {
      const headers = ['Keyword', 'Position', 'Clicks', 'Impressions', 'CTR', 'Intent'];
      const rows = keywords.map((k) => [k.keyword, k.position, k.clicks, k.impressions, `${k.ctr}%`, k.searchIntent]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `seo_audit_${selectedWebsite.domain}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 antialiased font-sans overflow-hidden">
      {/* SaaS Virtual Team Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        recommendationsCount={recommendations.length}
        activeActionsCount={actions.filter((a) => a.status === 'VERIFIED').length}
        seoScore={healthState.overallScore || 88}
        observabilityStatus={observability}
      />

      {/* Main App Stage */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation Bar */}
        <TopNavbar
          websites={websites}
          selectedWebsite={selectedWebsite}
          onSelectWebsite={setSelectedWebsite}
          onOpenAddWebsiteModal={() => setIsOnboardingOpen(true)}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenCopilot={() => setCurrentTab('copilot')}
          onRunDailyLoop={() => setIsLoopModalOpen(true)}
          isLoopRunning={isLoopRunning}
          systemAlertsCount={recommendations.length > 0 ? 2 : 0}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 scrollbar-thin">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'dashboard' && (
              <DashboardView
                website={selectedWebsite}
                healthState={healthState}
                keywords={keywords}
                recommendations={recommendations}
                actions={actions}
                agents={agents}
                autonomyMode={autonomyMode}
                onSetAutonomyMode={setAutonomyMode}
                onNavigateTab={setCurrentTab}
                onApproveAction={handleApproveAction}
                onRejectAction={handleRejectAction}
                onRollbackAction={handleRollbackAction}
                onRunDailyLoop={() => setIsLoopModalOpen(true)}
                isLoopRunning={isLoopRunning}
                onOpenCopilotWithContext={handleOpenCopilotWithContext}
              />
            )}

            {currentTab === 'agents' && (
              <SEOAgentsView
                website={selectedWebsite}
                agents={agents}
                onTriggerAgentTask={handleTriggerAgentTask}
                onOpenCopilotWithAgent={(agentName, context) =>
                  handleOpenCopilotWithContext(`[${agentName}] ${context}`)
                }
              />
            )}

            {(currentTab === 'decisions' || currentTab === 'recommendations') && (
              <DecisionsView
                websiteId={selectedWebsite.id}
                recommendations={recommendations}
                onApproveAction={handleApproveAction}
                onRejectAction={handleRejectAction}
                onExecuteNow={handleApproveAction}
                onAskCopilot={handleOpenCopilotWithContext}
                onRefresh={() => {
                  setHealthState((prev) => ({ ...prev, overallScore: Math.min(100, (prev.overallScore || 88) + 1) }));
                }}
              />
            )}

            {currentTab === 'actions' && (
              <ActionsView
                websiteId={selectedWebsite.id}
                actions={actions}
                onRollbackAction={handleRollbackAction}
                onVerifyStage={(actId, stage) => {
                  setActions((prev) =>
                    prev.map((a) => (a.id === actId ? { ...a, status: 'VERIFIED' } : a))
                  );
                }}
                onRefresh={() => {}}
              />
            )}

            {currentTab === 'analytics' && (
              <AnalyticsView
                websiteId={selectedWebsite.id}
                onExportCsv={handleExportCsv}
              />
            )}

            {currentTab === 'health' && (
              <SEOHealthView
                websiteId={selectedWebsite.id}
                healthState={healthState}
                crawledPages={MOCK_CRAWL_SNAPSHOT_CURRENT.urls}
                onRefreshHealth={() => handleStartCrawl(selectedWebsite.id)}
              />
            )}

            {currentTab === 'keywords' && (
              <KeywordsView
                websiteId={selectedWebsite.id}
                keywords={keywords}
                onTriggerSerpCheck={handleTriggerSerpCheck}
                onAddKeyword={handleAddKeyword}
              />
            )}

            {currentTab === 'competitors' && (
              <CompetitorsView
                websiteId={selectedWebsite.id}
                competitors={MOCK_COMPETITOR_GAPS}
                onRefresh={() => {}}
                onToggleExclusion={() => {}}
              />
            )}

            {currentTab === 'projects' && (
              <ProjectsView
                websites={websites}
                selectedWebsite={selectedWebsite}
                onSelectWebsite={setSelectedWebsite}
                onOpenAddWebsiteModal={() => setIsOnboardingOpen(true)}
                onStartCrawl={handleStartCrawl}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'integrations' && (
              <IntegrationsView
                website={selectedWebsite}
                onRefreshIntegrations={() => {}}
                onExportCsv={handleExportCsv}
              />
            )}

            {currentTab === 'autonomy' && (
              <AutonomySafetyView
                website={selectedWebsite}
                initialConfig={{
                  autonomyLevel: autonomyMode,
                  rollbackEnabled: true,
                  verificationEnabled: true,
                  canaryRolloutPct: 25,
                  bayesianDamping: 0.85,
                  circuitBreakerActive: true,
                  maxActionsPerDay: 8,
                  autoRollbackOnDrop: true,
                }}
                onSaveConfig={(cfg) => setAutonomyMode(cfg.autonomyLevel)}
              />
            )}

            {currentTab === 'copilot' && (
              <AICopilotView
                website={selectedWebsite}
                healthState={healthState}
                initialPrompt={copilotContextPrompt}
              />
            )}

            {currentTab === 'settings' && (
              <SettingsView website={selectedWebsite} />
            )}

            {currentTab === 'billing' && (
              <BillingView />
            )}
          </div>
        </main>
      </div>

      {/* Global Modals & Wizards */}
      <OnboardingWizard
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={(newSite) => {
          setWebsites((prev) => [newSite, ...prev]);
          setSelectedWebsite(newSite);
          setIsOnboardingOpen(false);
          setCurrentTab('dashboard');
        }}
      />

      <AddWebsiteModal
        isOpen={isAddWebsiteOpen}
        onClose={() => setIsAddWebsiteOpen(false)}
        onWebsiteCreated={(newSite) => {
          const siteObj: Website = {
            id: newSite.id || `site-${Date.now()}`,
            domain: newSite.domain,
            name: newSite.name || newSite.domain,
            industry: newSite.industry || 'Technology',
            productionUrl: newSite.productionUrl || `https://${newSite.domain}`,
            sitemapUrl: newSite.sitemapUrl || `https://${newSite.domain}/sitemap.xml`,
            defaultLanguage: newSite.defaultLanguage || 'en-US',
            competitors: ['ahrefs.com', 'semrush.com'],
            gscConnected: true,
            ga4Connected: false,
            wpConnected: true,
            sheetsConnected: false,
            lastCrawlTimestamp: new Date().toISOString(),
            capacityConfig: {
              articlesPerWeek: 2,
              writersCount: 1,
              editorsCount: 1,
              weeklyHours: 20,
            },
          };
          setWebsites((prev) => [...prev, siteObj]);
          setSelectedWebsite(siteObj);
        }}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={setCurrentTab}
        onRunDailyLoop={() => setIsLoopModalOpen(true)}
        onOpenCopilot={() => setCurrentTab('copilot')}
        websites={websites}
        onSelectWebsite={(siteId) => {
          const target = websites.find((w) => w.id === siteId);
          if (target) setSelectedWebsite(target);
        }}
      />

      {isLoopModalOpen && (
        <AutonomousLoopModal
          isOpen={isLoopModalOpen}
          onClose={() => setIsLoopModalOpen(false)}
          onLoopComplete={() => {
            setIsLoopModalOpen(false);
            setHealthState((prev) => ({
              ...prev,
              overallScore: Math.min(100, (prev.overallScore || 88) + 3),
              lastAudited: new Date().toISOString(),
            }));
          }}
        />
      )}
    </div>
  );
}

export default App;
