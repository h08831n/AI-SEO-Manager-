-- AlterTable "integrations"
ALTER TABLE "integrations" ADD COLUMN "connectedAccount" TEXT;
ALTER TABLE "integrations" ADD COLUMN "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "integrations" ADD COLUMN "tokenExpiry" TIMESTAMP(3);
ALTER TABLE "integrations" ADD COLUMN "connectedAt" TIMESTAMP(3);
ALTER TABLE "integrations" ADD COLUMN "lastRefreshAt" TIMESTAMP(3);
ALTER TABLE "integrations" ADD COLUMN "lastSuccessfulApiCallAt" TIMESTAMP(3);
ALTER TABLE "integrations" ADD COLUMN "lastError" TEXT;

-- CreateTable "search_console_property_bindings"
CREATE TABLE "search_console_property_bindings" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "providerPropertyId" TEXT NOT NULL,
    "providerPropertyType" TEXT NOT NULL,
    "permissionLevel" TEXT NOT NULL DEFAULT 'SITE_RESTRICTED_USER',
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_console_property_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable "ga4_property_bindings"
CREATE TABLE "ga4_property_bindings" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "providerAccountId" TEXT,
    "providerAccountName" TEXT,
    "providerPropertyId" TEXT NOT NULL,
    "providerDisplayName" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "customKeyEvents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ga4_property_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable "oauth_state_sessions"
CREATE TABLE "oauth_state_sessions" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "websiteId" TEXT,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'GSC',
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_state_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable "integration_sync_runs"
CREATE TABLE "integration_sync_runs" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "dataset" TEXT NOT NULL,
    "syncType" TEXT NOT NULL DEFAULT 'INCREMENTAL_SYNC',
    "requestedStartDate" DATE NOT NULL,
    "requestedEndDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rowsFetched" INTEGER NOT NULL DEFAULT 0,
    "rowsUpserted" INTEGER NOT NULL DEFAULT 0,
    "pagesFetched" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastCursor" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable "gsc_search_analytics_facts"
CREATE TABLE "gsc_search_analytics_facts" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "syncRunId" TEXT,
    "urlIdentityId" TEXT,
    "date" DATE NOT NULL,
    "grain" TEXT NOT NULL DEFAULT 'SITE_DAILY',
    "pageUrl" TEXT,
    "query" TEXT,
    "country" TEXT NOT NULL DEFAULT 'GLOBAL',
    "device" TEXT NOT NULL DEFAULT 'ALL',
    "searchType" TEXT NOT NULL DEFAULT 'WEB',
    "searchAppearance" TEXT,
    "dataState" TEXT NOT NULL DEFAULT 'FINALIZED',
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "provenance" TEXT NOT NULL DEFAULT 'MEASURED_PROVIDER',
    "urlMatchStatus" TEXT NOT NULL DEFAULT 'MATCHED_URL_IDENTITY',
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gsc_search_analytics_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable "ga4_landing_page_daily"
CREATE TABLE "ga4_landing_page_daily" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "syncRunId" TEXT,
    "urlIdentityId" TEXT,
    "date" DATE NOT NULL,
    "landingPageUrl" TEXT NOT NULL,
    "channelGroup" TEXT NOT NULL DEFAULT 'Organic Search',
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "engagedSessions" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "keyEvents" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dataState" TEXT NOT NULL DEFAULT 'FINALIZED',
    "provenance" TEXT NOT NULL DEFAULT 'MEASURED_PROVIDER',
    "urlMatchStatus" TEXT NOT NULL DEFAULT 'MATCHED_URL_IDENTITY',
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ga4_landing_page_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable "ga4_channel_daily"
CREATE TABLE "ga4_channel_daily" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "syncRunId" TEXT,
    "date" DATE NOT NULL,
    "defaultChannelGroup" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "engagedSessions" INTEGER NOT NULL DEFAULT 0,
    "users" INTEGER NOT NULL DEFAULT 0,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "keyEvents" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dataState" TEXT NOT NULL DEFAULT 'FINALIZED',
    "provenance" TEXT NOT NULL DEFAULT 'MEASURED_PROVIDER',
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ga4_channel_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_console_property_bindings_websiteId_key" ON "search_console_property_bindings"("websiteId");
CREATE INDEX "search_console_property_bindings_integrationId_idx" ON "search_console_property_bindings"("integrationId");
CREATE INDEX "search_console_property_bindings_providerPropertyId_idx" ON "search_console_property_bindings"("providerPropertyId");

CREATE UNIQUE INDEX "ga4_property_bindings_websiteId_key" ON "ga4_property_bindings"("websiteId");
CREATE INDEX "ga4_property_bindings_integrationId_idx" ON "ga4_property_bindings"("integrationId");
CREATE INDEX "ga4_property_bindings_providerPropertyId_idx" ON "ga4_property_bindings"("providerPropertyId");

CREATE UNIQUE INDEX "oauth_state_sessions_state_key" ON "oauth_state_sessions"("state");
CREATE INDEX "oauth_state_sessions_state_expiresAt_idx" ON "oauth_state_sessions"("state", "expiresAt");
CREATE INDEX "oauth_state_sessions_workspaceId_userId_idx" ON "oauth_state_sessions"("workspaceId", "userId");

CREATE INDEX "integration_sync_runs_websiteId_status_idx" ON "integration_sync_runs"("websiteId", "status");
CREATE INDEX "integration_sync_runs_integrationId_provider_idx" ON "integration_sync_runs"("integrationId", "provider");
CREATE INDEX "integration_sync_runs_websiteId_requestedStartDate_requestedEndDate_idx" ON "integration_sync_runs"("websiteId", "requestedStartDate", "requestedEndDate");

CREATE UNIQUE INDEX "gsc_search_analytics_facts_websiteId_date_grain_pageUrl_query_country_device_searchType_key" ON "gsc_search_analytics_facts"("websiteId", "date", "grain", "pageUrl", "query", "country", "device", "searchType");
CREATE INDEX "gsc_search_analytics_facts_websiteId_date_idx" ON "gsc_search_analytics_facts"("websiteId", "date");
CREATE INDEX "gsc_search_analytics_facts_websiteId_grain_date_idx" ON "gsc_search_analytics_facts"("websiteId", "grain", "date");
CREATE INDEX "gsc_search_analytics_facts_websiteId_pageUrl_date_idx" ON "gsc_search_analytics_facts"("websiteId", "pageUrl", "date");
CREATE INDEX "gsc_search_analytics_facts_websiteId_query_date_idx" ON "gsc_search_analytics_facts"("websiteId", "query", "date");
CREATE INDEX "gsc_search_analytics_facts_syncRunId_idx" ON "gsc_search_analytics_facts"("syncRunId");
CREATE INDEX "gsc_search_analytics_facts_urlIdentityId_idx" ON "gsc_search_analytics_facts"("urlIdentityId");

CREATE UNIQUE INDEX "ga4_landing_page_daily_websiteId_date_landingPageUrl_channelGroup_key" ON "ga4_landing_page_daily"("websiteId", "date", "landingPageUrl", "channelGroup");
CREATE INDEX "ga4_landing_page_daily_websiteId_date_idx" ON "ga4_landing_page_daily"("websiteId", "date");
CREATE INDEX "ga4_landing_page_daily_websiteId_landingPageUrl_date_idx" ON "ga4_landing_page_daily"("websiteId", "landingPageUrl", "date");
CREATE INDEX "ga4_landing_page_daily_syncRunId_idx" ON "ga4_landing_page_daily"("syncRunId");
CREATE INDEX "ga4_landing_page_daily_urlIdentityId_idx" ON "ga4_landing_page_daily"("urlIdentityId");

CREATE UNIQUE INDEX "ga4_channel_daily_websiteId_date_defaultChannelGroup_key" ON "ga4_channel_daily"("websiteId", "date", "defaultChannelGroup");
CREATE INDEX "ga4_channel_daily_websiteId_date_idx" ON "ga4_channel_daily"("websiteId", "date");
CREATE INDEX "ga4_channel_daily_syncRunId_idx" ON "ga4_channel_daily"("syncRunId");

-- AddForeignKey
ALTER TABLE "search_console_property_bindings" ADD CONSTRAINT "search_console_property_bindings_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "search_console_property_bindings" ADD CONSTRAINT "search_console_property_bindings_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ga4_property_bindings" ADD CONSTRAINT "ga4_property_bindings_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ga4_property_bindings" ADD CONSTRAINT "ga4_property_bindings_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_sync_runs" ADD CONSTRAINT "integration_sync_runs_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_sync_runs" ADD CONSTRAINT "integration_sync_runs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gsc_search_analytics_facts" ADD CONSTRAINT "gsc_search_analytics_facts_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gsc_search_analytics_facts" ADD CONSTRAINT "gsc_search_analytics_facts_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "integration_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gsc_search_analytics_facts" ADD CONSTRAINT "gsc_search_analytics_facts_urlIdentityId_fkey" FOREIGN KEY ("urlIdentityId") REFERENCES "url_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ga4_landing_page_daily" ADD CONSTRAINT "ga4_landing_page_daily_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ga4_landing_page_daily" ADD CONSTRAINT "ga4_landing_page_daily_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "integration_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ga4_landing_page_daily" ADD CONSTRAINT "ga4_landing_page_daily_urlIdentityId_fkey" FOREIGN KEY ("urlIdentityId") REFERENCES "url_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ga4_channel_daily" ADD CONSTRAINT "ga4_channel_daily_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ga4_channel_daily" ADD CONSTRAINT "ga4_channel_daily_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "integration_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
