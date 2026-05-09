# Block BY – Governance PostCheck PR/MR Templates

**Status:** Production-Ready  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-05-06  
**Teil von:** CargoBit Multi-Agent System – Self-Healing Implementation Stack

---

## Übersicht

Dieser Block enthält kopierfertige Templates für:

| Plattform | Datei | Verwendung |
|-----------|-------|------------|
| GitHub | `.github/PULL_REQUEST_TEMPLATE.md` | PR-Erstellung mit Frontmatter |
| GitLab | `.gitlab/merge_request_templates/governance-postcheck.md` | MR-Vorlage mit Labels/Reviewers |

---

## 1. GitHub PR-Template

### Speicherort
```
.github/PULL_REQUEST_TEMPLATE.md
```

### Vollständiger Inhalt

```markdown
---
title: "feat(postcheck): add starter governance-postcheck service (python, docker, k8s)"
labels: ["type:feature","area:governance","needs-review","ci-required"]
assignees: ["platform-ci"]
reviewers: ["observability-team","sre-lead","platform-security"]
---

## Kurzbeschreibung
**Was:** Starter-Repo `governance-postcheck` mit minimalem Python PostCheck Service, Dockerfile, Kubernetes-Deployment und einfachen Tests.  
**Warum:** Automatisierte Canary PostChecks für Governance-Workflows (Health Score Validierung vor Promotion).

## Enthaltene Dateien
- `governance-postcheck/app/main.py` — Flask API `/postcheck`  
- `governance-postcheck/app/postcheck.py` — Prometheus-Query + Evaluationslogik  
- `governance-postcheck/app/requirements.txt`  
- `governance-postcheck/Dockerfile`  
- `governance-postcheck/k8s/deployment.yaml` — Beispiel Deployment/Service  
- `governance-postcheck/tests/test_postcheck.py`  
- `governance-postcheck/README.md`  
- `.gitignore`

## How to test lokal
1. Build: `docker build -t registry.example.com/governance-postcheck:local governance-postcheck/`  
2. Run: `docker run -e PROM_URL=http://<prom-host>:9090 -p 8443:8443 registry.example.com/governance-postcheck:local`  
3. Beispiel Request:
```bash
curl -X POST http://localhost:8443/postcheck \
  -H "Content-Type: application/json" \
  -d '{"partner":"p","endpoint":"e","region":"r","required_health":85,"window":300}'
```
4. Unit Tests: `pytest governance-postcheck/tests`

## CI Checks (erwartet)
- Python: `pip install -r governance-postcheck/app/requirements.txt` und `pytest`  
- Container Security Scan (z. B. Trivy) vor Push in Registry  
- YAML Lint für `k8s/deployment.yaml` falls CI vorhanden

## Voraussetzungen vor Merge
- Image Registry URL in `governance-postcheck/k8s/deployment.yaml` an interne Registry anpassen.  
- `PROM_URL` in Deployment auf interne Prometheus-URL setzen.  
- TLS/Authentication für Prod-Endpoint planen (nicht im Starter enthalten).

## Merge-Kriterien
- [ ] CI grün (Unit Tests bestanden)  
- [ ] Observability Engineer und SRE Lead haben Review freigegeben  
- [ ] Image Tagging/Registry-Plan dokumentiert in PR-Kommentare

## Reviewer-Checklist
- [ ] `app/postcheck.py` Logik und Fehlerbehandlung geprüft  
- [ ] Tests laufen lokal/CI grün  
- [ ] Dockerfile minimal; SCA-Scan geplant  
- [ ] `k8s/deployment.yaml` Image-URL und `PROM_URL` angepasst  
- [ ] Operational: Health/Readiness Probes und Logging ergänzt (Empfehlung vor Prod)
```

---

## 2. GitLab MR-Template

### Speicherort
```
.gitlab/merge_request_templates/governance-postcheck.md
```

### Vollständiger Inhalt

```markdown
# Title
feat(postcheck): add starter governance-postcheck service (python, docker, k8s)

# Description
**Was:** Starter-Repo `governance-postcheck` mit minimalem Python PostCheck Service, Dockerfile, Kubernetes-Deployment und Tests.  
**Warum:** Automatisierte Canary PostChecks für Governance-Workflows (Health Score Validierung vor Promotion).

# Enthaltene Dateien
- governance-postcheck/app/main.py
- governance-postcheck/app/postcheck.py
- governance-postcheck/app/requirements.txt
- governance-postcheck/Dockerfile
- governance-postcheck/k8s/deployment.yaml
- governance-postcheck/tests/test_postcheck.py
- governance-postcheck/README.md
- .gitignore

# How to test lokal
1. Build: `docker build -t registry.example.com/governance-postcheck:local governance-postcheck/`  
2. Run: `docker run -e PROM_URL=http://<prom-host>:9090 -p 8443:8443 registry.example.com/governance-postcheck:local`  
3. Beispiel Request:
```bash
curl -X POST http://localhost:8443/postcheck \
  -H "Content-Type: application/json" \
  -d '{"partner":"p","endpoint":"e","region":"r","required_health":85,"window":300}'
```
4. Unit Tests: `pytest governance-postcheck/tests`

# CI Checks
- Python tests (pytest)  
- Container SCA (Trivy)  
- YAML Lint für k8s Manifeste

# Merge Voraussetzungen
- Image Registry URL angepasst  
- PROM_URL gesetzt  
- TLS/Auth für Prod geplant

# Merge Kriterien
- [ ] CI grün  
- [ ] Review: Observability Engineer, SRE Lead  
- [ ] Image/Registry Plan dokumentiert

# Suggested Reviewers
- @observability-team
- @sre-lead
- @platform-security

# Labels
- type::feature
- area::governance
- needs-review
- ci-required
```

---

## 3. Template-Anpassungen

### GitHub: Konkrete Usernamen

Ersetze die Platzhalter in der Frontmatter-Section:

| Platzhalter | Ersetze durch |
|-------------|---------------|
| `platform-ci` | Tatsächlicher CI-Bot Username |
| `observability-team` | Team-Handle oder individueller Username |
| `sre-lead` | Concret: z.B. `@jdoe-sre` |
| `platform-security` | Security-Team Handle |

**Beispiel angepasst:**
```yaml
---
title: "feat(postcheck): add starter governance-postcheck service"
labels: ["type:feature","area:governance","needs-review","ci-required"]
assignees: ["cargobit-ci-bot"]
reviewers: ["observability-squad","jdoe-sre","security-champion"]
---
```

### GitLab: Projekt-spezifische Labels

GitLab verwendet `::` statt `-` für Label-Hierarchien:

| GitHub Label | GitLab Label |
|--------------|--------------|
| `type:feature` | `type::feature` |
| `area:governance` | `area::governance` |
| `needs-review` | `status::needs-review` |
| `ci-required` | `pipeline::ci-required` |

---

## 4. Datei-Struktur im Repo

```
governance-postcheck/
├── .github/
│   └── PULL_REQUEST_TEMPLATE.md    ← GitHub Template
├── .gitlab/
│   └── merge_request_templates/
│       └── governance-postcheck.md ← GitLab Template
├── app/
│   ├── main.py
│   ├── postcheck.py
│   └── requirements.txt
├── k8s/
│   └── deployment.yaml
├── tests/
│   └── test_postcheck.py
├── Dockerfile
├── README.md
└── .gitignore
```

---

## 5. Automatische Template-Auswahl

### GitHub
- Template wird automatisch beim PR-Erstellen angezeigt
- Bei mehreren Templates: Dropdown im PR-Formular

### GitLab
- MR erstellen → "Choose a template" Dropdown
- Template-Name: `governance-postcheck`

---

## Block-Metadaten

| Feld | Wert |
|------|------|
| Block-ID | BY |
| Erstellt | 2026-05-06 |
| Abhängigkeiten | Block BX (governance-postcheck Starter) |
| Nächster Block | BZ (Full Index / Final Summary) |
| Status | Production-Ready |

---

## Nächste Schritte

| Option | Beschreibung |
|--------|--------------|
| **Full Index** | Alle Blöcke BJ-BY in einer Übersicht |
| **DP-GOS** | Governance Operating System Zusammenfassung |
| **Block BZ** | Finaler Implementierungs-Guide |
