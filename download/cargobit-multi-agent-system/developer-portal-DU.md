# DU – Onboarding-Guide für neue Entwickler

> **Zweck**: Schneller Einstieg für neue Team-Mitglieder in die Governance Postcheck Systeme und Prozesse. Strukturierte Anleitung für die ersten 2 Wochen.

---

## 🚀 Willkommen beim Governance Postcheck Team

Dieser Guide hilft dir, dich schnell in unseren Systemen, Prozessen und Tools zurechtzufinden.

---

## 📋 Übersicht: Deine ersten 14 Tage

| Tag | Fokus | Aktivität |
|-----|-------|-----------|
| 1-2 | Einführung | Setup, Dokumentation lesen |
| 3-4 | Tools | cosign, Trivy, Syft kennenlernen |
| 5-7 | Pipeline | CI/CD Pipeline verstehen |
| 8-10 | Praxis | Erstes Deployment mit Governance |
| 11-12 | Runbooks | Incident Response & Troubleshooting |
| 13-14 | Deep Dive | Fortgeschrittene Themen, Q&A |

---

## 1. Erste Schritte (Tag 1-2)

### 1.1 Zugriff einrichten

**Benötigte Accounts**:
- [ ] GitHub/GitLab Account (SSO)
- [ ] Container Registry Zugriff (ghcr.io)
- [ ] Kubernetes Cluster Zugriff
- [ ] Slack/Teams Channels joinen

**Slack Channels**:
| Channel | Zweck |
|---------|-------|
| #governance-support | Fragen & Support |
| #releases | Release-Updates |
| #incidents | Incident-Kommunikation |
| #platform-engineering | Team-Diskussionen |

---

### 1.2 Dokumentation lesen

**Pflichtlektüre** (in dieser Reihenfolge):
1. **README.md** – Projektübersicht
2. **Block DQ** – Stakeholder-FAQ
3. **Block DR** – Change-Impact-Dokument
4. **Handbook v3.0** – Vollständige Dokumentation

**Zeitansatz**: ~4 Stunden

---

### 1.3 Lokales Setup

```bash
# Repository klonen
git clone https://github.com/company/governance-postcheck.git
cd governance-postcheck

# Tools installieren
brew install cosign trivy syft

# Installation verifizieren
cosign version
trivy --version
syft version

# Kubernetes Zugang testen
kubectl get nodes
```

---

## 2. Tools kennenlernen (Tag 3-4)

### 2.1 cosign – Image Signing

**Was ist cosign?**
cosign ist ein Tool zum Signieren und Verifizieren von Container Images. Wir nutzen es im **Keyless Mode**.

**Erste Schritte**:
```bash
# Image signieren (Keyless)
cosign sign --keyless ghcr.io/company/app:v1.0

# Signatur verifizieren
cosign verify --keyless ghcr.io/company/app:v1.0

# Signaturen auflisten
cosign triangulate ghcr.io/company/app:v1.0
```

**Übung**:
1. Lokal ein Image bauen
2. Signieren mit cosign
3. Signatur verifizieren
4. Rekor-Log Eintrag finden

---

### 2.2 Trivy – Vulnerability Scanning

**Was ist Trivy?**
Trivy scannt Container Images auf bekannte Sicherheitslücken (CVEs).

**Erste Schritte**:
```bash
# Image scannen
trivy image ghcr.io/company/app:v1.0

# Nur HIGH/CRITICAL anzeigen
trivy image --severity HIGH,CRITICAL ghcr.io/company/app:v1.0

# JSON Output
trivy image --format json --output report.json ghcr.io/company/app:v1.0

# SARIF für GitHub Security
trivy image --format sarif --output trivy.sarif ghcr.io/company/app:v1.0
```

**Übung**:
1. Ein bekanntes Image scannen (z.B. `nginx:latest`)
2. Report analysieren
3. CVE-Details verstehen

---

### 2.3 Syft – SBOM Generation

**Was ist Syft?**
Syft erstellt eine Software Bill of Materials (SBOM) – eine vollständige Liste aller Komponenten eines Images.

**Erste Schritte**:
```bash
# SBOM erstellen
syft ghcr.io/company/app:v1.0

# SPDX Format
syft ghcr.io/company/app:v1.0 -o spdx-json > sbom.spdx.json

# CycloneDX Format
syft ghcr.io/company/app:v1.0 -o cyclonedx-json > sbom.cdx.json
```

**Übung**:
1. SBOM für ein Image erstellen
2. JSON analysieren
3. Dependencies verstehen

---

## 3. Pipeline verstehen (Tag 5-7)

### 3.1 Pipeline-Übersicht

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  Build  │──▶│  Test   │──▶│  Scan   │──▶│  Sign   │──▶│ Deploy  │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
     │                          │             │
     │                          ▼             ▼
     │                    ┌─────────┐   ┌─────────┐
     │                    │  Trivy  │   │ cosign  │
     │                    └─────────┘   └─────────┘
     │                          │
     │                          ▼
     │                    ┌─────────┐
     │                    │  SBOM   │
     │                    └─────────┘
     │
     └─── Pipeline-Definition: .github/workflows/ ───┘
```

---

### 3.2 Wichtige Pipeline-Dateien

| Datei | Zweck |
|-------|-------|
| `.github/workflows/build.yml` | Build Pipeline |
| `.github/workflows/security.yml` | Security Scans |
| `.github/workflows/deploy.yml` | Deployment Pipeline |
| `.gitlab-ci.yml` | GitLab CI Konfiguration |

**Aufgabe**: Alle Pipeline-Dateien lesen und verstehen.

---

### 3.3 Pipeline lokal testen

```bash
# Act für lokale GitHub Actions Simulation
brew install act

# Pipeline lokal ausführen
act -j build

# Spezifischen Job testen
act -j security-scan
```

---

## 4. Praxis: Erstes Deployment (Tag 8-10)

### 4.1 Deployment-Checkliste

**Vor dem Deployment**:
- [ ] Code reviewed und approved
- [ ] Alle Tests grün
- [ ] Keine CRITICAL/HIGH Vulnerabilities
- [ ] SBOM generiert
- [ ] Image signiert

**Deployment-Workflow**:
```bash
# 1. Image bauen
docker build -t ghcr.io/company/myapp:v1.0 .

# 2. Image scannen
trivy image --severity HIGH,CRITICAL ghcr.io/company/myapp:v1.0

# 3. SBOM erstellen
syft ghcr.io/company/myapp:v1.0 -o spdx-json > sbom.json

# 4. Image signieren
cosign sign --keyless ghcr.io/company/myapp:v1.0

# 5. Signatur verifizieren
cosign verify --keyless ghcr.io/company/myapp:v1.0

# 6. Image pushen
docker push ghcr.io/company/myapp:v1.0

# 7. Deploy via kubectl
kubectl apply -f k8s/deployment.yaml
```

---

### 4.2 Canary Deployment

**Canary-Phasen**:
```
5% (15 min) → 25% (30 min) → 50% (30 min) → 100%
     │             │              │
     └─────────────┴──────────────┘
              SLO Monitoring
```

**Monitoring während Canary**:
```bash
# Pods beobachten
kubectl get pods -w

# Logs streamen
kubectl logs -f deployment/myapp

# Metriken
kubectl top pods
```

---

### 4.3 Rollback verstehen

**Rollback-Szenarien**:
| Szenario | Aktion |
|----------|--------|
| Error Rate > 1% | Hard Rollback (sofort) |
| SLO-Verletzung | Soft Rollback (nach 15 min) |
| Manuelle Entscheidung | `./rollback.sh --version v1.2.3` |

**Übung**:
1. Rollback-Skript lesen
2. Rollback in Staging testen
3. Rollback-Entscheidungsbaum verstehen

---

## 5. Runbooks & Troubleshooting (Tag 11-12)

### 5.1 Wichtige Runbooks

| Runbook | Block | Zweck |
|---------|-------|-------|
| Debug Checklist | CF | Systematische Fehlersuche |
| Incident Template | CN | Signatur/Trivy Probleme |
| Key Rotation | CO | Key-Management |
| Rollback Decision | CV | Rollback-Entscheidungen |
| Post-Incident | CY | Post-Mortem |

---

### 5.2 Häufige Probleme & Lösungen

#### Problem: Image nicht signiert

**Fehlermeldung**:
```
Error: image signature verification failed
```

**Lösung**:
```bash
# 1. Prüfen ob Signatur existiert
cosign verify --keyless ghcr.io/company/app:v1.0

# 2. Falls nicht, nachsignieren
cosign sign --keyless ghcr.io/company/app:v1.0
```

---

#### Problem: Trivy findet CRITICAL CVE

**Fehlermeldung**:
```
CRITICAL: CVE-2025-1234 found in package xyz
```

**Lösung**:
```bash
# 1. CVE recherchieren
# https://nvd.nist.gov/vuln/detail/CVE-2025-1234

# 2. Package updaten oder Exception beantragen

# 3. Falls Exception: Ticket im Service-Desk
```

---

#### Problem: Pipeline schlägt fehl

**Debug-Schritte**:
1. Pipeline-Logs analysieren
2. Lokal reproduzieren
3. Debug Checklist (Block CF) durchgehen
4. Bei Bedarf #governance-support fragen

---

### 5.3 On-Call Einführung

**On-Call Verantwortlichkeiten**:
- Incident Response
- Rollback-Entscheidungen
- Kommunikation mit Stakeholdern

**On-Call Tools**:
| Tool | Zweck |
|------|-------|
| PagerDuty | Alerting |
| Grafana | Monitoring |
| Slack | Kommunikation |
| Runbooks | Troubleshooting |

---

## 6. Deep Dive (Tag 13-14)

### 6.1 Fortgeschrittene Themen

**Empfohlene Vertiefung**:
- [ ] Rekor Transparency Log verstehen
- [ ] Admission Controller Policies (Kyverno)
- [ ] SLO/SLI Monitoring
- [ ] Key Rotation Drill durchführen
- [ ] Audit-Bundle erstellen

---

### 6.2 Architektur verstehen

**Komponenten-Übersicht**:
```
┌─────────────────────────────────────────────────────────────┐
│                    Governance Postcheck                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Scanner   │  │   Signer    │  │  Verifier   │         │
│  │   (Trivy)   │  │  (cosign)   │  │  (Rekor)    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    SBOM     │  │  Admission  │  │   Canary    │         │
│  │   (Syft)    │  │ Controller  │  │  Pipeline   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Audit Bundle & Logging                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

### 6.3 Q&A Session

**Offene Fragen klären mit**:
- Tech Lead
- Platform Engineering
- Security Team

**Kontakt**:
| Thema | Ansprechpartner |
|-------|-----------------|
| Pipeline | CI/CD Team |
| Security | Security Team |
| Kubernetes | Platform Engineering |
| Allgemein | Tech Lead |

---

## 7. Checkliste: Onboarding abgeschlossen

### Technisch
- [ ] Lokales Setup funktioniert
- [ ] cosign, Trivy, Syft installiert
- [ ] Pipeline verstanden
- [ ] Erstes Deployment durchgeführt
- [ ] Rollback getestet

### Prozesse
- [ ] Runbooks gelesen
- [ ] Incident Process verstanden
- [ ] Key Rotation Process bekannt
- [ ] Exception Process bekannt

### Dokumentation
- [ ] Handbook gelesen
- [ ] FAQ verstanden
- [ ] Change-Impact bekannt

### Kontakte
- [ ] Slack Channels gejoined
- [ ] Ansprechpartner bekannt
- [ ] Support-Kanäle bekannt

---

## 📎 Ressourcen & Links

| Ressource | Ort |
|-----------|-----|
| Handbook | `CargoBit-Governance-Postcheck-Handbook.pdf` |
| FAQ | Block DQ |
| Training-Deck | Block DP |
| Runbooks | Blocks CF, CN, CO, CV |
| Slack | #governance-support |
| Email | governance@company.com |

---

## 🎯 Nach dem Onboarding

**Nächste Schritte**:
1. Erstes Ticket übernehmen
2. Code Review für Governance-Komponenten
3. On-Call Rotation (nach Absprache)
4. Kontinuierliches Lernen

**Feedback**:
Teile uns dein Feedback zum Onboarding mit! Wir verbessern den Prozess kontinuierlich.

---

*Block DU – Onboarding-Guide für neue Entwickler – v1.0*
