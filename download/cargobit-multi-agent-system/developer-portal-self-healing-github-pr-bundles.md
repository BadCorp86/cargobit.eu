# Self-Healing GitHub PR Bundles

**Ziel:** Produktionsreife GitHub Pull Requests für Prometheus Rules, ArgoCD Hooks und Canary Rollout — bereit zum Merge.

---

## 1. Prometheus Recording Rules PR

### PR-Metadaten

| Feld | Wert |
|------|------|
| **Branch** | `ci/prometheus/proxy-health-rules` |
| **Commit Message** | `chore(prometheus): add proxy health recording rules (proxy:health_score)` |
| **Target Path** | `prometheus/recording_rules/proxy_health_rules.yaml` |

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

### PR Checklist

- [ ] Confirm metric names and labels (`partner`, `endpoint`, `region`) exist in instrumentation
- [ ] CI: run `promtool check rules` on this file
- [ ] Reviewer: SRE Lead, Observability Engineer
- [ ] Merge only after CI green and reviewer approval

---

## 2. ArgoCD PreSync Hook PR

### PR-Metadaten

| Feld | Wert |
|------|------|
| **Branch** | `ci/argocd/policy-sign-hook` |
| **Commit Message** | `chore(argocd): add PreSync policy sign-check hook job` |
| **Target Paths** | `argocd/hooks/policy-sign-check-hook.yaml`, `argocd/apps/tools-service-policies.yaml` |

### Files

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

### PR Checklist

- [ ] Add `governance-public-keys` ConfigMap and `git-ssh-key` Secret in `governance` namespace (RBAC restricted)
- [ ] CI: run YAML lint and validate Kubernetes schema
- [ ] Reviewer: Platform Security, GitOps Owner
- [ ] Merge only after hook image and keys are available

---

## 3. Canary Rollout and PostCheck PR

### PR-Metadaten

| Feld | Wert |
|------|------|
| **Branch** | `ci/argo-rollout/proxy-policy-canary` |
| **Commit Message** | `feat(governance): add proxy policy canary rollout and postcheck service` |
| **Target Paths** | `k8s/argo-rollout/proxy-policy-canary.yaml`, `k8s/argo-rollout/governance-postcheck.yaml` |

### Files

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

### PR Checklist

- [ ] Ensure `policy-operator` and `governance-postcheck` images exist or replace with internal images
- [ ] CI: YAML lint, Argo Rollout validation, and integration test in staging cluster
- [ ] Reviewer: SRE Lead, Governance Owner
- [ ] Merge only after staging Canary run with Red-Team smoke tests

---

## 4. Merge Sequence & Rollout Plan

```
┌─────────────────────────────────────────────────────────────────┐
│                    MERGE SEQUENCE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. PROMETHEUS RULES PR                                         │
│     └── Merge first → PostCheck has metrics available           │
│                                                                 │
│  2. ARGOCD HOOK PR                                              │
│     └── Merge second → Public keys and secrets provisioned      │
│                                                                 │
│  3. CANARY ROLLOUT PR                                           │
│     └── Merge third → Staging Canary with Red-Team tests        │
│     └── Then promote to production                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Merge Dependencies

| PR | Abhängigkeiten |
|----|----------------|
| **Prometheus Rules** | Keine — als erstes mergen |
| **ArgoCD Hook** | Secrets und ConfigMaps vorhanden |
| **Canary Rollout** | Prometheus Rules + ArgoCD Hook + Images |

---

## 5. PR Overview Table

| PR | Branch | Files | Reviewer |
|----|--------|-------|----------|
| **1** | `ci/prometheus/proxy-health-rules` | 1 YAML | SRE Lead, Observability Engineer |
| **2** | `ci/argocd/policy-sign-hook` | 2 YAMLs | Platform Security, GitOps Owner |
| **3** | `ci/argo-rollout/proxy-policy-canary` | 2 YAMLs | SRE Lead, Governance Owner |

---

## 6. Git Commands (Copy-Paste Ready)

### PR 1: Prometheus Rules

```bash
git checkout -b ci/prometheus/proxy-health-rules
# Create file: prometheus/recording_rules/proxy_health_rules.yaml
git add prometheus/recording_rules/proxy_health_rules.yaml
git commit -m "chore(prometheus): add proxy health recording rules (proxy:health_score)"
git push -u origin ci/prometheus/proxy-health-rules
# Create PR via GitHub UI or: gh pr create --title "Add proxy health recording rules" --body "See checklist in PR description"
```

### PR 2: ArgoCD Hook

```bash
git checkout -b ci/argocd/policy-sign-hook
# Create files: argocd/hooks/policy-sign-check-hook.yaml, argocd/apps/tools-service-policies.yaml
git add argocd/
git commit -m "chore(argocd): add PreSync policy sign-check hook job"
git push -u origin ci/argocd/policy-sign-hook
# Create PR via GitHub UI
```

### PR 3: Canary Rollout

```bash
git checkout -b ci/argo-rollout/proxy-policy-canary
# Create files: k8s/argo-rollout/proxy-policy-canary.yaml, k8s/argo-rollout/governance-postcheck.yaml
git add k8s/argo-rollout/
git commit -m "feat(governance): add proxy policy canary rollout and postcheck service"
git push -u origin ci/argo-rollout/proxy-policy-canary
# Create PR via GitHub UI
```

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
