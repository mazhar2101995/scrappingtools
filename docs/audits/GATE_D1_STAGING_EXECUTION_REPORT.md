# Gate D.1 Controlled Staging Execution & Verification Report

**Audit Baseline Commit:** `7628cf5f812c5956cedad1e03a1960b27f8eb077`  
**Hardened HEAD:** `0252ee5` (and current execution)  
**Execution Timestamp:** 2026-11-19T14:38:00+05:30  
**Target Release Gate:** `Gate D.1 (External Store Staging Integration)`  
**Overall Gate Status:** `PARTIALLY VERIFIED / PROVISIONALLY HARDENED` (14/15 Scenarios Verified with Live Empirical Evidence; 1 Sub-Scenario Blocked Solely on External Public HTTPS Tunnel)  

---

## 1. Executive Summary & Objective

Following explicit owner authorization to execute staging verification using:
1. The authorized Shopify testing store **`mayda-com`** (`https://mayda-com.myshopify.com/`).
2. A dedicated local OpenCart 3.0.3.8 staging environment with an isolated MariaDB database (`oc_staging_d1`).
3. Controlled staging fault proxies for rate-limiting and error classification.

All 15 scenarios were executed, rigorously measured, and recorded.

### Core Principles Enforced:
- **No Production Store Writes:** Writes were strictly directed to `mayda-com` (dedicated development store) and `oc_staging_d1` (isolated local staging database).
- **100% Reversibility:** All temporary test products created on `mayda-com` were verified via GET and **immediately deleted via DELETE** (HTTP 200 -> 404 confirmed). Zero test artifacts remain on the Shopify store.
- **Strict Evidence Standard:** Scenarios are marked `VERIFIED (PASS)` only where exact external responses, database rows, and operational behaviors were confirmed.
- **Honest Boundary Enforcement:** Genuine public-Internet webhook delivery from Shopify's servers to `localhost:4000` requires a public HTTPS tunnel (`cloudflared tunnel --url http://localhost:4000`). Cryptographic validation and database reverse sync are **VERIFIED (PASS)**, while external direct internet delivery without a tunnel is accurately maintained as **`BLOCKED (Owner Tunnel Dependency)`**. Gate D.1 is not unconditionally promoted until this owner infrastructure prerequisite is attached.

---

## 2. Infrastructure & Staging Topology

| Component | Target / Host | Port / Protocol | Credentials / Configuration | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Shopify Staging Store** | `mayda-com.myshopify.com` | HTTPS (Shopify Cloud) | Admin Custom App Token (`X-Shopify-Access-Token`) | **ACTIVE & VERIFIED** |
| **OpenCart Staging Store** | `127.0.0.1:8080` | HTTP (PHP 8.2 Built-in Server) | SaaS Connector Module & Bridge | **ACTIVE & VERIFIED** |
| **OpenCart Database** | Docker `oc_staging_mysql` | 3307 (MariaDB 10.5.29) | DB: `oc_staging_d1`, User: `root` | **ACTIVE & VERIFIED** (136 tables) |
| **SaaS Core API** | `localhost:4000` | HTTP (Node.js API) | PostgreSQL 16 + Redis 7 AOF | **HEALTHY** |
| **SaaS Dashboard** | `localhost:3000` | HTTP (Next.js 14) | Tenant / Admin Auth | **HEALTHY** |
| **Fault Injection Proxy** | `127.0.0.1:9876` | HTTP (Node.js Test Proxy) | Rate Limit & Error Simulation | **VERIFIED** |

---

## 3. Comprehensive 15-Test Gate D.1 Execution Ledger

| Test ID | Platform | Target Component | Command Executed | Live Identifiers & External HTTP Response | Database / File Evidence | Expected vs Actual Result | Final Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CON-05** | OpenCart | `OpenCartConnector.testConnection` | `node scripts/verify_staging_export.js --platform opencart --action ping` | HTTP 200 OK<br>Latency: `214ms`<br>`version: '3.0.3.8'` | OpenCart `oc_setting` record `202`, `203` confirmed. Store status: `connected` in PostgreSQL. | Expected: Handshake response with version and status.<br>Actual: `status: 'CONNECTED_VERIFIED'`, PHP 8.2, MariaDB 10.5. | **VERIFIED (PASS)** |
| **CON-06** | OpenCart | `OpenCartConnector.pullProducts` | `node scripts/verify_staging_export.js --platform opencart --action pull` | HTTP 200 OK<br>Total items reported: `19`<br>Items retrieved: `5` | Retrieved `oc_product` rows. Sample item: `SAM1` (Samsung Galaxy Tab 10.1, $199.99). | Expected: Canonical product array from OpenCart catalog.<br>Actual: 100% matched canonical model. | **VERIFIED (PASS)** |
| **CON-07** | Shopify | `ShopifyConnector.pullProducts` | `node scripts/verify_staging_export.js --platform shopify --action pull` | HTTP 200 OK<br>Product GID: `gid://shopify/Product/10428815835391`<br>Variant GID: `gid://shopify/ProductVariant/50995901792511` | Pulled real catalog item `TRX77097-4` with 24 gallery images and full variant options. | Expected: Canonical product array with GID and variants.<br>Actual: SKU `TRX77097-4`, price $1349.95, 24 images. | **VERIFIED (PASS)** |
| **CON-08** | Shopify | `SynchronizationEngine.executeSync` | `node -e "new SynchronizationEngine().executeSync('ac8455f6-872a-4f07-9198-09c583797458', 'PULL')"` | HTTP 200 OK<br>Sync Duration: `693ms`<br>Processed: 1, Succeeded: 1 | `store_sync_history` ID: `79db16ab-db69-433e-b297-1cb584f31115`<br>`store_product_mappings` ID: `b5e488fa-7fec-42ab-883e-7671571d73ae` | Expected: Mapping record created and sync history logged in DB.<br>Actual: 100% matched. | **VERIFIED (PASS)** |
| **STG-SHP-01** | Shopify | `ShopifyConnector.pushProduct` | `node scripts/verify_staging_export.js --platform shopify --action create --confirm-write` | HTTP 201 Created<br>Created Product ID: `10451240681727`<br>Created SKU: `STG-TEST-3592` | Verified via live `GET /admin/api/2026-10/products/10451240681727.json`. Status: `active`, price: `$499.99`. | Expected: Isolated test product created on `mayda-com`.<br>Actual: Created, verified, and post-deleted. | **VERIFIED (PASS)** |
| **STG-SHP-02** | Shopify | Full Product, Price & Inventory Update | `node scripts/verify_shp_inventory.js` | HTTP 200 OK<br>Set Inventory HTTP 200 via `inventory_levels/set.json` (Location `83812548863`) | Read-back verification via `inventory_levels.json`: `available: 25`. Product `10451339051263` cleanly deleted (HTTP 404). | Expected: Actual inventory quantity changed and persisted on Shopify.<br>Actual: Quantity updated from 10 to 25 and confirmed. | **VERIFIED (PASS)** |
| **STG-OC-01** | OpenCart | `OpenCartConnector.pushProduct` | `node scripts/verify_staging_export.js --platform opencart --action create --confirm-write` | HTTP 200 OK<br>Created Product ID: `50`<br>SKU: `STG-TEST-0598` | MariaDB `oc_product`: `product_id: 50`, `model: STG-TEST-0598`, `price: 499.9900`, `status: 1`, `name: Staging Traxxas Test Vehicle`. | Expected: New product inserted in `oc_product` and `oc_product_description`.<br>Actual: 100% confirmed in DB. | **VERIFIED (PASS)** |
| **STG-OC-02** | OpenCart | `OpenCartConnector.updateProduct` | `node -e "connector.updateProduct('50', { price: 599.99, stockQuantity: 25 })"` | HTTP 200 OK<br>Return: `true` | MariaDB `oc_product`: `price: 599.9900`, `quantity: 25`, `date_modified: 2026-11-19 08:56:53`. | Expected: Updated price and stock persisted in database.<br>Actual: Confirmed updated in MariaDB. | **VERIFIED (PASS)** |
| **STG-DED-01** | Multi | Concurrency Guard & Application Idempotency | `node scripts/verify_application_idempotency.js` & `node scripts/verify_staging_resilience.js` | Redis NX lock rejection (Worker 2 `null`)<br>Application-level duplicate push rejected: HTTP 409 / Error thrown | Application idempotency message: `"Duplicate Push Blocked: This Change Plan has already been confirmed and executed."` | Expected: Both infrastructure Redis lock and application state machine prevent duplicate execution.<br>Actual: 100% verified. | **VERIFIED (PASS)** |
| **STG-IMG-01** | Multi | Remote Image Ingestion & SHA-256 Deduplication | `node -e "connector.pushProduct(imgProduct)"` | HTTP 200 OK<br>Product ID: `53`<br>Downloaded & validated PNG binary | MariaDB `oc_saas_image_registry`: SHA-256 hash registered. File saved: `image/catalog/saas/STG-IMG-9902_80d30eb1b9.png`. 2nd push (`54`) re-used file (total registry rows: 1). | Expected: Remote image downloaded, magic-byte validated, saved locally, deduplicated.<br>Actual: 100% verified on disk & DB. | **VERIFIED (PASS)** |
| **STG-LNG-01** | Multi | OpenCart Multilingual Schema Verification | `node -e "connector.pushProduct(multilingualProd)"` | HTTP 200 OK<br>Created Product ID: `51`<br>SKU: `STG-LNG-4901` | MariaDB `oc_product_description`: Language 1 (`en-gb`): "Traxxas Monster Truck High Performance"<br>Language 2 (`de`): "Traxxas Monstertruck Hochleistung" | Expected: Active languages receive corresponding translations without corruption.<br>Actual: Two distinct rows verified in DB. | **VERIFIED (PASS)** |
| **STG-PRC-01** | Multi | Multi-Currency Pricing & Precision | `node -e "connector.pushProduct(currencyProd)"` | HTTP 200 OK<br>Created Product ID: `55`<br>SKU: `STG-PRC-7701` | MariaDB `oc_product.price`: `549.9500` (4 decimals). Store conversion via `oc_currency`: EUR = `431.49`, GBP = `336.84`. Zero truncation. | Expected: High precision decimal storage and multi-currency compatibility.<br>Actual: 100% confirmed in MariaDB. | **VERIFIED (PASS)** |
| **STG-RTR-01** | Shopify | 429 Rate Limit Backoff & Auto-Retry | `node scripts/verify_staging_resilience.js` | Attempt 1: HTTP 429 (`Retry-After: 1`)<br>Attempt 2: HTTP 200 OK<br>Total duration: `1062ms` | Connector intercepted 429, extracted `Retry-After: 1`, slept for 1000ms, retried automatically, and completed successfully. | Expected: Transparent backoff and automatic retry on 429.<br>Actual: Verified with controlled fault injection. | **VERIFIED (PASS)** |
| **STG-ERR-01** | Shopify | Error Classification & Token Redaction | `node scripts/verify_staging_resilience.js` | 401 Unauthorized, 422 Unprocessable Entity, 404 Not Found tested | Error logger redacted `shpat_` tokens to `[REDACTED_ACCESS_TOKEN]`. Parsed 422 validation errors cleanly. | Expected: Sanitized error reporting without token leaks.<br>Actual: Verified across all error scenarios. | **VERIFIED (PASS)** |
| **STG-SEC-01A** | Shopify | Inbound HMAC Webhook & Reverse Sync Pipeline | `node scripts/simulate_live_webhook.js --platform shopify` | HTTP 200 OK<br>Header: `x-shopify-hmac-sha256`<br>Signature: Base64 verified | PostgreSQL `customer_product_overrides` record `e4daee41-0aa0-435f-b297-610bdf0aa02a` updated with `custom_title: "X-Maxx Ultimate (Staging Price Update)"`, `price: "1399.00"`. | Expected: Reverse sync updates DB overrides for mapped product `10428815835391`.<br>Actual: 100% verified. | **VERIFIED (PASS)** |
| **STG-SEC-01B** | Shopify | Direct External Delivery from Shopify Cloud | `GET /admin/api/2026-10/webhooks.json` on `mayda-com` | HTTP 200 OK (`webhooks: []`)<br>Shopify requires public HTTPS address | Local server lacks public ingress URL; webhook registration requires public tunnel. | Expected: Inbound HTTP POST from Shopify servers across public Internet.<br>Actual: Awaiting public tunnel. | **BLOCKED (Owner Dependency)** |

---

## 4. Reversibility & Cleanup Proof

All write operations performed on the live testing store `mayda-com` were verified for 100% reversibility:

1. **Product `10451240681727` (STG-SHP-01):**
   - Deleted via `DELETE /admin/api/2026-10/products/10451240681727.json` (HTTP 200).
   - Re-read confirmation via `GET /admin/api/2026-10/products/10451240681727.json` returned **HTTP 404 Not Found**.

2. **Product `10451339051263` (STG-SHP-02 Inventory Test):**
   - Deleted via `DELETE /admin/api/2026-10/products/10451339051263.json` (HTTP 200).
   - Re-read confirmation via `GET /admin/api/2026-10/products/10451339051263.json` returned **HTTP 404 Not Found**.

*Result: Pristine baseline maintained. Zero residual test products remain on `mayda-com`.*

---

## 5. Standing Summary & Verdict

```
========================================================================================
GATE D.1 CURRENT STANDING:
========================================================================================
Total Scenarios:                  15
VERIFIED (PASS):                  14  (CON-05, CON-06, CON-07, CON-08,
                                      STG-SHP-01, STG-SHP-02, STG-OC-01, STG-OC-02,
                                      STG-DED-01, STG-IMG-01, STG-LNG-01, STG-PRC-01,
                                      STG-RTR-01, STG-ERR-01, STG-SEC-01A)
BLOCKED (Owner Ingress Tunnel):   1   (STG-SEC-01B: Direct Shopify-initiated delivery
                                      across public internet without tunnel)

GATE VERDICT:                     PARTIALLY VERIFIED / PROVISIONALLY HARDENED
                                  (14 of 15 scenarios 100% verified with empirical evidence;
                                   Gate D.1 remains provisionally held until public tunnel is
                                   attached for STG-SEC-01B direct delivery)
========================================================================================
```

---

## 6. Remaining Dependency for 15/15 Full Certification

The single remaining prerequisite to achieve 15/15 certification is external network ingress:

1. **Start Public HTTPS Ingress Tunnel:**
   ```bash
   cloudflared tunnel --url http://localhost:4000
   ```
2. **Register Shopify Webhook Endpoint on `mayda-com`:**
   ```bash
   POST https://mayda-com.myshopify.com/admin/api/2026-10/webhooks.json
   {
     "webhook": {
       "topic": "products/update",
       "address": "https://<tunnel-subdomain>.trycloudflare.com/api/v1/webhooks/shopify",
       "format": "json"
     }
   }
   ```
3. Once registered, edit product `10428815835391` in Shopify Admin. Shopify will deliver the webhook directly to the SaaS ingress, completing `STG-SEC-01B` and promoting Gate D.1 to **15/15 VERIFIED (PASS)**.
