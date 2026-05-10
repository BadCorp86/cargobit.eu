# EQ – Repo-Ordnerstruktur (One-Person Platform)

> **Zweck**: Komplette, produktionsbereite Verzeichnisstruktur für die minimale Plattform.

---

## 📁 Verzeichnisstruktur

```
governance-postcheck/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Build, Test, Sign, Scan
│       ├── go-live-gate.yml          # Go-Live Gate Check
│       ├── daily-checks.yml          # Day-2 Daily Operations
│       └── weekly-checks.yml         # Day-2 Weekly Operations
│
├── admission/
│   ├── kyverno/
│   │   ├── require-signature.yaml    # Signatur-Pflicht
│   │   ├── allowed-registries.yaml   # Registry-Whitelist
│   │   └── require-digest.yaml       # Digest-Pflicht (Production)
│   └── README.md
│
├── canary/
│   ├── rollout.yaml                  # Argo Rollouts Config
│   ├── analysis-template.yaml        # Analysis Template
│   └── README.md
│
├── monitoring/
│   ├── alerts/
│   │   ├── error-rate.yaml           # Error-Rate Alert
│   │   ├── latency.yaml              # Latency Alert
│   │   ├── admission-denials.yaml    # Admission Alert
│   │   ├── signature-failures.yaml   # Signature Alert
│   │   └── cve-detected.yaml         # CVE Alert
│   ├── dashboards/
│   │   └── platform-health.json      # Grafana Dashboard
│   └── prometheus/
│       └── rules.yaml                # Alle Prometheus Rules
│
├── key-rotation/
│   ├── cronjob.yaml                  # Key Rotation CronJob
│   ├── emergency-rotate.yaml         # Emergency Rotation
│   └── README.md
│
├── audit/
│   ├── 01_build/
│   │   ├── sbom.json                 # Wird von CI erzeugt
│   │   └── trivy.json                # Wird von CI erzeugt
│   ├── 02_signing/
│   │   └── sign.log                  # Wird von CI erzeugt
│   ├── 03_ci_cd/
│   ├── 04_deployment/
│   │   └── rollback-test.log
│   └── 05_governance/
│       └── KEY_ROTATION.md
│
├── scripts/
│   ├── check-signature.sh            # Signatur-Check
│   ├── security-check.sh             # CVE-Check
│   ├── canary-check.sh               # Canary-Status
│   ├── day2-check.sh                 # All-in-One Check
│   └── key-rotate.sh                 # Key Rotation
│
├── production-images.txt             # Liste aller Produktions-Images
├── .trivyignore                      # CVE-Ausnahmen
├── CHANGELOG.md
├── README.md
├── KEY_ROTATION.md
└── runbook.md
```

---

## 📄 Datei-Inhalte

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE: ghcr.io/${{ github.repository }}

jobs:
  build-sign-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write

    steps:
      - uses: actions/checkout@v4
      - uses: sigstore/cosign-installer@main
      - uses: aquasecurity/setup-trivy@v0.2.0
      - uses: anchore/sbom-action/download-syft@v0

      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build Image
        run: |
          docker build -t ${{ env.IMAGE }}:${{ github.sha }} .
          docker push ${{ env.IMAGE }}:${{ github.sha }}

      - name: Sign Image
        run: cosign sign --yes ${{ env.IMAGE }}@${{ github.sha }}

      - name: Verify Signature
        run: |
          cosign verify \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            --certificate-identity-regexp=".*" \
            ${{ env.IMAGE }}@${{ github.sha }}

      - name: Trivy Scan
        run: |
          trivy image \
            --severity HIGH,CRITICAL \
            --exit-code 1 \
            --format json \
            --output audit/01_build/trivy.json \
            ${{ env.IMAGE }}:${{ github.sha }}

      - name: Generate SBOM
        run: |
          syft ${{ env.IMAGE }}:${{ github.sha }} -o spdx-json > audit/01_build/sbom.json

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: audit-bundle
          path: audit/
```

---

### `admission/kyverno/require-signature.yaml`

```yaml
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
```

---

### `canary/rollout.yaml`

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
          image: ghcr.io/company/app:latest
          ports:
            - containerPort: 8080
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 24h }
        - setWeight: 50
        - pause: { duration: 2h }
```

---

### `monitoring/alerts/error-rate.yaml`

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
          annotations:
            summary: "Error rate > 1%"
            description: "HTTP 5xx error rate is {{ $value | humanizePercentage }}"
```

---

### `scripts/day2-check.sh`

```bash
#!/bin/bash
set -e

echo "🔧 Day-2 Operations Check"
echo "========================="

PASS=0
FAIL=0

# 1. CVE Check
echo ""
echo "1️⃣ CVE Check"
for IMAGE in $(cat production-images.txt); do
  if trivy image --severity HIGH,CRITICAL --quiet --exit-code 0 "$IMAGE" 2>/dev/null; then
    echo "  ✅ $IMAGE"
    ((PASS++))
  else
    echo "  ❌ $IMAGE"
    ((FAIL++))
  fi
done

# 2. Signature Check
echo ""
echo "2️⃣ Signature Check"
for IMAGE in $(cat production-images.txt); do
  if cosign verify --keyless "$IMAGE" 2>/dev/null; then
    echo "  ✅ $IMAGE"
    ((PASS++))
  else
    echo "  ❌ $IMAGE"
    ((FAIL++))
  fi
done

# 3. Admission Status
echo ""
echo "3️⃣ Admission Status"
POLICIES=$(kubectl get clusterpolicies -o name 2>/dev/null | wc -l || echo "0")
if [ "$POLICIES" -ge 3 ]; then
  echo "  ✅ $POLICIES policies active"
  ((PASS++))
else
  echo "  ❌ Only $POLICIES policies"
  ((FAIL++))
fi

# Summary
echo ""
echo "========================="
echo "✅ Passed: $PASS"
echo "❌ Failed: $FAIL"

[ "$FAIL" -eq 0 ] && echo "🟢 ALL SYSTEMS HEALTHY" || echo "🔴 ISSUES DETECTED"
exit $FAIL
```

---

### `production-images.txt`

```
ghcr.io/company/app:production
ghcr.io/company/api:production
ghcr.io/company/worker:production
```

---

### `README.md`

```markdown
# Governance Postcheck - One-Person Platform

Minimal-System für eine vollständig automatisierte, sichere Plattform.

## Schnellstart

1. **CI Pipeline**: `.github/workflows/ci.yml`
2. **Admission Policies**: `admission/kyverno/`
3. **Canary Setup**: `canary/rollout.yaml`
4. **Monitoring**: `monitoring/alerts/`
5. **Day-2 Checks**: `scripts/day2-check.sh`

## Architektur

Siehe Block ES für die vollständige Architekturübersicht.

## Guided Links

| Baustein | Block |
|----------|-------|
| Signatur-Chain | EI |
| Security Scans | EJ |
| Admission | EK |
| Canary | EL |
| Monitoring | EM |
| Key Rotation | EN |
| Go-Live Gate | EO |
| Day-2 Ops | EP |
```

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| End-to-End CI/CD Pipeline | ER |
| Architekturübersicht | ES |
| Alle 8 Bausteine | EI–EP |

---

*Block EQ – Repo-Ordnerstruktur – v1.0*
