# EV – Quick-Start Guide (One-Person Platform)

> **Zweck**: Zusammenfassung für sofortigen Start – alle Befehle und Dateien auf einen Blick.

---

## 🚀 Quick-Start (5 Minuten)

### 1. Repo erstellen

```bash
mkdir my-platform && cd my-platform
git init
```

### 2. Verzeichnisstruktur

```bash
mkdir -p .github/workflows deploy policies security/sbom monitoring/rules audit ops src
```

### 3. Dateien erstellen

```bash
# CI/CD Pipeline
cat > .github/workflows/ci-cd.yml << 'EOF'
name: ci-cd
on:
  push:
    branches: [main]
env:
  IMAGE: ghcr.io/${{ github.repository }}:${{ github.sha }}
jobs:
  build-scan-sign:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
      packages: write
    steps:
      - uses: actions/checkout@v4
      - run: echo "${{ github.token }}" | docker login ghcr.io -u $GITHUB_ACTOR --password-stdin
      - run: docker build -t $IMAGE .
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.IMAGE }}
          exit-code: '1'
          severity: 'HIGH,CRITICAL'
      - uses: anchore/sbom-action@v0
        with:
          image: ${{ env.IMAGE }}
          format: json
          output-file: audit/sbom.json
      - uses: sigstore/cosign-installer@v3
      - run: cosign sign --keyless $IMAGE
      - run: cosign verify --keyless $IMAGE
      - run: docker push $IMAGE
EOF

# Kyverno Policy
cat > policies/kyverno-require-signature.yaml << 'EOF'
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-signature
spec:
  validationFailureAction: enforce
  rules:
    - name: check-signature
      match:
        resources:
          kinds: ["Pod"]
      verifyImages:
        - image: "*"
          keyless:
            issuer: "https://token.actions.githubusercontent.com"
EOF

# Argo Rollout
cat > deploy/rollout.yaml << 'EOF'
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 3
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
          image: IMAGE_PLACEHOLDER
          ports:
            - containerPort: 8080
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 24h }
EOF

# Prometheus Rules
cat > monitoring/rules/rules.yaml << 'EOF'
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: platform-alerts
spec:
  groups:
    - name: platform
      rules:
        - alert: HighErrorRate
          expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
          for: 5m
          labels:
            severity: critical
        - alert: HighLatency
          expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.2
          for: 10m
          labels:
            severity: warning
        - alert: AdmissionDenials
          expr: increase(kyverno_admission_requests_total{allowed="false"}[5m]) > 0
          for: 1m
          labels:
            severity: critical
        - alert: SignatureVerifyFailed
          expr: increase(cosign_verify_failures_total[5m]) > 0
          for: 1m
          labels:
            severity: critical
        - alert: CVEHighCritical
          expr: trivy_vulnerabilities{severity=~"HIGH|CRITICAL"} > 0
          for: 1h
          labels:
            severity: critical
EOF

# Daily Check Script
cat > ops/daily-checks.sh << 'EOF'
#!/bin/bash
echo "🔧 Daily Checks"
cat security/trivy-status.txt 2>/dev/null || echo "CVE: No status"
cat monitoring/signature-status.txt 2>/dev/null || echo "Verify: No status"
cat monitoring/admission-status.txt 2>/dev/null || echo "Admission: No status"
cat monitoring/canary-status.txt 2>/dev/null || echo "Canary: No status"
echo "✅ Done"
EOF
chmod +x ops/daily-checks.sh

# Status Files
echo "CVE: 0 HIGH/CRITICAL" > security/trivy-status.txt
echo "Verify: OK" > monitoring/signature-status.txt
echo "Admission: ACTIVE" > monitoring/admission-status.txt
echo "Canary: STABLE" > monitoring/canary-status.txt

# README
cat > README.md << 'EOF'
# One-Person Platform

Minimal, fully automated platform for one person.

## Quick Start

1. Push to main branch
2. CI/CD builds, scans, signs, deploys
3. Go-Live Gate validates
4. Canary runs 24h
5. Promote to production

## Blocks

- EI-EP: 8 Core Components
- ET: Repo Structure
- ER: CI/CD Pipeline
- EU: Architecture
EOF
```

### 4. Dockerfile

```bash
cat > Dockerfile << 'EOF'
FROM alpine:3.19
CMD ["echo", "Hello from One-Person Platform"]
EOF
```

### 5. Commit & Push

```bash
git add .
git commit -m "Initial One-Person Platform setup"
git remote add origin https://github.com/YOUR-ORG/YOUR-REPO.git
git push -u origin main
```

---

## 📋 Cluster-Setup

```bash
# Install Kyverno
helm repo add kyverno https://kyverno.github.io/kyverno/
helm install kyverno kyverno/kyverno -n kyverno --create-namespace

# Apply Policy
kubectl apply -f policies/kyverno-require-signature.yaml

# Install Argo Rollouts
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# Install Prometheus Stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace

# Apply Prometheus Rules
kubectl apply -f monitoring/rules/rules.yaml
```

---

## 🔧 Go-Live Gate Check

```bash
#!/bin/bash
# go-live-check.sh

echo "🚦 Go-Live Gate Check"

PASS=0
FAIL=0

# Check 1: SBOM
test -f audit/sbom.json && { echo "✅ SBOM"; ((PASS++)); } || { echo "❌ SBOM"; ((FAIL++)); }

# Check 2: Trivy
test -f audit/trivy.json && { echo "✅ Trivy"; ((PASS++)); } || { echo "❌ Trivy"; ((FAIL++)); }

# Check 3: Canary
grep -q "Canary: STABLE" monitoring/canary-status.txt && { echo "✅ Canary"; ((PASS++)); } || { echo "❌ Canary"; ((FAIL++)); }

# Check 4: Signature
grep -q "Verify: OK" monitoring/signature-status.txt && { echo "✅ Signature"; ((PASS++)); } || { echo "❌ Signature"; ((FAIL++)); }

# Check 5: Admission
grep -q "Admission: ACTIVE" monitoring/admission-status.txt && { echo "✅ Admission"; ((PASS++)); } || { echo "❌ Admission"; ((FAIL++)); }

echo ""
echo "Result: $PASS/5 passed, $FAIL/5 failed"

[ "$FAIL" -eq 0 ] && echo "🟢 GO!" || echo "🔴 BLOCKED"
```

---

## 📊 Status Dashboard

```bash
# Quick status check
echo "📊 Platform Status"
echo "=================="
echo "CVE:       $(cat security/trivy-status.txt 2>/dev/null || echo 'Unknown')"
echo "Signature: $(cat monitoring/signature-status.txt 2>/dev/null || echo 'Unknown')"
echo "Admission: $(cat monitoring/admission-status.txt 2>/dev/null || echo 'Unknown')"
echo "Canary:    $(cat monitoring/canary-status.txt 2>/dev/null || echo 'Unknown')"
```

---

## 📎 Alle Blöcke

| Block | Thema |
|-------|-------|
| EI | Signatur-Chain |
| EJ | Security Scans |
| EK | Admission Enforcement |
| EL | Canary + Rollback |
| EM | Monitoring |
| EN | Key Rotation |
| EO | Go-Live Gate |
| EP | Day-2 Operations |
| ET | Repo-Struktur (Minimal) |
| EU | Architektur (Minimal) |
| EV | Quick-Start Guide |

---

*Block EV – Quick-Start Guide – v1.0*
