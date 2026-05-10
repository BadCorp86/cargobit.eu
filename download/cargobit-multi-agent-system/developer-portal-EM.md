# EM – Automatisiertes Monitoring + Alerts (Minimal)

> **Zweck**: Nur 5 Alerts, die wirklich wichtig sind. Kein Alert-Fatigue.

---

## 📊 Monitoring – Minimal-Architektur

### Prinzip

| Aspekt | Wert |
|--------|------|
| Alerts | 5 (nur kritische) |
| Metriken | Error-Rate, Latenz, Security |
| Tool | Prometheus + Grafana |
| Aufwand | Minimal |

---

## Die 5 Essentialen Alerts

### Alert 1: Error-Rate

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: error-rate-alert
  namespace: monitoring
spec:
  groups:
    - name: availability
      rules:
        - alert: HighErrorRate
          expr: |
            sum(rate(http_requests_total{status=~"5.."}[5m])) 
            / 
            sum(rate(http_requests_total[5m])) > 0.01
          for: 5m
          labels:
            severity: critical
            team: platform
          annotations:
            summary: "Error rate > 1%"
            description: "HTTP 5xx error rate is {{ $value | humanizePercentage }}"
            runbook_url: "https://runbooks.company.com/high-error-rate"
```

### Alert 2: Latenz

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: latency-alert
  namespace: monitoring
spec:
  groups:
    - name: performance
      rules:
        - alert: HighLatency
          expr: |
            histogram_quantile(0.95, 
              sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
            ) > 0.2
          for: 10m
          labels:
            severity: warning
            team: platform
          annotations:
            summary: "P95 latency > 200ms"
            description: "95th percentile latency is {{ $value | humanizeDuration }}"
```

### Alert 3: Admission Denials

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: admission-alert
  namespace: monitoring
spec:
  groups:
    - name: security
      rules:
        - alert: AdmissionDenials
          expr: increase(kyverno_admission_requests_total{allowed="false"}[5m]) > 0
          for: 1m
          labels:
            severity: critical
            team: security
          annotations:
            summary: "Deployment blocked by admission policy"
            description: "{{ $value }} admission denials in last 5 minutes"
            runbook_url: "https://runbooks.company.com/admission-denied"
```

### Alert 4: Signature Verify Failures

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: signature-alert
  namespace: monitoring
spec:
  groups:
    - name: supply-chain
      rules:
        - alert: SignatureVerifyFailed
          expr: increase(cosign_verify_failures_total[5m]) > 0
          for: 1m
          labels:
            severity: critical
            team: security
          annotations:
            summary: "Image signature verification failed"
            description: "{{ $value }} signature verification failures"
            runbook_url: "https://runbooks.company.com/signature-failed"
```

### Alert 5: CVE Blocker

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cve-alert
  namespace: monitoring
spec:
  groups:
    - name: vulnerability
      rules:
        - alert: CVEHighCritical
          expr: trivy_vulnerabilities{severity=~"HIGH|CRITICAL"} > 0
          for: 1h
          labels:
            severity: critical
            team: security
          annotations:
            summary: "HIGH/CRITICAL CVE detected"
            description: "{{ $labels.image }} has {{ $value }} {{ $labels.severity }} vulnerabilities"
            runbook_url: "https://runbooks.company.com/cve-found"
```

---

## Alle Alerts als Bundle

```yaml
# essential-alerts.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: essential-alerts
  namespace: monitoring
spec:
  groups:
    - name: availability
      rules:
        - alert: HighErrorRate
          expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.01
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Error rate > 1%"

    - name: performance
      rules:
        - alert: HighLatency
          expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 0.2
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "P95 latency > 200ms"

    - name: security
      rules:
        - alert: AdmissionDenials
          expr: increase(kyverno_admission_requests_total{allowed="false"}[5m]) > 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "Deployment blocked"

        - alert: SignatureVerifyFailed
          expr: increase(cosign_verify_failures_total[5m]) > 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "Signature verification failed"

    - name: vulnerability
      rules:
        - alert: CVEHighCritical
          expr: trivy_vulnerabilities{severity=~"HIGH|CRITICAL"} > 0
          for: 1h
          labels:
            severity: critical
          annotations:
            summary: "CVE detected"
```

---

## Alertmanager Config

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-config
  namespace: monitoring
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m

    route:
      group_by: ['severity']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
      receiver: 'default'

      routes:
        - match:
            severity: critical
          receiver: 'critical'
          continue: false

        - match:
            severity: warning
          receiver: 'warning'

    receivers:
      - name: 'default'
        slack_configs:
          - channel: '#alerts'
            send_resolved: true

      - name: 'critical'
        slack_configs:
          - channel: '#alerts-critical'
            send_resolved: true
        pagerduty_configs:
          - service_key: <PAGERDUTY_KEY>

      - name: 'warning'
        slack_configs:
          - channel: '#alerts-warning'
            send_resolved: true

    inhibit_rules:
      - source_match:
          severity: 'critical'
        target_match:
          severity: 'warning'
        equal: ['alertname']
```

---

## Minimal Grafana Dashboard

```json
{
  "title": "Platform Health",
  "panels": [
    {
      "title": "Error Rate",
      "type": "stat",
      "targets": [{
        "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))"
      }],
      "thresholds": {
        "mode": "absolute",
        "steps": [
          {"color": "green", "value": 0},
          {"color": "yellow", "value": 0.005},
          {"color": "red", "value": 0.01}
        ]
      }
    },
    {
      "title": "P95 Latency",
      "type": "stat",
      "targets": [{
        "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))"
      }],
      "thresholds": {
        "mode": "absolute",
        "steps": [
          {"color": "green", "value": 0},
          {"color": "yellow", "value": 0.1},
          {"color": "red", "value": 0.2}
        ]
      },
      "unit": "s"
    },
    {
      "title": "Signature Status",
      "type": "stat",
      "targets": [{
        "expr": "count(cosign_verify_success_total) or vector(0)"
      }],
      "fieldConfig": {
        "defaults": {
          "mappings": [
            {"type": "value", "options": {"0": {"text": "N/A", "color": "grey"}}}
          ],
          "thresholds": {
            "mode": "absolute",
            "steps": [
              {"color": "green", "value": 1}
            ]
          }
        }
      }
    },
    {
      "title": "CVE Count",
      "type": "stat",
      "targets": [{
        "expr": "sum(trivy_vulnerabilities{severity=~\"HIGH|CRITICAL\"}) or vector(0)"
      }],
      "thresholds": {
        "mode": "absolute",
        "steps": [
          {"color": "green", "value": 0},
          {"color": "red", "value": 1}
        ]
      }
    }
  ]
}
```

---

## Check-Script

```bash
#!/bin/bash
# monitoring-check.sh

echo "📊 Platform Health Check"
echo "========================"

# Error Rate
ERROR_RATE=$(curl -s 'http://prometheus:9090/api/v1/query?query=sum(rate(http_requests_total{status=~"5.."}[5m]))/sum(rate(http_requests_total[5m]))' | jq -r '.data.result[0].value[1]')
echo "Error Rate: $(echo "$ERROR_RATE * 100" | bc)%"

# Latency P95
LATENCY=$(curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket[5m]))by(le))' | jq -r '.data.result[0].value[1]')
echo "P95 Latency: ${LATENCY}s"

# Active Alerts
ALERTS=$(curl -s 'http://prometheus:9090/api/v1/alerts' | jq '.data.alerts | length')
echo "Active Alerts: $ALERTS"

# CVE Count
CVES=$(curl -s 'http://prometheus:9090/api/v1/query?query=sum(trivy_vulnerabilities{severity=~"HIGH|CRITICAL"})' | jq -r '.data.result[0].value[1]')
echo "HIGH/CRITICAL CVEs: $CVES"

echo ""
echo "========================"
if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )) || [ "$CVES" -gt 0 ] || [ "$ALERTS" -gt 0 ]; then
  echo "❌ ISSUES DETECTED"
  exit 1
else
  echo "✅ ALL SYSTEMS HEALTHY"
  exit 0
fi
```

---

## Vorteile

| Vorteil | Beschreibung |
|---------|--------------|
| Fokussiert | Nur 5 Alerts |
| Kein Fatigue | Wichtiges wird angezeigt |
| Minimal | Keine komplexe Konfiguration |
| Automatisch | Alerts lösen Runbooks aus |

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Canary + Rollback | EL |
| Key Rotation | EN |
| Go-Live Gate | EO |
| Day-2 Operations | EP |

---

*Block EM – Monitoring + Alerts (Minimal) – v1.0*
