# Self-Healing PR-Patch — Canary Rollout & governance-postcheck

**Ziel:** Apply-able Git Patch für Canary Rollout und PostCheck Service — bereit zum Anwenden im Repository.

---

## Patch-Datei 1: Canary Rollout

**Dateiname:** `0003-add-canary-rollout-and-postcheck.patch`

```diff
*** Begin Patch
*** Add File: k8s/argo-rollout/proxy-policy-canary.yaml
+apiVersion: argoproj.io/v1alpha1
+kind: Rollout
+metadata:
+  name: proxy-policy-canary
+  namespace: proxy-control
+spec:
+  replicas: 3
+  strategy:
+    canary:
+      steps:
+      - setWeight: 1
+        pause:
+          duration: 300s
+      - setWeight: 10
+        pause:
+          duration: 300s
+      - setWeight: 50
+        pause:
+          duration: 300s
+      - setWeight: 100
+  template:
+    metadata:
+      labels:
+        app: proxy-policy-apply
+    spec:
+      serviceAccountName: governance-operator
+      containers:
+      - name: policy-operator
+        image: ghcr.io/cargobit/policy-operator:stable
+        args:
+        - "--policy=governance/containment/advanced-containment-and-repair.yaml"
+        - "--canary-slice=1"
+        - "--postcheck-endpoint=https://governance-api.governance.svc.cluster.local/postcheck"
+        - "--postcheck-timeout=300"
+        - "--audit-endpoint=https://audit.cargobit.internal/events"
+        env:
+        - name: REGION
+          valueFrom:
+            fieldRef:
+              fieldPath: metadata.labels['region']
+        - name: CORRELATION_ID
+          value: ""
+
*** End Patch
```

## Patch-Datei 2: PostCheck Service

```diff
*** Begin Patch
*** Add File: k8s/argo-rollout/governance-postcheck.yaml
+apiVersion: v1
+kind: Service
+metadata:
+  name: governance-api
+  namespace: governance
+spec:
+  ports:
+  - port: 443
+    targetPort: 8443
+  selector:
+    app: governance-api
+---
+apiVersion: apps/v1
+kind: Deployment
+metadata:
+  name: governance-api
+  namespace: governance
+spec:
+  replicas: 2
+  selector:
+    matchLabels:
+      app: governance-api
+  template:
+    metadata:
+      labels:
+        app: governance-api
+    spec:
+      containers:
+      - name: postcheck
+        image: ghcr.io/cargobit/governance-postcheck:stable
+        ports:
+        - containerPort: 8443
+        env:
+        - name: PROM_URL
+          value: "http://prometheus.monitoring.svc:9090"
+        - name: REQUIRED_HEALTH
+          value: "85"
+        - name: POSTCHECK_WINDOW
+          value: "300"
+
*** End Patch
```

---

## Anwendungsschritte

```bash
# 1) Branch anlegen
git checkout -b ci/argo-rollout/proxy-policy-canary

# 2) Verzeichnis erstellen
mkdir -p k8s/argo-rollout

# 3) Canary Rollout Datei erstellen
cat > k8s/argo-rollout/proxy-policy-canary.yaml <<'EOF'
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: proxy-policy-canary
  namespace: proxy-control
spec:
  replicas: 3
  strategy:
    canary:
      steps:
      - setWeight: 1
        pause:
          duration: 300s
      - setWeight: 10
        pause:
          duration: 300s
      - setWeight: 50
        pause:
          duration: 300s
      - setWeight: 100
  template:
    metadata:
      labels:
        app: proxy-policy-apply
    spec:
      serviceAccountName: governance-operator
      containers:
      - name: policy-operator
        image: ghcr.io/cargobit/policy-operator:stable
        args:
        - "--policy=governance/containment/advanced-containment-and-repair.yaml"
        - "--canary-slice=1"
        - "--postcheck-endpoint=https://governance-api.governance.svc.cluster.local/postcheck"
        - "--postcheck-timeout=300"
        - "--audit-endpoint=https://audit.cargobit.internal/events"
        env:
        - name: REGION
          valueFrom:
            fieldRef:
              fieldPath: metadata.labels['region']
        - name: CORRELATION_ID
          value: ""
EOF

# 4) PostCheck Service Datei erstellen
cat > k8s/argo-rollout/governance-postcheck.yaml <<'EOF'
apiVersion: v1
kind: Service
metadata:
  name: governance-api
  namespace: governance
spec:
  ports:
  - port: 443
    targetPort: 8443
  selector:
    app: governance-api
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: governance-api
  namespace: governance
spec:
  replicas: 2
  selector:
    matchLabels:
      app: governance-api
  template:
    metadata:
      labels:
        app: governance-api
    spec:
      containers:
      - name: postcheck
        image: ghcr.io/cargobit/governance-postcheck:stable
        ports:
        - containerPort: 8443
        env:
        - name: PROM_URL
          value: "http://prometheus.monitoring.svc:9090"
        - name: REQUIRED_HEALTH
          value: "85"
        - name: POSTCHECK_WINDOW
          value: "300"
EOF

# 5) Dateien hinzufügen und committen
git add k8s/argo-rollout/proxy-policy-canary.yaml k8s/argo-rollout/governance-postcheck.yaml
git commit -m "feat(governance): add proxy policy canary rollout and postcheck service"

# 6) Branch pushen
git push -u origin ci/argo-rollout/proxy-policy-canary
```

---

## PR-Metadaten

| Feld | Wert |
|------|------|
| **Branch** | `ci/argo-rollout/proxy-policy-canary` |
| **Commit Message** | `feat(governance): add proxy policy canary rollout and postcheck service` |
| **PR-Titel** | `feat(governance): add proxy policy canary rollout and postcheck service` |

---

## PR-Beschreibung

```
## Was
Fügt Argo Rollout (Canary) für `policy-operator` und den `governance-postcheck` Service/Deployment hinzu.

## Warum
Gestaffelte, sichere Ausführung von Containment/Repair Policies mit automatischem PostCheck und Rollback.

## Voraussetzungen
- `policy-operator` und `governance-postcheck` Images in Registry
- Prometheus Recording Rules (Bundle 1) deployed

## CI
- YAML-Lint
- Argo Rollout validation

## Reviewer
- SRE Lead
- Governance Owner

## Merge-Kriterien
- CI grün
- Reviewer-Freigabe
- Images verfügbar
- Staging Canary Testplan angehängt
```

---

## Reviewer-Checklist

```markdown
- [ ] `policy-operator` und `governance-postcheck` Images vorhanden oder ersetzt
- [ ] Prometheus Recording Rules (Bundle 1) sind in Staging/Prod deployed
- [ ] Staging Canary Testplan angehängt (Testcases, Fuzzer smoke)
- [ ] SRE Lead und Governance Owner haben geprüft
```

---

## Canary Rollout Steps

```
┌─────────────────────────────────────────────────────────────────┐
│                    CANARY ROLLOUT STEPS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: 1% Traffic  (300s pause → PostCheck)                   │
│  Step 2: 10% Traffic (300s pause → PostCheck)                   │
│  Step 3: 50% Traffic (300s pause → PostCheck)                   │
│  Step 4: 100% Traffic                                           │
│                                                                 │
│  PostCheck: H >= 85 → Promotion                                 │
│             H < 85  → Rollback                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## PostCheck Service Environment

| Variable | Wert | Beschreibung |
|----------|------|--------------|
| `PROM_URL` | `http://prometheus.monitoring.svc:9090` | Prometheus Endpoint |
| `REQUIRED_HEALTH` | `85` | Mindest-Health-Score |
| `POSTCHECK_WINDOW` | `300` | Zeitfenster in Sekunden |

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
