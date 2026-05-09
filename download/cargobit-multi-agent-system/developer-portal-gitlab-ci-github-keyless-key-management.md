# Block CD – GitLab CI + GitHub Keyless + Key Management

**Status:** Production-Ready  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-05-06  
**Teil von:** CargoBit Multi-Agent System – Self-Healing Implementation Stack

---

## Übersicht

| Komponente | Plattform | Beschreibung |
|------------|-----------|--------------|
| GitLab CI Pipeline | GitLab | Build → Test → Scan → Sign → Push |
| GitHub Keyless Workflow | GitHub | OIDC-basiertes cosign Signing |
| Key Management | Both | Rotation, Secrets, Incident Response |

---

## 1. GitLab CI Pipeline

### Speicherort
```
.gitlab-ci.yml
```

### Vollständiger Inhalt

```yaml
stages:
  - test
  - build
  - scan
  - sign
  - publish

variables:
  IMAGE_NAME: "$CI_REGISTRY_IMAGE/governance-postcheck"
  IMAGE_TAG: "$CI_COMMIT_SHA"
  DOCKER_DRIVER: overlay2

# 1) Tests
unit-tests:
  stage: test
  image: python:3.11-slim
  script:
    - python -m pip install --upgrade pip
    - pip install -r governance-postcheck/app/requirements.txt pytest
    - pytest governance-postcheck/tests -q
  artifacts:
    when: on_success
    reports:
      junit: junit.xml
    paths:
      - .pytest_cache/

# 2) Build (BuildKit / Docker-in-Docker)
build-image:
  stage: build
  image: docker:24.0.5
  services:
    - docker:24-dind
  variables:
    DOCKER_HOST: tcp://docker:2375/
    DOCKER_TLS_CERTDIR: ""
  before_script:
    - docker info
  script:
    - docker build --progress=plain -t "${IMAGE_NAME}:${IMAGE_TAG}" -f governance-postcheck/Dockerfile governance-postcheck
    - docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${IMAGE_NAME}:latest"
  needs: ["unit-tests"]
  artifacts:
    expire_in: 1h
    paths:
      - build.log

# 3) Scan with Trivy
scan-image:
  stage: scan
  image:
    name: aquasec/trivy:latest
    entrypoint: [""]
  script:
    - trivy image --exit-code 1 --severity CRITICAL,HIGH "${IMAGE_NAME}:${IMAGE_TAG}" || { echo "Trivy found HIGH/CRITICAL vulnerabilities"; exit 1; }
  needs: ["build-image"]

# 4) Sign image (Keyed or Keyless)
sign-image:
  stage: sign
  image: docker:24.0.5
  services:
    - docker:24-dind
  variables:
    DOCKER_HOST: tcp://docker:2375/
    DOCKER_TLS_CERTDIR: ""
  before_script:
    - apk add --no-cache curl bash openssl || true
  script:
    # Option A: Keyed signing (COSIGN_KEY variable contains base64 private key)
    - |
      if [ -n "$COSIGN_KEY_BASE64" ]; then
        echo "$COSIGN_KEY_BASE64" | base64 -d > cosign.key
        chmod 600 cosign.key
        curl -sSL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 -o /usr/local/bin/cosign
        chmod +x /usr/local/bin/cosign
        /usr/local/bin/cosign sign --key cosign.key "${IMAGE_NAME}:${IMAGE_TAG}"
        shred -u cosign.key || rm -f cosign.key
      else
        # Option B: Keyless signing via GitLab CI OIDC (requires GitLab >= 14.9 and configured OIDC)
        curl -sSL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 -o /usr/local/bin/cosign
        chmod +x /usr/local/bin/cosign
        # Acquire ID token from GitLab CI predefined variable CI_JOB_JWT
        export COSIGN_EXPERIMENTAL=1
        /usr/local/bin/cosign sign --oidc-token "$CI_JOB_JWT" "${IMAGE_NAME}:${IMAGE_TAG}"
      fi
  needs: ["scan-image"]
  only:
    - branches

# 5) Push image to registry
push-image:
  stage: publish
  image: docker:24.0.5
  services:
    - docker:24-dind
  variables:
    DOCKER_HOST: tcp://docker:2375/
    DOCKER_TLS_CERTDIR: ""
  before_script:
    - echo "$CI_REGISTRY_PASSWORD" | docker login -u "$CI_REGISTRY_USER" --password-stdin "$CI_REGISTRY"
  script:
    - docker push "${IMAGE_NAME}:${IMAGE_TAG}"
    - docker push "${IMAGE_NAME}:latest"
  needs: ["sign-image"]
  only:
    - branches
```

### GitLab CI Variablen

| Variable | Beschreibung | Erforderlich |
|----------|--------------|--------------|
| `CI_REGISTRY_USER` | GitLab Registry Username | ✅ Automatisch |
| `CI_REGISTRY_PASSWORD` | GitLab Registry Password | ✅ Automatisch |
| `COSIGN_KEY_BASE64` | Base64-encoded private Key (Keyed) | ❌ Optional |
| `CI_JOB_JWT` | GitLab OIDC Token (Keyless) | ✅ Automatisch |

---

## 2. GitHub Actions Keyless Workflow

### Speicherort
```
.github/workflows/postcheck-ci-keyless.yml
```

### Vollständiger Inhalt

```yaml
name: CI PostCheck Build Test Scan Push KeylessSign

on:
  push:
    paths:
      - 'governance-postcheck/**'
  pull_request:
    paths:
      - 'governance-postcheck/**'

permissions:
  contents: read
  packages: write
  id-token: write

env:
  IMAGE_NAME: ghcr.io/${{ github.repository_owner }}/governance-postcheck
  IMAGE_TAG: ${{ github.sha }}

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install test deps
        run: |
          python -m pip install --upgrade pip
          pip install -r governance-postcheck/app/requirements.txt pytest

      - name: Run unit tests
        run: pytest governance-postcheck/tests -q

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v5
        with:
          context: governance-postcheck
          file: governance-postcheck/Dockerfile
          push: true
          tags: |
            ${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}
            ${{ env.IMAGE_NAME }}:latest

      - name: Download Trivy DB
        uses: aquasecurity/trivy-action@v1
        with:
          download-db-only: true

      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@v1
        with:
          image-ref: ${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}
          format: 'table'
          exit-code: '1'
          vuln-type: 'os,library'

      - name: Install cosign
        run: |
          COSIGN_VERSION="2.1.0"
          curl -sSLf -o /tmp/cosign.tar.gz "https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign-linux-amd64.tar.gz"
          sudo tar -C /usr/local/bin -xzf /tmp/cosign.tar.gz

      - name: Keyless sign image with cosign (OIDC)
        env:
          COSIGN_EXPERIMENTAL: "1"
        run: |
          cosign sign --keyless "${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}"
```

### GitHub Permissions

| Permission | Wert | Zweck |
|------------|------|-------|
| `contents` | read | Checkout |
| `packages` | write | Push zu GHCR |
| `id-token` | write | OIDC Token für Keyless Signing |

---

## 3. Key Management & Secret Konfiguration

### README-Abschnitt

```markdown
## Key Management, Rotation und Secret Konfiguration

### Signing-Strategie (Empfehlung)
- **Keyless Signing (OIDC)**: Bevorzugt für CI-Workflows, da keine dauerhaften privaten Schlüssel in CI-Secrets liegen. Nutzt OIDC (GitHub Actions `id-token` oder GitLab CI `CI_JOB_JWT`) und `cosign sign --keyless`. Vorteile: kein Secret-Leak, einfache Rotation, Rekor-Audit.
- **Keyed Signing**: Falls Keyless nicht möglich, verwaltet private cosign-Keys in einem KMS/HSM (z. B. AWS KMS, GCP KMS, Azure Key Vault) oder als verschlüsselte Secret in der CI (nur wenn KMS nicht verfügbar).

### Secrets und CI Variablen (Beispiele)
- **GitHub Actions**
  - `GITHUB_TOKEN` (automatisch) für Registry Login (GHCR) oder setze `REGISTRY_USERNAME`/`REGISTRY_PASSWORD`.
  - Für keyed signing: `COSIGN_KEY` (base64-encoded private key) und optional `COSIGN_PASSWORD`.
  - Für keyless: keine privaten Keys in Secrets erforderlich; `permissions.id-token: write` aktivieren.
- **GitLab CI**
  - `CI_REGISTRY_USER`, `CI_REGISTRY_PASSWORD` (oder integrierte Registry Credentials).
  - Optional `COSIGN_KEY_BASE64` (nur wenn keyed signing verwendet wird).

### Key Rotation Policy (Mindestanforderungen)
- **Rotation Intervall:** Private Keys mindestens alle 90 Tage rotieren; kürzer bei hohem Risiko. Keyless: regelmäßige Audit-Überprüfung der Rekor-Einträge.
- **Rotation Prozess (Keyed):**
  1. Erzeuge neuen Key in KMS/HSM oder lokal (offline).
  2. Signiere Test-Image mit neuem Key und verifiziere Signatur.
  3. Aktualisiere CI Secret (`COSIGN_KEY_BASE64`) in einer Wartungs-Pipeline.
  4. Revoke/Archive alten Key; dokumentiere Revoke-Datum.
- **Rotation Process (Keyless):**
  - Keyless nutzt kurzlebige OIDC Tokens; Rotation besteht aus Audit/Policy-Updates und regelmäßiger Überprüfung der Rekor-Einträge.

### Access Control & Least Privilege
- CI-Accounts nur die minimal nötigen Rechte geben (push only to specific repo/registry).
- Secrets nur in geschützten CI-Variablen speichern; Zugriff auf Secrets auf Admins/CI-Service Accounts beschränken.
- Audit-Logs aktivieren (Registry, KMS, CI) und Aufbewahrungsfristen definieren.

### Incident Response (bei Key-Kompromittierung)
1. Sofort: Entziehe CI-Secret und sperre betroffene Accounts.
2. Erzeuge neuen Key (KMS/HSM) und aktualisiere CI-Secrets.
3. Revoke/Archive kompromittierten Key; dokumentiere Zeitstempel.
4. Rebuild & Resign kritische Images mit neuem Key; veröffentliche Signatur-Änderungen.
5. Informiere Stakeholder und erstelle Post-Mortem.

### Operational Empfehlungen
- Nutze `cosign verify` in Deploy-Pipelines, um nur signierte Images zuzulassen.
- Ergänze Signaturen mit Attestations (z. B. `cosign attest`) für zusätzliche Metadaten (SBOM, Build Info).
- Dokumentiere Key-Rotation und Secret-Owner in eurem Runbook/Oncall-Handbuch.
```

---

## 4. Signing-Strategie Vergleich

| Aspekt | Keyless (OIDC) | Keyed (KMS/Secret) |
|--------|----------------|-------------------|
| Secret-Management | Nicht erforderlich | Erforderlich |
| Rotation | Automatisch (OIDC) | Manuell (90 Tage) |
| Audit | Rekor-Einträge | KMS-Logs |
| Setup-Komplexität | Niedrig | Mittel-Hoch |
| Sicherheit | Hoch (kein Key-Leak) | Abhängig von Secret-Schutz |
| Empfehlung | ✅ Bevorzugt | Fallback |

---

## 5. Patch-Dateien

### Patch 0008: GitLab CI Pipeline

```bash
# Anwendung
git checkout -b ci/gitlab/governance-postcheck-pipeline
git apply 0008-add-gitlab-ci-pipeline.patch
git add .gitlab-ci.yml
git commit -m "feat(ci): add GitLab CI pipeline for governance-postcheck"
git push -u origin ci/gitlab/governance-postcheck-pipeline
```

### Patch 0009: GitHub Keyless Workflow

```bash
# Anwendung
git checkout -b ci/github/governance-postcheck-keyless
git apply 0009-add-github-keyless-workflow.patch
git add .github/workflows/postcheck-ci-keyless.yml
git commit -m "feat(ci): add GitHub keyless signing workflow for governance-postcheck"
git push -u origin ci/github/governance-postcheck-keyless
```

---

## Block-Metadaten

| Feld | Wert |
|------|------|
| Block-ID | CD |
| Erstellt | 2026-05-06 |
| Abhängigkeiten | Block CC |
| Vorgänger | CC |
| Status | Production-Ready |

---

## Self-Healing Stack – CI/CD Blocks

```
CC → GitHub Actions CI Snippet
CD → GitLab CI + GitHub Keyless + Key Management ← NEU
```

---

## Nächste Optionen

| Option | Beschreibung |
|--------|--------------|
| **Runbook** | `SECURITY/KEY_ROTATION.md` erstellen |
| **cosign verify** | Snippet für Argo Rollout/PostCheck |
| **Patches anlegen** | 0008 + 0009 als Dateien speichern |
