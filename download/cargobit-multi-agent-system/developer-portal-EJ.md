# EJ – Automatisierte Security Scans + SBOM (Minimal)

> **Zweck**: Automatische CVE-Scans und SBOM-Generierung. Build bricht bei HIGH/CRITICAL CVEs ab.

---

## 🛡️ Security Scans – Minimal-Architektur

### Prinzip

| Aspekt | Wert |
|--------|------|
| Scanner | Trivy |
| SBOM | Syft |
| Policy | Block on HIGH/CRITICAL |
| Aufwand | 0 Wartung |

---

## GitHub Actions Pipeline

```yaml
name: security-scan

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 6 * * *'  # Täglich 06:00 UTC
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE: ghcr.io/${{ github.repository }}

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Trivy
        uses: aquasecurity/setup-trivy@v0.2.0

      - name: Setup Syft
        uses: anchore/sbom-action/download-syft@v0

      - name: Build Image for Scan
        run: docker build -t ${{ env.IMAGE }}:${{ github.sha }} .

      # --- Trivy Scan ---
      - name: Run Trivy Vulnerability Scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.IMAGE }}:${{ github.sha }}
          format: 'json'
          output: 'trivy-results.json'
          severity: 'HIGH,CRITICAL'
          exit-code: '1'  # Build bricht ab bei Fehlern

      - name: Run Trivy for SARIF Report
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.IMAGE }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'HIGH,CRITICAL'

      - name: Upload SARIF to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

      # --- SBOM Generation ---
      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: ${{ env.IMAGE }}:${{ github.sha }}
          format: spdx-json
          output-file: sbom.json

      - name: Upload Scan Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: security-scan-results
          path: |
            trivy-results.json
            trivy-results.sarif
            sbom.json
          retention-days: 30
```

---

## GitLab CI Version

```yaml
security-scan:
  stage: test
  image: alpine:3.19
  before_script:
    - apk add --no-cache curl jq
    - curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
    - curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
  script:
    - |
      IMAGE="${CI_REGISTRY_IMAGE}:${CI_COMMIT_SHA}"
      
      echo "🔍 Running Trivy scan..."
      trivy image \
        --severity HIGH,CRITICAL \
        --format json \
        --output trivy-results.json \
        --exit-code 1 \
        "${IMAGE}"
      
      echo "📦 Generating SBOM..."
      syft "${IMAGE}" -o spdx-json > sbom.json
      
      # Zusammenfassung
      CRITICAL=$(jq '[.Results[0].Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' trivy-results.json)
      HIGH=$(jq '[.Results[0].Vulnerabilities[]? | select(.Severity=="HIGH")] | length' trivy-results.json)
      
      echo ""
      echo "📊 Scan Results:"
      echo "  CRITICAL: ${CRITICAL}"
      echo "  HIGH: ${HIGH}"
  artifacts:
    paths:
      - trivy-results.json
      - sbom.json
    expire_in: 30 days
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

---

## Minimal Trivy Config

```yaml
# .trivy.yaml
severity:
  - HIGH
  - CRITICAL

exit-code: 1

format: table

vulnerability:
  type:
    - os
    - library
  
  ignore-unfixed: true

skip-dirs:
  - tests
  - docs
```

---

## SBOM-Drift Check

```yaml
name: SBOM Drift Check

on:
  schedule:
    - cron: '0 6 * * 1'  # Montag 06:00 UTC
  workflow_dispatch:

jobs:
  drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anchore/sbom-action/download-syft@v0

      - name: Generate Current SBOM
        run: |
          docker build -t app:current .
          syft app:current -o spdx-json > sbom-current.json

      - name: Compare with Baseline
        run: |
          if [ -f "sbom-baseline.json" ]; then
            echo "Comparing SBOMs..."
            # Simple diff check
            DIFF=$(diff <(jq -S . sbom-baseline.json) <(jq -S . sbom-current.json) || true)
            if [ -n "$DIFF" ]; then
              echo "⚠️  SBOM drift detected!"
              echo "$DIFF"
            else
              echo "✅ No SBOM drift"
            fi
          else
            echo "📋 Creating baseline SBOM"
            cp sbom-current.json sbom-baseline.json
          fi

      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: sbom-drift
          path: sbom-*.json
```

---

## CVE Exception Process

```yaml
# .trivyignore (nur für begründete Ausnahmen)
# Format: VULN-ID # Reason

# CVE-2024-12345 # Vendor fix pending, accepted by Security Team 2024-01-15
```

```markdown
# EXCEPTIONS.md

## Aktive CVE-Ausnahmen

| CVE | Paket | Grund | Akzeptiert von | Ablauf |
|-----|-------|-------|----------------|--------|
| CVE-2024-12345 | libxyz 1.2.3 | Vendor fix pending | Security Team | 2024-02-15 |

## Prozess

1. CVE identifizieren
2. Business Impact bewerten
3. Mitigation definieren
4. Security-Team freigeben
5. In .trivyignore eintragen
6. Ablaufdatum setzen
```

---

## Check-Script

```bash
#!/bin/bash
# security-check.sh

IMAGE="${1:-ghcr.io/company/app:latest}"

echo "🔍 Security Scan for: $IMAGE"

# Trivy Scan
trivy image \
  --severity HIGH,CRITICAL \
  --format json \
  --output trivy-results.json \
  "$IMAGE"

CRITICAL=$(jq '[.Results[0].Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' trivy-results.json)
HIGH=$(jq '[.Results[0].Vulnerabilities[]? | select(.Severity=="HIGH")] | length' trivy-results.json)

echo ""
echo "📊 Results:"
echo "  CRITICAL: ${CRITICAL}"
echo "  HIGH: ${HIGH}"

if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
  echo "❌ SECURITY CHECK FAILED"
  exit 1
else
  echo "✅ SECURITY CHECK PASSED"
  exit 0
fi
```

---

## Vorteile

| Vorteil | Beschreibung |
|---------|--------------|
| Automatisch | Build bricht bei CVEs ab |
| Dokumentiert | SARIF in GitHub Security |
| SBOM | Für Supply-Chain-Compliance |
| Minimal | Keine Infrastruktur nötig |

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Signatur-Chain | EI |
| Admission Enforcement | EK |
| Monitoring Alerts | EM |
| Go-Live Gate | EO |

---

*Block EJ – Security Scans + SBOM (Minimal) – v1.0*
