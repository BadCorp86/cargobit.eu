-- =============================================================================
-- CargoBit ML Model Registry - PostgreSQL Schema
-- =============================================================================
-- Creates tables for:
-- - Model version tracking
-- - Prediction metrics
-- - Feature statistics
-- - Training history
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- MODEL REGISTRY TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS ml_model_registry (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    model_type VARCHAR(20) NOT NULL DEFAULT 'lightgbm',
    model_path VARCHAR(500) NOT NULL,
    explainer_path VARCHAR(500) NOT NULL,
    feature_names TEXT[] NOT NULL DEFAULT '{}',
    metrics JSONB DEFAULT '{}',
    hyperparameters JSONB DEFAULT '{}',
    mlflow_run_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'CANDIDATE' 
        CHECK (status IN ('CANDIDATE', 'ACTIVE', 'ROLLED_BACK', 'DEPRECATED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system',
    description TEXT,
    
    -- Constraints
    CONSTRAINT valid_version_format CHECK (version ~ '^\d{8}_\d{6}$')
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_model_registry_status ON ml_model_registry(status);
CREATE INDEX IF NOT EXISTS idx_model_registry_created_at ON ml_model_registry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_registry_version ON ml_model_registry(version);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_model_registry_updated_at
    BEFORE UPDATE ON ml_model_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PREDICTION METRICS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS ml_prediction_metrics (
    id SERIAL PRIMARY KEY,
    model_version VARCHAR(50) NOT NULL REFERENCES ml_model_registry(version),
    prediction_count BIGINT NOT NULL DEFAULT 0,
    error_count BIGINT NOT NULL DEFAULT 0,
    avg_latency_ms FLOAT DEFAULT 0,
    p50_latency_ms FLOAT DEFAULT 0,
    p95_latency_ms FLOAT DEFAULT 0,
    p99_latency_ms FLOAT DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Unique constraint for upserts
    CONSTRAINT unique_version_recorded_at UNIQUE (model_version, recorded_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prediction_metrics_version ON ml_prediction_metrics(model_version);
CREATE INDEX IF NOT EXISTS idx_prediction_metrics_recorded_at ON ml_prediction_metrics(recorded_at DESC);

-- =============================================================================
-- FEATURE STATISTICS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS ml_feature_statistics (
    id SERIAL PRIMARY KEY,
    model_version VARCHAR(50) NOT NULL REFERENCES ml_model_registry(version),
    feature_name VARCHAR(100) NOT NULL,
    feature_importance_gain FLOAT DEFAULT 0,
    shap_importance FLOAT DEFAULT 0,
    min_value FLOAT,
    max_value FLOAT,
    mean_value FLOAT,
    std_value FLOAT,
    null_rate FLOAT DEFAULT 0,
    computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_version_feature UNIQUE (model_version, feature_name)
);

CREATE INDEX IF NOT EXISTS idx_feature_stats_version ON ml_feature_statistics(model_version);

-- =============================================================================
-- TRAINING HISTORY TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS ml_training_history (
    id SERIAL PRIMARY KEY,
    model_version VARCHAR(50) NOT NULL REFERENCES ml_model_registry(version),
    training_start TIMESTAMP WITH TIME ZONE NOT NULL,
    training_end TIMESTAMP WITH TIME ZONE NOT NULL,
    training_duration_seconds INT,
    dataset_size BIGINT,
    dataset_path VARCHAR(500),
    cross_validation_folds INT DEFAULT 5,
    cv_auc_mean FLOAT,
    cv_auc_std FLOAT,
    cv_logloss_mean FLOAT,
    cv_logloss_std FLOAT,
    best_iteration INT,
    training_config JSONB DEFAULT '{}',
    training_logs TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
        CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_history_status ON ml_training_history(status);
CREATE INDEX IF NOT EXISTS idx_training_history_model_version ON ml_training_history(model_version);

-- =============================================================================
-- MODEL DRIFT METRICS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS ml_drift_metrics (
    id SERIAL PRIMARY KEY,
    model_version VARCHAR(50) NOT NULL REFERENCES ml_model_registry(version),
    metric_date DATE NOT NULL,
    prediction_drift FLOAT DEFAULT 0,
    feature_drift JSONB DEFAULT '{}',
    ks_statistic FLOAT,
    psi_score FLOAT,  -- Population Stability Index
    data_quality_score FLOAT DEFAULT 1.0,
    alert_triggered BOOLEAN DEFAULT FALSE,
    computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_version_metric_date UNIQUE (model_version, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_drift_metrics_version ON ml_drift_metrics(model_version);
CREATE INDEX IF NOT EXISTS idx_drift_metrics_date ON ml_drift_metrics(metric_date DESC);

-- =============================================================================
-- A/B TEST CONFIGURATION TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS ml_ab_tests (
    id SERIAL PRIMARY KEY,
    test_name VARCHAR(100) NOT NULL UNIQUE,
    model_version_a VARCHAR(50) NOT NULL REFERENCES ml_model_registry(version),
    model_version_b VARCHAR(50) NOT NULL REFERENCES ml_model_registry(version),
    traffic_split_a FLOAT NOT NULL DEFAULT 0.5 CHECK (traffic_split_a >= 0 AND traffic_split_a <= 1),
    traffic_split_b FLOAT GENERATED ALWAYS AS (1 - traffic_split_a) STORED,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING'
        CHECK (status IN ('SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED')),
    targeting_rules JSONB DEFAULT '{}',
    success_metric VARCHAR(50) DEFAULT 'conversion_rate',
    confidence_level FLOAT DEFAULT 0.95,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ml_ab_tests(status);

-- =============================================================================
-- A/B TEST RESULTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS ml_ab_test_results (
    id SERIAL PRIMARY KEY,
    test_id INT NOT NULL REFERENCES ml_ab_tests(id),
    model_version VARCHAR(50) NOT NULL,
    sample_size BIGINT DEFAULT 0,
    conversion_count BIGINT DEFAULT 0,
    conversion_rate FLOAT DEFAULT 0,
    avg_score FLOAT DEFAULT 0,
    avg_latency_ms FLOAT DEFAULT 0,
    std_error FLOAT DEFAULT 0,
    confidence_interval_lower FLOAT,
    confidence_interval_upper FLOAT,
    computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_test_version_result UNIQUE (test_id, model_version)
);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get active model version
CREATE OR REPLACE FUNCTION get_active_model_version()
RETURNS VARCHAR(50) AS $$
DECLARE
    active_version VARCHAR(50);
BEGIN
    SELECT version INTO active_version
    FROM ml_model_registry
    WHERE status = 'ACTIVE'
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN active_version;
END;
$$ LANGUAGE plpgsql;

-- Promote a model to ACTIVE
CREATE OR REPLACE FUNCTION promote_model(p_version VARCHAR(50))
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INT;
BEGIN
    -- Set current ACTIVE to ROLLED_BACK
    UPDATE ml_model_registry 
    SET status = 'ROLLED_BACK', updated_at = NOW()
    WHERE status = 'ACTIVE';
    
    -- Promote specified version
    UPDATE ml_model_registry 
    SET status = 'ACTIVE', updated_at = NOW()
    WHERE version = p_version AND status = 'CANDIDATE';
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    
    RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql;

-- Record prediction
CREATE OR REPLACE FUNCTION record_prediction(
    p_model_version VARCHAR(50),
    p_latency_ms FLOAT,
    p_is_error BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO ml_prediction_metrics (
        model_version, 
        prediction_count, 
        error_count,
        avg_latency_ms,
        recorded_at
    ) VALUES (
        p_model_version,
        1,
        CASE WHEN p_is_error THEN 1 ELSE 0 END,
        p_latency_ms,
        NOW()
    )
    ON CONFLICT (model_version, recorded_at) DO UPDATE SET
        prediction_count = ml_prediction_metrics.prediction_count + 1,
        error_count = ml_prediction_metrics.error_count + CASE WHEN p_is_error THEN 1 ELSE 0 END,
        avg_latency_ms = (ml_prediction_metrics.avg_latency_ms * ml_prediction_metrics.prediction_count + p_latency_ms) 
                        / (ml_prediction_metrics.prediction_count + 1);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Insert a baseline model (for testing)
-- INSERT INTO ml_model_registry (version, model_type, model_path, explainer_path, status)
-- VALUES ('20240101_000000', 'lightgbm', 's3://cargobit-ml-models/suggestion-scoring/baseline/model.txt', 
--         's3://cargobit-ml-models/suggestion-scoring/baseline/explainer.pkl', 'ACTIVE');

-- =============================================================================
-- GRANTS (adjust as needed for your environment)
-- =============================================================================

-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO ml_service;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ml_service;
