/**
 * Architect Agent
 * 
 * Verantwortlich für Datenmodellierung, Prisma Schema und SQL-Migrationen.
 * Generiert das technische Fundament für die CargoBit Payment Platform.
 */

import { BaseAgent, AgentConfig, Task, GeneratedFile } from './BaseAgent';

// ================================================================================
// ARCHITECT AGENT CONFIGURATION
// ================================================================================

export const ARCHITECT_CONFIG: AgentConfig = {
  id: 'architect',
  name: 'Database Architect',
  role: 'database_design',
  description: 'Verantwortlich für Datenmodellierung, Prisma Schema und SQL-Migrationen',
  
  capabilities: [
    'prisma_schema_generation',
    'sql_migration_writing',
    'database_indexing',
    'architecture_documentation',
  ],
  
  priority: 1,
  maxConcurrentTasks: 1,
  
  inputs: [
    'project_requirements',
    'tech_stack_specification',
  ],
  
  outputs: [
    { path: 'prisma/schema.prisma', type: 'prisma', description: 'Vollständiges Prisma Schema' },
    { path: 'migrations/0001_init.sql', type: 'sql', description: 'Initiale SQL Migration' },
    { path: 'migrations/0002_indexes.sql', type: 'sql', description: 'Performance-Indexe' },
    { path: 'docs/architecture/database.md', type: 'markdown', description: 'DB-Architektur-Doku' },
  ],
  
  signals: {
    emits: ['SCHEMA_READY', 'MIGRATIONS_READY', 'MODELS_DEFINED'],
    consumes: [],
  },
  
  dependencies: [],
  
  prompts: {
    system: `Du bist der Database Architect für das CargoBit Payment System.

DEINE AUFGABE:
Erstelle ein vollständiges, produktionsreifes Prisma Schema und SQL-Migrationen.

MODELL-ANFORDERUNGEN:
- User: Authentifizierung, Rollen, KYC-Status
- Wallet: Multi-Currency, Balances, Status
- Payment: Stripe-Integration, Status-Tracking, Idempotency
- Payout: Bankverbindung, Status
- Transaction: Wallet-Buchungen, Balance-Tracking
- Refund: Rückerstattungen, Stripe-Integration
- AuditLog: Hash-Chain, Manipulationsschutz
- StripeEvent: Webhook-Idempotency

OUTPUT-FORMAT:
### FILE: pfad/zur/datei.ext
\`\`\`sprache
[vollständiger Dateiinhalt]
\`\`\``,
    task: `Erstelle {task_description}.

Anforderungen:
{requirements}

Output-Dateien:
{output_files}`,
  },
};

// ================================================================================
// ARCHITECT AGENT IMPLEMENTATION
// ================================================================================

export class ArchitectAgent extends BaseAgent {
  constructor(outputDir: string) {
    super(ARCHITECT_CONFIG, outputDir);
  }

  async execute(task: Task): Promise<GeneratedFile[]> {
    console.log(`\n🏗️ [${this.config.name}] Starting: ${task.description}`);
    
    const files: GeneratedFile[] = [];

    // 1. Generiere Prisma Schema
    console.log('  📝 Generating Prisma Schema...');
    const prismaSchema = this.generatePrismaSchema();
    files.push(this.createFile('prisma/schema.prisma', prismaSchema, 'prisma'));

    // 2. Generiere initiale Migration
    console.log('  📝 Generating Initial Migration...');
    const initMigration = this.generateInitMigration();
    files.push(this.createFile('migrations/0001_init.sql', initMigration, 'sql'));

    // 3. Generiere Index-Migration
    console.log('  📝 Generating Index Migration...');
    const indexMigration = this.generateIndexMigration();
    files.push(this.createFile('migrations/0002_indexes.sql', indexMigration, 'sql'));

    // 4. Generiere Architektur-Dokumentation
    console.log('  📝 Generating Architecture Documentation...');
    const archDoc = this.generateArchitectureDoc();
    files.push(this.createFile('docs/architecture/database.md', archDoc, 'markdown'));

    console.log(`  ✅ [${this.config.name}] Completed: ${files.length} files generated`);
    
    return files;
  }

  // ------------------------------------------------------------------------------
  // PRISMA SCHEMA GENERATION
  // ------------------------------------------------------------------------------

  private generatePrismaSchema(): string {
    return `// Prisma Schema für CargoBit Payment Platform
// PostgreSQL 15+ kompatibel
// Generiert von Architect Agent

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "metrics"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== ENUMS ====================

enum UserRole {
  SHIPPER
  CARRIER
  DRIVER
  DISPATCHER
  ADMIN
  SUPPORT
}

enum UserStatus {
  PENDING
  ACTIVE
  SUSPENDED
  DELETED
}

enum KycStatus {
  PENDING
  SUBMITTED
  UNDER_REVIEW
  APPROVED
  REJECTED
}

enum WalletStatus {
  ACTIVE
  FROZEN
  CLOSED
}

enum Currency {
  EUR
  USD
  GBP
  CHF
  PLN
}

enum PaymentStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum PaymentMethod {
  CARD
  SEPA
  WALLET
  BANK_TRANSFER
}

enum PayoutStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

enum TransactionType {
  DEPOSIT
  WITHDRAWAL
  PAYMENT
  PAYOUT
  REFUND
  FEE
  ADJUSTMENT
}

enum TransactionStatus {
  PENDING
  COMPLETED
  FAILED
  REVERSED
}

enum RefundStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

// ==================== USER ====================

model User {
  id              String      @id @default(cuid())
  email           String      @unique
  emailVerified   DateTime?
  passwordHash    String
  role            UserRole    @default(SHIPPER)
  status          UserStatus  @default(PENDING)
  
  // Profil
  firstName       String?
  lastName        String?
  companyName     String?
  phone           String?
  
  // KYC
  kycStatus       KycStatus   @default(PENDING)
  kycSubmittedAt  DateTime?
  kycApprovedAt   DateTime?
  
  // Timestamps
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  lastLoginAt     DateTime?
  
  // Relationen
  wallets         Wallet[]
  payments        Payment[]
  payouts         Payout[]
  auditLogs       AuditLog[]
  
  @@index([email])
  @@index([role, status])
  @@map("users")
}

// ==================== WALLET ====================

model Wallet {
  id                String        @id @default(cuid())
  userId            String
  currency          Currency      @default(EUR)
  balance           Decimal       @default(0) @db.Decimal(18, 4)
  availableBalance  Decimal       @default(0) @db.Decimal(18, 4)
  pendingBalance    Decimal       @default(0) @db.Decimal(18, 4)
  status            WalletStatus  @default(ACTIVE)
  
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions      Transaction[]
  
  @@unique([userId, currency])
  @@index([userId])
  @@map("wallets")
}

// ==================== PAYMENT ====================

model Payment {
  id                      String          @id @default(cuid())
  userId                  String
  walletId                String?
  stripePaymentIntentId   String?         @unique
  stripeChargeId          String?
  
  amount                  Decimal         @db.Decimal(18, 4)
  currency                Currency        @default(EUR)
  fee                     Decimal         @default(0) @db.Decimal(18, 4)
  netAmount               Decimal         @db.Decimal(18, 4)
  
  status                  PaymentStatus   @default(PENDING)
  method                  PaymentMethod?
  
  description             String?
  metadata                Json?
  
  // Idempotency
  idempotencyKey          String?         @unique
  
  // Timestamps
  createdAt               DateTime        @default(now())
  updatedAt               DateTime        @updatedAt
  completedAt             DateTime?
  failedAt                DateTime?
  
  // Relationen
  user                    User            @relation(fields: [userId], references: [id])
  transactions            Transaction[]
  refunds                 Refund[]
  
  @@index([userId, status])
  @@index([stripePaymentIntentId])
  @@index([createdAt])
  @@map("payments")
}

// ==================== PAYOUT ====================

model Payout {
  id                String        @id @default(cuid())
  userId            String
  walletId          String
  
  amount            Decimal       @db.Decimal(18, 4)
  currency          Currency      @default(EUR)
  fee               Decimal       @default(0) @db.Decimal(18, 4)
  netAmount         Decimal       @db.Decimal(18, 4)
  
  status            PayoutStatus  @default(PENDING)
  
  // Bankverbindung
  bankAccountHolder String?
  bankIban          String?
  bankBic           String?
  bankName          String?
  
  stripePayoutId    String?       @unique
  
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  completedAt       DateTime?
  
  user              User          @relation(fields: [userId], references: [id])
  transactions      Transaction[]
  
  @@index([userId, status])
  @@index([createdAt])
  @@map("payouts")
}

// ==================== TRANSACTION ====================

model Transaction {
  id              String            @id @default(cuid())
  walletId        String
  paymentId       String?
  payoutId        String?
  
  type            TransactionType
  status          TransactionStatus @default(PENDING)
  
  amount          Decimal           @db.Decimal(18, 4)
  balanceBefore   Decimal           @db.Decimal(18, 4)
  balanceAfter    Decimal           @db.Decimal(18, 4)
  
  description     String?
  reference       String?
  
  createdAt       DateTime          @default(now())
  
  wallet          Wallet            @relation(fields: [walletId], references: [id])
  payment         Payment?          @relation(fields: [paymentId], references: [id])
  
  @@index([walletId, createdAt])
  @@index([type, status])
  @@map("transactions")
}

// ==================== REFUND ====================

model Refund {
  id              String        @id @default(cuid())
  paymentId       String
  stripeRefundId  String?       @unique
  
  amount          Decimal       @db.Decimal(18, 4)
  reason          String?
  status          RefundStatus  @default(PENDING)
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  completedAt     DateTime?
  
  payment         Payment       @relation(fields: [paymentId], references: [id])
  
  @@index([paymentId])
  @@map("refunds")
}

// ==================== AUDIT LOG ====================

model AuditLog {
  id            String    @id @default(cuid())
  userId        String?
  
  action        String
  entityType    String
  entityId      String?
  
  oldValue      Json?
  newValue      Json?
  
  ipAddress     String?
  userAgent     String?
  
  // Hash-Chain für Integrität
  prevHash      String?
  hash          String
  
  createdAt     DateTime  @default(now())
  
  user          User?     @relation(fields: [userId], references: [id])
  
  @@index([userId, createdAt])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}

// ==================== STRIPE EVENT ====================

model StripeEvent {
  id              String    @id @default(cuid())
  stripeEventId   String    @unique
  type            String
  data           Json
  processed       Boolean   @default(false)
  processedAt     DateTime?
  error           String?
  
  createdAt       DateTime  @default(now())
  
  @@index([stripeEventId])
  @@index([processed, createdAt])
  @@map("stripe_events")
}
`;
  }

  // ------------------------------------------------------------------------------
  // SQL MIGRATION GENERATION
  // ------------------------------------------------------------------------------

  private generateInitMigration(): string {
    return `-- Migration: 0001_init
-- Erstellt die initiale Datenbankschema für CargoBit Payment Platform
-- PostgreSQL 15+

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== ENUMS ====================

CREATE TYPE "UserRole" AS ENUM ('SHIPPER', 'CARRIER', 'DRIVER', 'DISPATCHER', 'ADMIN', 'SUPPORT');
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
CREATE TYPE "Currency" AS ENUM ('EUR', 'USD', 'GBP', 'CHF', 'PLN');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'SEPA', 'WALLET', 'BANK_TRANSFER');
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'PAYMENT', 'PAYOUT', 'REFUND', 'FEE', 'ADJUSTMENT');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- ==================== USERS TABLE ====================

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SHIPPER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "phone" TEXT,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "kycSubmittedAt" TIMESTAMP(3),
    "kycApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- ==================== WALLETS TABLE ====================

CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "availableBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pendingBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallets_userId_currency_key" ON "wallets"("userId", "currency");
CREATE INDEX "wallets_userId_idx" ON "wallets"("userId");

ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================== PAYMENTS TABLE ====================

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "fee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(18,4) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PaymentMethod",
    "description" TEXT,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");
CREATE INDEX "payments_userId_status_idx" ON "payments"("userId", "status");
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==================== STRIPE EVENTS TABLE ====================

CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stripe_events_stripeEventId_key" ON "stripe_events"("stripeEventId");
CREATE INDEX "stripe_events_processed_createdAt_idx" ON "stripe_events"("processed", "createdAt");

-- ==================== AUDIT LOGS TABLE ====================

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
`;
  }

  private generateIndexMigration(): string {
    return `-- Migration: 0002_indexes
-- Zusätzliche Performance-Indexe
-- PostgreSQL 15+

-- ==================== PARTIAL INDEXES ====================

-- Aktive Payments
CREATE INDEX CONCURRENTLY IF NOT EXISTS "payments_active_idx" 
    ON "payments"("userId", "createdAt" DESC)
    WHERE "status" IN ('PENDING', 'PROCESSING');

-- Nicht verarbeitete Stripe Events
CREATE INDEX CONCURRENTLY IF NOT EXISTS "stripe_events_pending_idx" 
    ON "stripe_events"("createdAt")
    WHERE "processed" = false;

-- ==================== COVERING INDEXES ====================

-- Wallet Balance (häufigste Query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "wallets_balance_idx" 
    ON "wallets"("userId", "currency")
    INCLUDE ("balance", "availableBalance", "pendingBalance", "status");

-- ==================== ANALYTICS INDEXES ====================

-- Transaction Volume
CREATE INDEX CONCURRENTLY IF NOT EXISTS "transactions_daily_volume_idx" 
    ON "transactions"("type", "createdAt" DESC)
    INCLUDE ("amount", "status");

-- ==================== CLEANUP FUNCTIONS ====================

CREATE OR REPLACE FUNCTION "cleanup_old_stripe_events"() RETURNS void AS $$
BEGIN
    DELETE FROM "stripe_events" 
    WHERE "processed" = true AND "createdAt" < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ==================== STATISTICS ====================

ANALYZE "users";
ANALYZE "wallets";
ANALYZE "payments";
ANALYZE "stripe_events";
ANALYZE "audit_logs";
`;
  }

  // ------------------------------------------------------------------------------
  // DOCUMENTATION GENERATION
  // ------------------------------------------------------------------------------

  private generateArchitectureDoc(): string {
    return `# CargoBit Database Architecture

## Übersicht

Dieses Dokument beschreibt die Datenbank-Architektur der CargoBit Payment Platform.

## Entity-Relationship-Diagramm

\`\`\`
┌─────────┐       ┌─────────┐       ┌─────────────┐
│  User   │───1:N─│  Wallet │───1:N─│ Transaction │
└─────────┘       └─────────┘       └─────────────┘
     │                                    │
     │ 1:N                                │
     ▼                                    │
┌─────────┐                         N:1   │
│ Payment │◄──────────────────────────────┘
└─────────┘
     │
     │ 1:N
     ▼
┌─────────┐
│ Refund  │
└─────────┘
\`\`\`

## Tabellen-Übersicht

| Tabelle | Beschreibung | Primärschlüssel |
|---------|--------------|-----------------|
| users | Benutzerkonten | id (cuid) |
| wallets | Multi-Currency Wallets | id (cuid) |
| payments | Zahlungsanfragen | id (cuid) |
| payouts | Auszahlungen | id (cuid) |
| transactions | Wallet-Buchungen | id (cuid) |
| refunds | Rückerstattungen | id (cuid) |
| audit_logs | Audit-Trail mit Hash-Chain | id (cuid) |
| stripe_events | Webhook-Idempotency | id (cuid) |

## Index-Strategie

- **Unique Indexes**: email, stripePaymentIntentId, idempotencyKey
- **Performance Indexes**: userId+status, createdAt
- **Partial Indexes**: Aktive Payments, Pending Events
- **Covering Indexes**: Wallet Balance Queries

## Datenbank-Konfiguration

- PostgreSQL 15+
- Connection Pooling: PgBouncer
- Backup: Täglich mit PITR
- Encoding: UTF-8
`;
  }
}
