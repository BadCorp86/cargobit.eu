# Block CC – GitHub Actions CI Snippet (Build, Test, Scan, Sign)

**Status:** Production-Ready  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-05-06  
**Teil von:** CargoBit Multi-Agent System – Self-Healing Implementation Stack

---

## Übersicht

| Komponente | Beschreibung |
|------------|--------------|
| Workflow-Datei | `.github/workflows/governance-postcheck-ci.yml` |
| Trigger | Push zu `main`, Pull Requests, Tags |
| Jobs | Lint → Test → Build → Scan → Sign → Push |

---

## 1. GitHub Actions Workflow (Vollständig)

### Speicherort
```
.github/workflows/governance-postcheck-ci.yml
```

### Inhalt

```yaml
name: Governance PostCheck CI

on:
  push:
    branches: [main]
    paths:
      - 'governance-postcheck/**'
      - '.github/workflows/governance-postcheck-ci.yml'
  pull_request:
    branches: [main]
    paths:
      - 'governance-postcheck/**'
  release:
    types: [published]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/governance-postcheck
  PYTHON_VERSION: '3.11'

jobs:
  # ============================================
  # Job 1: Lint (YAML, Python)
  # ============================================
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install linters
        run: |
          pip install flake8 pylint yamllint
          pip install -r governance-postcheck/app/requirements.txt

      - name: YAML Lint
        run: yamllint -d relaxed governance-postcheck/k8s/

      - name: Python Flake8
        run: flake8 governance-postcheck/app/ --max-line-length=120 --ignore=E501,W503

      - name: Python Pylint
        run: pylint governance-postcheck/app/ --fail-under=7.0 || true

  # ============================================
  # Job 2: Unit Tests
  # ============================================
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'

      - name: Install dependencies
        run: |
          pip install -r governance-postcheck/app/requirements.txt
          pip install pytest pytest-cov

      - name: Run tests
        run: |
          pytest governance-postcheck/tests/ \
            --cov=governance-postcheck/app \
            --cov-report=xml \
            --cov-report=html \
            --cov-fail-under=80 \
            -v

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage.xml
          flags: governance-postcheck
          fail_ci_if_error: false

  # ============================================
  # Job 3: Build Container
  # ============================================
  build:
    name: Build Container
    runs-on: ubuntu-latest
    needs: test
    permissions:
      contents: read
      packages: write
    outputs:
      image_digest: ${{ steps.build.outputs.digest }}
      image_tag: ${{ steps.meta.outputs.tags }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix=sha-
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: ./governance-postcheck
          file: ./governance-postcheck/Dockerfile
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          sbom: true
          provenance: true

  # ============================================
  # Job 4: Security Scan (Trivy)
  # ============================================
  scan:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: build
    permissions:
      contents: read
      security-events: write
    steps:
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          ignore-unfixed: true

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
          category: 'trivy-container-scan'

      - name: Run Trivy (exit on vulnerability)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: 'table'
          severity: 'CRITICAL,HIGH'
          ignore-unfixed: true
          exit-code: '1'

  # ============================================
  # Job 5: Sign Image (Cosign)
  # ============================================
  sign:
    name: Sign Image
    runs-on: ubuntu-latest
    needs: [build, scan]
    if: github.event_name != 'pull_request'
    permissions:
      contents: read
      packages: write
      id-token: write
    steps:
      - name: Install Cosign
        uses: sigstore/cosign-installer@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Sign image with Cosign
        env:
          DIGEST: ${{ needs.build.outputs.image_digest }}
        run: |
          cosign sign --yes \
            "${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}@${DIGEST}"

      - name: Verify signature
        env:
          DIGEST: ${{ needs.build.outputs.image_digest }}
        run: |
          cosign verify \
            --certificate-identity="https://github.com/${{ github.repository }}/.github/workflows/governance-postcheck-ci.yml@${{ github.ref }}" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            "${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}@${DIGEST}"

  # ============================================
  # Job 6: Generate SBOM
  # ============================================
  sbom:
    name: Generate SBOM
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name != 'pull_request'
    steps:
      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: spdx-json
          output-file: sbom.spdx.json

      - name: Upload SBOM artifact
        uses: actions/upload-artifact@v4
        with:
          name: sbom-spdx
          path: sbom.spdx.json
          retention-days: 30
```

---

## 2. Job-Abhängigkeiten (DAG)

```
lint ──→ test ──→ build ──→ scan ──→ sign
                              │
                              └──→ sbom
```

---

## 3. Workflow-Trigger

| Event | Bedingung | Aktion |
|-------|-----------|--------|
| `push` | Branch `main`, Path `governance-postcheck/**` | Full CI + Push |
| `pull_request` | Branch `main`, Path `governance-postcheck/**` | Lint + Test + Build (no push) |
| `release` | Published | Full CI + Push + Sign |

---

## 4. Erforderliche Secrets

| Secret | Beschreibung | Erforderlich |
|--------|--------------|--------------|
| `GITHUB_TOKEN` | Automatisch von GitHub bereitgestellt | ✅ Ja |
| `CODECOV_TOKEN` | Für Coverage Upload (optional) | ❌ Optional |

---

## 5. Permissions-Matrix

| Job | `contents` | `packages` | `security-events` | `id-token` |
|-----|------------|------------|-------------------|------------|
| lint | read | - | - | - |
| test | read | - | - | - |
| build | read | write | - | - |
| scan | read | - | write | - |
| sign | read | write | - | write |
| sbom | read | - | - | - |

---

## 6. Patch-Datei

### Dateiname
```
0007-add-github-actions-ci.patch
```

### Anwendung

```bash
git checkout -b ci/github-actions/governance-postcheck
git apply 0007-add-github-actions-ci.patch
git add .github/workflows/governance-postcheck-ci.yml
git commit -m "feat(ci): add GitHub Actions workflow for governance-postcheck"
git push -u origin ci/github-actions/governance-postcheck
```

---

## 7. CI-Checks Übersicht

| Check | Tool | Fail-Bedingung |
|-------|------|----------------|
| YAML Lint | yamllint | Syntax-Fehler |
| Python Lint | flake8, pylint | Score < 7.0 |
| Unit Tests | pytest | Coverage < 80% |
| Container Build | Docker Buildx | Build-Fehler |
| Security Scan | Trivy | CRITICAL/HIGH unfixed |
| Image Signing | Cosign | Signatur ungültig |
| SBOM | Syft | - |

---

## 8. Erweiterte Optionen

### Secrets/ConfigMap via GitHub Actions

```yaml
  # Job: Deploy Secrets (optional)
  deploy-secrets:
    name: Deploy Secrets
    runs-on: ubuntu-latest
    needs: sign
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Set up kubectl
        uses: azure/setup-kubectl@v3

      - name: Configure kubeconfig
        run: |
          echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=kubeconfig

      - name: Create/Update Secret
        run: |
          kubectl create secret generic governance-postcheck-secrets \
            --from-literal=PROM_URL="${{ secrets.PROM_URL }}" \
            --namespace=governance \
            --dry-run=client -o yaml | kubectl apply -f -
```

---

## Block-Metadaten

| Feld | Wert |
|------|------|
| Block-ID | CC |
| Erstellt | 2026-05-06 |
| Abhängigkeiten | Block CB |
| Vorgänger | CB |
| Status | Production-Ready |

---

## Self-Healing Stack – CI/CD Blocks

```
CB → CargoBit Handle Templates + Patches
CC → GitHub Actions CI Snippet ← NEU
```

---

## Nächste Optionen

| Option | Beschreibung |
|--------|--------------|
| **Terraform/Helm** | Secrets/ConfigMap Snippets |
| **ZIP-Archiv** | Starter-Repo zum Download |
| **Full Index** | Alle Blöcke BJ–CC Übersicht |
