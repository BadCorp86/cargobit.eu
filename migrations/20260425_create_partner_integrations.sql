-- =============================================================================
-- CargoBit Partner Integration Migration
-- Initiative 2: Sales/Partnerships - Embedded Pilot Integration
-- Version: 20260425
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE partner_integration_status AS ENUM ('pending', 'active', 'suspended', 'terminated');
CREATE TYPE oauth_grant_type AS ENUM ('authorization_code', 'client_credentials', 'refresh_token');
CREATE TYPE partner_feature AS ENUM (
    'embedded_export',
    'webhook_notifications',
    'sso_integration',
    'white_label_dashboard',
    'api_access'
);

-- =============================================================================
-- PARTNER INTEGRATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_integrations (
    id VARCHAR(64) PRIMARY KEY,
    
    -- Partner Information
    partner_name VARCHAR(255) NOT NULL,
    partner_type VARCHAR(64) NOT NULL,  -- 'erp', 'marketplace', 'accounting', 'logistics'
    description TEXT,
    website_url TEXT,
    logo_url TEXT,
    
    -- Contact Information
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    technical_contact_email VARCHAR(255),
    
    -- OAuth Configuration
    oauth_enabled BOOLEAN NOT NULL DEFAULT false,
    oauth_client_id VARCHAR(255) UNIQUE,
    oauth_client_secret_hash TEXT,  -- Hashed
    oauth_redirect_uris JSONB DEFAULT '[]',
    oauth_scopes JSONB DEFAULT '["export:read", "export:write", "webhook:read"]',
    oauth_grant_types JSONB DEFAULT '["authorization_code", "refresh_token"]',
    
    -- API Configuration
    api_key_hash TEXT,  -- For API key authentication
    api_scopes JSONB DEFAULT '["export:read"]',
    rate_limit_per_minute INTEGER DEFAULT 300,
    
    -- Integration Status
    status partner_integration_status NOT NULL DEFAULT 'pending',
    onboarding_date DATE,
    go_live_date DATE,
    termination_date DATE,
    
    -- Pilot Configuration
    is_pilot BOOLEAN NOT NULL DEFAULT false,
    pilot_start_date DATE,
    pilot_end_date DATE,
    pilot_max_customers INTEGER DEFAULT 10,
    pilot_customer_ids JSONB DEFAULT '[]',
    
    -- Features
    enabled_features JSONB DEFAULT '[]',
    
    -- Webhook Configuration
    webhook_url TEXT,
    webhook_secret_hash TEXT,
    webhook_events JSONB DEFAULT '["report_exported", "payout.reconciled"]',
    
    -- Commercial Terms
    revenue_share_percentage DECIMAL(5,2),  -- 0.00 to 100.00
    monthly_minimum DECIMAL(12,2),
    contract_end_date DATE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    internal_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(64),
    
    -- Constraints
    CONSTRAINT valid_oauth_redirect_uris CHECK (
        oauth_redirect_uris IS NULL OR 
        jsonb_array_length(oauth_redirect_uris) <= 10
    )
);

-- Indexes
CREATE INDEX idx_partner_integrations_status ON partner_integrations(status);
CREATE INDEX idx_partner_integrations_partner_type ON partner_integrations(partner_type);
CREATE INDEX idx_partner_integrations_oauth_client_id ON partner_integrations(oauth_client_id);
CREATE INDEX idx_partner_integrations_pilot ON partner_integrations(is_pilot) WHERE is_pilot = true;
CREATE INDEX idx_partner_integrations_created ON partner_integrations(created_at DESC);

-- =============================================================================
-- PARTNER OAUTH TOKENS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_oauth_tokens (
    id VARCHAR(64) PRIMARY KEY,
    
    -- Token References
    partner_integration_id VARCHAR(64) NOT NULL REFERENCES partner_integrations(id) ON DELETE CASCADE,
    partner_customer_id VARCHAR(255),  -- Customer ID in partner's system
    
    -- OAuth Tokens
    access_token_hash TEXT NOT NULL,
    refresh_token_hash TEXT,
    token_type VARCHAR(32) DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ,
    
    -- Scopes
    scopes JSONB NOT NULL DEFAULT '[]',
    
    -- Status
    revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_scopes CHECK (jsonb_array_length(scopes) > 0)
);

-- Indexes
CREATE INDEX idx_partner_oauth_tokens_partner ON partner_oauth_tokens(partner_integration_id);
CREATE INDEX idx_partner_oauth_tokens_customer ON partner_oauth_tokens(partner_customer_id);
CREATE INDEX idx_partner_oauth_tokens_expires ON partner_oauth_tokens(expires_at) WHERE NOT revoked;
CREATE INDEX idx_partner_oauth_tokens_access ON partner_oauth_tokens(access_token_hash) WHERE NOT revoked;

-- =============================================================================
-- PARTNER EXPORT SESSIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_export_sessions (
    id VARCHAR(64) PRIMARY KEY,
    
    -- References
    partner_integration_id VARCHAR(64) NOT NULL REFERENCES partner_integrations(id) ON DELETE CASCADE,
    partner_customer_id VARCHAR(255) NOT NULL,
    export_job_id VARCHAR(64) NOT NULL,
    
    -- Session Info
    session_type VARCHAR(32) NOT NULL DEFAULT 'embedded',  -- 'embedded', 'api', 'webhook'
    initiated_by VARCHAR(64),  -- User ID or 'partner_api'
    
    -- Export Configuration
    export_format VARCHAR(16) NOT NULL DEFAULT 'csv',
    export_filters JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    result_url TEXT,
    signed_url_expires_at TIMESTAMPTZ,
    
    -- Metadata for Partner
    partner_metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,  -- Session expiry
    
    -- Constraints
    CONSTRAINT valid_export_format CHECK (export_format IN ('csv', 'json', 'xlsx'))
);

-- Indexes
CREATE INDEX idx_partner_export_sessions_partner ON partner_export_sessions(partner_integration_id);
CREATE INDEX idx_partner_export_sessions_customer ON partner_export_sessions(partner_customer_id);
CREATE INDEX idx_partner_export_sessions_job ON partner_export_sessions(export_job_id);
CREATE INDEX idx_partner_export_sessions_status ON partner_export_sessions(status);
CREATE INDEX idx_partner_export_sessions_created ON partner_export_sessions(created_at DESC);

-- =============================================================================
-- PARTNER WEBHOOK DELIVERIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_webhook_deliveries (
    id VARCHAR(64) PRIMARY KEY,
    
    -- References
    partner_integration_id VARCHAR(64) NOT NULL REFERENCES partner_integrations(id) ON DELETE CASCADE,
    
    -- Webhook Info
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    
    -- Partner Customer Context
    partner_customer_id VARCHAR(255),
    
    -- Related Entity
    entity_type VARCHAR(64),
    entity_id VARCHAR(64),
    
    -- Delivery Status
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    
    -- Response Info
    response_status_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    
    -- Timing
    delivered_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_webhook_status CHECK (
        status IN ('pending', 'processing', 'delivered', 'failed', 'retrying')
    )
);

-- Indexes
CREATE INDEX idx_partner_webhook_deliveries_partner ON partner_webhook_deliveries(partner_integration_id);
CREATE INDEX idx_partner_webhook_deliveries_status ON partner_webhook_deliveries(status);
CREATE INDEX idx_partner_webhook_deliveries_event ON partner_webhook_deliveries(event_type);
CREATE INDEX idx_partner_webhook_deliveries_retry ON partner_webhook_deliveries(next_retry_at) 
    WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_partner_webhook_deliveries_created ON partner_webhook_deliveries(created_at DESC);

-- =============================================================================
-- PARTNER USAGE ANALYTICS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS partner_usage_analytics (
    id VARCHAR(64) PRIMARY KEY,
    
    -- References
    partner_integration_id VARCHAR(64) NOT NULL REFERENCES partner_integrations(id) ON DELETE CASCADE,
    
    -- Time Bucket (daily aggregation)
    date DATE NOT NULL,
    
    -- Usage Metrics
    total_api_calls INTEGER NOT NULL DEFAULT 0,
    successful_api_calls INTEGER NOT NULL DEFAULT 0,
    failed_api_calls INTEGER NOT NULL DEFAULT 0,
    
    -- Export Metrics
    total_exports INTEGER NOT NULL DEFAULT 0,
    total_records_exported BIGINT NOT NULL DEFAULT 0,
    total_bytes_exported BIGINT NOT NULL DEFAULT 0,
    
    -- OAuth Metrics
    oauth_token_issued INTEGER NOT NULL DEFAULT 0,
    oauth_token_refreshed INTEGER NOT NULL DEFAULT 0,
    oauth_token_revoked INTEGER NOT NULL DEFAULT 0,
    
    -- Webhook Metrics
    webhooks_sent INTEGER NOT NULL DEFAULT 0,
    webhooks_delivered INTEGER NOT NULL DEFAULT 0,
    webhooks_failed INTEGER NOT NULL DEFAULT 0,
    
    -- Unique Customers
    unique_customers INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(partner_integration_id, date)
);

-- Indexes
CREATE INDEX idx_partner_usage_analytics_partner ON partner_usage_analytics(partner_integration_id);
CREATE INDEX idx_partner_usage_analytics_date ON partner_usage_analytics(date DESC);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Generate OAuth Client ID
CREATE OR REPLACE FUNCTION generate_oauth_client_id()
RETURNS VARCHAR(255) AS $$
BEGIN
    RETURN 'cb_partner_' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Hash token
CREATE OR REPLACE FUNCTION hash_token(token TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(sha256(token::bytea), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_partner_integrations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_partner_integrations_timestamp ON partner_integrations;
CREATE TRIGGER trigger_update_partner_integrations_timestamp
    BEFORE UPDATE ON partner_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_partner_integrations_timestamp();

-- =============================================================================
-- SAMPLE DATA
-- =============================================================================

-- Insert sample ERP partner
INSERT INTO partner_integrations (
    id, partner_name, partner_type, description,
    oauth_enabled, oauth_client_id, oauth_scopes,
    status, is_pilot, pilot_start_date, pilot_end_date,
    enabled_features, webhook_url, created_by
) VALUES (
    'pi_erp_acme',
    'Acme ERP Systems',
    'erp',
    'Enterprise resource planning integration for logistics companies',
    true,
    generate_oauth_client_id(),
    '["export:read", "export:write", "webhook:read", "webhook:write"]',
    'active',
    true,
    '2026-04-25',
    '2026-06-06',
    '["embedded_export", "webhook_notifications", "api_access"]',
    'https://api.acme-erp.com/webhooks/cargobit',
    'admin'
) ON CONFLICT (id) DO NOTHING;

-- Insert sample marketplace partner
INSERT INTO partner_integrations (
    id, partner_name, partner_type, description,
    oauth_enabled, oauth_client_id, oauth_scopes,
    status, is_pilot, pilot_start_date, pilot_end_date,
    enabled_features, webhook_url, created_by
) VALUES (
    'pi_marketplace_transporthub',
    'TransportHub Marketplace',
    'marketplace',
    'Digital freight marketplace with embedded reconciliation exports',
    true,
    generate_oauth_client_id(),
    '["export:read", "webhook:read"]',
    'active',
    true,
    '2026-04-25',
    '2026-06-06',
    '["embedded_export", "webhook_notifications"]',
    'https://webhooks.transporthub.com/cargobit',
    'admin'
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- MIGRATION TRACKING
-- =============================================================================

INSERT INTO migrations (name, applied_at) 
VALUES ('20260425_create_partner_integrations', NOW())
ON CONFLICT DO NOTHING;
