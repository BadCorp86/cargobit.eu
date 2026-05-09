# Self-Healing PR-Patch — governance-postcheck Starter-Repo

**Ziel:** Apply-able Git Patch für das Starter-Repo governance-postcheck — Python Flask Service mit Prometheus Query, Docker und Kubernetes Deployment.

---

## Patch-Dateien

### README.md

```diff
*** Begin Patch
*** Add File: governance-postcheck/README.md
+# governance-postcheck
+
+Minimaler PostCheck Service für Canary-Rollouts: fragt Prometheus ab und liefert Pass/Fail für Canary PostChecks.
+
+Kurz:
+- Build: docker build -t registry.example.com/governance-postcheck:latest .
+- Run: docker run -e PROM_URL=http://prometheus:9090 -p 8443:8443 registry.example.com/governance-postcheck:latest
+- Endpoint: POST /postcheck JSON { "partner":"p", "endpoint":"e", "region":"r", "required_health":85, "window":300 }
+
+Hinweis: Passe PROM_URL, REQUIRED_HEALTH und POSTCHECK_WINDOW in der Deployment-Manifest an.
+
*** End Patch
```

### Dockerfile

```diff
*** Begin Patch
*** Add File: governance-postcheck/Dockerfile
+FROM python:3.11-slim
+WORKDIR /app
+COPY app/requirements.txt .
+RUN pip install --no-cache-dir -r app/requirements.txt
+COPY app /app
+ENV FLASK_ENV=production
+EXPOSE 8443
+CMD ["python", "main.py"]
+
*** End Patch
```

### requirements.txt

```diff
*** Begin Patch
*** Add File: governance-postcheck/app/requirements.txt
+Flask==2.2.5
+requests==2.31.0
+
*** End Patch
```

### main.py

```diff
*** Begin Patch
*** Add File: governance-postcheck/app/main.py
+from flask import Flask, request, jsonify
+from postcheck import evaluate_health_slice
+
+app = Flask(__name__)
+
+@app.route("/postcheck", methods=["POST"])
+def postcheck():
+    payload = request.get_json() or {}
+    partner = payload.get("partner")
+    endpoint = payload.get("endpoint")
+    region = payload.get("region")
+    required_health = int(payload.get("required_health", 85))
+    window = int(payload.get("window", 300))
+    result = evaluate_health_slice(partner, endpoint, region, required_health, window)
+    status = 200 if result.get("pass") else 412
+    return jsonify(result), status
+
+if __name__ == "__main__":
+    app.run(host="0.0.0.0", port=8443)
+
*** End Patch
```

### postcheck.py

```diff
*** Begin Patch
*** Add File: governance-postcheck/app/postcheck.py
+import os
+import requests
+
+PROM_URL = os.getenv("PROM_URL", "http://prometheus.monitoring.svc:9090")
+
+def query_prometheus(query):
+    resp = requests.get(f"{PROM_URL}/api/v1/query", params={"query": query}, timeout=10)
+    resp.raise_for_status()
+    return resp.json()
+
+def evaluate_health_slice(partner, endpoint, region, required_health, window_seconds):
+    # Labels zusammenbauen
+    label_filters = []
+    if partner:
+        label_filters.append(f'partner="{partner}"')
+    if endpoint:
+        label_filters.append(f'endpoint="{endpoint}"')
+    if region:
+        label_filters.append(f'region="{region}"')
+    labels = "{" + ",".join(label_filters) + "}" if label_filters else ""
+    promql = f'avg_over_time(proxy:health_score{labels}[{window_seconds}s])'
+    try:
+        data = query_prometheus(promql)
+        # Ergebnis parsen
+        if data.get("data", {}).get("result"):
+            value = float(data["data"]["result"][0]["value"][1])
+        else:
+            value = 0.0
+    except Exception as e:
+        return {"pass": False, "reason": f"prometheus_error: {str(e)}", "value": None}
+    passed = value >= required_health
+    return {"pass": passed, "value": value, "required": required_health}
+
*** End Patch
```

### k8s/deployment.yaml

```diff
*** Begin Patch
*** Add File: governance-postcheck/k8s/deployment.yaml
+apiVersion: v1
+kind: Service
+metadata:
+  name: governance-postcheck
+  namespace: governance
+spec:
+  ports:
+  - port: 443
+    targetPort: 8443
+  selector:
+    app: governance-postcheck
+---
+apiVersion: apps/v1
+kind: Deployment
+metadata:
+  name: governance-postcheck
+  namespace: governance
+spec:
+  replicas: 2
+  selector:
+    matchLabels:
+      app: governance-postcheck
+  template:
+    metadata:
+      labels:
+        app: governance-postcheck
+    spec:
+      containers:
+      - name: postcheck
+        image: registry.example.com/governance-postcheck:latest
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

### tests/test_postcheck.py

```diff
*** Begin Patch
*** Add File: governance-postcheck/tests/test_postcheck.py
+import json
+import types
+import pytest
+
+from app.postcheck import evaluate_health_slice
+
+class DummyResp:
+    def __init__(self, value):
+        self._value = value
+    def json(self):
+        return {"data": {"result": [{"value": [0, str(self._value)]}]}}
+    def raise_for_status(self):
+        return
+
+def test_evaluate_health_slice_mock(monkeypatch):
+    def fake_query(q):
+        return {"data": {"result": [{"value": [0, "90"]}]}}
+    monkeypatch.setattr("app.postcheck.query_prometheus", fake_query)
+    res = evaluate_health_slice("p","e","r",85,300)
+    assert res["pass"] is True
+    assert res["value"] == 90.0
+
*** End Patch
```

### .gitignore

```diff
*** Begin Patch
*** Add File: governance-postcheck/.gitignore
+__pycache__/
+*.pyc
+.env
+venv/
+dist/
+build/
+*.egg-info
+
*** End Patch
```

---

## Anwendungsschritte

```bash
# 1) Branch anlegen
git checkout -b ci/governance-postcheck/starter

# 2) Verzeichnisse erstellen
mkdir -p governance-postcheck/app governance-postcheck/k8s governance-postcheck/tests

# 3) Dateien erstellen (siehe oben)

# 4) Dateien hinzufügen und committen
git add governance-postcheck
git commit -m "feat(postcheck): add starter governance-postcheck service (python, docker, k8s)"

# 5) Branch pushen
git push -u origin ci/governance-postcheck/starter
```

---

## Repo-Struktur

```
governance-postcheck/
├── README.md
├── Dockerfile
├── .gitignore
├── app/
│   ├── main.py
│   ├── postcheck.py
│   └── requirements.txt
├── k8s/
│   └── deployment.yaml
└── tests/
    └── test_postcheck.py
```

---

## PR-Metadaten

| Feld | Wert |
|------|------|
| **Branch** | `ci/governance-postcheck/starter` |
| **Commit Message** | `feat(postcheck): add starter governance-postcheck service (python, docker, k8s)` |
| **PR-Titel** | `feat(postcheck): add starter governance-postcheck service` |

---

## PR-Beschreibung

```
## Was
Fügt ein Starter-Repo für den governance-postcheck Service hinzu.

## Features
- Python Flask HTTP Service
- Prometheus Query für Health Score
- Dockerfile für Container Build
- Kubernetes Deployment Manifest
- Unit Tests mit pytest

## Endpoint
POST /postcheck
{
  "partner": "string",
  "endpoint": "string", 
  "region": "string",
  "required_health": 85,
  "window": 300
}

## Build
docker build -t registry.example.com/governance-postcheck:latest .

## Test
pytest governance-postcheck/tests
```

---

## Hinweise zur Nutzung

| Aspekt | Hinweis |
|--------|---------|
| **Image-Tag** | In `k8s/deployment.yaml` an Registry anpassen |
| **PROM_URL** | Auf Prometheus-URL setzen |
| **Tests** | `pytest governance-postcheck/tests` |
| **Sicherheit** | TLS/Authentication für Prod einrichten |
| **Erweiterungen** | Logging, Metrics, Retries, Circuit Breaker |

---

## Dokument-Historie

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 2026-05-05 | Initiale Erstellung |

---

**CargoBit Multi-Agent System** — Developer Portal Documentation
