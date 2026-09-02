export interface Website {
  id: string;
  domain: string;
  name: string;
  industry: string;
  productionUrl: string;
  sitemapUrl: string;
  defaultLanguage: string;
  competitors: string[];
  gscConnected: boolean;
  ga4Connected: boolean;
  wpConnected: boolean;
  sheetsConnected: boolean;
  lastCrawlTimestamp: string;
  capacityConfig: {
    articlesPerWeek: number;
    writersCount: number;
    editorsCount: number;
    weeklyHours: number;
  };
}

export type HealthPillarKey =
  | 'technical'
  | 'indexability'
  | 'crawlability'
  | 'onPage'
  | 'contentQuality'
  | 'searchIntent'
  | 'semanticCoverage'
  | 'internalLinking'
  | 'externalAuthority'
  | 'schema'
  | 'performance'
  | 'coreWebVitals'
  | 'ux'
  | 'eeat'
  | 'ctr'
  | 'rankingHealth'
  | 'freshness'
  | 'conversions';

export interface HealthPillarDetail {
  key: HealthPillarKey;
  name: string;
  score: number; // 0 to 100
  trend: 'up' | 'down' | 'neutral';
  weight: number;
  evidence: string;
  problems: string[];
  recommendations: string[];
}

export interface SEOHealthState {
  overallScore: number;
  previousScore: number;
  lastAudited: string;
  pillars: Partial<Record<HealthPillarKey, HealthPillarDetail>> | Record<string, any>;
}

export interface CrawledUrl {
  url: string;
  path: string;
  status: number;
  loadTimeMs: number;
  isIndexable: boolean;
  canonical: string;
  canonicalSelfReferential: boolean;
  title: string;
  metaDescription: string;
  metaRobots: string;
  h1: string[];
  h2Count: number;
  wordCount: number;
  schemaTypes: string[];
  internalInlinks: number;
  internalOutlinks: number;
  externalLinks: number;
  imagesCount: number;
  missingAltCount: number;
  duplicateTitleWith?: string;
  duplicateH1With?: string;
  isOrphan: boolean;
  clickDepth: number;
  lastCrawled: string;
  firstDiscovered: string;
  lastChanged: string;
  issues: Array<{
    type: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    impact: string;
  }>;
}

export interface CrawlSnapshot {
  id: string;
  websiteId: string;
  timestamp: string;
  label: string;
  totalUrls: number;
  indexableCount: number;
  nonIndexableCount: number;
  statusCodes: {
    200: number;
    301: number;
    302: number;
    404: number;
    500: number;
  };
  issuesSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  urls: CrawledUrl[];
}

export interface CrawlComparisonDiff {
  snapshotAId: string;
  snapshotBId: string;
  snapshotALabel: string;
  snapshotBLabel: string;
  newUrls: string[];
  removedUrls: string[];
  statusChanges: Array<{ url: string; oldStatus: number; newStatus: number }>;
  titleChanges: Array<{ url: string; oldTitle: string; newTitle: string }>;
  canonicalChanges: Array<{ url: string; oldCanonical: string; newCanonical: string }>;
  resolvedIssuesCount: number;
  newIssuesCount: number;
}

export interface RankedKeyword {
  id: string;
  keyword: string;
  url: string;
  position: number;
  previousPosition: number;
  change: number; // positive = gain, negative = drop
  monthlySearchVolume: number;
  impressions: number;
  clicks: number;
  ctr: number;
  difficulty: number;
  searchIntent: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
  serpFeatures: Array<'Featured Snippet' | 'People Also Ask' | 'Video' | 'Sitelinks' | 'Knowledge Panel' | 'Local Pack'>;
  country: string;
  device: 'Desktop' | 'Mobile';
  status: 'NEW' | 'RISING' | 'STABLE' | 'DECLINING' | 'LOST';
  history: Array<{ date: string; position: number; clicks: number }>;
}

export interface KeywordOpportunity {
  id: string;
  keyword: string;
  url: string;
  currentPosition: number;
  targetPosition: number;
  impressions: number;
  clicks: number;
  currentCtr: number;
  expectedCtr: number;
  opportunityType:
    | 'STRIKING_DISTANCE_PAGE_2'
    | 'HIGH_IMP_LOW_CTR'
    | 'SURGING_DEMAND'
    | 'UNOPTIMIZED_RELEVANCE'
    | 'MISSING_DEDICATED_PAGE';
  potentialMonthlyClicks: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedAction: string;
  evidence: string;
}

export interface CannibalizationCase {
  id: string;
  query: string;
  intent: 'Informational' | 'Commercial' | 'Transactional';
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  contentSimilarityScore?: number;
  reason?: string;
  competingUrls: Array<{
    url: string;
    position: number;
    avgPosition?: number;
    clicks: number;
    impressions: number;
    title: string;
    contentSimilarityScore: number;
    trafficShare?: number;
  }>;
  intentCollisionSummary: string;
  recommendedStrategy: 'MERGE' | 'CANONICALIZE' | 'REDIRECT' | 'DIFFERENTIATE_INTENT' | 'INTERNAL_LINK_HIERARCHY';
  actionDetails: string;
  estimatedTrafficGain: string;
}

export interface DecayingContentItem {
  id: string;
  url: string;
  title: string;
  peakClicks: number;
  currentClicks: number;
  dropPercentage: number;
  peakPosition: number;
  currentPosition: number;
  lastUpdated: string;
  decayPeriod: 'Trailing 30 Days' | 'Trailing 90 Days' | 'Trailing 180 Days';
  rootCause: string;
  refreshUrgency: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  refreshBriefStatus: 'PENDING_BRIEF' | 'BRIEF_READY' | 'REFRESHING' | 'REINDEXED';
  refreshBrief?: any;
}

export interface TopicCluster {
  id: string;
  pillarName: string;
  pillarUrl: string;
  searchVolume: number;
  coverageScore: number; // % of subtopics covered
  subtopics: Array<{
    id: string;
    name: string;
    searchVolume: number;
    intent: 'Informational' | 'Commercial' | 'Transactional';
    status: 'PUBLISHED' | 'PLANNED' | 'DRAFT' | 'GAP';
    url?: string;
    entities: string[];
    internalInlinksFromPillar?: boolean;
  }>;
  supportingArticles?: Array<{
    title: string;
    url: string;
    internalInlinksFromPillar: boolean;
  }>;
  missingSubtopics?: string[];
}

export interface CompetitorGapItem {
  id: string;
  competitorDomain: string;
  topic: string;
  keyword: string;
  searchVolume: number;
  intent: 'Informational' | 'Commercial' | 'Transactional';
  competitorPosition: number;
  ourPosition: number | null; // null if we don't rank
  difficulty: number;
  businessValue: 'High' | 'Medium' | 'Low';
  trafficPotential: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedArticleAngle: string;
}

export interface InternalLinkOpportunity {
  id: string;
  sourceUrl: string;
  sourceTitle: string;
  targetUrl: string;
  targetTitle: string;
  anchorText: string;
  recommendedAnchorText?: string;
  contextSentence: string;
  relevanceScore: number; // 0 to 100
  status: 'RECOMMENDED' | 'APPLIED' | 'DISMISSED';
  applied?: boolean;
  safetyLevel: 'SAFE_AUTOMATION' | 'REVIEW_RECOMMENDED';
}


export type ContentPipelineStage =
  | 'IDEA'
  | 'RESEARCH'
  | 'BRIEF'
  | 'WRITING'
  | 'REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'MONITORING'
  | 'REFRESH_REQUIRED';

export interface ContentPlanItem {
  id: string;
  title: string;
  slug: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: 'Informational' | 'Commercial' | 'Transactional';
  contentType: 'Pillar Guide' | 'How-To Tutorial' | 'Comparison / Teardown' | 'Technical Case Study' | 'FAQ / Definition';
  stage: ContentPipelineStage;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  trafficPotential: number;
  businessValue: 'High' | 'Medium' | 'Low';
  difficulty: number;
  targetDate: string;
  writer?: string;
  editor?: string;
  wordCountTarget: number;
  brief?: any;
  currentContentMarkdown?: string;
  versionsCount: number;
  versions?: Array<{
    versionId: string;
    versionNumber: number;
    createdAt: string;
    title: string;
    metaDescription: string;
    content: string;
    changeSummary: string;
  }>;
}

export interface SEOExperiment {
  id: string;
  name: string;
  title?: string;
  targetUrl?: string;
  targetUrls?: string[];
  controlUrls?: string[];
  elementTested?: 'Title Tag' | 'Meta Description' | 'H1 & Headings' | 'Schema FAQ' | 'Internal Link Cluster' | string;
  type?: string;
  hypothesis: string;
  originalValue?: string;
  testValue?: string;
  startDate?: string;
  endDate?: string;
  testDurationDays?: number;
  confidenceLevel?: number;
  measuredLiftPct?: number;
  learningLog?: string;
  status: 'RUNNING' | 'CONCLUDED' | 'REVERTED';
  results?: {
    baselineCtr: number;
    testCtr: number;
    ctrLiftPct: number;
    baselineClicks: number;
    testClicks: number;
    clicksLiftPct: number;
    baselineAvgPos: number;
    testAvgPos: number;
    confidenceScore: number;
    winner: 'TEST' | 'ORIGINAL' | 'INCONCLUSIVE';
    learningInsight: string;
  };
}

export interface SEOTask {
  id: string;
  title: string;
  description?: string;
  category: 'TECHNICAL' | 'ON_PAGE' | 'CONTENT' | 'INTERNAL_LINKS' | 'SCHEMA' | 'SPEED';
  reason: string;
  evidence: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  impact: number; // 1-10
  confidence: number; // 1-10
  effort: number; // 1-10
  iceScore: number; // (impact * confidence) / effort
  status: 'PENDING' | 'DRY_RUN_READY' | 'EXECUTING' | 'COMPLETED' | 'REVERTED' | 'DISMISSED';
  automationLevel: 'MANUAL' | 'ASSISTED' | 'ONE_CLICK' | 'AUTOMATIC';
  affectedUrls: string[];
  rollbackSupported: boolean;
  appliedPayload?: any;
  completedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userOrAgent?: string;
  ruleOrTrigger?: string;
  actionName?: string;
  action?: string;
  triggeredBy?: string;
  affectedUrl: string;
  beforeState?: string;
  afterState?: string;
  reason: string;
  dataSource?: 'GSC' | 'GA4' | 'Crawler' | 'SERP' | 'AI Model';
  aiModel?: string;
  approvalStatus?: 'AUTO_APPROVED' | 'HUMAN_APPROVED' | 'REVERTED';
  reversible?: boolean;
  reverted?: boolean;
  rollbackState?: any;
}

export interface DailySEOReport {
  date: string;
  trafficChangePct: number;
  clicks: number;
  impressions: number;
  avgPosition: number;
  avgPositionChange: number;
  ctr: number;
  ctrChangePct: number;
  technicalIssuesCount: number;
  decayDetectedCount: number;
  cannibalizationCount: number;
  strikingDistanceCount: number;
  topWins: Array<{ queryOrUrl: string; metric: string; change: string }>;
  topLosses: Array<{ queryOrUrl: string; metric: string; change: string }>;
  topPriorities: Array<{ title: string; type: string; impact: string }>;
}

export interface SEOChatMessage {
  id: string;
  sender: 'AI' | 'USER';
  text: string;
  timestamp: string;
}

export type AgentRole =
  | 'TECHNICAL_AGENT'
  | 'CONTENT_STRATEGY_AGENT'
  | 'GROWTH_AGENT'
  | 'COMPETITOR_AGENT'
  | 'AUDITOR_AGENT'
  | 'AUTOMATION_MANAGER';

export type AgentStatus = 'ANALYZING' | 'EXECUTING' | 'MONITORING' | 'LEARNING' | 'IDLE';

export interface SEOAgent {
  id: string;
  role: AgentRole;
  name: string;
  title: string;
  avatarColor: string;
  description: string;
  status: AgentStatus;
  currentTask: string;
  issuesSolvedCount: number;
  actionsExecutedCount: number;
  successRate: number;
  learningProgress: number;
  activePillars: string[];
  lastActivityTimestamp: string;
  recentLogs: string[];
}

export type AutonomyMode = 'MANUAL' | 'SUPERVISED' | 'AUTONOMOUS';

export interface SafetyConfig {
  autonomyLevel: AutonomyMode;
  rollbackEnabled: boolean;
  verificationEnabled: boolean;
  canaryRolloutPct: number;
  bayesianDamping: number;
  circuitBreakerActive: boolean;
  maxActionsPerDay: number;
  autoRollbackOnDrop: boolean;
  slackWebhook?: string;
}

export interface DailySEOBriefData {
  id: string;
  generatedAt: string;
  websiteDomain: string;
  summary: string;
  headline: string;
  problemsDetectedCount: number;
  actionsCompletedCount: number;
  rankingChanges: {
    rising: number;
    falling: number;
    unchanged: number;
  };
  trafficChanges: {
    clicks: number;
    clicksChangePct: number;
    impressions: number;
    impressionsChangePct: number;
    avgPosition: number;
    avgPositionChange: number;
    ctr: number;
  };
  newOpportunities: Array<{
    id: string;
    title: string;
    category: string;
    potentialLift: string;
    confidence: number;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    actionType: string;
  }>;
  recommendedPriorities: Array<{
    id: string;
    title: string;
    pillar: string;
    impact: string;
    confidence: number;
    risk: 'LOW' | 'MEDIUM' | 'HIGH';
    targetUrl: string;
    reason: string;
  }>;
}

export interface OnboardingState {
  currentStep: number;
  domain: string;
  name: string;
  industry: string;
  sitemapUrl: string;
  cmsType: 'WORDPRESS' | 'SHOPIFY' | 'HEADLESS' | 'CUSTOM' | 'NONE';
  gscConnected: boolean;
  ga4Connected: boolean;
  auditProgress: number;
  strategyGenerated: boolean;
}
