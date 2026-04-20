# CargoBit Payment Platform - Testing Playbook

## Übersicht

Dieses Playbook enthält alle Artefakte für das automatisierte Testing und Monitoring der CargoBit Payment & Refund Plattform.

## Verzeichnisstruktur

```
cargobit-payment-playbook/
├── README.md                              # Diese Datei
├── postman_collection_payments_e2e.json   # Postman Collection (9 E2E Tests)
├── postman_env_staging.json               # Environment Template
├── ci/
│   └── run-e2e-tests.sh                   # Newman CI Script
├── monitoring/
│   ├── prometheus_alerts.yaml             # Prometheus Alert Rules
│   └── grafana_dashboard.json             # Grafana Dashboard Template
├── sql/
│   └── verification_queries.sql           # SQL Verification Snippets
├── scripts/
│   └── reprocess_stripe_events.js         # Reprocessing Script
└── docs/
    ├── webhook_incident_runbook.md        # Incident Runbook
    └── acceptance_report_template.md      # Acceptance Report Template
```

## Schnellstart

### 1. Newman E2E Tests ausführen

```bash
# Newman installieren
npm install -g newman newman-reporter-htmlextra

# Environment konfigurieren
cp postman_env_staging.json postman_env_local.json
# Bearbeite postman_env_local.json mit deinen Werten

# Tests ausführen
./ci/run-e2e-tests.sh run

# Oder mit Newman direkt
newman run postman_collection_payments_e2e.json \
  -e postman_env_local.json \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export reports/newman-report.html
```

### 2. Prometheus Alerts importieren

```bash
# In Prometheus Konfiguration einfügen
cp monitoring/prometheus_alerts.yaml /etc/prometheus/rules/
systemctl reload prometheus
```

### 3. Grafana Dashboard importieren

1. Grafana öffnen → Dashboards → Import
2. `monitoring/grafana_dashboard.json` hochladen
3. Prometheus Data Source auswählen
4. Import klicken

### 4. SQL Verification Queries

```bash
# Mit Datenbank verbinden
psql -U admin -d cargobit_payments

# Queries ausführen
\i sql/verification_queries.sql

# Oder einzelne Query
SELECT * FROM payments WHERE status = 'processing';
```

### 5. Reprocess Script

```bash
# Dependencies installieren
npm install pg ioredis stripe commander chalk ora cli-table3

# Dry-Run (erst testen!)
node scripts/reprocess_stripe_events.js --event-id evt_xxx --dry-run

# Echtes Reprocessing
node scripts/reprocess_stripe_events.js --event-id evt_xxx

# Alle unverarbeiteten Events
node scripts/reprocess_stripe_events.js --unprocessed-only --since "1 hour ago"
```

## Test Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    E2E Payment & Refund Flow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. POST /jobs                    → Job erstellen                   │
│          │                                                          │
│          ▼                                                          │
│  2. POST /booking/confirm         → PaymentIntent erzeugen          │
│          │                                                          │
│          ▼                                                          │
│  3. POST /webhooks/stripe         → payment_intent.succeeded        │
│          │                                                          │
│          ▼                                                          │
│  4. GET /admin/payments           → Payment verifizieren            │
│          │                                                          │
│          ▼                                                          │
│  5. POST /admin/jobs/:id/refund   → Partial Refund auslösen         │
│          │                                                          │
│          ▼                                                          │
│  6. POST /webhooks/stripe         → charge.refunded                 │
│          │                                                          │
│          ▼                                                          │
│  7. GET /admin/payments/:id       → refunded_cents prüfen           │
│          │                                                          │
│          ▼                                                          │
│  8. POST /admin/payments/:id/reconcile → Manuelle Reconciliation    │
│          │                                                          │
│          ▼                                                          │
│  9. POST /webhooks/stripe         → Idempotency Test (Replay)       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Environment Variablen

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| `base_url` | API Base URL | `https://staging.cargobit.example.com` |
| `admin_jwt` | Admin JWT Token | `Bearer eyJ...` |
| `stripe_test_secret` | Stripe Webhook Secret | `whsec_...` |
| `DATABASE_URL` | PostgreSQL Connection | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis Connection | `redis://localhost:6379` |
| `STRIPE_SECRET_KEY` | Stripe API Key | `sk_test_...` |

## Monitoring Alerts

### Kritische Alerts

| Alert | Severity | Description |
|-------|----------|-------------|
| `StripeWebhookHighErrorRate` | critical | > 5% Webhook 5xx errors |
| `PaymentProcessingFailures` | critical | Payment processing errors |
| `PaymentServiceHighMemory` | critical | Memory > 90% limit |
| `StripeWebhookSignatureValidationErrors` | critical | Invalid signatures |

### Warnungen

| Alert | Severity | Description |
|-------|----------|-------------|
| `StripeWebhookSlowProcessing` | warning | P95 latency > 5s |
| `OrphanedPaymentIntentsHigh` | warning | Orphaned payment intents |
| `ReconciliationDiscrepanciesDetected` | warning | DB vs Stripe mismatches |
| `PaymentsStuckInProcessing` | warning | Payments stuck > 5min |

## Akzeptanzkriterien

### E2E Tests
- [ ] Alle 9 Newman Requests mit Status 200/201
- [ ] Alle Assertions bestanden
- [ ] Response Time < 2s pro Request

### Idempotency
- [ ] Wallet tx count before == after replay
- [ ] Event als "already processed" markiert
- [ ] Keine doppelten Einträge in DB

### Reconciliation
- [ ] Cron läuft nur auf Leader Node
- [ ] Keine Diskrepanzen nach Reconciliation
- [ ] Audit Events korrekt erstellt

### Monitoring
- [ ] Alerts in Prometheus konfiguriert
- [ ] Grafana Dashboard importiert
- [ ] Sentry Error Alerts eingerichtet

## Troubleshooting

### Newman Tests fehlschlagen

1. **401 Unauthorized**: `admin_jwt` prüfen und erneuern
2. **400 Invalid Signature**: `stripe_test_secret` prüfen
3. **500 Internal Error**: Logs prüfen, Service neu starten
4. **Connection Refused**: `base_url` und Netzwerk prüfen

### Webhook nicht verarbeitet

```sql
-- Status prüfen
SELECT * FROM stripe_events WHERE id = 'evt_xxx';

-- Falls nicht verarbeitet
node scripts/reprocess_stripe_events.js --event-id evt_xxx
```

### Doppelte Wallet Transaktionen

```sql
-- Identifizieren
SELECT reference, COUNT(*) FROM wallet_transactions 
GROUP BY reference HAVING COUNT(*) > 1;

-- Siehe Runbook für Korrektur
```

## Support

- **Runbook**: `docs/webhook_incident_runbook.md`
- **Slack Channel**: #incidents
- **On-Call**: @oncall-payments
- **Stripe Support**: support@stripe.com

---

*Version: 1.0 | Last Updated: 2024-01-15*
