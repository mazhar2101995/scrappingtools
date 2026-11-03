-- AI Product Intelligence SaaS - Initial Schema & Extensions
-- Enable essential PostgreSQL extensions for UUID generation and full-text search

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Initial schema setup
CREATE TABLE IF NOT EXISTS system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial verification record
INSERT INTO system_health (service_name, status, metadata)
VALUES ('database', 'INITIALIZED', '{"version": "16-alpine", "module": "core"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

