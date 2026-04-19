# CargoBit ML Pipeline - Production Readiness

Vollständige ML-Produktionsumgebung für das **CargoBit Suggestion Scoring** Modell.

## 📁 Verzeichnisstruktur

```
ml-pipeline/
├── training/
│   └── train_with_shap.py          # Training mit SHAP-Integration
├── serving/
│   ├── model_loader.py             # S3/DBFS + Registry Loader
│   └── inference_api.py            # FastAPI Inference Service
├── loadtest/
│   └── k6_score_test.js            # k6 Load Test Script
├── kubernetes/
│   └── hpa_config.yaml             # Deployment + HPA + PDB
├── monitoring/
│   └── slo_definitions.yaml        # SLO/SLI + Alerts
├── database/
│   └── model_registry_schema.sql   # PostgreSQL Schema
├── etl/
│   └── kafka_ingestion.py          # Kafka → Warehouse
└── airflow/
    └── dags/
        └── ml_suggestion_scoring_daily.py
```

## 🚀 Komponenten

### 1. Training Pipeline (`train_with_shap.py`)

**Features:**
- LightGBM/XGBoost Training mit Cross-Validation
- SHAP TreeExplainer für Offline-Explainability
- S3/DBFS/Local Model Storage
- MLflow Integration
- PostgreSQL Model Registry

**Verwendung:**
```bash
# Training mit Standard-Config
python train_with_shap.py --data training_data.parquet

# Training mit Custom-Config
python train_with_shap.py \
  --data training_data.parquet \
  --config config.json \
  --promote \
  --db "postgresql://user:pass@host:5432/ml_registry"
```

**Hybrid Scoring:**
```
Score_final = α × score_heuristic + (1-α) × score_ml
```

### 2. Model Loader (`model_loader.py`)

**Features:**
- S3/DBFS/Local Storage Support
- Thread-sicherer Model Cache (TTL, LRU Eviction)
- PostgreSQL Registry Lookup
- Hot-Reloading
- Health Checks

**Verwendung:**
```python
from model_loader import ModelLoader, ModelLoaderConfig

config = ModelLoaderConfig(
    store_type="s3",
    s3_bucket="cargobit-ml-models",
    cache_ttl_seconds=3600
)

loader = ModelLoader(config)
model, explainer = loader.load_model()  # Latest active
model, explainer = loader.load_model("20240115_120000")  # Specific version
```

### 3. Inference API (`inference_api.py`)

**Endpoints:**

| Endpoint | Beschreibung | Latenz-Ziel |
|----------|--------------|-------------|
| `POST /score` | ML Scoring für Suggestions | P95 < 50ms |
| `POST /explain` | SHAP Erklärungen | P95 < 200ms |
| `GET /health` | Health Check | - |
| `GET /ready` | Readiness Probe | - |
| `GET /metrics` | Prometheus Metrics | - |
| `GET /model/info` | Model Informationen | - |
| `POST /model/reload` | Model neu laden | - |

**Beispiel Request:**
```bash
curl -X POST http://localhost:8000/score \
  -H "Content-Type: application/json" \
  -d '{
    "transport_id": "T-12345",
    "suggestions": [{
      "heuristic_score": 85.5,
      "distance_km": 150.2,
      "price_per_km": 1.25,
      ...
    }],
    "return_heuristic": true,
    "alpha": 0.8
  }'
```

### 4. Load Testing (`k6_score_test.js`)

**Szenarien:**
- **Load Test:** 50 → 200 → 400 RPS (12 min)
- **Spike Test:** Plötzlicher Traffic-Peak
- **Soak Test:** 30 min bei 100 RPS

**Thresholds:**
```javascript
thresholds: {
  'ml_score_latency_ms': ['p(95)<50', 'p(99)<100'],
  'ml_explain_latency_ms': ['p(95)<200', 'p(99)<500'],
  'ml_inference_error_rate': ['rate<0.01'],
}
```

**Verwendung:**
```bash
# Standard Load Test
k6 run k6_score_test.js

# Custom Szenario
k6 run --vus 100 --duration 10m k6_score_test.js

# Mit Base URL
BASE_URL=http://ml-inference.prod.cargobit.io k6 run k6_score_test.js
```

## 📊 Sizing Empfehlungen

### Pod Sizing

| Resource | Request | Limit | Begründung |
|----------|---------|-------|------------|
| CPU | 300m | 800m | LightGBM ist CPU-bound, 300m für 50-150 RPS |
| Memory | 512Mi | 1Gi | Modell + SHAP Explainer + Python Runtime |

### HPA Konfiguration

```yaml
minReplicas: 3
maxReplicas: 12
targetCPUUtilization: 60%
targetRPSPerPod: 150
```

### Anti-Affinity

```yaml
# Maximale Resilienz
podAntiAffinity:
  requiredDuringSchedulingIgnoredDuringExecution:
    - topologyKey: kubernetes.io/hostname

# Effizienz
podAntiAffinity:
  preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      topologyKey: kubernetes.io/hostname
```

## 🎯 SLO/SLI Definitionen

### Service Level Indicators

| SLI | Beschreibung | Target |
|-----|--------------|--------|
| `SLI_latency_p95_score` | /score Requests < 50ms | > 95% |
| `SLI_latency_p95_explain` | /explain Requests < 200ms | > 95% |
| `SLI_availability` | Erfolgreiche Requests (2xx) | > 99.9% |
| `SLI_model_load_success` | Erfolgreiche Model Loads | > 99% |
| `SLI_score_drift` | Drift Heuristik vs ML | < 15% |

### Error Budget

| Zeitraum | Budget |
|----------|--------|
| 30 Tage | 43.2 Minuten |
| 7 Tage | 10.1 Minuten |
| 1 Tag | 1.44 Minuten |

### Alerts

**Critical:**
- P95 Latenz > 100ms (5 min)
- Verfügbarkeit < 99% (5 min)
- Model Load Fehler > 1% (5 min)
- Score Drift > 20% (5 min)

**Warning:**
- CPU > 80% (10 min)
- P95 Latenz > 50ms (10 min)
- Score Drift > 15% (30 min)

## 🗄️ Model Registry Schema

### Haupttabellen

```sql
-- Model Registry
ml_model_registry (
    version, model_path, explainer_path, 
    metrics, status, created_at
)

-- Prediction Metrics
ml_prediction_metrics (
    model_version, prediction_count, 
    avg_latency_ms, recorded_at
)

-- Feature Statistics
ml_feature_statistics (
    model_version, feature_name, 
    feature_importance_gain, shap_importance
)
```

### Status Workflow

```
CANDIDATE → ACTIVE → ROLLED_BACK
                   → DEPRECATED
```

## 🔄 Pipeline Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                     AIRFLOW DAG (Daily)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  ingest  │───▶│  build   │───▶│  train   │───▶│ promote  │  │
│  │  events  │    │ features │    │  model   │    │  model   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │              │              │               │          │
│       ▼              ▼              ▼               ▼          │
│   Kafka →      Feature Store   S3/DBFS +      PostgreSQL      │
│   Warehouse     (Feast)        MLflow          Registry        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Deployment

### Kubernetes

```bash
# Namespace erstellen
kubectl create namespace ml-serving

# Secrets anlegen
kubectl create secret generic ml-inference-secrets \
  --from-literal=db_connection_string='postgresql://...'

# Deployment anwenden
kubectl apply -f kubernetes/hpa_config.yaml
```

### Docker Build

```bash
docker build -t cargobit/ml-inference:2.0.0 .
docker push cargobit/ml-inference:2.0.0
```

### Umgebungsvariablen

| Variable | Beschreibung | Default |
|----------|--------------|---------|
| `MODEL_STORE_TYPE` | Storage Backend | `local` |
| `S3_MODEL_BUCKET` | S3 Bucket | `cargobit-ml-models` |
| `S3_MODEL_PREFIX` | S3 Prefix | `suggestion-scoring` |
| `LOCAL_MODEL_PATH` | Lokaler Pfad | `/tmp/ml-models` |
| `MODEL_TYPE` | Modell-Typ | `lightgbm` |
| `CACHE_TTL_SECONDS` | Cache TTL | `3600` |
| `REGISTRY_ENABLED` | Registry nutzen | `false` |
| `REGISTRY_DB_CONNECTION` | DB Connection | - |
| `PORT` | Service Port | `8000` |
| `WORKERS` | Uvicorn Workers | `4` |

## 📈 Monitoring

### Prometheus Metrics

```promql
# Request Rate
sum(rate(ml_inference_requests_total[5m]))

# P95 Latency
histogram_quantile(0.95, 
  sum by (le) (rate(ml_inference_request_latency_seconds_bucket[5m]))
)

# Error Rate
sum(rate(ml_inference_requests_total{status!~"2.."}[5m]))
/
sum(rate(ml_inference_requests_total[5m]))

# Model Predictions
sum by (model_version) (rate(ml_predictions_total[5m]))
```

### Grafana Dashboard

Importiere `ml-inference-slo.json` aus `monitoring/slo_definitions.yaml`.

## 🔧 Troubleshooting

### Model nicht ladbar

```bash
# Health Check
curl http://localhost:8000/health

# Cache invalidieren
curl -X POST http://localhost:8000/model/invalidate-cache

# Model neu laden
curl -X POST http://localhost:8000/model/reload?version=20240115_120000
```

### Hohe Latenz

1. Prüfe CPU/Memory Nutzung
2. Prüfe Model-Cache (sollte > 0 Entries haben)
3. Prüfe SHAP-Requests (sind teurer)

### Score Drift

```sql
-- Drift analysieren
SELECT * FROM ml_drift_metrics 
WHERE model_version = (SELECT get_active_model_version())
ORDER BY metric_date DESC LIMIT 7;
```

## 📚 Weiterführende Dokumentation

- [Feature Dictionary](./docs/feature_dictionary.md)
- [Training Pipeline](./docs/training_pipeline.md)
- [API Specification](./docs/api_spec.md)
- [Runbooks](./docs/runbooks/)
