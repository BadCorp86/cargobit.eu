# DY – Day-2 Operations Runbook

> **Zweck**: Operatives Runbook für den produktiven Betrieb nach Go-Live. Deckt Monitoring, Incident Response, Routine-Aufgaben, Change Management und Compliance ab.

---

## 📌 Zweck des Dokuments

Dieses Runbook beschreibt alle operativen Tätigkeiten, die nach dem Go-Live notwendig sind, um den Governance Postcheck **stabil**, **sicher**, **audit-fähig** und **kontinuierlich compliant** zu betreiben.

---

## 1. 🔍 Monitoring & Observability

### 1.1 Dashboards prüfen

**Täglich prüfen**:

| Metrik | Schwellwert | Eskalation |
|--------|-------------|------------|
| Error-Rate (5xx) | < 0.1% | > 0.5% → SEV-2 |
| Latenz (P95) | < 200ms | > 500ms → SEV-3 |
| Latenz (P99) | < 500ms | > 1s → SEV-3 |
| Readiness Failures | 0 | > 0 → SEV-2 |
| Admission Denials | 0 | > 0 → Investigate |
| Signatur-Verify-Fehler | 0 | > 0 → SEV-2 |
| Trivy-Regressionen | 0 | > 0 → SEV-3 |
| Canary-Traffic | Wie konfiguriert | Abweichung → Check |

### 1.2 Alerts

**Aktive Alerts konfigurieren**:

```yaml
# Prometheus Alert Rules
groups:
- name: governance-postcheck-day2
  rules:
  - alert: DeploymentFailure
    expr: deployment_status{status="failed"} > 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Deployment failed"
      
  - alert: SignatureVerifyFailed
    expr: signature_verify_failures_total > 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Image signature verification failed"
      
  - alert: AdmissionDenial
    expr: admission_denials_total > 0
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Admission controller denied deployment"
      
  - alert: CVEBlocker
    expr: trivy_blocker_total > 0
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "CVE blocking deployment"
      
  - alert: SLOViolation
    expr: slo_availability_ratio < 0.999
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "SLO availability violated"
```

---

## 2. 🚨 Incident Response Playbooks

### 2.1 Signatur-Fehler

**Trigger**: Signatur-Verifikation fehlgeschlagen

**Mögliche Ursachen**:
- OIDC Token abgelaufen/invalid
- cosign Dienst nicht verfügbar
- Rekor Transparenz-Log nicht erreichbar
- Digest mismatch

**Response-Schritte**:

```
1. cosign verify manuell ausführen
   $ cosign verify --keyless ghcr.io/company/app:v1.0

2. OIDC Token prüfen
   $ cosign status
   $ Check GitHub/GitLab OIDC status

3. Rekor-Index validieren
   $ cosign triangulate ghcr.io/company/app:v1.0
   $ curl https://rekor.sigstore.dev/api/v1/log/entries

4. Fallback: keyed signing (falls OIDC failed)
   $ cosign sign --key cosign.key ghcr.io/company/app:v1.0

5. Admission-Logs prüfen
   $ kubectl logs -n kyverno deployment/kyverno

6. Incident dokumentieren
   → Incident Template (Block CN)
```

**Guided Link**: → `developer-portal-CF.md` (Debug Checklist)

---

### 2.2 CVE-Blocker

**Trigger**: Trivy findet HIGH/CRITICAL Vulnerability

**Response-Schritte**:

```
1. Trivy-Report analysieren
   $ trivy image --format json ghcr.io/company/app:v1.0 > report.json
   $ cat report.json | jq '.Results[0].Vulnerabilities[] | select(.Severity=="CRITICAL")'

2. CVE recherchieren
   → https://nvd.nist.gov/vuln/detail/CVE-XXXX-XXXXX

3. Patch/Upgrade durchführen
   - Base Image updaten
   - Dependency upgraden
   - Neu bauen

4. Falls kein Patch verfügbar: Ausnahme dokumentieren
   → SECURITY/EXCEPTIONS.md
   - CVE-ID
   - Begründung
   - Mitigation
   - Ablaufdatum
   - Approver

5. Build erneut triggern
   $ git commit --allow-empty -m "trigger rebuild"
```

**Guided Link**: → `developer-portal-CQ.md` (CI Job Snippets)

---

### 2.3 Deployment-Fehler

**Trigger**: Deployment blockiert oder fehlgeschlagen

**Mögliche Ursachen**:
- Admission Enforcement (unsigned image)
- Digest mismatch
- Fehlende Signatur
- Resource limits exceeded

**Response-Schritte**:

```
1. Admission-Logs prüfen
   $ kubectl logs -n kyverno deployment/kyverno --tail=100
   $ kubectl get events -n production --sort-by='.lastTimestamp'

2. Digest vergleichen
   $ kubectl describe pod <pod-name> | grep "Image:"
   $ cosign triangulate ghcr.io/company/app:v1.0

3. Signatur prüfen
   $ cosign verify --keyless ghcr.io/company/app@sha256:abc123...

4. Falls Canary-Problem: Rollback durchführen
   $ ./rollback.sh --version v1.2.3

5. Incident dokumentieren
   → Post-Incident Review (Block CY)
```

**Guided Link**: → `developer-portal-CV.md` (Rollback Decision Tree)

---

### 2.4 Canary-Regression

**Trigger**: SLO-Verletzung während Canary

**Response-Schritte**:

```
1. Traffic auf 0% setzen (sofort)
   $ kubectl patch canary <name> --type merge -p '{"spec":{"trafficWeight":0}}'

2. Rollback durchführen
   $ kubectl rollout undo deployment/<deployment-name>

3. Logs & Metrics analysieren
   $ kubectl logs -f deployment/<deployment-name> --previous
   $ kubectl top pods
   $ Check Grafana dashboard

4. Root Cause Analysis erstellen
   → Post-Incident Review Template (Block CY)

5. Canary-Config überprüfen
   $ kubectl get canary <name> -o yaml
```

---

## 3. 🔄 Routine-Aufgaben

### 3.1 Täglich

| Aufgabe | Zeit | Verantwortlich | Dokumentation |
|---------|------|----------------|---------------|
| Dashboard-Check | 5 min | SRE | Runbook |
| Admission-Denials prüfen | 5 min | Platform | Logs |
| Signatur-Verify-Fehler prüfen | 5 min | Security | Logs |
| CVE-Alerts prüfen | 10 min | Security | Dashboard |

**Checkliste**:
- [ ] Error Rate < 0.1%
- [ ] Keine Admission Denials
- [ ] Keine Signatur-Fehler
- [ ] Keine neuen CRITICAL CVEs

---

### 3.2 Wöchentlich

| Aufgabe | Zeit | Verantwortlich | Dokumentation |
|---------|------|----------------|---------------|
| SBOM-Drift-Analyse | 30 min | Platform | Report |
| Neue CVEs prüfen | 30 min | Security | Dashboard |
| Rekor-Logs stichprobenartig | 15 min | Security | Log |
| Canary-Test (staging) | 30 min | SRE | Test-Report |

---

### 3.3 Monatlich

| Aufgabe | Zeit | Verantwortlich | Dokumentation |
|---------|------|----------------|---------------|
| Audit-Bundle aktualisieren | 1h | Platform | audit/ |
| CI/CD Pipeline Health Check | 1h | CI/CD | Report |
| Dockerfile Hardening Review | 2h | Security | Checklist |
| Security-Review Meeting | 1h | Security | Minutes |

---

### 3.4 Quartalsweise

| Aufgabe | Zeit | Verantwortlich | Dokumentation |
|---------|------|----------------|---------------|
| **Key Rotation** durchführen | 2h | Security | Block CO |
| Emergency-Rotation-Drill | 1h | Security | Protocol |
| Governance-Review | 2h | All Teams | Report |
| Admission-Policies Review | 1h | Platform | YAML |
| Exception-Review | 1h | Compliance | EXCEPTIONS.md |

---

## 4. 🚀 Change Management

### 4.1 Release-Prozess

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Develop   │───▶│   Staging   │───▶│   Canary    │───▶│  Production │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
 - Unit Tests      - Integration     - 5% Traffic       - 100% Traffic
 - Trivy Scan        Tests           - SLO Monitoring   - Monitoring
 - SBOM             - Rollback Test   - Auto Rollback    - Audit-Log
 - Sign             - Sign Verify     - Sign Verify      - Sign Verify
```

**Release-Checkliste**:
- [ ] Automatisches Tagging erstellt
- [ ] Changelog generiert
- [ ] Canary in Staging getestet
- [ ] Rollback-Test erfolgreich
- [ ] Audit-Bundle vollständig
- [ ] Release-Notes veröffentlicht

---

### 4.2 Dokumentation pro Release

| Dokument | Ort | Verantwortlich |
|----------|-----|----------------|
| Release-Notes | Block CZ | Release Manager |
| Audit-Bundle | audit/ | Platform |
| Status-Matrix | Block DF | Release Manager |
| Changelog | CHANGELOG.md | CI/CD |

---

## 5. 📦 Audit & Compliance

### 5.1 Audit-Bundle pflegen

**Struktur**:
```
audit/
├── 01_build/
│   ├── Dockerfile.hardened
│   ├── build.log
│   ├── sbom.json
│   └── trivy.json
├── 02_signing/
│   ├── sign.log
│   ├── rekor-index.txt
│   └── cosign.pub
├── 03_ci_cd/
│   ├── pipeline.yml
│   ├── verify-job.log
│   └── artifact-manifest.txt
├── 04_deployment/
│   ├── canary-manifest.yaml
│   ├── rollback-test.log
│   └── admission-policy.yaml
└── 05_governance/
    ├── SECURITY_POLICY.md
    ├── KEY_ROTATION.md
    └── EXCEPTIONS.md
```

**Maintenance**:
- Täglich: Neue Artefakte hinzufügen
- Wöchentlich: Vollständigkeit prüfen
- Monatlich: Alte Artefakte archivieren (nach Retention Policy)

---

### 5.2 Audit-Fragen beantworten

**Referenz**: Audit-Interview-Script (Block DV)

**Typische Audit-Fragen**:
1. "Wie stellen Sie sicher, dass nur signierte Images deployt werden?"
   → Admission Enforcement, verify-job.log

2. "Wie werden Vulnerabilities behandelt?"
   → Trivy Scan, EXCEPTIONS.md

3. "Wie oft werden Keys rotiert?"
   → 90 Tage, Key Rotation Runbook (Block CO)

4. "Wo sind die Audit-Nachweise?"
   → audit/ Ordner

---

## 6. 👥 Rollen & Verantwortlichkeiten

| Rolle | Verantwortlichkeiten | On-Call |
|-------|---------------------|---------|
| **Platform Owner** | Deploy, Pipeline, Admission, Admission Policies | Ja |
| **Security Owner** | Scans, Signaturen, Key Rotation, CVE-Tracking | Ja |
| **SRE** | Monitoring, Rollback, Canary, Incident Response | Ja (Primary) |
| **Release Manager** | Go/No-Go, Release-Freigabe, Release-Notes | Nein |
| **Engineering** | Codequalität, CVE-Fixes, Dockerfile | Nein |
| **Compliance** | Audit-Support, Exception-Review, Dokumentation | Nein |

---

## 7. 🧭 Operational SLOs

| SLO | Target | Messung | Eskalation |
|-----|--------|---------|------------|
| Deployment Success Rate | ≥ 99% | Pipeline Metrics | < 95% → SEV-2 |
| Signatur-Verify Success | ≥ 99.5% | cosign Metrics | < 99% → SEV-2 |
| CVE-Fix-Time | ≤ 5 Tage | Ticket System | > 7 Tage → Escalation |
| Rollback-Time | ≤ 10 Minuten | Deployment Logs | > 15 min → SEV-2 |
| Admission Denials (prod) | 0 | Kyverno Logs | > 0 → Investigate |
| Availability | ≥ 99.9% | Prometheus | < 99.5% → SEV-1 |

---

## 8. 📚 Wichtige Referenzen

| Thema | Block | Beschreibung |
|-------|-------|--------------|
| Signatur-Verifikation | CF, CN | Debug, Incident Template |
| Trivy & SBOM | CQ | CI Job Snippets |
| Admission Enforcement | CL | Deployment Policy |
| Canary Deploy | CM | Canary Manifest |
| Key Rotation | CO | Rotation Runbook |
| Rollback Decision | CV | Decision Tree |
| Post-Incident | CY | Review Template |
| Audit-Bundle | DK | Struktur & README |

---

## 9. 📞 Kontakte & Escalation

| Ebene | Kontakt | Kanal | SLA |
|-------|---------|-------|-----|
| L1 | On-Call SRE | PagerDuty | 15 min |
| L2 | Platform Lead | Slack/Phone | 30 min |
| L3 | CTO/CISO | Phone | 1h |

**Slack Channels**:
- #governance-support (Allgemein)
- #incidents (Incidents)
- #releases (Releases)

---

*Block DY – Day-2 Operations Runbook – v1.0*
