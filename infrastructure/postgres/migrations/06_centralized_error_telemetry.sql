-- Migration 06: Centralized Error Telemetry and Observability
-- Provides persistent error logging, reference IDs, sensitive data redaction, and multi-tenant context

CREATE TABLE IF NOT EXISTS system_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_reference_id VARCHAR(64) UNIQUE NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'backend', -- 'frontend', 'backend', 'worker'
    severity VARCHAR(20) NOT NULL DEFAULT 'error', -- 'warning', 'error', 'fatal'
    error_name VARCHAR(255) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    http_method VARCHAR(10),
    http_path TEXT,
    http_status_code INTEGER DEFAULT 500,
    organization_id UUID,
    user_id UUID,
    user_email VARCHAR(255),
    browser_info TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Performance and query indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_ref_id ON system_error_logs(error_reference_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_org_created ON system_error_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_source_severity ON system_error_logs(source, severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON system_error_logs(created_at DESC);
