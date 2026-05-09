# Block CB – CargoBit Handle Templates (GitLab Patch + GitHub Frontmatter)

**Status:** Production-Ready  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-05-06  
**Teil von:** CargoBit Multi-Agent System – Self-Healing Implementation Stack

---

## Übersicht

| Template | Plattform | Handles |
|----------|-----------|---------|
| MR-Template Patch | GitLab | `@cargobit/*` |
| PR-Frontmatter | GitHub | `@cargobit/*` |

---

## 1. GitLab MR-Template Patch

### Dateiname
```
0005-add-gitlab-mr-template-with-handles.patch
```

### Patch-Inhalt

```diff
*** Begin Patch
*** Add File: .gitlab/merge_request_templates/postcheck-starter.md
+# feat(postcheck): add starter governance-postcheck service (python, docker, k8s)
+
+## Kurzbeschreibung
+**Was:** Starter-Repo `governance-postcheck` mit minimalem Python PostCheck Service, Dockerfile, Kubernetes-Deployment und Tests.  
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
+1. Build: `docker build -t registry.example.com/governance-postcheck:local governance-postcheck/`  
+2. Run: `docker run -e PROM_URL=http://<prom-host>:9090 -p 8443:8443 registry.example.com/governance-postcheck:local`  
+3. Beispiel Request:
+```bash
+curl -X POST http://localhost:8443/postcheck \
+  -H "Content-Type: application/json" \
+  -d '{"partner":"p","endpoint":"e","region":"r","required_health":85,"window":300}'
+```
+4. Unit Tests: `pytest governance-postcheck/tests`
+
+## CI Checks (erwartet)
+- Python: `pip install -r governance-postcheck/app/requirements.txt` und `pytest`  
+- Container Security Scan (z. B. Trivy) vor Push in Registry  
+- YAML Lint für `k8s/deployment.yaml` falls CI vorhanden
+
+## Voraussetzungen vor Merge
+- Image Registry URL in `governance-postcheck/k8s/deployment.yaml` an interne Registry anpassen.  
+- `PROM_URL` in Deployment auf interne Prometheus-URL setzen.  
+- TLS/Authentication für Prod-Endpoint planen (nicht im Starter enthalten).
+
+## Merge-Kriterien
+- [ ] CI grün (Unit Tests bestanden)  
+- [ ] Observability Team und SRE Lead haben Review freigegeben  
+- [ ] Image Tagging/Registry-Plan dokumentiert in MR-Kommentare
+
+## Reviewer-Checklist
+- [ ] `app/postcheck.py` Logik und Fehlerbehandlung geprüft  
+- [ ] Tests laufen lokal/CI grün  
+- [ ] Dockerfile minimal; SCA-Scan geplant  
+- [ ] `k8s/deployment.yaml` Image-URL und `PROM_URL` angepasst  
+- [ ] Operational: Health/Readiness Probes und Logging ergänzt (Empfehlung vor Prod)
+
+## Suggested Reviewers / Teams (konkret)
+- `@cargobit/observability-team`  
+- `@cargobit/sre-lead`  
+- `@cargobit/platform-security`
+
*** End Patch
```

### Anwendung

```bash
git checkout -b ci/gitlab/mr-template-postcheck
git apply 0005-add-gitlab-mr-template-with-handles.patch
git add .gitlab/merge_request_templates/postcheck-starter.md
git commit -m "chore(gitlab): add MR template for governance-postcheck with concrete handles"
git push -u origin ci/gitlab/mr-template-postcheck
```

---

## 2. GitHub PR-Frontmatter (zum Einfügen)

### Direkt kopierbar

```markdown
---
title: "feat(postcheck): add starter governance-postcheck service (python, docker, k8s)"
labels: ["type:feature","area:governance","needs-review","ci-required"]
assignees: ["@cargobit/platform-ci"]
reviewers: ["@cargobit/observability-team","@cargobit/sre-lead","@cargobit/platform-security"]
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
3. Beispiel Request (siehe oben)  
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

## 3. GitHub Template Patch

### Dateiname
```
0006-add-github-pr-template-with-handles.patch
```

### Patch-Inhalt

```diff
*** Begin Patch
*** Add File: .github/PULL_REQUEST_TEMPLATE.md
+---
+title: "feat(postcheck): add starter governance-postcheck service (python, docker, k8s)"
+labels: ["type:feature","area:governance","needs-review","ci-required"]
+assignees: ["@cargobit/platform-ci"]
+reviewers: ["@cargobit/observability-team","@cargobit/sre-lead","@cargobit/platform-security"]
+---
+
+## Kurzbeschreibung
+**Was:** Starter-Repo `governance-postcheck` mit minimalem Python PostCheck Service, Dockerfile, Kubernetes-Deployment und einfachen Tests.  
+**Warum:** Automatisierte Canary PostChecks für Governance-Workflows (Health Score Validierung vor Promotion).
+
+## Enthaltene Dateien
+- `governance-postcheck/app/main.py`  
+- `governance-postcheck/app/postcheck.py`  
+- `governance-postcheck/app/requirements.txt`  
+- `governance-postcheck/Dockerfile`  
+- `governance-postcheck/k8s/deployment.yaml`  
+- `governance-postcheck/tests/test_postcheck.py`  
+- `governance-postcheck/README.md`  
+- `.gitignore`
+
+## How to test lokal
+1. Build: `docker build -t registry.example.com/governance-postcheck:local governance-postcheck/`  
+2. Run: `docker run -e PROM_URL=http://<prom-host>:9090 -p 8443:8443 registry.example.com/governance-postcheck:local`  
+3. Beispiel Request:
+```bash
+curl -X POST http://localhost:8443/postcheck \
+  -H "Content-Type: application/json" \
+  -d '{"partner":"p","endpoint":"e","region":"r","required_health":85,"window":300}'
+```
+4. Unit Tests: `pytest governance-postcheck/tests`
+
+## CI Checks (erwartet)
+- Python tests (pytest)  
+- Container SCA (Trivy)  
+- YAML Lint für k8s Manifeste
+
+## Merge Voraussetzungen
+- Image Registry URL angepasst  
+- PROM_URL gesetzt  
+- TLS/Auth für Prod geplant
+
+## Merge Kriterien
+- [ ] CI grün  
+- [ ] Review: Observability Team, SRE Lead  
+- [ ] Image/Registry Plan dokumentiert
+
+## Reviewer-Checklist
+- [ ] `app/postcheck.py` Logik und Fehlerbehandlung geprüft  
+- [ ] Tests laufen lokal/CI grün  
+- [ ] Dockerfile minimal; SCA-Scan geplant  
+- [ ] `k8s/deployment.yaml` Image-URL und `PROM_URL` angepasst  
+- [ ] Operational: Health/Readiness Probes und Logging ergänzt (Empfehlung vor Prod)
*** End Patch
```

### Anwendung

```bash
git checkout -b ci/github/pr-template-postcheck
git apply 0006-add-github-pr-template-with-handles.patch
git add .github/PULL_REQUEST_TEMPLATE.md
git commit -m "chore(github): add PR template for governance-postcheck with concrete handles"
git push -u origin ci/github/pr-template-postcheck
```

---

## 4. CargoBit Handle-Referenz

| Rolle | Handle | Verwendung |
|-------|--------|------------|
| Observability Team | `@cargobit/observability-team` | Monitoring/Alerting Review |
| SRE Lead | `@cargobit/sre-lead` | Infrastructure/Reliability Review |
| Platform Security | `@cargobit/platform-security` | Security/Compliance Review |
| Platform CI | `@cargobit/platform-ci` | CI/CD Pipeline Owner |

---

## 5. Patch-Übersicht

| Patch-Nr | Datei | Branch |
|----------|-------|--------|
| 0001 | Prometheus Recording Rules | `ci/prometheus/proxy-health-rules` |
| 0002 | ArgoCD Policy Sign Hook | `ci/argocd/policy-sign-hook` |
| 0003 | Canary Rollout + PostCheck | `ci/argo-rollout/proxy-policy-canary` |
| 0004 | governance-postcheck Starter | `ci/governance-postcheck/starter` |
| 0005 | GitLab MR Template | `ci/gitlab/mr-template-postcheck` |
| 0006 | GitHub PR Template | `ci/github/pr-template-postcheck` |

---

## 6. Merge-Sequenz (Empfohlen)

```
Phase 1: Infrastruktur
├── 0001-prometheus-recording-rules.patch
├── 0002-argocd-policy-sign-hook.patch
└── 0003-canary-rollout-postcheck.patch

Phase 2: Service
└── 0004-governance-postcheck-starter.patch

Phase 3: Templates
├── 0005-gitlab-mr-template.patch
└── 0006-github-pr-template.patch
```

---

## Block-Metadaten

| Feld | Wert |
|------|------|
| Block-ID | CB |
| Erstellt | 2026-05-06 |
| Abhängigkeiten | Block CA |
| Vorgänger | CA |
| Status | Production-Ready |

---

## Self-Healing Stack – Template-Blocks (Final)

```
BY → GitHub/GitLab PR/MR Templates (Generic)
BZ → GitLab MR Template postcheck-starter
CA → Concrete Handle Templates
CB → CargoBit Handle Templates (GitLab Patch + GitHub Patch) ← NEU
```
