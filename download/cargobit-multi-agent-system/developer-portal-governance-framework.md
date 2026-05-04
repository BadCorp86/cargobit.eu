# Developer-Portal Governance-Framework

## Wer entscheidet was? Wie wird Qualität, Konsistenz und Kontrolle sichergestellt?

Dieses Framework definiert **Rollen, Prozesse, Verantwortlichkeiten und Kontrollmechanismen** für das CargoBit Developer-Portal.

---

## 1. Governance-Ziele

| Ziel | Beschreibung |
|------|--------------|
| Konsistenz | Einheitliche Sprache, Stil und Struktur über alle Inhalte |
| Hohe Qualität | Fehlerfreie, aktuelle und nützliche Dokumentation |
| Sicherheit und Compliance | Einhaltung aller regulatorischen Anforderungen |
| Klare Verantwortlichkeiten | Jedes Dokument hat einen definierten Owner |
| Nachvollziehbare Entscheidungen | Alle Änderungen sind dokumentiert und begründet |
| Minimierung von Drift | Verhinderung von veralteten oder widersprüchlichen Inhalten |

---

## 2. Rollen

### 2.1 Portal Owner

**Verantwortung:**
- Gesamtverantwortung für das Developer-Portal
- Definition und Kommunikation der Roadmap
- Endgültige Qualitätssicherung
- Budget und Ressourcen-Management
- Stakeholder-Kommunikation

**Entscheidungsbefugnisse:**
- Release-Freigabe
- Strukturänderungen
- Tool-Einführungen
- Richtlinien-Änderungen

### 2.2 Content Owner

**Verantwortung:**
- Verantwortlich für definierte Dokumentationsbereiche
- Aktualität und Korrektheit der Inhalte sicherstellen
- Review eingehender Änderungsanfragen
- Koordination mit Technical Writers

**Dokumentationsbereiche (Beispiele):**
- API Reference Owner
- Guides & Tutorials Owner
- Webhooks Documentation Owner
- Changelog Owner
- SDK Documentation Owner

### 2.3 Technical Reviewer

**Verantwortung:**
- Prüfung der technischen Korrektheit
- Validierung aller Code-Beispiele
- Prüfung der API-Konsistenz
- Überprüfung der Versionskompatibilität

**Checkliste für Technical Review:**
- [ ] API-Endpunkte korrekt dokumentiert
- [ ] Request/Response-Beispiele funktionieren
- [ ] Code-Snippets sind ausführbar
- [ ] Versionshinweise sind aktuell
- [ ] Error-Codes sind vollständig

### 2.4 Security Reviewer

**Verantwortung:**
- Prüfung sicherheitsrelevanter Inhalte
- Validierung von Webhook-Beispielen
- Prüfung von Hardening-Hinweisen
- Review von Authentication-Dokumentation

**Prüfpunkte:**
- Keine hardcodierten Secrets in Beispielen
- Sichere Code-Patterns
- Korrekte Auth-Flow-Dokumentation
- DSGVO-konforme Datenbeispiele

### 2.5 Compliance Reviewer

**Verantwortung:**
- Prüfung der GDPR-Konformität
- Validierung von Retention-Hinweisen
- Prüfung der SLA-Bezüge
- Review von Legal-Texten

**Compliance-Checkliste:**
- [ ] Datenschutzerklärung aktuell
- [ ] Cookie-Hinweise korrekt
- [ ] Retention-Periods dokumentiert
- [ ] SLA-Referenzen korrekt

---

## 3. Governance-Prozesse

### 3.1 Content Lifecycle

```
┌─────────┐    ┌─────────────────┐    ┌──────────────────┐
│  Draft  │───►│ Technical Review │───►│ Security Review  │
└─────────┘    └─────────────────┘    └──────────────────┘
                                              │
                                              ▼
┌─────────┐    ┌──────────┐    ┌───────────────────────┐
│ Publish │◄───│ Approval │◄───│ Compliance Review     │
└─────────┘    └──────────┘    │ (falls relevant)      │
               │               └───────────────────────┘
               ▼
        ┌─────────────┐
        │ Versioniert │
        └─────────────┘
```

**Phasen-Detail:**

| Phase | Dauer (typ.) | Verantwortlich | Output |
|-------|--------------|----------------|--------|
| Draft | 1-5 Tage | Content Owner | Draft-Dokument |
| Technical Review | 1-3 Tage | Technical Reviewer | Freigabe-Status |
| Security Review | 1-2 Tage | Security Reviewer | Sicherheits-Freigabe |
| Compliance Review | 1-3 Tage | Compliance Reviewer | Compliance-Freigabe |
| Approval | 1 Tag | Portal Owner | Final Approval |
| Publish | Sofort | CMS | Veröffentlichte Version |

### 3.2 Monthly Governance Review

**Teilnehmer:**
- Portal Owner
- Alle Content Owners
- Technical Reviewer
- Security Reviewer

**Agenda:**
1. Broken Links Report (automatisiert)
2. Outdated Content Report
3. Missing Translations Report
4. Search Analytics Review
5. Developer Feedback Zusammenfassung
6. Action Items für nächsten Monat

**KPIs:**
- Broken Links < 0.1%
- Content Age < 90 Tage (für kritische Docs)
- Translation Coverage > 95%

### 3.3 Quarterly Governance Review

**Teilnehmer:**
- Erweitertes Team inkl. Stakeholder

**Agenda:**
1. Struktur-Review (Information Architecture)
2. IA-Optimierungsvorschläge
3. Content-Gaps Analyse
4. Developer Feedback Deep-Dive
5. Roadmap Review
6. Budget und Ressourcen-Planung

---

## 4. Governance-Artefakte

### 4.1 Content Inventory

**Struktur:**
```yaml
content-inventory:
  api-reference:
    owner: "api-team@ cargobit.io"
    last-updated: "2025-01-15"
    status: "current"
    reviewers:
      - "tech-lead@cargobit.io"
    compliance-required: true
    
  guides-tutorials:
    owner: "devrel@cargobit.io"
    last-updated: "2025-01-20"
    status: "current"
    
  webhooks:
    owner: "integrations@cargobit.io"
    last-updated: "2025-01-10"
    status: "needs-review"
```

### 4.2 Review Logs

**Format:**
```json
{
  "review_id": "REV-2025-001",
  "document": "api-reference/payments",
  "reviewer": "tech-lead@cargobit.io",
  "date": "2025-01-15",
  "status": "approved",
  "comments": "API-Version 2.3 korrekt dokumentiert",
  "conditions": []
}
```

### 4.3 Version History

**Change Log Format:**
```markdown
## [2025.01.15] - API Reference Update

### Added
- Neuer Endpunkt `/v2/payments/refunds/batch`
- Webhook-Event `refund.batch.completed`

### Changed
- Rate Limits für `/v2/payments` erhöht

### Fixed
- Falsches Response-Format in Beispiel korrigiert

### Reviewers
- Technical: @tech-lead
- Security: @security-reviewer
- Approved by: @portal-owner
```

### 4.4 Governance Dashboard

**Metriken:**

| Metrik | Ziel | Aktuell | Trend |
|--------|------|---------|-------|
| Content Currency | < 90 Tage | 78 Tage | ✅ |
| Broken Links | < 0.1% | 0.05% | ✅ |
| Review Backlog | < 10 Docs | 3 Docs | ✅ |
| Translation Coverage | > 95% | 97% | ✅ |
| Security Issues | 0 | 0 | ✅ |
| Compliance Score | 100% | 100% | ✅ |

---

## 5. Eskalationspfade

### Level 1: Content Owner
- Standard-Änderungen
- Minor Updates
- Bug Fixes

### Level 2: Technical/Security Reviewer
- Technische Reviews
- Sicherheitsrelevante Änderungen
- Compliance-relevante Updates

### Level 3: Portal Owner
- Strukturänderungen
- Neue Sektionen
- Richtlinien-Änderungen
- Release-Entscheidungen

### Level 4: Stakeholder Committee
- Budget-Entscheidungen
- Strategische Neuausrichtungen
- Major Releases

---

## 6. Automatisierung

### CI/CD Integration

```yaml
# .github/workflows/content-governance.yml
name: Content Governance

on:
  pull_request:
    paths:
      - 'docs/**'
      - 'content/**'

jobs:
  governance-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check Content Owner Assignment
        run: |
          # Prüft, ob ein Content Owner im Frontmatter definiert ist
          
      - name: Validate Review Requirements
        run: |
          # Prüft, ob notwendige Reviews basierend auf Content-Typ
          
      - name: Broken Link Check
        run: |
          # Prüft alle internen und externen Links
          
      - name: Markdown Lint
        run: |
          # Prüft Markdown-Formatierung
```

### Governance Bot

**Funktionen:**
- Automatische Zuweisung von Reviewern
- Erinnerungen für überfällige Reviews
- Automatische Content-Inventory-Updates
- Weekly Governance Report

---

## 7. Richtlinien

### 7.1 Änderungsrichtlinien

| Änderungstyp | Approval-Level | Review-Zeit |
|--------------|----------------|-------------|
| Typo/Kleinigkeit | Content Owner | 1 Tag |
| Neuer Content | Technical + Portal Owner | 3-5 Tage |
| Strukturänderung | Portal Owner + Stakeholder | 1-2 Wochen |
| Sicherheitsrelevant | Security + Portal Owner | 2-3 Tage |
| Compliance-relevant | Compliance + Portal Owner | 3-5 Tage |

### 7.2 Archivierungsrichtlinien

**Kriterien für Archivierung:**
- Content älter als 2 Jahre ohne Update
- Deprecated API-Versionen
- Nicht mehr unterstützte Features

**Archivierungsprozess:**
1. Kennzeichnung als "Archived"
2. Redirect auf aktuelle Version
3. Entfernung aus Suchindex
4. Archiv-Verzeichnis

---

## 8. Audit-Trail

Alle Governance-Entscheidungen werden für 7 Jahre dokumentiert:

- Wer hat was entschieden?
- Wann wurde entschieden?
- Warum wurde entschieden?
- Welche Alternativen wurden erwogen?

**Speicherort:** Governance-Audit-Log ( immutable, tamper-proof )

---

## 9. Kontakt

| Rolle | Kontakt | Verfügbarkeit |
|-------|---------|---------------|
| Portal Owner | portal-owner@cargobit.io | Mo-Fr, 9-18 Uhr |
| Technical Review | tech-review@cargobit.io | Mo-Fr, 9-18 Uhr |
| Security Review | security-review@cargobit.io | 24/7 (PagerDuty) |
| Compliance | compliance@cargobit.io | Mo-Fr, 9-17 Uhr |

**Notfall-Eskalation:** emergency@cargobit.io (24/7)

---

*Dieses Governance-Framework wird quartalsweise überprüft und bei Bedarf aktualisiert. Letzte Überprüfung: Januar 2025.*
