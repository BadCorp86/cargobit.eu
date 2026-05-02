# 🤖 GitHub Copilot / VS Code Version

## Anleitung

Diese Version ist optimiert für **GitHub Copilot** in VS Code. Öffne eine neue Datei und beginne mit dem Kommentar-Header. Copilot wird den Code automatisch vorschlagen.

---

## Schritt 1: Projektstruktur erstellen

Erstelle folgende Ordnerstruktur in deinem VS Code Workspace:

```
cargobit-payment-system/
├── .github/
│   └── copilot-instructions.md
├── prisma/
├── migrations/
├── src/
│   ├── lib/
│   ├── middleware/
│   ├── webhooks/
│   ├── services/
│   ├── jobs/
│   └── scripts/
├── ops/
├── tests/
└── docs/
```

---

## Schritt 2: Copilot Instructions erstellen

Erstelle `.github/copilot-instructions.md`:

```markdown
# CargoBit Payment System - Copilot Instructions

## Projekt-Kontext
CargoBit ist eine Payment-Plattform für Logistik-Zahlungen. Wir migrieren von SQLite/In-Memory zu PostgreSQL/Redis.

## Technologie-Stack
- Node.js 20+ / TypeScript 5.x
- Prisma 5.x ORM
- PostgreSQL 15+ (Neon/Supabase)
- Redis 7+ (Upstash)
- Stripe API
- Express 4.x

## Code-Stil
- TypeScript strict mode
- Async/await (keine .then() chains)
- explizite Typ-Annotationen
- JSDoc Kommentare für öffentliche Funktionen
- Deutschsprachige Kommentare, Englisch für Code

## Module zu generieren

### A) PostgreSQL Migration
- Prisma Schema mit User, Wallet, Payment, Payout, Transaction, AuditLog
- SQL Migration Dateien
- Migration Scripts

### B) Redis Rate Limiting
- Token Bucket Algorithmus
- Sliding Window Algorithmus
- Express Middleware

### C) Backup System
- Bash Backup Scripts
- Kubernetes CronJob YAML
- Restore Playbook

### D) Stripe Webhooks
- Signature Validation
- Idempotency Layer
- Event Router

### E) Audit Logging
- Hash-Chain Implementation
- Verification Job
- Export Scripts

### F) Documentation
- Operational Checklists
- Incident Playbooks
- Security Policies
```

---

## Schritt 3: Inline-Prompts für Copilot

### A) Prisma Schema

Öffne `prisma/schema.prisma` und tippe:

```prisma
// CargoBit Payment Platform - Prisma Schema
// PostgreSQL 15+ kompatibel
// 
// Generiere ein vollständiges Prisma Schema für eine Payment-Plattform mit:
// - User Model mit Rolle, KYC-Status, Authentifizierung
// - Wallet Model mit Multi-Currency Support, Balances
// - Payment Model mit Stripe-Integration, Status-Tracking
// - Payout Model mit Bankverbindung
// - Transaction Model für Wallet-Buchungen
// - AuditLog Model mit Hash-Chain für Integrität
// - StripeEvent Model für Idempotency
// - Alle Enums für Status
// - Indexe für häufige Queries
// - Relationen zwischen allen Modellen

generator client {
  // Copilot wird hier weitermachen...
}
```

### B) Rate Limiting

Öffne `src/lib/rateLimit.ts` und tippe:

```typescript
/**
 * Redis-basiertes Rate Limiting Modul
 * 
 * Implementiere:
 * 1. TokenBucketRateLimiter Klasse
 *    - checkLimit(key, config): Promise<RateLimitResult>
 *    - reset(key): Promise<void>
 *    - Lua Script für atomare Operation
 * 
 * 2. SlidingWindowRateLimiter Klasse
 *    - checkLimit(key, maxRequests, windowMs): Promise<RateLimitResult>
 *    - Verwendung von Redis Sorted Sets
 * 
 * 3. Rate Limit Policies:
 *    - api:global: 1000/Min
 *    - api:auth: 10/Min
 *    - api:payment: 20/Min
 * 
 * 4. Helper Functions:
 *    - extractClientIp(req)
 *    - generateRateLimitKey(identifier, endpoint, userId?)
 */

import { Redis } from 'ioredis';
// Copilot wird hier weitermachen...
```

### C) Stripe Webhook Handler

Öffne `src/webhooks/stripe.ts` und tippe:

```typescript
/**
 * Stripe Webhook Handler mit Security-First Ansatz
 * 
 * Implementiere:
 * 1. Signature Validation
 *    - parseSignatureHeader(header)
 *    - validateSignature(payload, signature, secret)
 *    - Replay Attack Prevention (5 Min Toleranz)
 *    - timingSafeEqual für Vergleich
 * 
 * 2. Idempotency Layer
 *    - checkIdempotency(stripeEventId)
 *    - markEventProcessed(stripeEventId, type, data)
 *    - markEventFailed(stripeEventId, error)
 * 
 * 3. Event Handler
 *    - handlePaymentIntentSucceeded(paymentIntent)
 *    - handlePaymentIntentFailed(paymentIntent)
 *    - handleChargeRefunded(charge)
 *    - handleChargeDisputeCreated(dispute)
 * 
 * 4. Event Router
 *    - EVENT_HANDLERS Map
 *    - stripeWebhookHandler(req, res)
 */

import { Request, Response } from 'express';
import Stripe from 'stripe';
import { createHmac, timingSafeEqual } from 'crypto';
// Copilot wird hier weitermachen...
```

### D) Audit Log Service

Öffne `src/services/auditLog.ts` und tippe:

```typescript
/**
 * Hash-Chain Audit Log Service
 * 
 * Garantiert Integrität und Manipulationssicherheit aller Änderungen.
 * 
 * Implementiere:
 * 1. Hash-Chain Calculation
 *    - calculateHash(prevHash, timestamp, action, entityType, entityId, data)
 *    - getLastHash(): Promise<string | null>
 * 
 * 2. Audit Log Writer
 *    - writeAuditLog(entry: AuditLogEntry): Promise<string>
 *    - writeAuditLogBatch(entries): Promise<string[]>
 * 
 * 3. Audit Log Reader
 *    - queryAuditLogs(query: AuditLogQuery): Promise<{logs, total}>
 * 
 * 4. Chain Verification
 *    - verifyAuditChain(): Promise<VerificationResult>
 *    - Läuft von Genesis bis zum letzten Entry
 * 
 * 5. Export
 *    - exportAuditLogs(options): Promise<{data, filename, checksum}>
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
// Copilot wird hier weitermachen...
```

---

## Schritt 4: Test-Driven Development Prompts

### Rate Limiting Tests

Öffne `tests/rateLimit.test.ts` und tippe:

```typescript
/**
 * Unit Tests für Rate Limiting Modul
 * 
 * Testfälle:
 * 1. TokenBucketRateLimiter
 *    - sollte Anfrage erlauben wenn Tokens verfügbar
 *    - sollte Anfrage ablehnen wenn Bucket leer
 *    - sollte Tokens über Zeit auffüllen
 *    - sollte Bucket zurücksetzen können
 * 
 * 2. SlidingWindowRateLimiter
 *    - sollte korrekt zählen im Zeitfenster
 *    - sollte alte Einträge automatisch entfernen
 * 
 * 3. Rate Limit Policies
 *    - sollte gültige Policies haben
 *    - sollte auth policy restriktiver sein als global
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// Copilot wird hier weitermachen...
```

### Stripe Webhook Tests

Öffne `tests/stripeWebhook.test.ts` und tippe:

```typescript
/**
 * Unit Tests für Stripe Webhook Handler
 * 
 * Testfälle:
 * 1. Signature Validation
 *    - sollte gültige Signatur akzeptieren
 *    - sollte ungültige Signatur ablehnen
 *    - sollte abgelaufene Timestamps ablehnen (Replay Protection)
 *    - sollte malformed Header ablehnen
 * 
 * 2. Idempotency
 *    - sollte bereits verarbeitete Events erkennen
 *    - sollte neue Events speichern
 * 
 * 3. Event Processing
 *    - sollte payment_intent.succeeded korrekt verarbeiten
 *    - sollte payment_intent.failed korrekt verarbeiten
 *    - sollte charge.refunded korrekt verarbeiten
 */

import { describe, it, expect, vi } from 'vitest';
// Copilot wird hier weitermachen...
```

---

## Schritt 5: Documentation Prompts

### Operational Readiness Checklist

Öffne `docs/operational-readiness-checklist.md` und tippe:

```markdown
# CargoBit Operational Readiness Checklist

<!--
Generiere eine umfassende Launch-Checkliste mit:
1. Kritische Punkte (müssen vor Launch erfüllt sein)
   - Datenbank-Konfiguration
   - Rate Limiting
   - Sicherheit
   - Audit Logs

2. Wichtige Punkte (innerhalb 1 Woche nach Launch)
   - Monitoring
   - Dokumentation
   - Compliance

3. Empfohlene Punkte (laufende Verbesserung)
   - Performance
   - Resilience

4. Sign-off Tabelle für verschiedene Rollen
-->

## Vor Produktionsstart zu prüfen
<!-- Copilot wird hier weitermachen... -->
```

---

## Copilot Chat Prompts

Alternativ kannst du diese Prompts im **GitHub Copilot Chat** verwenden:

### Für das gesamte Projekt:

```
@workspace Erstelle ein vollständiges Payment-System mit:
1. Prisma Schema für User, Wallet, Payment, Payout, Transaction, AuditLog
2. Redis-basiertes Rate Limiting (Token Bucket + Sliding Window)
3. Stripe Webhook Handler mit Signature Validation
4. Hash-Chain Audit Logging
5. Backup Scripts für PostgreSQL
6. Operative Dokumentation

Nutze TypeScript, Prisma, Express, Redis, Stripe API.
```

### Für einzelne Module:

```
@workspace Generiere einen Token Bucket Rate Limiter mit Redis-Backend, 
der Lua-Scripts für atomare Operationen verwendet.
```

```
@workspace Erstelle einen Stripe Webhook Handler mit Signature Validation, 
Replay Attack Prevention und Idempotency Layer.
```

```
@workspace Implementiere ein Audit Log System mit Hash-Chain für 
Manipulationssicherheit. Jeder Entry muss den Hash des vorherigen enthalten.
```

---

## Tipps für beste Ergebnisse

1. **Öffne relevante Dateien** bevor du Copilot fragst (Context)
2. **Nutze @workspace** für projektweite Generierung
3. **Sei spezifisch** über Funktionen und Parameter
4. **Iteriere** - Copilot lernt aus vorherigen Generierungen
5. **Nutze Test-First** - schreibe Tests bevor die Implementation

---

*Diese Version ist optimiert für GitHub Copilot in VS Code.*
