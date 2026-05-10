# EF – Automatisiertes Go-Live Gate (CI-Job)

> **Zweck**: CI/CD Job, der automatisch alle 10 Go-Live-Kriterien prüft und ein Pass/Fail-Ergebnis liefert.

---

## 🔄 Go-Live Gate – CI/CD Integration

### Übersicht

| Parameter | Wert |
|-----------|------|
| Trigger | Manuell / Vor Release |
| Dauer | ~5 Minuten |
| Output | Pass/Fail + Report |
| Speicherort | Artifacts |

---

## GitHub Actions Version

```yaml
name: Go-Live Gate

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target Environment'
        required: true
        default: 'production'
        type: choice
        options:
          - staging
          - production
      version:
        description: 'Version to validate'
        required: true

jobs:
  go-live-gate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: read
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Tools
        run: |
          # Install required tools
          curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin v0.48.0
          curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin v0.100.0
          curl -fsSL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 -o /usr/local/bin/cosign
          chmod +x /usr/local/bin/cosign

      - name: Initialize Results
        id: init
        run: |
          echo "passed=0" >> $GITHUB_OUTPUT
          echo "failed=0" >> $GITHUB_OUTPUT
          echo "total=10" >> $GITHUB_OUTPUT
          mkdir -p gate-results

      # Gate 1: Signatur-Chain stabil
      - name: Gate 1 - Signature Verification
        id: gate1
        run: |
          echo "🔍 Checking Gate 1: Signature Chain..."
          IMAGE="ghcr.io/${{ github.repository }}:${{ inputs.version }}"
          
          if cosign verify --keyless $IMAGE 2>/dev/null; then
            echo "✅ PASS: Signature verified"
            echo "gate1=PASS" >> gate-results/status.txt
            echo "passed=$((steps.init.outputs.passed + 1))" >> $GITHUB_OUTPUT
          else
            echo "❌ FAIL: Signature verification failed"
            echo "gate1=FAIL" >> gate-results/status.txt
            echo "failed=$((steps.init.outputs.failed + 1))" >> $GITHUB_OUTPUT
          fi

      # Gate 2: Security Scans
      - name: Gate 2 - Security Scans
        id: gate2
        run: |
          echo "🔍 Checking Gate 2: Security Scans..."
          IMAGE="ghcr.io/${{ github.repository }}:${{ inputs.version }}"
          
          # Run Trivy scan
          trivy image --severity HIGH,CRITICAL --exit-code 1 --format json --output gate-results/trivy.json $IMAGE
          
          CRITICAL=$(cat gate-results/trivy.json | jq '.Results[0].Vulnerabilities | map(select(.Severity=="CRITICAL")) | length')
          HIGH=$(cat gate-results/trivy.json | jq '.Results[0].Vulnerabilities | map(select(.Severity=="HIGH")) | length')
          
          if [ "$CRITICAL" -eq 0 ] && [ "$HIGH" -eq 0 ]; then
            echo "✅ PASS: No HIGH/CRITICAL vulnerabilities"
            echo "gate2=PASS" >> gate-results/status.txt
          else
            echo "❌ FAIL: Found $CRITICAL CRITICAL, $HIGH HIGH vulnerabilities"
            echo "gate2=FAIL" >> gate-results/status.txt
          fi

      # Gate 3: Admission Policy Check
      - name: Gate 3 - Admission Policy
        id: gate3
        run: |
          echo "🔍 Checking Gate 3: Admission Policies..."
          
          # Check if policies exist and are valid
          if kubectl get clusterpolicies -o yaml > gate-results/policies.yaml 2>/dev/null; then
            # Verify enforcement mode
            ENFORCE=$(grep -c "validationFailureAction: enforce" gate-results/policies.yaml || echo "0")
            if [ "$ENFORCE" -ge 3 ]; then
              echo "✅ PASS: Admission policies active and enforcing"
              echo "gate3=PASS" >> gate-results/status.txt
            else
              echo "❌ FAIL: Not enough enforcing policies ($ENFORCE/3)"
              echo "gate3=FAIL" >> gate-results/status.txt
            fi
          else
            echo "❌ FAIL: Cannot verify admission policies"
            echo "gate3=FAIL" >> gate-results/status.txt
          fi

      # Gate 4: Canary Stability
      - name: Gate 4 - Canary Stability
        id: gate4
        run: |
          echo "🔍 Checking Gate 4: Canary Stability..."
          
          # Check Canary duration (would normally query Flagger/Istio)
          CANARY_HOURS="${{ vars.CANARY_HOURS || '0' }}"
          
          if [ "$CANARY_HOURS" -ge 24 ]; then
            echo "✅ PASS: Canary stable for $CANARY_HOURS hours"
            echo "gate4=PASS" >> gate-results/status.txt
          else
            echo "❌ FAIL: Canary only $CANARY_HOURS hours (need 24-48h)"
            echo "gate4=FAIL" >> gate-results/status.txt
          fi

      # Gate 5: Rollback Test
      - name: Gate 5 - Rollback Test
        id: gate5
        run: |
          echo "🔍 Checking Gate 5: Rollback Capability..."
          
          if [ -f "audit/04_deployment/rollback-test.log" ]; then
            if grep -q "SUCCESS" audit/04_deployment/rollback-test.log; then
              echo "✅ PASS: Rollback test successful"
              echo "gate5=PASS" >> gate-results/status.txt
            else
              echo "❌ FAIL: Rollback test not successful"
              echo "gate5=FAIL" >> gate-results/status.txt
            fi
          else
            echo "❌ FAIL: No rollback test log found"
            echo "gate5=FAIL" >> gate-results/status.txt
          fi

      # Gate 6: Monitoring & Alerts
      - name: Gate 6 - Monitoring Setup
        id: gate6
        run: |
          echo "🔍 Checking Gate 6: Monitoring & Alerts..."
          
          REQUIRED_ALERTS=("DeploymentFailure" "SignatureVerifyFailed" "AdmissionDenial" "CVEBlocker")
          ALERTS_CONFIGURED=0
          
          for alert in "${REQUIRED_ALERTS[@]}"; do
            if grep -r "$alert" . --include="*.yaml" --include="*.yml" > /dev/null 2>&1; then
              ((ALERTS_CONFIGURED++))
            fi
          done
          
          if [ "$ALERTS_CONFIGURED" -ge 4 ]; then
            echo "✅ PASS: All required alerts configured ($ALERTS_CONFIGURED/4)"
            echo "gate6=PASS" >> gate-results/status.txt
          else
            echo "❌ FAIL: Missing alerts ($ALERTS_CONFIGURED/4)"
            echo "gate6=FAIL" >> gate-results/status.txt
          fi

      # Gate 7: Audit Bundle
      - name: Gate 7 - Audit Bundle
        id: gate7
        run: |
          echo "🔍 Checking Gate 7: Audit Bundle..."
          
          REQUIRED_FILES=(
            "audit/01_build/sbom.json"
            "audit/01_build/trivy.json"
            "audit/02_signing/sign.log"
            "audit/04_deployment/rollback-test.log"
          )
          
          FILES_PRESENT=0
          for file in "${REQUIRED_FILES[@]}"; do
            if [ -f "$file" ]; then
              ((FILES_PRESENT++))
            fi
          done
          
          if [ "$FILES_PRESENT" -eq 4 ]; then
            echo "✅ PASS: Audit bundle complete ($FILES_PRESENT/4)"
            echo "gate7=PASS" >> gate-results/status.txt
          else
            echo "❌ FAIL: Audit bundle incomplete ($FILES_PRESENT/4)"
            echo "gate7=FAIL" >> gate-results/status.txt
          fi

      # Gate 8: Key Rotation
      - name: Gate 8 - Key Rotation
        id: gate8
        run: |
          echo "🔍 Checking Gate 8: Key Rotation Prepared..."
          
          if [ -f "audit/05_governance/KEY_ROTATION.md" ]; then
            if grep -q "Emergency" audit/05_governance/KEY_ROTATION.md && \
               grep -q "90" audit/05_governance/KEY_ROTATION.md; then
              echo "✅ PASS: Key rotation runbook complete"
              echo "gate8=PASS" >> gate-results/status.txt
            else
              echo "❌ FAIL: Key rotation runbook incomplete"
              echo "gate8=FAIL" >> gate-results/status.txt
            fi
          else
            echo "❌ FAIL: Key rotation runbook missing"
            echo "gate8=FAIL" >> gate-results/status.txt
          fi

      # Gate 9: Documentation
      - name: Gate 9 - Documentation
        id: gate9
        run: |
          echo "🔍 Checking Gate 9: Documentation..."
          
          DOCS=(
            "CHANGELOG.md"
            "audit/05_governance/SECURITY_POLICY.md"
          )
          
          DOCS_PRESENT=0
          for doc in "${DOCS[@]}"; do
            if [ -f "$doc" ]; then
              ((DOCS_PRESENT++))
            fi
          done
          
          if [ "$DOCS_PRESENT" -eq 2 ]; then
            echo "✅ PASS: Documentation complete"
            echo "gate9=PASS" >> gate-results/status.txt
          else
            echo "❌ FAIL: Documentation incomplete"
            echo "gate9=FAIL" >> gate-results/status.txt
          fi

      # Gate 10: Go/No-Go Meeting
      - name: Gate 10 - Go/No-Go Approval
        id: gate10
        run: |
          echo "🔍 Checking Gate 10: Go/No-Go Meeting..."
          
          # This would normally check a ticket/issue for approvals
          # For automation, we check if a specific approval file exists
          if [ -f ".go-live-approved" ]; then
            echo "✅ PASS: Go/No-Go approval documented"
            echo "gate10=PASS" >> gate-results/status.txt
          else
            echo "❌ FAIL: No Go/No-Go approval found"
            echo "gate10=FAIL" >> gate-results/status.txt
            echo ""
            echo "⚠️  To approve, create file: .go-live-approved"
            echo "   Content: APPROVED_DATE=$(date)"
          fi

      # Generate Report
      - name: Generate Gate Report
        id: report
        run: |
          echo "# 🚦 Go-Live Gate Report" > gate-results/report.md
          echo "" >> gate-results/report.md
          echo "**Environment**: ${{ inputs.environment }}" >> gate-results/report.md
          echo "**Version**: ${{ inputs.version }}" >> gate-results/report.md
          echo "**Timestamp**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> gate-results/report.md
          echo "" >> gate-results/report.md
          echo "## Results" >> gate-results/report.md
          echo "" >> gate-results/report.md
          cat gate-results/status.txt >> gate-results/report.md
          echo "" >> gate-results/report.md
          
          PASSED=$(grep -c "PASS" gate-results/status.txt || echo "0")
          FAILED=$(grep -c "FAIL" gate-results/status.txt || echo "0")
          
          echo "## Summary" >> gate-results/report.md
          echo "" >> gate-results/report.md
          echo "- ✅ Passed: $PASSED/10" >> gate-results/report.md
          echo "- ❌ Failed: $FAILED/10" >> gate-results/report.md
          echo "" >> gate-results/report.md
          
          if [ "$FAILED" -eq 0 ]; then
            echo "### 🟢 GREEN LIGHT - GO-LIVE APPROVED" >> gate-results/report.md
            echo "passed=true" >> $GITHUB_OUTPUT
          else
            echo "### 🔴 RED LIGHT - GO-LIVE BLOCKED" >> gate-results/report.md
            echo "passed=false" >> $GITHUB_OUTPUT
          fi
          
          cat gate-results/report.md

      - name: Upload Gate Results
        uses: actions/upload-artifact@v4
        with:
          name: go-live-gate-results
          path: gate-results/

      - name: Check Gate Status
        run: |
          if [ "${{ steps.report.outputs.passed }}" == "true" ]; then
            echo "✅ All gates passed - Go-Live approved!"
            exit 0
          else
            echo "❌ Some gates failed - Go-Live blocked!"
            exit 1
          fi
```

---

## GitLab CI Version

```yaml
go-live-gate:
  stage: validate
  image: alpine:3.19
  variables:
    VERSION: $CI_COMMIT_TAG
    ENVIRONMENT: production
  before_script:
    - apk add --no-cache curl jq bash
    - curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
    - curl -fsSL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 -o /usr/local/bin/cosign
    - chmod +x /usr/local/bin/cosign
  script:
    - |
      echo "🚦 Running Go-Live Gate Checks..."
      mkdir -p gate-results
      PASSED=0
      FAILED=0
      
      # Gate 1: Signature
      if cosign verify --keyless $CI_REGISTRY_IMAGE:$VERSION 2>/dev/null; then
        echo "✅ Gate 1 PASS: Signature verified"
        echo "gate1=PASS" >> gate-results/status.txt
        ((PASSED++))
      else
        echo "❌ Gate 1 FAIL: Signature verification failed"
        echo "gate1=FAIL" >> gate-results/status.txt
        ((FAILED++))
      fi
      
      # Gate 2: Security Scans
      trivy image --severity HIGH,CRITICAL --exit-code 0 --format json --output gate-results/trivy.json $CI_REGISTRY_IMAGE:$VERSION
      CRITICAL=$(jq '.Results[0].Vulnerabilities | map(select(.Severity=="CRITICAL")) | length' gate-results/trivy.json)
      HIGH=$(jq '.Results[0].Vulnerabilities | map(select(.Severity=="HIGH")) | length' gate-results/trivy.json)
      
      if [ "$CRITICAL" -eq 0 ] && [ "$HIGH" -eq 0 ]; then
        echo "✅ Gate 2 PASS: No HIGH/CRITICAL vulnerabilities"
        echo "gate2=PASS" >> gate-results/status.txt
        ((PASSED++))
      else
        echo "❌ Gate 2 FAIL: Vulnerabilities found"
        echo "gate2=FAIL" >> gate-results/status.txt
        ((FAILED++))
      fi
      
      # Continue for all 10 gates...
      
      echo ""
      echo "📊 Go-Live Gate Summary"
      echo "======================="
      echo "✅ Passed: $PASSED/10"
      echo "❌ Failed: $FAILED/10"
      
      if [ "$FAILED" -eq 0 ]; then
        echo ""
        echo "🟢 GREEN LIGHT - GO-LIVE APPROVED"
        exit 0
      else
        echo ""
        echo "🔴 RED LIGHT - GO-LIVE BLOCKED"
        exit 1
      fi
  artifacts:
    paths:
      - gate-results/
    expire_in: 30 days
  rules:
    - if: $CI_COMMIT_TAG
      when: manual
    - when: never
```

---

## 📊 Gate Output Example

```
🚦 Go-Live Gate Report

Environment: production
Version: v2025.01.15-abc1234
Timestamp: 2025-01-15 14:30:00 UTC

## Results
gate1=PASS  ✅ Signatur-Chain stabil
gate2=PASS  ✅ Security Scans vollständig
gate3=PASS  ✅ Admission Enforcement aktiv
gate4=PASS  ✅ Canary stabil 24-48h
gate5=PASS  ✅ Rollback erfolgreich getestet
gate6=PASS  ✅ Monitoring & Alerts vollständig
gate7=PASS  ✅ Audit-Bundle vollständig
gate8=PASS  ✅ Key Rotation vorbereitet
gate9=PASS  ✅ Dokumentation vollständig
gate10=FAIL ❌ Go/No-Go Meeting abgeschlossen

## Summary
- ✅ Passed: 9/10
- ❌ Failed: 1/10

### 🔴 RED LIGHT - GO-LIVE BLOCKED

Action Required: Complete Go/No-Go Meeting and create .go-live-approved file
```

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Go-Live Checklist | EC |
| Green Light Dashboard | ED |
| Release-Approval | EE |
| CI Job Snippets | CQ |

---

*Block EF – Automatisiertes Go-Live Gate – v1.0*
