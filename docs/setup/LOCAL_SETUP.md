# Local Development Environment Setup Guide

## AI Product Intelligence SaaS

This document provides complete instructions for running, operating, maintaining, and troubleshooting the AI Product Intelligence SaaS development environment on Windows.

---

## 1. System & Runtime Prerequisites

| Requirement | Installed / Recommended Version | Purpose |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 Pro 64-bit | Local host OS |
| **Node.js** | v20.11.1 (LTS) / v26 Active LTS | Main Monorepo & Backend API runtime |
| **Package Manager** | `pnpm` v9.15.4 | Monorepo workspace package management |
| **Python** | 3.11.2 (via virtual environment) | Scraping Engine, AI Extraction & Parsing |
| **Docker Engine** | Docker Desktop 4.x / Engine | PostgreSQL, Redis, Qdrant, MinIO |
| **Git** | 2.39.0+ | Version control |

---

## 2. Why Each Technology & Programming Language is Used

### TypeScript & Node.js (`apps/api`, `apps/dashboard`, `packages/*`)
- **TypeScript**: Provides compile-time type safety across the entire stack, preventing runtime schema mismatches.
- **Node.js / Express / NestJS**: High throughput, non-blocking asynchronous event loop ideal for orchestrating I/O-heavy API gateways, webhook dispatching, authentication, and BullMQ queue job scheduling.
- **Next.js & React 18+**: React Server Components, efficient server-side rendering (SSR), and seamless developer experience for dashboards and real-time monitoring.

### Python 3.11 (`services/scraping-engine`, `services/ai-engine`)
- **FastAPI & Pydantic**: Native async request handling with strict data validation.
- **Playwright, BeautifulSoup4 & lxml**: The Python data-extraction ecosystem has battle-tested support for complex headless DOM evaluation, anti-bot mitigation, dynamic JavaScript rendering, and lightning-fast XPath/CSS tree parsing via native C-bindings in `lxml`.

### Database & Caching
- **PostgreSQL 16/18**: Strict relational data integrity, JSONB support for semi-structured scraping snapshots, and battle-tested ACID compliance.
- **Redis 7**: In-memory data store for distributed rate-limiting, scraping deduplication locks, and BullMQ background task queuing.

### ORM Selection: Prisma vs Drizzle
**Architectural Recommendation: Drizzle ORM**
- **Zero-overhead TypeScript SQL-like syntax**: Unlike Prisma which uses an external C++ binary engine that incurs performance overhead in high-throughput data workloads, Drizzle is lightweight and compiles directly to native SQL queries.
- **PostgreSQL JSONB and Extension Support**: Drizzle maps directly to PostgreSQL dialect features, vital for storing scraped product variations and dynamic schemas.

---

## 3. Architecture Overview

The codebase is structured as a modular monorepo:

```
ai-product-intelligence/
├── apps/
│   ├── api/                     # Core Backend API (Port 4000)
│   └── dashboard/               # Next.js UI Frontend (Port 3000)
├── services/
│   ├── scraping-engine/         # Python FastAPI Scraping Microservice (Port 8000)
│   ├── ai-engine/               # AI & Extraction processing models
│   └── product-intelligence/    # Aggregation & analysis logic
├── packages/
│   ├── shared-types/            # Shared TypeScript contracts & schemas
│   ├── shared-config/           # Centralized lint/tsconfig presets
│   └── api-client/              # Generated typed SDK client
├── infrastructure/
│   ├── docker/                  # Dockerfile configurations
│   ├── postgres/init/           # Automated DB initialization scripts
│   ├── redis/                   # Redis configuration & persistence
│   ├── qdrant/                  # Optional Vector Store storage
│   └── minio/                   # Optional S3-compatible asset store
├── docs/                        # Architecture, setup & security docs
├── scripts/                     # Dev automation & orchestration scripts
├── .env.example                 # Verified environment variable template
├── docker-compose.yml           # Core & optional infrastructure services
├── pnpm-workspace.yaml          # Monorepo configuration
└── README.md                    # Project documentation
```

---

## 4. How to Start All Services

### Step 1: Start Infrastructure Containers
Start the core database and cache (PostgreSQL and Redis):
```powershell
pnpm run docker:up
```

If vector search (`Qdrant`) and object storage (`MinIO`) are needed:
```powershell
pnpm run docker:optional
```

### Step 2: Start Python Scraping Engine
Activate the virtual environment and start FastAPI:
```powershell
.\.venv\Scripts\Activate.ps1
uvicorn services.scraping-engine.main:app --reload --port 8000
```

### Step 3: Start Node.js Core API Backend
In a separate terminal:
```powershell
pnpm run dev:api
```

### Step 4: Start Frontend Dashboard
In a separate terminal:
```powershell
pnpm run dev:dashboard
```

---

## 5. How to Stop All Services

### Stop Docker Containers
```powershell
pnpm run docker:down
```

To stop containers and wipe volume data (clean reset):
```powershell
docker compose down -v
```

### Stop Running Dev Servers
In each PowerShell terminal running an application or service, press `Ctrl + C`.

---

## 6. How to Restart Individual Services

- **Restart PostgreSQL**: `docker compose restart postgres`
- **Restart Redis**: `docker compose restart redis`
- **Restart Backend API**: Press `Ctrl + C` in the API terminal, then run `pnpm run dev:api`.
- **Restart Python Scraping Service**: Press `Ctrl + C` in the Python terminal, then run `pnpm run dev:python`.

---

## 7. How to Access PostgreSQL

### Via Docker CLI (`psql`)
```powershell
docker exec -it saas_postgres psql -U postgres -d product_intelligence_dev
```

### Via GUI Client (DBeaver, TablePlus, pgAdmin)
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `product_intelligence_dev`
- **Username**: `postgres`
- **Password**: `postgres_dev_password` (from `.env`)

---

## 8. How to Inspect Logs

- **All Docker logs**: `docker compose logs -f`
- **Postgres logs**: `docker compose logs -f postgres`
- **Redis logs**: `docker compose logs -f redis`
- **API Backend**: Real-time console stream in the `pnpm run dev:api` terminal.
- **Scraping Engine**: Real-time access & error logs in the `uvicorn` terminal.

---

## 9. How to Run Migrations & Database Scripts

Database initialization scripts are stored in [`infrastructure/postgres/init/01-init.sql`](file:///d:/xampp82/htdocs/Project/saas-tools/infrastructure/postgres/init/01-init.sql). Docker automatically executes these on first container initialization.

To run custom SQL queries or manual migrations:
```powershell
docker exec -i saas_postgres psql -U postgres -d product_intelligence_dev < infrastructure/postgres/init/01-init.sql
```

---

## 10. How to Troubleshoot Common Errors

### `EPERM: operation not permitted` during Corepack or Global npm installs
Windows UAC protects `C:\Program Files\nodejs`. Use `npm install -g <package>` or run PowerShell as Administrator.

### `docker : The term 'docker' is not recognized`
Docker Desktop is not installed or not added to system PATH.
- Verify Docker Desktop installation: Download from [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
- Ensure the WSL2 backend or Hyper-V feature is enabled in Windows.

### Python ModuleNotFoundError in Virtual Environment
Always execute Python scripts using the dedicated virtual environment:
```powershell
.\.venv\Scripts\python.exe -m pytest services/scraping-engine/tests
```

