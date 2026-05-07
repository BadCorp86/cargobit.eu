# Post-Incident Review – Governance Postcheck

Vorlage für Post-Mortem Meetings nach Incidents im CargoBit Multi-Agent System.

---

## Incident-Übersicht

| Feld | Wert |
|------|------|
| **Incident ID** | INC-XXXX |
| **Titel** | <!-- Kurze Beschreibung --> |
| **Severity** | SEV-1 / SEV-2 / SEV-3 |
| **Entdeckt** | <!-- YYYY-MM-DD HH:MM --> |
| **Behoben** | <!-- YYYY-MM-DD HH:MM --> |
| **Dauer** | <!-- Xh Ym --> |
| **Owner** | <!-- Name --> |

---

## Timeline

### Detaillierter Ablauf

| Zeit | Event | Actor | Aktion |
|------|-------|-------|--------|
| <!-- HH:MM --> | Alert ausgelöst | System | PagerDuty |
| <!-- HH:MM --> | Erste Response | On-Call | Acknowledged |
| <!-- HH:MM --> | Diagnose | On-Call | Log-Analyse |
| <!-- HH:MM --> | Mitigation | Team | Rollback |
| <!-- HH:MM --> | Behoben | Team | Service stabil |
| <!-- HH:MM --> | Post-Incident | Team | Review gestartet |

### Phasen-Dauer

| Phase | Dauer | Ziel | Status |
|-------|-------|------|--------|
| TTD (Time to Detect) | <!-- min --> | < 5 min | ✅/⚠️/❌ |
| TTA (Time to Acknowledge) | <!-- min --> | < 5 min | ✅/⚠️/❌ |
| TTM (Time to Mitigate) | <!-- min --> | < 15 min | ✅/⚠️/❌ |
| TTR (Time to Resolve) | <!-- min --> | < 30 min | ✅/⚠️/❌ |

---

## Impact-Analyse

### User Impact

| Metrik | Wert | Normal | Abweichung |
|--------|------|--------|------------|
| Betroffene User | <!-- N --> | 0 | +<!-- N --> |
| Fehlgeschlagene Requests | <!-- N --> | < 0.1% | +<!-- %> |
| SLO-Breach Dauer | <!-- min --> | 0 min | +<!-- min --> |
| Error Budget verbraucht | <!-- %> | – | <!-- %> |

### Business Impact

| Aspekt | Impact |
|--------|--------|
| Revenue | <!-- Beschreibung --> |
| Reputation | <!-- Beschreibung --> |
| Compliance | <!-- Beschreibung --> |

### System Impact

| Komponente | Status | Dauer |
|------------|--------|-------|
| <!-- Service --> | Degraded/Down | <!-- Dauer --> |
| <!-- Service --> | Degraded/Down | <!-- Dauer --> |

---

## Root Cause Analysis (5 Whys)

### Problem Statement

```
<!-- Was ist passiert? Eine präzise Aussage. -->
```

### 5 Whys

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Warum ist es passiert? | <!-- Antwort --> |
| 2 | Warum ist das passiert? | <!-- Antwort --> |
| 3 | Warum ist das passiert? | <!-- Antwort --> |
| 4 | Warum ist das passiert? | <!-- Antwort --> |
| 5 | Warum ist das passiert? | <!-- Antwort --> |

### Root Cause

```
<!-- Die fundamentale Ursache, die behoben werden muss -->
```

---

## Blameless Post-Mortem

### Was lief gut?

| Aspekt | Beschreibung |
|--------|--------------|
| <!-- Detection --> | <!-- Beschreibung --> |
| <!-- Response --> | <!-- Beschreibung --> |
| <!-- Communication --> | <!-- Beschreibung --> |

### Was lief nicht gut?

| Aspekt | Beschreibung |
|--------|--------------|
| <!-- Detection --> | <!-- Beschreibung --> |
| <!-- Response --> | <!-- Beschreibung --> |
| <!-- Communication --> | <!-- Beschreibung --> |

### Was haben wir gelernt?

```
<!-- Lessons Learned -->
```

---

## Action Items

### Sofortige Maßnahmen (P1)

| # | Aktion | Owner | Deadline | Status |
|---|--------|-------|----------|--------|
| 1 | <!-- Aktion --> | <!-- Name --> | <!-- Datum --> | ⬜ |
| 2 | <!-- Aktion --> | <!-- Name --> | <!-- Datum --> | ⬜ |

### Mittelfristige Maßnahmen (P2)

| # | Aktion | Owner | Deadline | Status |
|---|--------|-------|----------|--------|
| 1 | <!-- Aktion --> | <!-- Name --> | <!-- Datum --> | ⬜ |
| 2 | <!-- Aktion --> | <!-- Name --> | <!-- Datum --> | ⬜ |

### Langfristige Maßnahmen (P3)

| # | Aktion | Owner | Deadline | Status |
|---|--------|-------|----------|--------|
| 1 | <!-- Aktion --> | <!-- Name --> | <!-- Datum --> | ⬜ |

---

## Follow-Up Tracking

### Action Item Status

| Datum | Action Item | Status | Update |
|-------|-------------|--------|--------|
| <!-- Datum --> | <!-- Item --> | ⬜/🔄/✅/❌ | <!-- Update --> |

### Nächstes Review

| Feld | Wert |
|------|------|
| Datum | <!-- YYYY-MM-DD --> |
| Teilnehmer | <!-- Namen --> |
| Fokus | <!-- Thema --> |

---

## Kommunikation

### Interne Stakeholder

| Team | Kanal | Status |
|------|-------|--------|
| Engineering | Slack #eng | ✅ Informiert |
| Product | Slack #product | ✅ Informiert |
| Leadership | Email | ✅ Informiert |

### Externe Kommunikation

| Stakeholder | Kanal | Status |
|-------------|-------|--------|
| Kunden | Status Page | ✅/⬜ |
| Partner | Email | ✅/⬜ |

### Status Page Updates

| Zeit | Nachricht |
|------|-----------|
| <!-- HH:MM --> | <!-- Nachricht --> |
| <!-- HH:MM --> | <!-- Nachricht --> |

---

## Dokumentation

### Erstellte/aktualisierte Dokumente

| Dokument | Link | Typ |
|----------|------|-----|
| <!-- Runbook --> | <!-- URL --> | Neu/Aktualisiert |
| <!-- Alert --> | <!-- URL --> | Neu/Aktualisiert |
| <!-- Wiki --> | <!-- URL --> | Neu/Aktualisiert |

---

## Meeting-Teilnehmer

| Name | Rolle | Anwesend |
|------|-------|----------|
| <!-- Name --> | Incident Commander | ✅ |
| <!-- Name --> | On-Call | ✅ |
| <!-- Name --> | SRE | ✅ |
| <!-- Name --> | Developer | ✅ |
| <!-- Name --> | Product Owner | ✅/⬜ |

---

## Sign-off

| Rolle | Name | Datum |
|-------|------|-------|
| Incident Owner | <!-- Name --> | <!-- Datum --> |
| SRE Lead | <!-- Name --> | <!-- Datum --> |
| Engineering Manager | <!-- Name --> | <!-- Datum --> |

---

*Block CY – Post-Incident Review*
