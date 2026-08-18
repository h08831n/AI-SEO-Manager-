# Autonomous AI SEO Manager — Deployment Architecture & Operations Guide

This application is built on a **portable, provider-agnostic architecture**. It does not lock you into any specific cloud provider, database vendor, or hosting platform.

---

## 1. Supported Deployment Profiles

### Profile A: Local Development (Hybrid)
*Best for rapid local feature iteration and debugging.*

* **Host Machine**: Runs the Next/Vite dev server and Express API (`npm run dev`)
* **Docker**: Runs PostgreSQL 16 and Redis 7 services

**Setup Steps:**
1. Start infrastructure services:
   ```bash
   docker compose up -d postgres redis
   ```
2. Copy environment file:
   ```bash
   cp .env.example .env
   ```
   Set `DATABASE_URL="postgresql://postgres:postgres_dev_password@localhost:5432/ai_seo_manager?schema=public"`
   Set `REDIS_URL="redis://localhost:6379"`
3. Push schema to database:
   ```bash
   npm run db:push
   ```
4. Start API process in terminal 1:
   ```bash
   npm run dev:api
   ```
5. *(Optional)* Start Background Worker process in terminal 2:
   ```bash
   npm run dev:worker
   ```

---

### Profile B: Full Docker / VPS Self-Hosted
*Best for single-server VPS (Hetzner, DigitalOcean, Linode, AWS EC2) or Docker Swarm/Kubernetes.*

* **Docker Compose**: Orchestrates all 4 decoupled containers:
  1. `postgres` (PostgreSQL 16 with persistent volume `postgres_data`)
  2. `redis` (Redis 7 with persistent volume `redis_data`)
  3. `api` (Web application and REST API server)
  4. `worker` (Autonomous background queue, crawl processing, and scheduled jobs)

**Setup Steps:**
1. Clone repository to server and create `.env` file:
   ```bash
   cp .env.example .env
   ```
2. Set secure production values in `.env`:
   ```env
   POSTGRES_PASSWORD=your_super_secret_db_password
   ENCRYPTION_MASTER_KEY=your_generated_32_byte_hex_key
   GEMINI_API_KEY=your_gemini_api_key
   ```
3. Launch all services:
   ```bash
   docker compose up -d --build
   ```
4. Apply database schema migrations inside container:
   ```bash
   docker compose exec api npm run db:push
   ```

---

### Profile C: Serverless Frontend/API + External Worker
*Best for scalable cloud architectures (e.g., Vercel / Cloud Run + Managed PostgreSQL + Dedicated Worker).*

* **Frontend & API**: Hosted on serverless or autoscaled container platforms (Vercel, Cloud Run). Handles synchronous user requests (< 30s timeouts).
* **Managed Database**: Any PostgreSQL provider (Neon, Supabase, Google Cloud SQL, AWS RDS, Aiven, or self-hosted PostgreSQL).
* **Managed Redis / Queue Broker**: Upstash Redis, AWS ElastiCache, Aiven, or Redis Cloud.
* **Persistent Background Worker**: Hosted on a container or VPS worker runtime (Cloud Run Jobs, Render Worker, Railway Worker, ECS).
  - Handles deep asynchronous HTML crawls, multi-page audits, entity extraction, and cron-scheduled SEO checks without being terminated by HTTP request timeouts.

---

## 2. Environment Variables Specification

All configuration is environment-driven. No hostnames or provider URLs are hardcoded in application logic:

| Variable | Requirement | Description | Example (Local vs Cloud) |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Required** | PostgreSQL connection string | `postgresql://postgres:pwd@localhost:5432/ai_seo_manager` or `postgresql://user:pwd@db.host.com:5432/seo?sslmode=require` |
| `DIRECT_URL` | Optional | Direct unpooled DB connection for migrations (e.g. Supabase/Neon) | `postgresql://user:pwd@db.host.com:5432/seo?sslmode=require` |
| `REDIS_URL` | Optional | Redis connection URI for queue management | `redis://localhost:6379` or `rediss://default:pwd@redis.host.com:6379` |
| `ENCRYPTION_MASTER_KEY` | **Required** | 32-byte (64 hex characters) AES-256-GCM encryption key | `openssl rand -hex 32` |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for AI reasoning | Configured in environment or AI Studio Secrets |
| `PORT` | Optional | Port for the HTTP API server | Defaults to `3000` |
| `NODE_ENV` | Optional | `development` or `production` | `production` |

---

## 3. Database Migration & Schema Sync Procedure

### Push Schema (Rapid Development & Initial Deployment)
```bash
npx prisma db push
# or
npm run db:push
```

### Production Migrations (Strict Versioned History)
1. Generate migration:
   ```bash
   npx prisma migrate dev --name <migration_name>
   ```
2. Apply migrations in CI/CD or production:
   ```bash
   npx prisma migrate deploy
   # or
   npm run db:migrate
   ```

---

## 4. Background Worker Runtime

The background worker is completely decoupled from the web application lifecycle:

* **Entrypoint**: `server/worker.ts`
* **Compiled Binary**: `dist/worker.cjs`
* **Startup Command**: `npm run start:worker`
* **Signal Handling**: Listens for `SIGTERM` and `SIGINT` to drain in-flight crawl tasks gracefully before exiting.

---

## 5. Security & Encryption Key Protocol

Integration credentials (such as Google Search Console OAuth tokens and WordPress Application Passwords) are encrypted using **AES-256-GCM** before persistence in PostgreSQL.

* **Key Generation**:
  ```bash
  openssl rand -hex 32
  ```
* **Security Rules**:
  1. Never commit `.env` or keys to version control.
  2. Never reuse development encryption keys in production.
  3. The `SecretVault` validates key presence and length at runtime; missing keys fail closed.
  4. Keys are never printed in log outputs or health check responses.

---

## 6. Health Checks & Observability

* **Liveness & Uptime Endpoint**:
  ```http
  GET /api/health
  ```
  Returns `{"status": "ok", "uptime": <seconds>}`

* **System Diagnostics Endpoint**:
  ```http
  GET /api/observability/status
  ```
  Returns connection state, memory usage, and component readiness without exposing secrets.

---

## 7. Backup & Recovery Considerations

* **PostgreSQL Volume Backup (Docker)**:
  ```bash
  docker compose exec postgres pg_dump -U postgres ai_seo_manager > backup_$(date +%Y%m%d).sql
  ```
* **PostgreSQL Restore**:
  ```bash
  cat backup_20260817.sql | docker compose exec -T postgres psql -U postgres ai_seo_manager
  ```
