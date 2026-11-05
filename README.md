# AI Product Intelligence Platform (Enterprise SaaS)

Enterprise Multi-Tenant AI Product Intelligence & E-Commerce Integration Platform.

The platform extracts, resolves, deduplicates, verifies, enriches, and synchronizes product intelligence across global e-commerce channels, manufacturer sources, and headless storefronts.

---

## 📑 Table of Contents
1. [Architecture Overview](#-architecture-overview)
2. [Phase 1 to Phase 7 Core Engine Roadmap](#-phase-1-to-phase-7-core-engine-roadmap)
3. [Monorepo Directory Structure](#-monorepo-directory-structure)
4. [Prerequisites & System Requirements](#-prerequisites--system-requirements)
5. [Step-by-Step Developer Setup Guide](#-step-by-step-developer-setup-guide)
6. [Services, Ports & Endpoints](#-services-ports--endpoints)
7. [Database & Schema Management (Drizzle ORM)](#-database--schema-management-drizzle-orm)
8. [External Integration REST API (Phase 7)](#-external-integration-rest-api-phase-7)
9. [Running Verification & Test Suites](#-running-verification--test-suites)
10. [Troubleshooting Common Issues](#-troubleshooting-common-issues)

---

## 🏛 Architecture Overview

The system is designed with a **deterministic-first, AI-assisted** architecture. Product data moves through strict verification pipelines before being mapped to global intelligence or tenant catalogs:

```text
External Client / Store / Crawler
                ↓
    Source Acquisition & Normalization
                ↓
    Deterministic Identity Resolution (GTIN/EAN Checksum, MPN, Brand)
                ↓
    Data Quality & Confidence Assessment (Completeness, Trust Ratings)
                ↓
         ┌──────────────┴──────────────┐
         │                             │
    [VERIFIED / HIGH]          [CONFLICT / UNCERTAIN]
         │                             │
    Global Intelligence          Human Review Center
    + Tenant Catalog Merged      (Manual Correction Audit)
         │                             │
         └──────────────┬──────────────┘
                        ↓
     External Integration REST API & Webhooks
         (Shopify, WooCommerce, ERP Workers)
```

---

## 🚀 Phase 1 to Phase 7 Core Engine Roadmap

| Phase | Subsystem | Description & Key Responsibilities |
|---|---|---|
| **Phase 1** | **Global Product Intelligence & Smart Data Reuse** | Pre-scrape intelligence cache check. When a product already exists canonically, scrapes and AI tokens are completely avoided. |
| **Phase 2** | **Product Identity Resolution & Deduplication** | Deterministic multi-source matching by GTIN-14, EAN-13, Brand+MPN, and normalized model numbers to prevent duplicate catalog entities. |
| **Phase 3** | **Data Freshness & Change Detection** | Automated price and stock drift monitoring. Detects manufacturer changes and staleness thresholds (>30 days). |
| **Phase 4** | **Controlled AI Intelligence Layer** | Strict eligibility engine. AI is only invoked when deterministic processing leaves gaps. Preserves raw source data and writes audit provenance. |
| **Phase 5** | **Advanced Product Discovery & Source Ranking** | Multi-source acquisition engine. Accepts URLs or Barcodes, queries catalog intelligence first, and ranks distributor sources by trust score. |
| **Phase 6** | **Data Quality, Confidence Scoring & Review Center** | Field-level confidence (`EXACT`, `HIGH`, `MISSING`, `CONFLICT`), GTIN mathematical checksum validation, and human review correction workflows. |
| **Phase 7** | **Product Intelligence API & Integration Platform** | External REST v1 API with API Key authentication (`pk_<prefix>_<secret>`), sliding window rate limiting (120 req/min), scoped permissions, and HMAC-SHA256 webhooks. |

---

## 📂 Monorepo Directory Structure

```text
├── apps/
│   ├── api/                       # Core Node.js / Express REST API (Port 4000)
│   │   ├── src/
│   │   │   ├── docs/              # OpenAPI 3.0.3 Swagger specification
│   │   │   ├── middleware/        # JWT, API Key Auth, Scope & Quota guards
│   │   │   ├── routes/            # Modular REST routes (auth, products, review, integrations, metrics)
│   │   │   ├── services/          # Core engines (Quality, Discovery, Identity, AI, Integration)
│   │   │   └── utils/             # Barcode checksum & URL normalizers
│   └── dashboard/                 # Next.js 14 App Router Frontend (Port 3000)
│       ├── src/app/
│       │   ├── (auth)/            # Login, Registration, Forgot Password
│       │   ├── admin/             # Platform Super Admin Portal (Health, Review Center, Traffic)
│       │   ├── products/          # Client Catalog & Product Workspace with Quality Cards
│       │   ├── settings/          # Tenant security, API Keys, Webhooks, AI Rules, Billing
│       │   └── stores/            # Shopify & WooCommerce sync bridges
├── services/
│   └── scraping-engine/           # Python 3.11 / FastAPI Scraping Engine (Port 8001)
│       ├── app/                   # BeautifulSoup4, Playwright, and extraction pipelines
│       └── .venv/                 # Virtual environment
├── packages/
│   ├── database/                  # PostgreSQL Drizzle ORM schema, migrations, connection pool
│   │   └── src/schema/            # Modular tables (tenants, products, sources, operations, etc.)
│   ├── queue/                     # BullMQ & Redis queues (Scraping, Matching, Persistence)
│   ├── shared-types/              # Shared TypeScript contracts between apps
│   └── shared-config/             # Shared ESLint and TypeScript configs
├── infrastructure/                # Docker compose configs (PostgreSQL 16, Redis 7, MinIO, Qdrant)
└── docs/                          # Architecture audits, staging deployment guides, and reports
```

---

## 💻 Prerequisites & System Requirements

Ensure the following tools are installed on your development machine:

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **pnpm**: `v9.x` or higher (`npm install -g pnpm`)
- **Python**: `v3.11` (for scraping engine)
- **Docker Desktop**: Running with WSL2 / Linux containers
- **Git**: For version control

---

## 🛠 Step-by-Step Developer Setup Guide

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/mazhar2101995/scrappingtools.git
cd scrappingtools

# Install all monorepo package dependencies
pnpm install
```

### 2. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```
Ensure your `.env` contains valid credentials (default local values provided for Docker services):
```env
# Database & Cache
DATABASE_URL="postgres://postgres:postgres@localhost:5432/product_intelligence_dev"
REDIS_URL="redis://localhost:6379"

# Core API & Auth
PORT=4000
JWT_SECRET="super-secret-jwt-key-for-local-dev-min-32-chars"
API_URL="http://localhost:4000/api/v1"

# Next.js Dashboard
NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"
```

### 3. Start Infrastructure Containers (Docker)
Start PostgreSQL 16 and Redis 7 in the background:
```bash
docker compose up -d
```
Verify containers are healthy:
```bash
docker ps
# Should show saas_postgres (Port 5432) and saas_redis (Port 6379) healthy
```

### 4. Build Database Schema & Push Migrations
```bash
# Push latest Drizzle schema directly to database
pnpm --filter @saas/database db:push

# Build TypeScript database package
pnpm --filter @saas/database build
```

### 5. Setup Python Scraping Engine Virtual Environment
```bash
cd services/scraping-engine
python -m venv .venv

# Windows Powershell:
.venv\Scripts\Activate.ps1
# Mac/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cd ../..
```

---

## 🌐 Running Services Locally

You can run each service in separate terminal windows:

### Terminal 1: Core REST API Backend (Port 4000)
```bash
pnpm --filter @saas/api dev
```
*API will run at `http://localhost:4000` with Swagger UI at `http://localhost:4000/api/docs`.*

### Terminal 2: Python Scraping Engine (Port 8001)
```bash
# Windows Powershell:
$env:PYTHONPATH="services/scraping-engine"
services/scraping-engine/.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001

# Mac/Linux:
PYTHONPATH="services/scraping-engine" services/scraping-engine/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001
```

### Terminal 3: Next.js Frontend Dashboard (Port 3000)
```bash
pnpm --filter @saas/dashboard dev
```
*Dashboard will run at `http://localhost:3000`.*

---

## 🔌 External Integration REST API (Phase 7)

External applications (e-commerce stores, ERP synchronization workers, mobile apps) authenticate using scoped API keys via the `X-API-Key` header.

### Authentication Format
- Key Format: `pk_<prefix>_<secret>`
- Header: `X-API-Key: pk_f5fdf819_30fbb858...` (or `Authorization: Bearer pk_...`)
- Rate Limit: Default **120 requests/minute** per key with `X-RateLimit-*` headers.

### Available Granular Scopes
- `products:read` — Canonical product lookup & tenant catalog reading.
- `products:discover` — Submit async product discovery jobs.
- `products:quality:read` — Detailed confidence ratings and checksum audits.
- `products:write` — Register webhook subscriptions & custom overrides.

### Core Lookup Example
```bash
curl -X GET "http://localhost:4000/api/v1/integrations/products/lookup?identifier=0020334680864" \
  -H "X-API-Key: pk_your_key_here"
```

### Sample Standardized Response
```json
{
  "status": "FOUND",
  "product": {
    "id": "01542e5b-4fab-4867-a621-5ba36a559c40",
    "identity": {
      "canonicalTitle": "Sony WH-1000XM5 Wireless Headphones (Black)",
      "modelNumber": "WH1000XM5/B"
    },
    "identifiers": {
      "gtin": "0020334680864",
      "mpn": "WH1000XM5/B"
    }
  },
  "quality": {
    "status": "VERIFIED",
    "score": 95,
    "completeness": 100
  },
  "freshness": {
    "isStale": false,
    "freshnessDays": 2
  },
  "provenance": {
    "summary": "Aggregated across 4 validated field provenance records"
  }
}
```

---

## 🧪 Running Verification & Test Suites

The project contains complete automated test suites covering all phases:

```bash
# 1. Typecheck the entire repository
pnpm --filter @saas/api exec tsc --noEmit
pnpm --filter @saas/dashboard exec tsc --noEmit

# 2. Run Phase 7 Integration E2E Test Suite (8 Scenarios)
node -e "/* integration test script located in docs/reports */"

# 3. Interactive API Explorer
Open http://localhost:4000/api/docs in your browser.
```

---

## ❓ Troubleshooting Common Issues

### 1. Dashboard CSS / Styling Not Loading (Unstyled Text)
- **Cause**: Next.js locked build cache in `.next/trace`.
- **Solution**:
  ```powershell
  Remove-Item -Recurse -Force apps/dashboard/.next
  pnpm --filter @saas/dashboard dev
  ```
  Then hard reload your browser with **`Ctrl` + `F5`**.

### 2. Barcode Checksum Validation Fails
- **Cause**: The platform implements GS1 standard Modulo-10 checksum validation.
- **Solution**: If testing with non-standard mock numbers, note that numbers failing mathematical checksums will automatically be flagged with `status: "CONFLICT"` and review priority `CRITICAL` by design (Phase 6 rule).

### 3. Port Conflicts (Port 4000 or 3000 in use)
```powershell
# Windows: Find and kill process on port 4000
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```

---

## 👥 Contributing Guidelines
- Maintain strict multi-tenant isolation (`organizationId` on all tenant-specific queries).
- Preserve raw scraped source payloads when running AI normalization.
- Ensure all new public routes are documented in `apps/api/src/docs/openapi.ts`.
- Run `tsc --noEmit` before committing code to ensure zero compilation errors.
