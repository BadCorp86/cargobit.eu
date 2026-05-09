# Self-Healing PR-Vorlage — governance-postcheck Starter-Repo

**Ziel:** GitHub/GitLab-fertige PR-Vorlage mit Titel, Beschreibung, Reviewern, Labels und Checklisten.

---

## PR-Metadaten

| Feld | Wert |
|------|------|
| **Branch** | `ci/governance-postcheck/starter` |
| **Commit Message** | `feat(postcheck): add starter governance-postcheck service (python, docker, k8s)` |

---

## PR-Titel

```
feat(postcheck): add starter governance-postcheck service (python, docker, k8s)
```

---

## PR-Beschreibung

```markdown
## Was
Fügt ein Starter-Repo `governance-postcheck` hinzu: minimaler Python-Service, Dockerfile, Kubernetes Deployment-Manifest und einfache Tests. Der Service bietet einen `/postcheck`-Endpoint, der Prometheus abfragt und für Canary-Rollouts Pass/Fail zurückgibt.

## Warum
Benötigt für Canary PostChecks im Governance-Workflow: automatisierte Validierung von Health Scores vor Promotion von Containment/Repair-Policies.

## Enthaltene Dateien

| Datei | Beschreibung |
|-------|--------------|
| `governance-postcheck/app/main.py` | Flask HTTP API `/postcheck` |
| `governance-postcheck/app/postcheck.py` | Prometheus Query + Evaluationslogik |
| `governance-postcheck/app/requirements.txt` | Python Dependencies |
| `governance-postcheck/Dockerfile` | Container Build |
| `governance-postcheck/k8s/deployment.yaml` | Beispiel Deployment/Service |
| `governance-postcheck/tests/test_postcheck.py` | Unit Tests |
| `governance-postcheck/README.md` | Dokumentation |
| `.gitignore` | Git Ignore Regeln |

## How to Test Locally

### Build Image
```bash
docker build -t registry.example.com/governance-postcheck:local .
```

### Run Container
```bash
docker run -e PROM_URL=http://<prom-host>:9090 -p 8443:8443 registry.example.com/governance-postcheck:local
```

### Beispiel Request
```bash
curl -X POST https://localhost:8443/postcheck \
  -H "Content-Type: application/json" \
  -d '{"partner":"p","endpoint":"e","region":"r","required_health":85,"window":300}'
```

### Unit Tests
```bash
pytest governance-postcheck/tests
```

## CI Checks

| Check | Tool |
|-------|------|
| Linting | `yamllint` für k8s Manifeste |
| Python | `pytest` für Unit Tests |
| Security | Container Scan (Trivy) |

## Voraussetzungen vor Merge

- [ ] Image Registry URL in `k8s/deployment.yaml` an interne Registry anpassen
- [ ] PROM_URL in Deployment auf interne Prometheus-URL setzen
- [ ] TLS/Authentication für Prod-Endpoint planen

## Merge Kriterien

- [ ] CI grün (Unit Tests bestanden)
- [ ] Reviewer Freigabe durch Observability Engineer und SRE Lead
- [ ] Image Tagging/Registry-Plan dokumentiert in PR-Kommentare
```

---

## Reviewer Vorschläge

| Rolle | Handle |
|-------|--------|
| **Observability Engineer** | `@observability-team` |
| **SRE Lead** | `@sre-lead` |
| **Platform Security** | `@platform-security` |

---

## Labels

| Label | Beschreibung |
|-------|--------------|
| `type:feature` | Neues Feature |
| `area:governance` | Governance-Komponente |
| `needs-review` | Review erforderlich |
| `ci-required` | CI muss laufen |

---

## Assignees

| Rolle | Handle |
|-------|--------|
| **CI Owner** | `@platform-ci` |

---

## Reviewer Checklist

```markdown
- [ ] Code Review: `app/postcheck.py` Logik und Fehlerbehandlung geprüft
- [ ] Tests: `governance-postcheck/tests` laufen lokal/CI grün
- [ ] Security: Dockerfile minimal und SCA-Scan geplant
- [ ] Deployment: `k8s/deployment.yaml` Image-URL und PROM_URL angepasst
- [ ] Operational: Health/Readiness Probes und Logging ergänzt (Empfehlung vor Prod)
```

---

## Git Befehle

```bash
# Branch erstellen
git checkout -b ci/governance-postcheck/starter

# Dateien hinzufügen
git add governance-postcheck

# Commit
git commit -m "feat(postcheck): add starter governance-postcheck service (python, docker, k8s)"

# Push
git push -u origin ci/governance-postcheck/starter
```

---

## GitHub PR Template (Frontmatter)

```yaml
---
title: "feat(postcheck): add starter governance-postcheck service"
labels:
  - type:feature
  - area:governance
  - needs-review
  - ci-required
assignees:
  - platform-ci
reviewers:
  - observability-team
  - sre-lead
  - platform-security
---
```

---

## GitLab MR Template

```markdown
## Merge Request

**Target Branch:** main  
**Source Branch:** ci/governance-postcheck/starter

### Quick Actions
/label ~"type:feature" ~"area:governance" ~"needs-review" ~"ci-required"
/assign @platform-ci
/cc @observability-team @sre-lead @platform-security

---

[Beschreibung hier einfügen]
```

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
