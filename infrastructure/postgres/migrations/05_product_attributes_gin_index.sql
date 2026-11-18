-- Migration 05: Safe PostgreSQL GIN Index for product_attributes.attributes
-- Provides O(log N) containment search (@>) across arbitrary nested JSONB product specifications and custom attributes

ALTER TABLE product_attributes 
ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_product_attributes_attributes_gin 
ON product_attributes USING gin (attributes);
