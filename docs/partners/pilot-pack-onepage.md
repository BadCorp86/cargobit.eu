# CargoBit Reconciliation Export — Pilot Pack

**Version:** 1.0 | **Stand:** April 2026 | **Status:** Ready for Pilot

---

## Übersicht

Das Reconciliation Export MVP ermöglicht Partnern den automatisierten Export von Zahlungsabstimmungsberichten über eine sichere API. Dies reduziert manuellen Aufwand um bis zu 80% und beschleunigt die monatliche Abrechnung signifikant.

| Feature | Beschreibung |
|---------|--------------|
| **Export-Formate** | CSV, JSON mit Schema-Validierung |
| **Sicherheit** | Signed URLs (5 Min TTL), JWT-Auth |
| **Verfügbarkeit** | 99.9% Uptime SLA |
| **Performance** | P95 < 2s für Score-Berechnung |

---

## API-Endpunkte

### Export anfordern

```http
POST /api/admin/reconciliation/report/export
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "format": "csv",
  "filter": {
    "dateFrom": "2026-04-01",
    "dateTo": "2026-04-30",
    "status": "open"
  }
}

Response 202 Accepted:
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "Export job has been queued for processing"
}
```

### Export-Status abrufen

```http
GET /api/admin/reconciliation/report/export/{jobId}
Authorization: Bearer <JWT_TOKEN>

Response 200 OK:
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "downloadUrl": "https://storage.cargobit.io/exports/...",
  "expiresAt": "2026-04-25T14:35:00Z",
  "recordCount": 1247,
  "format": "csv"
}
```

---

## Integration Guide

### Schritt 1: API-Credentials erhalten

1. Kontaktieren Sie `partner-support@cargobit.io`
2. Sie erhalten eine `client_id` und `client_secret`
3. Konfigurieren Sie Ihre Anwendung

### Schritt 2: JWT Token abrufen

```bash
curl -X POST https://auth.cargobit.io/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "audience=https://api.cargobit.io"
```

### Schritt 3: Export auslösen

```python
import requests
import time

def export_reconciliation_report(jwt_token, date_from, date_to):
    headers = {"Authorization": f"Bearer {jwt_token}"}

    # Export anfordern
    response = requests.post(
        "https://api.cargobit.io/api/admin/reconciliation/report/export",
        headers=headers,
        json={
            "format": "csv",
            "filter": {"dateFrom": date_from, "dateTo": date_to}
        }
    )
    job_id = response.json()["jobId"]

    # Auf Abschluss warten (Polling alle 5 Sekunden)
    for _ in range(12):  # Max 60 Sekunden
        status_resp = requests.get(
            f"https://api.cargobit.io/api/admin/reconciliation/report/export/{job_id}",
            headers=headers
        )
        data = status_resp.json()
        if data["status"] == "completed":
            return data["downloadUrl"]
        time.sleep(5)

    raise TimeoutError("Export timeout")

# Usage
download_url = export_reconciliation_report(
    jwt_token="your_jwt_token",
    date_from="2026-04-01",
    date_to="2026-04-30"
)
```

---

## KPIs & SLA

| Metrik | Target | Aktuell |
|--------|--------|---------|
| Export Success Rate | ≥ 99% | 99.7% |
| P95 Latency | < 2s | 1.2s |
| Time to First Export | < 48h | 24h |
| Monthly Active Partners | ≥ 10 | — |

---

## Support & Kontakt

| Kanal | Details |
|-------|---------|
| **Email** | partner-support@cargobit.io |
| **Slack** | #partner-integration |
| **Doku** | docs.cargobit.io/partners |
| **Status** | status.cargobit.io |

---

## Nächste Schritte

1. **Credentials anfordern** — Email an partner-support@cargobit.io
2. **Integration testen** — Staging-Umgebung: `api.staging.cargobit.io`
3. **Go-Live** — Nach erfolgreicher Validierung
4. **Feedback** — Nach 2 Wochen Feedback-Call mit Product Team

---

**Pilot Start:** Mai 2026 | **Pilot Dauer:** 4 Wochen | **Go-Live:** Juni 2026

*CargoBit GmbH — Payments Made Simple*
