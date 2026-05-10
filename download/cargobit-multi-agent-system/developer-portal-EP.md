# EP – Day-2 Operations Runbook (Minimal)

> **Zweck**: Automatisierte Routine-Checks ohne Meetings. Alles per Script und CI.

---

## 📋 Day-2 Operations – Minimal-Architektur

### Prinzip

| Aspekt | Wert |
|--------|------|
| Meetings | 0 (keine) |
| Automatisierung | 100% |
| Checks | Täglich, wöchentlich, monatlich |
| Aufwand | Minimal |

---

## Automatisierte Checks

### Täglich (Automatisch)

| Check | Tool | Alert bei |
|-------|------|-----------|
| CVE-Check | Trivy | HIGH/CRITICAL |
| Signatur-Check | cosign | Missing/Invalid |
| Admission-Check | Kyverno | Denials |
| Canary-Check | Argo Rollouts | Regression |
| Rollback-Check | kubectl | Not ready |

### Wöchentlich

| Check | Tool | Alert bei |
|-------|------|-----------|
| SBOM-Drift | syft | New deps |
| Rekor-Index | cosign | Missing entries |
| Key-Status | kubectl | Expiring |

### Monatlich

| Check | Tool | Alert bei |
|-------|------|-----------|
| Pipeline Health | GitHub/GitLab | Failures |
| Dockerfile Review | trivy, hadolint | Issues |
| Secrets Rotation | kubectl | Stale |

### Quartalsweise

| Check | Tool | Alert bei |
|-------|------|-----------|
| Key Rotation | cosign | Due |
| Audit Prep | Scripts | Missing docs |

---

## GitHub Actions: Daily Checks

```yaml
name: Daily Operations Check

on:
  schedule:
    - cron: '0 6 * * *'  # Täglich 06:00 UTC
  workflow_dispatch:

jobs:
  daily-checks:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: read

    steps:
      - uses: actions/checkout@v4
      - uses: sigstore/cosign-installer@main
      - uses: aquasecurity/setup-trivy@v0.2.0

      - name: CVE Check
        run: |
          echo "🔍 Daily CVE Check"
          for IMAGE in $(cat production-images.txt); do
            trivy image --severity HIGH,CRITICAL --exit-code 0 --format json --output cve-$IMAGE.json "$IMAGE"
            CRITICAL=$(jq '[.Results[0].Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' cve-$IMAGE.json)
            HIGH=$(jq '[.Results[0].Vulnerabilities[]? | select(.Severity=="HIGH")] | length' cve-$IMAGE.json)
            if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
              echo "⚠️ $IMAGE: $CRITICAL CRITICAL, $HIGH HIGH"
            else
              echo "✅ $IMAGE: Clean"
            fi
          done

      - name: Signature Check
        run: |
          echo "🔍 Daily Signature Check"
          for IMAGE in $(cat production-images.txt); do
            if cosign verify --keyless "$IMAGE" 2>/dev/null; then
              echo "✅ $IMAGE: Signed"
            else
              echo "❌ $IMAGE: NOT SIGNED!"
            fi
          done

      - name: Create Summary
        run: |
          echo "# 📊 Daily Operations Report" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Date**: $(date -u +"%Y-%m-%d")" >> $GITHUB_STEP_SUMMARY
          echo "**Status**: All checks completed" >> $GITHUB_STEP_SUMMARY
```

---

## GitHub Actions: Weekly Checks

```yaml
name: Weekly Operations Check

on:
  schedule:
    - cron: '0 6 * * 1'  # Montag 06:00 UTC
  workflow_dispatch:

jobs:
  weekly-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anchore/sbom-action/download-syft@v0
      - uses: sigstore/cosign-installer@main

      - name: SBOM Drift Check
        run: |
          echo "🔍 SBOM Drift Check"
          # Compare current SBOM with baseline
          for IMAGE in $(cat production-images.txt); do
            syft "$IMAGE" -o spdx-json > current-sbom.json
            if [ -f "baseline-sbom-$IMAGE.json" ]; then
              if diff -q <(jq -S . current-sbom.json) <(jq -S . baseline-sbom-$IMAGE.json) >/dev/null; then
                echo "✅ $IMAGE: No drift"
              else
                echo "⚠️ $IMAGE: SBOM changed!"
              fi
            else
              cp current-sbom.json "baseline-sbom-$IMAGE.json"
              echo "📋 $IMAGE: Baseline created"
            fi
          done

      - name: Rekor Index Check
        run: |
          echo "🔍 Rekor Index Check"
          for IMAGE in $(cat production-images.txt); do
            ENTRY=$(cosign triangulate "$IMAGE" 2>/dev/null || echo "NOT_FOUND")
            if [ "$ENTRY" != "NOT_FOUND" ]; then
              echo "✅ $IMAGE: Rekor entry exists"
            else
              echo "❌ $IMAGE: No Rekor entry!"
            fi
          done
```

---

## Kubernetes CronJob: Daily Cluster Check

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-cluster-check
  namespace: operations
spec:
  schedule: "0 6 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: cluster-check-sa
          containers:
            - name: check
              image: bitnami/kubectl:latest
              command:
                - /bin/bash
                - -c
                - |
                  echo "📊 Daily Cluster Health Check"
                  echo "==============================="
                  
                  # Pod Status
                  echo "Pod Status:"
                  kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded | head -20
                  
                  # Admission Denials
                  echo ""
                  echo "Recent Admission Denials:"
                  kubectl logs -n kyverno -l app.kubernetes.io/component=admission-controller --tail=100 | grep -i denied | tail -10
                  
                  # Canary Status
                  echo ""
                  echo "Canary Status:"
                  kubectl argo rollouts list rollouts -A
                  
                  # Certificate Expiry
                  echo ""
                  echo "Certificates Expiring Soon:"
                  kubectl get certificates -A -o json | jq '.items[] | select(.status.notAfter < (now + 7*24*60*60 | todate)) | {name: .metadata.name, ns: .metadata.namespace, expires: .status.notAfter}'
                  
                  echo ""
                  echo "✅ Check Complete"
          restartPolicy: OnFailure
```

---

## All-in-One Check Script

```bash
#!/bin/bash
# day2-check.sh

echo "🔧 Day-2 Operations Check"
echo "========================="

PASS=0
FAIL=0

# 1. CVE Check
echo ""
echo "1️⃣ CVE Check"
for IMAGE in $(cat production-images.txt); do
  trivy image --severity HIGH,CRITICAL --exit-code 0 --quiet "$IMAGE"
  if [ $? -eq 0 ]; then
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
POLICIES=$(kubectl get clusterpolicies -o name | wc -l)
if [ "$POLICIES" -ge 3 ]; then
  echo "  ✅ $POLICIES policies active"
  ((PASS++))
else
  echo "  ❌ Only $POLICIES policies"
  ((FAIL++))
fi

# 4. Canary Status
echo ""
echo "4️⃣ Canary Status"
CANARY=$(kubectl argo rollouts get rollout myapp -o jsonpath='{.status.canary.weight}' 2>/dev/null || echo "N/A")
if [ "$CANARY" != "N/A" ]; then
  echo "  ✅ Canary weight: ${CANARY}%"
  ((PASS++))
else
  echo "  ❌ No canary status"
  ((FAIL++))
fi

# 5. Rollback Ready
echo ""
echo "5️⃣ Rollback Ready"
REVISIONS=$(kubectl rollout history deployment/myapp | wc -l)
if [ "$REVISIONS" -ge 2 ]; then
  echo "  ✅ $REVISIONS revisions available"
  ((PASS++))
else
  echo "  ❌ No rollback available"
  ((FAIL++))
fi

# Summary
echo ""
echo "========================="
echo "✅ Passed: $PASS"
echo "❌ Failed: $FAIL"

if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo "🟢 ALL SYSTEMS HEALTHY"
  exit 0
else
  echo ""
  echo "🔴 ISSUES DETECTED"
  exit 1
fi
```

---

## Operations Dashboard

```yaml
# Grafana Dashboard for Day-2
apiVersion: v1
kind: ConfigMap
metadata:
  name: day2-dashboard
  namespace: monitoring
data:
  dashboard.json: |
    {
      "title": "Day-2 Operations",
      "panels": [
        {
          "title": "CVE Status",
          "type": "stat",
          "targets": [{"expr": "sum(trivy_vulnerabilities{severity=~\"HIGH|CRITICAL\"}) or vector(0)"}]
        },
        {
          "title": "Signature Status",
          "type": "stat",
          "targets": [{"expr": "count(cosign_verify_success) or vector(0)"}]
        },
        {
          "title": "Admission Denials (24h)",
          "type": "stat",
          "targets": [{"expr": "increase(kyverno_admission_requests_total{allowed=\"false\"}[24h])"}]
        },
        {
          "title": "Canary Health",
          "type": "stat",
          "targets": [{"expr": "argo_rollouts_canary_weight"}]
        },
        {
          "title": "Last Key Rotation",
          "type": "stat",
          "targets": [{"expr": "time() - key_rotation_timestamp"}],
          "unit": "s"
        }
      ]
    }
```

---

## Operations Calendar

```
┌─────────────────────────────────────────────────────────┐
│                    OPERATIONS CALENDAR                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  DAILY (Automatisch, 06:00 UTC)                         │
│  ├── CVE Check                                          │
│  ├── Signature Check                                    │
│  ├── Admission Check                                    │
│  ├── Canary Check                                       │
│  └── Rollback Check                                     │
│                                                         │
│  WEEKLY (Montag, 06:00 UTC)                             │
│  ├── SBOM Drift Check                                   │
│  └── Rekor Index Check                                  │
│                                                         │
│  MONTHLY (1. des Monats, 06:00 UTC)                     │
│  ├── Pipeline Health                                    │
│  └── Dockerfile Review                                  │
│                                                         │
│  QUARTERLY (1. des Quartals, 06:00 UTC)                 │
│  └── Key Rotation                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Vorteile

| Vorteil | Beschreibung |
|---------|--------------|
| Keine Meetings | 100% automatisiert |
| Proaktiv | Probleme werden früh erkannt |
| Minimal | Ein Script/CI reicht |
| Audit-Ready | Logs für Compliance |

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Signatur-Chain | EI |
| Security Scans | EJ |
| Monitoring Alerts | EM |
| Go-Live Gate | EO |

---

*Block EP – Day-2 Operations (Minimal) – v1.0*
