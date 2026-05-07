# On-Call Handover Template – Governance Postcheck

Übergabe-Protokoll für On-Call Rotationen im CargoBit Multi-Agent System.

---

## Handover-Info

| Feld | Wert |
|------|------|
| **Datum** | <!-- YYYY-MM-DD --> |
| **Uhrzeit** | <!-- HH:MM --> |
| **Von** | <!-- Outgoing On-Call --> |
| **An** | <!-- Incoming On-Call --> |
| **Rotation** | <!-- Primary/Secondary --> |

---

## System-Status

### Gesamtzustand

| System | Status | Anmerkungen |
|--------|--------|-------------|
| API Gateway | 🟢/🟡/🔴 | |
| Auth Service | 🟢/🟡/🔴 | |
| Agent Orchestrator | 🟢/🟡/🔴 | |
| Task Queue | 🟢/🟡/🔴 | |
| State Store | 🟢/🟡/🔴 | |
| Message Bus | 🟢/🟡/🔴 | |

### SLO-Status

| Service | Current SLO | Target | Status |
|---------|-------------|--------|--------|
| API Gateway | <!-- %> | 99.9% | 🟢/🟡/🔴 |
| Auth Service | <!-- %> | 99.9% | 🟢/🟡/🔴 |
| Agent Orchestrator | <!-- %> | 99.5% | 🟢/🟡/🔴 |

---

## Aktive Incidents

### Incident-Tabelle

| ID | Titel | Severity | Status | Seit | Assignee |
|----|------|----------|--------|------|----------|
| <!-- INC-XXX --> | <!-- Titel --> | SEV-1/2/3 | Open/Investigating | <!-- Zeit --> | <!-- Name --> |

### Details zu aktiven Incidents

#### Incident 1

```
ID: INC-XXXX
Titel: <!-- Titel -->
Severity: SEV-X
Status: <!-- Status -->
Impact: <!-- Beschreibung -->
Workaround: <!-- Falls vorhanden -->
Nächste Schritte: <!-- Was zu tun ist -->
```

#### Incident 2

```
<!-- Wiederholen für weitere Incidents -->
```

---

## Laufende Arbeiten

### Deployments in Progress

| Service | Version | Stage | Status | ETA |
|---------|---------|-------|--------|-----|
| <!-- Service --> | <!-- v1.2.3 --> | Canary/Prod | <!-- Status --> | <!-- Zeit --> |

### Geplante Wartungen

| Wartung | Zeitraum | Impact | Status |
|---------|----------|--------|--------|
| <!-- Beschreibung --> | <!-- Zeitraum --> | <!-- Impact --> | Geplant/Läuft |

### Feature Flags

| Flag | Status | Owner | Rücknahme-Datum |
|------|--------|-------|-----------------|
| <!-- flag_name --> | Aktiv/Inaktiv | <!-- Name --> | <!-- Datum --> |

---

## Offene To-Dos

| # | Aufgabe | Priorität | Status | Notizen |
|---|---------|-----------|--------|---------|
| 1 | <!-- Aufgabe --> | P1/P2/P3 | ⬜/🔄/✅ | |
| 2 | <!-- Aufgabe --> | P1/P2/P3 | ⬜/🔄/✅ | |
| 3 | <!-- Aufgabe --> | P1/P2/P3 | ⬜/🔄/✅ | |

---

## Anomalien & Beobachtungen

### Letzte 24h

| Zeit | Anomalie | Impact | Maßnahme |
|------|----------|--------|----------|
| <!-- HH:MM --> | <!-- Beschreibung --> | <!-- Impact --> | <!-- Maßnahme --> |

### Trends

| Metrik | Trend | Mögliche Ursache |
|--------|-------|------------------|
| <!-- Latency/Traffic/Errors --> | ↑/↓/→ | <!-- Ursache --> |

---

## Stakeholder-Kommunikation

### Ausstehende Updates

| Stakeholder | Thema | Fällig |
|-------------|-------|--------|
| <!-- Team/Person --> | <!-- Thema --> | <!-- Datum --> |

### Sent Notifications

| Zeit | Kanal | Thema | Empfänger |
|------|-------|-------|-----------|
| <!-- HH:MM --> | Slack/Email | <!-- Thema --> | <!-- Empfänger --> |

---

## Ressourcen

### Wichtige Links

| Ressource | URL |
|-----------|-----|
| Runbook | `docs/runbooks/` |
| Dashboard | `https://grafana.internal/d/cargobit` |
| AlertManager | `https://alertmanager.internal` |
| Incident Tracker | `https://incidents.internal` |

### Kontakt-Eskalation

| Level | Rolle | Kontakt | SLA |
|-------|-------|---------|-----|
| L1 | On-Call | PagerDuty | 5 min |
| L2 | SRE Lead | Slack @sre-lead | 15 min |
| L3 | Platform Owner | Slack @platform | 30 min |
| L4 | Engineering Director | Email | 1 h |

---

## Fragen & Klärungsbedarf

| # | Frage | Antwort |
|---|-------|---------|
| 1 | <!-- Frage --> | |
| 2 | <!-- Frage --> | |

---

## Handover-Checkliste

### Outgoing On-Call

- [ ] System-Status dokumentiert
- [ ] Aktive Incidents übergeben
- [ ] Laufende Arbeiten kommuniziert
- [ ] Anomalien erwähnt
- [ ] Fragen geklärt
- [ ] PagerDuty übergeben

### Incoming On-Call

- [ ] System-Status verstanden
- [ ] Aktive Incidents akzeptiert
- [ ] Runbooks gelesen
- [ ] Kontakt-Eskalation bekannt
- [ ] PagerDuty bestätigt

---

## Sign-off

| Rolle | Name | Unterschrift | Zeit |
|-------|------|--------------|------|
| Outgoing | <!-- Name --> | ✅ | <!-- HH:MM --> |
| Incoming | <!-- Name --> | ✅ | <!-- HH:MM --> |

---

*Block CX – On-Call Handover Template*
