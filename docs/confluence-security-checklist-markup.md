# Security Checklist — Reconciliation Exports

**Confluence Markup — Ready to paste**

---

## Anleitung

1. Neue Confluence-Seite erstellen
2. In den Edit-Modus wechseln
3. Unteren Inhalt kopieren und einfügen
4. Owner zu echten Confluence-Accounts verlinken

---

## Confluence Markup (kopieren)

```
h1. Security Checklist — Reconciliation Exports

- [ ] *Access Control* — Owner: @security.lead
  - [ ] Export API nur für Admins / autorisierte Service Accounts
  - [ ] RBAC Regeln dokumentiert

- [ ] *Signed URLs* — Owner: @security.lead
  - [ ] TTL konfiguriert (default 24h)
  - [ ] HTTPS enforced
  - [ ] Revocation procedure documented

- [ ] *Data Minimization / Masking* — Owner: @privacy.officer
  - [ ] Default export maskiert PII
  - [ ] PII export requires explicit flag + audit log

- [ ] *Audit Logging* — Owner: @compliance.lead
  - [ ] Log userId, jobId, filters, timestamp, IP
  - [ ] Logs immutable for 90 days

- [ ] *Encryption* — Owner: @infra.lead
  - [ ] S3 SSE-KMS or SSE-S3 enabled
  - [ ] TLS enforced for all endpoints

- [ ] *IAM Least Privilege* — Owner: @infra.lead
  - [ ] Worker role limited to s3:PutObject on exports/*
  - [ ] No wildcard permissions beyond scope

- [ ] *Retention & Lifecycle* — Owner: @product.owner
  - [ ] S3 lifecycle rule configured (delete after X days)
  - [ ] Customer configurable TTL documented

- [ ] *Input Validation* — Owner: @backend.lead
  - [ ] Filters parameterized; no SQL injection risk
  - [ ] Max rows/size limits enforced

- [ ] *Monitoring & Alerts* — Owner: @observability.lead
  - [ ] Alerts for unusual export volume per user
  - [ ] Alerts for repeated failures or large file sizes

- [ ] *Incident Playbook* — Owner: @sre.lead
  - [ ] Steps to revoke access, delete artifacts, rotate keys
  - [ ] Contact list for Security/Product

- [ ] *PenTest & Compliance* — Owner: @security.lead
  - [ ] Export endpoints included in next pentest
  - [ ] Legal signoff for cross-border exports
```

---

## Empfohlene Confluence User Handles

Ersetze die Platzhalter durch eure tatsächlichen Confluence-Usernamen:

| Platzhalter | Confluence Handle | Verantwortlicher |
|-------------|-------------------|------------------|
| @security.lead | @firstname.lastname | Security Lead |
| @privacy.officer | @firstname.lastname | Privacy Officer |
| @compliance.lead | @firstname.lastname | Compliance Lead |
| @infra.lead | @firstname.lastname | Infrastructure Lead |
| @product.owner | @firstname.lastname | Product Owner |
| @backend.lead | @firstname.lastname | Backend Lead |
| @observability.lead | @firstname.lastname | Observability Lead |
| @sre.lead | @firstname.lastname | SRE Lead |

---

## Nach dem Einfügen

1. **Tasks aktivieren:** Confluence wandelt `- [ ]` automatisch in klickbare Tasks um
2. **Owner verlinken:** Jeden `@handle` mit dem echten User verknüpfen
3. **Fälligkeitsdaten setzen:** Für jedes Item ein Due Date hinzufügen
4. **Watcher hinzufügen:** Alle Owner als Watcher zur Seite hinzufügen
