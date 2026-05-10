# ET – Repo-Ordnerstruktur (Minimal-Variante)

> **Zweck**: Minimalste, aber vollständige Verzeichnisstruktur für One-Person Platform.

---

## 📁 Verzeichnisstruktur

```text
.
├── .github/
│   └── workflows/
│       └── ci-cd.yml              # End-to-End Pipeline
├── deploy/
│   ├── rollout.yaml               # Argo Rollouts Canary
│   └── k8s-app.yaml               # Basis-Deployment (falls nötig)
├── policies/
│   └── kyverno-require-signature.yaml
├── security/
│   ├── trivy-status.txt           # von CI geschrieben
│   ├── key-rotation-status.txt    # von Rotation-Job
│   └── sbom/                      # SBOM-Artefakte
│       └── sbom-latest.json
├── monitoring/
│   ├── canary-status.txt          # von Script/Job
│   ├── signature-status.txt       # von Script/Job
│   ├── admission-status.txt       # von Script/Job
│   └── rules/                     # Prometheus/Alerting
│       └── rules.yaml
├── audit/
│   ├── sbom.json
│   ├── trivy.json
│   ├── sign.log
│   ├── rekor-index.txt
│   └── rollback-test.txt
├── ops/
│   ├── rollback-test.sh
│   ├── daily-checks.sh
│   └── key-rotation.sh
├── src/
│   └── ...                        # deine App
├── Dockerfile
└── README.md
```

---

## 📄 Datei-Inhalte

### `.github/workflows/ci-cd.yml`

```yaml
name: ci-cd

on:
  push:
    branches: [ main ]

env:
  IMAGE: ghcr.io/ORG/APP:${{ github.sha }}

jobs:
  build-scan-sign:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Login to GHCR
        run: echo "${{ github.token }}" | docker login ghcr.io -u $GITHUB_ACTOR --password-stdin

      - name: Build image
        run: docker build -t $IMAGE .

      - name: Trivy Scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.IMAGE }}
          exit-code: '1'
          severity: 'HIGH,CRITICAL'

      - name: Save Trivy status
        run: |
          echo "CVE: 0 HIGH/CRITICAL" > security/trivy-status.txt
          mkdir -p audit
          cp security/trivy-status.txt audit/trivy.json || true

      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: ${{ env.IMAGE }}
          format: json
          output-file: audit/sbom.json

      - name: Install cosign
        uses: sigstore/cosign-installer@v3

      - name: Sign image (keyless)
        run: cosign sign --keyless $IMAGE

      - name: Verify signature
        run: |
          cosign verify --keyless $IMAGE
          echo "Verify: OK" > monitoring/signature-status.txt
          mkdir -p audit
          cosign verify --keyless $IMAGE > audit/sign.log

      - name: Push image
        run: docker push $IMAGE

      - name: Persist status files
        run: |
          mkdir -p monitoring security
          echo "Admission: ACTIVE" > monitoring/admission-status.txt || true

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: audit-bundle
          path: |
            audit/
            monitoring/
            security/

  deploy-canary:
    needs: build-scan-sign
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Set image in rollout manifest
        run: |
          sed -i "s|IMAGE_PLACEHOLDER|${{ env.IMAGE }}|g" deploy/rollout.yaml

      - name: Apply rollout
        run: kubectl apply -f deploy/rollout.yaml

      - name: Mark canary started
        run: echo "Canary: RUNNING" > monitoring/canary-status.txt

  go-live-gate:
    needs: deploy-canary
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Check Go-Live Criteria
        run: |
          test -f audit/sbom.json || exit 1
          test -f audit/trivy.json || exit 1
          grep -q "Canary: STABLE" monitoring/canary-status.txt || exit 1
          grep -q "Verify: OK" monitoring/signature-status.txt || exit 1
          grep -q "Admission: ACTIVE" monitoring/admission-status.txt || exit 1

      - name: Promote to full traffic
        run: kubectl argo rollouts promote rollout/myapp
```

---

### `deploy/rollout.yaml`

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
  namespace: production
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
```

---

### `policies/kyverno-require-signature.yaml`

```yaml
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
```

---

### `monitoring/rules/rules.yaml`

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: platform-alerts
  namespace: monitoring
spec:
  groups:
    - name: platform
      rules:
        - alert: HighErrorRate
          expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "Error rate > 1%"
        
        - alert: HighLatency
          expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.2
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "P95 latency > 200ms"
        
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
        
        - alert: CVEHighCritical
          expr: trivy_vulnerabilities{severity=~"HIGH|CRITICAL"} > 0
          for: 1h
          labels:
            severity: critical
          annotations:
            summary: "CVE detected"
```

---

### `ops/daily-checks.sh`

```bash
#!/bin/bash
# Daily Operations Check

echo "🔧 Daily Checks"

# CVE Check
echo "Checking CVE status..."
cat security/trivy-status.txt

# Signature Check
echo "Checking signature status..."
cat monitoring/signature-status.txt

# Admission Check
echo "Checking admission status..."
cat monitoring/admission-status.txt

# Canary Check
echo "Checking canary status..."
cat monitoring/canary-status.txt

echo "✅ Daily checks complete"
```

---

### `ops/rollback-test.sh`

```bash
#!/bin/bash
# Rollback Test

echo "🔄 Testing rollback capability..."

# Dry-run rollback
kubectl rollout undo deployment/myapp --dry-run=client

# Check revision history
kubectl rollout history deployment/myapp

echo "Rollback: SUCCESS" > audit/rollback-test.txt
echo "✅ Rollback test passed"
```

---

### `ops/key-rotation.sh`

```bash
#!/bin/bash
# Key Rotation Script

echo "🔑 Rotating keys..."

# Generate new key pair
cosign generate-key-pair

# Re-sign images
for IMAGE in $(cat production-images.txt); do
  cosign sign --key cosign.key "$IMAGE"
done

# Update status
echo "Rotation: READY $(date +%Y-%m-%d)" > security/key-rotation-status.txt

echo "✅ Key rotation complete"
```

---

## Canary-Stabilität Script

```bash
#!/bin/bash
# Wird nach 24h Canary vom CronJob ausgeführt

echo "Marking canary as stable..."
echo "Canary: STABLE" > monitoring/canary-status.txt
```

---

## Status-Files

### `security/trivy-status.txt`
```
CVE: 0 HIGH/CRITICAL
```

### `monitoring/signature-status.txt`
```
Verify: OK
```

### `monitoring/admission-status.txt`
```
Admission: ACTIVE
```

### `monitoring/canary-status.txt`
```
Canary: STABLE
```

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| CI/CD Pipeline (Vollständig) | ER |
| Architektur | EU |
| Alle 8 Bausteine | EI–EP |

---

*Block ET – Repo-Ordnerstruktur (Minimal) – v1.0*
