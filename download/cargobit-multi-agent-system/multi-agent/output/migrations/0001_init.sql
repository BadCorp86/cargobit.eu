-- Migration: 0001_init
-- Description: Initial schema for CargoBit Payment System
-- Version: 1.0.0
-- Generated: 2026-05-02

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE "PaymentStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'REFUNDED',
    'CANCELLED'
);

-- =============================================================================
-- USERS TABLE
-- =============================================================================

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- =============================================================================
-- PAYMENTS TABLE
-- =============================================================================

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");
CREATE UNIQUE INDEX "payments_stripeChargeId_key" ON "payments"("stripeChargeId");

-- Add foreign key constraint
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- AUDIT LOGS TABLE
-- =============================================================================

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_paymentId_fkey" 
    FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- WEBHOOK EVENTS TABLE
-- =============================================================================

CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "payload" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_stripeEventId_key" ON "webhook_events"("stripeEventId");

-- =============================================================================
-- RATE LIMIT COUNTERS TABLE
-- =============================================================================

CREATE TABLE "rate_limit_counters" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rate_limit_counters_key_key" ON "rate_limit_counters"("key");

-- =============================================================================
-- BACKUP METADATA TABLE
-- =============================================================================

CREATE TABLE "backup_metadata" (
    "id" TEXT NOT NULL,
    "backupType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "storagePath" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "checksum" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "backup_metadata_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE "users" IS 'User accounts with Stripe customer mapping';
COMMENT ON TABLE "payments" IS 'Payment transactions with Stripe integration';
COMMENT ON TABLE "audit_logs" IS 'Immutable audit trail for compliance (7-year retention)';
COMMENT ON TABLE "webhook_events" IS 'Stripe webhook event processing with idempotency';
COMMENT ON TABLE "rate_limit_counters" IS 'Rate limiting counters for API protection';
COMMENT ON TABLE "backup_metadata" IS 'Backup operation tracking for PITR';
