# Self-Healing Policy & Health Score Reference

**Ziel:** Konkrete, sofort einsetzbare Artefakte für automatisierte Self-Healing Actions — versionierbar, signierbar, CI-gated, auditierbar.

---

## 1. Policy as Code Vorlage für Containment Actions

**Konzept:** Policies leben in Git, sind signiert und werden in der Runtime nur akzeptiert, wenn sie die Governance-Checks passieren.

### Struktur

Jede Policy enthält:
- **metadata** — Identifikation, Version, Signatur
- **trigger** — Auslösendes Signal
- **conditions** — Zusätzliche Gatekeeper
- **actions** — Atomare Primitives
- **safetyGuards** — Sicherheitsmaßnahmen
- **canary** — Canary-Ausführung
- **postChecks** — Validierung
- **audit** — Compliance-Metadaten

### Beispiel Policy

```yaml
# governance/containment/containment-policy-example.yaml
apiVersion: governance.cargobit/v1
kind: ContainmentPolicy
metadata:
  id: cp-2026-0001
  name: throttle-on-error-spike
  version: "2026-05-01"
  author: "platform/security-team"
  signature: "sha256:SIGNED_ARTIFACT_HASH"
description: |
  Automatische Drosselung bei Error Rate Spike pro Partner/Endpoint.
trigger:
  type: metric_threshold
  metric: error_rate
  scope: per_partner_per_endpoint
  window: 60s
  threshold:
    p95: 2.0   # Prozent
conditions:
  - type: environment
    allowed: ["sandbox","prod"]
  - type: partner_score
    min: 0     # always allowed to act
actions:
  - id: throttle_50pct
    type: throttle
    parameters:
      target: partner_endpoint
      rate: 50%   # reduce to 50% of normal
      duration: 300s
  - id: enable_circuit_breaker
    type: circuit_breaker
    parameters:
      target: backend_service
      failure_threshold: 5
      window: 60s
safetyGuards:
  require_signed_policy: true
  max_automated_changes_per_hour: 3
  forbid_actions:
    - modify_schema
    - expose_secrets
canary:
  enabled: true
  region: eu-west-1
  traffic_slice: 1% 
postChecks:
  - type: health_score
    must_recover_to: 85
    within: 300s
audit:
  log_level: high
  retention_days: 365
```

### Feld-Beschreibungen

| Feld | Beschreibung |
|------|--------------|
| **trigger** | Welches Signal die Policy auslöst |
| **conditions** | Zusätzliche Gatekeeper (z. B. nur Sandbox) |
| **actions** | Atomare Containment/Repair-Primitives |
| **safetyGuards** | Verhindert gefährliche automatische Änderungen |
| **canary** | Zwingt Ausführung zuerst in Canary |
| **postChecks** | Automatischer Validierungs-Step; bei Nichterfolg Rollback |
| **audit** | Audit-Metadaten für Compliance |

---

## 2. Aktionen Referenz

| Aktion | Parameter | Wirkung |
|--------|-----------|---------|
| **throttle** | target; rate; duration | Drosselt Traffic pro Partner/Endpoint |
| **circuit_breaker** | target; failure_threshold; window | Schaltet Backend temporär aus |
| **blacklist_endpoint** | target; duration | Blockiert Ziel-URL temporär |
| **safe_mode_routing** | allowed_endpoints | Nur read-only allowlist nutzen |
| **config_rollback** | to_version | Rollback auf letzte grüne Konfiguration |
| **restart_worker** | pod_selector; backoff | Orchestrierter Neustart mit Backoff |

---

## 3. Health Score Formel

**Ziel:** Ein einzelner, erklärbarer Health Score H pro Partner/Endpoint/Region, der automatisierte Entscheidungen triggert.

### Gewichtungen

| Subscore | Symbol | Gewicht |
|----------|--------|---------|
| LatencyScore (P95) | L | wL = 0.25 |
| ErrorRateScore (P95) | E | wE = 0.35 |
| SuccessRatioScore | S | wS = 0.20 |
| ResourceUsageScore | R | wR = 0.10 |
| AnomalyScore | A | wA = 0.10 |

### Formel

```
H = wL × L + wE × E + wS × S + wR × R + wA × A
```

```
H = 0.25 × L + 0.35 × E + 0.20 × S + 0.10 × R + 0.10 × A
```

Jede Subscore normiert auf 0–100 (100 = optimal).

---

## 4. Normierungsregeln

### LatencyScore L

| P95 Latenz | Score |
|------------|-------|
| ≤ 35 ms | L = 100 |
| 35–100 ms | linear 100 → 50 |
| 100–300 ms | linear 50 → 0 |
| ≥ 300 ms | L = 0 |

### ErrorRateScore E

| Error Rate | Score |
|------------|-------|
| ≤ 0.5% | E = 100 |
| 0.5–5% | linear 100 → 20 |
| 5–10% | linear 20 → 0 |
| ≥ 10% | E = 0 |

### SuccessRatioScore S

| Success Rate | Score |
|--------------|-------|
| ≥ 99.5% | S = 100 |
| 95–99.5% | linear 100 → 50 |
| 90–95% | linear 50 → 0 |
| < 90% | S = 0 |

### ResourceUsageScore R

| CPU/Memory | Score |
|------------|-------|
| CPU < 60% & Mem < 70% | R = 100 |
| CPU 60–90% | linear 100 → 20 |
| CPU 90–95% | linear 20 → 0 |
| CPU > 95% | R = 0 |

### AnomalyScore A

| Anomalien | Score |
|-----------|-------|
| Keine | A = 100 |
| Minor | A = 60 |
| Major | A = 0 |

---

## 5. Thresholds und automatisierte Aktionen

| Health Score | Zustand | Automatische Aktion |
|--------------|---------|---------------------|
| **H ≥ 90** | Healthy | Keine Aktion |
| **70 ≤ H < 90** | Degraded | Canary Containment: throttle 25% on affected slice |
| **50 ≤ H < 70** | Healing Required | Automated Containment + Repair in Canary: throttle 50%, circuit_breaker, schema_fallback |
| **H < 50** | Critical | Immediate Containment (global safe mode), human approval required |

---

## 6. Beispiel-Ablauf: H = 62

```
┌─────────────────────────────────────────────────────────────────┐
│              SELF-HEALING FLOW — H = 62 EXAMPLE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. DETECT: Policy erkennt H < 70                               │
│     └── Trigger: Canary actions aktivieren                      │
│                                                                 │
│  2. CANARY: apply throttle_50pct on 1% traffic in eu-west-1     │
│     └── Action: throttle 50%, circuit_breaker on backend        │
│                                                                 │
│  3. POSTCHECK: within 300s health must rise to ≥ 75             │
│     └── Validate: Health Score Recovery                         │
│                                                                 │
│  4. DECISION:                                                    │
│     ├── SUCCESS → promote to 10% → 100% per governance limits   │
│     └── FAIL → rollback and escalate to Incident Commander      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementierungshinweise

| Aspekt | Best Practice |
|--------|---------------|
| **Versionierung** | Normierungen für L, E, S, R, A im Governance-Repo versionieren |
| **Signierung** | Policies signieren, nur signierte Artefakte in Runtime akzeptieren |
| **Canary First** | Jede automatische Reparatur zuerst in Canary Region/Traffic Slice |
| **Audit Trail** | Jede Aktion erzeugt append-only Event mit before/after snapshot |
| **Human in Loop** | Kritische Aktionen (H < 50 oder S0) erfordern menschliche Freigabe |
| **Simulation** | Policies in Staging mit Red-Team Attack Chains testen |
| **Observability** | Health Score Komponenten in Dashboards, Drilldown auf Subscores |

---

## 8. Beispiel Health Score Berechnung

**Gegebene Metriken:**
- P95 Latenz: 45 ms → L = 85 (linear interpoliert)
- Error Rate: 1.2% → E = 76 (linear interpoliert)
- Success Ratio: 98.5% → S = 85 (linear interpoliert)
- Resource Usage: CPU 55% → R = 100
- Anomalies: Minor → A = 60

**Berechnung:**
```
H = 0.25 × 85 + 0.35 × 76 + 0.20 × 85 + 0.10 × 100 + 0.10 × 60
H = 21.25 + 26.6 + 17.0 + 10.0 + 6.0
H = 80.85
```

**Ergebnis:** H = 81 → Degraded → Canary throttle 25%

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
