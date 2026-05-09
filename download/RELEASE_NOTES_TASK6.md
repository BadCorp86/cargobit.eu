# CargoBit Payment System - Release Notes
## Task 6: Webhook Notifications für Reconciliation-Events

**Version:** v2.6.0  
**Release Date:** 2026-04-24  
**Status:** ✅ Implementation Complete

---

## 📋 Übersicht

Task 6 implementiert ein vollständiges Webhook-Notification-System für Reconciliation-Events. Externe Systeme können sich registrieren, um Echtzeit-Benachrichtigungen über Payout- und Reconciliation-Ereignisse zu erhalten.

---

## 🚀 Neue Features

### 1. Webhook-Konfiguration
- **CRUD-Operationen** für Webhook-Endpoints
- **Event-spezifische Subscriptions** (10 Event-Typen verfügbar)
- **Authentifizierungsoptionen:**
  - Keine (none)
  - HMAC-SHA256 Signature
  - Bearer Token
  - Basic Auth
- **Custom Headers** Unterstützung
- **Konfigurierbare Retry-Logic** mit exponentiellem Backoff

### 2. Event-Typen

| Event | Beschreibung |
|-------|--------------|
| `payout.open` | Neuer offener Payout erkannt |
| `payout.reconciled` | Payout erfolgreich abgestimmt |
| `payout.failed` | Payout fehlgeschlagen |
| `payout.disputed` | Payout-Dispute eröffnet |
| `reconciliation.run_started` | Reconciliation-Lauf gestartet |
| `reconciliation.run_completed` | Reconciliation-Lauf abgeschlossen |
| `reconciliation.run_failed` | Reconciliation-Lauf fehlgeschlagen |
| `export.completed` | Report-Export erfolgreich |
| `export.failed` | Report-Export fehlgeschlagen |
| `report.generated` | Report generiert |

### 3. Webhook-Worker
- **Hintergrundverarbeitung** mit konfigurierbarer Parallelität
- **Automatische Retries** mit exponentiellem Backoff
- **Dead Letter Queue** für fehlgeschlagene Deliveries
- **Auto-Disable** nach 10 aufeinanderfolgenden Fehlern

### 4. API Endpoints

| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| GET | `/api/webhooks` | Webhooks auflisten |
| POST | `/api/webhooks` | Webhook erstellen |
| GET | `/api/webhooks/:id` | Webhook abrufen |
| PUT | `/api/webhooks/:id` | Webhook aktualisieren |
| DELETE | `/api/webhooks/:id` | Webhook löschen |
| POST | `/api/webhooks/:id/test` | Webhook testen |
| GET | `/api/webhooks/deliveries` | Deliveries auflisten |
| GET | `/api/webhooks/deliveries/:id` | Delivery abrufen |
| POST | `/api/webhooks/deliveries/:id/replay` | Delivery wiederholen |
| GET | `/api/webhooks/statistics` | Statistiken abrufen |
| GET | `/api/webhooks/event-types` | Event-Typen auflisten |

### 5. Prometheus Metrics

```
webhooks_total{status="active|paused|disabled|failed"}
webhook_events_dispatched_total{event_type="..."}
webhook_deliveries_created_total{webhook_id="...",event_type="..."}
webhook_delivery_attempts_total{webhook_id="...",event_type="...",status="..."}
webhook_delivery_duration_seconds{webhook_id="...",event_type="...",status_code="..."}
webhook_delivery_status_total{webhook_id="...",event_type="...",status="..."}
webhook_deliveries_in_progress
webhook_pending_deliveries{webhook_id="..."}
webhook_dead_letter_queue_size
webhook_retry_queue_size
```

---

## 📁 Neue Dateien

```
src/webhooks/
├── entities/
│   └── webhook-configuration.entity.ts   # Entity-Definitionen
├── dto/
│   └── webhook.dto.ts                    # DTOs für API
├── services/
│   └── webhooks.service.ts               # Kern-Service
├── workers/
│   └── webhook.worker.ts                 # Delivery-Worker
├── metrics/
│   └── webhook.metrics.ts                # Prometheus Metrics
├── controllers/
│   └── webhooks.controller.ts            # API Controller
├── __tests__/
│   └── webhooks.service.spec.ts          # Unit Tests
└── webhooks.module.ts                    # Modul-Exporte

src/app/api/webhooks/
├── route.ts                              # GET/POST /api/webhooks
├── [id]/
│   ├── route.ts                          # GET/PUT/DELETE /api/webhooks/:id
│   └── test/
│       └── route.ts                      # POST /api/webhooks/:id/test
├── deliveries/
│   ├── route.ts                          # GET /api/webhooks/deliveries
│   └── [id]/
│       ├── route.ts                      # GET /api/webhooks/deliveries/:id
│       └── replay/
│           └── route.ts                  # POST /api/webhooks/deliveries/:id/replay
├── statistics/
│   └── route.ts                          # GET /api/webhooks/statistics
└── event-types/
    └── route.ts                          # GET /api/webhooks/event-types

migrations/
└── 20260424_create_webhook_tables.sql    # DB Migration

helm/payments-service/templates/
└── webhook-worker-deployment.yaml        # Kubernetes Deployment
```

---

## 🗄️ Datenbank-Schema

### webhook_configurations
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | VARCHAR(64) | Primärschlüssel |
| name | VARCHAR(255) | Anzeigename |
| url | TEXT | Ziel-URL |
| events | webhook_event_type[] | Abonnierte Events |
| status | webhook_status | active/paused/disabled/failed |
| auth_type | auth_type | Authentifizierungstyp |
| retry_config | JSONB | Retry-Konfiguration |
| consecutive_failures | INTEGER | Aufeinanderfolgende Fehler |

### webhook_deliveries
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | VARCHAR(64) | Primärschlüssel |
| webhook_id | VARCHAR(64) | FK zu webhook_configurations |
| event_type | webhook_event_type | Event-Typ |
| status | delivery_status | pending/processing/delivered/failed/retrying/dead_letter |
| payload | JSONB | Gesendeter Payload |
| attempts | INTEGER | Anzahl Versuche |

---

## 🔧 Konfiguration

### Umgebungsvariablen

```bash
# Webhook Signing Secret (für HMAC)
WEBHOOK_SIGNING_SECRET=your-signing-secret

# Worker-Konfiguration
WEBHOOK_WORKER_ENABLED=true
WEBHOOK_WORKER_CONCURRENCY=10
WEBHOOK_WORKER_BATCH_SIZE=50
WEBHOOK_WORKER_POLL_INTERVAL=1000
```

### Helm Values

```yaml
webhooks:
  enabled: true
  signingSecret: "your-signing-secret"
  worker:
    replicas: 2
    resources:
      requests:
        cpu: 100m
        memory: 256Mi
      limits:
        cpu: 500m
        memory: 512Mi
    hpa:
      enabled: true
      minReplicas: 1
      maxReplicas: 10
    pdb:
      enabled: true
      minAvailable: 1
```

---

## 📊 Deployment

### Migration anwenden

```bash
psql "$DATABASE_URL" -f migrations/20260424_create_webhook_tables.sql
```

### Helm Deploy

```bash
helm upgrade --install payments ./helm/payments-service \
  -n staging \
  --set webhooks.enabled=true \
  --set webhooks.worker.replicas=2 \
  --wait --timeout 5m
```

---

## 🔒 Sicherheit

- **HMAC-SHA256 Signaturen** für Payload-Integrität
- **Secrets** werden nicht in API-Responses zurückgegeben
- **Auto-Disable** schützt vor Endlosschleifen bei fehlerhaften Endpoints
- **Timeout-Konfiguration** verhindert hängende Verbindungen
- **Rate Limiting** pro Webhook-Endpoint

---

## 📈 Monitoring

### Grafana Dashboard Panels
1. Webhooks by Status (Gauge)
2. Events Dispatched Rate (Time Series)
3. Delivery Success Rate (Percentage)
4. Delivery Duration P95 (Histogram)
5. Pending Deliveries by Webhook (Bar Chart)
6. Dead Letter Queue Size (Gauge)

### Alert Rules
- `WebhookDeliveryFailures`: >5 fehlgeschlagene Deliveries in 5 Minuten
- `WebhookQueueBacklog`: >100 pendende Deliveries
- `WebhookDisabled`: Webhook automatisch deaktiviert

---

## ✅ Tests

```bash
# Unit Tests ausführen
npm test -- src/webhooks/__tests__/webhooks.service.spec.ts

# E2E Test mit Newman
newman run postman/postman_webhooks.json -e postman/postman_env_staging.json
```

---

## 🔄 Upgrade-Hinweise

1. Migration vor Deployment ausführen
2. Signing Secret in Secrets Manager konfigurieren
3. Worker schrittweise hochskalieren (Start: 1 Replica)
4. Monitoring der Dead Letter Queue
5. Webhooks bei Partnern registrieren

---

## 👥 Verantwortlichkeiten

| Rolle | Verantwortlich |
|-------|----------------|
| Backend Lead | Implementierung, Code Review |
| DevOps | Deployment, Monitoring |
| Security | Secrets, Authentifizierung |
| QA | E2E Tests, Integration Tests |

---

**Dokument Version:** 1.0  
**Autor:** CargoBit Development Team  
**Review Date:** 2026-04-24
