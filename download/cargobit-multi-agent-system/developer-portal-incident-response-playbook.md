# Incident Response Playbook — Tools Service & API Proxy Engine

**Ziel:** Schnell, sicher, reproduzierbar und auditierbar auf Incidents reagieren, die den Tools Service oder die API Proxy Engine betreffen.

**Gilt für:**
- API Explorer
- Webhook Simulator
- Event Replay
- Determinism Engine
- Schema Validation
- Routing & Policy Layer
- Observability Hooks

---

## 1. Incident Severity Levels (S0–S3)

| Severity | Beschreibung | Beispiele |
|---------|--------------|-----------|
| **S0 – Critical Outage** | Totaler Ausfall, Sicherheitsvorfall | Proxy Engine down, Open‑Proxy‑Verdacht |
| **S1 – Major Degradation** | Hohe Fehlerraten, Latenz > 2× SLO | 5xx‑Spike, Circuit Breaker aktiv |
| **S2 – Partial Degradation** | Einzelne Tools betroffen | API Explorer Fehler, Schema Validator down |
| **S3 – Minor Issue** | Kleine Fehler, kein Impact | Logging‑Fehler, UI‑Inkonsistenzen |

---

## 2. Rollen im Incident (DRI‑Modell)

| Rolle | Verantwortung |
|-------|---------------|
| **Incident Commander (IC)** | SRE Lead — steuert den gesamten Incident |
| **Technical Lead (TL)** | Lead Engineer — analysiert & behebt |
| **Security Lead (SL)** | Security Engineer — prüft Sicherheitsrisiken |
| **Communications Lead (CL)** | TSO — Stakeholder‑Kommunikation |
| **Observer (OBS)** | Compliance Officer — Audit‑Trail sicherstellen |

---

## 3. Incident Response Lifecycle (End‑to‑End)

Der Ablauf folgt einem **deterministischen 7‑Phasen‑Modell**:

1. **Detection**
2. **Triage**
3. **Containment**
4. **Eradication**
5. **Recovery**
6. **Post‑Incident Review (PIR)**
7. **Governance Update**

Jede Phase ist klar definiert.

---

## 4. Phase 1 — Detection

**Ziel:** Incident erkennen, klassifizieren und initial bestätigen.

### Trigger:
- Alerts (latency, error rate, 5xx, circuit breaker)
- Security Alerts (header injection, routing anomalies)
- Partner Reports
- Observability Anomalies

### Aktionen:
- SRE prüft Dashboard
- SRE bestätigt Incident
- Severity Level bestimmen
- Incident Commander ernennen

### Zeitbudget:
| Severity | Zeitbudget |
|----------|-----------|
| S0/S1 | 5 Minuten |
| S2/S3 | 15 Minuten |

---

## 5. Phase 2 — Triage

**Ziel:** Ursache eingrenzen, Impact bestimmen, Hypothese bilden.

### Checkliste:
- [ ] Betrifft es alle Regionen?
- [ ] Betrifft es Sandbox oder Prod?
- [ ] Betrifft es alle Tools oder nur Proxy Engine?
- [ ] Gibt es Core‑API‑Fehler?
- [ ] Gibt es Routing‑Anomalien?
- [ ] Gibt es Security‑Indikatoren?

### Tools:
- Logs (structured)
- Traces (correlation‑ID)
- Metrics (latency, error rate)
- Circuit Breaker Dashboard

### Zeitbudget:
| Severity | Zeitbudget |
|----------|-----------|
| S0/S1 | 10 Minuten |
| S2/S3 | 30 Minuten |

---

## 6. Phase 3 — Containment

**Ziel:** Schaden begrenzen, System stabilisieren.

### Maßnahmen:
- Traffic drosseln (Rate Limits)
- Circuit Breaker aktivieren
- Sandbox isolieren
- Problematische Endpoints blockieren
- Feature Flags deaktivieren
- Rollback auf letzte stabile Version

### Security‑Spezialfälle:
| Szenario | Maßnahme |
|----------|----------|
| Verdacht auf Open‑Proxy | Sofortige Blockierung aller externen Domains |
| Verdacht auf Header Injection | Header Allowlist verschärfen |
| Verdacht auf Routing Manipulation | Routing Engine in Safe Mode |

### Zeitbudget:
| Severity | Zeitbudget |
|----------|-----------|
| S0 | sofort |
| S1 | < 15 Minuten |
| S2/S3 | < 1 Stunde |

---

## 7. Phase 4 — Eradication

**Ziel:** Ursache beheben, Schwachstelle schließen.

### Beispiele:
- Bugfix deployen
- Policy Engine aktualisieren
- Schema Validator reparieren
- Redaction Rules korrigieren
- Observability Hook fixen
- Security Patch einspielen

### Anforderungen:
- [ ] Code Review
- [ ] Security Review
- [ ] Regression Tests
- [ ] Performance Tests

### Zeitbudget:
| Severity | Zeitbudget |
|----------|-----------|
| S0 | < 4 Stunden |
| S1 | < 24 Stunden |
| S2/S3 | < 72 Stunden |

---

## 8. Phase 5 — Recovery

**Ziel:** System wiederherstellen und stabilisieren.

### Schritte:
1. Traffic wieder hochfahren
2. Rate Limits normalisieren
3. Circuit Breaker deaktivieren
4. Monitoring intensivieren
5. Partner informieren (falls nötig)

### Erfolgskriterien:
| Metrik | Zielwert |
|--------|----------|
| P95 Latenz | < 35 ms |
| Error Rate | < 0.5% |
| Neue Alerts | Keine |

---

## 9. Phase 6 — Post‑Incident Review (PIR)

**Ziel:** Lernen, verbessern, dokumentieren.

### Inhalte:
- Timeline
- Root Cause
- Impact
- Fix
- Lessons Learned
- Was hätte früher erkannt werden können?
- Welche Tests haben versagt?
- Welche Policies müssen angepasst werden?

### Teilnehmer:
- IC (Incident Commander)
- TL (Technical Lead)
- SL (Security Lead)
- COMP (Compliance Officer)
- TSO (Technical Service Owner)

### Deadline:
| Severity | Deadline |
|----------|----------|
| S0/S1 | 48 Stunden |
| S2/S3 | 5 Tage |

---

## 10. Phase 7 — Governance Update

**Ziel:** Architektur, Policies, Tests und Monitoring aktualisieren.

### Updates:
- ADR aktualisieren
- Policies aktualisieren
- Pentest‑Suite erweitern
- Observability‑Dashboards anpassen
- Hardening‑Regeln verschärfen
- Performance‑Budget anpassen

### Verantwortlich:
- Architecture Board
- Security
- SRE
- TSO

---

## Quick Reference (1‑Page)

```
┌─────────────────────────────────────────────────────────────────┐
│              INCIDENT RESPONSE QUICK REFERENCE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. DETECT   → Alert → Confirm → Assign IC                      │
│  2. TRIAGE   → Scope → Impact → Hypothesis                      │
│  3. CONTAIN  → Rate Limit → Block → Rollback                    │
│  4. ERADICATE → Fix → Patch → Review                            │
│  5. RECOVER  → Restore → Monitor → Validate                     │
│  6. REVIEW   → RCA → Lessons → Actions                          │
│  7. UPDATE   → Policies → Tests → Governance                    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  SEVERITY RESPONSE TIMES:                                       │
│  ────────────────────────────────────────────────────────────── │
│  S0 (Critical):   Detection: 5min | Triage: 10min | Fix: 4h    │
│  S1 (Major):      Detection: 5min | Triage: 10min | Fix: 24h   │
│  S2 (Partial):    Detection: 15min | Triage: 30min | Fix: 72h  │
│  S3 (Minor):      Detection: 15min | Triage: 30min | Fix: 72h  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Executive Summary (für CTO/CISO)

| Aspekt | Status |
|--------|--------|
| Deterministisch | ✅ Ja |
| Auditierbar | ✅ Ja |
| Rollenbasiert | ✅ Ja |
| Reaktionszeit kritische Incidents | < 5 Minuten |
| Trennung Containment/Eradication/Recovery | ✅ Vollständig |
| SOC2/ISO27001‑Konformität | ✅ Ja |
| Multi‑Region‑fähig | ✅ Ja |
| Fehlerbilder konsistent & sicher | ✅ Ja |

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
