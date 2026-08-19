-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'SEO_MANAGER', 'EDITOR', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GSC', 'GA4', 'WORDPRESS', 'SHEETS', 'RANK_TRACKER');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('NOT_CONFIGURED', 'CONNECTING', 'CONNECTED', 'DEGRADED', 'ERROR', 'DISCONNECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM (
    'RECOMMENDED',
    'PENDING_APPROVAL',
    'DRY_RUN',
    'DRY_RUN_VALIDATED',
    'EXECUTING',
    'AWAITING_VERIFICATION',
    'VERIFIED_COMPLETED',
    'FAILED',
    'BLOCKED',
    'UNVERIFIED_BLOCKED',
    'ROLLBACK_PENDING',
    'REVERTED_RESTORED',
    'RECOMMENDATION_ONLY',
    'SIMULATION_ONLY',
    'BLOCKED_NO_INTEGRATION'
);

-- CreateEnum
CREATE TYPE "AutomationRiskLevel" AS ENUM ('LEVEL_0_SUGGESTION_ONLY', 'LEVEL_1_SAFE_AUTOMATION', 'LEVEL_2_REVIEW_REQUIRED', 'LEVEL_3_HIGH_RISK_MANUAL_ONLY');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "FrontierStatus" AS ENUM ('DISCOVERED', 'QUEUED', 'FETCHING', 'FETCHED', 'SKIPPED', 'FAILED', 'BLOCKED_ROBOTS', 'BLOCKED_SCOPE', 'BLOCKED_SECURITY');

-- CreateEnum
CREATE TYPE "CrawlRunLifecycle" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'PAUSING', 'PAUSED', 'CANCELLING', 'CANCELLED', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateTable (1)
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable (2)
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable (3)
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable (4)
CREATE TABLE "websites" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productionUrl" TEXT NOT NULL,
    "sitemapUrl" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en-US',
    "industry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "websites_pkey" PRIMARY KEY ("id")
);

-- CreateTable (5)
CREATE TABLE "website_settings" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "crawlFrequencyHours" INTEGER NOT NULL DEFAULT 24,
    "autoExecuteRiskLevel" "AutomationRiskLevel" NOT NULL DEFAULT 'LEVEL_0_SUGGESTION_ONLY',
    "targetGeo" TEXT NOT NULL DEFAULT 'GLOBAL',
    "primarySearchEngine" TEXT NOT NULL DEFAULT 'google',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable (6)
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "lastSyncAt" TIMESTAMP(3),
    "accountIdentifier" TEXT,
    "message" TEXT,
    "encryptedCredentials" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable (7)
CREATE TABLE "url_identities" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "firstDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discoverySources" TEXT[] DEFAULT ARRAY['SEED']::TEXT[],
    "inlinksCount" INTEGER NOT NULL DEFAULT 0,
    "outlinksCount" INTEGER NOT NULL DEFAULT 0,
    "minCrawlDepth" INTEGER NOT NULL DEFAULT 0,
    "isOrphanCandidate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "url_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable (8)
CREATE TABLE "crawl_runs" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "status" "CrawlRunLifecycle" NOT NULL DEFAULT 'PENDING',
    "seedUrl" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "totalIssues" INTEGER NOT NULL DEFAULT 0,
    "urlsDiscovered" INTEGER NOT NULL DEFAULT 0,
    "urlsQueued" INTEGER NOT NULL DEFAULT 0,
    "urlsFetched" INTEGER NOT NULL DEFAULT 0,
    "urlsSkipped" INTEGER NOT NULL DEFAULT 0,
    "urlsFailed" INTEGER NOT NULL DEFAULT 0,
    "robotsTxtStatus" TEXT,
    "robotsTxtHash" TEXT,
    "sitemapsDiscovered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "triggerSource" TEXT NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "crawl_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable (9)
CREATE TABLE "crawl_frontier_entries" (
    "id" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "status" "FrontierStatus" NOT NULL DEFAULT 'DISCOVERED',
    "discoverySource" TEXT NOT NULL DEFAULT 'HTML_LINK',
    "parentUrl" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawl_frontier_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable (10)
CREATE TABLE "crawled_pages" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "finalUrl" TEXT,
    "redirectCount" INTEGER NOT NULL DEFAULT 0,
    "redirectChainJson" TEXT,
    "loadTimeMs" INTEGER NOT NULL DEFAULT 0,
    "contentLengthBytes" INTEGER NOT NULL DEFAULT 0,
    "isIndexable" BOOLEAN NOT NULL DEFAULT true,
    "indexabilityStatus" TEXT NOT NULL DEFAULT 'INDEXABLE',
    "indexabilityReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canonicalUrl" TEXT,
    "normalizedCanonicalUrl" TEXT,
    "canonicalMatch" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT,
    "titleLength" INTEGER NOT NULL DEFAULT 0,
    "metaDescription" TEXT,
    "metaDescLength" INTEGER NOT NULL DEFAULT 0,
    "metaRobots" TEXT,
    "xRobotsTag" TEXT,
    "h1Tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "h2Count" INTEGER NOT NULL DEFAULT 0,
    "h3Count" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT,
    "simHash" TEXT,
    "isExactDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateClusterId" TEXT,
    "isThinContent" BOOLEAN NOT NULL DEFAULT false,
    "isPossibleSoft404" BOOLEAN NOT NULL DEFAULT false,
    "soft404Confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "internalInlinksCount" INTEGER NOT NULL DEFAULT 0,
    "internalOutlinksCount" INTEGER NOT NULL DEFAULT 0,
    "externalOutlinksCount" INTEGER NOT NULL DEFAULT 0,
    "imagesCount" INTEGER NOT NULL DEFAULT 0,
    "missingAltCount" INTEGER NOT NULL DEFAULT 0,
    "schemaTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "schemaStatus" TEXT NOT NULL DEFAULT 'STRUCTURE_UNKNOWN',
    "openGraphJson" TEXT,
    "twitterCardJson" TEXT,
    "hreflangsJson" TEXT,
    "crawlDepth" INTEGER NOT NULL DEFAULT 0,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawled_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable (11)
CREATE TABLE "internal_link_edges" (
    "id" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "normalizedTarget" TEXT NOT NULL,
    "anchorText" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "rel" TEXT,
    "isNofollow" BOOLEAN NOT NULL DEFAULT false,
    "targetStatusCode" INTEGER,
    "isBroken" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_link_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable (12)
CREATE TABLE "crawl_issues" (
    "id" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "crawledPageId" TEXT,
    "ruleKey" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "type" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable (13)
CREATE TABLE "seo_events" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "crawlRunId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityUrl" TEXT NOT NULL,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "deltaNotes" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "source" TEXT NOT NULL DEFAULT 'CRAWLER',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable (14)
CREATE TABLE "search_analytics_daily" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "query" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "device" TEXT NOT NULL DEFAULT 'DESKTOP',
    "country" TEXT NOT NULL DEFAULT 'GLOBAL',
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "search_analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable (15)
CREATE TABLE "topic_clusters" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "pillarName" TEXT NOT NULL,
    "pillarUrl" TEXT NOT NULL,
    "searchVolume" INTEGER NOT NULL DEFAULT 0,
    "coverageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable (16)
CREATE TABLE "topic_subtopics" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchVolume" INTEGER NOT NULL DEFAULT 0,
    "intent" TEXT NOT NULL DEFAULT 'Informational',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "url" TEXT,
    "entities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_subtopics_pkey" PRIMARY KEY ("id")
);

-- CreateTable (17)
CREATE TABLE "rule_definitions" (
    "id" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable (18)
CREATE TABLE "rule_versions" (
    "id" TEXT NOT NULL,
    "ruleDefinitionId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL DEFAULT 'MEDIUM',
    "logicConfigJson" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable (19)
CREATE TABLE "scoring_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable (20)
CREATE TABLE "scoring_profile_versions" (
    "id" TEXT NOT NULL,
    "scoringProfileId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "weightsJson" TEXT NOT NULL,
    "normalizationConfigJson" TEXT NOT NULL,
    "missingDataBehavior" TEXT NOT NULL DEFAULT 'FALLBACK_TO_ZERO',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_profile_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable (21)
CREATE TABLE "seo_recommendations" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ruleKey" TEXT,
    "ruleVersion" TEXT,
    "scoringProfileVersion" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "impactScore" INTEGER NOT NULL DEFAULT 5,
    "effortScore" INTEGER NOT NULL DEFAULT 5,
    "riskScore" INTEGER NOT NULL DEFAULT 3,
    "businessValue" INTEGER NOT NULL DEFAULT 5,
    "automationLevel" "AutomationRiskLevel" NOT NULL DEFAULT 'LEVEL_1_SAFE_AUTOMATION',
    "status" "ActionStatus" NOT NULL DEFAULT 'RECOMMENDED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable (22)
CREATE TABLE "seo_tasks" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "opportunityScore" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "automationLevel" "AutomationRiskLevel" NOT NULL DEFAULT 'LEVEL_1_SAFE_AUTOMATION',
    "status" "ActionStatus" NOT NULL DEFAULT 'RECOMMENDED',
    "reason" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "affectedUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actionType" TEXT NOT NULL,
    "actionPayloadJson" TEXT,
    "beforeStateJson" TEXT,
    "afterStateJson" TEXT,
    "idempotencyKey" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable (23)
CREATE TABLE "action_executions" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "taskId" TEXT,
    "recommendationId" TEXT,
    "actionType" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "approvalId" TEXT,
    "state" "ActionStatus" NOT NULL DEFAULT 'RECOMMENDED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "beforeEvidenceJson" TEXT,
    "afterEvidenceJson" TEXT,
    "failureReason" TEXT,
    "executedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "rollbackExecutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable (24)
CREATE TABLE "action_verifications" (
    "id" TEXT NOT NULL,
    "actionExecutionId" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'AWAITING_VERIFICATION',
    "expectedStateJson" TEXT NOT NULL,
    "observedStateJson" TEXT,
    "isMatch" BOOLEAN NOT NULL DEFAULT false,
    "varianceNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable (25)
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "websiteId" TEXT,
    "userId" TEXT,
    "taskId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" TEXT,
    "afterState" TEXT,
    "provenance" TEXT NOT NULL DEFAULT 'SYSTEM',
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable (26)
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT,
    "requestedByUserId" TEXT,
    "queueName" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobId" TEXT,
    "payloadJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable (27)
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- Unique & Search Indices
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");
CREATE INDEX "workspace_members_workspaceId_role_idx" ON "workspace_members"("workspaceId", "role");
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

CREATE UNIQUE INDEX "websites_workspaceId_domain_key" ON "websites"("workspaceId", "domain");
CREATE INDEX "websites_workspaceId_idx" ON "websites"("workspaceId");

CREATE UNIQUE INDEX "website_settings_websiteId_key" ON "website_settings"("websiteId");

CREATE UNIQUE INDEX "integrations_websiteId_provider_key" ON "integrations"("websiteId", "provider");
CREATE INDEX "integrations_websiteId_idx" ON "integrations"("websiteId");

CREATE UNIQUE INDEX "url_identities_websiteId_normalizedUrl_key" ON "url_identities"("websiteId", "normalizedUrl");
CREATE INDEX "url_identities_websiteId_isOrphanCandidate_idx" ON "url_identities"("websiteId", "isOrphanCandidate");

CREATE INDEX "crawl_runs_websiteId_startedAt_idx" ON "crawl_runs"("websiteId", "startedAt");
CREATE INDEX "crawl_runs_websiteId_status_idx" ON "crawl_runs"("websiteId", "status");

CREATE UNIQUE INDEX "crawl_frontier_entries_crawlRunId_normalizedUrl_key" ON "crawl_frontier_entries"("crawlRunId", "normalizedUrl");
CREATE INDEX "crawl_frontier_entries_crawlRunId_status_priority_idx" ON "crawl_frontier_entries"("crawlRunId", "status", "priority");

CREATE UNIQUE INDEX "crawled_pages_crawlRunId_normalizedUrl_key" ON "crawled_pages"("crawlRunId", "normalizedUrl");
CREATE INDEX "crawled_pages_websiteId_normalizedUrl_idx" ON "crawled_pages"("websiteId", "normalizedUrl");
CREATE INDEX "crawled_pages_crawlRunId_statusCode_idx" ON "crawled_pages"("crawlRunId", "statusCode");
CREATE INDEX "crawled_pages_crawlRunId_isIndexable_idx" ON "crawled_pages"("crawlRunId", "isIndexable");

CREATE INDEX "internal_link_edges_crawlRunId_sourceUrl_idx" ON "internal_link_edges"("crawlRunId", "sourceUrl");
CREATE INDEX "internal_link_edges_crawlRunId_normalizedTarget_idx" ON "internal_link_edges"("crawlRunId", "normalizedTarget");
CREATE INDEX "internal_link_edges_crawlRunId_isBroken_idx" ON "internal_link_edges"("crawlRunId", "isBroken");

CREATE INDEX "crawl_issues_crawlRunId_severity_idx" ON "crawl_issues"("crawlRunId", "severity");
CREATE INDEX "crawl_issues_crawlRunId_ruleKey_idx" ON "crawl_issues"("crawlRunId", "ruleKey");

CREATE INDEX "seo_events_websiteId_detectedAt_idx" ON "seo_events"("websiteId", "detectedAt");
CREATE INDEX "seo_events_websiteId_eventType_idx" ON "seo_events"("websiteId", "eventType");
CREATE INDEX "seo_events_crawlRunId_idx" ON "seo_events"("crawlRunId");

CREATE UNIQUE INDEX "search_analytics_daily_websiteId_date_query_page_device_country_key" ON "search_analytics_daily"("websiteId", "date", "query", "page", "device", "country");
CREATE INDEX "search_analytics_daily_websiteId_date_idx" ON "search_analytics_daily"("websiteId", "date");
CREATE INDEX "search_analytics_daily_websiteId_query_idx" ON "search_analytics_daily"("websiteId", "query");
CREATE INDEX "search_analytics_daily_websiteId_page_idx" ON "search_analytics_daily"("websiteId", "page");

CREATE INDEX "topic_clusters_websiteId_idx" ON "topic_clusters"("websiteId");
CREATE INDEX "topic_subtopics_clusterId_idx" ON "topic_subtopics"("clusterId");

CREATE UNIQUE INDEX "rule_definitions_ruleKey_key" ON "rule_definitions"("ruleKey");
CREATE UNIQUE INDEX "rule_versions_ruleDefinitionId_version_key" ON "rule_versions"("ruleDefinitionId", "version");
CREATE INDEX "rule_versions_ruleDefinitionId_isActive_idx" ON "rule_versions"("ruleDefinitionId", "isActive");

CREATE UNIQUE INDEX "scoring_profiles_name_key" ON "scoring_profiles"("name");
CREATE UNIQUE INDEX "scoring_profile_versions_scoringProfileId_version_key" ON "scoring_profile_versions"("scoringProfileId", "version");
CREATE INDEX "scoring_profile_versions_scoringProfileId_isActive_idx" ON "scoring_profile_versions"("scoringProfileId", "isActive");

CREATE INDEX "seo_recommendations_websiteId_status_idx" ON "seo_recommendations"("websiteId", "status");

CREATE UNIQUE INDEX "seo_tasks_idempotencyKey_key" ON "seo_tasks"("idempotencyKey");
CREATE INDEX "seo_tasks_websiteId_status_idx" ON "seo_tasks"("websiteId", "status");

CREATE UNIQUE INDEX "action_executions_idempotencyKey_key" ON "action_executions"("idempotencyKey");
CREATE INDEX "action_executions_websiteId_state_idx" ON "action_executions"("websiteId", "state");
CREATE INDEX "action_executions_idempotencyKey_idx" ON "action_executions"("idempotencyKey");

CREATE INDEX "action_verifications_actionExecutionId_status_idx" ON "action_verifications"("actionExecutionId", "status");

CREATE INDEX "audit_logs_workspaceId_timestamp_idx" ON "audit_logs"("workspaceId", "timestamp");
CREATE INDEX "audit_logs_websiteId_timestamp_idx" ON "audit_logs"("websiteId", "timestamp");

CREATE INDEX "job_runs_queueName_status_idx" ON "job_runs"("queueName", "status");
CREATE INDEX "job_runs_websiteId_status_idx" ON "job_runs"("websiteId", "status");

CREATE INDEX "outbox_events_status_nextAttemptAt_createdAt_idx" ON "outbox_events"("status", "nextAttemptAt", "createdAt");

-- Foreign Keys
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "websites" ADD CONSTRAINT "websites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "website_settings" ADD CONSTRAINT "website_settings_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "url_identities" ADD CONSTRAINT "url_identities_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crawl_runs" ADD CONSTRAINT "crawl_runs_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crawl_frontier_entries" ADD CONSTRAINT "crawl_frontier_entries_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "crawl_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crawled_pages" ADD CONSTRAINT "crawled_pages_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crawled_pages" ADD CONSTRAINT "crawled_pages_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "crawl_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "internal_link_edges" ADD CONSTRAINT "internal_link_edges_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "crawl_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crawl_issues" ADD CONSTRAINT "crawl_issues_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "crawl_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crawl_issues" ADD CONSTRAINT "crawl_issues_crawledPageId_fkey" FOREIGN KEY ("crawledPageId") REFERENCES "crawled_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "seo_events" ADD CONSTRAINT "seo_events_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seo_events" ADD CONSTRAINT "seo_events_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "crawl_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "topic_clusters" ADD CONSTRAINT "topic_clusters_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_subtopics" ADD CONSTRAINT "topic_subtopics_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "topic_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_ruleDefinitionId_fkey" FOREIGN KEY ("ruleDefinitionId") REFERENCES "rule_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scoring_profile_versions" ADD CONSTRAINT "scoring_profile_versions_scoringProfileId_fkey" FOREIGN KEY ("scoringProfileId") REFERENCES "scoring_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seo_recommendations" ADD CONSTRAINT "seo_recommendations_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seo_tasks" ADD CONSTRAINT "seo_tasks_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seo_tasks" ADD CONSTRAINT "seo_tasks_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "seo_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "action_executions" ADD CONSTRAINT "action_executions_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_executions" ADD CONSTRAINT "action_executions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "seo_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "action_executions" ADD CONSTRAINT "action_executions_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "seo_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "action_verifications" ADD CONSTRAINT "action_verifications_actionExecutionId_fkey" FOREIGN KEY ("actionExecutionId") REFERENCES "action_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "seo_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
