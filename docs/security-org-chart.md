# Security-Organisationsstruktur

**CargoBit Transport Platform**  
**Team-Struktur & Verantwortlichkeiten**  
**Dokument-ID:** ORG-SEC-2025-001  
**Klassifikation:** Intern – HR & Management  
**Datum:** 15. Januar 2025

---

## 1. Übersicht

Dieses Dokument definiert die Organisationsstruktur des Security-Teams für CargoBit. Es werden zwei Varianten vorgestellt: ein Minimal-Team für Startups/Scale-ups und ein Optimal-Team für Enterprise-Ready Organisationen.

### Team-Größen

| Variante | Team-Größe | Geeignet für | Budget-Impact |
|----------|------------|--------------|---------------|
| Minimal | 2-3 Personen | Seed/Series A, < 50 Mitarbeiter | ~250.000 €/Jahr |
| Optimal | 4-6 Personen | Series B+, Enterprise, > 50 Mitarbeiter | ~450.000 €/Jahr |

---

## 2. Minimal-Team (2-3 Personen)

### 2.1 Organigramm

```
┌─────────────────────────────────────────────────────────────────────┐
│                      MINIMAL-TEAM (2-3 Personen)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                    ┌─────────────────────┐                         │
│                    │   CISO / Head of    │                         │
│                    │     Security        │                         │
│                    │   (0.5 FTE)         │                         │
│                    └──────────┬──────────┘                         │
│                               │                                     │
│              ┌────────────────┴────────────────┐                   │
│              │                                 │                    │
│              ▼                                 ▼                    │
│    ┌───────────────────┐            ┌───────────────────┐         │
│    │ Security Engineer │            │ Platform Engineer │         │
│    │   (1.0 FTE)       │            │   (0.5-1.0 FTE)   │         │
│    └───────────────────┘            └───────────────────┘         │
│                                                                     │
│    Optional: Compliance Lead (0.3 FTE, extern/teilweise)           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Rollenbeschreibungen

#### CISO / Head of Security

| Attribut | Wert |
|----------|------|
| **Zeitumfang** | 0.5 FTE (kombiniert mit anderer Rolle) |
| **Berichtslinie** | CEO oder CTO |
| **Hauptverantwortung** | Strategie, Governance, Risk Management |

**Aufgaben:**
- Security-Strategie und Roadmap
- Budget-Verantwortung
- Risk Management
- Audit-Owner (ISO 27001, SOC 2)
- Executive-Reporting
- Vendor-Management (Security)

**Skills:**
- Security Leadership
- Risk Management
- Compliance-Kenntnisse
- Stakeholder-Management

---

#### Security Engineer

| Attribut | Wert |
|----------|------|
| **Zeitumfang** | 1.0 FTE (Vollzeit) |
| **Berichtslinie** | CISO / CTO |
| **Hauptverantwortung** | Technische Security-Implementierung |

**Aufgaben:**
- mTLS-Implementierung und -Wartung
- NetworkPolicies-Entwicklung
- Security-Hardening
- CI/CD Security-Integration
- Vulnerability Management
- Incident Response (technisch)

**Skills:**
- Kubernetes Security
- Network Security
- Scripting (Python, Bash)
- Security Tools (Vault, WAF, etc.)

---

#### Platform Engineer

| Attribut | Wert |
|----------|------|
| **Zeitumfang** | 0.5-1.0 FTE |
| **Berichtslinie** | CTO / Platform Lead |
| **Hauptverantwortung** | Infrastructure Security |

**Aufgaben:**
- Monitoring & Logging
- Secrets-Management (Vault)
- Infrastructure Hardening
- On-Call Rotation
- Automation

**Skills:**
- Terraform / IaC
- Kubernetes
- Monitoring (Prometheus, Grafana)
- Cloud Security (AWS/GCP)

---

### 2.3 Verantwortlichkeitsmatrix (Minimal)

| Aufgabe | CISO | Security Eng | Platform Eng |
|---------|------|--------------|--------------|
| Security-Strategie | **A/R** | C | I |
| mTLS-Implementierung | A | **R** | C |
| NetworkPolicies | A | **R** | C |
| Monitoring | I | C | **R** |
| Secrets-Management | A | C | **R** |
| Incident Response | **A** | **R** | R |
| Compliance | **A/R** | C | I |
| Vulnerability Management | A | **R** | C |
| On-Call | A | R | **R** |

**Legende:** R = Responsible, A = Accountable, C = Consulted, I = Informed

---

## 3. Optimal-Team (4-6 Personen)

### 3.1 Organigramm

```
┌─────────────────────────────────────────────────────────────────────┐
│                      OPTIMAL-TEAM (4-6 Personen)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                         ┌───────────────────┐                      │
│                         │  CISO / Head of   │                      │
│                         │    Security       │                      │
│                         │   (1.0 FTE)       │                      │
│                         └─────────┬─────────┘                      │
│                                   │                                 │
│          ┌────────────────────────┼────────────────────────┐       │
│          │                        │                        │       │
│          ▼                        ▼                        ▼       │
│ ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│ │   Security      │    │   Compliance    │    │   Security      │ │
│ │  Engineering    │    │     Lead        │    │  Operations     │ │
│ │    Lead         │    │  (0.5-1.0 FTE)  │    │    Lead         │ │
│ │  (1.0 FTE)      │    │                 │    │  (1.0 FTE)      │ │
│ └────────┬────────┘    └─────────────────┘    └────────┬────────┘ │
│          │                                            │           │
│    ┌─────┴─────┐                                 ┌────┴────┐      │
│    │           │                                 │         │      │
│    ▼           ▼                                 ▼         ▼      │
│ ┌────────┐ ┌────────┐                      ┌────────┐ ┌────────┐ │
│ │AppSec  │ │Platform│                      │Incident│ │  SRE/  │ │
│ │Engineer│ │Security│                      │Response│ │ On-Call│ │
│ │(0.5-1) │ │Engineer│                      │ (0.5)  │ │ (0.5)  │ │
│ └────────┘ │(0.5-1) │                      └────────┘ └────────┘ │
│            └────────┘                                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Rollenbeschreibungen

#### CISO / Head of Security

| Attribut | Wert |
|----------|------|
| **Zeitumfang** | 1.0 FTE (Vollzeit) |
| **Berichtslinie** | CEO |
| **Team-Größe** | 4-6 direkte Reports |

**Aufgaben:**
- Security-Strategie und Vision
- Executive-Reporting und Board-Updates
- Budget-Verantwortung (650k €)
- Risk Management und Governance
- Kultur- und Team-Entwicklung
- Externe Beziehungen (Auditoren, Regulatoren)

**Skills:**
- Security Leadership (10+ Jahre Erfahrung)
- Executive Communication
- Budget-Management
- Risk Management
- Compliance (ISO 27001, SOC 2, DSGVO)

---

#### Security Engineering Lead

| Attribut | Wert |
|----------|------|
| **Zeitumfang** | 1.0 FTE (Vollzeit) |
| **Berichtslinie** | CISO |
| **Team-Größe** | 2-3 direkte Reports |

**Aufgaben:**
- Technische Security-Roadmap
- Team-Leitung (AppSec, Platform Security)
- Architecture Reviews
- Security Standards Definition
- Vendor Evaluation (Security Tools)

**Skills:**
- Security Architecture
- Team Leadership
- Application Security
- Infrastructure Security
- Security Standards (OWASP, NIST)

---

#### AppSec Engineer

| Attribut | Wert |
|----------|------|
| **Zeitumfang** | 0.5-1.0 FTE |
| **Berichtslinie** | Security Engineering Lead |
| **Fokus** | Application Security |

**Aufgaben:**
- CI/CD Security Gates
- SAST/DAST-Integration
- Dependency Scanning
- Code Reviews (Security)
- Secure Coding Guidelines
- Security Training für Entwickler

**Skills:**
- Application Security
- OWASP Top 10
- Static/Dynamic Analysis Tools
- Secure Code Review
- Entwicklungs-Hintergrund (Go, Java, Python)

---

#### Platform Security Engineer

| Attribut | Wert |
|----------|------|
| **Zeitumfang** | 0.5-1.0 FTE |
| **Berichtslinie** | Security Engineering Lead |
| **Fokus** | Infrastructure Security |

**Aufgaben:**
- mTLS-Implementierung
- NetworkPolicies-Entwicklung
- Secrets-Management (Vault)
- Kubernetes Security
- Cloud Security (AWS/GCP)
- IaC Security (Terraform)

**Skills:**
- Kubernetes Security
- Cloud Security (AWS/GCP/Azure)
- Network Security
- Terraform / IaC
- HashiCorp Vault

---

#### Compliance Lead

| Attribut | Wert |
|----------|------|
| **Zeitumfang** | 0.5-1.0 FTE |
| **Berichtslinie** | CISO |
| **Fokus** | Governance & Compliance |

**Aufgaben:**
- ISO 27001 Management
- SOC 2 Type II Vorbereitung
- Policy-Entwicklung
- Evidence Collection
- Audit-Koordination
- Vendor Compliance Reviews

**Skills:**
- ISO 27001 Lead Auditor
- SOC 2 Kenntnisse
- Policy Development
- Audit-Management
- Dokumentation

---

#### Security Operations Lead

| Attribut | Wert |
|----------|------|
| **Zeitumfang** | 1.0 FTE (Vollzeit) |
| **Berichtslinie** | CISO |
| **Team-Größe** | 1-2 direkte Reports |

**Aufgaben:**
- Security Monitoring
- Alerting & Response
- Incident Management
- On-Call Rotation Management
- Threat Intelligence
- SIEM-Management

**Skills:**
- Security Operations
- Incident Response
- SIEM (Splunk, Elastic)
- Threat Intelligence
- On-Call Management

---

#### Incident Response Specialist

| Attribut | Wert |
|----------|------|
| **Zeitumfang** | 0.5 FTE |
| **Berichtslinie** | Security Operations Lead |
| **Fokus** | Incident Handling |

**Aufgaben:**
- Incident Triage
- Forensik (First Response)
- Playbook-Entwicklung
- Post-Incident Reviews
- Communication während Incidents

**Skills:**
- Incident Response
- Digital Forensics
- Communication
- Documentation

---

#### SRE / On-Call Engineer

| Attribut | Wert |
|----------|------|
| **Zeitumfang** | 0.5 FTE (Rotation) |
| **Berichtslinie** | Security Operations Lead |
| **Fokus** | Availability & Response |

**Aufgaben:**
- On-Call Rotation
- Monitoring & Alerting
- System Reliability
- Runbook-Entwicklung
- Escalation Handling

**Skills:**
- SRE Practices
- Monitoring (Prometheus, Grafana)
- On-Call Experience
- Troubleshooting

---

### 3.3 Verantwortlichkeitsmatrix (Optimal)

| Aufgabe | CISO | SecEng Lead | AppSec | Platform Sec | Compliance | SecOps Lead |
|---------|------|-------------|--------|--------------|------------|-------------|
| Security-Strategie | **A/R** | R | I | I | C | C |
| mTLS/NetworkPolicies | A | **A** | C | **R** | I | I |
| CI/CD Security | A | **A** | **R** | C | I | I |
| Secrets-Management | A | **A** | I | **R** | I | C |
| ISO 27001 | **A** | C | I | I | **R** | I |
| SOC 2 | **A** | C | I | I | **R** | I |
| Incident Response | **A** | C | C | C | I | **R** |
| Monitoring/Alerting | A | I | I | C | I | **A/R** |
| Vulnerability Management | A | **A** | **R** | R | I | C |
| Security Training | **A** | **R** | **R** | C | I | I |
| On-Call | A | C | R | R | I | **A** |

**Legende:** R = Responsible, A = Accountable, C = Consulted, I = Informed

---

## 4. Cross-Team-Integration

### 4.1 Zusammenarbeit mit anderen Teams

| Team | Zusammenarbeit | Häufigkeit |
|------|----------------|------------|
| **Engineering** | Security Reviews, Code Scans, Training | Täglich |
| **Product** | Security Requirements, Feature Reviews | Wöchentlich |
| **DevOps/Platform** | Infrastructure Security, Tooling | Täglich |
| **HR** | Background Checks, Training, Onboarding | Monatlich |
| **Legal** | Compliance, Contracts, Incidents | Monatlich |
| **Finance** | Budget, Vendor Management | Monatlich |

### 4.2 Reporting-Lines

```
                    ┌─────────────┐
                    │    CEO      │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │   CTO   │      │  CISO   │      │   CFO   │
    └────┬────┘      └────┬────┘      └────┬────┘
         │                │                │
         ▼                ▼                │
    ┌─────────┐      ┌─────────┐           │
    │Engineering│     │Security │           │
    │  Teams   │      │  Team   │           │
    └─────────┘      └─────────┘           │
         │                │                │
         └────────────────┴────────────────┘
                          │
                          ▼
                    Cross-Team
                   Collaboration
```

---

## 5. On-Call-Struktur

### 5.1 Rotation-Modell

| Stufe | Rolle | Abdeckung | Reaktionszeit |
|-------|-------|-----------|---------------|
| Stufe 1 | Security Engineer | 24/7 | 15 Minuten |
| Stufe 2 | Security Operations Lead | 24/7 | 30 Minuten |
| Stufe 3 | CISO | Business Hours | 2 Stunden |

### 5.2 On-Call-Kalender

```
Woche 1: Security Engineer A
Woche 2: Security Engineer B
Woche 3: Security Engineer A
Woche 4: Security Engineer B
...

Backup: Security Operations Lead (immer)
Escalation: CISO (nur SEV1/SEV2)
```

### 5.3 On-Call-Vergütung

| Komponente | Betrag |
|------------|--------|
| Bereitschaftspauschale | 100 €/Tag |
| Incident-Arbeit | 1.5x Stundensatz |
| Wochenende/Feiertag | 2x Stundensatz |

---

## 6. Hiring-Plan

### 6.1 Priorisierte Positionsliste

| Priorität | Rolle | Zeitrahmen | FTE | Kosten/Jahr |
|-----------|-------|------------|-----|-------------|
| 1 | Security Engineer | Sofort | 1.0 | 85.000 € |
| 2 | Platform Engineer | Q1 2025 | 0.5 | 42.500 € |
| 3 | Compliance Lead | Q2 2025 | 0.5 | 45.000 € |
| 4 | AppSec Engineer | Q3 2025 | 0.5 | 42.500 € |
| 5 | Security Operations Lead | Q3 2025 | 1.0 | 90.000 € |

### 6.2 Job-Profile (Kurzform)

#### Security Engineer (Priorität 1)

```
Titel: Security Engineer
Level: Senior (5+ Jahre Erfahrung)
Location: Remote/Hybrid
Salary Range: 75.000 - 95.000 €

Must-Have Skills:
- Kubernetes Security
- Network Security (mTLS, NetworkPolicies)
- Scripting (Python, Bash)
- Security Tools Erfahrung

Nice-to-Have:
- Cloud Security Certification
- Container Security Erfahrung
- Incident Response Erfahrung
```

#### Compliance Lead (Priorität 3)

```
Titel: Compliance Lead
Level: Senior (5+ Jahre Erfahrung)
Location: Remote/Hybrid
Salary Range: 70.000 - 90.000 €

Must-Have Skills:
- ISO 27001 Lead Auditor
- SOC 2 Erfahrung
- Policy Development
- Audit Management

Nice-to-Have:
- CISM oder CISA
- DSGVO-Kenntnisse
- Tech-Company Erfahrung
```

---

## 7. Karrierepfade

### 7.1 Security Engineering Track

```
Junior Security Engineer
        │
        ▼
Security Engineer
        │
        ├──▶ Senior Security Engineer
        │           │
        │           ▼
        │    Staff Security Engineer
        │           │
        │           ▼
        │    Principal Security Engineer
        │
        └──▶ Security Engineering Lead
                    │
                    ▼
              Security Director
                    │
                    ▼
                  CISO
```

### 7.2 Compliance Track

```
Compliance Analyst
        │
        ▼
Compliance Specialist
        │
        ▼
Compliance Lead
        │
        ▼
Compliance Director
        │
        ▼
  Chief Compliance Officer
```

### 7.3 Security Operations Track

```
SOC Analyst
        │
        ▼
Security Operations Engineer
        │
        ▼
Security Operations Lead
        │
        ▼
Security Operations Manager
        │
        ▼
    Director, SecOps
```

---

## 8. Training & Entwicklung

### 8.1 Pflicht-Trainings

| Training | Zielgruppe | Häufigkeit | Dauer |
|----------|------------|------------|-------|
| Security Awareness | Alle Mitarbeiter | Jährlich | 2 Stunden |
| Security Fundamentals | Neue Security-Mitarbeiter | Onboarding | 8 Stunden |
| Incident Response | Security Team | Quartalsweise | 4 Stunden |
| Secure Coding | Entwickler + AppSec | Halbjährlich | 4 Stunden |

### 8.2 Zertifizierungen

| Zertifizierung | Zielrolle | Kosten | Erstattung |
|----------------|-----------|--------|------------|
| CISSP | Security Lead+ | 5.000 € | 100% |
| CISM | Security Manager | 4.000 € | 100% |
| ISO 27001 LA | Compliance Lead | 3.000 € | 100% |
| AWS Security | Platform Sec | 2.000 € | 100% |
| CKS (Kubernetes Security) | Security Eng | 500 € | 100% |

---

## 9. Performance-Metriken

### 9.1 Team-KPIs

| KPI | Target | Messung |
|-----|--------|---------|
| Vulnerability Remediation Time (Critical) | < 7 Tage | Dashboard |
| Incident Response Time (SEV1) | < 15 Min | PagerDuty |
| MTTD (Mean Time to Detect) | < 5 Min | SIEM |
| Security Training Completion | 100% | LMS |
| Audit Finding Closure | < 30 Tage | Audit Tracker |

### 9.2 Individuelle Ziele

| Rolle | Key Results |
|-------|-------------|
| Security Engineer | mTLS 100%, 0 kritische Vulns > 7 Tage |
| AppSec Engineer | CI/CD Gates 100%, 0 Dependency-Vulns |
| Platform Sec Engineer | Vault HA, NetworkPolicies 100% |
| Compliance Lead | ISO Stage 1 bestanden, SOC2 Readiness |
| SecOps Lead | MTTD < 5 Min, On-Call SLA 95% |

---

## 10. Genehmigung

### 10.1 Organisations-Chart-Genehmigung

| Rolle | Name | Unterschrift | Datum |
|-------|------|--------------|-------|
| CEO | | | |
| CTO | | | |
| CFO | | | |
| HR Director | | | |

### 10.2 Dokument-Information

| Attribut | Wert |
|-----------|------|
| Owner | CISO |
| Reviewer | HR Director, CTO |
| Version | 1.0 |
| Status | Zur Genehmigung |
| Nächster Review | Q2 2025 |

---

**Anhang:**

- A: Detaillierte Job-Beschreibungen
- B: Gehalts-Benchmarking
- C: Interview-Guide für Security-Rollen
- D: Onboarding-Checkliste
