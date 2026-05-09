# Dockerfile Checklist Pull Request

**Ziel**: Füge eine konkrete Dockerfile-Checklist und ein Beispiel-Dockerfile hinzu, damit Build-Owner und Reviewer schnell prüfen können, ob das Image hardened, reproduzierbar und CI-freundlich ist.

---

## PR Titel

```
chore(ci): add Dockerfile checklist and hardened example for governance-postcheck
```

---

## PR Beschreibung (kopierbar)

**Kurzbeschreibung**
Dieser PR ergänzt das Repository um eine **Dockerfile-Checklist** und ein **härtungs-fertiges Beispiel-Dockerfile** für `governance-postcheck`. Ziel ist, Build-Qualität, Sicherheit und Reproduzierbarkeit zu standardisieren.

**Enthaltene Dateien**
- `docs/Dockerfile_CHECKLIST.md` — Checkliste für Reviewer und Entwickler.
- `governance-postcheck/Dockerfile.hardened` — Beispiel-Dockerfile (multi-stage, non-root, SBOM hooks).

**Was zu prüfen**
- [ ] Checklist vollständig und verständlich.
- [ ] Beispiel-Dockerfile baut lokal und in CI.
- [ ] SBOM erzeugt und als Artefakt in CI verfügbar.
- [ ] Image läuft non-root und enthält keine Build-Artefakte.

**Testanleitung**
1. Lokaler Build: `docker build -f governance-postcheck/Dockerfile.hardened -t local/postcheck:dev .`
2. SBOM erzeugen: `syft local/postcheck:dev -o json > sbom.json`
3. Run: `docker run --rm -p 8443:8443 local/postcheck:dev`
4. Signatur (nach CI): `cosign verify --keyless <registry>/governance-postcheck:<TAG>`

---

## Dockerfile Checklist (`docs/Dockerfile_CHECKLIST.md`)

**Kurz:** Prüfpunkte, die jeder Dockerfile-PR erfüllen muss.

### Build Structure

| Check | Beschreibung |
|-------|--------------|
| **Multi-stage Build** | Build-Artefakte werden in einer separaten Stage erzeugt und nicht in das Runtime-Image übernommen. |
| **Pinned Base Image** | Verwende ein konkretes Tag oder Digest (z. B. `python:3.11-slim@sha256:...`). |
| **Minimaler Runtime Layer** | Nutze ein kleines, geprüftes Runtime Image (Debian slim, distroless, alpine) für die final stage. |

### Security

| Check | Beschreibung |
|-------|--------------|
| **Non-root User** | Erstelle und wechsle zu einem nicht-privilegierten User (`USER appuser`). |
| **No Secrets in Image** | Keine Secrets, Tokens oder private Keys im Image oder Dockerfile. |
| **Security Hardening** | Setze `HEALTHCHECK`, `USER`, `WORKDIR`, `EXPOSE` sinnvoll. |

### Reproducibility

| Check | Beschreibung |
|-------|--------------|
| **Reproducible Builds** | Setze `ENV` Variablen für Versionsnummern; vermeide `latest`. |
| **Remove Build Tools** | Entferne Compiler, package managers und caches in der final stage. |
| **Layer Caching** | Reihenfolge der Dockerfile-Anweisungen optimiert für Cache-Hits. |

### Size & Performance

| Check | Beschreibung |
|-------|--------------|
| **Small Image Size** | Ziel: möglichst klein; dokumentiere Gründe für Abweichungen. |
| **Non-interactive Installs** | Verwende `DEBIAN_FRONTEND=noninteractive` bei apt-Installs. |

### CI/CD Integration

| Check | Beschreibung |
|-------|--------------|
| **SBOM Generation Hook** | Stelle sicher, dass CI SBOM (syft) gegen das gebaute Image erzeugen kann. |
| **Immutable Tags for Production** | Produktion: push mit Digest; Deploys sollten Digest-based sein. |
| **SBOM and Attestation** | CI erzeugt SBOM und `cosign attest` optional. |
| **Testing** | Image enthält keine test-only artefacts; Unit tests laufen vor Build. |

### Documentation

| Check | Beschreibung |
|-------|--------------|
| **Documentation** | Dockerfile kommentiert; README ergänzt mit Run/Debug Befehlen. |

---

## Hardened Example Dockerfile (`governance-postcheck/Dockerfile.hardened`)

```dockerfile
# ---- build stage ----
FROM python:3.11-slim@sha256:REPLACE_WITH_DIGEST AS build
WORKDIR /src

# Install build deps
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libssl-dev ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy and install python deps into a wheelhouse
COPY governance-postcheck/app/requirements.txt .
RUN python -m pip install --upgrade pip wheel setuptools
RUN python -m pip wheel -r requirements.txt -w /wheels

# Copy source
COPY governance-postcheck /src/governance-postcheck

# ---- runtime stage ----
FROM python:3.11-slim@sha256:REPLACE_WITH_DIGEST AS runtime
# Create non-root user
RUN groupadd --gid 1000 appgroup \
  && useradd --uid 1000 --gid appgroup --shell /bin/false --create-home appuser

WORKDIR /app

# Install runtime deps from wheelhouse
COPY --from=build /wheels /wheels
RUN python -m pip install --no-index --find-links=/wheels -r /src/governance-postcheck/app/requirements.txt \
  && rm -rf /wheels /root/.cache/pip

# Copy only runtime files
COPY --from=build /src/governance-postcheck /app

# Security: drop capabilities and run as non-root
USER appuser
ENV PYTHONUNBUFFERED=1

# Healthcheck and metadata
EXPOSE 8443
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD curl -f http://localhost:8443/health || exit 1

# Entrypoint
CMD ["python", "-m", "governance_postcheck.main"]
```

### Wichtige Hinweise

| Punkt | Beschreibung |
|-------|--------------|
| **Digest ersetzen** | Ersetze `REPLACE_WITH_DIGEST` durch den tatsächlichen Image Digest oder ein festes Tag. |
| **Keine Secrets** | Kein Secret darf in den Layers landen. Secrets werden zur Laufzeit via CI/CD gesetzt. |
| **User ID** | UID 1000, GID 1000 als Standard für non-root. |

---

## CI Integration Hinweise

### SBOM Erzeugung (GitHub Actions / GitLab CI)

Nach `docker build` in CI:

```bash
syft <image-ref> -o json > sbom.json
```

Lade `sbom.json` als Job-Artefakt hoch.

### Trivy Scan

Scanne das gebaute Image in CI:

```bash
trivy image --format json --output trivy.json --severity CRITICAL,HIGH <image-ref>
```

Lade `trivy.json` als Artefakt; fail job bei Findings nach Policy.

### Signing

| Methode | Befehl |
|---------|--------|
| **Keyless** | `cosign sign --keyless <image-ref>` in Sign-Job |
| **Attestation** | `cosign attest --predicate sbom.json --type sbom <image-ref>` |

### Verify in Deploy

Deploy-Gate:

```bash
cosign verify --keyless <image-ref>
# oder keyed verify mit COSIGN_PUB
```

---

## Testbefehle für Reviewer

### Build lokal

```bash
docker build -f governance-postcheck/Dockerfile.hardened -t local/postcheck:dev .
```

### SBOM

```bash
syft local/postcheck:dev -o json > sbom.json
```

### Trivy

```bash
trivy image --severity CRITICAL,HIGH local/postcheck:dev
```

### Run

```bash
docker run --rm -p 8443:8443 local/postcheck:dev
curl -sS http://localhost:8443/health
```

### Verify signature (nach CI push & sign)

```bash
cosign verify --keyless ghcr.io/ORG/governance-postcheck:<TAG>
```

---

## PR Reviewer Checklist (kopierbar)

- [ ] Dockerfile verwendet Multi-stage Build.
- [ ] Final image läuft als **non-root**.
- [ ] Keine Build-Tools in final image.
- [ ] Base images sind gepinnt (Tag oder Digest).
- [ ] SBOM wird in CI erzeugt und als Artefakt gespeichert.
- [ ] Trivy Scan läuft und Policy ist dokumentiert.
- [ ] Signatur wird in CI erzeugt (keyless oder keyed).
- [ ] Healthcheck vorhanden und sinnvoll.
- [ ] README ergänzt mit Build/Run/Verify Befehlen.

---

## Weiterführende Optionen

| Option | Beschreibung |
|--------|--------------|
| **A** | Tatsächliche Dateien (`docs/Dockerfile_CHECKLIST.md` und `governance-postcheck/Dockerfile.hardened`) als apply-able patches |
| **B** | Kurzes PR-Kommentar mit dieser Checkliste formatiert für eure PR-Template |

---

## Block Metadata

| Field | Value |
|-------|-------|
| **Block ID** | CJ |
| **Title** | Dockerfile Checklist Pull Request |
| **Category** | Build, Security, CI/CD |
| **Related Blocks** | CI (Release Checklist), CF (Debug Checklist), CH (PR Sandbox Template) |
| **Created** | 2026-05-07 |

---

*CargoBit Developer Portal – Multi-Agent System Documentation*
