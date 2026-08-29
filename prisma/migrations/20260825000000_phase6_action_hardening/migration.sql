-- CreateTable "action_pre_state_snapshots"
CREATE TABLE IF NOT EXISTS "action_pre_state_snapshots" (
    "id" TEXT NOT NULL,
    "actionExecutionId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_pre_state_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable "rollback_execution_histories"
CREATE TABLE IF NOT EXISTS "rollback_execution_histories" (
    "id" TEXT NOT NULL,
    "actionExecutionId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "restoredStateJson" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rollback_execution_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable "action_approval_requests"
CREATE TABLE IF NOT EXISTS "action_approval_requests" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "ruleKey" TEXT,
    "payloadJson" TEXT NOT NULL,
    "opportunityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LEVEL_1_SAFE_AUTOMATION',
    "state" TEXT NOT NULL DEFAULT 'PROPOSED',
    "proposedBy" TEXT NOT NULL DEFAULT 'DECISION_ENGINE',
    "approvedBy" TEXT,
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    "actionExecutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable "action_state_transition_logs"
CREATE TABLE IF NOT EXISTS "action_state_transition_logs" (
    "id" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_state_transition_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "action_pre_state_snapshots_actionExecutionId_idx" ON "action_pre_state_snapshots"("actionExecutionId");
CREATE INDEX IF NOT EXISTS "action_pre_state_snapshots_websiteId_idx" ON "action_pre_state_snapshots"("websiteId");

CREATE INDEX IF NOT EXISTS "rollback_execution_histories_actionExecutionId_idx" ON "rollback_execution_histories"("actionExecutionId");
CREATE INDEX IF NOT EXISTS "rollback_execution_histories_websiteId_idx" ON "rollback_execution_histories"("websiteId");

CREATE INDEX IF NOT EXISTS "action_approval_requests_websiteId_idx" ON "action_approval_requests"("websiteId");
CREATE INDEX IF NOT EXISTS "action_approval_requests_state_idx" ON "action_approval_requests"("state");
CREATE INDEX IF NOT EXISTS "action_approval_requests_createdAt_idx" ON "action_approval_requests"("createdAt");
CREATE INDEX IF NOT EXISTS "action_approval_requests_websiteId_state_createdAt_idx" ON "action_approval_requests"("websiteId", "state", "createdAt");

CREATE INDEX IF NOT EXISTS "action_state_transition_logs_approvalRequestId_idx" ON "action_state_transition_logs"("approvalRequestId");

-- AddForeignKeys
DO $$ BEGIN
  ALTER TABLE "action_pre_state_snapshots" ADD CONSTRAINT "action_pre_state_snapshots_actionExecutionId_fkey" FOREIGN KEY ("actionExecutionId") REFERENCES "action_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "action_pre_state_snapshots" ADD CONSTRAINT "action_pre_state_snapshots_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "rollback_execution_histories" ADD CONSTRAINT "rollback_execution_histories_actionExecutionId_fkey" FOREIGN KEY ("actionExecutionId") REFERENCES "action_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "rollback_execution_histories" ADD CONSTRAINT "rollback_execution_histories_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "action_approval_requests" ADD CONSTRAINT "action_approval_requests_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "action_state_transition_logs" ADD CONSTRAINT "action_state_transition_logs_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "action_approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
