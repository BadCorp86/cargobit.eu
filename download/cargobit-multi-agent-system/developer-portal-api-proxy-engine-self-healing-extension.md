# Self-Healing Erweiterung — API Proxy Engine

**Ziel:** Operationales Self-Healing System, das die API Proxy Engine automatisch erkennt, isoliert, repariert und stabilisiert — ohne menschliches Eingreifen, mit klaren Sicherheits- und Governance-Grenzen.

**Fokus:** Schnelligkeit, Determinismus, Sicherheit, Auditierbarkeit

---

## 1. Grundprinzipien und Ziele

| Prinzip | Beschreibung |
|---------|--------------|
| **Automatisch, deterministisch, reversibel** | Keine manuellen Eingriffe, vorhersagbare Ergebnisse |
| **Contain first, fix second** | Erst Schaden begrenzen, dann reparieren |
| **Safe by default** | Maßnahmen exponieren niemals sensible Daten oder gefährden Core-Systeme |
| **Human in the loop für kritische Entscheidungen** | S2/S3 = automatische Remediation, S0/S1 = menschliche Freigabe |
| **Auditierbar** | Jede Aktion als unveränderbarer Audit-Event protokolliert |

---

## 2. Erkennungs- und Diagnosemechanismen

### 2.1 Multi-Signal Detection

| Signal-Typ | Beispiele |
|------------|-----------|
| **Metric-Basierte Regeln** | Latenz, Error Rate, Retry Rate, Circuit Breaker State |
| **Trace-Anomalien** | Plötzliche Span-Drops, fehlende Correlation-IDs |
| **Log-Pattern Detection** | Policy-Blocks, Schema-Fehler, Header-Anomalien |
| **Behavioral Baselines** | Per Partner/Endpoint historische Profile; Abweichungen triggern Alerts |

### 2.2 Health Scoring

**Health Score** berechnet aus:
- Latency P95
- Error Rate
- Success Ratio
- Resource Usage

| Score | Status | Aktion |
|-------|--------|--------|
| > 90 | Healthy | Normalbetrieb |
| 70–90 | Degraded | Monitoring intensivieren |
| < 70 | Healing Required | Self-Healing aktivieren |

### 2.3 Fast Root Cause Hints

Automatisch generierte Hypothesen (priorisiert nach Wahrscheinlichkeit und Impact):
- Schema Failure
- Routing Anomaly
- External Latency
- Signature Failure

---

## 3. Automatische Remediation Actions

### 3.1 Containment Actions (sofort, fully automated)

| Aktion | Beschreibung |
|--------|--------------|
| **Traffic Throttling** | Per Partner/Endpoint |
| **Circuit Breaker Forcing** | Für betroffene Backends |
| **Endpoint Blacklisting** | Temporär für externe Domains |
| **Safe Mode Routing** | Nur allowlisted, read-only Endpoints zulassen |

### 3.2 Repair Actions (automated with guardrails)

| Aktion | Beschreibung |
|--------|--------------|
| **Policy Rollforward** | Deploy geprüfte Policy Fixes aus Governance-Repo |
| **Schema Fallback** | Bei Validator-Fehlern auf vorherige, kompatible Version zurückfallen |
| **Config Rollback** | Automatischer Rollback auf letzte grüne Konfiguration |
| **Worker Restart** | Orchestrrierter Neustart stateless Pods mit exponential backoff |

### 3.3 Escalation Actions (human in loop)

| Aktion | Beschreibung |
|--------|--------------|
| **Auto-Pause** | Kritische Funktionen pausieren und IC benachrichtigen |
| **Require Approval** | Für Prod-wide changes erforderlich |
| **Forensic Snapshot** | Erzeugen und sichern vor jeder kritischen Änderung |

---

## 4. Safety, Governance und Audit

### 4.1 Safety Guards

| Guard | Beschreibung |
|-------|--------------|
| **No PII in automated snapshots** | Keine sensiblen Daten in Snapshots |
| **Read-only by default for critical configs** | Write actions require signed commits |
| **Rate of Change Limits** | Max automated changes per hour/day per component |

### 4.2 Governance Integration

| Aspekt | Implementierung |
|--------|-----------------|
| **Governance-as-Code** | Regeln steuern welche automated actions erlaubt sind |
| **Policy Signatures** | Nur signed policy artifacts werden automatisch angewendet |
| **Audit Trail** | Append-only events mit correlation IDs, actor, before/after state |

### 4.3 Testing and Approval

| Mechanismus | Beschreibung |
|-------------|--------------|
| **Canary Execution** | Jede automated remediation zuerst in Canary Region |
| **Automated Post-Check** | Health score must recover within defined window or rollback |
| **Periodic Review** | Architecture Board reviews automated actions quarterly |

---

## 5. Observability, KPIs und SLOs

### Self-Healing KPIs

| KPI | Target |
|-----|--------|
| **MTTR Automated** | < 5 min for S2/S3 fixes |
| **MTTR Human Escalation** | < 60 min for S1, < 4 hours for S0 human steps |
| **Auto-Remediation Success Rate** | > 95% |
| **False Remediation Rate** | < 1% |
| **Audit Coverage** | 100% of automated actions logged and retained |

### SLO Matrix

| Severity | Detection | Containment | Repair | Human Review |
|----------|-----------|-------------|--------|--------------|
| **S0** | < 1 min | < 2 min | Escalated | Required |
| **S1** | < 2 min | < 5 min | < 30 min | Required |
| **S2** | < 5 min | < 10 min | < 5 min (auto) | Optional |
| **S3** | < 10 min | < 15 min | < 5 min (auto) | Optional |

---

## 6. Self-Healing Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  SELF-HEALING ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    DETECTION LAYER                       │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────┐  │   │
│  │  │  Metrics  │ │  Traces   │ │   Logs    │ │Behavioral│  │   │
│  │  │  Rules    │ │ Anomalies │ │  Patterns │ │Baselines │  │   │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └────┬────┘  │   │
│  │        └──────────────┼──────────────┼────────────┘       │   │
│  │                       ▼              ▼                    │   │
│  │              ┌────────────────────────────┐               │   │
│  │              │      HEALTH SCORING        │               │   │
│  │              │    ENGINE (Score < 70)     │               │   │
│  │              └────────────┬───────────────┘               │   │
│  └───────────────────────────┼───────────────────────────────┘   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  REMEDIATION ENGINE                      │   │
│  │                                                          │   │
│  │   ┌─────────────────┐    ┌─────────────────────────┐    │   │
│  │   │   CONTAINMENT   │───▶│        REPAIR           │    │   │
│  │   │  (Automated)    │    │  (With Guardrails)      │    │   │
│  │   └────────┬────────┘    └───────────┬─────────────┘    │   │
│  │            │                         │                   │   │
│  │            ▼                         ▼                   │   │
│  │   ┌─────────────────┐    ┌─────────────────────────┐    │   │
│  │   │   SAFE MODE     │    │    ESCALATION           │    │   │
│  │   │  (Read-Only)    │    │   (Human in Loop)       │    │   │
│  │   └─────────────────┘    └─────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    AUDIT LAYER                           │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐              │   │
│  │  │   Event   │ │  Before/  │ │  Policy   │              │   │
│  │  │   Log     │ │   After   │ │  Check    │              │   │
│  │  └───────────┘ └───────────┘ └───────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementierungsplan (6 Schritte)

| Schritt | Aufgabe | Deliverable |
|---------|---------|-------------|
| **1** | Policy Inventory | Governance-as-Code definiert |
| **2** | Detection Layer | Metric rules, trace anomalies, log patterns |
| **3** | Health Scoring Engine | Dashboard-Integration |
| **4** | Containment Primitives | Throttles, circuit breaker forcing, safe routing |
| **5** | Repair Primitives | Schema fallback, config rollback, orchestrated restarts |
| **6** | Canary + Audit Pipeline | Automated actions in canary, post-check, promote; full audit |

---

## 8. Decision Matrix: Automated vs Human

| Severity | Containment | Repair | Approval |
|----------|-------------|--------|----------|
| **S0** | Auto | Escalated | Human Required |
| **S1** | Auto | Auto + Notify | Human Required for Prod-wide |
| **S2** | Auto | Auto | Optional Review |
| **S3** | Auto | Auto | Optional Review |

---

## 9. Executive Summary (für CTO/CISO)

| Aspekt | Status |
|--------|--------|
| Vollautomatisch für S2/S3 | ✅ Ja |
| Human in Loop für S0/S1 | ✅ Ja |
| Deterministisch | ✅ Ja |
| Reversibel | ✅ Ja |
| Auditierbar (100%) | ✅ Ja |
| Safe by Default | ✅ Ja |
| Governance integriert | ✅ Ja |
| MTTR < 5 min (S2/S3) | ✅ Ziel |

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
