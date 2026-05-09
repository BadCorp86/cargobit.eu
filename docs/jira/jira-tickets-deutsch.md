# Jira Tickets — Ready-to-Paste für Bulk-Erstellung

## Ticket 1 — Design Score Spec

**Type:** Story  
**Summary:** Definiere Reconciliation-Score Modell und API-Contract  
**Description:**
- Definiere Score-Inputs, Regeln und Gewichtungen (z. B. amount_mismatch, missing_payment, duplicate, stale).
- Erstelle SQL-Pseudocode / Materialized View Design.
- Lege OpenAPI Schema für `GET /admin/reconciliation/report?withScore=true` fest.
- Erstelle UI-Wireframe für Score-Anzeige und Score-Reasons.

**Acceptance Criteria:**
- `docs/reconciliation/score-spec.md` im Repo vorhanden.
- Beispiel-SQL + Sample-Datensatz mit erwarteten Scores.
- OpenAPI Contract ergänzt und von Backend/Product reviewed.

**Assignee:** @backend-lead  
**Labels:** recon, data-product, sprint-1  
**Story Points:** 3

---

## Ticket 2 — Backend Score Implementation

**Type:** Story  
**Summary:** Implementiere Reconciliation Score (Materialized View) und API-Support  
**Description:**
- Migration für `reconciliation_scores` (materialized view oder table).
- Implementiere Refresh-Strategie (on demand / scheduled).
- Ergänze Report API um `score` und `score_reasons`.

**Acceptance Criteria:**
- Materialized view existiert und kann refreshed werden.
- API liefert `score` + `score_reasons` für Beispiel-Datensatz.
- Unit Tests für Score-Regeln vorhanden.

**Assignee:** @data-engineer  
**Labels:** recon, backend, sprint-1  
**Story Points:** 5

---

## Ticket 3 — Export Job + Signed URL

**Type:** Story  
**Summary:** Implementiere Exportjob, streaming multipart S3 Upload und signierte URLs  
**Description:**
- Worker verarbeitet `export_jobs` mit streaming multipart upload.
- `result_url` ist signierte S3 URL mit konfigurierbarer TTL (default 24h).
- Metriken: export_duration, export_in_progress, export_retries.

**Acceptance Criteria:**
- Job lifecycle: queued → running → done; `result_url` gültig.
- Signed URL läuft nach TTL ab.
- Integrationstest für medium dataset erfolgreich.

**Assignee:** @backend-lead  
**Labels:** export, infra, sprint-2  
**Story Points:** 8

---

## Ticket 4 — UI + E2E

**Type:** Story  
**Summary:** UI: Export Button + Score Anzeige; E2E Tests (Newman)  
**Description:**
- Export Button in Admin UI (CSV/JSON Auswahl).
- Score und Score-Reasons in Report-Rows und Detailview.
- Newman Collection für enqueue → process → artifact verification.

**Acceptance Criteria:**
- UI zeigt Score; Export startet Job und zeigt JobId.
- Newman E2E läuft in Staging grün.

**Assignee:** @frontend-lead, @qa-lead  
**Labels:** ui, e2e, sprint-2  
**Story Points:** 5

---

## Ticket 5 — Observability & Alerts

**Type:** Task  
**Summary:** Metriken und Alerts für Exporte und Score-Distribution  
**Description:**
- Export Metriken instrumentieren (`report_exports_total`, `report_export_duration_seconds`, `report_export_in_progress`).
- Grafana Dashboard Panel erstellen.
- Prometheus Alert Rules ausrollen (siehe `reconciliation-reports.rules.yaml`).

**Acceptance Criteria:**
- Metriken in Prometheus sichtbar.
- Alerts in Alertmanager konfiguriert und getestet.

**Assignee:** @observability  
**Labels:** monitoring, alerts  
**Story Points:** 3

---

## CSV-Import-Format für Jira

Für Bulk-Import in Jira kann folgende CSV verwendet werden:

```csv
Summary,Description,Issue Type,Assignee,Labels,Story Points,Priority
"Definiere Reconciliation-Score Modell und API-Contract","Definiere Score-Inputs, Regeln und Gewichtungen (z. B. amount_mismatch, missing_payment, duplicate, stale). Erstelle SQL-Pseudocode / Materialized View Design. Lege OpenAPI Schema für GET /admin/reconciliation/report?withScore=true fest. Erstelle UI-Wireframe für Score-Anzeige und Score-Reasons.",Story,@backend-lead,"recon, data-product, sprint-1",3,High
"Implementiere Reconciliation Score (Materialized View) und API-Support","Migration für reconciliation_scores (materialized view oder table). Implementiere Refresh-Strategie (on demand / scheduled). Ergänze Report API um score und score_reasons.",Story,@data-engineer,"recon, backend, sprint-1",5,High
"Implementiere Exportjob, streaming multipart S3 Upload und signierte URLs","Worker verarbeitet export_jobs mit streaming multipart upload. result_url ist signierte S3 URL mit konfigurierbarer TTL (default 24h). Metriken: export_duration, export_in_progress, export_retries.",Story,@backend-lead,"export, infra, sprint-2",8,High
"UI: Export Button + Score Anzeige; E2E Tests (Newman)","Export Button in Admin UI (CSV/JSON Auswahl). Score und Score-Reasons in Report-Rows und Detailview. Newman Collection für enqueue → process → artifact verification.",Story,"@frontend-lead, @qa-lead","ui, e2e, sprint-2",5,Medium
"Metriken und Alerts für Exporte und Score-Distribution","Export Metriken instrumentieren (report_exports_total, report_export_duration_seconds, report_export_in_progress). Grafana Dashboard Panel erstellen. Prometheus Alert Rules ausrollen.",Task,@observability,"monitoring, alerts",3,Medium
```

---

## Sprint-Übersicht

| Sprint | Tickets | Story Points |
|--------|---------|--------------|
| Sprint 1 | PAY-RECON-MVP-1, PAY-RECON-MVP-2 | 8 SP |
| Sprint 2 | PAY-RECON-MVP-3, PAY-RECON-MVP-4, PAY-RECON-MVP-5 | 16 SP |
| **Total** | **5 Tickets** | **24 SP** |

---

## Definition of Done (pro Ticket)

- [ ] Code committed und in main branch gemerged
- [ ] Unit Tests geschrieben und grün
- [ ] Integration Tests grün
- [ ] Code Review abgeschlossen
- [ ] Dokumentation aktualisiert
- [ ] QA Sign-off eingeholt
- [ ] Product Owner akzeptiert
