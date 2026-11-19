# Known Issues, Blockers & Production Prerequisites

**Audit Baseline Commit:** `7628cf5f812c5956cedad1e03a1960b27f8eb077`  
**Certified Hardened HEAD:** `4a06f51f99d8c4061617cb69da3aa00959c91953`  
**Timestamp:** 2026-11-19T11:53:00+05:30  

---

## 1. P0 Blockers (Critical Launch Gate Dependencies)

### P0-1: External Store Live Staging Credentials (Gate D.1)
* **Description:** Local connector unit tests (`CON-01..04`) confirm AES-256-GCM credential encryption, SSRF protection, HMAC signature verification, and offline mapping. However, live API communication tests (`CON-05..08`) and the 11-point staging matrix (`STG-SHP-01` through `STG-ERR-01`) cannot execute without live staging endpoints.
* **Prerequisite Action:**
  1. Provision a Shopify Partner Development Store with Admin API access token (`read_products`, `write_products`, `read_inventory`, `write_inventory`).
  2. Provision an OpenCart 4.x Staging instance with installed SaaS Connector Extension and API signing secret.
  3. Execute `STG-SHP-01` through `STG-ERR-01` against these live endpoints.

### P0-2: Stripe Live Production Credentials & Webhook Route (Gate D.2)
* **Description:** All sandbox billing flows, webhook HMAC verification, and idempotency checks (`BIL-01..05`) passed locally. Live payment processing cannot be certified without real production configuration.
* **Prerequisite Action:**
  1. Register live domain endpoint (`https://api.yourdomain.com/api/v1/billing/webhook`) in Stripe Production Dashboard.
  2. Configure live production secrets: `STRIPE_SECRET_KEY` (`sk_live_...`) and `STRIPE_WEBHOOK_SECRET` (`whsec_...`).
  3. Execute a live $1.00 end-to-end test checkout with payment verification and immediate refund.

---

## 2. P1 Operational Prerequisites (Infrastructure & Observability)

### P1-1: Cloud APM & Centralized Sentry DSN Deployment (Gate D.3)
* **Description:** Error telemetry architecture (`ErrorTelemetryService`, `system_error_logs`, client error boundaries) is fully implemented and tested with sensitive data redaction (`TEL-01..08`). In production, this should stream to an external APM dashboard (Sentry or GlitchTip).
* **Prerequisite Action:**
  1. Create a Sentry or GlitchTip project.
  2. Set `SENTRY_DSN` in production environment configuration.
  3. Verify automated error alerting to engineering channels (Slack/PagerDuty).

### P1-2: Host Disk Capacity Alerting Cron (Gate D.3)
* **Description:** Sharp image processing and PostgreSQL volume writes require active host disk monitoring to avoid disk saturation.
* **Prerequisite Action:**
  1. Configure node-exporter or simple cron job checking `df -h` on root and Docker volumes.
  2. Trigger warning alert if volume utilization exceeds 85%.

---

## 3. P2 Architectural & Enhancement Opportunities (Post-Launch)

### P2-1: Non-Transactional Migration Step in Deployment CI/CD Pipeline
* **Description:** Migration `05_product_attributes_gin_index.sql` utilizes `CREATE INDEX CONCURRENTLY` to avoid taking exclusive locks on `product_attributes`. Since `CONCURRENTLY` cannot execute within a transaction block, deployment pipelines must run migration 05 in autocommit mode outside of standard migration wrappers.
* **Resolution:** Fully documented in `docs/audits/VERIFICATION_EVIDENCE.md` and automated via `scripts/check_gin.js`.

### P2-2: Fencing Tokens for Distributed Worker Execution
* **Description:** Distributed Redis locks (`lock:scheduler:global_scan`) use a 55-second TTL. If a background worker executes for longer than 55 seconds, another pod could theoretically attempt a scan.
* **Mitigation:** BullMQ job locks maintain independent heartbeat renewal, and `BackgroundSyncSchedulerService` processes jobs using database transactions and idempotency keys (`lock:sync:store_{id}`).
