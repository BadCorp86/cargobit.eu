# DT – Risiko-Register

> **Zweck**: Systematische Erfassung, Bewertung und Dokumentation aller Risiken im Zusammenhang mit dem Governance Postcheck. Basis für Risikomanagement und Compliance.

---

## 📊 Risiko-Register – Governance Postcheck

### Bewertungsskala

| Score | Wahrscheinlichkeit | Impact |
|-------|-------------------|--------|
| 1 | Sehr niedrig (< 5%) | Gering |
| 2 | Niedrig (5-20%) | Mittel |
| 3 | Mittel (20-50%) | Hoch |
| 4 | Hoch (50-80%) | Kritisch |
| 5 | Sehr hoch (> 80%) | Katastrophal |

**Risiko-Score = Wahrscheinlichkeit × Impact**

---

## 🚨 Technische Risiken

### RT-001: Pipeline Failure

| Attribut | Wert |
|----------|------|
| **Beschreibung** | CI/CD Pipeline schlägt fehl, Deployments werden blockiert |
| **Kategorie** | Technisch |
| **Wahrscheinlichkeit** | 3 (Mittel) |
| **Impact** | 4 (Kritisch) |
| **Score** | **12 (Hoch)** |
| **Trigger** | Infrastruktur-Ausfall, Dependency-Issues |
| **Mitigation** | Fallback-Pipeline, Manual Deployment Process |
| **Owner** | CI/CD Team |
| **Status** | Aktiv |

**Maßnahmen**:
- [ ] Fallback-Pipeline dokumentiert
- [ ] Manual Deployment Runbook erstellt
- [ ] Monitoring für Pipeline-Health eingerichtet

---

### RT-002: Signing Service Unavailable

| Attribut | Wert |
|----------|------|
| **Beschreibung** | cosign/sigstore Dienst nicht erreichbar |
| **Kategorie** | Technisch |
| **Wahrscheinlichkeit** | 2 (Niedrig) |
| **Impact** | 4 (Kritisch) |
| **Score** | **8 (Mittel)** |
| **Trigger** | sigstore Outage, Network Issues |
| **Mitigation** | Cached Signatures, Emergency Signing Process |
| **Owner** | Security Team |
| **Status** | Aktiv |

**Maßnahmen**:
- [ ] Emergency Signing Process dokumentiert
- [ ] Signature Caching evaluiert
- [ ] Status-Page Monitoring für sigstore

---

### RT-003: Admission Controller Failure

| Attribut | Wert |
|----------|------|
| **Beschreibung** | Kyverno/Gatekeeper blockiert alle Deployments |
| **Kategorie** | Technisch |
| **Wahrscheinlichkeit** | 2 (Niedrig) |
| **Impact** | 5 (Katastrophal) |
| **Score** | **10 (Hoch)** |
| **Trigger** | Fehlkonfigurierte Policy, Controller Crash |
| **Mitigation** | Audit-Mode Fallback, Emergency Policy Disable |
| **Owner** | Platform Engineering |
| **Status** | Aktiv |

**Maßnahmen**:
- [ ] Emergency Policy Disable dokumentiert
- [ ] Policy Testing Pipeline etabliert
- [ ] Staging Environment für Policy-Tests

---

### RT-004: Trivy Database Outdated

| Attribut | Wert |
|----------|------|
| **Beschreibung** | Vulnerability Database veraltet, CVEs werden nicht erkannt |
| **Kategorie** | Technisch |
| **Wahrscheinlichkeit** | 2 (Niedrig) |
| **Impact** | 3 (Hoch) |
| **Score** | **6 (Mittel)** |
| **Trigger** | Trivy DB Update Failure, Network Issues |
| **Mitigation** | Alternative Scanner, Manual CVE Review |
| **Owner** | Security Team |
| **Status** | Aktiv |

**Maßnahmen**:
- [ ] DB Update Monitoring
- [ ] Fallback auf alternative DB-Quellen
- [ ] Manual CVE Review Process

---

## 🔐 Sicherheitsrisiken

### RS-001: Compromised Signing Key

| Attribut | Wert |
|----------|------|
| **Beschreibung** | Signatur-Schlüssel kompromittiert (bei Keyed Mode) |
| **Kategorie** | Security |
| **Wahrscheinlichkeit** | 1 (Sehr niedrig) |
| **Impact** | 5 (Katastrophal) |
| **Score** | **5 (Mittel)** |
| **Trigger** | Key Leak, Insider Threat |
| **Mitigation** | Keyless Signing (implementiert), Emergency Key Rotation |
| **Owner** | Security Team |
| **Status** | Mitigiert |

**Hinweis**: Durch Keyless Signing ist dieses Risiko weitgehend mitigiert.

---

### RS-002: Zero-Day Vulnerability

| Attribut | Wert |
|----------|------|
| **Beschreibung** | Kritische Zero-Day Vulnerability in genutzter Software |
| **Kategorie** | Security |
| **Wahrscheinlichkeit** | 3 (Mittel) |
| **Impact** | 4 (Kritisch) |
| **Score** | **12 (Hoch)** |
| **Trigger** | CVE Publication, Security Advisory |
| **Mitigation** | SBOM-basierte schnelle Identifikation, Patch-Pipeline |
| **Owner** | Security Team |
| **Status** | Aktiv |

**Maßnahmen**:
- [x] SBOM für alle Artefakte
- [ ] Automated Patch-Pipeline
- [ ] CVE Monitoring Dashboard

---

### RS-003: Supply Chain Attack

| Attribut | Wert |
|----------|------|
| **Beschreibung** | Kompromittierte Dependency in der Lieferkette |
| **Kategorie** | Security |
| **Wahrscheinlichkeit** | 2 (Niedrig) |
| **Impact** | 5 (Katastrophal) |
| **Score** | **10 (Hoch)** |
| **Trigger** | Malicious Dependency, Compromised Registry |
| **Mitigation** | SBOM, Signing, Dependency Locking |
| **Owner** | Security Team |
| **Status** | Aktiv |

**Maßnahmen**:
- [x] SBOM-Generierung
- [x] Image Signing
- [ ] Dependency Scanning (Snyk/Dependabot)

---

## 🏢 Organisatorische Risiken

### RO-001: Team Resistance

| Attribut | Wert |
|----------|------|
| **Beschreibung** | Entwicklungsteams akzeptieren neue Prozesse nicht |
| **Kategorie** | Organisatorisch |
| **Wahrscheinlichkeit** | 3 (Mittel) |
| **Impact** | 3 (Hoch) |
| **Score** | **9 (Mittel)** |
| **Trigger** | Prozess-Änderungen, Zusätzlicher Aufwand |
| **Mitigation** | Training, Kommunikation, Graduelle Einführung |
| **Owner** | Platform Engineering |
| **Status** | Aktiv |

**Maßnahmen**:
- [x] Training-Deck erstellt (Block DP)
- [x] FAQ dokumentiert (Block DQ)
- [ ] Team-Workshops durchgeführt

---

### RO-002: Skill Gap

| Attribut | Wert |
|----------|------|
| **Beschreibung** | Fehlende Kenntnisse bei neuen Tools (cosign, Trivy, Syft) |
| **Kategorie** | Organisatorisch |
| **Wahrscheinlichkeit** | 3 (Mittel) |
| **Impact** | 2 (Mittel) |
| **Score** | **6 (Mittel)** |
| **Trigger** | Neue Team-Mitglieder, Tool-Updates |
| **Mitigation** | Dokumentation, Training, Onboarding-Guide |
| **Owner** | Platform Engineering |
| **Status** | Aktiv |

**Maßnahmen**:
- [x] Runbooks erstellt
- [x] Training-Deck (Block DP)
- [ ] Onboarding-Guide (Block DU)

---

### RO-003: Key Rotation Missed

| Attribut | Wert |
|----------|------|
| **Beschreibung** | Key Rotation wird nicht rechtzeitig durchgeführt |
| **Kategorie** | Prozess |
| **Wahrscheinlichkeit** | 2 (Niedrig) |
| **Impact** | 3 (Hoch) |
| **Score** | **6 (Mittel)** |
| **Trigger** | Vergessene Rotation, Personalwechsel |
| **Mitigation** | Automated Rotation, Calendar Reminders |
| **Owner** | Security Team |
| **Status** | Aktiv |

**Maßnahmen**:
- [x] Key Rotation Runbook (Block CO)
- [x] 90-Tage-Zyklus definiert
- [ ] Automated Rotation implementiert

---

## 💼 Compliance-Risiken

### RC-001: Exception Not Documented

| Attribut | Wert |
|----------|------|
| **Beschreibung** | Security-Exception nicht dokumentiert, Audit-Risiko |
| **Kategorie** | Compliance |
| **Wahrscheinlichkeit** | 3 (Mittel) |
| **Impact** | 3 (Hoch) |
| **Score** | **9 (Mittel)** |
| **Trigger** | Zeitdruck, Unklare Prozesse |
| **Mitigation** | Exception-Prozess, Quarterly Review |
| **Owner** | Compliance |
| **Status** | Aktiv |

**Maßnahmen**:
- [x] Exception-Prozess dokumentiert (Block CO)
- [ ] Quarterly Exception Review etabliert
- [ ] Exception Dashboard

---

### RC-002: Audit Artifact Missing

| Attribut | Wert |
|----------|------|
| **Beschreibung** | Erforderliches Audit-Artefakt nicht vorhanden |
| **Kategorie** | Compliance |
| **Wahrscheinlichkeit** | 2 (Niedrig) |
| **Impact** | 4 (Kritisch) |
| **Score** | **8 (Mittel)** |
| **Trigger** | Speicherfehler, Pipeline-Fehler |
| **Mitigation** | Automated Bundle Generation, Retention Policy |
| **Owner** | Platform Engineering |
| **Status** | Aktiv |

**Maßnahmen**:
- [x] Audit-Bundle Struktur (Block DK)
- [ ] Automated Bundle Verification
- [ ] Backup für Audit-Artefakte

---

## 📊 Risiko-Matrix

```
Impact
  5 │     RS-001     │     RT-003     │  RS-003, RT-001
    │                 │                 │     RS-002
  4 │                 │  RC-002, RT-002 │
    │                 │     RT-004      │
  3 │                 │  RO-001, RC-001 │
    │     RO-002      │  RO-003, RC-002 │
  2 │                 │                 │
    │                 │                 │
  1 │                 │                 │
    └─────────────────────────────────────────────────
        1             2             3             4
                    Wahrscheinlichkeit
```

---

## 📈 Risiko-Trend

| Quartal | High Risks | Medium Risks | Low Risks |
|---------|------------|--------------|-----------|
| Q4 2024 | 5 | 8 | 3 |
| Q1 2025 | 4 | 7 | 4 |
| Q2 2025 | **3** | **6** | **5** |

**Trend**: ↘️ Verbesserung durch implementierte Mitigation-Maßnahmen

---

## 📎 Guided Links

| Thema | Block / Datei |
|-------|---------------|
| Key Rotation Runbook | → `developer-portal-CO.md` |
| Exception Process | → `developer-portal-CO.md` |
| Audit-Bundle | → `developer-portal-DK.md` |
| Training-Deck | → `developer-portal-DP.md` |
| Change-Impact | → `developer-portal-DR.md` |

---

*Block DT – Risiko-Register – v1.0*
