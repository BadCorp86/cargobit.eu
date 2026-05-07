# Chaos-Engineering Plan – Governance Postcheck

Game-Day und Chaos-Testing Strategie für das CargoBit Multi-Agent System.

---

## Grundlagen

### Was ist Chaos Engineering?

Chaos Engineering ist die Disziplin, Experimente auf einem System durchzuführen, um das Vertrauen in die Fähigkeit des Systems zu stärken, turbulente Bedingungen in der Produktion zu widerstehen.

### Ziele

| Ziel | Beschreibung |
|------|--------------|
| **Resilienz validieren** | System verträgt Ausfälle |
| **Blind Spots entdecken** | Unbekannte Schwachstellen |
| **Runbooks testen** | Incident-Response validieren |
| **Team-Training** | On-Call-Team üben |
| **Kultur fördern** | Blameless Learning |

### Prinzipien

1. **Voraussetzungen definieren** – "Steady State" messbar machen
2. **Hypothesen aufstellen** – Was erwarten wir?
3. **Experimente planen** – Was können wir testen?
4. **Blast Radius begrenzen** – Minimale User-Impacts
5. **Ergebnisse analysieren** – Was haben wir gelernt?

---

## Chaos-Tools

### Tool-Auswahl

| Tool | Use Case | Integration |
|------|----------|-------------|
| **Chaos Mesh** | Kubernetes Chaos | K8s Native |
| **Litmus** | Cloud Native Chaos | K8s + Argo |
| **Gremlin** | SaaS Platform | Multi-Cloud |
| **Chaos Toolkit** | Code-based | CI/CD |

### Empfehlung: Chaos Mesh

```yaml
# Installation
kubectl apply -f https://mirrors.chaos-mesh.org/v2.6.0/chaos-mesh.yaml

# Dashboard
kubectl port-forward -n chaos-mesh svc/chaos-dashboard 2333:2333
```

---

## Experiment-Katalog

### Network Chaos

#### Latency Injection

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: api-latency
  namespace: cargobit
spec:
  action: delay
  mode: one
  selector:
    namespaces:
      - cargobit
    labelSelectors:
      app: api-gateway
  delay:
    latency: "100ms"
    correlation: "50"
    jitter: "10ms"
  duration: "5m"
```

#### Packet Loss

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: api-packet-loss
  namespace: cargobit
spec:
  action: loss
  mode: one
  selector:
    namespaces:
      - cargobit
    labelSelectors:
      app: api-gateway
  loss:
    loss: "10"
    correlation: "50"
  duration: "5m"
```

### Pod Chaos

#### Pod Kill

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: orchestrator-kill
  namespace: cargobit
spec:
  action: pod-kill
  mode: one
  selector:
    namespaces:
      - cargobit
    labelSelectors:
      app: agent-orchestrator
  duration: "30s"
```

#### Pod Failure

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: state-store-failure
  namespace: cargobit
spec:
  action: pod-failure
  mode: one
  selector:
    namespaces:
      - cargobit
    labelSelectors:
      app: state-store
  duration: "2m"
```

### Stress Chaos

#### CPU Stress

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: api-cpu-stress
  namespace: cargobit
spec:
  mode: one
  selector:
    namespaces:
      - cargobit
    labelSelectors:
      app: api-gateway
  stressors:
    cpu:
      workers: 4
      load: 80
  duration: "3m"
```

#### Memory Stress

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: orchestrator-memory-stress
  namespace: cargobit
spec:
  mode: one
  selector:
    namespaces:
      - cargobit
    labelSelectors:
      app: agent-orchestrator
  stressors:
    memory:
      size: "512MB"
  duration: "3m"
```

### IO Chaos

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: IOChaos
metadata:
  name: state-store-io-delay
  namespace: cargobit
spec:
  action: latency
  mode: one
  selector:
    namespaces:
      - cargobit
    labelSelectors:
      app: state-store
  delay: "100ms"
  percent: 50
  duration: "5m"
```

---

## Game-Day Planung

### Vorbereitung

| Schritt | Verantwortlich | Deadline |
|---------|----------------|----------|
| Scope definieren | SRE Lead | -2 Wochen |
| Experimente auswählen | Team | -1 Woche |
| Blast Radius festlegen | SRE | -1 Woche |
| Rollback-Plan erstellen | On-Call | -3 Tage |
| Stakeholder informieren | Release Manager | -2 Tage |
| Monitoring vorbereiten | SRE | -1 Tag |

### Game-Day Template

```markdown
# Game-Day: YYYY-MM-DD

## Teilnehmende

| Name | Rolle |
|------|-------|
| <!-- Name --> | Game Master |
| <!-- Name --> | Chaos Operator |
| <!-- Name --> | Observer |
| <!-- Name --> | On-Call |

## Agenda

| Zeit | Aktivität |
|------|-----------|
| 09:00 | Kick-off & Safety Check |
| 09:15 | Baseline Measurement |
| 09:30 | Experiment 1: Network Latency |
| 10:00 | Experiment 2: Pod Kill |
| 10:30 | Experiment 3: CPU Stress |
| 11:00 | Recovery Validation |
| 11:30 | Debrief & Learnings |
| 12:00 | End |
```

---

## Hypothesen-Template

### Vor jedem Experiment

```markdown
## Experiment: <!-- Name -->

### Hypothese
Wenn wir <!-- Chaos Action --> auslösen,
dann erwarten wir <!-- Expected Behavior -->,
weil <!-- Reason -->.

### Steady State Metriken
| Metrik | Normal | Acceptable Deviation |
|--------|--------|---------------------|
| Availability | > 99.9% | < 1% drop |
| P99 Latency | < 500ms | < 200ms increase |
| Error Rate | < 0.1% | < 1% increase |

### Blast Radius
- Affected Pods: <!-- N -->
- Affected Users: <!-- %> or N -->
- Affected Regions: <!-- Regions -->

### Abort Conditions
- Error Rate > <!-- %> → STOP
- Availability < <!-- %> → STOP
- Customer Complaints > <!-- N --> → STOP

### Rollback Plan
1. Chaos beenden
2. Pods neu starten
3. Traffic umleiten falls nötig
```

---

## Experiment-Ergebnis

### Protokoll-Template

```markdown
## Experiment-Ergebnis: <!-- Name -->

### Metadata
| Feld | Wert |
|------|------|
| Datum | <!-- YYYY-MM-DD HH:MM --> |
| Dauer | <!-- XX min --> |
| Operator | <!-- Name --> |

### Setup
```yaml
<!-- Chaos Manifest -->
```

### Beobachtungen

| Zeit | Event | Beobachtung |
|------|-------|-------------|
| <!-- HH:MM --> | Start | <!-- Observation --> |
| <!-- HH:MM --> | <!-- Event --> | <!-- Observation --> |
| <!-- HH:MM --> | End | <!-- Observation --> |

### Metriken

| Metrik | Baseline | Peak | Erholung |
|--------|----------|------|----------|
| Availability | <!-- %> | <!-- %> | <!-- %> |
| P99 Latency | <!-- ms --> | <!-- ms --> | <!-- ms --> |
| Error Rate | <!-- %> | <!-- %> | <!-- %> |

### Ergebnis
- [ ] Hypothese bestätigt
- [ ] Hypothese widerlegt
- [ ] Teilweise bestätigt

### Learnings
1. <!-- Learning 1 -->
2. <!-- Learning 2 -->

### Action Items
| # | Aktion | Owner | Prio |
|---|--------|-------|------|
| 1 | <!-- Action --> | <!-- Name --> | P1/P2/P3 |

### Screenshots
<!-- Grafana Screenshots, Logs, etc. -->
```

---

## Schedule

### Quartalsplan

| Quartal | Fokus | Experimente |
|---------|-------|-------------|
| Q1 | Network Resilience | Latency, Packet Loss, Partition |
| Q2 | Compute Resilience | Pod Kill, CPU Stress, Memory |
| Q3 | Data Resilience | IO Chaos, DB Failover |
| Q4 | Full System | Multi-Failure Scenarios |

### Beispiel Q1

```markdown
## Q1: Network Resilience

| Woche | Experiment | Ziel |
|-------|------------|------|
| W2 | API Latency 100ms | Latency Tolerance |
| W4 | API Packet Loss 5% | Retry Logic |
| W6 | Orchestrator Partition | Circuit Breaker |
| W8 | Full Network Chaos | Multi-Region |
| W10 | Game-Day | Team Training |
| W12 | Review & Planning | Learnings |
```

---

## Blast Radius Begrenzung

### Strategien

| Strategie | Implementierung |
|-----------|-----------------|
| **Namespace-Isolation** | Nur `cargobit-staging` |
| **Label-Selector** | `environment: canary` |
| **Percentage-Mode** | 10% der Pods |
| **Time-Window** | Max 5 Minuten |
| **Manual-Approval** | Game Master muss approven |

### Safety Guards

```yaml
# Chaos Mesh Safety Configuration
apiVersion: chaos-mesh.org/v1alpha1
kind: Schedule
metadata:
  name: safe-experiment
spec:
  schedule: "@weekly"
  historyLimit: 2
  concurrencyPolicy: Forbid
  type: NetworkChaos
  networkChaos:
    selector:
      namespaces:
        - cargobit-staging  # Nur Staging!
      labelSelectors:
        environment: canary
    mode: one  # Nur ein Pod
    action: delay
    delay:
      latency: "50ms"
    duration: "2m"  # Kurz!
```

---

## Monitoring

### Dashboard

| Panel | Query | Visualisierung |
|-------|-------|----------------|
| Active Experiments | `chaos_mesh_experiments_active` | Stat |
| Affected Pods | `chaos_mesh_affected_pods` | Gauge |
| Recovery Time | `chaos_mesh_recovery_seconds` | Histogram |
| Error Budget Impact | `slo_error_budget_remaining` | Stat |

### Alerts

```yaml
groups:
  - name: chaos-alerts
    rules:
      - alert: ChaosExperimentRunning
        expr: chaos_mesh_experiments_active > 0
        for: 1m
        labels:
          severity: info
        annotations:
          summary: "Chaos experiment running"

      - alert: ChaosExperimentFailed
        expr: chaos_mesh_experiment_status{status="failed"} > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Chaos experiment failed"
```

---

## Reporting

### Quartals-Report

```markdown
# Chaos Engineering Report QX YYYY

## Zusammenfassung

| Metrik | Wert |
|--------|------|
| Experimente durchgeführt | <!-- N --> |
| Hypothesen bestätigt | <!-- N --> |
| Schwachstellen gefunden | <!-- N --> |
| Action Items abgeschlossen | <!-- N --> |
| MTTR verbessert | <!-- %> |

## Key Findings

### Finding 1: <!-- Titel -->
- **Experiment**: <!-- Name -->
- **Impact**: <!-- Beschreibung -->
- **Action**: <!-- Maßnahme -->
- **Status**: ✅ Fixed / 🔄 In Progress

### Finding 2: <!-- Titel -->
...

## Empfehlungen

1. <!-- Empfehlung 1 -->
2. <!-- Empfehlung 2 -->

## Nächstes Quartal

- Fokus: <!-- Thema -->
- Geplante Experimente: <!-- N -->
```

---

## Best Practices

### DO ✅

| Practice | Beschreibung |
|----------|--------------|
| In Staging starten | Nie direkt in Prod |
| Steady State messen | Vorher Metriken erheben |
| Team informieren | On-Call, Stakeholder |
| Post-Mortem | Nach jedem Experiment |
| Dokumentieren | Alle Learnings festhalten |

### DON'T ❌

| Anti-Pattern | Problem |
|--------------|---------|
| Freitag Experiments | Risiko vor Wochenende |
| Ohne Rollback | Kein Exit-Plan |
| Zu großer Blast Radius | Viele User betroffen |
| Ohne Monitoring | Keine Beobachtung |
| Unangekündigt | Überraschte On-Call |

---

*Block DC – Chaos-Engineering Plan*
