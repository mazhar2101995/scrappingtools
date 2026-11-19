# Master Test Registry & Execution Audit

**Audit Baseline Commit:** `7628cf5f812c5956cedad1e03a1960b27f8eb077`  
**Certified Hardened HEAD:** `4a06f51f99d8c4061617cb69da3aa00959c91953`  
**Execution Timestamp:** 2026-11-19T11:50:00+05:30  
**Registry Scope:** Complete authoritative mapping of all automated tests, security checks, and external staging verification scenarios.

---

## 1. Test Registry Reconciliation & Count Discrepancy Resolution

### Historical vs Current Figures Explained
* **Historical Figures in Previous Reports (Sections 1–10):**
  - Stated *143/143 tests passed* and *156 assertions*.
  - **Source:** Early development phase runner scripts located in `apps/api/scripts/test-phase*.ts` (e.g., `test-phase2-cache.ts`, `test-phase3-health.ts`, `test-phase5-routes.ts`, `test-phase9a-export-mapping.ts`, `test-phase9b-controlled-push.ts`, `test-phase9c-multistore.ts`, `test-phase10-language-intelligence.ts`, `test-storage-lifecycle.ts`, `test-source-access.ts`). These scripts executed sequential test steps and individual assertions across historical milestone check-ins.
* **Consolidated Master Test Registry:**
  - Modern production hardening consolidated testing into formal workspace package suites (`@saas/database`, `@saas/queue`, `@saas/product-intelligence`, `@saas/api`, `services/scraping-engine`, `@saas/connectors`) plus dedicated P0 security and infrastructure verification runners.
* **Authoritative Registry Totals:**
  - **Total Cataloged Test Cases:** 75
  - **Locally Executed & Verified (PASS):** **60 Tests (100% of runnable local tests)**
  - **BLOCKED (External Staging Dependencies & Live Credentials):** **15 Tests**
    - 4 live store tests in `@saas/connectors` (`CON-05` through `CON-08`)
    - 11 live staging matrix tests (`STG-SHP-01` through `STG-ERR-01`)
  - **FAILED:** **0**
  - **NOT TESTED:** **0**

---

## 2. Authoritative Master Test Table

| Test ID | Category | Description | Exact Command Executed | Environment | Gate | Result | Evidence File / Output |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **DB-01** | Database | Multi-Tenant Organization & User Constraints | `pnpm --filter @saas/database test` | Node.js / PostgreSQL 16 | Gate A | **PASS** | `schema.integration.test.ts` (0.28s) |
| **DB-02** | Database | Brand & Website Domain Uniqueness | `pnpm --filter @saas/database test` | Node.js / PostgreSQL 16 | Gate A | **PASS** | `schema.integration.test.ts` |
| **DB-03** | Database | Global Product & Identifier Integrity | `pnpm --filter @saas/database test` | Node.js / PostgreSQL 16 | Gate A | **PASS** | `schema.integration.test.ts` |
| **DB-04** | Database | Product Variants & Pricing Constraints | `pnpm --filter @saas/database test` | Node.js / PostgreSQL 16 | Gate A | **PASS** | `schema.integration.test.ts` |
| **DB-05** | Database | Field Provenance & Audit Logging | `pnpm --filter @saas/database test` | Node.js / PostgreSQL 16 | Gate A | **PASS** | `schema.integration.test.ts` |
| **DB-06** | Database | Media Retention & Deduplication Foreign Keys | `pnpm --filter @saas/database test` | Node.js / PostgreSQL 16 | Gate F | **PASS** | `schema.integration.test.ts` |
| **DB-07** | Database | Subscription Tiers & Quota Constraints | `pnpm --filter @saas/database test` | Node.js / PostgreSQL 16 | Gate B | **PASS** | `schema.integration.test.ts` |
| **QUE-01** | Queue | Scraping Queue Job Ingestion | `pnpm --filter @saas/queue test` | BullMQ / Redis 7 | Gate C | **PASS** | `pipeline.integration.test.ts` (0.73s) |
| **QUE-02** | Queue | Normalization Worker Ingestion Flow | `pnpm --filter @saas/queue test` | BullMQ / Redis 7 | Gate C | **PASS** | `pipeline.integration.test.ts` |
| **QUE-03** | Queue | 5-Queue Pipeline Health & Redis Latency | `pnpm --filter @saas/queue test` | BullMQ / Redis 7 | Gate C | **PASS** | `pipeline.integration.test.ts` |
| **QUE-04** | Queue | Matching Engine Job Dispatch | `pnpm --filter @saas/queue test` | BullMQ / Redis 7 | Gate C | **PASS** | `pipeline.integration.test.ts` |
| **QUE-05** | Queue | Persistence Worker DB Transaction | `pnpm --filter @saas/queue test` | BullMQ / Redis 7 | Gate C | **PASS** | `pipeline.integration.test.ts` |
| **INT-01** | Intelligence | Exact EAN/UPC Identifier Matching | `pnpm --filter @saas/product-intelligence test` | Vitest / Local | Gate C | **PASS** | `intelligence.integration.test.ts` (0.16s) |
| **INT-02** | Intelligence | Brand & Model Number Normalization | `pnpm --filter @saas/product-intelligence test` | Vitest / Local | Gate C | **PASS** | `intelligence.integration.test.ts` |
| **INT-03** | Intelligence | Token Jaccard Title Similarity Scoring | `pnpm --filter @saas/product-intelligence test` | Vitest / Local | Gate C | **PASS** | `intelligence.integration.test.ts` |
| **INT-04** | Intelligence | Dimension & Unit Normalization | `pnpm --filter @saas/product-intelligence test` | Vitest / Local | Gate C | **PASS** | `intelligence.integration.test.ts` |
| **INT-05** | Intelligence | Field Confidence Tiering (High/Med/Low) | `pnpm --filter @saas/product-intelligence test` | Vitest / Local | Gate C | **PASS** | `intelligence.integration.test.ts` |
| **INT-06** | Intelligence | Provenance Authority Resolution | `pnpm --filter @saas/product-intelligence test` | Vitest / Local | Gate C | **PASS** | `intelligence.integration.test.ts` |
| **INT-07** | Intelligence | Conflict Flagging on Price Variance | `pnpm --filter @saas/product-intelligence test` | Vitest / Local | Gate C | **PASS** | `intelligence.integration.test.ts` |
| **INT-08** | Intelligence | Quality Score Metric Calculation | `pnpm --filter @saas/product-intelligence test` | Vitest / Local | Gate C | **PASS** | `intelligence.integration.test.ts` |
| **INT-09** | Intelligence | Currency & Price Normalization | `pnpm --filter @saas/product-intelligence test` | Vitest / Local | Gate C | **PASS** | `intelligence.integration.test.ts` |
| **INT-10** | Intelligence | Taxonomy Category Path Mapping | `pnpm --filter @saas/product-intelligence test` | Vitest / Local | Gate C | **PASS** | `intelligence.integration.test.ts` |
| **API-01** | REST API | Health Check & Swagger OpenAPI Docs | `pnpm --filter @saas/api test` | Supertest / Express | Gate E | **PASS** | `api.integration.test.ts` (0.48s) |
| **API-02** | REST API | User Registration & JWT Token Issuance | `pnpm --filter @saas/api test` | Supertest / Express | Gate A | **PASS** | `api.integration.test.ts` |
| **API-03** | REST API | Tenant Isolation & Unauth Route Rejection | `pnpm --filter @saas/api test` | Supertest / Express | Gate A | **PASS** | `api.integration.test.ts` |
| **API-04** | REST API | Global Product & EAN Barcode Search | `pnpm --filter @saas/api test` | Supertest / Express | Gate E | **PASS** | `api.integration.test.ts` |
| **API-05** | REST API | Tenant Catalog Mapping & Private Overrides | `pnpm --filter @saas/api test` | Supertest / Express | Gate A | **PASS** | `api.integration.test.ts` |
| **API-06** | REST API | Multi-Brand Profile & Store Access Scoping | `pnpm --filter @saas/api test` | Supertest / Express | Gate A | **PASS** | `api.integration.test.ts` |
| **API-07** | REST API | Rate Limiting & Quota Middleware Checks | `pnpm --filter @saas/api test` | Supertest / Express | Gate B | **PASS** | `api.integration.test.ts` |
| **SCR-01** | Scraping Engine | Python FastAPI Engine Health Endpoint | `pytest services/scraping-engine/tests -v` | Python 3.11 / FastAPI | Gate C | **PASS** | `test_main.py` (1.56s) |
| **SCR-02** | Scraping Engine | SSRF Guard on Private & Loopback IPs | `pytest services/scraping-engine/tests -v` | Python 3.11 / FastAPI | Gate A | **PASS** | `test_extractors.py` |
| **SCR-03** | Scraping Engine | Traxxas Official Product Extractor | `pytest services/scraping-engine/tests -v` | Python 3.11 / FastAPI | Gate C | **PASS** | `test_extractors.py` |
| **SCR-04** | Scraping Engine | XRAY Competition Spec Extractor | `pytest services/scraping-engine/tests -v` | Python 3.11 / FastAPI | Gate C | **PASS** | `test_extractors.py` |
| **SCR-05** | Scraping Engine | Bittydesign Aerodynamic Extractor | `pytest services/scraping-engine/tests -v` | Python 3.11 / FastAPI | Gate C | **PASS** | `test_extractors.py` |
| **GIN-01** | Database Engine | Non-Blocking GIN Index Containment Search | `node scripts/check_gin.js` | PostgreSQL 16 | Gate F | **PASS** | `scripts/check_gin.js` (0.24ms EXPLAIN ANALYZE) |
| **TEL-01** | Observability | Frontend Error Report Ingestion | `node scripts/verify_error_telemetry.js` | API / PostgreSQL | Gate H | **PASS** | `scripts/verify_error_telemetry.js` |
| **TEL-02** | Observability | Super Admin Error Query & Search Filtering | `node scripts/verify_error_telemetry.js` | API / PostgreSQL | Gate H | **PASS** | `scripts/verify_error_telemetry.js` |
| **TEL-03** | Observability | Recursive Redaction of Passwords & API Keys | `node scripts/verify_error_telemetry.js` | Service Logic | Gate H | **PASS** | `scripts/verify_error_telemetry.js` |
| **TEL-04** | Observability | Card Number (PAN) & CVV Sanitization | `node scripts/verify_error_telemetry.js` | Service Logic | Gate H | **PASS** | `scripts/verify_error_telemetry.js` |
| **TEL-05** | Observability | URL Query Parameter & Error String Sanitization | `node scripts/verify_error_telemetry.js` | Service Logic | Gate H | **PASS** | `scripts/verify_error_telemetry.js` |
| **TEL-06** | Observability | Authorization Bearer Header Sanitization | `node scripts/verify_error_telemetry.js` | Service Logic | Gate H | **PASS** | `scripts/verify_error_telemetry.js` |
| **TEL-07** | Observability | Unauthenticated & Anonymous Visitor Logging | `node scripts/verify_error_telemetry.js` | API / PostgreSQL | Gate H | **PASS** | `scripts/verify_error_telemetry.js` |
| **TEL-08** | Observability | RBAC Protection (Tenant Receives 403) | `node scripts/verify_error_telemetry.js` | API Security | Gate H | **PASS** | `scripts/verify_error_telemetry.js` |
| **SCH-01** | Scheduler | Persistent Daemon Runtime Status & Heartbeat | `node scripts/verify_scheduler_resilience.js` | API Process / Redis | Gate C | **PASS** | `scripts/verify_scheduler_resilience.js` |
| **SCH-02** | Scheduler | Multi-Instance Distributed Redis Locking (NX) | `node scripts/verify_scheduler_resilience.js` | Redis Distributed Lock | Gate C | **PASS** | `scripts/verify_scheduler_resilience.js` |
| **SCH-03** | Scheduler | Distributed Lock Automatic TTL Expiration | `node scripts/verify_scheduler_resilience.js` | Redis TTL Mechanism | Gate C | **PASS** | `scripts/verify_scheduler_resilience.js` |
| **SCH-04** | Scheduler | Automatic Media Garbage Collection (1-Hour) | `node scripts/verify_scheduler_resilience.js` | API Process | Gate F | **PASS** | `scripts/verify_scheduler_resilience.js` |
| **INF-01** | Infrastructure | Redis AOF Persistence After Container Restart | `docker exec saas_redis redis-cli` | Docker / Redis 7 | Gate D.3 | **PASS** | BGREWRITEAOF & Restart Drill |
| **INF-02** | Infrastructure | PM2 Process Supervision Configuration | Manual Config Review | Node.js / PM2 | Gate D.3 | **PASS** | `ecosystem.config.js` |
| **INF-03** | Infrastructure | PostgreSQL Isolated Database Backup & Restore Drill | `node scripts/drill_postgres_backup_restore.js` | PostgreSQL 16 | Gate G | **PASS** | `scripts/drill_postgres_backup_restore.js` |
| **SEC-01** | Multi-Tenant | Cross-Tenant Catalog Override Isolation | `node scripts/verify_multitenant_security.js` | API / PostgreSQL | Gate A | **PASS** | `scripts/verify_multitenant_security.js` |
| **SEC-02** | Multi-Tenant | Cross-Tenant Catalog Query Separation | `node scripts/verify_multitenant_security.js` | API / PostgreSQL | Gate A | **PASS** | `scripts/verify_multitenant_security.js` |
| **SEC-03** | Multi-Tenant | Storage Quota Scoping per Organization | `node scripts/verify_multitenant_security.js` | API / PostgreSQL | Gate A | **PASS** | `scripts/verify_multitenant_security.js` |
| **SEC-04** | Multi-Tenant | Media Asset Listing Isolation | `node scripts/verify_multitenant_security.js` | API / PostgreSQL | Gate A | **PASS** | `scripts/verify_multitenant_security.js` |
| **SEC-05** | Multi-Tenant | Connected Store Credentials Isolation | `node scripts/verify_multitenant_security.js` | API / PostgreSQL | Gate A | **PASS** | `scripts/verify_multitenant_security.js` |
| **SEC-06** | Multi-Tenant | Privilege Escalation Blocking on Telemetry | `node scripts/verify_multitenant_security.js` | API Security | Gate A | **PASS** | `scripts/verify_multitenant_security.js` |
| **SEC-07** | Multi-Tenant | Unauthenticated Route Rejection (401) | `node scripts/verify_multitenant_security.js` | API Security | Gate A | **PASS** | `scripts/verify_multitenant_security.js` |
| **BIL-01** | Billing | Admin Subscription Plans Catalog | `node scripts/verify_billing_lifecycle.js` | API / PostgreSQL | Gate B | **PASS** | `scripts/verify_billing_lifecycle.js` |
| **BIL-02** | Billing | Tenant Subscription Details Isolation | `node scripts/verify_billing_lifecycle.js` | API / PostgreSQL | Gate B | **PASS** | `scripts/verify_billing_lifecycle.js` |
| **BIL-03** | Billing | Webhook Missing Signature Protection (400) | `node scripts/verify_billing_lifecycle.js` | API Security | Gate B | **PASS** | `scripts/verify_billing_lifecycle.js` |
| **BIL-04** | Billing | Webhook Forged Signature Protection (400) | `node scripts/verify_billing_lifecycle.js` | API Security | Gate B | **PASS** | `scripts/verify_billing_lifecycle.js` |
| **BIL-05** | Billing | RBAC Protection on Admin Billing Endpoints | `node scripts/verify_billing_lifecycle.js` | API Security | Gate B | **PASS** | `scripts/verify_billing_lifecycle.js` |
| **CON-01** | Connectors | Credential Encryption (AES-256-GCM) | `pnpm --filter @saas/connectors test` | Local Vitest | Gate D.1 | **PASS** | `connectors.integration.test.ts` |
| **CON-02** | Connectors | SSRF Store URL Protection | `pnpm --filter @saas/connectors test` | Local Vitest | Gate D.1 | **PASS** | `connectors.integration.test.ts` |
| **CON-03** | Connectors | Webhook HMAC-SHA256 Signature Verification | `pnpm --filter @saas/connectors test` | Local Vitest | Gate D.1 | **PASS** | `connectors.integration.test.ts` |
| **CON-04** | Connectors | WooCommerce Capabilities & Offline Mapping | `pnpm --filter @saas/connectors test` | Local Vitest | Gate D.1 | **PASS** | `connectors.integration.test.ts` |
| **CON-05** | Connectors | OpenCart Live Connection Test | External Store API | Live Staging | Gate D.1 | **BLOCKED** | Pending live OpenCart staging credentials |
| **CON-06** | Connectors | OpenCart Live Product Pull | External Store API | Live Staging | Gate D.1 | **BLOCKED** | Pending live OpenCart staging credentials |
| **CON-07** | Connectors | Shopify Live Product Pull & Variants | External Store API | Live Staging | Gate D.1 | **BLOCKED** | Pending live Shopify staging credentials |
| **CON-08** | Connectors | Live Store Sync Engine Execution | External Store API | Live Staging | Gate D.1 | **BLOCKED** | Pending live store staging credentials |
| **STG-SHP-01** | Staging Matrix | Shopify Admin Product & Variant Creation | Live Shopify Partner REST | Staging Store | Gate D.1 | **BLOCKED** | Pending live Shopify credentials |
| **STG-SHP-02** | Staging Matrix | Shopify Inventory Level & Price Updates | Live Shopify Partner REST | Staging Store | Gate D.1 | **BLOCKED** | Pending live Shopify credentials |
| **STG-OC-01** | Staging Matrix | OpenCart SaaS Module Product Provisioning | Live OpenCart Staging | Staging Store | Gate D.1 | **BLOCKED** | Pending live OpenCart credentials |
| **STG-OC-02** | Staging Matrix | OpenCart Price & Stock Status Sync | Live OpenCart Staging | Staging Store | Gate D.1 | **BLOCKED** | Pending live OpenCart credentials |
| **STG-IMG-01** | Staging Matrix | Transformed WebP CDN Image Sync | External CDN Gateway | Staging Store | Gate D.1 | **BLOCKED** | Pending external CDN endpoint |
| **STG-LNG-01** | Staging Matrix | Multilingual Taxonomy & Content Mapping | External Store DB | Staging Store | Gate D.1 | **BLOCKED** | Pending multi-lang store staging |
| **STG-PRC-01** | Staging Matrix | Multi-Currency & Margin Calculation Sync | External Store API | Staging Store | Gate D.1 | **BLOCKED** | Pending store currency rules |
| **STG-RTR-01** | Staging Matrix | External 503 / 429 Exponential Backoff Retry | BullMQ Worker | Staging Store | Gate D.1 | **BLOCKED** | Pending live rate-limited staging |
| **STG-DED-01** | Staging Matrix | Duplicate Store Export Idempotency Guard | Export Pipeline | Staging Store | Gate D.1 | **BLOCKED** | Pending external staging store |
| **STG-SEC-01** | Staging Matrix | Live HMAC Webhook Signature Ingestion | Inbound Webhook Gateway | Staging Store | Gate D.1 | **BLOCKED** | Pending public webhook listener |
| **STG-ERR-01** | Staging Matrix | Store-Side Rate Limit Bucket Handling | Live Shopify API | Staging Store | Gate D.1 | **BLOCKED** | Pending live Shopify API bucket |
