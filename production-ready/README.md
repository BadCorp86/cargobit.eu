# Production-Ready Code - Woche 1 Blocker

Diese Dateien sind **1:1 bereit für dein Repository** - ohne weitere Nacharbeit.

---

## Struktur

```
production-ready/
├── prisma/
│   └── schema.prisma              # Vollständiges Prisma Schema
├── migrations/
│   └── 0001_init.sql              # Initiale PostgreSQL Migration
├── src/
│   ├── lib/
│   │   └── rateLimit.ts           # Redis Token Bucket Rate Limiting
│   ├── middleware/
│   │   └── rateLimit.ts           # Express Rate Limit Middleware
│   ├── webhooks/
│   │   └── stripe.ts              # Stripe Webhook Handler
│   ├── services/
│   │   ├── stripeEvents.ts        # Stripe Event Handlers
│   │   └── auditLog.ts            # Audit Log mit Hash-Chain
│   └── jobs/
│       └── auditVerify.ts         # Audit Integritätsprüfung
├── ops/
│   ├── backup-db.sh               # Backup Script (S3)
│   └── restore-db.sh              # Restore Script
├── tests/
│   ├── rateLimit.test.ts          # Rate Limiting Tests
│   └── stripeWebhook.test.ts      # Webhook Tests
└── docs/
    ├── backup-policy.md           # Backup Policy
    ├── operational-readiness-checklist.md
    ├── incident-playbook-payment-outage.md
    └── security-policy.md
```

---

## A) PostgreSQL Migration

### Dateien
- `prisma/schema.prisma` - Vollständiges Schema mit allen Modellen
- `migrations/0001_init.sql` - Initiale Migration

### Verwendung
```bash
# 1. Schema kopieren
cp prisma/schema.prisma /dein/projekt/prisma/

# 2. Migration anwenden
psql $DATABASE_URL -f migrations/0001_init.sql

# 3. Prisma Client generieren
npx prisma generate
```

---

## B) Redis Rate Limiting

### Dateien
- `src/lib/rateLimit.ts` - Token Bucket Implementierung
- `src/middleware/rateLimit.ts` - Express Middleware
- `tests/rateLimit.test.ts` - Tests

### Verwendung
```bash
# Abhängigkeiten installieren
npm install ioredis

# In Express verwenden
import { rateLimiters } from "./middleware/rateLimit";
app.use("/api/auth/login", rateLimiters.auth);
```

### Environment Variables
```bash
REDIS_URL="rediss://default:xxx@endpoint.upstash.io:6379"
```

---

## C) Backup & Restore

### Dateien
- `ops/backup-db.sh` - Tägliche Backups
- `ops/restore-db.sh` - Restore bei Bedarf
- `docs/backup-policy.md` - Policy

### Verwendung
```bash
# Ausführbar machen
chmod +x ops/*.sh

# Backup erstellen
./ops/backup-db.sh

# Restore (latest)
./ops/restore-db.sh latest

# Restore (specific)
./ops/restore-db.sh cargobit_full_20240115_030000
```

### Cron Job
```bash
# Täglicher Backup um 00:30 UTC
30 0 * * * /app/ops/backup-db.sh >> /var/log/backup.log 2>&1
```

---

## D) Stripe Webhook Handler

### Dateien
- `src/webhooks/stripe.ts` - Webhook Endpoint
- `src/services/stripeEvents.ts` - Event Handler
- `tests/stripeWebhook.test.ts` - Tests

### Verwendung
```typescript
import stripeWebhookHandler from "./webhooks/stripe";

// Raw Body Parser ist kritisch!
app.use("/api/webhooks/stripe", stripeWebhookHandler);
```

### Environment Variables
```bash
STRIPE_SECRET_KEY="sk_live_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"
```

---

## E) Audit Log System

### Dateien
- `src/services/auditLog.ts` - Hash-Chain Implementierung
- `src/jobs/auditVerify.ts` - Integritätsprüfung

### Verwendung
```typescript
import { logUserAction, logSystemAction } from "./services/auditLog";

// User-Aktion loggen
await logUserAction(userId, "payment.created", "payment", paymentId);

// System-Aktion loggen
await logSystemAction("backup.completed", "backup", backupId);

// Integrität prüfen
const result = await verifyAuditChain();
console.log("Valid:", result.valid);
```

### Cron Job
```bash
# Tägliche Integritätsprüfung um 04:00 UTC
0 4 * * * node dist/jobs/auditVerify.js --exit-on-error
```

---

## F) Policies & Playbooks

### Dateien
- `docs/backup-policy.md` - Backup Strategy
- `docs/operational-readiness-checklist.md` - Pre-Launch Checklist
- `docs/incident-playbook-payment-outage.md` - Incident Response
- `docs/security-policy.md` - Security Requirements

### Verwendung
1. Kontakte eintragen
2. URLs zu Dashboards aktualisieren
3. Team trainieren
4. Quarterly review

---

## Schnellstart

```bash
# 1. Alle Dateien in dein Projekt kopieren
cp -r production-ready/* /dein/projekt/

# 2. Abhängigkeiten installieren
npm install ioredis stripe

# 3. Environment Variables setzen
cp .env.example .env
# ... ausfüllen

# 4. Migration ausführen
npx prisma migrate dev

# 5. Tests ausführen
npm test
```

---

## Hinweise

### Wichtig
- **Raw Body Parser** für Stripe Webhooks ist kritisch
- **Rate Limit Fallback** Strategy definieren (fail-open vs fail-closed)
- **Audit Log Trigger** verhindert UPDATE/DELETE
- **Backup Restore** überschreibt bestehende Daten!

### Todo
- [ ] Kontakte in Incident Playbook eintragen
- [ ] Dashboard URLs aktualisieren
- [ ] Slack Webhook URL konfigurieren
- [ ] Erste Backup- und Restore-Tests durchführen
