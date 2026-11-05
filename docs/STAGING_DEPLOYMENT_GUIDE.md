# Staging Deployment & Community Testing Architecture Guide

## 1. Server & System Requirements
- **Operating System**: Ubuntu 22.04 LTS / Debian 12 / Windows Server 2022
- **CPU**: Minimum 2 vCPUs (Recommended: 4 vCPUs for Playwright rendering)
- **RAM**: Minimum 4 GB (Recommended: 8 GB)
- **Storage**: Minimum 30 GB SSD (Recommended: 50+ GB NVMe)
- **Container Runtime**: Docker Engine 24.0+ and Docker Compose v2.20+
- **Node.js**: v20.11+ LTS / pnpm 9.0+
- **Python**: 3.11+ LTS

---

## 2. Infrastructure Services Architecture

```mermaid
graph TD
    Client[Community Tester Browser] --> NGINX[Reverse Proxy / SSL]
    NGINX -->|port 3000| NextUI[Next.js 14 Dashboard]
    NGINX -->|port 4000| RestAPI[Express Core REST API]
    RestAPI -->|Database| PG[(PostgreSQL 16 Multi-Tenant)]
    RestAPI -->|Jobs / Cache| Redis[(Redis 7 BullMQ Cluster)]
    Redis --> Worker[BullMQ Workers Service]
    Worker -->|port 8001| PythonEngine[FastAPI Python Scraping Engine]
```

### Deployed Services
1. **Next.js 14 Frontend Dashboard** (`localhost:3000`): Light Luxury White & Gold interface with tester onboarding, visual auto mapping, and feedback reporting.
2. **Core Express REST API** (`localhost:4000`): Tenant-isolated authentication, catalog, brand profiles, health monitors, feedback submission, and BullMQ job management.
3. **PostgreSQL 16** (`saas_postgres:5432`): Multi-tenant isolation schemas with Row-Level Security (RLS) and JSONB configuration stores.
4. **Redis 7** (`saas_redis:6379`): Low-latency message broker powering BullMQ scraping, normalization, and identity-matching pipelines.
5. **Python Scraping Service** (`127.0.0.1:8001`): FastAPI + BeautifulSoup4 + Playwright stealth engine for dynamic and JavaScript-heavy storefronts.

---

## 3. Environment Variables Configuration

Create a `.env.staging` file in the project root:

```env
# Application Environment
NODE_ENV=staging
PORT=4000
DASHBOARD_URL=https://staging.yourdomain.com
API_URL=https://staging-api.yourdomain.com

# PostgreSQL Connection
POSTGRES_HOST=saas_postgres
POSTGRES_PORT=5432
POSTGRES_DB=product_intelligence_staging
POSTGRES_USER=saas_staging_user
POSTGRES_PASSWORD=your_secure_postgres_password_here
DATABASE_URL=postgres://saas_staging_user:your_secure_postgres_password_here@saas_postgres:5432/product_intelligence_staging

# Redis Connection
REDIS_HOST=saas_redis
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_redis_password_here

# Security & Authentication
JWT_SECRET=your_isolated_staging_jwt_secret_minimum_64_characters
JWT_EXPIRES_IN=24h
COOKIE_SECRET=your_cookie_signing_secret

# AI Processing (Optional Fallbacks)
GEMINI_API_KEY=your_staging_gemini_key
AI_TEMPERATURE=0.2

# Python Scraping Engine
SCRAPING_SERVICE_URL=http://127.0.0.1:8001
PYTHONPATH=/app/services/scraping-engine
```

> [!WARNING]
> Never share credentials, database instances, or JWT secrets between Staging and Production.

---

## 4. Step-by-Step Staging Deployment

### Step 1: Clone & Configure
```bash
git clone https://github.com/mazhar2101995/scrappingtools.git /opt/saas-tools
cd /opt/saas-tools
cp .env.staging.example .env.staging
```

### Step 2: Launch Databases & Caches
```bash
docker compose -f docker-compose.staging.yml up -d saas_postgres saas_redis
```

### Step 3: Run Database Migrations
```bash
pnpm install --frozen-lockfile
pnpm --filter @saas/database build
pnpm --filter @saas/api db:migrate
```

### Step 4: Start Microservices & Applications
```bash
# Start Python Scraping Engine
cd services/scraping-engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 2 &

# Start Core REST API & Dashboard via Process Manager (PM2 or Systemd)
pm2 start "pnpm --filter @saas/api start" --name saas-api
pm2 start "pnpm --filter @saas/dashboard start" --name saas-dashboard
```

### Step 5: Verify Deployment Health Checks
- Core REST API: `curl https://staging-api.yourdomain.com/health` (Expects: `status: "healthy"`)
- Scraping Engine: `curl http://127.0.0.1:8001/health` (Expects: `status: "healthy"`)
- BullMQ Engine: `curl -H "Authorization: Bearer <TOKEN>" https://staging-api.yourdomain.com/api/v1/jobs/stats`

---

## 5. Automated Backup & Recovery Procedures

### Staging Automated Backup (Cron Command)
Add this daily task to `/etc/cron.d/saas_staging_backup`:
```bash
0 2 * * * docker exec -t saas_postgres pg_dump -U postgres -F c -b -f /var/backups/staging_$(date +\%Y\%m\%d_\%H\%M).dump product_intelligence_staging
```

### Verified Manual Restore Verification
To restore to a clean database:
```bash
# 1. Create target restore database
docker exec -i saas_postgres psql -U postgres -c "CREATE DATABASE staging_restore_verify;"

# 2. Execute restore command
docker exec -i saas_postgres pg_restore -U postgres -d staging_restore_verify -v /var/backups/staging_backup.dump

# 3. Verify record integrity
docker exec -i saas_postgres psql -U postgres -d staging_restore_verify -c "SELECT count(*) FROM global_products;"
```

---

## 6. Rollback Procedure
If a staging release contains critical regression:
```bash
# 1. Stop current processes
pm2 stop saas-api saas-dashboard

# 2. Check out previous release tag
git checkout <PREVIOUS_COMMIT_OR_TAG>
pnpm install
pnpm build

# 3. Restart processes
pm2 restart saas-api saas-dashboard
```

