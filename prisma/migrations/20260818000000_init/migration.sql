-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('GSC', 'GA4', 'WORDPRESS', 'SHEETS', 'RANK_TRACKER');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('NOT_CONFIGURED', 'CONNECTING', 'CONNECTED', 'DEGRADED', 'ERROR', 'DISCONNECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('RECOMMENDATION_ONLY', 'DRY_RUN_PENDING', 'DRY_RUN_COMPLETED', 'APPROVAL_REQUIRED', 'APPROVED', 'SCHEDULED', 'EXECUTING', 'EXECUTED_VERIFYING', 'VERIFIED_SUCCESS', 'VERIFIED_REGRESSED', 'FAILED', 'REVERTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AutomationRiskLevel" AS ENUM ('LEVEL_0_SUGGESTION_ONLY', 'LEVEL_1_SAFE_AUTOMATION', 'LEVEL_2_REVIEW_REQUIRED', 'LEVEL_3_HIGH_RISK_MANUAL_ONLY');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "crawl_runs" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "totalIssues" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "triggerSource" TEXT NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "crawl_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawled_pages" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "loadTimeMs" INTEGER NOT NULL,
    "isIndexable" BOOLEAN NOT NULL DEFAULT true,
    "canonicalUrl" TEXT,
    "canonicalMatch" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT,
    "titleLength" INTEGER NOT NULL DEFAULT 0,
    "metaDescription" TEXT,
    "metaDescLength" INTEGER NOT NULL DEFAULT 0,
    "metaRobots" TEXT,
    "xRobotsTag" TEXT,
    "h1Tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "h2Count" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "internalOutlinksCount" INTEGER NOT NULL DEFAULT 0,
    "externalOutlinksCount" INTEGER NOT NULL DEFAULT 0,
    "imagesCount" INTEGER NOT NULL DEFAULT 0,
    "missingAltCount" INTEGER NOT NULL DEFAULT 0,
    "schemaTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawled_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_issues" (
    "id" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "crawledPageId" TEXT,
    "type" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "seo_recommendations" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "impactScore" INTEGER NOT NULL DEFAULT 5,
    "effortScore" INTEGER NOT NULL DEFAULT 5,
    "riskScore" INTEGER NOT NULL DEFAULT 3,
    "businessValue" INTEGER NOT NULL DEFAULT 5,
    "automationLevel" "AutomationRiskLevel" NOT NULL DEFAULT 'LEVEL_1_SAFE_AUTOMATION',
    "status" "ActionStatus" NOT NULL DEFAULT 'RECOMMENDATION_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_tasks" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "opportunityScore" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "automationLevel" "AutomationRiskLevel" NOT NULL DEFAULT 'LEVEL_1_SAFE_AUTOMATION',
    "status" "ActionStatus" NOT NULL DEFAULT 'RECOMMENDATION_ONLY',
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

-- CreateTable
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
    "provenance" TEXT NOT NULL DEFAULT 'USER_PROVIDED',
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobId" TEXT,
    "payloadJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_workspaceId_idx" ON "users"("workspaceId");

-- CreateIndex
CREATE INDEX "websites_workspaceId_idx" ON "websites"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "websites_workspaceId_domain_key" ON "websites"("workspaceId", "domain");

-- CreateIndex
CREATE INDEX "integrations_websiteId_idx" ON "integrations"("websiteId");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_websiteId_provider_key" ON "integrations"("websiteId", "provider");

-- CreateIndex
CREATE INDEX "crawl_runs_websiteId_startedAt_idx" ON "crawl_runs"("websiteId", "startedAt");

-- CreateIndex
CREATE INDEX "crawled_pages_websiteId_url_idx" ON "crawled_pages"("websiteId", "url");

-- CreateIndex
CREATE INDEX "crawled_pages_crawlRunId_idx" ON "crawled_pages"("crawlRunId");

-- CreateIndex
CREATE INDEX "crawl_issues_crawlRunId_severity_idx" ON "crawl_issues"("crawlRunId", "severity");

-- CreateIndex
CREATE INDEX "search_analytics_daily_websiteId_date_idx" ON "search_analytics_daily"("websiteId", "date");

-- CreateIndex
CREATE INDEX "search_analytics_daily_websiteId_query_idx" ON "search_analytics_daily"("websiteId", "query");

-- CreateIndex
CREATE INDEX "search_analytics_daily_websiteId_page_idx" ON "search_analytics_daily"("websiteId", "page");

-- CreateIndex
CREATE UNIQUE INDEX "search_analytics_daily_websiteId_date_query_page_device_cou_key" ON "search_analytics_daily"("websiteId", "date", "query", "page", "device", "country");

-- CreateIndex
CREATE INDEX "topic_clusters_websiteId_idx" ON "topic_clusters"("websiteId");

-- CreateIndex
CREATE INDEX "topic_subtopics_clusterId_idx" ON "topic_subtopics"("clusterId");

-- CreateIndex
CREATE INDEX "seo_recommendations_websiteId_status_idx" ON "seo_recommendations"("websiteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "seo_tasks_idempotencyKey_key" ON "seo_tasks"("idempotencyKey");

-- CreateIndex
CREATE INDEX "seo_tasks_websiteId_status_idx" ON "seo_tasks"("websiteId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_timestamp_idx" ON "audit_logs"("workspaceId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_websiteId_timestamp_idx" ON "audit_logs"("websiteId", "timestamp");

-- CreateIndex
CREATE INDEX "job_runs_queueName_status_idx" ON "job_runs"("queueName", "status");

-- CreateIndex
CREATE INDEX "outbox_events_status_createdAt_idx" ON "outbox_events"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "websites" ADD CONSTRAINT "websites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_runs" ADD CONSTRAINT "crawl_runs_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawled_pages" ADD CONSTRAINT "crawled_pages_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawled_pages" ADD CONSTRAINT "crawled_pages_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "crawl_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_issues" ADD CONSTRAINT "crawl_issues_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "crawl_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_issues" ADD CONSTRAINT "crawl_issues_crawledPageId_fkey" FOREIGN KEY ("crawledPageId") REFERENCES "crawled_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_clusters" ADD CONSTRAINT "topic_clusters_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_subtopics" ADD CONSTRAINT "topic_subtopics_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "topic_clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_recommendations" ADD CONSTRAINT "seo_recommendations_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_tasks" ADD CONSTRAINT "seo_tasks_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_tasks" ADD CONSTRAINT "seo_tasks_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "seo_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "seo_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
