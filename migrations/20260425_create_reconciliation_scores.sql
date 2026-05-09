-- =============================================================================
-- CargoBit Reconciliation Scores Migration
-- Initiative 1: Data Product MVP - Reconciliation Score
-- Version: 20260425
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE score_level AS ENUM ('excellent', 'good', 'warning', 'critical');
CREATE TYPE score_factor_type AS ENUM (
    'amount_mismatch',
    'missing_payment',
    'duplicate_payout',
    'status_inconsistency',
    'timing_deviation',
    'currency_mismatch',
    'reference_mismatch',
    'fee_discrepancy',
    'partial_payment',
    'manual_override'
);

-- =============================================================================
-- RECONCILIATION SCORES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS reconciliation_scores (
    id VARCHAR(64) PRIMARY KEY,
    
    -- Entity Reference
    payout_id VARCHAR(64) NOT NULL,
    reconciliation_run_id VARCHAR(64),
    
    -- Score Values
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    score_level score_level NOT NULL,
    
    -- Score Breakdown (normalized to 0-100)
    completeness_score INTEGER NOT NULL DEFAULT 100,      -- Are all expected items present?
    accuracy_score INTEGER NOT NULL DEFAULT 100,          -- Do amounts match?
    timeliness_score INTEGER NOT NULL DEFAULT 100,        -- Was reconciliation timely?
    consistency_score INTEGER NOT NULL DEFAULT 100,       -- Status consistency
    
    -- Scoring Factors (JSON array of applied factors)
    score_factors JSONB NOT NULL DEFAULT '[]',
    -- Example: [{"type": "amount_mismatch", "severity": 40, "details": {"expected": 10000, "actual": 9500}}]
    
    -- Metadata
    calculation_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Manual Override
    manually_overridden BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    overridden_by VARCHAR(64),
    overridden_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(payout_id, reconciliation_run_id)
);

-- Indexes
CREATE INDEX idx_reconciliation_scores_payout ON reconciliation_scores(payout_id);
CREATE INDEX idx_reconciliation_scores_run ON reconciliation_scores(reconciliation_run_id);
CREATE INDEX idx_reconciliation_scores_score ON reconciliation_scores(score);
CREATE INDEX idx_reconciliation_scores_level ON reconciliation_scores(score_level);
CREATE INDEX idx_reconciliation_scores_calculated ON reconciliation_scores(calculated_at DESC);
CREATE INDEX idx_reconciliation_scores_factors ON reconciliation_scores USING GIN(score_factors);

-- =============================================================================
-- EXPECTED PAYOUTS TABLE (for comparison)
-- =============================================================================

CREATE TABLE IF NOT EXISTS expected_payouts (
    id VARCHAR(64) PRIMARY KEY,
    
    -- Reference Information
    reference VARCHAR(255) NOT NULL,
    external_reference VARCHAR(255),
    
    -- Expected Values
    expected_amount_cents BIGINT NOT NULL,
    expected_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    expected_status VARCHAR(32) NOT NULL DEFAULT 'paid',
    expected_at TIMESTAMPTZ,
    
    -- Source Information
    source_system VARCHAR(64) NOT NULL,  -- 'stripe', 'manual', 'erp_import', etc.
    source_metadata JSONB DEFAULT '{}',
    
    -- Matching
    matched_payout_id VARCHAR(64),
    matched_at TIMESTAMPTZ,
    match_confidence DECIMAL(5,2),  -- 0.00 to 100.00
    
    -- Organization
    company_id VARCHAR(64) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(reference, source_system)
);

-- Indexes
CREATE INDEX idx_expected_payouts_reference ON expected_payouts(reference);
CREATE INDEX idx_expected_payouts_matched ON expected_payouts(matched_payout_id);
CREATE INDEX idx_expected_payouts_company ON expected_payouts(company_id);
CREATE INDEX idx_expected_payouts_expected_at ON expected_payouts(expected_at);
CREATE INDEX idx_expected_payouts_unmatched ON expected_payouts(matched_payout_id) WHERE matched_payout_id IS NULL;

-- =============================================================================
-- SCORE RULES CONFIGURATION
-- =============================================================================

CREATE TABLE IF NOT EXISTS score_rules (
    id VARCHAR(64) PRIMARY KEY,
    
    -- Rule Identification
    name VARCHAR(255) NOT NULL UNIQUE,
    factor_type score_factor_type NOT NULL,
    description TEXT,
    
    -- Rule Configuration
    severity_weight INTEGER NOT NULL DEFAULT 20 CHECK (severity_weight >= 0 AND severity_weight <= 100),
    applies_to JSONB DEFAULT '{}',  -- Conditions for rule application
    
    -- Scoring Impact
    score_impact INTEGER NOT NULL DEFAULT 0,  -- Negative = reduces score
    
    -- Status
    active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 100,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default Score Rules
INSERT INTO score_rules (id, name, factor_type, description, severity_weight, score_impact, priority) VALUES
('rule_amount_mismatch', 'Amount Mismatch', 'amount_mismatch', 'Payout amount differs from expected amount', 40, -40, 100),
('rule_missing_payment', 'Missing Payment', 'missing_payment', 'Expected payment not found in payouts', 80, -80, 90),
('rule_duplicate_payout', 'Duplicate Payout', 'duplicate_payout', 'Multiple payouts with same reference', 60, -60, 95),
('rule_status_inconsistency', 'Status Inconsistency', 'status_inconsistency', 'Payout status differs from expected', 30, -30, 80),
('rule_timing_deviation', 'Timing Deviation', 'timing_deviation', 'Payout timing significantly off expected', 20, -20, 70),
('rule_currency_mismatch', 'Currency Mismatch', 'currency_mismatch', 'Currency differs from expected', 50, -50, 85),
('rule_reference_mismatch', 'Reference Mismatch', 'reference_mismatch', 'Reference cannot be matched', 70, -70, 75),
('rule_fee_discrepancy', 'Fee Discrepancy', 'fee_discrepancy', 'Fee amount differs from expected', 25, -25, 60),
('rule_partial_payment', 'Partial Payment', 'partial_payment', 'Only partial amount received', 45, -45, 65)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- MATERIALIZED VIEW: RECONCILIATION SCORES AGGREGATED
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_reconciliation_scores AS
SELECT 
    rs.payout_id,
    rs.score,
    rs.score_level,
    rs.completeness_score,
    rs.accuracy_score,
    rs.timeliness_score,
    rs.consistency_score,
    rs.score_factors,
    rs.calculated_at,
    p.amount_cents,
    p.currency,
    p.status AS payout_status,
    p.created_at AS payout_created_at,
    c.name AS company_name
FROM reconciliation_scores rs
JOIN payouts p ON p.id = rs.payout_id
LEFT JOIN companies c ON c.id = p.company_id
WHERE NOT rs.manually_overridden;

CREATE UNIQUE INDEX idx_mv_scores_payout ON mv_reconciliation_scores(payout_id);
CREATE INDEX idx_mv_scores_level ON mv_reconciliation_scores(score_level);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Calculate score from factors
CREATE OR REPLACE FUNCTION calculate_reconciliation_score(
    p_payout_id VARCHAR(64),
    p_expected_amount_cents BIGINT DEFAULT NULL,
    p_actual_amount_cents BIGINT DEFAULT NULL,
    p_expected_status VARCHAR(32) DEFAULT 'paid',
    p_actual_status VARCHAR(32) DEFAULT NULL,
    p_reference VARCHAR(255) DEFAULT NULL
) RETURNS TABLE (
    score INTEGER,
    score_level score_level,
    factors JSONB
) AS $$
DECLARE
    v_score INTEGER := 100;
    v_factors JSONB := '[]'::jsonb;
    v_factor JSONB;
    v_expected BIGINT;
    v_actual BIGINT;
BEGIN
    -- Get actual payout data if not provided
    IF p_actual_amount_cents IS NULL OR p_actual_status IS NULL THEN
        SELECT amount_cents, status 
        INTO v_actual, p_actual_status
        FROM payouts 
        WHERE id = p_payout_id;
    ELSE
        v_actual := p_actual_amount_cents;
    END IF;
    
    v_expected := COALESCE(p_expected_amount_cents, v_actual);
    
    -- Rule 1: Status Inconsistency
    IF p_actual_status <> p_expected_status THEN
        v_score := v_score - 30;
        v_factors := v_factors || jsonb_build_object(
            'type', 'status_inconsistency',
            'severity', 30,
            'details', jsonb_build_object(
                'expected', p_expected_status,
                'actual', p_actual_status
            )
        );
    END IF;
    
    -- Rule 2: Amount Mismatch
    IF v_expected IS NOT NULL AND v_actual IS NOT NULL AND v_expected <> v_actual THEN
        v_score := v_score - 40;
        v_factors := v_factors || jsonb_build_object(
            'type', 'amount_mismatch',
            'severity', 40,
            'details', jsonb_build_object(
                'expected_cents', v_expected,
                'actual_cents', v_actual,
                'difference_cents', ABS(v_expected - v_actual)
            )
        );
    END IF;
    
    -- Rule 3: Check for duplicates
    IF p_reference IS NOT NULL THEN
        IF (SELECT COUNT(*) FROM payouts WHERE reference = p_reference AND id <> p_payout_id) > 0 THEN
            v_score := v_score - 60;
            v_factors := v_factors || jsonb_build_object(
                'type', 'duplicate_payout',
                'severity', 60,
                'details', jsonb_build_object(
                    'reference', p_reference
                )
            );
        END IF;
    END IF;
    
    -- Ensure score is within bounds
    v_score := GREATEST(0, LEAST(100, v_score));
    
    -- Determine score level
    RETURN QUERY SELECT 
        v_score,
        CASE 
            WHEN v_score >= 90 THEN 'excellent'::score_level
            WHEN v_score >= 70 THEN 'good'::score_level
            WHEN v_score >= 50 THEN 'warning'::score_level
            ELSE 'critical'::score_level
        END,
        v_factors;
END;
$$ LANGUAGE plpgsql;

-- Refresh materialized view periodically
CREATE OR REPLACE FUNCTION refresh_reconciliation_scores()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_reconciliation_scores;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_reconciliation_scores_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reconciliation_scores_timestamp ON reconciliation_scores;
CREATE TRIGGER trigger_update_reconciliation_scores_timestamp
    BEFORE UPDATE ON reconciliation_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_reconciliation_scores_timestamp();

-- =============================================================================
-- SAMPLE DATA FOR TESTING
-- =============================================================================

-- Insert sample expected payouts for testing
-- INSERT INTO expected_payouts (id, reference, expected_amount_cents, expected_currency, source_system, company_id)
-- VALUES 
--     ('exp_001', 'TXN-2026-001', 1500000, 'EUR', 'erp_import', 'comp_001'),
--     ('exp_002', 'TXN-2026-002', 2500000, 'EUR', 'erp_import', 'comp_001');

-- =============================================================================
-- GRANTS
-- =============================================================================

-- GRANT SELECT, INSERT, UPDATE ON reconciliation_scores TO payments_app;
-- GRANT SELECT, INSERT, UPDATE ON expected_payouts TO payments_app;
-- GRANT SELECT ON score_rules TO payments_app;
-- GRANT SELECT ON mv_reconciliation_scores TO payments_app;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE reconciliation_scores IS 'Reconciliation scores for payouts with scoring factors and breakdown';
COMMENT ON TABLE expected_payouts IS 'Expected payout records for reconciliation comparison';
COMMENT ON TABLE score_rules IS 'Configurable rules for reconciliation scoring';

-- =============================================================================
-- MIGRATION TRACKING
-- =============================================================================

INSERT INTO migrations (name, applied_at) 
VALUES ('20260425_create_reconciliation_scores', NOW())
ON CONFLICT DO NOTHING;
