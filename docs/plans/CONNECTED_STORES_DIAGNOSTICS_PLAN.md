# Minimal Implementation Plan: Connected Stores Health, Diagnostics & Readiness Gating

**Date:** 2026-11-19  
**Status:** Approved for Implementation  
**Target:** Authoritative Connection Diagnostics & Readiness Gating Engine for Connected Stores

---

## 1. Objectives & Principles
- **No False Assurances:** A successful ping (HTTP 200 on basic info endpoint) must never be treated as proof of full store readiness.
- **Granular Capability Matrix:** Independently evaluate: `PRODUCT_PULL`, `PRODUCT_CREATE`, `PRODUCT_UPDATE`, `INVENTORY_SYNC`, `PRICE_SYNC`, `MEDIA_SYNC`, `WEBHOOK_REVERSE_SYNC`, and `SCHEDULED_SYNC`.
- **Accurate Readiness States:** `CONNECTED_READY`, `CONNECTED_LIMITED`, `ACTION_REQUIRED`, `DISCONNECTED`, `CHECKING`, `UNKNOWN`.
- **Server & Worker Gating:** Enforce capability checks at API endpoints, execution services, and background schedulers with explicit sanitized error codes.
- **Tenant-Isolated & Sanitized UX:** Zero leaked secrets or tokens in reports or dashboard UI. Preserve existing Vuexy bordered visual design.

---

## 2. Technical Architecture & Data Models

### 2.1 Diagnostic Data Structures (`packages/shared-types` or `apps/api/src/types/diagnostics.types.ts`)
```typescript
export type DiagnosticCheckStatus = 'PASS' | 'FAIL' | 'WARNING' | 'NOT_TESTED' | 'NOT_APPLICABLE';
export type DiagnosticSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface DiagnosticCheck {
  id: string;                     // e.g. 'shp_auth', 'shp_scopes', 'oc_hmac'
  name: string;                   // Human-readable title
  status: DiagnosticCheckStatus;
  severity: DiagnosticSeverity;
  timestamp: string;              // ISO timestamp
  errorCode?: string | null;      // e.g. 'STORE_SCOPE_MISSING', 'STORE_AUTH_INVALID'
  message: string;                // Detailed explanation
  actionRequired?: string | null; // Remediation instructions
  capability: string;             // Associated capability
  details?: Record<string, any>;  // Sanitized technical details
}

export type StoreReadinessState =
  | 'CONNECTED_READY'
  | 'CONNECTED_LIMITED'
  | 'ACTION_REQUIRED'
  | 'DISCONNECTED'
  | 'CHECKING'
  | 'UNKNOWN';

export interface StoreCapabilityStatus {
  supported: boolean;
  verified: boolean;
  status: 'READY' | 'LIMITED' | 'BLOCKED' | 'NOT_SUPPORTED';
  reason?: string;
}

export interface StoreDiagnosticsReport {
  storeId: string;
  storeName: string;
  platformType: string;
  readinessState: StoreReadinessState;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    unverified: number;
  };
  capabilities: Record<string, StoreCapabilityStatus>;
  checks: DiagnosticCheck[];
  lastCheckedAt: string;
  lastSuccessfulCheckAt?: string | null;
}
```

### 2.2 Diagnostic Engine Service (`apps/api/src/services/store-diagnostics.service.ts`)
- **Shopify Diagnostic Checks (13 checks):**
  1. `shp_reachability`: DNS/HTTPS reachability of `shopDomain`.
  2. `shp_auth`: Admin API authentication via `GET /admin/api/{ver}/shop.json`.
  3. `shp_api_version`: Admin API version header check.
  4. `shp_scopes`: Access scopes inspection (`read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_locations`).
  5. `shp_product_read`: `GET /admin/api/{ver}/products.json?limit=1`.
  6. `shp_product_write`: Scope evaluation (`write_products`) and validation.
  7. `shp_inventory_access`: `GET /admin/api/{ver}/locations.json` and inventory access.
  8. `shp_price_variants`: Product variant options and price accessibility.
  9. `shp_media_access`: Product image read and media CDN access.
  10. `shp_webhook_sub`: Inbound webhook subscription verification on Shopify.
  11. `shp_webhook_secret`: Validation of configured app signing secret in database.
  12. `shp_inbound_activity`: Last inbound webhook audit verification.
  13. `shp_rate_limit`: API call limit header inspection (`X-Shopify-Shop-Api-Call-Limit`).

- **OpenCart Diagnostic Checks (13 checks):**
  1. `oc_reachability`: Host domain and HTTP reachability.
  2. `oc_https_cert`: Protocol and certificate verification (WARNING on non-SSL local).
  3. `oc_version`: OpenCart version detection (3.x vs 4.x).
  4. `oc_connector_mode`: OCMOD module vs standalone PHP bridge detection.
  5. `oc_endpoint_reach`: Reachability of connector endpoint.
  6. `oc_hmac_auth`: Cryptographic HMAC request handshake verification.
  7. `oc_product_read`: Catalog product read endpoint test.
  8. `oc_product_write`: Catalog product push/create endpoint permissions.
  9. `oc_image_upload`: Media upload directory permission check.
  10. `oc_stock_price`: Price & inventory adjustment capability.
  11. `oc_languages`: Active language and currency configuration.
  12. `oc_reverse_sync`: Webhook callback URL registration in module settings.
  13. `oc_last_receipt`: Inbound webhook activity log check.

- **WooCommerce Diagnostic Checks (8 checks):**
  1. `wc_reachability`: WordPress REST API root reachability.
  2. `wc_auth`: WooCommerce REST API authentication.
  3. `wc_key_permissions`: Read/write key permission inspection.
  4. `wc_product_read`: Product query access (`/wp-json/wc/v3/products`).
  5. `wc_stock_price`: Product update capability check.
  6. `wc_media_access`: Media endpoint inspection.
  7. `wc_webhooks`: Webhook subscription check (`/wp-json/wc/v3/webhooks`).
  8. `wc_compatibility`: WordPress & WooCommerce versions from system status.

---

## 3. Backend Gating & Error Codes

### 3.1 Explicit Error Codes:
- `STORE_AUTH_INVALID`: Authentication failed or token invalid.
- `STORE_SCOPE_MISSING`: Required permissions/scopes missing.
- `CONNECTOR_MODULE_MISSING`: OpenCart OCMOD or bridge not installed.
- `CONNECTOR_VERSION_UNSUPPORTED`: Platform version incompatible.
- `STORE_READ_PERMISSION_DENIED`: Product pull attempted without read access.
- `STORE_WRITE_PERMISSION_DENIED`: Product push attempted without write access.
- `WEBHOOK_SECRET_INVALID`: Webhook signing secret missing or invalid.
- `STORE_CONNECTION_UNREACHABLE`: Domain or endpoint unreachable.
- `STORE_CAPABILITY_NOT_VERIFIED`: Required capability has not been tested or is BLOCKED.

### 3.2 Enforcement Points:
1. `POST /api/v1/stores/:id/sync`: Checks `PRODUCT_PULL` or `PRODUCT_CREATE`/`PRODUCT_UPDATE`.
2. `POST /api/v1/stores/push-product`: Checks `PRODUCT_CREATE` / `PRODUCT_UPDATE`.
3. `POST /api/v1/stores/controlled-push`: Checks `PRODUCT_CREATE` / `PRODUCT_UPDATE`.
4. `POST /api/v1/stores/bulk-controlled-push`: Checks `PRODUCT_CREATE` / `PRODUCT_UPDATE`.
5. `BackgroundSyncSchedulerService.executeScheduleNow`: Validates capability before dispatching automated pushes.

---

## 4. UI / UX Design in SaaS Dashboard
- **File:** `apps/dashboard/src/app/stores/page.tsx`
- **Store Cards:**
  - Distinct readiness status badge with color coding:
    - `CONNECTED_READY` (Emerald)
    - `CONNECTED_LIMITED` (Amber)
    - `ACTION_REQUIRED` (Rose)
    - `DISCONNECTED` (Red)
    - `CHECKING` (Blue pulse)
    - `UNKNOWN` (Slate)
  - Diagnostic metric counters: passed (green), warnings (amber), failed (rose), unverified (slate).
  - Capability badges (Pull, Push, Stock, Price, Webhooks).
  - Last checked timestamp.
  - Actions: "Diagnostics", "Recheck", "Sync Now" (gated with disabled tooltip).
- **Diagnostics Modal / Panel:**
  - Full report modal rendering all check categories.
  - Filter tabs: All, Issues (Failed/Warnings), Passed.
  - Check item view with error codes, actionable remediation instructions, and sanitized technical details.
  - "Run Diagnostics" button to re-evaluate on demand.

---

## 5. Implementation Phases & Verification Steps
1. **Types & Models:** Create `apps/api/src/types/diagnostics.types.ts`.
2. **Diagnostic Service:** Implement `apps/api/src/services/store-diagnostics.service.ts`.
3. **API Routes:** Add `GET /:id/diagnostics`, `POST /:id/diagnostics/run` in `apps/api/src/routes/store.routes.ts`.
4. **Operation Gating:** Add `assertStoreCapability` enforcement to sync and push endpoints.
5. **Dashboard UI:** Update `api-client.ts` and `apps/dashboard/src/app/stores/page.tsx`.
6. **Targeted Automated Testing:** Execute 14 verification scenarios via `scripts/test_store_diagnostics.js`.
