import React, { useState } from 'react';
import {
  INITIAL_WEBSITES,
  INITIAL_HEALTH_STATE,
  MOCK_DAILY_REPORT,
  MOCK_CRAWL_SNAPSHOT_CURRENT,
  MOCK_CRAWL_SNAPSHOT_PREVIOUS,
  MOCK_KEYWORDS,
  MOCK_OPPORTUNITIES,
  MOCK_CANNIBALIZATION_CASES,
  MOCK_DECAYING_CONTENT,
  MOCK_COMPETITOR_GAPS,
  MOCK_TOPIC_CLUSTERS,
  MOCK_INTERNAL_LINK_OPPORTUNITIES,
  MOCK_CONTENT_PIPELINE,
  MOCK_EXPERIMENTS,
  MOCK_TASKS,
  MOCK_AUDIT_LOGS,
} from './data/mockData';
import {
  Website,
  SEOHealthState,
  DailySEOReport,
  CrawlSnapshot,
  RankedKeyword,
  KeywordOpportunity,
  CannibalizationCase,
  DecayingContentItem,
  CompetitorGapItem,
  TopicCluster,
  InternalLinkOpportunity,
  ContentPlanItem,
  SEOExperiment,
  SEOTask,
  AuditLogEntry,
  ContentPipelineStage,
  CrawledUrl,
} from './types';


import { Navigation } from './components/Navigation';
import { CommandCenter } from './components/CommandCenter';
import { HealthScoreDashboard } from './components/HealthScoreDashboard';
import { CrawlerAuditor } from './components/CrawlerAuditor';
import { SearchConsoleAnalytics } from './components/SearchConsoleAnalytics';
import { RankTracker } from './components/RankTracker';
import { OpportunityEngine } from './components/OpportunityEngine';
import { CTROptimizer } from './components/CTROptimizer';
import { CannibalizationDetector } from './components/CannibalizationDetector';
import { ContentDecayRefresh } from './components/ContentDecayRefresh';
import { CompetitorGaps } from './components/CompetitorGaps';
import { TopicalAuthorityGraph } from './components/TopicalAuthorityGraph';
import { InternalLinkingHub } from './components/InternalLinkingHub';
import { ContentPipelinePlanner } from './components/ContentPipelinePlanner';
import { ContentStudio } from './components/ContentStudio';
import { SchemaStudio } from './components/SchemaStudio';
import { ExperimentsHub } from './components/ExperimentsHub';
import { TaskEngine } from './components/TaskEngine';
import { AuditLogViewer } from './components/AuditLogViewer';
import { AutonomousLoopModal } from './components/AutonomousLoopModal';
import { SEOCopilot } from './components/SEOCopilot';

export default function App() {
  const [websites] = useState<Website[]>(INITIAL_WEBSITES);
  const [selectedWebsite, setSelectedWebsite] = useState<Website>(INITIAL_WEBSITES[0]);
  const [currentTab, setCurrentTab] = useState<string>('command-center');

  // Application State
  const [healthState, setHealthState] = useState<SEOHealthState>(INITIAL_HEALTH_STATE);
  const [dailyReport, setDailyReport] = useState<DailySEOReport>(MOCK_DAILY_REPORT);
  const [currentCrawl, setCurrentCrawl] = useState<CrawlSnapshot>(MOCK_CRAWL_SNAPSHOT_CURRENT);
  const [previousCrawl] = useState<CrawlSnapshot>(MOCK_CRAWL_SNAPSHOT_PREVIOUS);
  const [keywords, setKeywords] = useState<RankedKeyword[]>(MOCK_KEYWORDS);
  const [opportunities, setOpportunities] = useState<KeywordOpportunity[]>(MOCK_OPPORTUNITIES);
  const [cannibalizationIssues, setCannibalizationIssues] = useState<any[]>(MOCK_CANNIBALIZATION_CASES);
  const [decayingPages, setDecayingPages] = useState<any[]>(MOCK_DECAYING_CONTENT);
  const [competitorGaps, setCompetitorGaps] = useState<any[]>(MOCK_COMPETITOR_GAPS);
  const [topicClusters, setTopicClusters] = useState<TopicCluster[]>(MOCK_TOPIC_CLUSTERS);
  const [internalLinkOpps, setInternalLinkOpps] = useState<InternalLinkOpportunity[]>(MOCK_INTERNAL_LINK_OPPORTUNITIES);
  const [contentPipeline, setContentPipeline] = useState<any[]>(MOCK_CONTENT_PIPELINE);
  const [experiments, setExperiments] = useState<SEOExperiment[]>(MOCK_EXPERIMENTS);
  const [tasks, setTasks] = useState<SEOTask[]>(MOCK_TASKS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(MOCK_AUDIT_LOGS);

  // Modals & Floating Assistants
  const [isLoopModalOpen, setIsLoopModalOpen] = useState<boolean>(false);
  const [isLoopRunning, setIsLoopRunning] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setNotificationToast(message);
    setTimeout(() => setNotificationToast(null), 3500);
  };

  // Autonomous Loop Execution
  const handleRunDailyLoop = () => {
    setIsLoopModalOpen(true);
  };

  const handleDailyLoopFinished = () => {
    // Increment health score and log transaction
    setHealthState((prev) => ({
      ...prev,
      overallScore: Math.min(100, prev.overallScore + 2),
      previousScore: prev.overallScore,
      lastCalculated: new Date().toISOString(),
    }));

    const newLog: AuditLogEntry = {
      id: `log-loop-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'Completed 42-Step Autonomous Daily SEO Loop',
      affectedUrl: 'Domain-wide (248 Crawled URLs)',
      triggeredBy: 'AUTONOMOUS_CRON',
      reason: 'Scheduled morning continuous audit and SERP rank realignment cycle',
      reverted: false,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    showToast('Autonomous 42-Step SEO Loop Executed! Health Score & Directives Updated.');
  };

  // Task Execution Handler
  const handleExecuteTask = (task: SEOTask) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: 'COMPLETED' } : t))
    );

    const newLog: AuditLogEntry = {
      id: `log-exec-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: `Executed Directive: ${task.title}`,
      affectedUrl: task.affectedUrls[0] || selectedWebsite.domain,
      triggeredBy: '1_CLICK_EXECUTION',
      reason: task.reason,
      rollbackState: { taskId: task.id, previousStatus: task.status },
      reverted: false,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    showToast(`Executed: "${task.title}" with audit trail record logged.`);
  };

  // Rollback Handler
  const handleRollbackTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'PENDING' } : t))
    );
    setAuditLogs((prev) =>
      prev.map((l) =>
        l.rollbackState?.taskId === taskId ? { ...l, reverted: true } : l
      )
    );
    showToast(`Reverted changes for task ${taskId}. Snapshot baseline restored.`);
  };

  // Add Crawled URL
  const handleAddCrawledUrl = (urlData: CrawledUrl) => {
    setCurrentCrawl((prev) => ({
      ...prev,
      urls: [urlData, ...prev.urls.filter((u) => u.url !== urlData.url)],
      totalUrls: prev.totalUrls + 1,
    }));
    showToast(`Live audited URL ${urlData.path} stored in crawl database.`);
  };

  // Resolve Cannibalization
  const handleResolveCannibalization = (issue: CannibalizationCase, chosenStrategy: string) => {
    setCannibalizationIssues((prev) => prev.filter((i) => i.id !== issue.id));
    const newLog: AuditLogEntry = {
      id: `log-cannibal-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: `Cannibalization Resolved: "${issue.query}" -> ${chosenStrategy}`,
      affectedUrl: issue.competingUrls[0]?.url || selectedWebsite.domain,
      triggeredBy: 'AI_SEO_MANAGER',
      reason: `Applied strategy ${chosenStrategy} to consolidate search equity`,
      reverted: false,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    showToast(`Resolved cannibalization for "${issue.query}" via ${chosenStrategy}.`);
  };

  // Content Pipeline Helpers
  const handleUpdateStage = (itemId: string, newStage: ContentPipelineStage) => {
    setContentPipeline((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, stage: newStage } : item))
    );
    showToast(`Moved article to stage: ${newStage}`);
  };

  const handleAddNewIdea = () => {
    const newId = `pipe-${Date.now()}`;
    const newItem: ContentPlanItem = {
      id: newId,
      title: 'Real-time Telemetry & Microservices Health: 2026 Architect Handbook',
      slug: 'real-time-telemetry-microservices-health',
      primaryKeyword: 'microservices health telemetry',
      secondaryKeywords: ['opentelemetry metrics', 'distributed tracing alerts'],
      searchIntent: 'Informational',
      contentType: 'Pillar Guide',
      wordCountTarget: 2200,
      stage: 'IDEA',
      priority: 'HIGH',
      trafficPotential: 2200,
      businessValue: 'High',
      difficulty: 54,
      writer: 'Senior Systems Architect',
      editor: 'Lead Editor',
      targetDate: '2026-09-01',
      versionsCount: 1,
    };
    setContentPipeline((prev) => [newItem, ...prev]);
    showToast('New content blueprint queued into Content Calendar!');
  };

  // Link Execution
  const handleExecuteLink = (link: InternalLinkOpportunity) => {
    setInternalLinkOpps((prev) =>
      prev.map((l) => (l.id === link.id ? { ...l, applied: true, status: 'APPLIED' } : l))
    );
    const anchor = link.anchorText || link.recommendedAnchorText || 'internal link';
    const newLog: AuditLogEntry = {
      id: `log-link-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: `Injected Internal Link: "${anchor}"`,
      affectedUrl: link.sourceUrl,
      triggeredBy: 'AUTO_LINK_ENGINE',
      reason: `Boost authority flow to target: ${link.targetUrl}`,
      reverted: false,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    showToast(`Internal link anchor "${anchor}" safely injected.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Header Navigation */}
      <Navigation
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        websites={websites}
        selectedWebsite={selectedWebsite}
        onSelectWebsite={setSelectedWebsite}
        healthState={healthState}
        onRunDailyLoop={handleRunDailyLoop}
        isLoopRunning={isLoopRunning}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      {/* Global Notification Toast */}
      {notificationToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-400 flex items-center space-x-2 animate-bounce">
          <span>✓ {notificationToast}</span>
        </div>
      )}

      {/* Main Container View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'command-center' && (
          <CommandCenter
            website={selectedWebsite}
            dailyReport={dailyReport}
            tasks={tasks}
            onExecuteTask={handleExecuteTask}
            onNavigateTab={setCurrentTab}
            onOpenCopilot={() => setIsCopilotOpen(true)}
          />
        )}

        {currentTab === 'health-score' && (
          <HealthScoreDashboard healthState={healthState} />
        )}

        {currentTab === 'crawler' && (
          <CrawlerAuditor
            currentSnapshot={currentCrawl}
            previousSnapshot={previousCrawl}
            onAddCrawledUrl={handleAddCrawledUrl}
          />
        )}

        {currentTab === 'gsc-analytics' && (
          <SearchConsoleAnalytics website={selectedWebsite} />
        )}

        {currentTab === 'rank-tracker' && (
          <RankTracker keywords={keywords} />
        )}

        {currentTab === 'opportunities' && (
          <OpportunityEngine
            opportunities={opportunities}
            onOptimizeKeyword={() => setCurrentTab('ctr-optimizer')}
            onGenerateBrief={() => setCurrentTab('content-studio')}
          />
        )}

        {currentTab === 'ctr-optimizer' && (
          <CTROptimizer />
        )}

        {currentTab === 'cannibalization' && (
          <CannibalizationDetector
            issues={cannibalizationIssues}
            onResolveIssue={handleResolveCannibalization}
          />
        )}

        {currentTab === 'decay-refresh' && (
          <ContentDecayRefresh
            decayingPages={decayingPages}
            onAddToPipeline={(page, diagnosis) => {
              handleAddNewIdea();
              setCurrentTab('content-pipeline');
            }}
          />
        )}

        {currentTab === 'competitor-gaps' && (
          <CompetitorGaps
            gaps={competitorGaps}
            onCreateArticleBrief={() => setCurrentTab('content-studio')}
          />
        )}

        {currentTab === 'topic-authority' && (
          <TopicalAuthorityGraph
            clusters={topicClusters}
            onGenerateBriefForSubtopic={() => setCurrentTab('content-studio')}
          />
        )}

        {currentTab === 'internal-links' && (
          <InternalLinkingHub
            opportunities={internalLinkOpps}
            onExecuteLink={handleExecuteLink}
          />
        )}

        {currentTab === 'content-pipeline' && (
          <ContentPipelinePlanner
            items={contentPipeline}
            onOpenStudioWithItem={() => setCurrentTab('content-studio')}
            onUpdateStage={handleUpdateStage}
            onAddNewIdea={handleAddNewIdea}
          />
        )}

        {currentTab === 'content-studio' && (
          <ContentStudio />
        )}

        {currentTab === 'schema-studio' && (
          <SchemaStudio />
        )}

        {currentTab === 'experiments' && (
          <ExperimentsHub
            experiments={experiments}
            onCreateExperiment={() => showToast('New controlled A/B test initialized for next crawl cycle.')}
          />
        )}

        {currentTab === 'tasks' && (
          <TaskEngine
            tasks={tasks}
            onExecuteTask={handleExecuteTask}
            onRollbackTask={handleRollbackTask}
          />
        )}

        {currentTab === 'audit-logs' && (
          <AuditLogViewer
            logs={auditLogs}
            onRollback={handleRollbackTask}
          />
        )}
      </main>

      {/* 42-Step Autonomous Daily SEO Loop Runner Modal */}
      <AutonomousLoopModal
        isOpen={isLoopModalOpen}
        onClose={() => setIsLoopModalOpen(false)}
        onLoopComplete={handleDailyLoopFinished}
      />

      {/* Embedded/Floating Senior SEO Copilot Assistant */}
      <SEOCopilot
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        website={selectedWebsite}
      />
    </div>
  );
}
