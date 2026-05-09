# DV – Internes Audit-Interview-Script

> **Zweck**: Strukturiertes Interview-Script für interne und externe Auditoren. Deckt alle Governance Postcheck Themen ab und ermöglicht systematische Audit-Durchführung.

---

## 📋 Audit-Interview-Script – Governance Postcheck

### Interview-Metadaten

| Feld | Wert |
|------|------|
| Thema | Governance Postcheck |
| Dauer | 60-90 Minuten |
| Interviewer | Auditor / Revisor |
| Interviewpartner | Platform Lead, Security Lead, SRE Lead |
| Dokumentation | Audit-Protokoll |

---

## 1. Einführung (5 Minuten)

###开场 statements

**Interviewer**:
> "Vielen Dank für Ihre Zeit. Heute besprechen wir den Governance Postcheck, der kürzlich produktiv gesetzt wurde. Ich werde Fragen zu den Bereichen Security, Compliance, Deployment und Operations stellen. Bitte antworten Sie so konkret wie möglich und verweisen Sie bei Bedarf auf Dokumentation."

**Bestätigung**:
- [ ] Interviewpartner eingeführt
- [ ] Zweck des Interviews erklärt
- [ ] Vertraulichkeit bestätigt

---

## 2. Architektur & Überblick (10 Minuten)

### Fragen

| # | Frage | Erwartete Antwort | Nachweis |
|---|-------|-------------------|----------|
| 2.1 | "Was ist der Governance Postcheck und welchen Zweck erfüllt er?" | Automatisiertes System für signierte, gescannte, audit-fähige Deployments | Handbook S. 1 |
| 2.2 | "Welche Komponenten umfasst das System?" | Scanner (Trivy), SBOM (Syft), Signer (cosign), Admission Controller, Canary Pipeline | Architektur-Diagramm |
| 2.3 | "Wie ist das System in die bestehende Plattform integriert?" | CI/CD Pipeline Integration, Kubernetes Admission Controller | Pipeline YAML |

**Dokumentation**:
- [ ] Architektur-Diagramm verfügbar
- [ ] Komponenten-Übersicht vorhanden
- [ ] Integration dokumentiert

---

## 3. Security & Signing (15 Minuten)

### Fragen

| # | Frage | Erwartete Antwort | Nachweis |
|---|-------|-------------------|----------|
| 3.1 | "Wie werden Images signiert?" | Keyless Signing via cosign mit OIDC-Authentifizierung | Block CF, cosign logs |
| 3.2 | "Wo werden die Signaturen gespeichert?" | Rekor Transparency Log, Registry als Attestation | Rekor-Index |
| 3.3 | "Wie wird die Integrität der Signaturen sichergestellt?" | Verifikation bei jedem Deployment, Rekor-Transparenz | verify-job.log |
| 3.4 | "Was passiert bei einem Signing-Fehler?" | Pipeline bricht ab, Deployment blockiert | Incident Template |
| 3.5 | "Wie ist der Key-Rotation-Prozess definiert?" | 90-Tage-Zyklus, Runbook, Emergency-Process | Block CO |

**Dokumentation prüfen**:
- [ ] cosign Logs vorhanden
- [ ] Rekor-Transparenz-Log zugänglich
- [ ] Key Rotation Runbook vorhanden
- [ ] Emergency Rotation dokumentiert

---

## 4. Vulnerability Management (10 Minuten)

### Fragen

| # | Frage | Erwartete Antwort | Nachweis |
|---|-------|-------------------|----------|
| 4.1 | "Welche Vulnerability-Scans werden durchgeführt?" | Trivy für OS-Packages und Application Dependencies | Trivy Reports |
| 4.2 | "Wie werden kritische CVEs behandelt?" | CRITICAL/HIGH blockieren Deployment, Exception-Prozess | Security Policy |
| 4.3 | "Wie oft werden Scans durchgeführt?" | Bei jedem Build und täglich (Runtime) | Pipeline Config |
| 4.4 | "Wo werden Scan-Ergebnisse dokumentiert?" | SARIF in GitHub Security, JSON in Audit-Bundle | trivy.json |

**Dokumentation prüfen**:
- [ ] Trivy Reports (letzte 30 Tage)
- [ ] SARIF-Output
- [ ] CVE-Tracking Dashboard

---

## 5. SBOM & Transparenz (10 Minuten)

### Fragen

| # | Frage | Erwartete Antwort | Nachweis |
|---|-------|-------------------|----------|
| 5.1 | "Was ist eine SBOM und warum wird sie erstellt?" | Software Bill of Materials für Lieferketten-Transparenz | sbom.json |
| 5.2 | "Welche Formate werden unterstützt?" | SPDX und CycloneDX | Syft Config |
| 5.3 | "Wo werden SBOMs gespeichert?" | Registry als Attestation, Audit-Bundle | sbom.json |
| 5.4 | "Wie schnell können Sie eine Zero-Day-Lücke identifizieren?" | SBOM-basierte Suche innerhalb von Minuten | SBOM Index |

**Dokumentation prüfen**:
- [ ] SBOM für aktuelles Release
- [ ] SPDX/CycloneDX Format validiert
- [ ] Dependency-Tracking

---

## 6. Deployment & Canary (10 Minuten)

### Fragen

| # | Frage | Erwartete Antwort | Nachweis |
|---|-------|-------------------|----------|
| 6.1 | "Wie funktionieren Canary Deployments?" | 5% → 25% → 50% → 100% mit SLO-Monitoring | Canary Manifest |
| 6.2 | "Welche SLOs werden überwacht?" | Availability, Latency, Error Rate | SLO Dashboard |
| 6.3 | "Wie erfolgt ein Rollback?" | Automatisch bei SLO-Verletzung oder manuell via Script | rollback.sh |
| 6.4 | "Wurden Rollback-Tests durchgeführt?" | Ja, dokumentiert im Audit-Bundle | rollback-test.log |

**Dokumentation prüfen**:
- [ ] Canary-Manifest
- [ ] Rollback-Test Protokoll
- [ ] SLO-Dashboard Screenshots

---

## 7. Admission Control (10 Minuten)

### Fragen

| # | Frage | Erwartete Antwort | Nachweis |
|---|-------|-------------------|----------|
| 7.1 | "Was ist der Admission Controller?" | Kyverno/Gatekeeper Policy für Image-Validierung | admission-policy.yaml |
| 7.2 | "Welche Policies sind aktiv?" | Signatur-Pflicht, Registry-Whitelist, Resource-Limits | Policy Config |
| 7.3 | "Was passiert bei Policy-Verletzung?" | Deployment wird blockiert, Fehler-Log | audit.log |
| 7.4 | "Gibt es Ausnahmen?" | Ja, über Exception-Prozess dokumentiert | EXCEPTIONS.md |

**Dokumentation prüfen**:
- [ ] Admission Policy YAML
- [ ] Audit Logs
- [ ] Exception-Dokumentation

---

## 8. Compliance & Audit (10 Minuten)

### Fragen

| # | Frage | Erwartete Antwort | Nachweis |
|---|-------|-------------------|----------|
| 8.1 | "Welche Compliance-Standards werden erfüllt?" | DSGVO Art. 32, ISO 27001, SOC 2 | Compliance Matrix |
| 8.2 | "Wie sind Audit-Nachweise organisiert?" | Audit-Bundle mit 5 Kategorien | audit/ |
| 8.3 | "Wie lange werden Logs aufbewahrt?" | Audit Logs 7 Jahre, Build Logs 90 Tage | Retention Policy |
| 8.4 | "Gibt es einen Exception-Prozess?" | Ja, mit Approval und Quarterly Review | EXCEPTIONS.md |

**Dokumentation prüfen**:
- [ ] Compliance Matrix
- [ ] Audit-Bundle Struktur
- [ ] Retention Policy
- [ ] Exception-Dokumentation

---

## 9. Operations & Incident Response (10 Minuten)

### Fragen

| # | Frage | Erwartete Antwort | Nachweis |
|---|-------|-------------------|----------|
| 9.1 | "Gibt es definierte Runbooks?" | Ja, für alle kritischen Szenarien | Runbooks |
| 9.2 | "Wie erfolgt die Incident-Kommunikation?" | SEV-Level basiert, Templates vorhanden | Incident Templates |
| 9.3 | "Wer ist On-Call verantwortlich?" | Rotierendes On-Call Team | On-Call Schedule |
| 9.4 | "Wurden Post-Incident Reviews durchgeführt?" | Ja, blameless Post-Mortems | Post-Incident Reports |

**Dokumentation prüfen**:
- [ ] Runbooks (CF, CN, CO, CV)
- [ ] Incident Templates
- [ ] On-Call Schedule
- [ ] Post-Incident Reports

---

## 10. Zusammenfassung & Abschluss (5 Minuten)

### Checkliste Auditor

| Bereich | Status | Bemerkungen |
|---------|--------|-------------|
| Architecture | ☐ | |
| Security & Signing | ☐ | |
| Vulnerability Management | ☐ | |
| SBOM | ☐ | |
| Deployment & Canary | ☐ | |
| Admission Control | ☐ | |
| Compliance | ☐ | |
| Operations | ☐ | |

### Offene Punkte

| # | Punkt | Verantwortlich | Deadline |
|---|-------|----------------|----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

### Abschluss-Erklärung

**Interviewer**:
> "Vielen Dank für die ausführlichen Antworten. Ich werde die Dokumentation prüfen und bei Rückfragen erneut Kontakt aufnehmen. Das Audit-Protokoll erhalten Sie innerhalb von 5 Werktagen."

---

## 📎 Anhang: Dokumenten-Checkliste

### Erforderliche Nachweise

| Dokument | Pflicht | Status |
|----------|---------|--------|
| Architektur-Diagramm | Ja | ☐ |
| Pipeline YAML | Ja | ☐ |
| cosign Logs | Ja | ☐ |
| Rekor-Index | Ja | ☐ |
| Trivy Reports | Ja | ☐ |
| SBOM (aktuelles Release) | Ja | ☐ |
| Canary Manifest | Ja | ☐ |
| Rollback-Test Log | Ja | ☐ |
| Admission Policy | Ja | ☐ |
| Security Policy | Ja | ☐ |
| Key Rotation Runbook | Ja | ☐ |
| Exception Log | Optional | ☐ |
| Compliance Matrix | Ja | ☐ |
| Runbooks | Ja | ☐ |

---

## 📎 Guided Links

| Thema | Block / Datei |
|-------|---------------|
| Debug Checklist | → `developer-portal-CF.md` |
| Incident Template | → `developer-portal-CN.md` |
| Key Rotation Runbook | → `developer-portal-CO.md` |
| Audit-Bundle | → `developer-portal-DK.md` |
| Compliance-Memo | → `developer-portal-DO.md` |
| Stakeholder-FAQ | → `developer-portal-DQ.md` |

---

*Block DV – Audit-Interview-Script – v1.0*
