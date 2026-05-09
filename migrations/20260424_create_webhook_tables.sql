-- =============================================================================
-- CargoBit Webhook Tables Migration
-- Version: 20260424
-- Description: Creates tables for webhook configurations, deliveries, and events
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE webhook_status AS ENUM ('active', 'paused', 'disabled', 'failed');
CREATE TYPE webhook_event_type AS ENUM (
    'payout.open',
    'payout.reconciled',
    'payout.failed',
    'payout.disputed',
    'reconciliation.run_started',
    'reconciliation.run_completed',
    'reconciliation.run_failed',
    'export.completed',
    'export.failed',
    'report.generated'
);
CREATE TYPE delivery_status AS ENUM ('pending', 'processing', 'delivered', 'failed', 'retrying', 'dead_letter');
CREATE TYPE auth_type AS ENUM ('none', 'hmac_sha256', 'bearer_token', 'basic_auth');

-- =============================================================================
-- WEBHOOK CONFIGURATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhook_configurations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    method VARCHAR(10) NOT NULL DEFAULT 'POST',
    events webhook_event_type[] NOT NULL DEFAULT '{}',
    status webhook_status NOT NULL DEFAULT 'active',
    
    -- Authentication
    auth_type auth_type NOT NULL DEFAULT 'none',
    auth_secret TEXT, -- Encrypted
    auth_token TEXT, -- Encrypted
    auth_username TEXT, -- Encrypted
    auth_password TEXT, -- Encrypted
    
    -- Configuration
    headers JSONB DEFAULT '[]',
    retry_config JSONB NOT NULL DEFAULT '{
        "maxRetries": 5,
        "initialDelayMs": 1000,
        "maxDelayMs": 300000,
        "backoffMultiplier": 2,
        "retryOnStatusCodes": [408, 429, 500, 502, 503, 504]
    }',
    timeout_ms INTEGER NOT NULL DEFAULT 30000,
    
    -- Ownership
    created_by VARCHAR(64) NOT NULL,
    organization_id VARCHAR(64),
    
    -- Status tracking
    is_active BOOLEAN NOT NULL DEFAULT true,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    last_failure_reason TEXT,
    
    -- Statistics
    total_deliveries BIGINT NOT NULL DEFAULT 0,
    successful_deliveries BIGINT NOT NULL DEFAULT 0,
    failed_deliveries BIGINT NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_url CHECK (url ~ '^https?://'),
    CONSTRAINT valid_timeout CHECK (timeout_ms >= 1000 AND timeout_ms <= 120000),
    CONSTRAINT valid_method CHECK (method IN ('POST', 'PUT'))
);

-- Indexes
CREATE INDEX idx_webhook_configurations_status ON webhook_configurations(status);
CREATE INDEX idx_webhook_configurations_is_active ON webhook_configurations(is_active);
CREATE INDEX idx_webhook_configurations_organization ON webhook_configurations(organization_id);
CREATE INDEX idx_webhook_configurations_events ON webhook_configurations USING GIN(events);
CREATE INDEX idx_webhook_configurations_created_at ON webhook_configurations(created_at DESC);

-- =============================================================================
-- WEBHOOK DELIVERIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id VARCHAR(64) PRIMARY KEY,
    webhook_id VARCHAR(64) NOT NULL REFERENCES webhook_configurations(id) ON DELETE CASCADE,
    
    -- Event information
    event_type webhook_event_type NOT NULL,
    event_id VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    
    -- Delivery status
    status delivery_status NOT NULL DEFAULT 'pending',
    
    -- Request/Response
    payload JSONB NOT NULL,
    request_headers JSONB DEFAULT '{}',
    response_status_code INTEGER,
    response_headers JSONB,
    response_body TEXT,
    
    -- Retry tracking
    attempts INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    duration_ms INTEGER,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_attempts CHECK (attempts >= 0)
);

-- Indexes
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);
CREATE INDEX idx_webhook_deliveries_entity ON webhook_deliveries(entity_type, entity_id);
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);
CREATE INDEX idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at) 
    WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_deliveries_event_id ON webhook_deliveries(event_id);

-- =============================================================================
-- WEBHOOK EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhook_events (
    id VARCHAR(64) PRIMARY KEY,
    
    -- Event information
    type webhook_event_type NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    
    -- Timestamp
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Processing status
    processed BOOLEAN NOT NULL DEFAULT false,
    webhook_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhook_events_type ON webhook_events(type);
CREATE INDEX idx_webhook_events_entity ON webhook_events(entity_type, entity_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed) WHERE NOT processed;
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- =============================================================================
-- WEBHOOK DELIVERY LOGS TABLE (Audit Trail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id VARCHAR(64) PRIMARY KEY,
    delivery_id VARCHAR(64) NOT NULL REFERENCES webhook_deliveries(id) ON DELETE CASCADE,
    webhook_id VARCHAR(64) NOT NULL,
    
    -- Attempt details
    attempt_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    
    -- Response details
    response_status_code INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhook_delivery_logs_delivery ON webhook_delivery_logs(delivery_id);
CREATE INDEX idx_webhook_delivery_logs_webhook ON webhook_delivery_logs(webhook_id);
CREATE INDEX idx_webhook_delivery_logs_created_at ON webhook_delivery_logs(created_at DESC);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update webhook statistics on delivery
CREATE OR REPLACE FUNCTION update_webhook_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        UPDATE webhook_configurations
        SET 
            consecutive_failures = 0,
            last_success_at = NOW(),
            total_deliveries = total_deliveries + 1,
            successful_deliveries = successful_deliveries + 1,
            updated_at = NOW()
        WHERE id = NEW.webhook_id;
    ELSIF NEW.status = 'failed' AND OLD.status NOT IN ('failed', 'dead_letter') THEN
        UPDATE webhook_configurations
        SET 
            consecutive_failures = consecutive_failures + 1,
            last_failure_at = NOW(),
            last_failure_reason = NEW.error_message,
            total_deliveries = total_deliveries + 1,
            failed_deliveries = failed_deliveries + 1,
            updated_at = NOW()
        WHERE id = NEW.webhook_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_update_webhook_stats ON webhook_deliveries;
CREATE TRIGGER trigger_update_webhook_stats
    AFTER UPDATE OF status ON webhook_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_stats();

-- =============================================================================
-- PARTITIONING (for high-volume deployments)
-- =============================================================================

-- Note: Uncomment for production with high delivery volume
-- CREATE TABLE webhook_deliveries_partitioned (LIKE webhook_deliveries INCLUDING ALL)
--     PARTITION BY RANGE (created_at);
--
-- CREATE TABLE webhook_deliveries_2026_04 
--     PARTITION OF webhook_deliveries_partitioned
--     FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- =============================================================================
-- GRANTS (adjust as needed for your security model)
-- =============================================================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON webhook_configurations TO payments_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON webhook_deliveries TO payments_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON webhook_events TO payments_app;
-- GRANT SELECT, INSERT ON webhook_delivery_logs TO payments_app;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE webhook_configurations IS 'Webhook endpoint configurations for event notifications';
COMMENT ON TABLE webhook_deliveries IS 'Individual webhook delivery attempts with retry tracking';
COMMENT ON TABLE webhook_events IS 'Webhook events awaiting dispatch to subscribed webhooks';
COMMENT ON TABLE webhook_delivery_logs IS 'Audit log of all delivery attempts for each webhook';

-- =============================================================================
-- CLEANUP FUNCTION (for dead letter queue)
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_dead_letter_queue(days_to_keep INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_deliveries
    WHERE status = 'dead_letter'
    AND created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DONE
-- =============================================================================

INSERT INTO migrations (name, applied_at) 
VALUES ('20260424_create_webhook_tables', NOW())
ON CONFLICT DO NOTHING;
