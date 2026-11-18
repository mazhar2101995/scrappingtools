-- Migration 05: Safe PostgreSQL GIN Index for product_attributes.attributes
-- Provides O(log N) containment search (@>) across arbitrary nested JSONB product specifications
-- NOTE: In production high-concurrency environments, CREATE INDEX CONCURRENTLY must be executed
-- outside of a transaction block (autocommit mode) so it does not take an EXCLUSIVE table lock.

-- Step 1: Ensure JSONB column exists (safe with instant metadata update in PostgreSQL 11+)
ALTER TABLE product_attributes 
ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Step 2: In case a previous concurrent index build was interrupted or left invalid (indisvalid = false),
-- drop any corrupted invalid index before recreating.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = 'idx_product_attributes_attributes_gin' AND NOT i.indisvalid
    ) THEN
        DROP INDEX idx_product_attributes_attributes_gin;
    END IF;
END $$;

-- Step 3: Production concurrent GIN index creation (non-blocking).
-- If executing via psql or migration runners, execute without BEGIN/COMMIT wrapping.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_attributes_attributes_gin 
ON product_attributes USING gin (attributes);
