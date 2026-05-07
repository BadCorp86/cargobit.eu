# SLO/SLI Definitionen – Governance Postcheck

Service Level Objectives und Indicators für das CargoBit Multi-Agent System.

---

## Grundlagen

### Begriffe

| Begriff | Definition |
|---------|------------|
| **SLI** (Service Level Indicator) | Messbare Metrik (z.B. Latency, Error Rate) |
| **SLO** (Service Level Objective) | Zielwert für SLI (z.B. 99.5% Verfügbarkeit) |
| **SLA** (Service Level Agreement) | Vertragliche Vereinbarung mit Konsequenzen |

### Error Budget

```
Error Budget = 1 - SLO

Beispiel: SLO = 99.5%
Error Budget = 0.5% = 7.2 min/Tag = 43.8 min/Woche
```

---

## SLI-Katalog

### Availability

| SLI | Formel | Prometheus Query |
|-----|--------|------------------|
| Request Success Rate | `successful_requests / total_requests` | `sum(rate(http_requests_total{status!~"5.."}[5m])) / sum(rate(http_requests_total[5m]))` |
| Uptime | `uptime_seconds / total_seconds` | `avg_over_time(up{job="cargobit"}[30d])` |

### Latency

| SLI | Formel | Prometheus Query |
|-----|--------|------------------|
| P50 Latency | 50. Perzentil | `histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))` |
| P95 Latency | 95. Perzentil | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` |
| P99 Latency | 99. Perzentil | `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))` |

### Throughput

| SLI | Formel | Prometheus Query |
|-----|--------|------------------|
| Requests/sec | `requests / second` | `sum(rate(http_requests_total[5m]))` |
| Bytes/sec | `bytes / second` | `sum(rate(network_bytes_total[5m]))` |

### Errors

| SLI | Formel | Prometheus Query |
|-----|--------|------------------|
| Error Rate | `5xx_requests / total_requests` | `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))` |
| Error Budget Burn Rate | `(1 - current_slo) / (1 - target_slo)` | Custom Query |

---

## SLO-Definitionen

### Tier 1 – Critical Services

| Service | SLO | Error Budget | Messfenster |
|---------|-----|--------------|-------------|
| API Gateway | 99.9% | 43.8 sec/Tag | 30 Tage |
| Auth Service | 99.9% | 43.8 sec/Tag | 30 Tage |
| Agent Orchestrator | 99.5% | 7.2 min/Tag | 30 Tage |

### Tier 2 – Core Services

| Service | SLO | Error Budget | Messfenster |
|---------|-----|--------------|-------------|
| Task Queue | 99.5% | 7.2 min/Tag | 30 Tage |
| State Store | 99.5% | 7.2 min/Tag | 30 Tage |
| Message Bus | 99.5% | 7.2 min/Tag | 30 Tage |

### Tier 3 – Supporting Services

| Service | SLO | Error Budget | Messfenster |
|---------|-----|--------------|-------------|
| Dashboard | 99.0% | 14.4 min/Tag | 30 Tage |
| Analytics | 95.0% | 1.2 h/Tag | 30 Tage |
| Logging | 99.0% | 14.4 min/Tag | 30 Tage |

---

## Health Score Formel

```
H = 0.25×L + 0.35×E + 0.20×S + 0.10×R + 0.10×A
```

| Komponente | Gewicht | Beschreibung |
|------------|---------|--------------|
| L – Latency | 25% | P99 Latency Score (0–100) |
| E – Errors | 35% | Error Rate Score (0–100) |
| S – Saturation | 20% | Resource Utilization Score (0–100) |
| R – Resources | 10% | Memory/CPU Headroom Score (0–100) |
| A – Availability | 10% | Uptime Score (0–100) |

### Score-Berechnung

```python
def calculate_health_score(latency_p99, error_rate, saturation, resources, availability):
    """
    Berechnet den Health Score (0–100).
    """
    L = max(0, 100 - (latency_p99 / 10))  # P99 in ms, <100ms = 100 Score
    E = max(0, 100 - (error_rate * 1000))  # <0.1% = 100 Score
    S = max(0, 100 - saturation)  # <80% = 100 Score
    R = max(0, 100 - resources)  # <80% = 100 Score
    A = availability * 100  # 99.9% = 99.9 Score

    H = 0.25 * L + 0.35 * E + 0.20 * S + 0.10 * R + 0.10 * A
    return round(H, 2)
```

---

## Alerting Thresholds

### Burn Rate Alerts

| Severity | Burn Rate | Zeitfenster | Aktion |
|----------|-----------|-------------|--------|
| Warning | 2x | 1 Stunde | Slack Notification |
| Critical | 10x | 5 Minuten | Page On-Call |
| Emergency | 100x | 1 Minute | Immediate Response |

### SLO Breach Alerts

```yaml
# Prometheus Alerting Rules
groups:
  - name: slo-alerts
    rules:
      - alert: SLOBreach99_5
        expr: |
          sum(rate(http_requests_total{status!~"5.."}[30d]))
          / sum(rate(http_requests_total[30d])) < 0.995
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "SLO 99.5% breached"
          description: "Current availability: {{ $value | humanizePercentage }}"

      - alert: ErrorBudgetExhausted
        expr: |
          (1 - sum(rate(http_requests_total{status!~"5.."}[30d]))
          / sum(rate(http_requests_total[30d])))
          / 0.005 > 1
        for: 1m
        labels:
          severity: emergency
        annotations:
          summary: "Error Budget exhausted"
```

---

## Dashboards

### SLO Dashboard Panels

| Panel | Query | Visualisierung |
|-------|-------|----------------|
| SLO Gauge | Current SLO Value | Gauge (0–100%) |
| Error Budget | Remaining Budget | Stat (0–100%) |
| Burn Rate | Current Burn Rate | Time Series |
| Latency Histogram | P50/P95/P99 | Heatmap |

---

## Reporting

### Weekly SLO Report

| Metrik | Diese Woche | Vorwoche | Trend |
|--------|-------------|----------|-------|
| Availability | <!-- %> | <!-- %> | ↑/↓ |
| P99 Latency | <!-- ms> | <!-- ms> | ↑/↓ |
| Error Budget | <!-- %> | <!-- %> | ↑/↓ |
| Incidents | <!-- N> | <!-- N> | ↑/↓ |

---

*Block CW – SLO/SLI Definitionen*
