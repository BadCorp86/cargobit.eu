# Self-Healing Complete Implementation Package

**Ziel:** Drei PR-fertige Bundles, vollständiges ArgoCD Manifest, Starter-Repo für PostCheck Service und Implementierungs-To-Do-Liste.

---

## 1. PR Bundle 1 — Prometheus Recording Rules

### PR-Metadaten

| Feld | Wert |
|------|------|
| **Branch** | `ci/prometheus/proxy-health-rules` |
| **Commit Message** | `chore(prometheus): add proxy health recording rules (proxy:health_score)` |
| **Zielpfad** | `prometheus/recording_rules/proxy_health_rules.yaml` |

### File

```yaml
# prometheus/recording_rules/proxy_health_rules.yaml
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
```

### PR Beschreibung

Fügt Recording Rules für Proxy-Engine Subscores und `proxy:health_score` hinzu. Voraussetzung: Instrumentation liefert Labels `partner`, `endpoint`, `region`. CI: `promtool check rules`.

### Reviewer Checklist

- [ ] Metriknamen und Labels (`partner`, `endpoint`, `region`) bestätigt
- [ ] `promtool check rules` läuft lokal/CI grün
- [ ] Observability Engineer und SRE Lead als Reviewer

---

## 2. PR Bundle 2 — ArgoCD PreSync Hook

### PR-Metadaten

| Feld | Wert |
|------|------|
| **Branch** | `ci/argocd/policy-sign-hook` |
| **Commit Message** | `chore(argocd): add PreSync policy sign-check hook job` |
| **Zielpfade** | `argocd/hooks/policy-sign-check-hook.yaml`, `argocd/apps/tools-service-policies.yaml` |

### Hook Job File

```yaml
# argocd/hooks/policy-sign-check-hook.yaml
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

### ArgoCD App Manifest

```yaml
# argocd/apps/tools-service-policies.yaml
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

### PR Beschreibung

Fügt PreSync Hook hinzu, der Policies auf Signatur prüft. Merge nur wenn `governance-public-keys` ConfigMap und `git-ssh-key` Secret vorhanden sind.

### Reviewer Checklist

- [ ] Public keys ConfigMap und SSH Secret vorhanden oder PR für deren Erstellung beigefügt
- [ ] GitOps Owner und Platform Security als Reviewer
- [ ] Hook Image (`gov-sign-checker`) verfügbar in Registry

---

## 3. PR Bundle 3 — Canary Rollout und PostCheck Service

### PR-Metadaten

| Feld | Wert |
|------|------|
| **Branch** | `ci/argo-rollout/proxy-policy-canary` |
| **Commit Message** | `feat(governance): add proxy policy canary rollout and postcheck service` |
| **Zielpfade** | `k8s/argo-rollout/proxy-policy-canary.yaml`, `k8s/argo-rollout/governance-postcheck.yaml` |

### Rollout File

```yaml
# k8s/argo-rollout/proxy-policy-canary.yaml
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

### PostCheck Service File

```yaml
# k8s/argo-rollout/governance-postcheck.yaml
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

### PR Beschreibung

Fügt Canary Rollout für Policy-Operator und PostCheck Service hinzu. PostCheck validiert `proxy:health_score` für Canary Slice und entscheidet über Promotion oder Rollback.

### Reviewer Checklist

- [ ] `policy-operator` und `governance-postcheck` Images vorhanden
- [ ] Staging Canary Testplan angehängt
- [ ] SRE Lead und Governance Owner als Reviewer

---

## 4. ArgoCD Root Application Manifest

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: governance-root
  namespace: argocd
spec:
  project: governance
  source:
    repoURL: 'git@github.com:cargobit/governance.git'
    path: '.'
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: governance
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

**Hinweis:** ArgoCD ServiceAccount `argocd` benötigt RBAC-Rechte für Namespaces, Jobs und Rollouts.

---

## 5. Starter Repo für governance-postcheck

### Repo Struktur

```
governance-postcheck/
├─ Dockerfile
├─ README.md
├─ app/
│  ├─ main.py
│  ├─ postcheck.py
│  └─ requirements.txt
├─ k8s/
│  └─ deployment.yaml
└─ tests/
   └─ test_postcheck.py
```

### app/main.py

```python
from flask import Flask, request, jsonify
from postcheck import evaluate_health_slice

app = Flask(__name__)

@app.route("/postcheck", methods=["POST"])
def postcheck():
    payload = request.get_json() or {}
    partner = payload.get("partner")
    endpoint = payload.get("endpoint")
    region = payload.get("region")
    slice_label = payload.get("slice", "canary")
    required_health = int(payload.get("required_health", 85))
    window = int(payload.get("window", 300))
    result = evaluate_health_slice(partner, endpoint, region, required_health, window)
    status = 200 if result["pass"] else 412
    return jsonify(result), status

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8443)
```

### app/postcheck.py

```python
import os
import requests
import time

PROM_URL = os.getenv("PROM_URL", "http://prometheus.monitoring.svc:9090")

def query_prometheus(query):
    resp = requests.get(f"{PROM_URL}/api/v1/query", params={"query": query}, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data

def evaluate_health_slice(partner, endpoint, region, required_health, window_seconds):
    # PromQL: proxy:health_score{partner="X",endpoint="Y",region="Z"}
    label_filters = []
    if partner:
        label_filters.append(f'partner="{partner}"')
    if endpoint:
        label_filters.append(f'endpoint="{endpoint}"')
    if region:
        label_filters.append(f'region="{region}"')
    labels = "{" + ",".join(label_filters) + "}" if label_filters else ""
    promql = f'avg_over_time(proxy:health_score{labels}[{window_seconds}s])'
    try:
        data = query_prometheus(promql)
        value = float(data["data"]["result"][0]["value"][1]) if data["data"]["result"] else 0.0
    except Exception as e:
        return {"pass": False, "reason": f"prometheus_error: {str(e)}", "value": None}
    passed = value >= required_health
    return {"pass": passed, "value": value, "required": required_health}
```

### app/requirements.txt

```
Flask==2.2.5
requests==2.31.0
```

### Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app /app
ENV FLASK_ENV=production
EXPOSE 8443
CMD ["python", "main.py"]
```

### README.md (Kurz)

- **Zweck:** Minimaler PostCheck Service, der Prometheus abfragt und Pass/Fail für Canary PostChecks liefert
- **Build:** `docker build -t registry.example.com/governance-postcheck:latest .`
- **Run:** `docker run -e PROM_URL=http://prometheus:9090 -p 8443:8443 registry.example.com/governance-postcheck:latest`
- **Endpoint:** `POST /postcheck` JSON `{ "partner":"p", "endpoint":"e", "region":"r", "required_health":85, "window":300 }`

---

## 6. Implementierungs-To-Do-Liste

### A. Infrastruktur und Artefakte

| Aufgabe | Artefakte | Owner | Aufwand |
|---------|-----------|-------|---------|
| **Images bauen und veröffentlichen** | `gov-sign-checker`, `policy-operator`, `governance-postcheck` | Platform/CI Team | 1–2 Tage |
| **Kubernetes Secrets und ConfigMaps** | `git-ssh-key` Secret, `governance-public-keys` ConfigMap, RBAC | SRE / Platform | 0.5–1 Tag |
| **Prometheus Instrumentation** | Labels `partner`, `endpoint`, `region` sicherstellen | Entwickler / Observability | 1–3 Tage |

### B. CI / GitOps

| Aufgabe | Beschreibung | Owner | Aufwand |
|---------|--------------|-------|---------|
| **CI Checks** | `promtool check rules`, YAML Lint, Kubernetes schema validation | CI Owner / SRE | 1 Tag |
| **ArgoCD Hook Test** | PreSync Hook in Staging testen, Fehlerpfade prüfen | GitOps Owner | 0.5–1 Tag |

### C. Testing und Hardening

| Aufgabe | Beschreibung | Owner | Aufwand |
|---------|--------------|-------|---------|
| **Staging Canary Runs** | Fuzzer-Smoke, Red-Team Smoke Tests, Open-Proxy Checks | Security / SRE | 2–5 Tage |
| **Observability Dashboards** | Subscores, Health Score, Canary Slices, Governance Events | Observability Engineer / DX | 1–2 Tage |

### D. Governance und Compliance

| Aufgabe | Beschreibung | Owner | Aufwand |
|---------|--------------|-------|---------|
| **Signatur Key Management** | Key-Rotation Policy, sichere Speicherung, Zugriffskontrolle | Security / Compliance | 1–2 Tage |
| **Audit Pipeline** | Signed events → secure storage, Retention 365 Tage | Compliance / SRE | 1–2 Tage |

---

## 7. Gesamt-Aufwandsschätzung

| Kategorie | Aufwand |
|-----------|---------|
| **Infrastruktur** | 2.5–6 Tage |
| **CI/GitOps** | 1.5–2 Tage |
| **Testing** | 3–7 Tage |
| **Governance** | 2–4 Tage |
| **Gesamt** | **9–19 Tage** |

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
