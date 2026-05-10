# EA – SRE-Oncall-Handbuch

> **Zweck**: Vollständiges Handbuch für On-Call Ingenieure. Deckt Alerts, Escalation, Runbooks, Communication und Post-Incident Prozesse ab.

---

## 📋 SRE-Oncall-Handbuch – Governance Postcheck

### On-Call Übersicht

| Parameter | Wert |
|-----------|------|
| Rotation | Wochenweise |
| Stunden | 24/7 |
| Response Time (SEV-1) | < 15 Minuten |
| Response Time (SEV-2) | < 30 Minuten |
| Response Time (SEV-3) | < 2 Stunden |

---

## 1. On-Call Vorbereitung

### 1.1 Handover-Checkliste

**Vor Schichtbeginn**:

- [ ] PagerDuty/OpsGenie Shift übernommen
- [ ] Vorgänger-Handover gelesen
- [ ] Aktuelle Incidents geprüft
- [ ] Runbooks verfügbar
- [ ] Test-Deploy in Staging durchgeführt
- [ ] VPN/Zugang getestet

### 1.2 Wichtige Kontakte

| Rolle | Name | Telefon | Slack |
|-------|------|---------|-------|
| On-Call (Primary) | Ich | | |
| On-Call (Secondary) | | | |
| Platform Lead | | | |
| Security Lead | | | |
| SRE Manager | | | |
| CTO (L3 Escalation) | | | |

### 1.3 Wichtige Links

| Ressource | URL |
|-----------|-----|
| Grafana Dashboard | https://grafana.company.com/d/governance |
| Prometheus Alerts | https://prometheus.company.com/alerts |
| PagerDuty | https://company.pagerduty.com |
| Runbooks | /docs/runbooks/ |
| Incident Channel | #incidents |

---

## 2. Alert-Katalog

### 2.1 Kritische Alerts (SEV-1)

| Alert | Bedeutung | Erste Aktion | Runbook |
|-------|-----------|--------------|---------|
| **DeploymentFailure** | Deployment komplett blockiert | Admission Logs prüfen | Block CN |
| **SignatureVerifyFailed** | Alle Signaturen invalid | OIDC/Rekor prüfen | Block CN |
| **AdmissionDenialSpike** | Viele Deployments blockiert | Kyverno Logs | Block CL |
| **SLOAvailabilityCritical** | Availability < 99% | Service Health | Block CW |
| **KeyCompromised** | Key-Leak vermutet | Key Rotation | Block CO |

### 2.2 Hohe Priorität (SEV-2)

| Alert | Bedeutung | Erste Aktion | Runbook |
|-------|-----------|--------------|---------|
| **CVEBlocker** | CRITICAL CVE gefunden | Trivy Report | Block CQ |
| **CanarySLOViolation** | Canary SLO verletzt | Rollback | Block CV |
| **HighErrorRate** | Error Rate > 1% | Logs analysieren | Block CF |
| **TrivyScanFailed** | Scan fehlgeschlagen | Trivy Status | Block CQ |
| **PipelineFailure** | CI/CD Pipeline rot | Pipeline Logs | Block CC |

### 2.3 Mittlere Priorität (SEV-3)

| Alert | Bedeutung | Erste Aktion | Runbook |
|-------|-----------|--------------|---------|
| **SBOMGenerationFailed** | SBOM nicht erstellt | Syft prüfen | Block CQ |
| **SlowCanaryPromotion** | Canary stuck | Canary Status | Block CM |
| **HighLatencyP95** | Latenz > Threshold | Performance | Block CW |
| **DiskUsageWarning** | Storage > 80% | Cleanup | - |

---

## 3. Incident Response Workflow

### 3.1 Erste Reaktion (0-5 Minuten)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALERT EMPFANGEN                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Alert acknowledge in PagerDuty                               │
│ 2. Severity bestimmen (SEV-1/2/3)                               │
│ 3. Incident Channel joinen (#incidents)                         │
│ 4. Status-Update posten: "Investigating [Alert Name]"           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Relevantes Runbook öffnen                                    │
│ 6. Erste Diagnose-Commands ausführen                            │
│ 7. Betroffene Services identifizieren                           │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Untersuchung (5-30 Minuten)

**Standard-Diagnose-Commands**:

```bash
# Kubernetes Status
kubectl get pods -n production
kubectl get events -n production --sort-by='.lastTimestamp'
kubectl top pods -n production

# Logs
kubectl logs -n production -l app=<service> --tail=100
kubectl logs -n production -l app=<service> --previous

# Admission Status
kubectl logs -n kyverno deployment/kyverno --tail=100
kubectl get clusterpolicies

# Signature Verify
cosign verify --keyless ghcr.io/company/app@sha256:xxx

# Trivy Scan
trivy image --severity HIGH,CRITICAL ghcr.io/company/app@sha256:xxx

# Rekor Status
curl -s https://rekor.sigstore.dev/api/v1/log | jq .
```

### 3.3 Mitigation

**Entscheidungsbaum**:

```
┌─────────────────────────────────────┐
│ Ist der Service komplett down?      │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        YES           NO
        │             │
        ▼             ▼
┌───────────────┐ ┌───────────────┐
│ Rollback      │ │ Investigate   │
│ (sofort)      │ │ & Mitigate    │
└───────────────┘ └───────────────┘
        │             │
        └──────┬──────┘
               ▼
┌─────────────────────────────────────┐
│ Mitigation dokumentieren            │
│ Stakeholder informieren             │
└─────────────────────────────────────┘
```

---

## 4. SEV-Level & Escalation

### 4.1 SEV-Level Definition

| SEV | Definition | Response Time | Beispiel |
|-----|------------|---------------|----------|
| **SEV-1** | Total Outage, alle Deployments blockiert | < 15 min | Admission Controller down |
| **SEV-2** | Partial Outage, einzelne Services betroffen | < 30 min | CVE blockiert ein Image |
| **SEV-3** | Degraded Performance, nicht kritisch | < 2 h | Hohe Latenz |
| **SEV-4** | Minor Issue, keine User-Auswirkung | < 1 Tag | Warning in Logs |

### 4.2 Escalation-Pfad

```
┌─────────────────────────────────────────────────────────────────┐
│ Zeit: 0-15 min (SEV-1) / 0-30 min (SEV-2)                      │
│ On-Call Engineer investigate & mitigate                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Nicht gelöst?
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Zeit: +15 min (SEV-1) / +30 min (SEV-2)                        │
│ Secondary On-Call + Team Lead involvieren                       │
│ War Room aufbauen                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Nicht gelöst?
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Zeit: +30 min (SEV-1) / +1h (SEV-2)                            │
│ Platform Lead + Security Lead involvieren                       │
│ CTO/CISO informieren (bei SEV-1)                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Nicht gelöst?
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Zeit: +1h (SEV-1)                                              │
│ Full Incident Response Team                                     │
│ Externe Unterstützung evaluieren                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Communication Templates

### 5.1 Incident Start

```
🚨 INCIDENT DECLARED: [Alert Name]
Severity: SEV-[1/2/3]
Time: [Timestamp]
Impact: [Description]
On-Call: [Name]
Channel: #incidents-[id]
Status: Investigating
```

### 5.2 Status Update (alle 30 min)

```
📊 UPDATE: [Alert Name]
Time: [Timestamp]
Status: [Investigating/Mitigating/Monitoring]
Progress:
- [What was done]
- [Current findings]
Next Steps:
- [What's being done]
ETA: [Expected resolution time]
```

### 5.3 Mitigation

```
✅ MITIGATION: [Alert Name]
Time: [Timestamp]
Action: [What was done]
Impact: [User impact resolved?]
Monitoring: [Observation period]
```

### 5.4 Resolution

```
🎉 RESOLVED: [Alert Name]
Time: [Timestamp]
Duration: [Total incident duration]
Root Cause: [Brief description]
Fix: [What was done]
Post-Incident: [Scheduled for]
```

---

## 6. Häufige Probleme & Solutions

### 6.1 Deployment blockiert durch Admission

**Symptome**:
- `kubectl apply` schlägt fehl
- Admission Denial in Logs

**Diagnose**:
```bash
kubectl logs -n kyverno deployment/kyverno --tail=100 | grep -i denied
kubectl describe pod <pod-name>
```

**Lösung**:
1. Policy prüfen: `kubectl get clusterpolicies`
2. Falls falsche Policy: Deaktivieren
3. Falls unsigned Image: Signieren
4. Falls andere Ursache: Runbook (Block CN)

---

### 6.2 Signatur-Verifikation fehlgeschlagen

**Symptome**:
- `cosign verify` failed
- Deployment blockiert

**Diagnose**:
```bash
cosign verify --keyless ghcr.io/company/app@sha256:xxx
cosign triangulate ghcr.io/company/app@sha256:xxx
```

**Lösung**:
1. OIDC Status prüfen
2. Rekor-Eintrag validieren
3. Falls Rekor down: Keyed fallback
4. Image neu signieren

---

### 6.3 CVE blockiert Deployment

**Symptome**:
- Trivy Scan failed
- Pipeline rot

**Diagnose**:
```bash
trivy image --format json ghcr.io/company/app@sha256:xxx > report.json
cat report.json | jq '.Results[0].Vulnerabilities[] | select(.Severity=="CRITICAL")'
```

**Lösung**:
1. CVE recherchieren (NVD)
2. Patch verfügbar? → Image neu bauen
3. Kein Patch? → Exception beantragen
4. Security informieren

---

### 6.4 Canary SLO-Verletzung

**Symptome**:
- Error Rate > 1%
- Latenz > Threshold
- Canary stuck

**Diagnose**:
```bash
kubectl get canary <name> -o yaml
kubectl logs -l app=<service> --tail=100
```

**Lösung**:
1. Sofort Rollback: `kubectl rollout undo`
2. Logs analysieren
3. Root Cause identifizieren
4. Fix implementieren

---

## 7. Post-Incident

### 7.1 Sofort nach Resolution

- [ ] Alert in PagerDuty resolved
- [ ] Final Update in Incident Channel
- [ ] Stakeholder informiert
- [ ] Timeline dokumentiert

### 7.2 Innerhalb von 24 Stunden

- [ ] Post-Incident Review terminieren
- [ ] Initial Notes schreiben
- [ ] Logs/Traces sichern

### 7.3 Post-Incident Review (innerhalb 5 Tage)

- [ ] Blameless Post-Mortem durchführen
- [ ] Timeline rekonstruieren
- [ ] Root Cause Analysis (5 Whys)
- [ ] Action Items definieren
- [ ] Dokumentation: Block CY

---

## 8. On-Call Health

### 8.1 Selbstfürsorge

- [ ] Ausreichend Schlaf
- [ ] Laptop/Phone geladen
- [ ] Runbooks offline verfügbar
- [ ] Pausen einplanen

### 8.2 Work-Life-Balance

- Max 1 Woche On-Call am Stück
- Min 2 Wochen zwischen Schichten
- Compensation Time nach SEV-1

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Debug Checklist | CF |
| Incident Template | CN |
| Key Rotation | CO |
| Rollback Decision | CV |
| SLO/SLI Definitions | CW |
| Post-Incident Review | CY |
| Day-2 Runbook | DY |

---

*Block EA – SRE-Oncall-Handbuch – v1.0*
