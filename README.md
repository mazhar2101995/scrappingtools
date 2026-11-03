# AI Product Intelligence SaaS

Production-grade AI Product Intelligence SaaS Monorepo.

## Project Structure

```
├── apps/
│   ├── api/                     # Node.js/Express Core Backend (Port 4000)
│   └── dashboard/               # Next.js 14 Frontend UI (Port 3000)
├── services/
│   ├── scraping-engine/         # Python 3.11 FastAPI Scraping Engine (Port 8000)
│   ├── ai-engine/               # AI models & classification
│   └── product-intelligence/    # Data aggregation pipelines
├── packages/
│   ├── shared-types/            # Shared TypeScript contracts
│   ├── shared-config/           # Centralized tsconfigs & lint configs
│   └── api-client/              # Shared typed client
├── infrastructure/              # Docker, PostgreSQL, Redis, Qdrant, MinIO configs
├── docs/                        # Architecture & local development documentation
└── scripts/                     # Developer utility scripts
```

## Quick Start

1. **Copy Environment Variables**:
   ```bash
   cp .env.example .env
   ```
2. **Start Infrastructure**:
   ```bash
   pnpm run docker:up
   ```
3. **Start Core API**:
   ```bash
   pnpm run dev:api
   ```
4. **Start Scraping Engine**:
   ```bash
   pnpm run dev:python
   ```
5. **Start Frontend Dashboard**:
   ```bash
   pnpm run dev:dashboard
   ```

Detailed setup and troubleshooting: See [LOCAL_SETUP.md](docs/setup/LOCAL_SETUP.md).

