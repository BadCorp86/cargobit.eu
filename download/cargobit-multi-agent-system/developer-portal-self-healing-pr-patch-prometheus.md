# Self-Healing PR-Patch — Prometheus Recording Rules

**Ziel:** Apply-able Git Patch für Prometheus Recording Rules — bereit zum Anwenden im Repository.

---

## Patch-Datei

**Dateiname:** `0001-add-proxy-health-recording-rules.patch`

```diff
*** Begin Patch
*** Add File: prometheus/recording_rules/proxy_health_rules.yaml
+# prometheus/recording_rules/proxy_health_rules.yaml
+groups:
+- name: proxy_engine_health.rules
+  rules:
+  - record: proxy:latency_p95_ms
+    expr: |
+      histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="proxy"}[5m])) by (le, partner, endpoint, region))
+  - record: proxy:error_rate_pct
+    expr: |
+      100 * sum(rate(http_requests_total{job="proxy",status=~"4..|5.."}[5m])) by (partner, endpoint, region)
+      / sum(rate(http_requests_total{job="proxy"}[5m])) by (partner, endpoint, region)
+  - record: proxy:success_ratio_pct
+    expr: |
+      100 * (1 - (sum(rate(http_requests_total{job="proxy",status=~"4..|5.."}[5m])) by (partner, endpoint, region)
+      / sum(rate(http_requests_total{job="proxy"}[5m])) by (partner, endpoint, region)))
+  - record: proxy:cpu_usage_pct
+    expr: |
+      100 * avg(rate(process_cpu_seconds_total{job="proxy"}[5m])) by (instance, partner, endpoint, region)
+  - record: proxy:anomaly_indicator
+    expr: |
+      max_over_time(anomaly_flag{job="proxy"}[5m]) by (partner, endpoint, region)
+  - record: proxy:latency_score
+    expr: |
+      clamp_min(100 - ((proxy:latency_p95_ms - 35) * 100 / (300 - 35)), 0)
+  - record: proxy:error_score
+    expr: |
+      clamp_min(100 - ((proxy:error_rate_pct - 0.5) * 100 / (10 - 0.5)), 0)
+  - record: proxy:success_score
+    expr: |
+      clamp_min(100 * (proxy:success_ratio_pct - 90) / (99.5 - 90), 0)
+  - record: proxy:resource_score
+    expr: |
+      clamp_min(100 - ((proxy:cpu_usage_pct - 60) * 100 / (95 - 60)), 0)
+  - record: proxy:anomaly_score
+    expr: |
+      100 * (1 - proxy:anomaly_indicator)
+  - record: proxy:health_score
+    expr: |
+      0.25 * proxy:latency_score
+      + 0.35 * proxy:error_score
+      + 0.20 * proxy:success_score
+      + 0.10 * proxy:resource_score
+      + 0.10 * proxy:anomaly_score
*** End Patch
```

---

## Anwendungsschritte

```bash
# 1) Branch anlegen
git checkout -b ci/prometheus/proxy-health-rules

# 2) Patch-Datei erstellen
mkdir -p prometheus/recording_rules
cat > prometheus/recording_rules/proxy_health_rules.yaml <<'EOF'
groups:
- name: proxy_engine_health.rules
  rules:
  - record: proxy:latency_p95_ms
    expr: |
      histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="proxy"}[5m])) by (le, partner, endpoint, region))
  - record: proxy:error_rate_pct
    expr: |
      100 * sum(rate(http_requests_total{job="proxy",status=~"4..|5.."}[5m])) by (partner, endpoint, region)
      / sum(rate(http_requests_total{job="proxy"}[5m])) by (partner, endpoint, region)
  - record: proxy:success_ratio_pct
    expr: |
      100 * (1 - (sum(rate(http_requests_total{job="proxy",status=~"4..|5.."}[5m])) by (partner, endpoint, region)
      / sum(rate(http_requests_total{job="proxy"}[5m])) by (partner, endpoint, region)))
  - record: proxy:cpu_usage_pct
    expr: |
      100 * avg(rate(process_cpu_seconds_total{job="proxy"}[5m])) by (instance, partner, endpoint, region)
  - record: proxy:anomaly_indicator
    expr: |
      max_over_time(anomaly_flag{job="proxy"}[5m]) by (partner, endpoint, region)
  - record: proxy:latency_score
    expr: |
      clamp_min(100 - ((proxy:latency_p95_ms - 35) * 100 / (300 - 35)), 0)
  - record: proxy:error_score
    expr: |
      clamp_min(100 - ((proxy:error_rate_pct - 0.5) * 100 / (10 - 0.5)), 0)
  - record: proxy:success_score
    expr: |
      clamp_min(100 * (proxy:success_ratio_pct - 90) / (99.5 - 90), 0)
  - record: proxy:resource_score
    expr: |
      clamp_min(100 - ((proxy:cpu_usage_pct - 60) * 100 / (95 - 60)), 0)
  - record: proxy:anomaly_score
    expr: |
      100 * (1 - proxy:anomaly_indicator)
  - record: proxy:health_score
    expr: |
      0.25 * proxy:latency_score
      + 0.35 * proxy:error_score
      + 0.20 * proxy:success_score
      + 0.10 * proxy:resource_score
      + 0.10 * proxy:anomaly_score
EOF

# 3) Datei hinzufügen und committen
git add prometheus/recording_rules/proxy_health_rules.yaml
git commit -m "chore(prometheus): add proxy health recording rules (proxy:health_score)"

# 4) Branch pushen
git push -u origin ci/prometheus/proxy-health-rules
```

---

## PR-Metadaten

| Feld | Wert |
|------|------|
| **Branch** | `ci/prometheus/proxy-health-rules` |
| **Commit Message** | `chore(prometheus): add proxy health recording rules (proxy:health_score)` |
| **PR-Titel** | `chore(prometheus): add proxy health recording rules` |

---

## PR-Beschreibung

```
## Was
Fügt Recording Rules für Proxy-Engine Subscores und `proxy:health_score` hinzu.

## Warum
Grundlage für Governance-Policies, Canary PostChecks und automatische Remediation.

## Voraussetzungen
- Instrumentation liefert Labels `partner`, `endpoint`, `region`
- CI: `promtool check rules` muss grün sein

## Reviewer
- Observability Engineer
- SRE Lead

## Merge-Kriterien
- CI grün
- Reviewer-Freigabe
- Cardinality-Check (keine ungewollte Explosion an Label-Kombinationen)
```

---

## Reviewer-Checklist

```markdown
- [ ] Labels `partner`, `endpoint`, `region` in den Metriken vorhanden
- [ ] `promtool check rules prometheus/recording_rules/proxy_health_rules.yaml` läuft grün
- [ ] Observability Engineer und SRE Lead haben geprüft
- [ ] Keine unerwünschte Label-Cardinality
```

---

## Recording Rules Übersicht

| Rule | Typ | Beschreibung |
|------|-----|--------------|
| `proxy:latency_p95_ms` | Raw | P95 Latenz in ms |
| `proxy:error_rate_pct` | Raw | Fehlerrate in % |
| `proxy:success_ratio_pct` | Raw | Erfolgsquote in % |
| `proxy:cpu_usage_pct` | Raw | CPU-Auslastung in % |
| `proxy:anomaly_indicator` | Raw | Anomalie-Flag (0-1) |
| `proxy:latency_score` | Score | 0-100, optimal bei ≤35ms |
| `proxy:error_score` | Score | 0-100, optimal bei ≤0.5% |
| `proxy:success_score` | Score | 0-100, optimal bei ≥99.5% |
| `proxy:resource_score` | Score | 0-100, optimal bei <60% CPU |
| `proxy:anomaly_score` | Score | 0-100, optimal bei 0 Anomalien |
| `proxy:health_score` | **Final** | Gewichteter Gesamt-Score |

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
