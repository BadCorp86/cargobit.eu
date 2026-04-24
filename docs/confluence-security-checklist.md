# CargoBit Security Checklist für Reconciliation Exports

**Für Confluence Import** | Version 1.0 | April 2026

---

## Übersicht

Diese Security-Checklist muss für alle Partner-Integrationen mit Reconciliation Export abgeschlossen werden. Die Checklist stellt sicher, dass alle Sicherheitsanforderungen erfüllt sind, bevor externe Partner Zugriff auf Export-Endpunkte erhalten.

---

## 1. Authentication & Authorization

| # | Kontrolle | Verantwortlich | Status | Nachweis |
|---|-----------|----------------|--------|----------|
| 1.1 | JWT-Token-Validierung implementiert | Security Team | ☐ | Code Review |
| 1.2 | Token-Expiration auf 1h begrenzt | Security Team | ☐ | Config Check |
| 1.3 | RBAC-Rollen für Export definiert | Security Team | ☐ | Role Matrix |
| 1.4 | Partner-spezifische Scopes vergeben | Partner Manager | ☐ | Scope Doc |
| 1.5 | Service-Account-Separation | DevOps | ☐ | K8s Manifest |

### Details

**JWT-Token-Validierung:**
- Alle Export-Endpunkte validieren JWT vor Verarbeitung
- Token muss `export:read` Scope enthalten
- Token muss `partner_id` Claim enthalten

**RBAC-Rollen:**
```
Partner_Viewer:    export:read (eigene Daten)
Partner_Admin:     export:read, export:config
Internal_Auditor:  export:read, export:audit
```

---

## 2. Data Protection

| # | Kontrolle | Verantwortlich | Status | Nachweis |
|---|-----------|----------------|--------|----------|
| 2.1 | Signed URLs mit 5 Min TTL | Backend | ☐ | URL Pattern |
| 2.2 | Keine PII in Export-Logs | Backend | ☐ | Log Audit |
| 2.3 | Verschlüsselung at-rest (AES-256) | DevOps | ☐ | Storage Config |
| 2.4 | Verschlüsselung in-transit (TLS 1.3) | DevOps | ☐ | TLS Config |
| 2.5 | Datenbank-Feldverschlüsselung | Backend | ☐ | Schema Audit |

### Details

**Signed URLs:**
```
Format: https://storage.cargobit.io/exports/{jobId}?sig={signature}&exp={timestamp}
TTL: 300 Sekunden (5 Minuten)
Algorithm: HMAC-SHA256
```

**PII-Masking in Logs:**
- Keine IBAN, BIC, oder Namen in Logs
- IDs werden geloggt (payout_id, partner_id)
- Request-Body wird NICHT geloggt

---

## 3. Rate Limiting & Throttling

| # | Kontrolle | Verantwortlich | Status | Nachweis |
|---|-----------|----------------|--------|----------|
| 3.1 | Rate Limit pro Partner: 100 req/h | API Gateway | ☐ | Gateway Config |
| 3.2 | Burst Limit: 20 req/min | API Gateway | ☐ | Gateway Config |
| 3.3 | Concurrent Export Limit: 3 | Backend | ☐ | Semaphore Config |
| 3.4 | Graceful Degradation bei Overload | Backend | ☐ | Code Review |

### Details

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1714060800
```

**429 Response:**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Retry after 3600 seconds.",
  "retryAfter": 3600
}
```

---

## 4. Audit & Logging

| # | Kontrolle | Verantwortlich | Status | Nachweis |
|---|-----------|----------------|--------|----------|
| 4.1 | Alle Export-Requests geloggt | Backend | ☐ | Log Sample |
| 4.2 | Audit-Trail mit User/Partner/Zeitstempel | Backend | ☐ | Audit Table |
| 4.3 | Export-Inhalte hash-gespeichert | Backend | ☐ | Hash Column |
| 4.4 | Log-Retention: 90 Tage | DevOps | ☐ | Retention Policy |
| 4.5 | SIEM-Integration aktiv | Security | ☐ | SIEM Dashboard |

### Details

**Audit Event Schema:**
```json
{
  "event_type": "export.completed",
  "partner_id": "partner_123",
  "user_id": "user_456",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "record_count": 1247,
  "format": "csv",
  "timestamp": "2026-04-25T14:30:00Z",
  "ip_address": "192.168.1.100",
  "content_hash": "sha256:abc123..."
}
```

---

## 5. Infrastructure Security

| # | Kontrolle | Verantwortlich | Status | Nachweis |
|---|-----------|----------------|--------|----------|
| 5.1 | mTLS zwischen Services | DevOps | ☐ | Mesh Config |
| 5.2 | Network Policies in K8s | DevOps | ☐ | NetworkPolicy YAML |
| 5.3 | Secrets in sealed-secrets | DevOps | ☐ | SealedSecret |
| 5.4 | Container Security Context | DevOps | ☐ | SecurityContext |
| 5.5 | Pod Security Standards: Restricted | DevOps | ☐ | PSS Labels |

### Details

**Network Policy:**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: export-api-policy
spec:
  podSelector:
    matchLabels:
      app: payments-api
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: api-gateway
      ports:
        - port: 3000
```

---

## 6. Compliance

| # | Kontrolle | Verantwortlich | Status | Nachweis |
|---|-----------|----------------|--------|----------|
| 6.1 | DPA (Data Processing Agreement) unterzeichnet | Legal | ☐ | Vertrag |
| 6.2 | GDPR Art. 28 erfüllt | Legal | ☐ | Dokumentation |
| 6.3 | Auftragsverarbeitungsvertrag | Legal | ☐ | Vertrag |
| 6.4 | Datenlöschanfragen-Prozess definiert | DPO | ☐ | Process Doc |
| 6.5 | Export-Beschränkungen geprüft | Legal | ☐ | Country List |

---

## 7. Incident Response

| # | Kontrolle | Verantwortlich | Status | Nachweis |
|---|-----------|----------------|--------|----------|
| 7.1 | Incident-Playbook für Export-Failures | SRE | ☐ | Playbook |
| 7.2 | Rollback-Plan dokumentiert | SRE | ☐ | Runbook |
| 7.3 | On-Call für Partner-Support | Ops | ☐ | PagerDuty |
| 7.4 | Escalation-Pfad definiert | Management | ☐ | Escalation Doc |

### Incident Contacts

| Rolle | Kontakt | Verfügbarkeit |
|-------|---------|---------------|
| On-Call SRE | pagerduty.com/cargobit | 24/7 |
| Security Team | security@cargobit.io | Business Hours |
| Partner Support | partner-support@cargobit.io | Business Hours |

---

## 8. Pre-Launch Verification

| # | Kontrolle | Verantwortlich | Status | Nachweis |
|---|-----------|----------------|--------|----------|
| 8.1 | Penetration Test bestanden | Security | ☐ | Pentest Report |
| 8.2 | Security Scan ohne Critical/High | Security | ☐ | Scan Report |
| 8.3 | Load Test bestanden (1000 req/min) | SRE | ☐ | Load Test Report |
| 8.4 | UAT durch Partner erfolgreich | Partner Manager | ☐ | UAT Sign-off |
| 8.5 | Documentation vollständig | Tech Writer | ☐ | Doc Review |

---

## Sign-off

| Rolle | Name | Datum | Unterschrift |
|-------|------|-------|--------------|
| Security Lead | | | |
| Tech Lead | | | |
| Partner Manager | | | |
| DPO | | | |

---

**Checklist erstellt:** April 2026
**Nächste Überprüfung:** Juli 2026
**Verantwortlich:** Security Team

---

## Confluence Import Hinweise

### Markup für Confluence

```confluence
{info:title=Quick Reference}
Diese Checklist ist vor jedem Partner-Go-Live abzuschließen.
{info}

{panel:title=Wichtig|borderStyle=solid|borderColor=#ccc|titleBGColor=#F7D6C1|bgColor=#FFFFCE}
Alle Checkboxen müssen aktiviert sein, bevor ein Partner produktiv geschaltet wird.
{panel}
```

### Macro-Empfehlungen

- **Status-Macros** für jede Sektion
- **Expand-Macros** für Details
- **Task-Report-Macro** für offene Items
- **Attachments** für Nachweise

### Labels

- `security-checklist`
- `partner-onboarding`
- `compliance`
- `export-api`
