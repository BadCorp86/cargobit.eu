# CargoBit Payment System — Release Checklist
## Task 4 (Payout Reconciliation) & Task 5 (Reconciliation Reporting & Export)

**Release Version:** `v2.5.0`  
**Target Date:** 2026-04-28  
**Release Manager:** DevOps Lead  
**Document Created:** 2026-04-24

---

## 📋 Pre-Launch Checklist

### Phase 1: Code & CI/CD (T-48h bis T-36h)

| # | Aufgabe | Verantwortlich | Status | Deadline |
|---|---------|----------------|--------|----------|
| 1.1 | PR Task 4 mergen (feat/reconciliation) | Backend Lead | ⬜ | T-48h |
| 1.2 | PR Task 5 mergen (feat/reports-task5) | Backend Lead | ⬜ | T-48h |
| 1.3 | CI Pipeline grün abwarten | Backend Lead | ⬜ | T-46h |
| 1.4 | Unit Tests Coverage ≥ 80% verifizieren | Backend Lead | ⬜ | T-46h |
| 1.5 | SonarQube Quality Gate bestanden | Backend Lead | ⬜ | T-44h |
| 1.6 | Security Scan (Snyk/Trivy) ohne Critical Issues | Security | ⬜ | T-44h |

### Phase 2: Datenbank (T-36h bis T-24h)

| # | Aufgabe | Verantwortlich | Status | Deadline |
|---|---------|----------------|--------|----------|
| 2.1 | Prod-DB Backup erstellen | DBA | ⬜ | T-36h |
| 2.2 | Migration in Staging testen | DBA | ⬜ | T-34h |
| 2.3 | Migration Rollback-Plan dokumentieren | DBA | ⬜ | T-32h |
| 2.4 | `export_jobs` Tabelle verifizieren | DBA | ⬜ | T-30h |
| 2.5 | Index Performance Check | DBA | ⬜ | T-28h |

### Phase 3: Staging Deployment (T-24h bis T-12h)

| # | Aufgabe | Verantwortlich | Status | Deadline |
|---|---------|----------------|--------|----------|
| 3.1 | Helm Deploy mit `reports.enabled=true` | DevOps | ⬜ | T-24h |
| 3.2 | Secrets prüfen (S3, Redis, AWS) | DevOps | ⬜ | T-22h |
| 3.3 | CronJob manuell triggern | Backend | ⬜ | T-20h |
| 3.4 | Worker Logs prüfen | Backend | ⬜ | T-20h |
| 3.5 | Export Flow E2E Test | QA | ⬜ | T-18h |
| 3.6 | Newman Collection ausführen | QA | ⬜ | T-16h |
| 3.7 | Metrics Endpoint verifizieren | Observability | ⬜ | T-14h |

### Phase 4: Observability Setup (T-12h bis T-4h)

| # | Aufgabe | Verantwortlich | Status | Deadline |
|---|---------|----------------|--------|----------|
| 4.1 | Prometheus Targets prüfen | Observability | ⬜ | T-12h |
| 4.2 | Grafana Dashboard importieren | Observability | ⬜ | T-10h |
| 4.3 | Alert Rules deployen | Observability | ⬜ | T-8h |
| 4.4 | Alert Channels konfigurieren (Slack/PagerDuty) | Observability | ⬜ | T-6h |
| 4.5 | On-Call Rota definieren | DevOps | ⬜ | T-4h |

### Phase 5: Go-Live (T-4h bis T+0h)

| # | Aufgabe | Verantwortlich | Status | Deadline |
|---|---------|----------------|--------|----------|
| 5.1 | Go/No-Go Call durchführen | Release Manager | ⬜ | T-2h |
| 5.2 | Prod-DB Migration (nach Backup) | DBA | ⬜ | T-1h |
| 5.3 | Canary Deploy (replicas=1) | DevOps | ⬜ | T-0h |
| 5.4 | 1h Beobachtung | On-Call | ⬜ | T+1h |
| 5.5 | Full Rollout (replicas=3) | DevOps | ⬜ | T+2h |

### Phase 6: Post-Launch (T+24h)

| # | Aufgabe | Verantwortlich | Status | Deadline |
|---|---------|----------------|--------|----------|
| 6.1 | Monitoring intensiv (24h) | On-Call | ⬜ | T+24h |
| 6.2 | Error Rate Check | Observability | ⬜ | T+6h |
| 6.3 | Performance Metrics Review | Backend | ⬜ | T+12h |
| 6.4 | Customer Feedback sammeln | Support | ⬜ | T+24h |
| 6.5 | Retrospective terminieren | Release Manager | ⬜ | T+48h |

---

## 👥 Verantwortlichkeiten Matrix (RACI)

| Aktivität | Backend Lead | DBA | DevOps | Observability | QA | Security | Marketing | Support |
|-----------|:------------:|:---:|:------:|:-------------:|:--:|:--------:|:---------:|:-------:|
| Code Review & Merge | **R** | C | C | I | C | C | I | I |
| DB Migration | C | **R** | I | I | I | C | I | I |
| Helm Deploy | C | I | **R** | C | I | C | I | I |
| E2E Testing | C | I | C | I | **R** | I | I | I |
| Monitoring Setup | C | I | C | **R** | I | I | I | I |
| Security Scan | C | I | C | I | I | **R** | I | I |
| Marketing Assets | I | I | I | I | I | I | **R** | C |
| Customer Support | I | I | I | I | I | I | C | **R** |

**Legende:** R = Responsible (Ausführender), A = Accountable, C = Consulted, I = Informed

---

## 📞 Escalation Kontakte

| Rolle | Name | Telefon | Slack | Verfügbarkeit |
|-------|------|---------|-------|---------------|
| Release Manager | [Name] | [+49...] | @release-manager | 24/7 während Launch |
| Backend Lead | [Name] | [+49...] | @backend-lead | On-Call |
| DBA | [Name] | [+49...] | @dba | On-Call |
| DevOps | [Name] | [+49...] | @devops | On-Call |
| Observability | [Name] | [+49...] | @observability | On-Call |
| Security | [Name] | [+49...] | @security | On-Call |

---

## 🚨 Rollback Plan

### Application Rollback
```bash
# Helm Rollback zur vorherigen Revision
helm rollback payments <PREVIOUS_REVISION> -n production

# Wenn Revision unbekannt:
helm history payments -n production
helm rollback payments <REVISION_NUMBER> -n production
```

### Database Rollback
```bash
# DBA koordiniert Restore aus Backup
pg_restore -d "$PROD_DATABASE_URL" backups/pre_migration_YYYY-MM-DD_HHMM.dump

# Alternative: Manuelle Tabellen-Wiederherstellung
# Nur nach Rücksprache mit DBA!
```

### Feature Flags (falls aktiviert)
```bash
# Reports deaktivieren via Helm Values
helm upgrade payments ./helm/payments -n production \
  --set reports.enabled=false \
  --set reconciliation.enabled=false
```

---

## ✅ Go/No-Go Entscheidungskriterien

### ✅ Go-Kriterien (ALLE müssen erfüllt sein)
- [ ] CI Pipeline grün
- [ ] Unit Test Coverage ≥ 80%
- [ ] Security Scan ohne Critical Issues
- [ ] Staging E2E Tests bestanden
- [ ] DB Migration in Staging erfolgreich
- [ ] Prometheus Metrics sichtbar
- [ ] Grafana Dashboard importiert
- [ ] Alert Rules aktiviert
- [ ] On-Call Rota definiert
- [ ] Rollback Plan dokumentiert

### ⛔ No-Go-Kriterien (EINES reicht)
- [ ] Critical Security Vulnerability
- [ ] DB Migration fehlgeschlagen
- [ ] E2E Tests nicht bestanden
- [ ] Metrics nicht verfügbar
- [ ] Kein On-Call verfügbar

---

## 📊 KPIs & Success Metrics

| Metrik | Target | Messung |
|--------|--------|---------|
| Export Success Rate | ≥ 99% | `report_exports_total{result="success"}` |
| Export Duration P95 | < 60s | `report_export_duration_seconds` |
| Reconciliation Run Duration | < 5min | `reconciliation_run_duration_seconds` |
| Error Rate | < 0.1% | `report_exports_failed_total` |
| CronJob Success Rate | 100% | `reconciliation_runs_total{status="success"}` |

---

## 📝 Sign-Off

| Rolle | Name | Datum | Unterschrift |
|-------|------|-------|--------------|
| Release Manager | _____________ | _______ | _____________ |
| Backend Lead | _____________ | _______ | _____________ |
| DBA | _____________ | _______ | _____________ |
| DevOps | _____________ | _______ | _____________ |
| Observability | _____________ | _______ | _____________ |
| Security | _____________ | _______ | _____________ |
| QA | _____________ | _______ | _____________ |

---

**Dokument Version:** 1.0  
**Letzte Aktualisierung:** 2026-04-24  
**Nächste Review:** Pre-Launch Meeting
