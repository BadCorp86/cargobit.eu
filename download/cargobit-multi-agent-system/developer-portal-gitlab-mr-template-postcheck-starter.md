# Block BZ – GitLab MR Template: postcheck-starter

**Status:** Production-Ready  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-05-06  
**Teil von:** CargoBit Multi-Agent System – Self-Healing Implementation Stack

---

## Übersicht

| Komponente | Beschreibung |
|------------|--------------|
| Template-Datei | `.gitlab/merge_request_templates/postcheck-starter.md` |
| Zweck | Standardisierte MR-Beschreibung für governance-postcheck Service |
| GitLab-Version | 13.0+ (Merge Request Templates) |

---

## 1. GitLab MR-Template (Vollständig)

### Speicherort
```
.gitlab/merge_request_templates/postcheck-starter.md
```

### Inhalt

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
- [ ] Observability Engineer und SRE Lead haben Review freigegeben  
- [ ] Image Tagging/Registry-Plan dokumentiert in PR-Kommentare

## Reviewer-Checklist
- [ ] `app/postcheck.py` Logik und Fehlerbehandlung geprüft  
- [ ] Tests laufen lokal/CI grün  
- [ ] Dockerfile minimal; SCA-Scan geplant  
- [ ] `k8s/deployment.yaml` Image-URL und `PROM_URL` angepasst  
- [ ] Operational: Health/Readiness Probes und Logging ergänzt (Empfehlung vor Prod)

## Suggested Reviewers / Teams
- Observability Team  
- SRE Lead  
- Platform Security
```

---

## 2. One-Liner zur Dateierstellung

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
3. Beispiel Request:
curl -X POST http://localhost:8443/postcheck -H "Content-Type: application/json" -d '{"partner":"p","endpoint":"e","region":"r","required_health":85,"window":300}'
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
- [ ] Observability Engineer und SRE Lead haben Review freigegeben  
- [ ] Image Tagging/Registry-Plan dokumentiert

## Reviewer-Checklist
- [ ] app/postcheck.py Logik und Fehlerbehandlung geprüft  
- [ ] Tests laufen lokal/CI grün  
- [ ] Dockerfile minimal; SCA-Scan geplant  
- [ ] k8s/deployment.yaml Image-URL und PROM_URL angepasst  
- [ ] Operational: Health/Readiness Probes und Logging ergänzt

## Suggested Reviewers / Teams
- Observability Team  
- SRE Lead  
- Platform Security
EOF
```

---

## 3. GitHub/GitLab Handle-Platzhalter

### Empfohlene Platzhalter (vor Anpassung)

| Rolle | GitHub Placeholder | GitLab Placeholder |
|-------|-------------------|-------------------|
| Observability Team | `@your-org/observability-team` | `@observability-team` |
| SRE Lead | `@your-org/sre-lead` | `@sre-lead` |
| Platform Security | `@your-org/platform-security` | `@platform-security` |
| CI Owner | `@your-org/platform-ci` | `@platform-ci` |
| Governance Owner | `@your-org/governance-owner` | `@governance-owner` |

### Anpassungs-Workflow

1. **Identifiziere die tatsächlichen Handles** in deinem GitHub/GitLab Account
2. **Ersetze `your-org`** durch deinen Organisations-Namen
3. **Oder nutze direkte Usernamen** falls keine Teams existieren

**Beispiel für CargoBit Org:**
```yaml
# GitHub
reviewers: ["cargobit/observability-squad", "cargobit/sre-lead", "cargobit/security-champion"]

# GitLab
# Suggested Reviewers
- @cargobit/observability-squad
- @cargobit/sre-lead
- @cargobit/security-champion
```

---

## 4. Git Patch-Format

```diff
From 0000000000000000000000000000000000000000 Mon Sep 17 00:00:00 2001
From: Platform CI <platform-ci@example.com>
Date: 2026-05-06
Subject: [PATCH] feat(ci): add gitlab mr template for postcheck-starter

---
 .gitlab/merge_request_templates/postcheck-starter.md | 52 ++++++++++
 1 file changed, 52 insertions(+)
 create mode 100644 .gitlab/merge_request_templates/postcheck-starter.md

diff --git a/.gitlab/merge_request_templates/postcheck-starter.md b/.gitlab/merge_request_templates/postcheck-starter.md
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/.gitlab/merge_request_templates/postcheck-starter.md
@@ -0,0 +1,52 @@
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
+- [ ] Observability Engineer und SRE Lead haben Review freigegeben  
+- [ ] Image Tagging/Registry-Plan dokumentiert
+
+## Reviewer-Checklist
+- [ ] app/postcheck.py Logik und Fehlerbehandlung geprüft  
+- [ ] Tests laufen lokal/CI grün  
+- [ ] Dockerfile minimal; SCA-Scan geplant  
+- [ ] k8s/deployment.yaml Image-URL und PROM_URL angepasst  
+- [ ] Operational: Health/Readiness Probes und Logging ergänzt
+
+## Suggested Reviewers / Teams
+- Observability Team  
+- SRE Lead  
+- Platform Security
-- 
2.40.0
```

---

## 5. Anwendung des Patches

```bash
# Patch-Datei erstellen
cat > 0005-add-gitlab-mr-template-postcheck.patch <<'PATCH_EOF'
# (Patch-Inhalt von oben einfügen)
PATCH_EOF

# Anwenden
git apply 0005-add-gitlab-mr-template-postcheck.patch
```

---

## Block-Metadaten

| Feld | Wert |
|------|------|
| Block-ID | BZ |
| Erstellt | 2026-05-06 |
| Abhängigkeiten | Block BY (GitHub/GitLab Templates) |
| Vorgänger | BY |
| Status | Production-Ready |

---

## Self-Healing Stack – Finaler Überblick

```
CONCEPT:          BM → Self-Healing Architecture
POLICY:           BN, BO → Policy as Code + Health Score
IMPLEMENTATION:   BP, BQ, BR, BS, BT → Templates, PR-Bundles, To-Do
PR-PATCHES:       BU, BV, BW, BX → 4 Git Patches
PR/MR-TEMPLATES:  BY, BZ → GitHub + GitLab Templates ← KOMPLETT
```

---

## Nächste Optionen

| Option | Beschreibung |
|--------|--------------|
| **Full Index** | Alle Blöcke BJ–BZ in einer Übersicht |
| **Handle-Anpassung** | Konkrete GitHub/GitLab Usernamen eintragen |
| **Merge-Sequenz** | Schritt-für-Schritt Merge-Guide |
