-- Phase 6 Final Canary Hardening Migration

-- Create Enums if not exists
DO $$ BEGIN
    CREATE TYPE "SearchIntent" AS ENUM ('INFORMATIONAL', 'NAVIGATIONAL', 'COMMERCIAL', 'TRANSACTIONAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "FunnelStage" AS ENUM ('TOFU', 'MOFU', 'BOFU');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "BusinessValueTier" AS ENUM ('TIER_1_CORE_REVENUE', 'TIER_2_SECONDARY', 'TIER_3_LONG_TAIL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "KeywordTrackingStatus" AS ENUM ('DISCOVERED', 'TRACKED_PRIMARY', 'TRACKED_SECONDARY', 'DISCARDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "KeywordDiscoverySource" AS ENUM ('GSC_IMPORT', 'CRAWL_EXTRACTION', 'SEED_EXPANSION', 'COMPETITOR_OVERLAP', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "SerpFeatureType" AS ENUM ('ORGANIC_SNIPPET', 'FEATURED_SNIPPET', 'AI_OVERVIEW', 'PEOPLE_ALSO_ASK', 'LOCAL_PACK', 'KNOWLEDGE_PANEL', 'TOP_STORIES', 'VIDEO_CAROUSEL', 'IMAGE_PACK', 'SITELINKS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "SerpDevice" AS ENUM ('DESKTOP', 'MOBILE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "SerpEventType" AS ENUM ('RANK_CHANGE', 'FEATURE_GAINED', 'FEATURE_LOST', 'AI_OVERVIEW_TRIGGERED', 'AI_OVERVIEW_CITED', 'AI_OVERVIEW_LOST_CITATION', 'PAGE_ONE_ENTRY', 'TOP_3_ENTRY', 'COMPETITOR_SURGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "EntityType" AS ENUM ('ORGANIZATION', 'PERSON', 'PRODUCT', 'SERVICE', 'PLACE', 'TOPIC', 'EVENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Create missing tables if not exist
CREATE TABLE IF NOT EXISTS "seo_entities" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "targetUrlId" TEXT,
    "mentionCount" INTEGER NOT NULL DEFAULT 1,
    "associatedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "schemaType" TEXT,
    "wikidataId" TEXT,
    "knowledgeGraphId" TEXT,
    "sameAsUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_entities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "keyword_universe" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "normalizedKeyword" TEXT NOT NULL,
    "intent" "SearchIntent" NOT NULL DEFAULT 'INFORMATIONAL',
    "funnelStage" "FunnelStage" NOT NULL DEFAULT 'TOFU',
    "businessValueTier" "BusinessValueTier" NOT NULL DEFAULT 'TIER_2_SECONDARY',
    "trackingStatus" "KeywordTrackingStatus" NOT NULL DEFAULT 'DISCOVERED',
    "discoverySource" "KeywordDiscoverySource" NOT NULL DEFAULT 'GSC_IMPORT',
    "searchVolumeMonthly" INTEGER,
    "cpc" DOUBLE PRECISION,
    "competitionScore" DOUBLE PRECISION,
    "targetUrlId" TEXT,
    "preferredUrl" TEXT,
    "primaryClusterId" TEXT,
    "primaryEntityId" TEXT,
    "difficultyScore" INTEGER NOT NULL DEFAULT 50,
    "relevanceScore" INTEGER NOT NULL DEFAULT 50,
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "isPrimaryForCluster" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isCannibalized" BOOLEAN NOT NULL DEFAULT false,
    "lastSerpSnapshotAt" TIMESTAMP(3),
    "provenanceSource" TEXT NOT NULL DEFAULT 'KEYWORD_DISCOVERY_ENGINE',
    "provenanceMethod" TEXT NOT NULL DEFAULT 'GSC_INGESTION',
    "provenanceTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_universe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "serp_snapshots" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "device" "SerpDevice" NOT NULL DEFAULT 'DESKTOP',
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "locationName" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerName" TEXT NOT NULL DEFAULT 'SERP_CLIENT',
    "hasAiOverview" BOOLEAN NOT NULL DEFAULT false,
    "aiOverviewText" TEXT,
    "targetWebsiteRank" INTEGER,
    "targetWebsiteFound" BOOLEAN NOT NULL DEFAULT false,
    "targetRankedUrl" TEXT,
    "targetUrlIdentityId" TEXT,
    "featuresDetected" "SerpFeatureType"[] DEFAULT ARRAY[]::"SerpFeatureType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serp_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "serp_items" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT,
    "displayUrl" TEXT,
    "isTargetWebsite" BOOLEAN NOT NULL DEFAULT false,
    "urlIdentityId" TEXT,
    "pixelHeight" INTEGER,
    "pixelTop" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serp_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "serp_feature_occurrences" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "featureType" "SerpFeatureType" NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "targetUrl" TEXT,
    "domain" TEXT,
    "sourceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isTargetWebsiteCited" BOOLEAN NOT NULL DEFAULT false,
    "targetUrlIdentityId" TEXT,
    "pixelHeight" INTEGER,
    "pixelTop" INTEGER,
    "rawFeatureJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serp_feature_occurrences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "keyword_rank_daily" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "device" "SerpDevice" NOT NULL DEFAULT 'DESKTOP',
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "rank" INTEGER,
    "previousRank" INTEGER,
    "rankChange" INTEGER,
    "rankedUrl" TEXT,
    "rankedUrlIdentityId" TEXT,
    "isTargetUrlMatched" BOOLEAN NOT NULL DEFAULT false,
    "hasFeaturedSnippet" BOOLEAN NOT NULL DEFAULT false,
    "hasAiOverviewCitation" BOOLEAN NOT NULL DEFAULT false,
    "aiOverviewOnSerp" BOOLEAN NOT NULL DEFAULT false,
    "totalFeaturesOnSerp" INTEGER NOT NULL DEFAULT 0,
    "visibilityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "visibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ctrModelUsed" TEXT NOT NULL DEFAULT 'STANDARD_ORGANIC_V1',
    "snapshotId" TEXT,
    "provenanceSource" TEXT NOT NULL DEFAULT 'SERP_INGESTION',
    "provenanceMethod" TEXT NOT NULL DEFAULT 'DAILY_AGGREGATE',
    "provenanceTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_rank_daily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "serp_snapshot_events" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "eventType" "SerpEventType" NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "description" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL,
    "recommendationId" TEXT,
    "isActionable" BOOLEAN NOT NULL DEFAULT false,
    "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serp_snapshot_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "competitor_domains" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT,
    "isDirectCompetitor" BOOLEAN NOT NULL DEFAULT true,
    "isExcluded" BOOLEAN NOT NULL DEFAULT false,
    "isPlatform" BOOLEAN NOT NULL DEFAULT false,
    "exclusionReason" TEXT,
    "sharedKeywordsCount" INTEGER NOT NULL DEFAULT 0,
    "outrankingCount" INTEGER NOT NULL DEFAULT 0,
    "outrankedByUsCount" INTEGER NOT NULL DEFAULT 0,
    "averagePosition" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "visibilityIndex" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "provenanceSource" TEXT NOT NULL DEFAULT 'DISCOVERY_ENGINE',
    "provenanceMethod" TEXT NOT NULL DEFAULT 'SERP_OVERLAP_ANALYSIS',
    "provenanceTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_domains_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "competitor_daily_facts" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sharedKeywords" INTEGER NOT NULL DEFAULT 0,
    "top3Keywords" INTEGER NOT NULL DEFAULT 0,
    "top10Keywords" INTEGER NOT NULL DEFAULT 0,
    "averagePosition" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "visibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "visibilityDifference" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_daily_facts_pkey" PRIMARY KEY ("id")
);

-- 2. Add columns to websites
ALTER TABLE "websites" ADD COLUMN IF NOT EXISTS "autonomyCircuitBroken" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "websites" ADD COLUMN IF NOT EXISTS "circuitBreakerReason" TEXT;
ALTER TABLE "websites" ADD COLUMN IF NOT EXISTS "circuitBreakerTrippedAt" TIMESTAMP(3);

-- 3. Add columns to action_executions
ALTER TABLE "action_executions" ADD COLUMN IF NOT EXISTS "attributionMaturityAt" TIMESTAMP(3);
ALTER TABLE "action_executions" ADD COLUMN IF NOT EXISTS "eligibleAt" TIMESTAMP(3);

-- 4. Add columns to action_approval_requests
ALTER TABLE "action_approval_requests" ADD COLUMN IF NOT EXISTS "payloadHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "action_approval_requests" ADD COLUMN IF NOT EXISTS "riskTier" TEXT NOT NULL DEFAULT 'LOW';
ALTER TABLE "action_approval_requests" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "action_approval_requests" ADD COLUMN IF NOT EXISTS "consumedAt" TIMESTAMP(3);
ALTER TABLE "action_approval_requests" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "action_approval_requests" ADD COLUMN IF NOT EXISTS "recommendationId" TEXT;
ALTER TABLE "action_approval_requests" ADD COLUMN IF NOT EXISTS "taskId" TEXT;

-- 5. Foreign Keys & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "keyword_universe_websiteId_normalizedKeyword_key" ON "keyword_universe"("websiteId", "normalizedKeyword");
CREATE UNIQUE INDEX IF NOT EXISTS "serp_items_snapshotId_position_key" ON "serp_items"("snapshotId", "position");
CREATE UNIQUE INDEX IF NOT EXISTS "keyword_rank_daily_websiteId_keywordId_device_countryCode_date_key" ON "keyword_rank_daily"("websiteId", "keywordId", "device", "countryCode", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "competitor_domains_websiteId_domain_key" ON "competitor_domains"("websiteId", "domain");
CREATE UNIQUE INDEX IF NOT EXISTS "competitor_daily_facts_competitorId_date_key" ON "competitor_daily_facts"("competitorId", "date");

DO $$ BEGIN
  ALTER TABLE "seo_entities" ADD CONSTRAINT "seo_entities_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "keyword_universe" ADD CONSTRAINT "keyword_universe_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "serp_snapshots" ADD CONSTRAINT "serp_snapshots_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "serp_snapshots" ADD CONSTRAINT "serp_snapshots_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keyword_universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "serp_items" ADD CONSTRAINT "serp_items_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "serp_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "serp_feature_occurrences" ADD CONSTRAINT "serp_feature_occurrences_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "serp_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "keyword_rank_daily" ADD CONSTRAINT "keyword_rank_daily_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "keyword_rank_daily" ADD CONSTRAINT "keyword_rank_daily_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keyword_universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "serp_snapshot_events" ADD CONSTRAINT "serp_snapshot_events_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "serp_snapshot_events" ADD CONSTRAINT "serp_snapshot_events_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "keyword_universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "competitor_domains" ADD CONSTRAINT "competitor_domains_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "competitor_daily_facts" ADD CONSTRAINT "competitor_daily_facts_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "competitor_daily_facts" ADD CONSTRAINT "competitor_daily_facts_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitor_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
