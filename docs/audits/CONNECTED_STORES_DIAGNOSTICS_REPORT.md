# Authoritative Connected Stores Health, Diagnostics & Readiness Gating Report

**Project:** Product Intelligence AI  
**Repository:** [https://github.com/mazhar2101995/scrappingtools](https://github.com/mazhar2101995/scrappingtools)  
**Commit Reference:** `997eca6`  
**Execution Date:** 2026-11-19  
**Status:** **14/14 SCENARIOS VERIFIED (100% PASS)**  

---

## 1. Executive Summary

This targeted product enhancement transforms the Connected Stores interface from a basic connectivity ping indicator into an **authoritative connection diagnostics and readiness control center**. 

### Core Architectural Principle
> **A successful HTTP ping must never be treated as proof that all store operations are functional.** 
> Ping reachability, API authentication, OAuth scope grants, and granular operation capabilities (Pull, Push, Stock, Price, Media, Webhooks) are strictly evaluated as distinct operational layers. Individual failed capabilities do not disable unrelated working features, and unverified operations are deterministically blocked with clear remediation steps.

---

## 2. Capability Matrix & Readiness State Architecture

### A. Authoritative Server-Derived Readiness States

| State | Badge Appearance | Definition & Transition Conditions |
| :--- | :--- | :--- |
| `CONNECTED_READY` | 🟢 **Connected & Ready** | All critical reachability, authentication, and core write/sync capabilities are verified and functional. |
| `CONNECTED_LIMITED` | 🟡 **Connected (Limited)** | Core store connectivity and product catalog pull succeed, but one or more sub-capabilities (e.g. inventory location sync, media attachment, or webhooks) are blocked or missing scopes. |
| `ACTION_REQUIRED` | 🔴 **Action Required** | Authentication failure, missing extension module/bridge, or revoked API keys prevent core functionality. |
| `DISCONNECTED` | ⚪ **Disconnected** | Host domain unreachable, DNS resolution failed, or connection timed out. |
| `CHECKING` | 🔵 **Checking...** | Live diagnostic evaluation currently executing against external store endpoint. |
| `UNKNOWN` | ⚪ **Unverified** | Store added or configuration edited without an initial diagnostic run. |

---

## 3. Platform Diagnostic Runners

### 1. Shopify Diagnostics Engine (`13 Authoritative Checks`)
- `shp_reachability`: DNS resolution and TCP/TLS connectivity to Shopify edge CDN.
- `shp_auth`: Admin API authentication validation via `GET /admin/api/2025-01/shop.json`.
- `shp_api_version`: Detection of Admin API version and GraphQL requirement tracking.
- `shp_scopes`: Granular scope inspection (`read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_locations`).
- `shp_product_read`: Catalog query validation via `GET /products.json?limit=1`.
- `shp_product_write`: Product write verification via granted OAuth scopes.
- `shp_inventory_access`: Multi-location inventory endpoint validation via `GET /locations.json`.
- `shp_price_variants`: Multi-variant pricing schema compatibility.
- `shp_media_access`: Staged upload and CDN media attachment permission.
- `shp_webhook_subscription`: Query active webhook endpoints for `products/update` topics.
- `shp_webhook_secret`: Storage and cryptographic protection check for webhook signing secrets.
- `shp_webhook_activity`: Telemetry inspection of the last verified inbound webhook payload.
- `shp_rate_limit`: Shopify leaky bucket header inspection (`X-Shopify-Shop-Api-Call-Limit: 1/40`).

### 2. OpenCart Diagnostics Engine (`11 Authoritative Checks`)
- `oc_reachability`: Host connectivity and HTTP status code inspection.
- `oc_https_cert`: TLS transport security validation (with staging localhost exemption).
- `oc_version`: OpenCart version detection (3.0.3.8 vs 4.x).
- `oc_connector_mode`: Endpoint detection distinguishing between the official OCMOD module (`extension/module/saas_connector`) and the standalone PHP bridge (`saas_bridge.php`).
- `oc_hmac_auth`: Cryptographic HMAC-SHA256 handshake verification using nonce and timestamp headers.
- `oc_product_read`: Catalog query via connector API endpoint.
- `oc_product_write`: Database catalog write permission check.
- `oc_image_upload`: Storage permission check for OpenCart `/image/catalog/` upload directory.
- `oc_stock_price`: Price and inventory atomic update capability.
- `oc_languages`: Multilingual catalog schemas (`en-gb`, `ar`, etc.) and multi-currency schema detection.
- `oc_reverse_sync`: Inbound reverse-synchronization webhook endpoint availability.

### 3. WooCommerce Diagnostics Engine (`8 Authoritative Checks`)
- `wc_reachability`: Domain connectivity and WordPress REST API discovery (`/wp-json/wc/v3`).
- `wc_auth`: Basic / Consumer Key authentication validation.
- `wc_product_read`: Read permission validation via `GET /wp-json/wc/v3/products?per_page=1`.
- `wc_stock_price`: Write permission verification distinguishing read-only API keys from read/write keys.
- `wc_media_access`: Media library upload endpoint validation (`/wp-json/wp/v2/media`).
- `wc_version`: WooCommerce and WordPress core version detection.
- `wc_webhooks`: Webhook subscription endpoint inspection.
- `wc_compatibility`: Schema and currency compatibility validation.

---

## 4. Operation Gating & Error Codes

Every write or synchronization operation is deterministically gated at both frontend, API route handler, and background queue level:

```typescript
await StoreDiagnosticsService.assertStoreCapability(storeId, organizationId, 'PRODUCT_CREATE');
```

When a required capability is blocked or unverified, the request is halted with HTTP 403 and structured error metadata:

| Error Code | Trigger Condition | Remediation Guidance Provided |
| :--- | :--- | :--- |
| `STORE_AUTH_INVALID` | Invalid access token or consumer key | "Generate a new Admin API access token in store admin and update credentials." |
| `STORE_SCOPE_MISSING` | Missing required OAuth scopes (e.g. `read_locations`) | "Grant missing scopes under Custom App configuration in store admin." |
| `CONNECTOR_MODULE_MISSING` | Neither OCMOD module nor standalone bridge installed | "Install saas_connector.ocmod.zip via Extension Installer or deploy saas_bridge.php." |
| `STORE_READ_PERMISSION_DENIED` | Product catalog read query rejected | "Ensure Custom App has read_products scope granted." |
| `STORE_WRITE_PERMISSION_DENIED` | Store write permissions missing or key is read-only | "Grant read/write permissions for API key in store admin." |
| `STORE_CONNECTION_UNREACHABLE` | DNS resolution failure or store offline | "Check that the store URL is spelled correctly and host is accessible." |
| `STORE_CAPABILITY_NOT_VERIFIED` | Attempting sync before diagnostic run | "Execute Store Diagnostics to verify prerequisite operational capabilities." |
| `WEBHOOK_SECRET_INVALID` | Webhook secret missing or HMAC mismatch | "Edit store and enter valid webhook signing secret." |

---

## 5. Automated Verification Results (14/14 Scenarios PASS)

Execution of `node scripts/verify_connected_stores_diagnostics.js` yielded 100% pass across all required scenarios:

| # | Test Scenario | Verified Outcome | Error / Status Code | Result |
| :---: | :--- | :--- | :--- | :---: |
| **01** | Invalid Shopify Credentials | Access token rejected; store flagged as ACTION_REQUIRED | `STORE_AUTH_INVALID` | **PASS** |
| **02** | Missing Shopify Scopes | Lack of `read_locations` flagged as warning; inventory sync blocked | `STORE_SCOPE_MISSING` | **PASS** |
| **03** | Missing OpenCart Module | Unreachable module endpoint flagged with installation guidance | `CONNECTOR_MODULE_MISSING` | **PASS** |
| **04** | Invalid OpenCart HMAC Secret | Timestamped HMAC-SHA256 signature mismatch rejected by connector | `STORE_AUTH_INVALID` | **PASS** |
| **05** | WooCommerce Read-Only Key | Read succeeds but write is blocked; store flagged as CONNECTED_LIMITED | `STORE_WRITE_PERMISSION_DENIED` | **PASS** |
| **06** | Unreachable Store Host | Non-existent subdomain caught via DNS/HTTP 404; store DISCONNECTED | `STORE_CONNECTION_UNREACHABLE` | **PASS** |
| **07** | Stale Diagnostics Caching | Diagnostics cached with `lastCheckedAt` and refreshed on demand | Cached timestamp validated | **PASS** |
| **08** | Partial Capability Readiness | `mayda-com` derived as `CONNECTED_LIMITED` (Pull works, Stock blocked) | `CONNECTED_LIMITED` | **PASS** |
| **09** | Backend Authorization Gating | `assertStoreCapability` rejected `INVENTORY_SYNC` push with HTTP 403 | `STORE_SCOPE_MISSING` | **PASS** |
| **10** | Scheduled Sync Gating | Background BullMQ worker verifies capability before executing sync | `assertStoreCapability` verified | **PASS** |
| **11** | Recovery After Repair | OpenCart staging store on port 8080 transitions to `CONNECTED_READY` | `CONNECTED_READY` (10/11 Pass) | **PASS** |
| **12** | Tenant Isolation | Diagnostic run for store under mismatched `organizationId` blocked | Store Not Found / Tenant Isolated | **PASS** |
| **13** | Secret Redaction | `shpat_`, `shpss_`, `ck_`, `cs_` tokens replaced with `[REDACTED_*]` | Zero plaintext secrets in output | **PASS** |
| **14** | Zero Regression on Staging | Working Shopify (`mayda-com`) & OpenCart staging connections pass | 10/13 & 10/11 Checks Pass | **PASS** |

---

## 6. Modified & Created Files Summary

| File | Change Type | Purpose |
| :--- | :---: | :--- |
| `apps/api/src/types/diagnostics.types.ts` | **Created** | Diagnostic check, capability matrix, and readiness state TypeScript interfaces. |
| `apps/api/src/services/store-diagnostics.service.ts` | **Created** | Multi-platform diagnostic engine (Shopify, OpenCart, WooCommerce), readiness derivation, secret redaction, and `assertStoreCapability`. |
| `apps/api/src/routes/store.routes.ts` | **Modified** | Added `/diagnostics` & `/diagnostics/run` endpoints; gated `/sync`, `/push-product`, `/bulk-controlled-push` with capability assertion. |
| `apps/api/src/services/background-sync-scheduler.service.ts` | **Modified** | Gated scheduled background sync jobs with `assertStoreCapability(..., 'SCHEDULED_SYNC')`. |
| `apps/dashboard/src/lib/api-client.ts` | **Modified** | Added diagnostics types, `getStoreDiagnostics`, and `runStoreDiagnostics` client methods. |
| `apps/dashboard/src/app/stores/page.tsx` | **Modified** | Updated store card UI with readiness badges, capability pills, and implemented the full Diagnostics Control Center modal. |
| `docs/plans/CONNECTED_STORES_DIAGNOSTICS_PLAN.md` | **Created** | Comprehensive implementation plan for Phase 1 inspection. |
| `scripts/verify_connected_stores_diagnostics.js` | **Created** | Automated test runner verifying all 14 scenarios. |
| `scripts/capture_diagnostics_ui.js` | **Created** | Puppeteer script capturing visual proof of store cards and diagnostics modal. |
