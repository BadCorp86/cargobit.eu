# PR Kommentar Vorlage für Sandbox-Runs

**Kurzfassung**
**Was**: CI Build → Test → Trivy Scan → Sign → Push für `governance-postcheck`.
**Ziel**: Schnelle Triage bei CI-Fehlern, Verifikation von Signaturen und Freigabe für Canary.

---

## PR Header (einzeilig)

```
**PR:** `ci(postcheck): add CI workflows + key rotation runbook — sandbox validation`
```

---

## PR Beschreibung (kopierbar)

### Kurzbeschreibung
Fügt GitLab CI, GitHub Actions (keyless) Workflows und ein Key-Rotation Runbook hinzu. Ziel dieses PRs ist die Validierung in der Sandbox: Tests, Sicherheits-Scans, Signaturen und Push in die Sandbox-Registry.

### Was zu prüfen
- [ ] **Unit Tests** laufen lokal und in CI (pytest).
- [ ] **Docker Build** erfolgreich (multi-stage, non-root).
- [ ] **Trivy Scan**: keine HIGH/CRITICAL Findings oder dokumentierte Ausnahmen.
- [ ] **Signing**: Keyless Signing (OIDC) erfolgreich; Rekor-Eintrag vorhanden.
- [ ] **Push**: Image wurde in Sandbox-Registry gepusht.
- [ ] **Runbook**: `SECURITY/KEY_ROTATION.md` geprüft.

### Voraussetzungen (Sandbox)
- Secrets gesetzt: `REGISTRY_USERNAME`, `REGISTRY_PASSWORD` (oder `GITHUB_TOKEN` für GHCR).
- Optional (keyed): `COSIGN_KEY` / `COSIGN_KEY_BASE64` in Sandbox-Secrets.
- OIDC/ID-Token für Keyless aktiviert (GitHub `id-token: write` oder GitLab Runner JWT).

### Testanleitung (Kurz)
1. Merge Branch in **sandbox/dev** oder öffne MR/PR gegen `dev`.
2. Beobachte CI: `unit-tests` → `build-image` → `scan-image` → `sign-image` → `push-image`.
3. Nach erfolgreichem Run: verifiziere Signatur und SBOM.

### Wichtige Befehle (für Reviewer / Devs)

| Task | Befehl |
|------|--------|
| Unit Tests | `pytest governance-postcheck/tests -q` |
| Lokaler Build | `docker build -t local/postcheck:dev governance-postcheck` |
| Trivy lokal | `trivy image --severity CRITICAL,HIGH registry.example.com/governance-postcheck:<TAG>` |
| Keyless Verify | `cosign verify --keyless ghcr.io/ORG/governance-postcheck:<TAG>` |
| Keyed Verify | `echo "$COSIGN_PUB" > cosign.pub && cosign verify --key cosign.pub registry.example.com/governance-postcheck:<TAG>` |
| SBOM erzeugen | `syft registry.example.com/governance-postcheck:<TAG> -o json > sbom.json` |

### Logs / Artefakte (bei Fehler)
- `unit-tests.log` (pytest output)
- `build.log` (letzte 100 Zeilen Docker build)
- `trivy.log` (Trivy JSON/SARIF)
- `sign.log` (cosign output + Rekor index)

Füge die relevanten Logs an die PR-Kommentare an.

### Schnelle Triage-Regeln

| Fehler | Aktion |
|--------|--------|
| Trivy HIGH/CRITICAL | Blocker: Fix oder dokumentierte Ausnahme mit Owner |
| Signaturfehler (Keyless) | Prüfe OIDC Token / Workflow `id-token` permission |
| Push-Fehler | Registry Credentials / ACL prüfen |

---

## Reviewer Checklist (kopierbar)

- [ ] Secrets in Sandbox vorhanden (liste: `REGISTRY_*`, optional `COSIGN_*`).
- [ ] CI Run in Sandbox grün.
- [ ] Trivy Findings akzeptiert oder dokumentiert.
- [ ] cosign Verify erfolgreich (Keyless Rekor-Eintrag oder keyed verify).
- [ ] `SECURITY/KEY_ROTATION.md` reviewed and approved.
- [ ] Approve for Canary deployment.

---

## Abschluss-Notiz (für Merge)

**Empfehlung:** Nach Sandbox-Erfolg: Canary Deploy → 24–48h Monitoring → Staged Promotion. Dokumentiere Key-Rotation-Plan und Trivy-Ausnahmen im Release-Notes.

---

## CI Pipeline Flow (Referenz)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SANBOX CI PIPELINE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │  Unit    │──▶│  Build   │──▶│  Trivy   │──▶│  Sign    │     │
│  │  Tests   │   │  Image   │   │  Scan    │   │  Image   │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│       │              │              │              │            │
│       ▼              ▼              ▼              ▼            │
│   pytest.log     build.log     trivy.log      sign.log         │
│                                                                  │
│                                              ┌──────────┐        │
│                                              │  Push    │        │
│                                              │  Image   │        │
│                                              └──────────┘        │
│                                                   │              │
│                                                   ▼              │
│                                            Sandbox Registry      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Englische Version (English Version)

### PR Header
```
**PR:** `ci(postcheck): add CI workflows + key rotation runbook — sandbox validation`
```

### PR Description

**Summary**
Adds GitLab CI, GitHub Actions (keyless) workflows, and a key rotation runbook. Goal: Validate in sandbox - tests, security scans, signatures, and push to sandbox registry.

**Review Checklist**
- [ ] **Unit Tests** pass locally and in CI (pytest).
- [ ] **Docker Build** successful (multi-stage, non-root).
- [ ] **Trivy Scan**: no HIGH/CRITICAL findings or documented exceptions.
- [ ] **Signing**: Keyless Signing (OIDC) successful; Rekor entry exists.
- [ ] **Push**: Image pushed to sandbox registry.
- [ ] **Runbook**: `SECURITY/KEY_ROTATION.md` reviewed.

**Prerequisites (Sandbox)**
- Secrets set: `REGISTRY_USERNAME`, `REGISTRY_PASSWORD` (or `GITHUB_TOKEN` for GHCR).
- Optional (keyed): `COSIGN_KEY` / `COSIGN_KEY_BASE64` in sandbox secrets.
- OIDC/ID-Token for keyless enabled (GitHub `id-token: write` or GitLab Runner JWT).

**Test Instructions**
1. Merge branch into **sandbox/dev** or open MR/PR against `dev`.
2. Observe CI: `unit-tests` → `build-image` → `scan-image` → `sign-image` → `push-image`.
3. After success: verify signature and SBOM.

**Key Commands (for Reviewers/Devs)**
- Unit Tests: `pytest governance-postcheck/tests -q`
- Local Build: `docker build -t local/postcheck:dev governance-postcheck`
- Trivy local: `trivy image --severity CRITICAL,HIGH registry.example.com/governance-postcheck:<TAG>`
- Keyless Verify: `cosign verify --keyless ghcr.io/ORG/governance-postcheck:<TAG>`
- Keyed Verify: `echo "$COSIGN_PUB" > cosign.pub && cosign verify --key cosign.pub registry.example.com/governance-postcheck:<TAG>`
- SBOM Generate: `syft registry.example.com/governance-postcheck:<TAG> -o json > sbom.json`

**Quick Triage Rules**
- Trivy HIGH/CRITICAL → Blocker: Fix or documented exception with owner.
- Signature failure (keyless) → Check OIDC token / workflow `id-token` permission.
- Push failure → Check registry credentials / ACL.

### Reviewer Checklist
- [ ] Secrets present in sandbox (list: `REGISTRY_*`, optional `COSIGN_*`).
- [ ] CI run green in sandbox.
- [ ] Trivy findings accepted or documented.
- [ ] cosign verify successful (keyless Rekor entry or keyed verify).
- [ ] `SECURITY/KEY_ROTATION.md` reviewed and approved.
- [ ] Approve for Canary deployment.

### Merge Note
**Recommendation:** After sandbox success: Canary Deploy → 24–48h Monitoring → Staged Promotion. Document key rotation plan and Trivy exceptions in release notes.

---

## Block Metadata

| Field | Value |
|-------|-------|
| **Block ID** | CH |
| **Title** | PR Kommentar Vorlage für Sandbox-Runs |
| **Category** | CI/CD, PR Templates, Sandbox Validation |
| **Related Blocks** | BY (PR/MR Templates), CF (Debug Checklist), CG (Incident Response) |
| **Created** | 2026-05-07 |

---

*CargoBit Developer Portal – Multi-Agent System Documentation*
