# Patch 0011 — Dockerfile Checklist and Hardened Example

**Patch ID**: 0011
**Dateiname**: `0011-add-dockerfile-checklist.patch`
**Typ**: Feature / Security Enhancement
**Erstellt**: 2026-05-07

---

## Beschreibung

Fügt eine **Dockerfile-Checklist** und ein **härtungs-fertiges Beispiel-Dockerfile** für `governance-postcheck` hinzu.

---

## Enthaltene Dateien

| Datei | Zeilen | Beschreibung |
|-------|--------|--------------|
| `docs/Dockerfile_CHECKLIST.md` | 95 | Checkliste für Reviewer und Entwickler |
| `governance-postcheck/Dockerfile.hardened` | 43 | Beispiel-Dockerfile (multi-stage, non-root) |

---

## Anwendung

```bash
# Neuen Branch erstellen
git checkout -b chore/dockerfile/checklist

# Patch anwenden
git apply patches/git-am/0011-add-dockerfile-checklist.patch

# Oder mit git am (falls formatiert)
git am patches/git-am/0011-add-dockerfile-checklist.patch

# Dateien hinzufügen und committen
git add docs/Dockerfile_CHECKLIST.md governance-postcheck/Dockerfile.hardened
git commit -m "chore(ci): add Dockerfile checklist and hardened example for governance-postcheck"

# Push
git push -u origin chore/dockerfile/checklist
```

---

## Dockerfile Checklist (16 Prüfpunkte)

| Kategorie | Check |
|-----------|-------|
| **Build Structure** | Multi-stage Build, Pinned Base Image, Minimaler Runtime Layer |
| **Security** | Non-root User, No Secrets in Image, Security Hardening |
| **Reproducibility** | Reproducible Builds, Remove Build Tools, Layer Caching |
| **Size & Performance** | Small Image Size, Non-interactive Installs |
| **CI/CD Integration** | SBOM Generation Hook, Immutable Tags, SBOM Attestation, Testing |
| **Documentation** | Dockerfile kommentiert |

---

## Hardened Dockerfile Features

```dockerfile
# Multi-stage Build
FROM python:3.11-slim@sha256:xxx AS build
FROM python:3.11-slim@sha256:xxx AS runtime

# Non-root User (UID 1000, GID 1000)
RUN groupadd --gid 1000 appgroup && useradd --uid 1000 ...

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD curl -f http://localhost:8443/health

# Security
USER appuser
ENV PYTHONUNBUFFERED=1
```

---

## Nach dem Apply

1. **Digest ersetzen**: `REPLACE_WITH_DIGEST` durch tatsächlichen Image-Digest ersetzen
2. **Lokal testen**: `docker build -f governance-postcheck/Dockerfile.hardened -t test .`
3. **SBOM erzeugen**: `syft test:latest -o json > sbom.json`
4. **Trivy scan**: `trivy image --severity CRITICAL,HIGH test:latest`

---

## Block Metadata

| Field | Value |
|-------|-------|
| **Block ID** | CK |
| **Title** | Patch 0011 — Dockerfile Checklist |
| **Category** | Patch, Build, Security |
| **Related Blocks** | CJ (Dockerfile Checklist PR), CI (Release Checklist) |
| **Created** | 2026-05-07 |

---

*CargoBit Developer Portal – Multi-Agent System Documentation*
