# DZ – Day-2 Incident Simulation Playbook

> **Zweck**: Strukturierte Übungen für SRE und Platform Teams zur Vorbereitung auf echte Incidents. Enthält Szenarien, Injektions-Methoden und Validierungs-Checklisten.

---

## 📋 Incident Simulation Playbook – Governance Postcheck

### Übersicht

| Parameter | Wert |
|-----------|------|
| Dauer | 2-4 Stunden pro Übung |
| Frequenz | Quartalsweise |
| Teilnehmer | SRE, Platform, Security |
| Umgebung | Staging / Dedicated Chaos Cluster |

---

## 1. Vorbereitung

### 1.1 Voraussetzungen

- [ ] Dedizierte Übungsumgebung (nicht Production!)
- [ ] Teilnehmer informiert (Datum, Zeit, Scope)
- [ ] Observability-Tools aktiv (Grafana, Prometheus, Logs)
- [ ] Runbooks verfügbar
- [ ] Communication-Kanäle getestet

### 1.2 Rollenverteilung

| Rolle | Verantwortung | Person |
|-------|---------------|--------|
| **Game Master** | Szenario starten, beobachten, beenden | |
| **Incident Commander** | Koordination, Kommunikation | |
| **SRE Responder** | Technische Untersuchung, Fix | |
| **Security Responder** | Security-spezifische Aspekte | |
| **Communications** | Stakeholder-Kommunikation | |
| **Observer** | Dokumentation, Lernpunkte | |

---

## 2. Szenario 1: Signatur-Verifikation Failure

### Szenario-Beschreibung

**Trigger**: Image-Signatur kann nicht verifiziert werden, alle Deployments blockiert.

**Schwierigkeit**: Mittel

**Dauer**: 30-45 Minuten

### Injektion

```bash
# Szenario starten (in Staging)
# Option 1: Invalid signature injecten
cosign sign --key <wrong-key> ghcr.io/company/app:test-scenario

# Option 2: OIDC-Endpunkt blockieren (simulieren)
kubectl patch configmap oidc-config --type merge -p '{"data":{"disabled":"true"}}'

# Alert triggern
kubectl run test-pod --image=ghcr.io/company/app:unsigned-test
```

### Erwartete Reaktion

1. **Detection** (< 5 min)
   - Alert in Slack/PagerDuty
   - Deployment-Pipeline rot
   - Admission Denials in Dashboard

2. **Investigation** (< 10 min)
   - cosign verify manuell ausführen
   - OIDC Status prüfen
   - Rekor-Log prüfen
   - Admission Logs analysieren

3. **Mitigation** (< 15 min)
   - Fallback: Keyed Signing
   - OIDC wiederherstellen
   - Image neu signieren
   - Deployment retriggern

4. **Resolution** (< 30 min)
   - Deployment erfolgreich
   - Alerts resolved
   - Post-Incident Notes

### Validierungs-Checkliste

- [ ] Alert innerhalb von 5 Minuten erkannt
- [ ] Richtige Runbooks konsultiert (Block CF, CN)
- [ ] Root Cause innerhalb von 15 Minuten identifiziert
- [ ] Mitigation innerhalb von 20 Minuten durchgeführt
- [ ] Kommunikation an Stakeholder erfolgt
- [ ] Incident dokumentiert

---

## 3. Szenario 2: CVE-Blocker in Produktion

### Szenario-Beschreibung

**Trigger**: Kritische CVE wird veröffentlicht, alle laufenden Images betroffen.

**Schwierigkeit**: Hoch

**Dauer**: 60 Minuten

### Injektion

```bash
# Simulierte CVE-Meldung (nur für Übung)
# 1. Trivy DB mit "neuer" CVE updaten
trivy image --download-db-only

# 2. Neues Image mit bekannter CVE deployen
kubectl set image deployment/test-app app=ghcr.io/company/app:vulnerable-test

# 3. Alert manuell triggern
curl -X POST http://alertmanager:9093/api/v1/alerts -d '[{
  "labels": {"alertname": "CriticalCVEFound", "severity": "critical"},
  "annotations": {"summary": "CRITICAL CVE-2025-XXXX in production image"}
}]'
```

### Erwartete Reaktion

1. **Detection** (< 5 min)
   - CVE Alert empfangen
   - SBOM-Check: Betroffene Images identifizieren

2. **Assessment** (< 15 min)
   - CVE-NVD recherchieren
   - Exploit-Status prüfen
   - Exposure bewerten

3. **Decision** (< 20 min)
   - Patch verfügbar? → Upgrade
   - Kein Patch? → Exception oder Mitigation
   - Emergency Patch Process

4. **Remediation** (< 45 min)
   - Neue Images bauen
   - Signieren, Scannen
   - Rolling Update in Produktion

5. **Validation** (< 60 min)
   - Alle Images gepatcht
   - Trivy Scan grün
   - No new CVEs in Dashboard

### Validierungs-Checkliste

- [ ] SBOM-basierte Image-Suche durchgeführt
- [ ] CVE innerhalb von 10 Minuten bewertet
- [ ] Entscheidung dokumentiert (Patch/Exception)
- [ ] Patching-Prozess initiiert
- [ ] Stakeholder informiert
- [ ] Post-Mortem erstellt

---

## 4. Szenario 3: Admission Controller Failure

### Szenario-Beschreibung

**Trigger**: Kyverno/Gatekeeper blockiert ALLE Deployments inkl. kritischer Services.

**Schwierigkeit**: Kritisch

**Dauer**: 30 Minuten

### Injektion

```bash
# Szenario starten
# 1. Fehlkonfigurierte Policy deployen
kubectl apply -f - <<EOF
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: block-all-test
spec:
  validationFailureAction: enforce
  rules:
  - name: block-all
    match:
      resources:
        kinds:
        - Pod
    validate:
      message: "DRILL: All deployments blocked"
      pattern:
        metadata:
          labels:
            drill-mode: "enabled"
EOF

# 2. Deployment versuchen
kubectl run critical-app --image=nginx
```

### Erwartete Reaktion

1. **Detection** (< 3 min)
   - Deployments schlagen fehl
   - Admission Denials im Log
   - SEV-1 Alert

2. **Emergency Response** (< 10 min)
   - Policy identifizieren
   - Policy deaktivieren oder audit-mode
   - Critical Services deployen

3. **Investigation** (< 20 min)
   - Policy-Fehler analysieren
   - Testing-Gap identifizieren
   - Fix implementieren

4. **Recovery** (< 30 min)
   - Korrigierte Policy im Staging testen
   - Policy mit audit-mode rollout
   - Nach Validation: enforce-mode

### Emergency Commands

```bash
# Policy sofort deaktivieren
kubectl delete clusterpolicy block-all-test

# Oder in audit-mode setzen
kubectl patch clusterpolicy block-all-test --type merge \
  -p '{"spec":{"validationFailureAction":"audit"}}'

# Deployment forcieren (notfall)
kubectl run critical-app --image=nginx --overrides='
{"metadata":{"labels":{"drill-mode":"enabled"}}}'
```

### Validierungs-Checkliste

- [ ] SEV-1 innerhalb von 3 Minuten deklariert
- [ ] Policy innerhalb von 10 Minuten deaktiviert
- [ ] Critical Services wieder verfügbar
- [ ] Root Cause dokumentiert
- [ ] Policy-Testing-Prozess verbessert

---

## 5. Szenario 4: Canary-SLO-Verletzung

### Szenario-Beschreibung

**Trigger**: Canary-Deployment verletzt SLOs, automatischer Rollback erforderlich.

**Schwierigkeit**: Mittel

**Dauer**: 45 Minuten

### Injektion

```bash
# 1. Canary mit hoher Error-Rate simulieren
kubectl patch deployment test-canary --type json -p='[
  {"op": "add", "path": "/spec/template/spec/containers/0/env", 
   "value": [{"name": "SIMULATE_ERRORS", "value": "true"}]}
]'

# 2. Canary starten
kubectl patch canary test-canary --type merge -p '{"spec":{"trafficWeight":10}}'

# 3. Error-Rate injizieren (via Chaos Mesh oder manuell)
kubectl run error-injector --image=busybox -- sh -c "while true; do wget -q -O- http://test-canary/error; done"
```

### Erwartete Reaktion

1. **Detection** (< 5 min)
   - SLO Dashboard rot
   - Error Rate > 1%
   - P95 Latency > Threshold

2. **Automatic Response** (< 10 min)
   - Canary Controller erkennt SLO-Verletzung
   - Automatischer Rollback initiiert
   - Traffic auf stable zurückgeleitet

3. **Manual Investigation** (< 30 min)
   - Logs der fehlerhaften Pods
   - Metrics-Analyse
   - Root Cause identifizieren

4. **Resolution** (< 45 min)
   - Fix implementiert
   - Neue Canary-Phase gestartet
   - SLOs wieder erfüllt

### Validierungs-Checkliste

- [ ] SLO-Verletzung innerhalb von 5 Minuten erkannt
- [ ] Automatischer Rollback funktioniert
- [ ] Stable Version wieder aktiv
- [ ] Root Cause dokumentiert
- [ ] Fix erfolgreich deployt

---

## 6. Szenario 5: Key Rotation Emergency

### Szenario-Beschreibung

**Trigger**: Verdacht auf Key-Kompromittierung, Emergency Rotation erforderlich.

**Schwierigkeit**: Hoch

**Dauer**: 60 Minuten

### Injektion

```bash
# Szenario-Start durch Game Master
# "Key wurde auf public GitHub Repo geleaked"

# 1. Alert senden
curl -X POST http://alertmanager:9093/api/v1/alerts -d '[{
  "labels": {"alertname": "KeyCompromised", "severity": "critical"},
  "annotations": {"summary": "Signing key potentially compromised - emergency rotation required"}
}]'
```

### Erwartete Reaktion

1. **Detection** (< 5 min)
   - Alert empfangen
   - SEV-1 deklariert
   - Security Team involviert

2. **Assessment** (< 15 min)
   - Key-Leak verifizieren
   - betroffene Images identifizieren
   - Exposure bewerten

3. **Emergency Rotation** (< 30 min)
   - Neuen Key generieren
   - Key Rotation Runbook ausführen
   - Neue Signaturen erstellen

4. **Re-signing** (< 45 min)
   - Alle Produktions-Images neu signieren
   - Verify-Tests durchführen
   - Admission Policy updaten

5. **Validation** (< 60 min)
   - Alle Images neu signiert
   - Verifikation erfolgreich
   - Audit-Log dokumentiert

### Key Rotation Commands

```bash
# Emergency Key Rotation
# 1. Neuen Key generieren (falls keyed mode)
cosign generate-key-pair

# 2. Alle Images neu signieren
for image in $(cat production-images.txt); do
  cosign sign --key cosign.key $image
done

# 3. Verify
for image in $(cat production-images.txt); do
  cosign verify --key cosign.pub $image
done

# 4. Alten Key revoke (in KMS)
# Plattform-spezifisch
```

### Validierungs-Checkliste

- [ ] SEV-1 innerhalb von 5 Minuten deklariert
- [ ] Security Team involviert
- [ ] Neuer Key generiert
- [ ] Alle Images neu signiert
- [ ] Admission Policy aktualisiert
- [ ] Audit-Eintrag erstellt

---

## 7. Nachbereitung

### 7.1 Debrief (30 Minuten)

**Fragen**:
1. Was lief gut?
2. Was lief nicht gut?
3. Was haben wir gelernt?
4. Welche Runbooks müssen verbessert werden?
5. Welche Tools fehlen?

### 7.2 Action Items

| # | Item | Owner | Priority | Deadline |
|---|------|-------|----------|----------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

### 7.3 Dokumentation

- [ ] Übungs-Protokoll erstellt
- [ ] Action Items erfasst
- [ ] Runbooks aktualisiert
- [ ] Nächste Übung geplant

---

## 8. Übungs-Kalender

| Quartal | Szenario | Datum | Status |
|---------|----------|-------|--------|
| Q1 | Signatur-Failure | | Geplant |
| Q2 | CVE-Blocker | | Geplant |
| Q3 | Admission Failure | | Geplant |
| Q4 | Key Rotation Emergency | | Geplant |

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Debug Checklist | CF |
| Incident Template | CN |
| Rollback Decision | CV |
| Key Rotation | CO |
| Post-Incident Review | CY |

---

*Block DZ – Day-2 Incident Simulation Playbook – v1.0*
