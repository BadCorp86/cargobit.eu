# Release Abschlusscheckliste

**Kurzantwort:** Setze CI-Secrets und OIDC, finalisiere Dockerfile und SBOM-Erzeugung, härtet Images, verifiziere Trivy-Policy, automatisiere cosign-Signatur und Deploy-Gate; teste alles in Sandbox, dann Canary → Staged Promotion.

---

## 1. CI und Secrets

### Secrets Konfiguration

| Secret | Beschreibung | Erforderlich |
|--------|--------------|--------------|
| `REGISTRY_USERNAME` | Registry Benutzername | Ja |
| `REGISTRY_PASSWORD` | Registry Passwort/Token | Ja |
| `GITHUB_TOKEN` | GitHub Container Registry (alternativ) | Optional |
| `COSIGN_KEY` | Private Key für Keyed Signing | Optional |
| `COSIGN_KEY_BASE64` | Base64-kodierte Key-Version | Optional |
| `COSIGN_PASSWORD` | Passwort für verschlüsselten Key | Optional |

### OIDC Konfiguration

**GitHub Actions:**
```yaml
permissions:
  id-token: write  # Erforderlich für OIDC/Keyless
  contents: read
  packages: write
```

**GitLab Runner:**
- Runner muss JWT-Tokens unterstützen
- `CI_JOB_JWT` Variable verfügbar

### Validierung

- [ ] Alle erforderlichen Secrets in CI/CD Platform gesetzt
- [ ] OIDC/ID-Token Permission aktiviert
- [ ] Test-Lauf mit Secret-Zugriff erfolgreich

---

## 2. Build und Image Hardening

### Dockerfile Best Practices

| Praxis | Beschreibung | Warum |
|--------|--------------|-------|
| **Multi-stage build** | Separate Build- und Runtime-Stages | Reduziert Image-Größe |
| **Non-root user** | `USER nonroot:nonroot` | Minimiert Berechtigungen |
| **Pinned base image** | `gcr.io/distroless/static:latest-nonroot` | Reproduzierbare Builds |
| **Remove build deps** | Keine Build-Tools im Runtime-Image | Reduziert Angriffsfläche |
| **Minimal base** | Distroless oder Alpine | Weniger Vulnerabilities |

### Dockerfile Template

```dockerfile
# Stage 1: Build
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

COPY . .

# Stage 2: Runtime
FROM gcr.io/distroless/python3-debian11:latest-nonroot

COPY --from=builder /root/.local /home/nonroot/.local
COPY --from=builder /app /app

WORKDIR /app
USER nonroot:nonroot

EXPOSE 8080
CMD ["python", "-m", "governance_postcheck.app.main"]
```

### Rootless Runtime

```bash
# Rootless Docker aktivieren
dockerd --userns-remap=default

# Podman (standardmäßig rootless)
podman build -t governance-postcheck .
```

### Validierung

- [ ] Dockerfile verwendet multi-stage build
- [ ] Runtime läuft als non-root user
- [ ] Base image gepinnt (Digest empfohlen)
- [ ] Keine Build-Dependencies im Runtime-Image
- [ ] Image-Größe optimiert (< 100MB ideal)

---

## 3. Scanning, SBOM und Policy

### Trivy Scan Konfiguration

```yaml
# .trivy.yaml
scan:
  type: image
  severity: HIGH,CRITICAL
  exit-code: 1  # Fail pipeline on findings

output:
  format: json,sarif
  report: trivy-report

ignore:
  file: .trivyignore
```

### Trivy CI Job

```yaml
trivy-scan:
  runs-on: ubuntu-latest
  steps:
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ${{ env.IMAGE_REF }}
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: 'CRITICAL,HIGH'
        exit-code: '1'

    - name: Upload Trivy scan results to GitHub Security
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

    - name: Upload Trivy JSON report
      uses: actions/upload-artifact@v3
      with:
        name: trivy-report
        path: trivy-results.json
```

### SBOM Erzeugung

```yaml
generate-sbom:
  runs-on: ubuntu-latest
  steps:
    - name: Generate SBOM with Syft
      uses: anchore/sbom-action@v0
      with:
        image: ${{ env.IMAGE_REF }}
        format: spdx-json
        output-file: sbom.spdx.json

    - name: Attest SBOM with cosign
      run: |
        cosign attest --predicate sbom.spdx.json \
          --type spdxjson \
          ${{ env.IMAGE_REF }}

    - name: Upload SBOM artifact
      uses: actions/upload-artifact@v3
      with:
        name: sbom
        path: sbom.spdx.json
```

### Trivy Triage SLA

| Severity | SLA | Eskalation |
|----------|-----|------------|
| CRITICAL | 24h | Security Owner |
| HIGH | 7 Tage | Build Owner |
| MEDIUM | 30 Tage | Backlog |
| LOW | Next Release | Backlog |

### Validierung

- [ ] Trivy Scan mit `exit-code: 1` für HIGH/CRITICAL
- [ ] SARIF-Upload zu GitHub Security / GitLab
- [ ] JSON-Report als CI-Artefakt gespeichert
- [ ] SBOM generiert und attested
- [ ] Triage-SLA definiert

---

## 4. Signing und Deploy Gates

### Keyless Signing (Empfohlen)

```yaml
sign-image:
  runs-on: ubuntu-latest
  permissions:
    id-token: write
    contents: read
    packages: write
  steps:
    - name: Install cosign
      uses: sigstore/cosign-installer@v3

    - name: Log in to registry
      uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Sign image keyless
      run: |
        cosign sign --yes \
          ghcr.io/${{ github.repository_owner }}/governance-postcheck:${{ github.sha }}
```

### Keyed Signing (Alternative)

```yaml
sign-image-keyed:
  runs-on: ubuntu-latest
  steps:
    - name: Install cosign
      uses: sigstore/cosign-installer@v3

    - name: Sign image with key
      env:
        COSIGN_KEY: ${{ secrets.COSIGN_KEY }}
        COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}
      run: |
        echo "$COSIGN_KEY" | cosign sign --key env://COSIGN_KEY \
          ghcr.io/${{ github.repository_owner }}/governance-postcheck:${{ github.sha }}
```

### Verify Deploy Gate

```yaml
verify-before-deploy:
  runs-on: ubuntu-latest
  needs: [sign-image]
  steps:
    - name: Install cosign
      uses: sigstore/cosign-installer@v3

    - name: Verify image signature
      run: |
        cosign verify --keyless \
          ghcr.io/${{ github.repository_owner }}/governance-postcheck:${{ github.sha }}

    - name: Verify SBOM attestation
      run: |
        cosign verify-attestation --type spdxjson \
          ghcr.io/${{ github.repository_owner }}/governance-postcheck:${{ github.sha }}
```

### Key Rotation (Keyed)

```bash
# Neuen Key generieren
cosign generate-key-pair

# Alten Key archivieren
mv cosign.key cosign.key.old
mv cosign.pub cosign.pub.old

# Neuen Key aktivieren
# Update CI Secret: COSIGN_KEY, COSIGN_PUB

# Images neu signieren
cosign sign --key cosign.key <image>
```

### Validierung

- [ ] Keyless OIDC Signing konfiguriert ODER
- [ ] Keyed Signing mit KMS/HSM
- [ ] Verify Gate im Deploy-Workflow
- [ ] Deploy blockiert bei fehlender Signatur
- [ ] Key Rotation Runbook vorhanden

---

## 5. Testplan und Rollout

### Phase 1: Sandbox Run

```
┌─────────────────────────────────────────────────────────────────┐
│                    SANDBOX VALIDATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Merge PR → sandbox/dev                                      │
│  2. CI Pipeline:                                                │
│     ├── Unit Tests (pytest)                                     │
│     ├── Build Image (multi-stage, non-root)                     │
│     ├── Trivy Scan (exit on HIGH/CRITICAL)                      │
│     ├── Sign Image (keyless OIDC)                               │
│     └── Push to Sandbox Registry                                │
│  3. Verify:                                                     │
│     ├── cosign verify --keyless <image>                         │
│     └── trivy image --severity CRITICAL,HIGH <image>            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Canary Deploy

```
┌─────────────────────────────────────────────────────────────────┐
│                    CANARY ROLLOUT                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Deploy signed image to Canary namespace                     │
│  2. Traffic: 1% → 10% → 50% → 100%                              │
│  3. Monitoring (24–48h):                                        │
│     ├── Prometheus: latency, error rate, throughput             │
│     ├── Logs: error patterns, anomalies                         │
│     └── Health checks: /health, /ready endpoints                │
│  4. Rollback-Trigger:                                           │
│     ├── Error rate > 1%                                         │
│     ├── p99 latency > 1s                                        │
│     └── Health check failures                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 3: Staged Promotion

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROMOTION FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Sandbox ──▶ Canary ──▶ Staging ──▶ Production                 │
│     │          │           │            │                       │
│     │          │           │            └── Requires:          │
│     │          │           │                ├── 2 Approvals    │
│     │          │           │                ├── Sign verified  │
│     │          │           │                └── Trivy clean    │
│     │          │           │                                 │
│     │          │           └── Integration Tests              │
│     │          │                                            │
│     │          └── 24–48h Monitoring                         │
│     │                                                        │
│     └── CI Green + Verify                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Validierung

- [ ] Sandbox-Run erfolgreich (alle CI-Stages grün)
- [ ] cosign verify erfolgreich
- [ ] Trivy Report clean oder akzeptierte Ausnahmen
- [ ] Canary Deployment abgeschlossen
- [ ] 24–48h Monitoring ohne kritische Alerts
- [ ] Staging Promotion mit Integration Tests
- [ ] Production Promotion mit Approvals

---

## 6. Risiken, Trade-offs und Verantwortlichkeiten

### Risiken

| Risiko | Mitigation | Owner |
|--------|------------|-------|
| Trivy blockiert Release | Ausnahmepfad mit dokumentiertem CVE + SLA | Security Owner |
| OIDC unavailable | Fallback auf Keyed Signing | Build Owner |
| Registry downtime | Multi-Registry Strategy | SRE |
| Key compromise (Keyed) | Key Rotation Runbook + KMS/HSM | Security Owner |

### Trade-offs

| Entscheidung | Pro | Contra |
|--------------|-----|--------|
| **Keyless vs Keyed** | Kein Secret-Management | OIDC-Abhängigkeit |
| **Keyed mit KMS** | Vollständige Kontrolle | Secret-Management Overhead |
| **Strikte Trivy-Policy** | Hohe Security | Potenzielle Release-Delays |
| **Lockere Trivy-Policy** | Schnellere Releases | Höheres Risiko |

### Verantwortlichkeiten (RACI)

| Aufgabe | Build Owner | Security Owner | Release Manager | SRE |
|---------|-------------|----------------|-----------------|-----|
| Dockerfile | **R** | C | I | I |
| Trivy Policy | C | **R** | I | I |
| Signing Config | C | **R** | I | C |
| Deploy Gate | C | A | **R** | **R** |
| Canary Rollout | I | I | A | **R** |
| Production Deploy | I | A | **R** | **R** |

**R** = Responsible, **A** = Accountable, **C** = Consulted, **I** = Informed

---

## 7. Sofort-To-Dos (konkret)

### A. Sandbox-Secrets und OIDC

```bash
# GitHub Secrets setzen
gh secret set REGISTRY_USERNAME --body "cargobit-bot"
gh secret set REGISTRY_PASSWORD --body "gpat_xxx"

# OIDC in Workflow aktivieren
# Siehe Workflow YAML oben
```

### B. Dockerfile finalisieren

```bash
# Dockerfile überprüfen
cat governance-postcheck/Dockerfile

# Build testen
docker build -t test/postcheck:dev governance-postcheck/

# Non-root verify
docker run --rm test/postcheck:dev whoami
# Erwartet: nonroot
```

### C. Sandbox Testlauf

```bash
# PR öffnen
gh pr create --base sandbox/dev --head feature/ci-workflows

# CI Logs beobachten
gh run watch

# Nach Erfolg: Verify
cosign verify --keyless ghcr.io/cargobit/governance-postcheck:sha-xxx
trivy image --severity CRITICAL,HIGH ghcr.io/cargobit/governance-postcheck:sha-xxx
```

### D. Canary Rollout Playbook

```bash
# Canary Namespace erstellen
kubectl create namespace canary

# Deploy mit Argo Rollouts
kubectl apply -f k8s/canary-rollout.yaml -n canary

# Traffic-Ramp beobachten
kubectl argo rollouts get rollout governance-postcheck -n canary --watch
```

---

## 8. Nächste Schritte (Optionen)

| Option | Beschreibung | Aufwand |
|--------|--------------|---------|
| **(1) Dockerfile-Checklist PR** | Konkretes PR mit Dockerfile-Verbesserungen | 1-2h |
| **(2) Trivy-Policy JSON + SARIF-Upload** | Vollständige Trivy-Konfiguration | 2-3h |
| **(3) Deploy-Gate Workflow-Snippet** | Fertiger Workflow für eure Registry | 2-3h |

---

## Block Metadata

| Field | Value |
|-------|-------|
| **Block ID** | CI |
| **Title** | Release Abschlusscheckliste |
| **Category** | Release Management, CI/CD, Security |
| **Related Blocks** | CH (PR Sandbox Template), CF (Debug Checklist), CG (Incident Response) |
| **Created** | 2026-05-07 |

---

*CargoBit Developer Portal – Multi-Agent System Documentation*
