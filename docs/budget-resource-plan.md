# Budget- und Ressourcen-Plan

**CargoBit Transport Platform**  
**Security & Compliance Initiative 2025**  
**Dokument-ID:** BUDGET-2025-001  
**Klassifikation:** Intern – Finance & Management  
**Datum:** 15. Januar 2025

---

## 1. Zusammenfassung

| Position | Betrag | Zeitraum |
|----------|--------|----------|
| Personalkosten (intern) | 380.000 € | 12 Monate |
| Externe Dienstleister | 110.000 € | 12 Monate |
| Tooling & Lizenzen | 55.000 € | 12 Monate |
| Training & Entwicklung | 30.000 € | 12 Monate |
| Penetration-Tests & Audits | 75.000 € | 12 Monate |
| **Gesamtinvestition** | **650.000 €** | **12 Monate** |

**Payback-Period:** < 1 Enterprise-Deal  
**ROI:** 200-500% über 3 Jahre (präventive Maßnahmen)

---

## 2. Team-Ressourcen (FTE)

### 2.1 Personalbedarf nach Quartal

| Rolle | Q1 | Q2 | Q3 | Q4 | Jahres-FTE |
|-------|----|----|----|----|------------|
| Security Engineer | 1.0 | 1.0 | 1.0 | 1.0 | 4.0 |
| Platform/DevOps Engineer | 0.5 | 0.5 | 0.5 | 0.5 | 2.0 |
| Compliance Lead | - | 0.3 | 0.5 | 0.3 | 1.1 |
| Backend Engineer | 0.5 | 0.5 | 0.3 | - | 1.3 |
| **Gesamt-FTE** | **2.0** | **2.3** | **2.3** | **1.8** | **8.4** |

### 2.2 Rollenbeschreibung und Verantwortung

| Rolle | Hauptverantwortung | Skills erforderlich | Hiring-Priorität |
|-------|-------------------|---------------------|------------------|
| **Security Engineer** | mTLS, NetworkPolicies, Hardening, CI/CD Security | Kubernetes, Security, Python/Go | Sofort |
| **Platform/DevOps Engineer** | Observability, Secrets-Management, Infrastructure | Terraform, Kubernetes, Monitoring | Sofort |
| **Compliance Lead** | ISO 27001, SOC2, Policies, Evidence Collection | Compliance, Audit, Documentation | Q2 |
| **Backend Engineer** | Security-Config-Service, Audit-Logs | Go/Java, API Development | Q1 |

### 2.3 On-Call Rotation

| Parameter | Wert |
|-----------|------|
| Team-Größe | 3-5 Personen |
| Rotation | Wöchentlich |
| Abdeckung | 24/7 |
| Eskalationsstufen | 3 |

### 2.4 Team-Konfiguration

**Minimal-Setup (Startups/Scale-ups):**
```
2-3 Personen

CISO / Head of Security
        │
        ├── Security Engineer (mTLS, NetworkPolicies, CI/CD)
        │
        └── Platform Engineer (Monitoring, Secrets, Infra)
```

**Optimal-Setup (Enterprise-Ready):**
```
4-5 Personen

                 CISO / Head of Security
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
Security Engineering   Compliance Lead     Security Operations
        │                  │                  │
   AppSec Eng         ISO/SOC2           Incident Response
   Platform Sec       Evidence           SRE/On-Call
```

---

## 3. Tooling-Budget (Jährlich)

### 3.1 Budget-Übersicht nach Kategorie

| Kategorie | Tool | Kosten (konservativ) | Kosten (Enterprise) |
|-----------|------|---------------------|---------------------|
| Secrets-Management | HashiCorp Vault / AWS KMS | 5.000 € | 15.000 € |
| Monitoring/Logging | Grafana Cloud / Loki | 10.000 € | 25.000 € |
| Compliance Automation | Drata / Vanta / Secureframe | 15.000 € | 40.000 € |
| CI/CD Security | Snyk / GitHub Advanced Security | 10.000 € | 30.000 € |
| Vulnerability Scanning | Qualys / Nessus | 8.000 € | 20.000 € |
| SIEM/Alerting | PagerDuty / OpsGenie | 5.000 € | 12.000 € |
| Documentation | Confluence / Notion | 3.000 € | 8.000 € |
| **Zwischensumme** | | **56.000 €** | **150.000 €** |

### 3.2 Tool-Auswahl nach Quartal

| Quartal | Tools | Kosten | Priorität |
|---------|-------|--------|-----------|
| Q1 | HashiCorp Vault, cert-manager | 8.000 € | Kritisch |
| Q2 | Grafana Cloud, Loki, PagerDuty | 15.000 € | Hoch |
| Q3 | Vanta/Drata (Compliance) | 15.000 € | Hoch |
| Q4 | Snyk, Qualys | 18.000 € | Mittel |

### 3.3 Tool-Integrations-Matrix

| Tool | Integriert mit | Zweck |
|------|----------------|-------|
| Vault | Kubernetes, CI/CD | Secrets-Management |
| Grafana | Prometheus, Loki | Dashboards |
| PagerDuty | Grafana, Slack | Alerting |
| Snyk | GitHub, CI/CD | Dependency Scanning |
| Vanta | AWS, GitHub, HR | Compliance Automation |

---

## 4. Externe Dienstleister

### 4.1 Beratungs- und Audit-Kosten

| Dienstleistung | Anbieter | Kosten | Zeitraum |
|----------------|----------|--------|----------|
| Security Architecture Review | NCC Group / External | 30.000 € | Q1 |
| ISO 27001 Gap Assessment | BSI / TÜV | 20.000 € | Q2 |
| ISO 27001 Stage 1 & 2 Audit | BSI / TÜV | 40.000 € | Q3-Q4 |
| SOC 2 Readiness Assessment | Big 4 / Boutique | 15.000 € | Q2 |
| Red Team Simulation | NCC Group | 25.000 € | Q4 |
| **Gesamt** | | **130.000 €** | |

### 4.2 Penetration-Testing

| Test-Typ | Umfang | Kosten | Häufigkeit |
|----------|--------|--------|------------|
| Infrastructure Pentest | Externe Perimeter, Cloud | 20.000 € | Annual |
| Application Pentest | API, Web-Apps | 15.000 € | Annual |
| Retest | Kritische Findings | 5.000 € | Post-Remediation |
| **Gesamt** | | **40.000 €** | |

### 4.3 Training & Zertifizierungen

| Training | Zielgruppe | Kosten | Anzahl |
|----------|------------|--------|--------|
| Security Awareness (alle) | Alle Mitarbeiter | 5.000 € | 50 Personen |
| CISSP / CISM | Security Lead | 5.000 € | 1 Person |
| Kubernetes Security | Platform Team | 3.000 € | 3 Personen |
| ISO 27001 Lead Auditor | Compliance Lead | 4.000 € | 1 Person |
| AWS Security Specialty | DevOps Team | 3.000 € | 2 Personen |
| **Gesamt** | | **20.000 €** | |

---

## 5. Zeitplan & Aufwand

### 5.1 Quartalsübersicht

| Quartal | Aufwand | Fokus | Budget-Verbrauch |
|---------|---------|-------|------------------|
| Q1 | **Hoch** | Hardening, mTLS, Config-Service | 180.000 € |
| Q2 | Mittel | Monitoring, Alerting, On-Call | 140.000 € |
| Q3 | Mittel | Compliance, Evidence, Policies | 160.000 € |
| Q4 | Hoch | Automation, Pentest, Red-Team | 170.000 € |

### 5.2 Meilensteine pro Quartal

**Q1 2025 - Foundation & Hardening**
| Meilenstein | Deadline | Budget | Verantwortlich |
|-------------|----------|--------|----------------|
| mTLS Design | KW 2 | - | Platform Lead |
| Vault Deployment | KW 4 | 8.000 € | DevOps Lead |
| Erste Services mit mTLS | KW 6 | - | Security Engineer |
| NetworkPolicies aktiv | KW 10 | - | Security Engineer |
| Q1 Review | KW 12 | - | CISO |

**Q2 2025 - Monitoring & Detection**
| Meilenstein | Deadline | Budget | Verantwortlich |
|-------------|----------|--------|----------------|
| Loki Deployment | KW 14 | 10.000 € | DevOps Lead |
| Dashboards live | KW 16 | - | Platform Lead |
| Alerting implementiert | KW 20 | 5.000 € | SOC Team |
| On-Call Rotation aktiv | KW 20 | - | Team Leads |
| Q2 Review | KW 24 | - | CISO |

**Q3 2025 - Governance & Compliance**
| Meilenstein | Deadline | Budget | Verantwortlich |
|-------------|----------|--------|----------------|
| ISO Mapping komplett | KW 27 | - | Compliance Lead |
| SOC2 Mapping komplett | KW 27 | - | Compliance Lead |
| Evidence Automation | KW 32 | 15.000 € | Compliance Lead |
| ISO Stage 1 Audit | KW 36 | 20.000 € | CISO |
| Q3 Review | KW 36 | - | CISO |

**Q4 2025 - Automation & Resilience**
| Meilenstein | Deadline | Budget | Verantwortlich |
|-------------|----------|--------|----------------|
| CI/CD Security Gates | KW 40 | 18.000 € | DevOps Lead |
| Red Team Simulation | KW 42 | 25.000 € | Security Lead |
| Penetration Test | KW 44 | 40.000 € | External |
| ISO Stage 2 Audit | KW 48 | 20.000 € | CISO |
| Annual Review | KW 52 | - | CISO |

---

## 6. Risiken & Mitigation

### 6.1 Budget-Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation | Reserve |
|--------|-------------------|------------|------------|---------|
| Tooling-Kosten überschätzt | Mittel | Niedrig | Phased rollout | +10% Buffer |
| Externe Berater teurer | Mittel | Mittel | Festpreisvereinbarungen | +15% Buffer |
| Zusätzliche Pentests nötig | Niedrig | Mittel | Scope früh definieren | +5% Buffer |
| **Gesamt-Reserve** | | | | **30% (195.000 €)** |

### 6.2 Ressourcen-Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| Hiring verzögert sich | Hoch | Hoch | Contractor bridgen |
| Team-Burnout | Mittel | Hoch | Klare Rotation, Playbooks |
| Skills-Lücken | Mittel | Mittel | Training, Consultants |
| Key-Person-Risiko | Niedrig | Kritisch | Dokumentation, Cross-Training |

### 6.3 Risiko-Matrix

```
Auswirkung
    ↑
Krit│                  [Key-Person]     
    │                                    
Hoch│  [Hiring-Delay]    [Burnout]      
    │                                    
Mittel│ [Skills]        [Tooling]      
    │                                    
Niedrig│               [Pentest]       
    └──────────────────────────────────→ Wahrscheinlichkeit
          Niedrig    Mittel    Hoch
```

---

## 7. ROI-Analyse

### 7.1 Kosten-Nutzen-Vergleich

| Szenario | Ohne Roadmap | Mit Roadmap | Einsparung |
|----------|--------------|-------------|------------|
| Security-Incident | 500.000 - 2.000.000 € | 50.000 - 100.000 € | 450.000 - 1.900.000 € |
| Verlorener Enterprise-Deal | 200.000 €/Deal | Closed | 200.000 € |
| Compliance-Bußgelder | Bis 20.000.000 € | 0 € | Bis 20.000.000 € |
| Audit-Vorbereitung | 200 Stunden | 40 Stunden | 160 Stunden |
| Reputationsschaden | Nicht quantifizierbar | Prevention | Incalculable |

### 7.2 Break-Even-Analyse

| Metrik | Wert |
|--------|------|
| Gesamtinvestition | 650.000 € |
| Ein Enterprise-Deal (Durchschnitt) | 200.000 € |
| Deals für Break-Even | 3-4 Deals |
| Payback-Period | 6-9 Monate |

### 7.3 Langzeit-ROI (3 Jahre)

| Jahr | Investition | Ertrag (präventiv) | Netto |
|------|-------------|-------------------|-------|
| Jahr 1 | 650.000 € | 400.000 € | -250.000 € |
| Jahr 2 | 200.000 € (Ops) | 600.000 € | +400.000 € |
| Jahr 3 | 200.000 € (Ops) | 800.000 € | +600.000 € |
| **Gesamt** | **1.050.000 €** | **1.800.000 €** | **+750.000 €** |

---

## 8. Genehmigungsprozess

### 8.1 Budget-Freigabe-Stufen

| Stufe | Betrag | Genehmiger | Prozess |
|-------|--------|------------|---------|
| 1 | < 10.000 € | Department Head | Simplifiziert |
| 2 | 10.000 - 50.000 € | CTO + CFO | Standard |
| 3 | 50.000 - 200.000 € | Executive Board | Erweitert |
| 4 | > 200.000 € | CEO + Board | Vollständig |

### 8.2 Genehmigungsanforderungen

| Position | Genehmigung erforderlich |
|----------|-------------------------|
| CEO | Gesamtstrategie, Budget-Gesamtsumme |
| CFO | Budget-Allocierung, Cashflow |
| CTO | Team-Aufbau, Tooling |
| CISO | Technische Umsetzung |

---

## 9. Reporting

### 9.1 Berichts-Kadenz

| Bericht | Häufigkeit | Empfänger | Inhalt |
|---------|------------|-----------|--------|
| Weekly Status | Wöchentlich | Security Team | Fortschritt, Blockers |
| Monthly Executive | Monatlich | C-Level | KPIs, Budget |
| Quarterly Board | Quartalsweise | Board | Strategie, ROI |

### 9.2 KPI-Dashboard

| KPI | Q1 Target | Q2 Target | Q3 Target | Q4 Target |
|-----|-----------|-----------|-----------|-----------|
| Budget-Verbrauch | 28% | 50% | 75% | 100% |
| Meilensteine erfüllt | 80% | 85% | 90% | 95% |
| Team-Auslastung | 80% | 85% | 85% | 80% |
| Security Score | 2.0 | 2.5 | 3.5 | 4.0 |

---

## 10. Genehmigung

### 10.1 Unterschriften

| Rolle | Name | Unterschrift | Datum |
|-------|------|--------------|-------|
| CFO | | | |
| CTO | | | |
| CEO | | | |

### 10.2 Dokument-Information

| Attribut | Wert |
|-----------|------|
| Owner | CISO |
| Reviewer | CFO, CTO |
| Version | 1.0 |
| Status | Zur Genehmigung |
| Gültig bis | 31.12.2025 |

---

**Anhang:**

- A: Detaillierte Tool-Vergleichsmatrix
- B: Anbieter-Angebote (separat)
- C: ROI-Modell (Excel)
- D: Risikoregister
