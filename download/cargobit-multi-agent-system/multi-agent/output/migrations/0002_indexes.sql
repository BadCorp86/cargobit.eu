-- Migration: 0002_indexes
-- Description: Performance indexes for CargoBit Payment System
-- Version: 1.0.0
-- Generated: 2026-05-02

-- =============================================================================
-- USER INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_stripeCustomerId_idx" ON "users"("stripeCustomerId");

-- =============================================================================
-- PAYMENT INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS "payments_userId_idx" ON "payments"("userId");
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments"("status");
CREATE INDEX IF NOT EXISTS "payments_createdAt_idx" ON "payments"("createdAt");
CREATE INDEX IF NOT EXISTS "payments_stripePaymentIntentId_idx" ON "payments"("stripePaymentIntentId");
CREATE INDEX IF NOT EXISTS "payments_stripeChargeId_idx" ON "payments"("stripeChargeId");

-- Composite index for common query pattern (user payments by status)
CREATE INDEX IF NOT EXISTS "payments_userId_status_idx" ON "payments"("userId", "status");

-- Composite index for date-range queries
CREATE INDEX IF NOT EXISTS "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

-- =============================================================================
-- AUDIT LOG INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_requestId_idx" ON "audit_logs"("requestId");

-- Composite index for compliance queries (action + time range)
CREATE INDEX IF NOT EXISTS "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- Composite index for entity audit trail
CREATE INDEX IF NOT EXISTS "audit_logs_entity_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");

-- =============================================================================
-- WEBHOOK EVENT INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS "webhook_events_stripeEventId_idx" ON "webhook_events"("stripeEventId");
CREATE INDEX IF NOT EXISTS "webhook_events_eventType_idx" ON "webhook_events"("eventType");
CREATE INDEX IF NOT EXISTS "webhook_events_processed_idx" ON "webhook_events"("processed");
CREATE INDEX IF NOT EXISTS "webhook_events_receivedAt_idx" ON "webhook_events"("receivedAt");

-- Composite index for processing queue (unprocessed events, oldest first)
CREATE INDEX IF NOT EXISTS "webhook_events_processed_receivedAt_idx" 
    ON "webhook_events"("processed", "receivedAt");

-- Index for retry processing
CREATE INDEX IF NOT EXISTS "webhook_events_retry_idx" 
    ON "webhook_events"("processed", "retryCount") 
    WHERE "processed" = false AND "retryCount" < 5;

-- =============================================================================
-- RATE LIMIT INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS "rate_limit_counters_key_idx" ON "rate_limit_counters"("key");
CREATE INDEX IF NOT EXISTS "rate_limit_counters_expiresAt_idx" ON "rate_limit_counters"("expiresAt");

-- =============================================================================
-- BACKUP METADATA INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS "backup_metadata_backupType_idx" ON "backup_metadata"("backupType");
CREATE INDEX IF NOT EXISTS "backup_metadata_status_idx" ON "backup_metadata"("status");
CREATE INDEX IF NOT EXISTS "backup_metadata_startedAt_idx" ON "backup_metadata"("startedAt");

-- =============================================================================
-- PARTIAL INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index only unprocessed webhook events (smaller, faster)
CREATE INDEX IF NOT EXISTS "webhook_events_unprocessed_idx" 
    ON "webhook_events"("receivedAt", "eventType") 
    WHERE "processed" = false;

-- Index only active rate limit counters
CREATE INDEX IF NOT EXISTS "rate_limit_counters_active_idx" 
    ON "rate_limit_counters"("key", "count") 
    WHERE "expiresAt" > CURRENT_TIMESTAMP;

-- Index only running backups
CREATE INDEX IF NOT EXISTS "backup_metadata_running_idx" 
    ON "backup_metadata"("startedAt") 
    WHERE "status" = 'running';

-- =============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- =============================================================================

ANALYZE "users";
ANALYZE "payments";
ANALYZE "audit_logs";
ANALYZE "webhook_events";
ANALYZE "rate_limit_counters";
ANALYZE "backup_metadata";

-- =============================================================================
-- INDEX USAGE MONITORING QUERY (for reference)
-- =============================================================================

-- Run this query periodically to identify unused indexes:
-- SELECT 
--     schemaname || '.' || relname AS table,
--     indexrelname AS index,
--     pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
--     idx_scan AS index_scans
-- FROM pg_stat_user_indexes ui
-- JOIN pg_index i ON ui.indexrelid = i.indexrelid
-- WHERE NOT indisunique 
--   AND idx_scan < 50 
--   AND pg_relation_size(i.indexrelid) > '5 MB'::bigint
-- ORDER BY pg_relation_size(i.indexrelid) DESC;
