# Self-Healing Implementation — Prometheus, ArgoCD & Canary Templates

**Ziel:** Produktionsreife Implementierungsartefakte für Self-Healing System — Recording Rules, Policy Signature Check, Canary Rollout.

---

## 1. Prometheus Recording Rules

**Pfad:** `prometheus/recording_rules/proxy_health_rules.yaml`

**Hinweise:** Metric-Namen an Instrumentation anpassen; `partner`, `endpoint`, `region` Labels müssen vorhanden sein.

```yaml
groups:
- name: proxy_engine_health.rules
  rules:
  # Raw Metrics
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
  
  # Normalized Scores (0-100)
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
  
  # Final Health Score
  - record: proxy:health_score
    expr: |
      0.25 * proxy:latency_score
      + 0.35 * proxy:error_score
      + 0.20 * proxy:success_score
      + 0.10 * proxy:resource_score
      + 0.10 * proxy:anomaly_score
```

### Recording Rules Übersicht

| Rule | Typ | Beschreibung |
|------|-----|--------------|
| `proxy:latency_p95_ms` | Raw | P95 Latenz in Millisekunden |
| `proxy:error_rate_pct` | Raw | Fehlerrate in Prozent |
| `proxy:success_ratio_pct` | Raw | Erfolgsquote in Prozent |
| `proxy:cpu_usage_pct` | Raw | CPU-Auslastung in Prozent |
| `proxy:anomaly_indicator` | Raw | Anomalie-Flag (0-1) |
| `proxy:latency_score` | Normalized | 0-100, optimal bei ≤35ms |
| `proxy:error_score` | Normalized | 0-100, optimal bei ≤0.5% |
| `proxy:success_score` | Normalized | 0-100, optimal bei ≥99.5% |
| `proxy:resource_score` | Normalized | 0-100, optimal bei <60% CPU |
| `proxy:anomaly_score` | Normalized | 0-100, optimal bei 0 Anomalien |
| `proxy:health_score` | Final | Gewichteter Gesamt-Score |

---

## 2. ArgoCD PreSync Hook für Policy Signature Check

**Pfad:** `argocd/hooks/policy-sign-check-hook.yaml`

**Hinweise:** Repo-URL und Image anpassen; Public Keys und SSH Secret mounten.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: policy-sign-check
  namespace: governance
spec:
  template:
    spec:
      serviceAccountName: governance-hook
      containers:
      - name: sign-checker
        image: ghcr.io/cargobit/gov-sign-checker:stable
        env:
        - name: GIT_REPO
          value: "git@github.com:cargobit/governance.git"
        - name: POLICY_PATH
          value: "containment/"
        - name: PUBLIC_KEYS_PATH
          value: "/etc/gov/keys"
        - name: ARGOCD_APP_NAME
          value: "tools-service-policies"
        volumeMounts:
        - name: ssh-key
          mountPath: /root/.ssh
          readOnly: true
        - name: public-keys
          mountPath: /etc/gov/keys
          readOnly: true
      restartPolicy: Never
      volumes:
      - name: ssh-key
        secret:
          secretName: git-ssh-key
      - name: public-keys
        configMap:
          name: governance-public-keys
  backoffLimit: 1
```

### ArgoCD Application Manifest

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: tools-service-policies
  namespace: argocd
spec:
  project: governance
  source:
    repoURL: 'git@github.com:cargobit/governance.git'
    path: 'containment'
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: governance
  syncPolicy:
    automated:
      prune: false
      selfHeal: false
    syncOptions:
      - CreateNamespace=true
  hooks:
    - name: policy-sign-check
      kind: Job
      hook: PreSync
      path: argocd/hooks/policy-sign-check-hook.yaml
```

---

## 3. Canary Rollout und PostCheck Service

### Canary Rollout

**Pfad:** `k8s/argo-rollout/proxy-policy-canary.yaml`

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: proxy-policy-canary
  namespace: proxy-control
spec:
  replicas: 3
  strategy:
    canary:
      steps:
      - setWeight: 1
        pause:
          duration: 300s
      - setWeight: 10
        pause:
          duration: 300s
      - setWeight: 50
        pause:
          duration: 300s
      - setWeight: 100
  template:
    metadata:
      labels:
        app: proxy-policy-apply
    spec:
      serviceAccountName: governance-operator
      containers:
      - name: policy-operator
        image: ghcr.io/cargobit/policy-operator:stable
        args:
        - "--policy=governance/containment/advanced-containment-and-repair.yaml"
        - "--canary-slice=1"
        - "--postcheck-endpoint=https://governance-api.governance.svc.cluster.local/postcheck"
        - "--postcheck-timeout=300"
        - "--audit-endpoint=https://audit.cargobit.internal/events"
        env:
        - name: REGION
          valueFrom:
            fieldRef:
              fieldPath: metadata.labels['region']
        - name: CORRELATION_ID
          value: ""
```

### PostCheck Service

**Pfad:** `k8s/argo-rollout/governance-postcheck.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: governance-api
  namespace: governance
spec:
  ports:
  - port: 443
    targetPort: 8443
  selector:
    app: governance-api
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: governance-api
  namespace: governance
spec:
  replicas: 2
  selector:
    matchLabels:
      app: governance-api
  template:
    metadata:
      labels:
        app: governance-api
    spec:
      containers:
      - name: postcheck
        image: ghcr.io/cargobit/governance-postcheck:stable
        ports:
        - containerPort: 8443
        env:
        - name: PROM_URL
          value: "http://prometheus.monitoring.svc:9090"
        - name: REQUIRED_HEALTH
          value: "85"
        - name: POSTCHECK_WINDOW
          value: "300"
```

### PostCheck Verhalten

| Schritt | Aktion |
|---------|--------|
| 1 | `policy-operator` wendet Actions nur auf Canary Slice an |
| 2 | `governance-postcheck` fragt Prometheus nach `proxy:health_score` |
| 3 | Bei Fail → automatischer Rollback + signierter Audit Event |
| 4 | Bei Success → Rollout fährt fort zum nächsten Step |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│              SELF-HEALING IMPLEMENTATION ARCHITECTURE            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  GOVERNANCE REPO │                                            │
│  │  (Git)           │                                            │
│  │  ├── policies/   │                                            │
│  │  └── signatures/ │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   ARGOCD        │───▶│  PRESYNC HOOK   │                     │
│  │   APPLICATION   │    │  (Sign Check)   │                     │
│  └────────┬────────┘    └─────────────────┘                     │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  CANARY ROLLOUT │◀──▶│  POSTCHECK SVC  │                     │
│  │  (Policy Apply) │    │  (Health Check) │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
│           │                      │                               │
│           ▼                      ▼                               │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   PROXY ENGINE  │    │   PROMETHEUS    │                     │
│  │   (Runtime)     │    │   (Metrics)     │                     │
│  └─────────────────┘    └─────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Checklist

### Vor Merge der PRs

| Check | Beschreibung |
|-------|--------------|
| **Metric Names** | An Instrumentation anpassen |
| **Labels** | `partner`, `endpoint`, `region` sicherstellen |
| **SSH Key Secret** | `git-ssh-key` in Namespace `governance` |
| **Public Keys ConfigMap** | `governance-public-keys` erstellen |
| **Images** | `gov-sign-checker`, `policy-operator`, `governance-postcheck` bauen oder bereitstellen |
| **CI Linting** | YAML und Prometheus Rule Syntax validieren |
| **Staging Test** | Canary mit Red Team Tests und Fuzzing |
| **Dashboards** | `proxy:health_score`, Canary Slices, Governance Events |

### Secrets und ConfigMaps

```yaml
# k8s/secrets/git-ssh-key.yaml
apiVersion: v1
kind: Secret
metadata:
  name: git-ssh-key
  namespace: governance
type: Opaque
data:
  id_rsa: <base64-encoded-private-key>
  known_hosts: <base64-encoded-known-hosts>
---
# k8s/configmaps/governance-public-keys.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: governance-public-keys
  namespace: governance
data:
  policy_signing_key.pub: |
    <public-key-content>
```

---

## 6. Canary Rollout Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CANARY ROLLOUT FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1% TRAFFIC (300s)                                              │
│  └── PostCheck: H >= 85? ──[YES]──▶ 10% TRAFFIC                │
│                          └──[NO]──▶ ROLLBACK                    │
│                                                                 │
│  10% TRAFFIC (300s)                                             │
│  └── PostCheck: H >= 85? ──[YES]──▶ 50% TRAFFIC                │
│                          └──[NO]──▶ ROLLBACK                    │
│                                                                 │
│  50% TRAFFIC (300s)                                             │
│  └── PostCheck: H >= 85? ──[YES]──▶ 100% TRAFFIC               │
│                          └──[NO]──▶ ROLLBACK                    │
│                                                                 │
│  100% TRAFFIC                                                   │
│  └── Finalize: Audit Event + Signed Commit                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Erforderliche Container Images

| Image | Zweck |
|-------|-------|
| `gov-sign-checker` | Validiert Policy-Signaturen vor Sync |
| `policy-operator` | Wendet Policies auf Canary Slice an |
| `governance-postcheck` | Prüft Health Score via Prometheus |

### Minimal PostCheck Endpoint (Pseudocode)

```python
# governance-postcheck/app.py
from flask import Flask, jsonify
import requests
import os

app = Flask(__name__)

PROM_URL = os.getenv("PROM_URL", "http://prometheus:9090")
REQUIRED_HEALTH = int(os.getenv("REQUIRED_HEALTH", "85"))

@app.route("/postcheck", methods=["POST"])
def postcheck():
    # Query Prometheus for health score
    query = 'avg(proxy:health_score{canary="true"})'
    resp = requests.get(f"{PROM_URL}/api/v1/query", params={"query": query})
    result = resp.json()["data"]["result"]
    
    if not result:
        return jsonify({"status": "fail", "reason": "no data"}), 400
    
    health_score = float(result[0]["value"][1])
    
    if health_score >= REQUIRED_HEALTH:
        return jsonify({"status": "pass", "health_score": health_score}), 200
    else:
        return jsonify({"status": "fail", "health_score": health_score}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8443, ssl_context="adhoc")
```

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
