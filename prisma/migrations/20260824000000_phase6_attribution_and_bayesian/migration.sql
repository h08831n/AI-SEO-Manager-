-- CreateTable "action_attribution_facts"
CREATE TABLE IF NOT EXISTS "action_attribution_facts" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "actionExecutionId" TEXT NOT NULL,
    "urlIdentityId" TEXT NOT NULL,
    "primaryKeywordId" TEXT,
    "seoEventId" TEXT,
    "ruleKey" TEXT NOT NULL,
    "cmsProvider" TEXT NOT NULL DEFAULT 'CUSTOM',
    "pageArchetype" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "executionDate" TIMESTAMP(3) NOT NULL,
    "baselineStartDate" TIMESTAMP(3) NOT NULL,
    "evaluationStartDate" TIMESTAMP(3) NOT NULL,
    "evaluationEndDate" TIMESTAMP(3) NOT NULL,
    "preAvgRank" DOUBLE PRECISION,
    "postAvgRank" DOUBLE PRECISION,
    "rankDelta" DOUBLE PRECISION,
    "preClicks30d" INTEGER NOT NULL DEFAULT 0,
    "postClicks30d" INTEGER NOT NULL DEFAULT 0,
    "clickLiftDelta" INTEGER NOT NULL DEFAULT 0,
    "preImpressions30d" INTEGER NOT NULL DEFAULT 0,
    "postImpressions30d" INTEGER NOT NULL DEFAULT 0,
    "impressionLiftDelta" INTEGER NOT NULL DEFAULT 0,
    "preCtr" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "postCtr" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ctrDelta" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "syntheticControlDelta" DOUBLE PRECISION,
    "netCausalLift" DOUBLE PRECISION NOT NULL,
    "outcomeCategory" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_attribution_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable "synthetic_control_matches"
CREATE TABLE IF NOT EXISTS "synthetic_control_matches" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "treatmentUrlId" TEXT NOT NULL,
    "controlUrlId" TEXT NOT NULL,
    "attributionFactId" TEXT,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "matchingFeaturesJson" TEXT NOT NULL,
    "baselinePreClicks" INTEGER NOT NULL DEFAULT 0,
    "baselinePostClicks" INTEGER NOT NULL DEFAULT 0,
    "baselinePreRank" DOUBLE PRECISION,
    "baselinePostRank" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "synthetic_control_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable "bayesian_rule_weight_states"
CREATE TABLE IF NOT EXISTS "bayesian_rule_weight_state" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "cmsProvider" TEXT NOT NULL DEFAULT 'ALL',
    "pageArchetype" TEXT NOT NULL DEFAULT 'ALL',
    "alphaPrior" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "betaPrior" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "observedWins" INTEGER NOT NULL DEFAULT 0,
    "observedLosses" INTEGER NOT NULL DEFAULT 0,
    "observedNeutrals" INTEGER NOT NULL DEFAULT 0,
    "alphaPosterior" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "betaPosterior" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "rawCalculatedWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "approvedAppliedWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isAutoDamped" BOOLEAN NOT NULL DEFAULT false,
    "approvalStatus" TEXT NOT NULL DEFAULT 'AUTO_APPROVED',
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastApprovedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bayesian_rule_weight_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "action_attribution_facts_actionExecutionId_key" ON "action_attribution_facts"("actionExecutionId");
CREATE INDEX IF NOT EXISTS "action_attribution_facts_websiteId_ruleKey_idx" ON "action_attribution_facts"("websiteId", "ruleKey");
CREATE INDEX IF NOT EXISTS "action_attribution_facts_outcomeCategory_idx" ON "action_attribution_facts"("outcomeCategory");
CREATE INDEX IF NOT EXISTS "action_attribution_facts_executionDate_idx" ON "action_attribution_facts"("executionDate");
CREATE INDEX IF NOT EXISTS "action_attribution_facts_seoEventId_idx" ON "action_attribution_facts"("seoEventId");

CREATE INDEX IF NOT EXISTS "synthetic_control_matches_treatmentUrlId_idx" ON "synthetic_control_matches"("treatmentUrlId");
CREATE INDEX IF NOT EXISTS "synthetic_control_matches_controlUrlId_idx" ON "synthetic_control_matches"("controlUrlId");
CREATE INDEX IF NOT EXISTS "synthetic_control_matches_attributionFactId_idx" ON "synthetic_control_matches"("attributionFactId");

CREATE UNIQUE INDEX IF NOT EXISTS "bayesian_rule_weight_states_websiteId_ruleKey_cmsProvider_pageArchetype_key" ON "bayesian_rule_weight_states"("websiteId", "ruleKey", "cmsProvider", "pageArchetype");
CREATE INDEX IF NOT EXISTS "bayesian_rule_weight_states_websiteId_approvedAppliedWeight_idx" ON "bayesian_rule_weight_states"("websiteId", "approvedAppliedWeight");

-- AddForeignKeys
DO $$ BEGIN
  ALTER TABLE "action_attribution_facts" ADD CONSTRAINT "action_attribution_facts_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "action_attribution_facts" ADD CONSTRAINT "action_attribution_facts_actionExecutionId_fkey" FOREIGN KEY ("actionExecutionId") REFERENCES "action_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "action_attribution_facts" ADD CONSTRAINT "action_attribution_facts_urlIdentityId_fkey" FOREIGN KEY ("urlIdentityId") REFERENCES "url_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "action_attribution_facts" ADD CONSTRAINT "action_attribution_facts_primaryKeywordId_fkey" FOREIGN KEY ("primaryKeywordId") REFERENCES "keyword_universes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "action_attribution_facts" ADD CONSTRAINT "action_attribution_facts_seoEventId_fkey" FOREIGN KEY ("seoEventId") REFERENCES "seo_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "synthetic_control_matches" ADD CONSTRAINT "synthetic_control_matches_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "synthetic_control_matches" ADD CONSTRAINT "synthetic_control_matches_treatmentUrlId_fkey" FOREIGN KEY ("treatmentUrlId") REFERENCES "url_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "synthetic_control_matches" ADD CONSTRAINT "synthetic_control_matches_controlUrlId_fkey" FOREIGN KEY ("controlUrlId") REFERENCES "url_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "synthetic_control_matches" ADD CONSTRAINT "synthetic_control_matches_attributionFactId_fkey" FOREIGN KEY ("attributionFactId") REFERENCES "action_attribution_facts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bayesian_rule_weight_states" ADD CONSTRAINT "bayesian_rule_weight_states_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
