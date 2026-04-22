-- =============================================================================
-- CargoBit Payment Platform - Database Migration
-- Version: 20260421
-- Description: Creates payout-related tables, audit events, and indexes
-- =============================================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. PAYOUTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED')),
    
    -- Stripe reference
    stripe_transfer_id VARCHAR(255) UNIQUE,
    stripe_account_id VARCHAR(255),
    
    -- Failure tracking
    failure_reason TEXT,
    failure_code VARCHAR(50),
    
    -- Idempotency
    idempotency_key VARCHAR(255) UNIQUE,
    
    -- Admin info
    initiated_by VARCHAR(255),
    processed_by VARCHAR(255),
    
    -- Wallet reference
    wallet_transaction_id UUID,
    
    -- Timestamps
    processed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for payouts
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_stripe_transfer_id ON payouts(stripe_transfer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at);
CREATE INDEX IF NOT EXISTS idx_payouts_idempotency_key ON payouts(idempotency_key);

-- =============================================================================
-- 2. PAYOUT_EVENTS TABLE (Audit Trail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payout_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
    
    -- Event info
    event_type VARCHAR(50) NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    
    -- Context
    admin_id VARCHAR(255),
    metadata JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for payout_events
CREATE INDEX IF NOT EXISTS idx_payout_events_payout_id ON payout_events(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_events_event_type ON payout_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payout_events_created_at ON payout_events(created_at);

-- =============================================================================
-- 3. PAYOUT_ATTEMPTS TABLE (Retry Tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payout_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
    
    -- Attempt info
    attempt_number INT NOT NULL DEFAULT 1,
    stripe_transfer_id VARCHAR(255),
    
    -- Result
    success BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    error_code VARCHAR(50),
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Request/Response logging
    request_payload JSONB,
    response_payload JSONB
);

-- Indexes for payout_attempts
CREATE INDEX IF NOT EXISTS idx_payout_attempts_payout_id ON payout_attempts(payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_attempts_success ON payout_attempts(success);
CREATE INDEX IF NOT EXISTS idx_payout_attempts_started_at ON payout_attempts(started_at);

-- =============================================================================
-- 4. WALLET_TRANSACTIONS TABLE (Enhanced)
-- =============================================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    
    -- Amount
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    
    -- Type
    type VARCHAR(20) NOT NULL
        CHECK (type IN ('debit', 'credit', 'reserve', 'release', 'fee', 'payout', 'refund')),
    
    -- References
    reference VARCHAR(255),
    payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL,
    payment_id VARCHAR(255),
    
    -- Metadata
    metadata JSONB,
    description TEXT,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
        CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED')),
    
    -- Timestamps
    processed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for wallet_transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_payout_id ON wallet_transactions(payout_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_payment_id ON wallet_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);

-- =============================================================================
-- 5. AUDIT_EVENTS TABLE (General Audit Log)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event info
    event_type VARCHAR(100) NOT NULL,
    
    -- Payload (flexible JSON)
    payload JSONB NOT NULL,
    
    -- Context
    user_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    
    -- References
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit_events
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);

-- GIN index for JSONB payload queries
CREATE INDEX IF NOT EXISTS idx_audit_events_payload_gin ON audit_events USING GIN(payload);

-- =============================================================================
-- 6. STRIPE_EVENTS TABLE (Webhook Event Tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS stripe_events (
    id VARCHAR(255) PRIMARY KEY,  -- Stripe Event ID (evt_xxx)
    
    -- Event info
    type VARCHAR(100) NOT NULL,
    
    -- Raw event data
    event_data JSONB NOT NULL,
    
    -- Processing status
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    
    -- Idempotency
    processing_attempt INT NOT NULL DEFAULT 0,
    
    -- Timestamps
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stripe_created_at TIMESTAMPTZ  -- Original Stripe timestamp
);

-- Indexes for stripe_events
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_events(processed);
CREATE INDEX IF NOT EXISTS idx_stripe_events_received_at ON stripe_events(received_at);

-- =============================================================================
-- 7. LEADER LOCK TABLE (For Cron Jobs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS leader_locks (
    id VARCHAR(100) PRIMARY KEY,
    holder_id VARCHAR(255) NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Index for expiry check
CREATE INDEX IF NOT EXISTS idx_leader_locks_expires_at ON leader_locks(expires_at);

-- =============================================================================
-- 8. HELPER FUNCTIONS
-- =============================================================================

-- Function to acquire leader lock
CREATE OR REPLACE FUNCTION acquire_leader_lock(
    p_lock_id VARCHAR(100),
    p_holder_id VARCHAR(255),
    p_ttl_seconds INT DEFAULT 60
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_holder VARCHAR(255);
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Clean up expired locks
    DELETE FROM leader_locks WHERE id = p_lock_id AND expires_at < NOW();
    
    -- Try to acquire lock
    INSERT INTO leader_locks (id, holder_id, expires_at)
    VALUES (p_lock_id, p_holder_id, NOW() + (p_ttl_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (id) DO UPDATE
    SET holder_id = p_holder_id,
        acquired_at = NOW(),
        expires_at = NOW() + (p_ttl_seconds || ' seconds')::INTERVAL
    WHERE leader_locks.holder_id = p_holder_id OR leader_locks.expires_at < NOW();
    
    -- Check if we got the lock
    SELECT holder_id INTO v_current_holder FROM leader_locks WHERE id = p_lock_id;
    
    RETURN v_current_holder = p_holder_id;
END;
$$ LANGUAGE plpgsql;

-- Function to release leader lock
CREATE OR REPLACE FUNCTION release_leader_lock(
    p_lock_id VARCHAR(100),
    p_holder_id VARCHAR(255)
) RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM leader_locks WHERE id = p_lock_id AND holder_id = p_holder_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. VIEWS FOR REPORTING
-- =============================================================================

-- Payout summary view
CREATE OR REPLACE VIEW payout_summary AS
SELECT 
    p.id,
    p.user_id,
    p.amount_cents,
    p.currency,
    p.status,
    p.created_at,
    p.processed_at,
    p.failed_at,
    p.failure_reason,
    COUNT(pa.id) AS attempt_count,
    MAX(pa.started_at) AS last_attempt_at
FROM payouts p
LEFT JOIN payout_attempts pa ON pa.payout_id = p.id
GROUP BY p.id;

-- Daily payout statistics
CREATE OR REPLACE VIEW daily_payout_stats AS
SELECT 
    DATE(created_at) AS payout_date,
    COUNT(*) AS total_payouts,
    COUNT(*) FILTER (WHERE status = 'PAID') AS successful_payouts,
    COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_payouts,
    SUM(amount_cents) AS total_amount_cents,
    SUM(amount_cents) FILTER (WHERE status = 'PAID') AS successful_amount_cents
FROM payouts
GROUP BY DATE(created_at)
ORDER BY payout_date DESC;

-- =============================================================================
-- 10. ROW LEVEL SECURITY (Optional - Enable for multi-tenant)
-- =============================================================================

-- Enable RLS on sensitive tables (uncomment if needed)
-- ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payout_events ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 11. GRANTS (Adjust roles as needed)
-- =============================================================================

-- Grant permissions to application role
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cargobit_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cargobit_app;

-- Grant read-only access for reporting
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO cargobit_readonly;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Insert migration record
INSERT INTO audit_events (event_type, payload)
VALUES ('migration.completed', '{"version": "20260421", "tables": ["payouts", "payout_events", "payout_attempts", "wallet_transactions", "audit_events", "stripe_events", "leader_locks"]}'::jsonb);
