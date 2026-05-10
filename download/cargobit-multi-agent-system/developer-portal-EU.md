# EU – Architektur One-Person Platform (Minimal)

> **Zweck**: Textuelle Architekturzeichnung der kompletten One-Person Platform.

---

## 🏗️ Architektur-Übersicht (Textuell)

```text
[Developer (du)]
      |
      v
[Git Repo]
      |
      v
[CI/CD Pipeline (GitHub Actions)]
  - Build Image
  - Trivy Scan (HIGH/CRITICAL block)
  - SBOM (syft/anchore)
  - cosign sign (keyless)
  - cosign verify
  - Push nach GHCR
  - Go-Live Gate (prüft Files/Status)

      |
      v
[Cluster]
  - Argo Rollouts (Canary + Promote/Undo)
  - Kyverno Policy (require-signature)
  - Admission Controller blockt unsignierte/falsche Images

      |
      v
[Monitoring/Observability]
  - Prometheus + Alerts:
      * Error-Rate
      * Latenz
      * Admission Denials
      * Signature Verify Failures
      * CVE Alerts
  - Status-Files im Repo:
      * monitoring/*.txt
      * security/*.txt

      |
      v
[Day-2 Automation]
  - CronJobs:
      * Key Rotation (cosign)
      * Daily Checks (CVE, Verify, Admission)
      * Canary-Stabilitätsmarkierung
  - Audit-Bundle:
      * audit/sbom.json
      * audit/trivy.json
      * audit/sign.log
      * audit/rekor-index.txt
      * audit/rollback-test.txt
```

---

## 🔄 Komponenten-Details

### 1. Developer → Git Repo

| Aktion | Tool |
|--------|------|
| Code schreiben | Editor/IDE |
| Commit + Push | git |
| PR erstellen | GitHub/GitLab |

### 2. Git Repo → CI/CD Pipeline

| Schritt | Tool | Output |
|---------|------|--------|
| Build Image | docker | Image:tag |
| Trivy Scan | trivy | trivy-status.txt |
| SBOM | syft | sbom.json |
| Sign | cosign | Signature + Rekor |
| Verify | cosign | signature-status.txt |
| Push | docker | ghcr.io/image@sha256 |

### 3. CI/CD → Cluster

| Komponente | Aufgabe |
|------------|---------|
| Argo Rollouts | Canary-Deployment |
| Kyverno | Admission Enforcement |
| Prometheus | Monitoring |

### 4. Cluster → Monitoring

| Alert | Trigger |
|-------|---------|
| Error-Rate > 1% | HTTP 5xx |
| Latenz P95 > 200ms | Performance |
| Admission Denials | Security |
| Signature Failures | Supply Chain |
| CVE HIGH/CRITICAL | Vulnerability |

### 5. Monitoring → Day-2

| CronJob | Frequenz |
|---------|----------|
| Daily Checks | Täglich 06:00 |
| Key Rotation | Quartalsweise |
| Canary-Stable | Nach 24h |

---

## 📊 Status-File Flow

```text
CI/CD Pipeline
      |
      +──► security/trivy-status.txt      "CVE: 0 HIGH/CRITICAL"
      |
      +──► monitoring/signature-status.txt "Verify: OK"
      |
      +──► monitoring/admission-status.txt "Admission: ACTIVE"
      |
      +──► monitoring/canary-status.txt    "Canary: STABLE"
      |
      v
Go-Live Gate prüft:
  - test -f audit/sbom.json
  - test -f audit/trivy.json
  - grep "Canary: STABLE" monitoring/canary-status.txt
  - grep "Verify: OK" monitoring/signature-status.txt
  - grep "Admission: ACTIVE" monitoring/admission-status.txt
      |
      v
  Alle OK? → Promote to Production
  Nicht OK? → Block
```

---

## 🔧 Minimal-Toolchain

```
┌─────────────────────────────────────────────────────────────────┐
│                    MINIMAL TOOLCHAIN                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Repository      : GitHub / GitLab                              │
│  CI/CD           : GitHub Actions                               │
│  Registry        : ghcr.io                                      │
│  Signing         : cosign (keyless)                             │
│  Transparency    : Rekor (sigstore)                             │
│  Scanning        : Trivy                                        │
│  SBOM            : Syft / Anchore                               │
│  Admission       : Kyverno                                      │
│  Deployment      : Argo Rollouts                                │
│  Monitoring      : Prometheus + Alertmanager                    │
│  Visualization   : Grafana                                      │
│  Orchestration   : Kubernetes                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Summary

```
Repo + CI/CD    : Bauen, Scannen, Signieren, Verifizieren, Deployen
Cluster         : Signaturen erzwingen, Canary steuern, Rollback bereit
Monitoring      : Selbstüberwachend via Status-Files + Alerts
Day-2           : Automatisiert via CronJobs, keine Meetings nötig
```

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Repo-Struktur (Minimal) | ET |
| CI/CD Pipeline | ER |
| Alle 8 Bausteine | EI–EP |
| Architektur (Vollständig) | ES |

---

*Block EU – Architektur One-Person Platform (Minimal) – v1.0*
