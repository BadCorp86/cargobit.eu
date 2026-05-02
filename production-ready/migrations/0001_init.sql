-- Migration: 0001_init
-- Description: Initial schema for CargoBit Payment System
-- PostgreSQL 14+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- User & Authentication
-- ============================================

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'CUSTOMER');

CREATE TABLE "users" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON "users"(email);
CREATE INDEX idx_users_role ON "users"(role);

CREATE TABLE "sessions" (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_token ON "sessions"(token);
CREATE INDEX idx_sessions_user_id ON "sessions"(user_id);

-- ============================================
-- Payments
-- ============================================

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED');

CREATE TABLE "payments" (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id           TEXT NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
  stripe_payment_id TEXT UNIQUE,
  amount            INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'EUR',
  status            "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  description       TEXT,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user_id ON "payments"(user_id);
CREATE INDEX idx_payments_status ON "payments"(status);
CREATE INDEX idx_payments_stripe_payment_id ON "payments"(stripe_payment_id);
CREATE INDEX idx_payments_created_at ON "payments"(created_at);

-- ============================================
-- Reconciliation
-- ============================================

CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "RecordStatus" AS ENUM ('PENDING', 'MATCHED', 'MISMATCHED', 'ERROR');

CREATE TABLE "reconciliation_batches" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  status          "BatchStatus" NOT NULL DEFAULT 'PENDING',
  total_records   INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reconciliation_batches_status ON "reconciliation_batches"(status);
CREATE INDEX idx_reconciliation_batches_created_at ON "reconciliation_batches"(created_at);

CREATE TABLE "reconciliation_records" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  batch_id       TEXT NOT NULL REFERENCES "reconciliation_batches"(id) ON DELETE CASCADE,
  external_id    TEXT NOT NULL,
  internal_id    TEXT,
  amount         INTEGER NOT NULL,
  currency       TEXT NOT NULL,
  status         "RecordStatus" NOT NULL DEFAULT 'PENDING',
  mismatch_reason TEXT,
  score          FLOAT,
  raw_data       JSONB,
  processed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reconciliation_records_batch_id ON "reconciliation_records"(batch_id);
CREATE INDEX idx_reconciliation_records_external_id ON "reconciliation_records"(external_id);
CREATE INDEX idx_reconciliation_records_status ON "reconciliation_records"(status);

-- ============================================
-- Stripe Integration
-- ============================================

CREATE TABLE "stripe_events" (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  payload      JSONB NOT NULL,
  processed    BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_events_type ON "stripe_events"(type);
CREATE INDEX idx_stripe_events_processed ON "stripe_events"(processed);
CREATE INDEX idx_stripe_events_created_at ON "stripe_events"(created_at);

-- ============================================
-- Audit Log (Tamper-Proof)
-- ============================================

CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'API', 'WEBHOOK');

CREATE TABLE "audit_logs" (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor      TEXT NOT NULL,
  actor_type "ActorType" NOT NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',
  prev_hash  TEXT,
  hash       TEXT NOT NULL,
  
  CONSTRAINT fk_audit_user FOREIGN KEY (actor) REFERENCES "users"(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_timestamp ON "audit_logs"(timestamp DESC);
CREATE INDEX idx_audit_logs_actor ON "audit_logs"(actor);
CREATE INDEX idx_audit_logs_entity ON "audit_logs"(entity, entity_id);
CREATE INDEX idx_audit_logs_action ON "audit_logs"(action);

-- Audit Log immutability trigger
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable. INSERT only, no UPDATE or DELETE allowed.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

-- ============================================
-- Rate Limiting
-- ============================================

CREATE TABLE "rate_limit_entries" (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key          TEXT UNIQUE NOT NULL,
  tokens       INTEGER NOT NULL DEFAULT 0,
  last_refill  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_entries_key ON "rate_limit_entries"(key);

-- ============================================
-- Settings
-- ============================================

CREATE TABLE "settings" (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key       TEXT UNIQUE NOT NULL,
  value     JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Updated_at triggers for all tables
-- ============================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_timestamp
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_payments_timestamp
  BEFORE UPDATE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_rate_limit_entries_timestamp
  BEFORE UPDATE ON "rate_limit_entries"
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================
-- Initial Data
-- ============================================

-- Insert default settings
INSERT INTO "settings" (key, value) VALUES
  ('rate_limits', '{"default": {"limit": 100, "window": 60}}'),
  ('reconciliation', '{"batch_size": 1000, "timeout": 300}'),
  ('audit', '{"retention_days": 90, "export_enabled": true}');

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cargobit_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cargobit_user;
