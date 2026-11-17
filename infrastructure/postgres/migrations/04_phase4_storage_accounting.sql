-- Phase 4: Authoritative Per-Tenant Storage Accounting & Media Ledger
-- Migration Script: 04_phase4_storage_accounting.sql

-- 1. Enhance product_image_transformations with byte size and output format
ALTER TABLE product_image_transformations 
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT NOT NULL DEFAULT 0;

ALTER TABLE product_image_transformations 
ADD COLUMN IF NOT EXISTS output_format VARCHAR(20) NOT NULL DEFAULT 'webp';

-- 2. Create tenant_media_assets table
CREATE TABLE IF NOT EXISTS tenant_media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL DEFAULT 'catalog_image',
    global_media_asset_id UUID REFERENCES global_media_assets(id) ON DELETE SET NULL,
    transformation_id UUID REFERENCES product_image_transformations(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    mime_type VARCHAR(64) NOT NULL DEFAULT 'image/webp',
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    content_hash VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance and multi-tenant isolation
CREATE UNIQUE INDEX IF NOT EXISTS idx_tma_org_hash_type 
ON tenant_media_assets (organization_id, content_hash, asset_type);

CREATE INDEX IF NOT EXISTS idx_tma_org_status 
ON tenant_media_assets (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_tma_gma 
ON tenant_media_assets (global_media_asset_id);

CREATE INDEX IF NOT EXISTS idx_tma_deleted 
ON tenant_media_assets (deleted_at);

-- 3. Register storage_megabytes service in central catalogue
INSERT INTO services (
    id,
    code,
    name,
    description,
    category,
    unit,
    metric_type,
    supports_unlimited,
    default_reset_period,
    is_globally_active
)
VALUES (
    'srv_storage_megabytes',
    'storage_megabytes',
    'Media & Image Storage',
    'Authoritative per-tenant storage capacity for original, studio transformed, and catalog media assets',
    'storage',
    'MB',
    'storage',
    'true',
    'never',
    'true'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    unit = EXCLUDED.unit,
    metric_type = EXCLUDED.metric_type;

-- 4. Assign dynamic plan entitlements for storage_megabytes
-- Free Plan: 100 MB
INSERT INTO plan_service_entitlements (plan_id, service_code, is_enabled, usage_limit, is_unlimited, reset_period)
VALUES ('free', 'storage_megabytes', 'true', 100, 'false', 'never')
ON CONFLICT (plan_id, service_code) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    usage_limit = EXCLUDED.usage_limit,
    is_unlimited = EXCLUDED.is_unlimited;

-- Starter Plan: 1,000 MB (1 GB)
INSERT INTO plan_service_entitlements (plan_id, service_code, is_enabled, usage_limit, is_unlimited, reset_period)
VALUES ('starter', 'storage_megabytes', 'true', 1000, 'false', 'never')
ON CONFLICT (plan_id, service_code) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    usage_limit = EXCLUDED.usage_limit,
    is_unlimited = EXCLUDED.is_unlimited;

-- Pro Plan: 10,000 MB (10 GB)
INSERT INTO plan_service_entitlements (plan_id, service_code, is_enabled, usage_limit, is_unlimited, reset_period)
VALUES ('pro', 'storage_megabytes', 'true', 10000, 'false', 'never')
ON CONFLICT (plan_id, service_code) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    usage_limit = EXCLUDED.usage_limit,
    is_unlimited = EXCLUDED.is_unlimited;

-- Enterprise Plan: 100,000 MB (Unlimited)
INSERT INTO plan_service_entitlements (plan_id, service_code, is_enabled, usage_limit, is_unlimited, reset_period)
VALUES ('enterprise', 'storage_megabytes', 'true', 100000, 'true', 'never')
ON CONFLICT (plan_id, service_code) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    usage_limit = EXCLUDED.usage_limit,
    is_unlimited = EXCLUDED.is_unlimited;
