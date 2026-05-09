# EC – Go-Live Ready Checklist (10 Punkte)

> **Zweck**: Definitive Checkliste vor Go-Live. Alle 10 Punkte müssen erfüllt sein. Dies ist die letzte Sicherheitsbarriere.

---

## ✅ Go-Live Ready Checklist

**Status**: Diese 10 Punkte müssen **alle** erfüllt sein, bevor die Plattform live gehen darf.

---

### 1. Signatur-Chain stabil

| Check | Status | Nachweis |
|-------|--------|----------|
| cosign sign erfolgreich | ☐ | sign.log |
| cosign verify erfolgreich | ☐ | verify-job.log |
| Rekor-Index dokumentiert | ☐ | rekor-index.txt |
| OIDC stabil | ☐ | OIDC Status |
| Kein Verify-Fehler (48h) | ☐ | Prometheus |

**Validierung**:
```bash
cosign verify --keyless ghcr.io/company/app@sha256:xxx
cosign triangulate ghcr.io/company/app@sha256:xxx
curl https://rekor.sigstore.dev/api/v1/log/entries
```

---

### 2. Security Scans vollständig

| Check | Status | Nachweis |
|-------|--------|----------|
| Trivy CRITICAL = 0 | ☐ | trivy.json |
| Trivy HIGH = 0 | ☐ | trivy.json |
| SBOM erzeugt | ☐ | sbom.json |
| SBOM archiviert | ☐ | audit/01_build/ |
| Keine offenen CVEs ohne Ausnahme | ☐ | EXCEPTIONS.md |

**Validierung**:
```bash
trivy image --severity HIGH,CRITICAL ghcr.io/company/app@sha256:xxx
syft ghcr.io/company/app@sha256:xxx -o spdx-json > sbom.json
```

---

### 3. Admission Enforcement aktiv

| Check | Status | Nachweis |
|-------|--------|----------|
| Unsigned Images → Block | ☐ | admission-policy.yaml |
| Falscher Digest → Block | ☐ | admission-policy.yaml |
| Falsche Registry → Block | ☐ | admission-policy.yaml |
| Policies getestet | ☐ | Test Report |

**Validierung**:
```bash
kubectl get clusterpolicies
kubectl logs -n kyverno deployment/kyverno --tail=100
```

---

### 4. Canary stabil 24–48h

| Check | Status | Nachweis |
|-------|--------|----------|
| Traffic 5–10% | ☐ | canary-manifest.yaml |
| Keine Alerts | ☐ | Alert Dashboard |
| Keine Latenzspitzen | ☐ | Grafana |
| Keine Error-Rate-Anstiege | ☐ | Prometheus |

**Validierung**:
```bash
kubectl get canary -n production
kubectl logs -l app=<service> --since=48h
```

---

### 5. Rollback erfolgreich getestet

| Check | Status | Nachweis |
|-------|--------|----------|
| kubectl rollout undo funktioniert | ☐ | rollback-test.log |
| Alte Version signiert & verfügbar | ☐ | Registry |
| Monitoring erkennt Regressionen | ☐ | Alert Config |

**Validierung**:
```bash
kubectl rollout undo deployment/<name> --dry-run=client
kubectl rollout history deployment/<name>
```

---

### 6. Monitoring & Alerts vollständig

| Check | Status | Nachweis |
|-------|--------|----------|
| Error-Rate Monitoring | ☐ | Prometheus |
| Latenz Monitoring | ☐ | Prometheus |
| Admission-Denials Alert | ☐ | Alert Rules |
| Signatur-Fehler Alert | ☐ | Alert Rules |
| CVE-Alerts | ☐ | Alert Rules |
| Canary-SLOs Alert | ☐ | Alert Rules |

**Validierung**:
```bash
kubectl get prometheusrules -n monitoring
curl http://prometheus:9090/api/v1/rules
```

---

### 7. Audit-Bundle vollständig

| Check | Status | Nachweis |
|-------|--------|----------|
| SBOM enthalten | ☐ | audit/01_build/sbom.json |
| Trivy enthalten | ☐ | audit/01_build/trivy.json |
| Sign-Logs enthalten | ☐ | audit/02_signing/ |
| Rekor-Index enthalten | ☐ | audit/02_signing/ |
| Admission-Logs enthalten | ☐ | audit/03_ci_cd/ |
| Canary-Dashboard | ☐ | audit/04_deployment/ |
| Rollback-Test | ☐ | audit/04_deployment/ |

**Validierung**:
```bash
ls -la audit/
```

---

### 8. Key Rotation vorbereitet

| Check | Status | Nachweis |
|-------|--------|----------|
| Rotation-Runbook final | ☐ | KEY_ROTATION.md |
| Emergency-Rotation definiert | ☐ | KEY_ROTATION.md |
| Kalendertermine gesetzt | ☐ | Calendar |
| Drill durchgeführt | ☐ | Drill Report |

**Validierung**:
```bash
cat audit/05_governance/KEY_ROTATION.md
```

---

### 9. Dokumentation vollständig

| Check | Status | Nachweis |
|-------|--------|----------|
| Release-Notes | ☐ | Block CZ |
| Status-Matrix | ☐ | Block DF |
| Changelog | ☐ | CHANGELOG.md |
| Day-2 Runbook | ☐ | Block DY |
| Onboarding Guide | ☐ | Block DU |

---

### 10. Go/No-Go Meeting abgeschlossen

| Check | Status | Nachweis |
|-------|--------|----------|
| Meeting durchgeführt | ☐ | Meeting Notes |
| Alle Owner zugestimmt | ☐ | Sign-off |
| Risiken akzeptiert | ☐ | Risk Log |
| Management informiert | ☐ | Email |

**Guided Link**: → `developer-portal-CT.md` (Go/No-Go Template)

---

## 📊 Finaler Status

| # | Kriterium | Status |
|---|-----------|--------|
| 1 | Signatur-Chain stabil | ☐ |
| 2 | Security Scans vollständig | ☐ |
| 3 | Admission Enforcement aktiv | ☐ |
| 4 | Canary stabil 24–48h | ☐ |
| 5 | Rollback erfolgreich getestet | ☐ |
| 6 | Monitoring & Alerts vollständig | ☐ |
| 7 | Audit-Bundle vollständig | ☐ |
| 8 | Key Rotation vorbereitet | ☐ |
| 9 | Dokumentation vollständig | ☐ |
| 10 | Go/No-Go Meeting abgeschlossen | ☐ |

**Gesamtstatus**: ___ / 10 erfüllt

---

## ✅ Freigabe

| Rolle | Name | Datum | Unterschrift |
|-------|------|-------|--------------|
| Platform Lead | | | |
| Security Lead | | | |
| SRE Lead | | | |
| Release Manager | | | |

**Go-Live genehmigt**: ☐ Ja ☐ Nein

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Go/No-Go Template | CT |
| Release Steps | CL |
| Canary Manifest | CM |
| Key Rotation | CO |
| Audit-Bundle | DK |
| Day-2 Runbook | DY |

---

*Block EC – Go-Live Ready Checklist – v1.0*
