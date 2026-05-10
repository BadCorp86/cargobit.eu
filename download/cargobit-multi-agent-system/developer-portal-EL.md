# EL – Automatisiertes Canary + Rollback (Minimal)

> **Zweck**: Sichere, schrittweise Rollouts mit automatischem Rollback bei Problemen.

---

## 🚀 Canary + Rollback – Minimal-Architektur

### Prinzip

| Aspekt | Wert |
|--------|------|
| Tool | Argo Rollouts / Flagger |
| Dauer | 24-48h |
| Traffic | 10% → 100% |
| Aufwand | Automatisch |

---

## Argo Rollouts Installation

```bash
# Install Argo Rollouts
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# Install kubectl plugin
curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
chmod +x ./kubectl-argo-rollouts-linux-amd64
sudo mv ./kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts
```

---

## Minimal Rollout Configuration

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  revisionHistoryLimit: 2
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: ghcr.io/company/app@sha256:xxx
          ports:
            - containerPort: 8080
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "200m"
  strategy:
    canary:
      # Einfachste Strategy: 10% für 24h
      steps:
        - setWeight: 10
        - pause:
            duration: 24h  # 24 Stunden beobachten
        - setWeight: 50
        - pause:
            duration: 2h
        - setWeight: 100
      # Optional: Automatisches Rollback bei Fehlern
      analysis:
        templates:
          - templateName: success-rate
        startingStep: 2
        args:
          - name: service-name
            value: myapp-canary
```

---

## Analysis Template

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
  namespace: production
spec:
  args:
    - name: service-name
  metrics:
    - name: success-rate
      interval: 5m
      successCondition: result[0] >= 0.99
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus.monitoring.svc.cluster.local:9090
          query: |
            sum(rate(http_requests_total{service="{{args.service-name}}",status!~"5.."}[5m])) 
            / 
            sum(rate(http_requests_total{service="{{args.service-name}}"}[5m]))
```

---

## Flagger Alternative (einfacher)

```bash
# Install Flagger
kubectl apply -k github.com/fluxcd/flagger//kustomize/istio
```

```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: myapp
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  progressDeadlineSeconds: 60
  service:
    port: 8080
  analysis:
    interval: 1h
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
      - name: request-success-rate
        thresholdRange:
          min: 99
        interval: 1m
      - name: request-duration
        thresholdRange:
          max: 500
        interval: 1m
```

---

## Rollback-Befehle

```bash
# Rollout Status
kubectl argo rollouts get rollout myapp -n production

# Rollback zur vorherigen Version
kubectl argo rollouts undo myapp -n production

# Rollback zu spezifischer Revision
kubectl argo rollouts undo myapp -n production --to-revision=2

# Rollout pausieren
kubectl argo rollouts pause myapp -n production

# Rollout fortsetzen
kubectl argo rollouts resume myapp -n production
```

---

## Canary-Monitoring Dashboard

```yaml
# Grafana Dashboard Config
apiVersion: v1
kind: ConfigMap
metadata:
  name: canary-dashboard
  namespace: monitoring
data:
  dashboard.json: |
    {
      "title": "Canary Health",
      "panels": [
        {
          "title": "Error Rate",
          "type": "graph",
          "targets": [{
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) by (version)"
          }]
        },
        {
          "title": "Latency P95",
          "type": "graph",
          "targets": [{
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, version))"
          }]
        },
        {
          "title": "Traffic Distribution",
          "type": "piechart",
          "targets": [{
            "expr": "sum(rate(http_requests_total[5m])) by (version)"
          }]
        }
      ]
    }
```

---

## Canary-Check Script

```bash
#!/bin/bash
# canary-check.sh

NAMESPACE="${1:-production}"
ROLLOUT="${2:-myapp}"

echo "🔍 Canary Status for: $ROLLOUT"

# Rollout Status
kubectl argo rollouts get rollout $ROLLOUT -n $NAMESPACE

echo ""
echo "📊 Canary Metrics:"

# Traffic Weight
kubectl get rollout $ROLLOUT -n $NAMESPACE -o jsonpath='{.status.canary.weight}'
echo "% traffic to canary"

# Pod Status
echo ""
echo "_Pods:"
kubectl get pods -n $NAMESPACE -l app=$ROLLOUT

# Recent Events
echo ""
echo "_Recent Events:"
kubectl get events -n $NAMESPACE --field-selector reason=Rollout --sort-by='.lastTimestamp' | tail -5
```

---

## Automatischer Rollback bei Alerts

```yaml
# Prometheus Alert mit Rollback
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: canary-rollback
  namespace: monitoring
spec:
  groups:
    - name: canary
      rules:
        - alert: CanaryHighErrorRate
          expr: |
            sum(rate(http_requests_total{version="canary",status=~"5.."}[5m])) 
            / 
            sum(rate(http_requests_total{version="canary"}[5m])) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Canary high error rate"
            description: "Canary error rate > 5%, triggering rollback"
          # Webhook kann Argo Rollouts API aufrufen
```

---

## Minimal-Workflow

```
1. Deploy neue Version (signed, verified)
   ↓
2. Argo Rollouts erstellt Canary (10% Traffic)
   ↓
3. 24h beobachten (automatisch via Analysis)
   ↓
4. Bei Problemen → Automatischer Rollback
   ↓
5. Bei Erfolg → Schrittweise Erhöhung auf 100%
```

---

## Vorteile

| Vorteil | Beschreibung |
|---------|--------------|
| Automatisch | Kein manueller Eingriff nötig |
| Sicher | Rollback ist immer bereit |
| Minimal | Eine YAML-Datei reicht |
| Observability | Integriertes Monitoring |

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Admission Enforcement | EK |
| Monitoring Alerts | EM |
| Go-Live Gate | EO |
| Day-2 Operations | EP |

---

*Block EL – Canary + Rollback (Minimal) – v1.0*
