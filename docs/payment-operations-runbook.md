# CargoBit Payment Platform - Operations Runbook

## Übersicht

Dieses Runbook deckt alle operativen Aspekte der CargoBit Zahlungsplattform ab, einschließlich Payouts, Webhooks, Idempotenz und Incident Response.

---

## Inhaltsverzeichnis

1. [Ersteinschätzung](#1-ersteinschätzung)
2. [Payout Worker Operations](#2-payout-worker-operations)
3. [Webhook Processing](#3-webhook-processing)
4. [Idempotency & Replay](#4-idempotency--replay)
5. [Wallet & Reconciliation](#5-wallet--reconciliation)
6. [Database Operations](#6-database-operations)
7. [Monitoring & Alerts](#7-monitoring--alerts)
8. [Incident Response](#8-incident-response)
9. [Wartungsfenster](#9-wartungsfenster)
10. [Kontakte & Eskalation](#10-kontakte--eskalation)

---

## 1. Ersteinschätzung

### Quick Health Check

```bash
# API Health
curl -s https://api.cargobit.eu/api/health | jq .

# Worker Status (systemd)
systemctl status cargobit-payout-worker

# Worker Status (Kubernetes)
kubectl get pods -l app=payout-worker -n cargobit

# Redis Connectivity
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping

# Database Connectivity
psql $DATABASE_URL -c "SELECT 1"

# Queue Depth
redis-cli -h $REDIS_HOST -p $REDIS_PORT LLEN bull:payouts:wait
```

### Status Dashboard

| Komponente | Check | Befehl |
|------------|-------|--------|
| API | HTTP 200 | `curl -sf https://api.cargobit.eu/api/health` |
| Worker | Running | `systemctl is-active cargobit-payout-worker` |
| Redis | PONG | `redis-cli ping` |
| DB | Connected | `psql -c "SELECT 1"` |
| Queue | Low depth | `redis-cli LLEN bull:payouts:wait` |

---

## 2. Payout Worker Operations

### Worker Starten (Systemd)

```bash
# Service starten
sudo systemctl start cargobit-payout-worker

# Service aktivieren (autostart)
sudo systemctl enable cargobit-payout-worker

# Logs verfolgen
sudo journalctl -u cargobit-payout-worker -f
```

### Worker Starten (Kubernetes)

```bash
# Deployment skalieren
kubectl scale deployment payout-worker --replicas=1 -n cargobit

# Logs verfolgen
kubectl logs -l app=payout-worker -n cargobit -f

# Pod Status
kubectl get pods -l app=payout-worker -n cargobit
```

### Worker Starten (Manuell)

```bash
# Mit Script
./scripts/start-payout-worker.sh --env-file .env.production

# Direkt
NODE_ENV=production REDIS_HOST=redis.local REDIS_PORT=6379 node dist/src/main.worker.js
```

### Worker Stoppen

```bash
# Graceful shutdown (systemd)
sudo systemctl stop cargobit-payout-worker

# Graceful shutdown (Kubernetes)
kubectl scale deployment payout-worker --replicas=0 -n cargobit

# Manuelles Stop-Signal
kill -TERM $(cat payout-worker.pid)
```

### Worker Neustart

```bash
# Systemd
sudo systemctl restart cargobit-payout-worker

# Kubernetes (Rolling Restart)
kubectl rollout restart deployment payout-worker -n cargobit
```

### Worker Logs Analysieren

```bash
# Systemd - Letzte 100 Zeilen
sudo journalctl -u cargobit-payout-worker -n 100

# Systemd - Seit bestimmter Zeit
sudo journalctl -u cargobit-payout-worker --since "1 hour ago"

# Kubernetes - Letzte 100 Zeilen
kubectl logs -l app=payout-worker -n cargobit --tail=100

# Kubernetes - Vorheriger Pod (nach Crash)
kubectl logs -l app=payout-worker -n cargobit --previous
```

---

## 3. Webhook Processing

### Stripe Webhook Status Prüfen

```bash
# Stripe CLI (lokal)
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Webhook Logs in Datenbank
psql $DATABASE_URL -c "
SELECT id, type, processed, processed_at, error_count, last_error
FROM stripe_events
WHERE processed = false
ORDER BY created_at DESC
LIMIT 20;
"
```

### Webhook Manuell Reprocessen

```bash
# Mit Script (Dry-Run)
node scripts/reprocess-stripe-events-safe.js \
  --dbUrl "$DATABASE_URL" \
  --webhookUrl "https://api.cargobit.eu/api/stripe/webhook" \
  --dry-run

# Echtes Reprocessing (max 5 Events)
node scripts/reprocess-stripe-events-safe.js \
  --dbUrl "$DATABASE_URL" \
  --webhookUrl "https://api.cargobit.eu/api/stripe/webhook" \
  --limit 5
```

### Einzelnes Event Reprocessen

```bash
# Event Payload holen
EVENT_ID="evt_xxx"
curl -s "https://api.stripe.com/v1/events/$EVENT_ID" \
  -u "$STRIPE_SECRET_KEY:" | jq .

# Event an Webhook senden
curl -X POST https://api.cargobit.eu/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: $(calc_signature)" \
  -d @event_payload.json
```

### Webhook Signatur Verifizieren

```javascript
// Node.js Beispiel
const crypto = require('crypto');

function verifyStripeSignature(payload, signature, secret) {
  const [t, v1] = signature.split(',').map(p => p.split('='));
  const timestamp = t[1];
  const expected = v1[1];
  
  const signedPayload = `${timestamp}.${payload}`;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return hmac === expected;
}
```

---

## 4. Idempotency & Replay

### Idempotency Check SQL

```sql
-- Wallet Transactions für Payment prüfen
SELECT COUNT(*) AS tx_count
FROM wallet_transactions
WHERE reference = 'payment_<payment_id>';

-- Stripe Events verarbeitet?
SELECT id, type, processed, processed_at
FROM stripe_events
WHERE id = '<event_id>';

-- Doppelte Payouts suchen
SELECT user_id, amount_cents, COUNT(*) as cnt
FROM payouts
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id, amount_cents
HAVING COUNT(*) > 1;
```

### Replay Szenario

```bash
# 1. Status vor Replay dokumentieren
psql $DATABASE_URL -c "
SELECT COUNT(*) FROM wallet_transactions WHERE reference = 'payment_xyz';
" > before_replay.txt

# 2. Event reprocessen
# ... (siehe Webhook Reprocessing)

# 3. Status nach Replay vergleichen
psql $DATABASE_URL -c "
SELECT COUNT(*) FROM wallet_transactions WHERE reference = 'payment_xyz';
" > after_replay.txt

diff before_replay.txt after_replay.txt
# Erwartung: Kein Unterschied (Idempotenz funktioniert)
```

---

## 5. Wallet & Reconciliation

### Reconciliation Cron Status

```bash
# Leader Lock prüfen
psql $DATABASE_URL -c "
SELECT * FROM leader_locks WHERE id = 'reconciliation_cron';
"

# Letzte Reconciliation
psql $DATABASE_URL -c "
SELECT * FROM audit_events
WHERE event_type = 'reconcile.applied'
ORDER BY created_at DESC
LIMIT 10;
"
```

### Manuelle Reconciliation

```bash
# API Endpoint
curl -X POST https://api.cargobit.eu/api/cron/reconcile \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json"

# Mit Leader-Lock (nur ein Prozess)
psql $DATABASE_URL -c "
SELECT acquire_leader_lock('reconciliation_cron', 'manual_run_$(date +%s)', 300);
"

# Reconciliation durchführen
# ... business logic ...

# Lock freigeben
psql $DATABASE_URL -c "
SELECT release_leader_lock('reconciliation_cron', 'manual_run_xxx');
"
```

### Wallet Korrektur bei Fehlern

```sql
-- 1. Problem identifizieren
SELECT * FROM wallet_transactions
WHERE user_id = '<user_id>'
ORDER BY created_at DESC
LIMIT 20;

-- 2. Korrektur-Transaktion erstellen
INSERT INTO wallet_transactions (
    wallet_id, user_id, amount_cents, type, reference, description
) VALUES (
    '<wallet_id>',
    '<user_id>',
    5000,  -- Betrag in Cents
    'credit',
    'correction_manual_<date>',
    'Manuelle Korrektur: Doppelbuchung rückgängig'
);

-- 3. Wallet-Saldo aktualisieren
UPDATE wallets
SET balance = balance + 50.00
WHERE id = '<wallet_id>';

-- 4. Audit Event
INSERT INTO audit_events (event_type, payload)
VALUES (
    'wallet.correction',
    '{"user_id": "<user_id>", "amount": 5000, "reason": "manual correction", "by": "admin@example.com"}'::jsonb
);
```

---

## 6. Database Operations

### Migration Ausführen

```bash
# Neue Migration anwenden
psql $DATABASE_URL -f migrations/20260421_create_payouts_and_events.sql

# Prüfen
psql $DATABASE_URL -c "\dt payouts"
psql $DATABASE_URL -c "\dt payout_events"
psql $DATABASE_URL -c "\dt payout_attempts"
psql $DATABASE_URL -c "\dt wallet_transactions"
psql $DATABASE_URL -c "\dt audit_events"
```

### Backup Vor Wartung

```bash
# PostgreSQL Backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Komprimiert
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Langsame Queries Analysieren

```sql
-- Aktive Queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Langsame Queries loggen
ALTER DATABASE cargobit SET log_min_duration_statement = 1000;

-- Index Usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename IN ('payouts', 'payments', 'wallet_transactions');
```

---

## 7. Monitoring & Alerts

### Prometheus Alerts

```bash
# Alerts anzeigen
curl -s http://prometheus:9090/api/v1/alerts | jq .

# Alert Rules prüfen
curl -s http://prometheus:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.type=="alerting")'
```

### Wichtige Metriken

```
# Payout Queue Tiefe
bullmq_queue_waiting{queue="payouts"}

# Payout Worker Durchsatz
rate(payouts_processed_total[5m])

# Webhook Error Rate
rate(stripe_webhook_errors_total[5m])

# Wallet Transaction Latency
histogram_quantile(0.95, wallet_transaction_duration_seconds)
```

### Test Alert Auslösen

```bash
# Alertmanager Test
amtool alert add test_alert \
  severity=warning \
  summary="Test alert from runbook"

# Prometheus Metric injizieren (für Tests)
curl -X POST http://localhost:9091/metrics/job/test \
  -d 'test_alert{severity="warning"} 1'
```

### Grafana Dashboard Import

```bash
# Via API
curl -X POST http://grafana:3000/api/dashboards/import \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @monitoring/grafana_dashboard_minimal.json
```

---

## 8. Incident Response

### Incident Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    INCIDENT RESPONSE FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│  1. DETECT  → Alert fired / User report / Monitoring check      │
│  2. ASSESS  → Severity: P1 (Critical) / P2 (High) / P3 (Medium) │
│  3. CONTAIN → Stop bleeding, isolate if needed                  │
│  4. RESOLVE → Fix root cause, restore service                   │
│  5. REVIEW  → Postmortem, action items, prevention              │
└─────────────────────────────────────────────────────────────────┘
```

### Severity Levels

| Level | Kriterien | Response Time | Beispiel |
|-------|-----------|---------------|----------|
| P1 | Zahlungsprozess komplett ausgefallen | < 15 Min | API 5xx, DB down |
| P2 | Eingeschränkte Funktion, Workaround vorhanden | < 1 Stunde | Worker down, Queue backlog |
| P3 | Minor Issue, keine Kundenbeeinträchtigung | < 4 Stunden | Monitoring glitch |

### Sofortmaßnahmen bei P1

```bash
# 1. Service Status prüfen
systemctl status cargobit-api
systemctl status cargobit-payout-worker

# 2. Logs analysieren
journalctl -u cargobit-api -n 100 --no-pager

# 3. Recent Deployments prüfen
kubectl rollout history deployment/cargobit-api -n cargobit

# 4. Rollback falls nötig
kubectl rollout undo deployment/cargobit-api -n cargobit

# 5. Stakeholder informieren
# Slack: #incident-response
```

### Webhook Processing Incident

```bash
# 1. Stripe Events mit Fehlern finden
psql $DATABASE_URL -c "
SELECT id, type, error_count, last_error
FROM stripe_events
WHERE processed = false AND error_count > 0
ORDER BY created_at DESC
LIMIT 50;
"

# 2. Bei DB Problemen: DB reparieren
# ... DB spezifische Recovery Schritte ...

# 3. Bei App Problemen: Service restart oder rollback
sudo systemctl restart cargobit-api

# 4. Events reprocesen (siehe Abschnitt 3)
```

---

## 9. Wartungsfenster

### Wartung Ankündigen

1. **7 Tage vorher**: Email an alle betroffenen User
2. **1 Tag vorher**: Banner in App einblenden
3. **1 Stunde vorher**: Letzte Erinnerung

### Wartung Durchführen

```bash
# 1. Maintenance Mode aktivieren
curl -X POST https://api.cargobit.eu/api/admin/system/settings \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{"maintenance_mode": true}'

# 2. Worker stoppen (keine neuen Payouts)
sudo systemctl stop cargobit-payout-worker

# 3. Queue leeren oder warten
redis-cli -h $REDIS_HOST LLEN bull:payouts:wait
# Optional: Jobs verschieben
redis-cli RENAME bull:payouts:wait bull:payouts:wait_backup

# 4. Wartungsarbeiten durchführen
# ... Migrationen, Updates, etc. ...

# 5. Smoke Tests
./ci/newman-run.sh

# 6. Maintenance Mode deaktivieren
curl -X POST https://api.cargobit.eu/api/admin/system/settings \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{"maintenance_mode": false}'

# 7. Worker starten
sudo systemctl start cargobit-payout-worker
```

---

## 10. Kontakte & Eskalation

### On-Call Rotation

| Rolle | Primär | Backup |
|-------|--------|--------|
| L1 Support | support@cargobit.eu | +49 xxx xxx xxx |
| L2 Engineer | engineering@cargobit.eu | Slack: @oncall-engineering |
| L3 Architect | architect@cargobit.eu | Slack: @platform-architects |

### Externe Kontakte

| Service | Kontakt |用途 |
|---------|---------|------|
| Stripe Support | https://support.stripe.com | Payment Issues |
| AWS Support | https://console.aws.amazon.com/support | Infrastructure |
| Redis Cloud | https://app.redislabs.com | Redis Issues |

### Eskalationsmatrix

```
Zeit →  0-15min   15-30min   30-60min   > 60min
─────────────────────────────────────────────────
P1      L1        L2         L3         Management
P2      L1        L2         L2         L3
P3      L2        L2         L3         L3
```

---

## Checklisten

### Pre-Deployment Checklist

- [ ] Migration auf Staging getestet
- [ ] E2E Tests grün
- [ ] Backups erstellt
- [ ] Rollback-Plan dokumentiert
- [ ] On-Call informiert

### Post-Incident Checklist

- [ ] Service wiederhergestellt
- [ ] User kommuniziert (falls betroffen)
- [ ] Timeline dokumentiert
- [ ] Root Cause identifiziert
- [ ] Action Items erstellt
- [ ] Postmortem terminiert

---

**Version:** 1.0  
**Letzte Aktualisierung:** 2026-04-22  
**Verantwortlich:** Platform Team

---

## Anhänge

### A. Environment Variablen

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| `DATABASE_URL` | PostgreSQL Connection | `postgres://user:pass@host:5432/db` |
| `REDIS_HOST` | Redis Server Host | `redis.local` |
| `REDIS_PORT` | Redis Server Port | `6379` |
| `STRIPE_SECRET_KEY` | Stripe API Key | `sk_live_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Webhook Signatur Key | `whsec_xxx` |

### B. Wichtige Dateipfade

```
/opt/cargobit/                    # Application Directory
/opt/cargobit/dist/src/main.worker.js  # Worker Entry Point
/opt/cargobit/logs/               # Log Directory
/etc/systemd/system/cargobit-payout-worker.service  # Systemd Unit
```

### C. API Endpoints

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/health` | GET | Health Check |
| `/api/stripe/webhook` | POST | Stripe Webhooks |
| `/api/admin/payouts` | GET/POST | Payout Management |
| `/api/admin/payments` | GET | Payment Management |
| `/api/cron/reconcile` | POST | Reconciliation Trigger |
