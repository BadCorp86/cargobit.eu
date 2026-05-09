# EK – Automatisiertes Admission Enforcement (Minimal)

> **Zweck**: Cluster-Weite Policy, die unsignierte Images, falsche Digests und falsche Registries blockiert.

---

## 🚦 Admission Enforcement – Minimal-Architektur

### Prinzip

| Aspekt | Wert |
|--------|------|
| Tool | Kyverno |
| Modus | Enforce (Block) |
| Policies | 3 Minimal-Policies |
| Aufwand | 0 Wartung |

---

## Kyverno Installation

```bash
# Helm Install
helm repo add kyverno https://kyverno.github.io/kyverno/
helm install kyverno kyverno/kyverno -n kyverno --create-namespace

# Verify
kubectl get pods -n kyverno
```

---

## Policy 1: Signatur-Pflicht

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-signed-images
  annotations:
    policies.kyverno.io/title: Require Signed Images
    policies.kyverno.io/description: All images must be signed
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: enforce
  background: false
  rules:
    - name: verify-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
                - Deployment
                - StatefulSet
                - DaemonSet
                - Job
                - CronJob
      verifyImages:
        - imageReferences:
            - "ghcr.io/*"
          attestors:
            - entries:
                - keyless:
                    subject: "*"
                    issuer: "https://token.actions.githubusercontent.com"
          required: true
```

---

## Policy 2: Registry-Whitelist

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: allowed-registries
  annotations:
    policies.kyverno.io/title: Allowed Registries
    policies.kyverno.io/description: Only approved registries allowed
spec:
  validationFailureAction: enforce
  background: true
  rules:
    - name: validate-registry
      match:
        any:
          - resources:
              kinds:
                - Pod
                - Deployment
                - StatefulSet
                - DaemonSet
                - Job
                - CronJob
      validate:
        message: "Images must be from approved registries"
        foreach:
          - list: "request.object.spec.containers"
            pattern:
              image: "ghcr.io/* | docker.io/company/*"
          - list: "request.object.spec.initContainers"
            pattern:
              image: "ghcr.io/* | docker.io/company/*"
```

---

## Policy 3: Digest-Pflicht (Produktion)

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-image-digest
  annotations:
    policies.kyverno.io/title: Require Image Digest
    policies.kyverno.io/description: Production must use digests, not tags
spec:
  validationFailureAction: audit  # Start mit audit
  background: true
  rules:
    - name: require-digest
      match:
        any:
          - resources:
              kinds:
                - Deployment
                - StatefulSet
                - DaemonSet
              namespaces:
                - production
      validate:
        message: "Production deployments must use image digest (sha256)"
        pattern:
          spec:
            template:
              spec:
                containers:
                  - image: "*@sha256:*"
```

---

## Alle Policies als Bundle

```yaml
# admission-policies.yaml
# Eine Datei für alle 3 Policies

---
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-signed-images
spec:
  validationFailureAction: enforce
  background: false
  rules:
    - name: verify-signature
      match:
        any:
          - resources:
              kinds: [Pod, Deployment, StatefulSet, DaemonSet, Job, CronJob]
      verifyImages:
        - imageReferences: ["ghcr.io/*"]
          attestors:
            - entries:
                - keyless:
                    subject: "*"
                    issuer: "https://token.actions.githubusercontent.com"
          required: true
---
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: allowed-registries
spec:
  validationFailureAction: enforce
  background: true
  rules:
    - name: validate-registry
      match:
        any:
          - resources:
              kinds: [Pod, Deployment, StatefulSet, DaemonSet, Job, CronJob]
      validate:
        message: "Only ghcr.io/* allowed"
        foreach:
          - list: "request.object.spec.containers"
            pattern:
              image: "ghcr.io/*"
---
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-image-digest
spec:
  validationFailureAction: audit
  background: true
  rules:
    - name: require-digest
      match:
        any:
          - resources:
              kinds: [Deployment, StatefulSet, DaemonSet]
              namespaces: [production]
      validate:
        message: "Production requires digests"
        pattern:
          spec:
            template:
              spec:
                containers:
                  - image: "*@sha256:*"
```

---

## Test-Deployments

```bash
# Test 1: Unsigned image (sollte blockieren)
kubectl run test-unsigned --image=nginx:latest -n production
# Erwartet: Error from server: admission denied

# Test 2: Wrong registry (sollte blockieren)
kubectl run test-registry --image=docker.io/library/nginx:latest
# Erwartet: Error from server: admission denied

# Test 3: Valid signed image (sollte gehen)
kubectl run test-valid --image=ghcr.io/company/app@sha256:xxx
# Erwartet: Success
```

---

## Status-Check Script

```bash
#!/bin/bash
# check-admission.sh

echo "🔍 Checking Admission Policies..."

# Kyverno Status
kubectl get clusterpolicies -o custom-columns=NAME:.metadata.name,MODE:.spec.validationFailureAction

echo ""
echo "📊 Recent Denials:"
kubectl logs -n kyverno -l app.kubernetes.io/component=admission-controller --tail=50 | grep -i "denied" | tail -10

echo ""
echo "📈 Policy Statistics:"
kubectl get clusterpolicies -o json | jq '.items[] | {name: .metadata.name, ready: .status.ready}'
```

---

## Monitoring Integration

```yaml
# Prometheus Rule für Admission Denials
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: kyverno-alerts
  namespace: monitoring
spec:
  groups:
    - name: kyverno
      rules:
        - alert: KyvernoPolicyViolation
          expr: increase(kyverno_policy_results_total{result="fail"}[5m]) > 0
          for: 1m
          labels:
            severity: warning
          annotations:
            summary: "Kyverno policy violation detected"
            description: "{{ $labels.policy_name }} denied a request"

        - alert: KyvernoAdmissionDenial
          expr: increase(kyverno_admission_requests_total{allowed="false"}[5m]) > 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "Admission request denied"
            description: "A deployment was blocked by Kyverno"
```

---

## Vorteile

| Vorteil | Beschreibung |
|---------|--------------|
| Automatisch | Blockiert nicht-konforme Deployments |
| Audit-Ready | Logs für Compliance |
| Minimal | 3 Policies reichen |
| Kein Overhead | Kyverno verwaltet alles |

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Signatur-Chain | EI |
| Security Scans | EJ |
| Canary + Rollback | EL |
| Monitoring Alerts | EM |

---

*Block EK – Admission Enforcement (Minimal) – v1.0*
