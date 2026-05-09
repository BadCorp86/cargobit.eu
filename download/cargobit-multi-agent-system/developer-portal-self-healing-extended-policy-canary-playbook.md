# Self-Healing Extended Policy & Canary Playbook

**Ziel:** Sofort einsetzbare, versionierbare und signierbare Policy-Vorlagen mit erweiterten Containment/Repair-Primitives, Health Score Implementierung und Canary Playbook.

---

## 1. Erweiterte Policy as Code Vorlage

**Speicherort:** `governance/containment/containment-policy-extended.yaml`

```yaml
# governance/containment/containment-policy-extended.yaml
apiVersion: governance.cargobit/v1
kind: ContainmentPolicy
metadata:
  id: cp-2026-0002
  name: advanced-containment-and-repair
  version: "2026-06-01"
  author: "platform/security-team"
  signature: "sha256:SIGNED_ARTIFACT_HASH"
description: |
  Erweiterte Containment und Repair Policy mit Canary, Rollback und Forensic Snapshot.
trigger:
  type: composite
  signals:
    - type: metric_threshold
      metric: error_rate
      scope: per_partner_per_endpoint
      window: 60s
      threshold:
        p95: 2.0
    - type: trace_anomaly
      scope: per_partner_per_endpoint
      score_threshold: 0.7
conditions:
  - type: environment
    allowed: ["sandbox","prod"]
  - type: partner_score
    min: 0
  - type: governance_window
    allowed_hours: ["00:00-23:59"]
actions:
  containment:
    - id: throttle_50pct
      type: throttle
      parameters:
        target: partner_endpoint
        rate: 50%
        duration: 300s
    - id: enable_circuit_breaker
      type: circuit_breaker
      parameters:
        target: backend_service
        failure_threshold: 5
        window: 60s
    - id: safe_mode_routing
      type: safe_mode_routing
      parameters:
        allowed_endpoints:
          - api.cargobit.com/v1/status
          - api.cargobit.com/v1/readonly/*
        duration: 600s
  repair:
    - id: schema_fallback
      type: schema_fallback
      parameters:
        target: schema_id
        fallback_version: previous_compatible
    - id: config_rollback
      type: config_rollback
      parameters:
        to_version: last_green
    - id: restart_worker
      type: restart_worker
      parameters:
        pod_selector: "app=proxy-engine"
        backoff: 30s
  forensic:
    - id: forensic_snapshot
      type: snapshot
      parameters:
        include_logs: true
        include_traces: true
        redact_pii: true
        storage: secure-vault
safetyGuards:
  require_signed_policy: true
  max_automated_changes_per_hour: 3
  forbid_actions:
    - modify_schema
    - expose_secrets
  require_canary: true
canary:
  enabled: true
  region: eu-west-1
  traffic_slice: 1%
  promotion_steps:
    - 1%
    - 10%
    - 50%
    - 100%
postChecks:
  - type: health_score
    must_recover_to: 85
    within: 300s
  - type: observability_integrity
    must_have_correlation: true
audit:
  log_level: high
  retention_days: 365
  event_schema: governance_event_v1
```

### Neue Primitives Kurzreferenz

| Primitive | Beschreibung |
|-----------|--------------|
| **safe_mode_routing** | Beschränkt ausgehende Calls auf read-only allowlist |
| **schema_fallback** | Wechselt automatisch auf vorherige kompatible Schema-Version |
| **forensic_snapshot** | Sichert Logs/Traces vor kritischen Änderungen, PII wird redigiert |
| **promotion_steps** | Gestaffelte Canary Promotion mit PostChecks |

---

## 2. Health Score Implementierung

### Formel

```
H = 0.25 × L + 0.35 × E + 0.20 × S + 0.10 × R + 0.10 × A
```

### Normierungsmethoden

| Subscore | Optimal | Schlecht | Normierung |
|----------|---------|----------|------------|
| **LatencyScore L** | P95 ≤ 35ms | P95 ≥ 300ms | Linear 100 → 0 |
| **ErrorRateScore E** | Error ≤ 0.5% | Error ≥ 10% | Linear 100 → 0 |
| **SuccessRatioScore S** | Success ≥ 99.5% | Success < 90% | Linear 100 → 0 |
| **ResourceUsageScore R** | CPU < 60% | CPU > 95% | Linear 100 → 0 |
| **AnomalyScore A** | Keine Anomalien | Schwere Anomalien | ML/Rule Engine 100 → 0 |

### PromQL Implementierung

```promql
# LatencyScore L (P95 in ms)
latency_p95_ms = histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="proxy"}[5m])) by (le))

# ErrorRateScore E (error rate percentage)
error_rate = 100 * sum(rate(http_requests_total{job="proxy",status=~"5..|4.."}[5m])) / sum(rate(http_requests_total{job="proxy"}[5m]))

# SuccessRatioScore S (percentage)
success_ratio = 100 * (1 - sum(rate(http_requests_total{job="proxy",status=~"5..|4.."}[5m])) / sum(rate(http_requests_total{job="proxy"}[5m])))

# ResourceUsageScore R (CPU usage per instance)
cpu_usage = avg(rate(process_cpu_seconds_total{job="proxy"}[5m])) by (instance)

# AnomalyScore A (from anomaly detection metric)
anomaly_score = 100 * (1 - max_over_time(anomaly_indicator{job="proxy"}[5m]))

# Final Health Score H (as recording rule)
# H = 0.25*L + 0.35*E + 0.20*S + 0.10*R + 0.10*A
```

### Pseudocode

```python
def normalize_latency(p95_ms):
    if p95_ms <= 35: return 100
    if p95_ms >= 300: return 0
    return int(100 * (1 - (p95_ms - 35) / (300 - 35)))

def normalize_error_rate(err_pct):
    if err_pct <= 0.5: return 100
    if err_pct >= 10: return 0
    return int(100 * (1 - (err_pct - 0.5) / (10 - 0.5)))

def compute_health_score(L, E, S, R, A):
    return 0.25 * L + 0.35 * E + 0.20 * S + 0.10 * R + 0.10 * A

def decide_action(H):
    if H >= 90:
        return "healthy"
    elif 70 <= H < 90:
        return "canary_throttle_25"
    elif 50 <= H < 70:
        return "canary_containment_and_repair"
    else:
        return "global_safe_mode_and_human_approval"
```

---

## 3. Canary Playbook

### Canary Phasen

| Phase | Aktion | Dauer |
|-------|--------|-------|
| **1. Plan** | Policy geprüft, signiert, Canary definiert | - |
| **2. Canary 1%** | Apply action to 1% traffic in eu-west-1 | 300s PostCheck |
| **3. Canary 10%** | Wenn OK, promote to 10% | 300s PostCheck |
| **4. Canary 50%** | Wenn OK, promote to 50% | 300s PostCheck |
| **5. Full 100%** | Wenn OK, promote to 100% | - |

### Monitoring während Canary

| Metrik | Beschreibung |
|--------|--------------|
| **Health Score H** | For slice and global |
| **P95 Latency** | Ziel: < 35ms |
| **Error Rate** | Ziel: < 0.5% |
| **Success Ratio** | Ziel: > 99.5% |
| **Observability Integrity** | Correlation IDs present, no log corruption |
| **Forensic Snapshot** | Created before first action |

### Promotion Criteria

- H must recover to `must_recover_to` (z. B. 85) within `within` seconds (z. B. 300s)
- No new security alerts during window
- No increase in false positives in observability

### Rollback Trigger

| Trigger | Aktion |
|---------|--------|
| H fails threshold | Rollback |
| Error Rate +20% vs baseline | Rollback |
| Anomaly score > 0.5 | Rollback |
| Crash or unhandled exception | Rollback |
| Observability integrity failure | Rollback |

### Rollback Procedure

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROLLBACK PROCEDURE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. IMMEDIATE                                                   │
│     └── Revert action in Canary slice (automated)               │
│                                                                 │
│  2. SNAPSHOT                                                    │
│     └── Preserve forensic snapshot for RCA                      │
│                                                                 │
│  3. NOTIFY                                                      │
│     └── Incident Commander + Security Lead                      │
│                                                                 │
│  4. QUARANTINE                                                  │
│     └── If rollback fails → global safe mode + human approval   │
│                                                                 │
│  5. RCA                                                         │
│     └── Automated diagnostics + PIR within 48h (S0/S1)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Canary Run Sequence (Beispiel)

```
1. PREFLIGHT
   ├── Run smoke tests
   ├── Run Open-Proxy quick checks
   └── Create forensic snapshot

2. APPLY
   └── throttle_50pct on 1% traffic in eu-west-1

3. WAIT
   └── 300s monitoring window

4. EVALUATE
   ├── if H >= 85 and no anomalies → promote to 10%
   └── else → rollback

5. REPEAT
   └── Promote to 50% then 100% with same checks

6. FINALIZE
   └── Write governance event with before/after state and sign
```

### Audit Events

| Event | Inhalt |
|-------|--------|
| **policy_apply.start** | correlation_id, actor=automation, before_state_hash |
| **policy_apply.postcheck** | H values, metrics snapshot |
| **policy_apply.promote** | Signed commit id |
| **policy_apply.rollback** | Signed commit id, reason |

**Retention:** Alle Events nach `audit.retention_days` (z. B. 365 Tage)

---

## 4. Implementierungshinweise

| Aspekt | Empfehlung |
|--------|------------|
| **Recording Rules** | Normierung und finale Berechnung als Prometheus recording rules |
| **Transformation** | Alternativ: Grafana Transform, Cortex, Mimir |
| **Versionierung** | Policies und Normierungen im Governance-Repo versionieren |
| **Stabilität** | Policies greifen auf stabile, versionierte Werte zu |

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
