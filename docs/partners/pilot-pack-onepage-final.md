# Pilot Pack — Embedded Reconciliation Export

## Ziel

Schnelle Integration eines Embedded Export-Workflows in Partner-UI (CSV/JSON), inkl. Webhook-Benachrichtigung und signierten Download-Links.

---

## Was wir liefern

- Sandbox-API + Partner-JWT
- SDK Snippets (JS) für Export-Call
- Webhook-Spec für `report_exported`
- 1:1 Engineering Support (Kickoff + 2 Tech-Sessions)
- Pilot Success Metrics & Reporting

---

## Scope (Pilot)

- OAuth2 / JWT Auth
- Embedded Export Button (1 UI-Flow)
- Webhook Callback für fertige Exporte
- 5–10 Pilotkunden, Laufzeit 4–6 Wochen

---

## Timeline (6 Wochen)

| Woche | Phase | Meilensteine |
|-------|-------|--------------|
| 0 | Vorbereitung | NDA, Kickoff, Sandbox-Keys |
| 1–2 | Integration | PoC Integration (Auth, Export API) |
| 3–4 | Pilotbetrieb | Monitoring, Support |
| 5–6 | Abschluss | Review, KPIs, Scale-Plan |

---

## Tech Summary

### Export API

```http
POST /admin/reconciliation/report/export
Content-Type: application/json

{
  "format": "csv",
  "filter": { "status": "paid" },
  "callback_url": "https://partner.example.com/webhooks",
  "metadata": { "customerId": "abc-123" }
}
```

**Response:**
```json
{ "jobId": "uuid-1234", "status": "queued" }
```

### Webhook

```http
POST /webhooks/report_exported
Content-Type: application/json

{
  "event": "report_exported",
  "data": {
    "jobId": "uuid-1234",
    "status": "done",
    "result_url": "https://signed-url...",
    "metadata": { "customerId": "abc-123" }
  }
}
```

### Security

- Signed URLs (TTL configurable, default 24h)
- IAM least privilege for S3
- Default PII masking; explicit opt-in logged

---

## KPIs

| Metrik | Target |
|--------|--------|
| Time to first export | < 48h |
| Export success rate | ≥ 99% |
| Avg exports / pilot customer / week | ≥ 5 |

---

## Contacts

| Rolle | Kontakt |
|-------|---------|
| Pilot Owner | [Name, email] |
| Engineering Lead | [Name, email] |
| Support | support@example.com |

---

> **PDF Export:** `pandoc pilot-pack-onepage-final.md -o pilot-pack.pdf --pdf-engine=xelatex`
