# EI – Automatisierte Signatur-Chain (Minimal)

> **Zweck**: Vollständig automatisierte Image-Signierung mit Keyless-Modus. Kein Key-Management erforderlich.

---

## 🔄 Signatur-Chain – Minimal-Architektur

### Prinzip

| Aspekt | Wert |
|--------|------|
| Modus | Keyless (OIDC-basiert) |
| Tool | cosign |
| Transparency Log | Rekor (sigstore) |
| Aufwand | 0 Wartung |

---

## GitHub Actions Pipeline

```yaml
name: sign-and-verify

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE: ghcr.io/${{ github.repository }}

jobs:
  sign:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write  # Für OIDC

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup cosign
        uses: sigstore/cosign-installer@main

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

      - name: Sign Image (Keyless)
        run: |
          cosign sign --yes \
            --identity-token ${{ secrets.GITHUB_TOKEN }} \
            ${{ env.IMAGE }}@${{ github.sha }}

      - name: Verify Signature
        run: |
          cosign verify \
            --certificate-identity-regexp="^https://github.com/${{ github.repository }}.*" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            ${{ env.IMAGE }}@${{ github.sha }}

      - name: Get Rekor Index
        run: |
          echo "Rekor Entry:"
          cosign triangulate ${{ env.IMAGE }}@${{ github.sha }}
```

---

## GitLab CI Version

```yaml
sign-and-verify:
  stage: sign
  image: alpine:3.19
  id_tokens:
    SIGSTORE_ID_TOKEN:
      aud: sigstore
  before_script:
    - apk add --no-cache curl
    - curl -fsSL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 -o /usr/local/bin/cosign
    - chmod +x /usr/local/bin/cosign
  script:
    - |
      IMAGE="${CI_REGISTRY_IMAGE}:${CI_COMMIT_SHA}"
      
      # Sign with GitLab OIDC token
      cosign sign --yes \
        --identity-token "${SIGSTORE_ID_TOKEN}" \
        "${IMAGE}"
      
      # Verify
      cosign verify \
        --certificate-identity-regexp=".*" \
        --certificate-oidc-issuer="https://gitlab.com" \
        "${IMAGE}"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

---

## Admission Policy (Kyverno)

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-image-signature
  annotations:
    policies.kyverno.io/title: Require Image Signature
    policies.kyverno.io/description: Block unsigned images
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
            - "docker.io/*"
          attestors:
            - entries:
                - keyless:
                    subject: "*"
                    issuer: "https://token.actions.githubusercontent.com"
          required: true
```

---

## Verify-Befehle

```bash
# Image signieren
cosign sign --keyless ghcr.io/company/app@sha256:xxx

# Signatur verifizieren
cosign verify \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  --certificate-identity-regexp=".*" \
  ghcr.io/company/app@sha256:xxx

# Rekor-Eintrag anzeigen
cosign triangulate ghcr.io/company/app@sha256:xxx

# Alle Signaturen auflisten
cosign list ghcr.io/company/app
```

---

## Check-Script

```bash
#!/bin/bash
# check-signature.sh

IMAGE="${1:-ghcr.io/company/app:latest}"

echo "🔍 Checking signature for: $IMAGE"

if cosign verify \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  --certificate-identity-regexp=".*" \
  "$IMAGE" 2>/dev/null; then
  echo "✅ SIGNATURE OK"
  exit 0
else
  echo "❌ SIGNATURE MISSING OR INVALID"
  exit 1
fi
```

---

## Automatischer Daily-Check

```yaml
# .github/workflows/daily-signature-check.yml
name: Daily Signature Check

on:
  schedule:
    - cron: '0 6 * * *'  # Täglich 06:00 UTC
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: sigstore/cosign-installer@main

      - name: Check Production Images
        run: |
          IMAGES=(
            "ghcr.io/${{ github.repository }}:production"
          )
          
          for IMAGE in "${IMAGES[@]}"; do
            if cosign verify \
              --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
              --certificate-identity-regexp=".*" \
              "$IMAGE"; then
              echo "✅ $IMAGE: VERIFIED"
            else
              echo "❌ $IMAGE: FAILED"
              exit 1
            fi
          done
```

---

## Vorteile Keyless

| Vorteil | Beschreibung |
|---------|--------------|
| Kein Key-Management | OIDC-Provider verwaltet Identität |
| Automatische Rotation | Tokens sind kurzlebig |
| Audit-Trail | Rekor speichert alle Signaturen |
| Kostenlos | Sigstore Public Good |

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Security Scans + SBOM | EJ |
| Admission Enforcement | EK |
| Key Rotation | EN |
| Go-Live Gate | EO |

---

*Block EI – Automatisierte Signatur-Chain (Minimal) – v1.0*
