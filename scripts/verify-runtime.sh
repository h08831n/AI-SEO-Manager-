#!/usr/bin/env bash
set -e

# ==============================================================================
# AI SEO MANAGER — REAL INFRASTRUCTURE RUNTIME VERIFICATION SUITE
# ==============================================================================
# This script executes the complete real-runtime acceptance gate against
# live PostgreSQL (16) and Redis (7) instances.
# ==============================================================================

echo "================================================================="
echo " AI SEO MANAGER — RUNTIME VERIFICATION GATE"
echo "================================================================="

# 1. Environment & Tools Check
if ! command -v docker >/dev/null 2>&1; then
  echo "[-] ERROR: Docker is required to run live PostgreSQL and Redis infrastructure."
  echo "[-] Please run this script in an environment with Docker installed or provide DATABASE_URL and REDIS_URL."
  exit 1
fi

echo "[+] 1. Starting PostgreSQL & Redis via Docker Compose..."
docker compose up -d postgres redis

echo "[+] 2. Waiting for database and Redis health..."
until docker compose exec postgres pg_isready -U postgres -d ai_seo_manager >/dev/null 2>&1; do
  echo "    ... waiting for PostgreSQL to be ready"
  sleep 2
done
echo "[✓] PostgreSQL is healthy."

until docker compose exec redis redis-cli ping | grep -q PONG; do
  echo "    ... waiting for Redis to be ready"
  sleep 2
done
echo "[✓] Redis is healthy."

# 2. Database Migration Deployment
echo "[+] 3. Running real database migrations (npx prisma migrate deploy)..."
DATABASE_URL="postgresql://postgres:postgres_dev_password@localhost:5432/ai_seo_manager?schema=public"
export DATABASE_URL
export REDIS_URL="redis://localhost:6379"
export APP_MODE="PRODUCTION"

npx prisma migrate deploy

# 3. Verify Database Schema & Table Existence
echo "[+] 4. Verifying runtime database schema and tables in PostgreSQL..."
TABLES=(
  "workspaces"
  "workspace_members"
  "websites"
  "crawl_runs"
  "url_identities"
  "crawl_frontier_entries"
  "crawled_pages"
  "crawl_issues"
  "internal_link_edges"
  "seo_events"
  "outbox_events"
  "job_runs"
  "audit_logs"
  "action_executions"
  "action_verifications"
  "search_console_property_bindings"
  "ga4_property_bindings"
  "oauth_state_sessions"
  "integration_sync_runs"
  "gsc_search_analytics_facts"
  "ga4_landing_page_daily"
  "ga4_channel_daily"
)

for tbl in "${TABLES[@]}"; do
  COUNT=$(docker compose exec -T postgres psql -U postgres -d ai_seo_manager -t -c "SELECT count(*) FROM information_schema.tables WHERE table_name = '$tbl';")
  if [ "$COUNT" -ge 1 ]; then
    echo "  [✓] Table verified: $tbl"
  else
    echo "  [-] Missing table: $tbl"
    exit 1
  fi
done

# Check locking and lease columns
COLUMNS=(
  "crawl_frontier_entries:lockedUntil"
  "crawl_frontier_entries:nextAttemptAt"
  "outbox_events:lockedUntil"
  "outbox_events:nextAttemptAt"
  "outbox_events:attemptCount"
)

for col in "${COLUMNS[@]}"; do
  TNAME="${col%%:*}"
  CNAME="${col##*:}"
  COL_EXISTS=$(docker compose exec -T postgres psql -U postgres -d ai_seo_manager -t -c "SELECT count(*) FROM information_schema.columns WHERE table_name = '$TNAME' AND column_name = '$CNAME';")
  if [ "$COL_EXISTS" -ge 1 ]; then
    echo "  [✓] Column verified: $TNAME.$CNAME"
  else
    echo "  [-] Missing column: $TNAME.$CNAME"
    exit 1
  fi
done

# 4. Build Code
echo "[+] 5. Verifying build and artifacts..."
npm run lint
npm run build

# 5. Run Live Integration Suite against Real DB and Redis
echo "[+] 6. Running comprehensive live integration and unit test suite..."
npm test

echo "================================================================="
echo " [✓] RUNTIME INFRASTRUCTURE VERIFICATION COMPLETED"
echo "================================================================="
