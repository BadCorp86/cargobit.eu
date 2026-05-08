# Rollback-Decision-Tree – Governance Postcheck

Entscheidungsbaum für systematische Rollback-Entscheidungen bei Incidents oder fehlgeschlagenen Deployments.

---

## Übersicht

```
                    ┌─────────────────────────────┐
                    │   INCIDENT DETECTED         │
                    │   (Alert / SLO-Breach)      │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │   Q1: Ist der Service       │
                    │   erreichbar?               │
                    └──────────────┬──────────────┘
                           ┌───────┴───────┐
                          NEIN            JA
                           │               │
                           ▼               ▼
                ┌──────────────────┐  ┌──────────────────┐
                │   HARD ROLLBACK  │  │   Q2: SLO-Breach │
                │   (Sofort)       │  │   > 5%?          │
                └──────────────────┘  └────────┬─────────┘
                                        ┌──────┴──────┐
                                       JA            NEIN
                                        │             │
                                        ▼             ▼
                            ┌──────────────────┐  ┌──────────────────┐
                            │   HARD ROLLBACK  │  │   Q3: Error-Rate │
                            │   (Sofort)       │  │   steigend?      │
                            └──────────────────┘  └────────┬─────────┘
                                                    ┌──────┴──────┐
                                                   JA            NEIN
                                                    │             │
                                                    ▼             ▼
                                        ┌──────────────────┐  ┌──────────────────┐
                                        │   SOFT ROLLBACK  │  │   MONITOR        │
                                        │   (15 min)       │  │   (Weiter beob.) │
                                        └──────────────────┘  └──────────────────┘
```

---

## Rollback-Typen

### Hard Rollback (Sofort)

**Trigger:**
- Service nicht erreichbar
- SLO-Breach > 5%
- Health-Check Failure > 50%
- Data Corruption vermutet

**Aktionen:**
1. Canary Traffic auf 0%
2. Vorheriges Image deployen
3. Incident Status auf SEV-2 setzen
4. Stakeholder informieren

**Command:**
```bash
./scripts/rollback.sh --hard --version <PREVIOUS_DIGEST>
```

---

### Soft Rollback (15 min)

**Trigger:**
- Error-Rate steigend
- Latency > P99 Threshold
- Einzelne Feature-Fehler
- Customer Complaints < 5

**Aktionen:**
1. Canary Traffic reduzieren (10% → 5% → 1%)
2. Vorheriges Image parallel deployen
3. Feature-Flag deaktivieren (falls verfügbar)
4. Monitoring intensivieren

**Command:**
```bash
./scripts/rollback.sh --soft --version <PREVIOUS_DIGEST> --canary-step 5
```

---

## Entscheidungs-Matrix

| Szenario | SLO-Impact | User-Impact | Rollback-Typ | Zeitrahmen |
|----------|------------|-------------|--------------|------------|
| Total Outage | > 50% | Alle User | Hard | Sofort |
| Partial Outage | 10–50% | Teile User | Hard | < 5 min |
| Degraded Performance | 5–10% | Erfahrung | Soft | < 15 min |
| Minor Issues | < 5% | Einzelne | Monitor | – |

---

## Rollback-Checkliste

### Vor Rollback

- [ ] Aktuellen Status dokumentieren
- [ ] Vorheriges Image-Digest identifiziert
- [ ] Rollback-Command getestet
- [ ] Stakeholder informiert

### Während Rollback

- [ ] Traffic schrittweise reduzieren
- [ ] Health-Probes überwachen
- [ ] Error-Rate beobachten
- [ ] Logs sichern für Post-Mortem

### Nach Rollback

- [ ] Service stabil bestätigt
- [ ] Incident-Ticket aktualisiert
- [ ] Post-Mortem angesetzt
- [ ] Root-Cause Analyse initiiert

---

## Eskalations-Pfad

| Level | Kriterium | Kontakt | SLA |
|-------|-----------|---------|-----|
| L1 | Standard Rollback | On-Call SRE | 5 min |
| L2 | Rollback fehlgeschlagen | SRE Lead | 15 min |
| L3 | Data Corruption vermutet | Platform Owner | Sofort |
| L4 | Kunden-Impact > 100 Users | Release Manager | Sofort |

---

## Rollback-Script Referenz

```bash
# Hard Rollback
./scripts/rollback.sh \
  --hard \
  --version sha256:abc123... \
  --notify slack:#incidents

# Soft Rollback mit Canary-Reduktion
./scripts/rollback.sh \
  --soft \
  --version sha256:def456... \
  --canary-step 5 \
  --monitor-duration 300
```

---

## KPI-Thresholds

| Metrik | Normal | Warning | Critical | Aktion |
|--------|--------|---------|----------|--------|
| Error Rate | < 0.1% | 0.1–1% | > 1% | Rollback |
| P99 Latency | < 500ms | 500–1000ms | > 1000ms | Rollback |
| SLO | > 99.5% | 99–99.5% | < 99% | Rollback |
| Health Score | > 80 | 60–80 | < 60 | Rollback |

---

*Block CV – Rollback-Decision-Tree*
