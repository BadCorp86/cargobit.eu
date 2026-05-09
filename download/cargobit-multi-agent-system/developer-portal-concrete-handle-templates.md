# Block CA – Concrete Handle Templates (GitLab & GitHub)

**Status:** Production-Ready  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-05-06  
**Teil von:** CargoBit Multi-Agent System – Self-Healing Implementation Stack

---

## Übersicht

| Template | Plattform | Handle-Format |
|----------|-----------|---------------|
| MR-Template | GitLab | `@your-org/<team>` |
| PR-Frontmatter | GitHub | `@your-org/<team>` |

---

## 1. GitLab MR-Template (mit konkreten Handles)

### Speicherort
```
.gitlab/merge_request_templates/postcheck-starter.md
```

### Vollständiger Inhalt

```markdown
# feat(postcheck): add starter governance-postcheck service (python, docker, k8s)

## Kurzbeschreibung
**Was:** Starter-Repo `governance-postcheck` mit minimalem Python PostCheck Service, Dockerfile, Kubernetes-Deployment und Tests.  
**Warum:** Automatisierte Canary PostChecks für Governance-Workflows (Health Score Validierung vor Promotion).

## Enthaltene Dateien
- governance-postcheck/app/main.py  
- governance-postcheck/app/postcheck.py  
- governance-postcheck/app/requirements.txt  
- governance-postcheck/Dockerfile  
- governance-postcheck/k8s/deployment.yaml  
- governance-postcheck/tests/test_postcheck.py  
- governance-postcheck/README.md  
- .gitignore

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
- [ ] Observability Team und SRE Lead haben Review freigegeben  
- [ ] Image Tagging/Registry-Plan dokumentiert in MR-Kommentare

## Reviewer-Checklist
- [ ] `app/postcheck.py` Logik und Fehlerbehandlung geprüft  
- [ ] Tests laufen lokal/CI grün  
- [ ] Dockerfile minimal; SCA-Scan geplant  
- [ ] `k8s/deployment.yaml` Image-URL und `PROM_URL` angepasst  
- [ ] Operational: Health/Readiness Probes und Logging ergänzt (Empfehlung vor Prod)

## Suggested Reviewers / Teams (konkret)
- `@your-org/observability-team`  
- `@your-org/sre-lead`  
- `@your-org/platform-security`
```

### One-Liner zur Erstellung

```bash
mkdir -p .gitlab/merge_request_templates && cat > .gitlab/merge_request_templates/postcheck-starter.md <<'EOF'
# feat(postcheck): add starter governance-postcheck service (python, docker, k8s)

## Kurzbeschreibung
**Was:** Starter-Repo governance-postcheck mit minimalem Python PostCheck Service, Dockerfile, Kubernetes-Deployment und Tests.  
**Warum:** Automatisierte Canary PostChecks für Governance-Workflows (Health Score Validierung vor Promotion).

## Enthaltene Dateien
- governance-postcheck/app/main.py  
- governance-postcheck/app/postcheck.py  
- governance-postcheck/app/requirements.txt  
- governance-postcheck/Dockerfile  
- governance-postcheck/k8s/deployment.yaml  
- governance-postcheck/tests/test_postcheck.py  
- governance-postcheck/README.md  
- .gitignore

## How to test lokal
1. Build: docker build -t registry.example.com/governance-postcheck:local governance-postcheck/  
2. Run: docker run -e PROM_URL=http://<prom-host>:9090 -p 8443:8443 registry.example.com/governance-postcheck:local  
3. Beispiel Request: curl -X POST http://localhost:8443/postcheck -H "Content-Type: application/json" -d '{"partner":"p","endpoint":"e","region":"r","required_health":85,"window":300}'
4. Unit Tests: pytest governance-postcheck/tests

## CI Checks (erwartet)
- Python: pip install -r governance-postcheck/app/requirements.txt und pytest  
- Container Security Scan (Trivy) vor Push in Registry  
- YAML Lint für k8s/deployment.yaml

## Voraussetzungen vor Merge
- Image Registry URL in governance-postcheck/k8s/deployment.yaml anpassen  
- PROM_URL in Deployment auf interne Prometheus-URL setzen  
- TLS/Authentication für Prod-Endpoint planen

## Merge-Kriterien
- [ ] CI grün (Unit Tests bestanden)  
- [ ] Observability Team und SRE Lead haben Review freigegeben  
- [ ] Image Tagging/Registry-Plan dokumentiert

## Reviewer-Checklist
- [ ] app/postcheck.py Logik und Fehlerbehandlung geprüft  
- [ ] Tests laufen lokal/CI grün  
- [ ] Dockerfile minimal; SCA-Scan geplant  
- [ ] k8s/deployment.yaml Image-URL und PROM_URL angepasst  
- [ ] Operational: Health/Readiness Probes und Logging ergänzt

## Suggested Reviewers / Teams (konkret)
- @your-org/observability-team  
- @your-org/sre-lead  
- @your-org/platform-security
EOF
```

---

## 2. GitHub PR-Frontmatter (mit konkreten Handles)

### Speicherort
```
.github/PULL_REQUEST_TEMPLATE.md
```

### Vollständiger Inhalt

```markdown
---
title: "feat(postcheck): add starter governance-postcheck service (python, docker, k8s)"
labels: ["type:feature","area:governance","needs-review","ci-required"]
assignees: ["@your-org/platform-ci"]
reviewers: ["@your-org/observability-team","@your-org/sre-lead","@your-org/platform-security"]
---

## Kurzbeschreibung
**Was:** Starter-Repo `governance-postcheck` mit minimalem Python PostCheck Service, Dockerfile, Kubernetes-Deployment und einfachen Tests.  
**Warum:** Automatisierte Canary PostChecks für Governance-Workflows (Health Score Validierung vor Promotion).

## Enthaltene Dateien
- `governance-postcheck/app/main.py`  
- `governance-postcheck/app/postcheck.py`  
- `governance-postcheck/app/requirements.txt`  
- `governance-postcheck/Dockerfile`  
- `governance-postcheck/k8s/deployment.yaml`  
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
- Python tests (pytest)  
- Container SCA (Trivy)  
- YAML Lint für k8s Manifeste

## Merge Voraussetzungen
- Image Registry URL angepasst  
- PROM_URL gesetzt  
- TLS/Auth für Prod geplant

## Merge Kriterien
- [ ] CI grün  
- [ ] Review: Observability Team, SRE Lead  
- [ ] Image/Registry Plan dokumentiert

## Reviewer-Checklist
- [ ] `app/postcheck.py` Logik und Fehlerbehandlung geprüft  
- [ ] Tests laufen lokal/CI grün  
- [ ] Dockerfile minimal; SCA-Scan geplant  
- [ ] `k8s/deployment.yaml` Image-URL und `PROM_URL` angepasst  
- [ ] Operational: Health/Readiness Probes und Logging ergänzt (Empfehlung vor Prod)
```

---

## 3. Handle-Mapping Referenz

### Platzhalter-Format

| Rolle | Placeholder | Beispiel CargoBit |
|-------|-------------|-------------------|
| Observability Team | `@your-org/observability-team` | `@cargobit/observability-squad` |
| SRE Lead | `@your-org/sre-lead` | `@cargobit/sre-lead` |
| Platform Security | `@your-org/platform-security` | `@cargobit/security-champion` |
| Platform CI | `@your-org/platform-ci` | `@cargobit/ci-bot` |

### Handle-Austausch-Workflow

**Eingabe-Format:**
```
observability: @acme/observability-team
sre: @acme/sre-lead
security: @acme/platform-security
ci: @acme/platform-ci
```

**Automatische Ersetzung:**
```
@your-org/observability-team → @acme/observability-team
@your-org/sre-lead          → @acme/sre-lead
@your-org/platform-security → @acme/platform-security
@your-org/platform-ci       → @acme/platform-ci
```

---

## 4. Quick-Replace Script

```bash
#!/bin/bash
# replace-handles.sh
# Usage: ./replace-handles.sh <org-name>

ORG="$1"

if [ -z "$ORG" ]; then
  echo "Usage: ./replace-handles.sh <org-name>"
  echo "Example: ./replace-handles.sh cargobit"
  exit 1
fi

# GitLab Template
sed -i "s|@your-org/|@${ORG}/|g" .gitlab/merge_request_templates/postcheck-starter.md

# GitHub Template
sed -i "s|@your-org/|@${ORG}/|g" .github/PULL_REQUEST_TEMPLATE.md

echo "✅ Handles replaced with @${ORG}/ prefix"
```

---

## 5. Git Patch für beide Templates

```diff
From 0000000000000000000000000000000000000000 Mon Sep 17 00:00:00 2001
From: Platform CI <platform-ci@example.com>
Date: 2026-05-06
Subject: [PATCH] feat(ci): add concrete handle templates for gitlab and github

---
 .gitlab/merge_request_templates/postcheck-starter.md | 54 ++++++++++
 .github/PULL_REQUEST_TEMPLATE.md                     | 56 ++++++++++
 2 files changed, 110 insertions(+)
 create mode 100644 .gitlab/merge_request_templates/postcheck-starter.md
 create mode 100644 .github/PULL_REQUEST_TEMPLATE.md

diff --git a/.gitlab/merge_request_templates/postcheck-starter.md b/.gitlab/merge_request_templates/postcheck-starter.md
new file mode 100644
index 0000000..abcdef1
--- /dev/null
+++ b/.gitlab/merge_request_templates/postcheck-starter.md
@@ -0,0 +1,54 @@
+# feat(postcheck): add starter governance-postcheck service (python, docker, k8s)
+
+## Kurzbeschreibung
+**Was:** Starter-Repo governance-postcheck mit minimalem Python PostCheck Service, Dockerfile, Kubernetes-Deployment und Tests.
+**Warum:** Automatisierte Canary PostChecks für Governance-Workflows (Health Score Validierung vor Promotion).
+
+## Enthaltene Dateien
+- governance-postcheck/app/main.py
+- governance-postcheck/app/postcheck.py
+- governance-postcheck/app/requirements.txt
+- governance-postcheck/Dockerfile
+- governance-postcheck/k8s/deployment.yaml
+- governance-postcheck/tests/test_postcheck.py
+- governance-postcheck/README.md
+- .gitignore
+
+## How to test lokal
+1. Build: docker build -t registry.example.com/governance-postcheck:local governance-postcheck/
+2. Run: docker run -e PROM_URL=http://<prom-host>:9090 -p 8443:8443 registry.example.com/governance-postcheck:local
+3. Beispiel Request: curl -X POST http://localhost:8443/postcheck -H "Content-Type: application/json" -d '{"partner":"p","endpoint":"e","region":"r","required_health":85,"window":300}'
+4. Unit Tests: pytest governance-postcheck/tests
+
+## CI Checks (erwartet)
+- Python: pip install -r governance-postcheck/app/requirements.txt und pytest
+- Container Security Scan (Trivy) vor Push in Registry
+- YAML Lint für k8s/deployment.yaml
+
+## Voraussetzungen vor Merge
+- Image Registry URL in governance-postcheck/k8s/deployment.yaml anpassen
+- PROM_URL in Deployment auf interne Prometheus-URL setzen
+- TLS/Authentication für Prod-Endpoint planen
+
+## Merge-Kriterien
+- [ ] CI grün (Unit Tests bestanden)
+- [ ] Observability Team und SRE Lead haben Review freigegeben
+- [ ] Image Tagging/Registry-Plan dokumentiert
+
+## Reviewer-Checklist
+- [ ] app/postcheck.py Logik und Fehlerbehandlung geprüft
+- [ ] Tests laufen lokal/CI grün
+- [ ] Dockerfile minimal; SCA-Scan geplant
+- [ ] k8s/deployment.yaml Image-URL und PROM_URL angepasst
+- [ ] Operational: Health/Readiness Probes und Logging ergänzt
+
+## Suggested Reviewers / Teams (konkret)
+- @your-org/observability-team
+- @your-org/sre-lead
+- @your-org/platform-security
-- 
2.40.0
```

---

## Block-Metadaten

| Feld | Wert |
|------|------|
| Block-ID | CA |
| Erstellt | 2026-05-06 |
| Abhängigkeiten | Block BY, BZ |
| Vorgänger | BZ |
| Status | Production-Ready |

---

## Self-Healing Stack – Template-Übersicht

```
BY → GitHub/GitLab PR/MR Templates (Generic)
BZ → GitLab MR Template postcheck-starter
CA → Concrete Handle Templates (GitLab & GitHub) ← NEU
```

---

## Nächste Schritte

| Option | Beschreibung |
|--------|--------------|
| **Handle eingeben** | Nenn mir deine konkreten Handles, ich ersetze sie sofort |
| **Full Index** | Alle Blöcke BJ–CA in einer Übersicht |
| **Merge-Sequenz** | Schritt-für-Schritt Guide für alle Patches |
