# Risk Register

**CargoBit Transport Platform**  
**Security & Compliance Risk Management**  
**Dokument-ID:** RISK-REG-2025-001  
**Klassifikation:** Intern – Security & Management  
**Datum:** 15. Januar 2025

---

## 1. Executive Summary

Dieses Risk Register dokumentiert alle identifizierten Sicherheits- und Compliance-Risiken für die CargoBit Transport Platform. Es dient als zentrales Steuerungsinstrument für das Risikomanagement und bietet einen Überblick über aktuelle Risiken, deren Bewertung und den Status der Mitigationsmaßnahmen.

### Risikoubersicht

| Kategorie | Anzahl | Kritisch | Hoch | Mittel |
|-----------|--------|----------|------|--------|
| Technical | 3 | 0 | 3 | 0 |
| Operational | 3 | 0 | 3 | 0 |
| Governance | 1 | 0 | 0 | 1 |
| Organizational | 2 | 0 | 0 | 2 |
| Compliance | 1 | 0 | 1 | 0 |
| **Gesamt** | **10** | **0** | **7** | **3** |

### Risikomatrix

```
                    LIKELIHOOD
                 Niedrig   Mittel    Hoch
           ┌──────────┬──────────┬──────────┐
     Hoch  │ R-04,    │ R-01,    │ R-09     │
           │ R-10     │ R-02,    │          │
           │          │ R-05,    │          │
           │          │ R-06,    │          │
           │          │ R-07     │          │
IMPACT     ├──────────┼──────────┼──────────┤
     Mittel│          │ R-03,    │          │
           │          │ R-08     │          │
           ├──────────┼──────────┼──────────┤
     Niedrig│         │          │          │
           └──────────┴──────────┴──────────┘

Legende:
- Rot (Kritisch): Hoch Impact + Hoch Likelihood
- Orange (Hoch): Hoch Impact + Mittel Likelihood
- Gelb (Mittel): Mittel Impact + Mittel Likelihood
- Grün (Niedrig): Niedrig Impact oder Niedrig Likelihood
```

---

## 2. Risikobewertungsmethodik

### 2.1 Bewertungsskala

#### Impact (Auswirkung)

| Stufe | Beschreibung | Beispiele |
|-------|--------------|-----------|
| **Hoch** | Kritische Beeinträchtigung des Betriebs, Datenverlust, Compliance-Verstoß | Systemausfall, Datenleck, Audit-Failure |
| **Mittel** | Signifikante Beeinträchtigung, verzögerte Reaktion | Performance-Einbußen, verzögerte Detection |
| **Niedrig** | Geringe Beeinträchtigung, lokal begrenzt | Kleinere Störungen, temporäre Einschränkungen |

#### Likelihood (Wahrscheinlichkeit)

| Stufe | Beschreibung | Kriterien |
|-------|--------------|-----------|
| **Hoch** | Tritt wahrscheinlich auf (> 50%) | Historische Vorfälle, aktuelle Schwachstellen |
| **Mittel** | Tritt möglicherweise auf (20-50%) | Bekannte Risiken, branchenübliche Probleme |
| **Niedrig** | Tritt unwahrscheinlich auf (< 20%) | Gute Controls vorhanden, selten dokumentiert |

### 2.2 Risikoscore-Berechnung

```
Risikoscore = Impact × Likelihood

Impact:      Hoch = 3, Mittel = 2, Niedrig = 1
Likelihood:  Hoch = 3, Mittel = 2, Niedrig = 1

Klassifikation:
- Kritisch (9): Sofortige Maßnahmen erforderlich
- Hoch (6): Prioritäre Maßnahmen innerhalb 30 Tage
- Mittel (4): Maßnahmen innerhalb 90 Tage
- Niedrig (1-3): Überwachung, Maßnahmen bei Bedarf
```

---

## 3. Risk Register Detail

### R-01: Fehlende mTLS-Absicherung zwischen Services

| Attribut | Wert |
|----------|------|
| **ID** | R-01 |
| **Risiko** | Fehlende mTLS-Absicherung zwischen Services |
| **Kategorie** | Technical |
| **Impact** | Hoch (3) |
| **Likelihood** | Mittel (2) |
| **Risikoscore** | 6 (Hoch) |
| **Beschreibung** | Services kommunizieren ohne gegenseitige TLS-Authentifizierung. Ein Angreifer im Netzwerk könnte Traffic abhören oder manipulieren. |
| **Owner** | Security Engineer |
| **Status** | In Mitigation |

**Auswirkungen bei Eintritt:**
- Man-in-the-Middle-Angriffe möglich
- Datenabfluss sensibler Informationen
- Manipulation von Transaktionen
- Compliance-Verstoß (Encryption in Transit)

**Mitigationsmaßnahmen:**

| ID | Maßnahme | Status | Deadline | Verantwortlich |
|----|----------|--------|----------|----------------|
| M-01-01 | mTLS-Design und Architektur | ✅ Abgeschlossen | 2025-01-15 | Security Eng |
| M-01-02 | Istio Service Mesh Deployment | 🔄 In Progress | 2025-02-15 | Platform Eng |
| M-01-03 | Certificate Authority Setup | 🔄 In Progress | 2025-02-01 | DevOps Team |
| M-01-04 | Service-Migration zu mTLS | 📋 Geplant | 2025-03-15 | Security Eng |
| M-01-05 | STRICT mTLS-Enforcement | 📋 Geplant | 2025-03-31 | Security Eng |

**Residualrisiko nach Mitigation:** Niedrig (Score: 2)

---

### R-02: Unvollständige NetworkPolicies

| Attribut | Wert |
|----------|------|
| **ID** | R-02 |
| **Risiko** | Unvollständige NetworkPolicies |
| **Kategorie** | Technical |
| **Impact** | Hoch (3) |
| **Likelihood** | Mittel (2) |
| **Risikoscore** | 6 (Hoch) |
| **Beschreibung** | Kubernetes NetworkPolicies sind nicht für alle Namespaces und Services implementiert. Lateral Movement im Cluster ist möglich. |
| **Owner** | Platform Engineer |
| **Status** | In Mitigation |

**Auswirkungen bei Eintritt:**
- Lateral Movement bei Kompromittierung
- Erhöhte Angriffsfläche
- Verletzung des Least-Privilege-Prinzips
- Compliance-Gaps (Network Segmentation)

**Mitigationsmaßnahmen:**

| ID | Maßnahme | Status | Deadline | Verantwortlich |
|----|----------|--------|----------|----------------|
| M-02-01 | NetworkPolicy-Design | ✅ Abgeschlossen | 2025-01-10 | Platform Eng |
| M-02-02 | Deny-All Default Policy | 🔄 In Progress | 2025-01-31 | Platform Eng |
| M-02-03 | Critical Services isolieren | 📋 Geplant | 2025-02-15 | Security Eng |
| M-02-04 | Alle Domain Services | 📋 Geplant | 2025-03-15 | Platform Eng |
| M-02-05 | Policy-Testing Pipeline | 📋 Geplant | 2025-03-31 | DevOps Team |

**Residualrisiko nach Mitigation:** Niedrig (Score: 2)

---

### R-03: Fehlende zentrale Config-Governance

| Attribut | Wert |
|----------|------|
| **ID** | R-03 |
| **Risiko** | Fehlende zentrale Config-Governance |
| **Kategorie** | Governance |
| **Impact** | Mittel (2) |
| **Likelihood** | Hoch (3) |
| **Risikoscore** | 6 (Hoch) |
| **Beschreibung** | Sicherheitsrelevante Konfigurationen sind nicht zentral verwaltet. Fehlende Versionierung, Validierung und Audit-Trails führen zu Inkonsistenzen. |
| **Owner** | Security Engineer |
| **Status** | In Mitigation |

**Auswirkungen bei Eintritt:**
- Inkonsistente Security-Configurations
- Keine Nachvollziehbarkeit von Änderungen
- Fehlende 4-Eyes-Prüfung
- Schwierige Fehlersuche bei Problemen

**Mitigationsmaßnahmen:**

| ID | Maßnahme | Status | Deadline | Verantwortlich |
|----|----------|--------|----------|----------------|
| M-03-01 | Security-Config-Service Design | ✅ Abgeschlossen | 2025-01-08 | Security Eng |
| M-03-02 | API mit Schema Validation | 🔄 In Progress | 2025-02-15 | Backend Team |
| M-03-03 | Git-Backed Versioning | 📋 Geplant | 2025-02-28 | DevOps Team |
| M-03-04 | 4-Eyes Approval Workflow | 📋 Geplant | 2025-03-15 | Security Eng |
| M-03-05 | Config Editor UI | 📋 Geplant | 2025-03-31 | Frontend Team |

**Residualrisiko nach Mitigation:** Niedrig (Score: 2)

---

### R-04: Fraud-Config Fehler führt zu falschen Entscheidungen

| Attribut | Wert |
|----------|------|
| **ID** | R-04 |
| **Risiko** | Fraud-Config Fehler führt zu falschen Entscheidungen |
| **Kategorie** | Operational |
| **Impact** | Hoch (3) |
| **Likelihood** | Niedrig (1) |
| **Risikoscore** | 3 (Niedrig) |
| **Beschreibung** | Fehlerhafte Fraud-Scoring-Konfiguration könnte zu falschen Blockierungen oder nicht erkanntem Betrug führen. |
| **Owner** | Product + Security |
| **Status** | Mitigated |

**Auswirkungen bei Eintritt:**
- False Positives: Kunden werden zu Unrecht blockiert
- False Negatives: Betrug wird nicht erkannt
- Finanzielle Verluste
- Reputationsschaden

**Mitigationsmaßnahmen:**

| ID | Maßnahme | Status | Deadline | Verantwortlich |
|----|----------|--------|----------|----------------|
| M-04-01 | Schema Validation für Fraud Config | ✅ Abgeschlossen | 2024-12-15 | Backend Team |
| M-04-02 | 4-Eyes Review für Config Changes | ✅ Abgeschlossen | 2024-12-20 | Product Team |
| M-04-03 | Staging-Tests vor Production | ✅ Abgeschlossen | 2024-12-20 | QA Team |
| M-04-04 | Fraud-Score Monitoring | 🔄 In Progress | 2025-02-15 | Data Team |
| M-04-05 | Anomaly Detection auf Scores | 📋 Geplant | 2025-03-31 | ML Team |

**Residualrisiko nach Mitigation:** Niedrig (Score: 2)

---

### R-05: Unzureichende Observability

| Attribut | Wert |
|----------|------|
| **ID** | R-05 |
| **Risiko** | Unzureichende Observability |
| **Kategorie** | Operational |
| **Impact** | Hoch (3) |
| **Likelihood** | Mittel (2) |
| **Risikoscore** | 6 (Hoch) |
| **Beschreibung** | Fehlende oder unvollständige Monitoring-, Logging- und Tracing-Infrastruktur führt zu verzögerter Problemerkennung. |
| **Owner** | Platform Engineer |
| **Status** | In Mitigation |

**Auswirkungen bei Eintritt:**
- Verzögerte Incident Detection
- Lange Troubleshooting-Zeiten
- Versteckte Performance-Probleme
- Fehlende Audit-Nachweise

**Mitigationsmaßnahmen:**

| ID | Maßnahme | Status | Deadline | Verantwortlich |
|----|----------|--------|----------|----------------|
| M-05-01 | Loki Deployment | 🔄 In Progress | 2025-02-01 | Platform Eng |
| M-05-02 | Grafana Dashboards | 📋 Geplant | 2025-02-28 | DevOps Team |
| M-05-03 | Alerting Rules | 📋 Geplant | 2025-03-15 | SOC Team |
| M-05-04 | Distributed Tracing (Tempo) | 📋 Geplant | 2025-03-31 | Platform Eng |
| M-05-05 | SLO/SLI Dashboards | 📋 Geplant | 2025-04-15 | SRE Team |

**Residualrisiko nach Mitigation:** Niedrig (Score: 2)

---

### R-06: Incident-Response unklar

| Attribut | Wert |
|----------|------|
| **ID** | R-06 |
| **Risiko** | Incident-Response unklar |
| **Kategorie** | Organizational |
| **Impact** | Hoch (3) |
| **Likelihood** | Mittel (2) |
| **Risikoscore** | 6 (Hoch) |
| **Beschreibung** | Fehlende oder unklare Incident-Response-Prozesse führen zu verzögerter oder ineffektiver Reaktion bei Sicherheitsvorfällen. |
| **Owner** | SRE Lead |
| **Status** | In Mitigation |

**Auswirkungen bei Eintritt:**
- Verzögerte Reaktion bei Incidents
- Fehlende Koordination zwischen Teams
- Kommunikation an Stakeholder unklar
- Verlängerung des Incidents

**Mitigationsmaßnahmen:**

| ID | Maßnahme | Status | Deadline | Verantwortlich |
|----|----------|--------|----------|----------------|
| M-06-01 | Incident Response Playbooks | ✅ Abgeschlossen | 2025-01-10 | Security Team |
| M-06-02 | SEV-Classification | ✅ Abgeschlossen | 2025-01-05 | SRE Lead |
| M-06-03 | On-Call Rotation Setup | 🔄 In Progress | 2025-02-15 | SRE Lead |
| M-06-04 | Incident Communication Plan | 📋 Geplant | 2025-02-28 | Comms Team |
| M-06-05 | Tabletop Exercise | 📋 Geplant | 2025-03-15 | Security Team |

**Residualrisiko nach Mitigation:** Niedrig (Score: 2)

---

### R-07: Fehlende Compliance-Nachweise

| Attribut | Wert |
|----------|------|
| **ID** | R-07 |
| **Risiko** | Fehlende Compliance-Nachweise |
| **Kategorie** | Compliance |
| **Impact** | Hoch (3) |
| **Likelihood** | Mittel (2) |
| **Risikoscore** | 6 (Hoch) |
| **Beschreibung** | Unvollständige oder fehlende Dokumentation für ISO 27001 und SOC 2 Audit-Nachweise gefährdet die Zertifizierung. |
| **Owner** | Compliance Lead |
| **Status** | In Mitigation |

**Auswirkungen bei Eintritt:**
- Audit-Failure
- Verzögerte Enterprise-Deals
- Compliance-Verstöße
- Reputationsschaden

**Mitigationsmaßnahmen:**

| ID | Maßnahme | Status | Deadline | Verantwortlich |
|----|----------|--------|----------|----------------|
| M-07-01 | ISO 27001 Control Mapping | 🔄 In Progress | 2025-02-28 | Compliance Lead |
| M-07-02 | SOC 2 Evidence Checklist | ✅ Abgeschlossen | 2025-01-15 | Compliance Lead |
| M-07-03 | Evidence Collection Automation | 📋 Geplant | 2025-03-31 | DevOps Team |
| M-07-04 | Quarterly Access Reviews | 📋 Geplant | 2025-03-31 | IT Team |
| M-07-05 | Audit Preparation Kit | ✅ Abgeschlossen | 2025-01-15 | Compliance Lead |

**Residualrisiko nach Mitigation:** Niedrig (Score: 2)

---

### R-08: Abhängigkeit von einzelnen Personen

| Attribut | Wert |
|----------|------|
| **ID** | R-08 |
| **Risiko** | Abhängigkeit von einzelnen Personen |
| **Kategorie** | Organizational |
| **Impact** | Mittel (2) |
| **Likelihood** | Mittel (2) |
| **Risikoscore** | 4 (Mittel) |
| **Beschreibung** | Kritisches Wissen und Fähigkeiten sind bei einzelnen Personen konzentriert. Ausfall führt zu Betriebsrisiken. |
| **Owner** | CTO |
| **Status** | In Mitigation |

**Auswirkungen bei Eintritt:**
- Wissen geht verloren bei Abgang
- Verzögerte Problemlösung
- Projekt-Verzögerungen
- Erhöhte On-Call-Last für Verbleibende

**Mitigationsmaßnahmen:**

| ID | Maßnahme | Status | Deadline | Verantwortlich |
|----|----------|--------|----------|----------------|
| M-08-01 | Dokumentation aller kritischen Prozesse | 🔄 In Progress | 2025-03-31 | Team Leads |
| M-08-02 | Cross-Training Programm | 📋 Geplant | 2025-04-30 | HR + Tech Leads |
| M-08-03 | Runbooks für alle Services | 🔄 In Progress | 2025-02-28 | DevOps Team |
| M-08-04 | Knowledge Base aufbauen | 📋 Geplant | 2025-04-30 | All Teams |
| M-08-05 | Backup-Personen benennen | ✅ Abgeschlossen | 2025-01-10 | CTO |

**Residualrisiko nach Mitigation:** Niedrig (Score: 2)

---

### R-09: Vulnerable Dependencies

| Attribut | Wert |
|----------|------|
| **ID** | R-09 |
| **Risiko** | Vulnerable Dependencies |
| **Kategorie** | Technical |
| **Impact** | Hoch (3) |
| **Likelihood** | Hoch (3) |
| **Risikoscore** | 9 (Kritisch) |
| **Beschreibung** | Verwundbare Abhängigkeiten in Anwendungen und Container-Images bieten Angriffsfläche für Exploits. |
| **Owner** | AppSec Engineer |
| **Status** | In Mitigation |

**Auswirkungen bei Eintritt:**
- Remote Code Execution möglich
- Supply Chain Angriffe
- Datenexfiltration
- System-Kompromittierung

**Mitigationsmaßnahmen:**

| ID | Maßnahme | Status | Deadline | Verantwortlich |
|----|----------|--------|----------|----------------|
| M-09-01 | Snyk Integration in CI/CD | ✅ Abgeschlossen | 2025-01-08 | AppSec Eng |
| M-09-02 | Dependabot aktivieren | ✅ Abgeschlossen | 2025-01-05 | Dev Team |
| M-09-03 | Container Scanning (Trivy) | 🔄 In Progress | 2025-02-15 | DevOps Team |
| M-09-04 | Dependency Update Policy | 📋 Geplant | 2025-02-28 | Security Eng |
| M-09-05 | SBOM für alle Services | 📋 Geplant | 2025-03-31 | DevOps Team |

**Residualrisiko nach Mitigation:** Mittel (Score: 4)

---

### R-10: Fehlende Backup-/Restore-Tests

| Attribut | Wert |
|----------|------|
| **ID** | R-10 |
| **Risiko** | Fehlende Backup-/Restore-Tests |
| **Kategorie** | Operational |
| **Impact** | Hoch (3) |
| **Likelihood** | Niedrig (1) |
| **Risikoscore** | 3 (Niedrig) |
| **Beschreibung** | Backups werden erstellt, aber nicht regelmäßig auf Wiederherstellbarkeit getestet. Bei Disaster Recovery könnten Backups fehlschlagen. |
| **Owner** | Platform Engineer |
| **Status** | Mitigated |

**Auswirkungen bei Eintritt:**
- Datenverlust bei Disaster
- Verlängerte Recovery-Zeit
- Nichteinhaltung von RTO/RPO
- Compliance-Verstoß

**Mitigationsmaßnahmen:**

| ID | Maßnahme | Status | Deadline | Verantwortlich |
|----|----------|--------|----------|----------------|
| M-10-01 | Weekly Backup Verification | ✅ Abgeschlossen | 2024-12-01 | Platform Eng |
| M-10-02 | Monthly Restore Tests | ✅ Abgeschlossen | 2024-12-01 | Platform Eng |
| M-10-03 | Annual DR Test | 🔄 Geplant | 2025-09-15 | Platform Eng |
| M-10-04 | Automated Backup Validation | ✅ Abgeschlossen | 2024-12-15 | DevOps Team |
| M-10-05 | RTO/RPO Documentation | ✅ Abgeschlossen | 2024-12-10 | Platform Eng |

**Residualrisiko nach Mitigation:** Niedrig (Score: 1)

---

## 4. Risikosummary

### 4.1 Nach Kategorie

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RISIKEN NACH KATEGORIE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Technical       ████████████████████████  3 Risiken (30%)         │
│                  R-01, R-02, R-09                                   │
│                                                                     │
│  Operational     ████████████████████████  3 Risiken (30%)         │
│                  R-04, R-05, R-10                                   │
│                                                                     │
│  Organizational  ████████████          2 Risiken (20%)             │
│                  R-06, R-08                                          │
│                                                                     │
│  Governance      ████████              1 Risiko  (10%)             │
│                  R-03                                                │
│                                                                     │
│  Compliance      ████████              1 Risiko  (10%)             │
│                  R-07                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Nach Risikoscore

| Score | Anzahl | Risiken | Priorität |
|-------|--------|---------|-----------|
| 9 (Kritisch) | 1 | R-09 | Sofort |
| 6 (Hoch) | 6 | R-01, R-02, R-03, R-05, R-06, R-07 | Q1-Q2 |
| 4 (Mittel) | 1 | R-08 | Q2-Q3 |
| 3 (Niedrig) | 2 | R-04, R-10 | Überwachung |

### 4.3 Nach Owner

| Owner | Risiken | Fokus |
|-------|---------|-------|
| Security Engineer | R-01, R-03 | Technical Hardening, Governance |
| Platform Engineer | R-02, R-05, R-10 | Infrastructure, Observability |
| AppSec Engineer | R-09 | Application Security |
| Compliance Lead | R-07 | Compliance Framework |
| SRE Lead | R-06 | Incident Response |
| CTO | R-08 | Knowledge Management |
| Product + Security | R-04 | Fraud Protection |

---

## 5. Mitigation Timeline

### 5.1 Quartalsübersicht

```
Q1 2025
├── R-01: mTLS Architecture & Deployment
├── R-02: NetworkPolicies Phase 1
├── R-03: Security-Config-Service
├── R-05: Observability Setup
├── R-06: Playbooks & On-Call
├── R-07: ISO Mapping
├── R-09: Dependency Scanning
└── R-08: Documentation Start

Q2 2025
├── R-01: mTLS Rollout Complete
├── R-02: NetworkPolicies Complete
├── R-03: Config Service Complete
├── R-05: Dashboards & Alerting
├── R-06: Tabletop Exercise
├── R-07: Evidence Automation
├── R-09: SBOM Implementation
└── R-08: Cross-Training

Q3 2025
├── R-05: Tracing Complete
├── R-07: Audit Preparation
├── R-08: Knowledge Base
└── R-09: Dependency Policy

Q4 2025
├── R-10: Annual DR Test
├── Alle Risiken: Residual Assessment
└── Risk Register Review
```

### 5.2 Milestone-Tracking

| Milestone | Risiken | Deadline | Status |
|-----------|---------|----------|--------|
| mTLS Deployment Complete | R-01 | 2025-03-31 | 🔄 |
| NetworkPolicies Complete | R-02 | 2025-03-15 | 🔄 |
| Security-Config-Service Live | R-03 | 2025-03-31 | 🔄 |
| Observability Stack Live | R-05 | 2025-04-15 | 📋 |
| ISO 27001 Stage 1 Ready | R-07 | 2025-06-30 | 📋 |
| All Critical Risks Mitigated | R-09 | 2025-02-28 | 🔄 |

---

## 6. Risk Review Process

### 6.1 Review-Kadenz

| Review-Typ | Häufigkeit | Teilnehmer | Output |
|------------|------------|------------|--------|
| Weekly Risk Standup | Wöchentlich | Risk Owners | Status Update |
| Monthly Risk Review | Monatlich | CISO, Team Leads | Priorisierung |
| Quarterly Board Update | Quartalsweise | Executive Team | Management Report |
| Annual Risk Assessment | Jährlich | Alle Stakeholder | Neubewertung |

### 6.2 Review-Agenda (Monatlich)

```
1. Status-Update pro Risiko (10 min)
   - Fortschritt der Mitigationsmaßnahmen
   - Neue Erkenntnisse oder Veränderungen

2. Neubewertung bei Bedarf (10 min)
   - Impact/Likelihood anpassen
   - Neue Risiken aufnehmen

3. Blockers und Escalations (10 min)
   - Ressourcenbedarf
   - Entscheidungserfordernisse

4. Priorisierung (10 min)
   - Fokus für kommenden Monat
   - Risiken zur Überwachung

5. Action Items (5 min)
   - Verantwortlichkeiten
   - Deadlines
```

### 6.3 Risk-KPIs

| KPI | Target | Messung |
|-----|--------|---------|
| Kritische Risiken offen | 0 | Count |
| Hoch-Risiken > 90 Tage offen | 0 | Count |
| Mitigation On-Time Delivery | > 80% | Percentage |
| Residual Risk Score | < 30 | Summe aller Scores |
| Risk Register Aktualität | < 7 Tage | Last Update |

---

## 7. Risk Acceptance Process

### 7.1 Akzeptanzkriterien

Risiken können akzeptiert werden wenn:
- Mitigation wirtschaftlich nicht vertretbar
- Technische Umsetzung nicht möglich
- Restrisiko akzeptabel nach Stakeholder-Bewertung

### 7.2 Akzeptanz-Workflow

```
1. Risk Owner stellt Akzeptanz-Antrag
   ├── Begründung dokumentieren
   ├── Kosten-Nutzen-Analyse
   └── Alternative Controls beschreiben

2. CISO Review
   ├── Technische Bewertung
   └── Empfehlung ausstellen

3. Approval Level basierend auf Risk Score
   ├── Score 6+: CEO + CISO
   ├── Score 4-5: CTO + CISO
   └── Score 1-3: CISO

4. Dokumentation
   ├── Akzeptanz-Datum
   ├── Review-Datum (max 90 Tage)
   └── Compensating Controls
```

### 7.3 Aktive Akzeptanzen

| ID | Risiko | Grund | Akzeptiert bis | Review-Datum |
|----|--------|-------|----------------|--------------|
| - | - | - | - | - |

*Keine aktiven Risikakzeptanzen zum aktuellen Zeitpunkt.*

---

## 8. Anhang

### 8.1 Risk Register Tabelle (Kompakt)

| ID | Risiko | Kategorie | Impact | Likelihood | Score | Owner | Status |
|----|--------|-----------|--------|------------|-------|-------|--------|
| R-01 | Fehlende mTLS-Absicherung | Technical | Hoch | Mittel | 6 | Security Eng | In Mitigation |
| R-02 | Unvollständige NetworkPolicies | Technical | Hoch | Mittel | 6 | Platform Eng | In Mitigation |
| R-03 | Fehlende Config-Governance | Governance | Mittel | Hoch | 6 | Security Eng | In Mitigation |
| R-04 | Fraud-Config Fehler | Operational | Hoch | Niedrig | 3 | Product + Security | Mitigated |
| R-05 | Unzureichende Observability | Operational | Hoch | Mittel | 6 | Platform Eng | In Mitigation |
| R-06 | Incident-Response unklar | Organizational | Hoch | Mittel | 6 | SRE Lead | In Mitigation |
| R-07 | Fehlende Compliance-Nachweise | Compliance | Hoch | Mittel | 6 | Compliance Lead | In Mitigation |
| R-08 | Key-Person-Dependency | Organizational | Mittel | Mittel | 4 | CTO | In Mitigation |
| R-09 | Vulnerable Dependencies | Technical | Hoch | Hoch | 9 | AppSec Eng | In Mitigation |
| R-10 | Fehlende Backup-Tests | Operational | Hoch | Niedrig | 3 | Platform Eng | Mitigated |

### 8.2 Definitions

**Status-Werte:**
- 📋 Geplant - Maßnahme ist geplant, aber noch nicht gestartet
- 🔄 In Progress - Maßnahme wird aktiv bearbeitet
- ✅ Abgeschlossen - Maßnahme ist vollständig umgesetzt
- ⏸️ Pausiert - Maßnahme ist temporär pausiert
- ❌ Blockiert - Maßnahme ist blockiert

**Kategorien:**
- **Technical:** Technische Sicherheitslücken
- **Operational:** Betriebliche Risiken
- **Governance:** Steuerungs- und Kontrollrisiken
- **Organizational:** Organisatorische Risiken
- **Compliance:** Compliance- und Regulatory-Risiken

---

## 9. Dokument-Information

| Attribut | Wert |
|-----------|------|
| Owner | CISO |
| Reviewer | Security Team, Risk Committee |
| Version | 1.0 |
| Status | Aktiv |
| Letztes Update | 2025-01-15 |
| Nächster Review | 2025-02-15 |

---

**Genehmigung:**

| Rolle | Name | Unterschrift | Datum |
|-------|------|--------------|-------|
| CISO | | | |
| CTO | | | |
| CEO | | | |

---

**Verwandte Dokumente:**
- Security-Maturity-Roadmap
- Incident Response Plan
- Business Continuity Plan
- Compliance Mapping
- Security Architecture Diagram
