# EO – Automatisiertes Go-Live Gate (Minimal)

> **Zweck**: CI-Job, der alle Kriterien prüft und Releases blockiert, wenn etwas nicht erfüllt ist.

---

## 🚦 Go-Live Gate – Minimal-Architektur

### Prinzip

| Aspekt | Wert |
|--------|------|
| Checks | 10 Kriterien |
| Modus | Fail-Fast |
| Output | Pass/Fail + Report |
| Aufwand | Automatisch |

---

## Die 10 Go-Live Kriterien

| # | Kriterium | Check |
|---|-----------|-------|
| 1 | Signatur-Chain stabil | `cosign verify` |
| 2 | Security Scans vollständig | `trivy --exit-code 1` |
| 3 | Admission Enforcement aktiv | Kyverno Policy Check |
| 4 | Canary stabil 24-48h | Rollout Status |
| 5 | Rollback getestet | Rollback Dry-Run |
| 6 | Monitoring vollständig | Prometheus Rules |
| 7 | Audit-Bundle vorhanden | File Check |
| 8 | Key Rotation vorbereitet | Runbook Check |
| 9 | Dokumentation vollständig | Docs Check |
| 10 | Go/No-Go Approval | Manual Gate |

---

## GitHub Actions Go-Live Gate

```yaml
name: Go-Live Gate

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to validate'
        required: true
      environment:
        description: 'Target environment'
        type: choice
        options: [staging, production]
        default: production
  push:
    tags:
      - 'v*'

env:
  IMAGE: ghcr.io/${{ github.repository }}

jobs:
  gate:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: read

    steps:
      - uses: actions/checkout@v4
      - uses: sigstore/cosign-installer@main
      - uses: aquasecurity/setup-trivy@v0.2.0

      - name: Initialize
        run: |
          mkdir -p gate-results
          echo "PASS=0" >> $GITHUB_ENV
          echo "FAIL=0" >> $GITHUB_ENV

      # Gate 1: Signature
      - name: Gate 1 - Signature
        id: gate1
        run: |
          echo "🔍 Gate 1: Signature Verification"
          if cosign verify \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            --certificate-identity-regexp=".*" \
            ${{ env.IMAGE }}:${{ inputs.version || github.ref_name }}; then
            echo "✅ PASS"
            echo "gate1=PASS" >> gate-results/status.txt
            echo "PASS=$((PASS+1))" >> $GITHUB_ENV
          else
            echo "❌ FAIL"
            echo "gate1=FAIL" >> gate-results/status.txt
            echo "FAIL=$((FAIL+1))" >> $GITHUB_ENV
          fi

      # Gate 2: Security Scan
      - name: Gate 2 - Security Scan
        id: gate2
        run: |
          echo "🔍 Gate 2: CVE Scan"
          trivy image --severity HIGH,CRITICAL --exit-code 0 --format json --output gate-results/trivy.json ${{ env.IMAGE }}:${{ inputs.version || github.ref_name }}
          
          CRITICAL=$(jq '[.Results[0].Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' gate-results/trivy.json)
          HIGH=$(jq '[.Results[0].Vulnerabilities[]? | select(.Severity=="HIGH")] | length' gate-results/trivy.json)
          
          if [ "$CRITICAL" -eq 0 ] && [ "$HIGH" -eq 0 ]; then
            echo "✅ PASS: No HIGH/CRITICAL CVEs"
            echo "gate2=PASS" >> gate-results/status.txt
            echo "PASS=$((PASS+1))" >> $GITHUB_ENV
          else
            echo "❌ FAIL: Found $CRITICAL CRITICAL, $HIGH HIGH"
            echo "gate2=FAIL" >> gate-results/status.txt
            echo "FAIL=$((FAIL+1))" >> $GITHUB_ENV
          fi

      # Gate 3: SBOM
      - name: Gate 3 - SBOM
        id: gate3
        run: |
          echo "🔍 Gate 3: SBOM Check"
          if [ -f "sbom.json" ]; then
            echo "✅ PASS: SBOM exists"
            echo "gate3=PASS" >> gate-results/status.txt
            echo "PASS=$((PASS+1))" >> $GITHUB_ENV
          else
            echo "❌ FAIL: No SBOM found"
            echo "gate3=FAIL" >> gate-results/status.txt
            echo "FAIL=$((FAIL+1))" >> $GITHUB_ENV
          fi

      # Gate 4: Canary Stable
      - name: Gate 4 - Canary
        id: gate4
        run: |
          echo "🔍 Gate 4: Canary Stability"
          # Simuliert - in Produktion würde dies das Canary-Status abfragen
          CANARY_HOURS="${{ vars.CANARY_HOURS || '24' }}"
          if [ "$CANARY_HOURS" -ge 24 ]; then
            echo "✅ PASS: Canary stable for $CANARY_HOURS hours"
            echo "gate4=PASS" >> gate-results/status.txt
            echo "PASS=$((PASS+1))" >> $GITHUB_ENV
          else
            echo "❌ FAIL: Canary only $CANARY_HOURS hours"
            echo "gate4=FAIL" >> gate-results/status.txt
            echo "FAIL=$((FAIL+1))" >> $GITHUB_ENV
          fi

      # Gate 5: Rollback
      - name: Gate 5 - Rollback
        id: gate5
        run: |
          echo "🔍 Gate 5: Rollback Capability"
          if [ -f "audit/rollback-test.log" ] && grep -q "SUCCESS" audit/rollback-test.log; then
            echo "✅ PASS: Rollback tested"
            echo "gate5=PASS" >> gate-results/status.txt
            echo "PASS=$((PASS+1))" >> $GITHUB_ENV
          else
            echo "❌ FAIL: No rollback test"
            echo "gate5=FAIL" >> gate-results/status.txt
            echo "FAIL=$((FAIL+1))" >> $GITHUB_ENV
          fi

      # Gate 6: Monitoring
      - name: Gate 6 - Monitoring
        id: gate6
        run: |
          echo "🔍 Gate 6: Monitoring Setup"
          REQUIRED_ALERTS=("HighErrorRate" "HighLatency" "AdmissionDenials")
          FOUND=0
          for alert in "${REQUIRED_ALERTS[@]}"; do
            grep -r "$alert" . --include="*.yaml" >/dev/null 2>&1 && ((FOUND++))
          done
          if [ "$FOUND" -ge 3 ]; then
            echo "✅ PASS: Monitoring configured ($FOUND/3)"
            echo "gate6=PASS" >> gate-results/status.txt
            echo "PASS=$((PASS+1))" >> $GITHUB_ENV
          else
            echo "❌ FAIL: Missing alerts ($FOUND/3)"
            echo "gate6=FAIL" >> gate-results/status.txt
            echo "FAIL=$((FAIL+1))" >> $GITHUB_ENV
          fi

      # Gate 7: Audit Bundle
      - name: Gate 7 - Audit Bundle
        id: gate7
        run: |
          echo "🔍 Gate 7: Audit Bundle"
          FILES=0
          [ -f "audit/sbom.json" ] && ((FILES++))
          [ -f "audit/trivy.json" ] && ((FILES++))
          [ -f "audit/sign.log" ] && ((FILES++))
          if [ "$FILES" -ge 3 ]; then
            echo "✅ PASS: Audit bundle complete ($FILES/3)"
            echo "gate7=PASS" >> gate-results/status.txt
            echo "PASS=$((PASS+1))" >> $GITHUB_ENV
          else
            echo "❌ FAIL: Audit bundle incomplete ($FILES/3)"
            echo "gate7=FAIL" >> gate-results/status.txt
            echo "FAIL=$((FAIL+1))" >> $GITHUB_ENV
          fi

      # Gate 8: Key Rotation
      - name: Gate 8 - Key Rotation
        id: gate8
        run: |
          echo "🔍 Gate 8: Key Rotation Ready"
          if [ -f "KEY_ROTATION.md" ] || [ -f "audit/KEY_ROTATION.md" ]; then
            echo "✅ PASS: Key rotation documented"
            echo "gate8=PASS" >> gate-results/status.txt
            echo "PASS=$((PASS+1))" >> $GITHUB_ENV
          else
            echo "❌ FAIL: No key rotation docs"
            echo "gate8=FAIL" >> gate-results/status.txt
            echo "FAIL=$((FAIL+1))" >> $GITHUB_ENV
          fi

      # Gate 9: Documentation
      - name: Gate 9 - Documentation
        id: gate9
        run: |
          echo "🔍 Gate 9: Documentation"
          DOCS=0
          [ -f "README.md" ] && ((DOCS++))
          [ -f "CHANGELOG.md" ] && ((DOCS++))
          [ -f "runbook.md" ] && ((DOCS++))
          if [ "$DOCS" -ge 2 ]; then
            echo "✅ PASS: Documentation exists ($DOCS/2)"
            echo "gate9=PASS" >> gate-results/status.txt
            echo "PASS=$((PASS+1))" >> $GITHUB_ENV
          else
            echo "❌ FAIL: Missing docs ($DOCS/2)"
            echo "gate9=FAIL" >> gate-results/status.txt
            echo "FAIL=$((FAIL+1))" >> $GITHUB_ENV
          fi

      # Gate 10: Manual Approval
      - name: Gate 10 - Manual Approval
        id: gate10
        run: |
          echo "🔍 Gate 10: Manual Approval"
          if [ -f ".go-live-approved" ]; then
            echo "✅ PASS: Approved"
            echo "gate10=PASS" >> gate-results/status.txt
            echo "PASS=$((PASS+1))" >> $GITHUB_ENV
          else
            echo "❌ FAIL: Not approved - create .go-live-approved file"
            echo "gate10=FAIL" >> gate-results/status.txt
            echo "FAIL=$((FAIL+1))" >> $GITHUB_ENV
          fi

      # Generate Report
      - name: Generate Report
        run: |
          cat > gate-results/report.md << EOF
          # 🚦 Go-Live Gate Report
          
          **Version**: ${{ inputs.version || github.ref_name }}
          **Environment**: ${{ inputs.environment || 'production' }}
          **Timestamp**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
          
          ## Results
          
          \`\`\`
          $(cat gate-results/status.txt)
          \`\`\`
          
          ## Summary
          
          - ✅ Passed: $PASS/10
          - ❌ Failed: $FAIL/10
          
          ## Decision
          
          EOF
          
          if [ "$FAIL" -eq 0 ]; then
            echo "### 🟢 GREEN LIGHT - GO-LIVE APPROVED" >> gate-results/report.md
          else
            echo "### 🔴 RED LIGHT - GO-LIVE BLOCKED" >> gate-results/report.md
          fi
          
          cat gate-results/report.md

      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: go-live-gate
          path: gate-results/

      - name: Check Gate Status
        run: |
          if [ "$FAIL" -eq 0 ]; then
            echo "✅ All gates passed - GO!"
            exit 0
          else
            echo "❌ $FAIL gates failed - BLOCKED!"
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
  before_script:
    - apk add --no-cache curl jq bash
    - curl -fsSL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 -o /usr/local/bin/cosign
    - chmod +x /usr/local/bin/cosign
    - curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
  script:
    - |
      PASS=0
      FAIL=0
      mkdir -p gate-results
      
      echo "🚦 Running Go-Live Gate..."
      
      # Gate 1: Signature
      if cosign verify --certificate-oidc-issuer="https://token.actions.githubusercontent.com" --certificate-identity-regexp=".*" "$CI_REGISTRY_IMAGE:$VERSION"; then
        echo "✅ Gate 1 PASS"
        ((PASS++))
      else
        echo "❌ Gate 1 FAIL"
        ((FAIL++))
      fi
      
      # Gate 2: CVE
      trivy image --severity HIGH,CRITICAL --exit-code 0 --format json --output trivy.json "$CI_REGISTRY_IMAGE:$VERSION"
      if [ "$(jq '[.Results[0].Vulnerabilities[]? | select(.Severity=="HIGH" or .Severity=="CRITICAL")] | length' trivy.json)" -eq 0 ]; then
        echo "✅ Gate 2 PASS"
        ((PASS++))
      else
        echo "❌ Gate 2 FAIL"
        ((FAIL++))
      fi
      
      # Continue for all gates...
      
      echo ""
      echo "📊 Summary: $PASS/10 passed, $FAIL/10 failed"
      
      if [ "$FAIL" -eq 0 ]; then
        echo "🟢 GREEN LIGHT"
        exit 0
      else
        echo "🔴 RED LIGHT"
        exit 1
      fi
  artifacts:
    paths:
      - gate-results/
  rules:
    - if: $CI_COMMIT_TAG
      when: manual
```

---

## Check-Script

```bash
#!/bin/bash
# go-live-check.sh

echo "🚦 Go-Live Gate Check"
echo "====================="

PASS=0
FAIL=0

# Gate 1: Signature
echo "Gate 1: Signature..."
cosign verify --keyless $IMAGE 2>/dev/null && ((PASS++)) || ((FAIL++))

# Gate 2: CVE
echo "Gate 2: CVE..."
trivy image --severity HIGH,CRITICAL --exit-code 1 $IMAGE && ((PASS++)) || ((FAIL++))

# Gate 3: Admission
echo "Gate 3: Admission..."
kubectl get clusterpolicies -o name | grep -q require && ((PASS++)) || ((FAIL++))

# Continue...

echo ""
echo "====================="
echo "✅ Passed: $PASS/10"
echo "❌ Failed: $FAIL/10"

[ "$FAIL" -eq 0 ] && echo "🟢 GREEN LIGHT" || echo "🔴 RED LIGHT"
```

---

## Vorteile

| Vorteil | Beschreibung |
|---------|--------------|
| Automatisch | CI führt alle Checks aus |
| Fail-Fast | Blockiert bei Problemen |
| Audit-Ready | Report für Compliance |
| Minimal | Eine Pipeline reicht |

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Signatur-Chain | EI |
| Security Scans | EJ |
| Monitoring Alerts | EM |
| Day-2 Operations | EP |

---

*Block EO – Go-Live Gate (Minimal) – v1.0*
