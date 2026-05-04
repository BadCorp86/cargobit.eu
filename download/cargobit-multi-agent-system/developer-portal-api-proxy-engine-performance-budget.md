# CargoBit API Proxy Engine — Performance-Budget & Latenzmodell

> **Block BG** | Performance Master Level | Version 1.0.0
>
> **Zweck:** Messbare, vorhersagbare, skalierbare und auditierbare Performance-Definition für die API Proxy Engine.

---

## 📋 Dokumenten-Metadaten

| Attribut | Wert |
|----------|------|
| **Dokument-ID** | CB-DOC-BG-001 |
| **Version** | 1.0.0 |
| **Status** | Final |
| **Klassifikation** | Internal — Technical Specification |
| **Gültig ab** | 2025-01-15 |
| **Review-Zyklus** | Quartalsweise |
| **Owner** | SRE Team + Platform Team |
| **Reviewer** | Lead Architect, Performance Engineer, CTO |

---

## 🎯 Executive Summary

Dieses Dokument definiert das Performance-Budget und Latenzmodell für die CargoBit API Proxy Engine. Es etabliert harte Zahlen, harte Budgets und harte Constraints – kein "schnell genug", kein "sollte passen".

**Kernmetriken:**

| Metrik | Ziel | Hard Limit |
|--------|------|------------|
| Engine Overhead (P95) | 25–35 ms | 35 ms |
| End‑to‑End (P95) | 120–250 ms | 300 ms |
| Throughput (pro vCPU) | 300–500 RPS | 200 RPS min |
| Error Rate | < 0.5% | 1% |

Mit diesen Definitionen ist die API Proxy Engine **vorhersagbar**, **skalierbar**, **auditierbar** und **DX‑optimiert**.

---

## 🧱 1. Performance-Budget (pro Komponente)

### 1.1 Budget-Definition

**Ziel:** Die API Proxy Engine darf maximal 25–35 ms zusätzliche Latenz erzeugen (P95).

Jede Komponente der Engine hat ein definiertes Performance-Budget, das bei jedem Deployment validiert wird.

---

### 1.2 Komponenten-Budget

| Komponente | Ziel (P95) | Hard Limit | Beschreibung |
|-----------|------------|------------|--------------|
| Request Normalizer | 1–2 ms | 5 ms | Reine CPU-Operation, trivial |
| Auth & Context Resolver | 1–2 ms | 5 ms | Kein Netzwerkzugriff, Token-Cache |
| Routing & Endpoint Mapper | <1 ms | 2 ms | Statische Tabelle, O(1) Lookup |
| Policy & Guardrail Engine | 2–3 ms | 5 ms | JSON-Rules Engine, kein I/O |
| Payload Validator | 5–8 ms | 12 ms | Abhängig von Schema-Komplexität |
| Header Sanitizer | <1 ms | 2 ms | Reine CPU-Operation |
| Execution Orchestrator | 0 ms | 0 ms | Nur Orchestration, keine Latenz |
| Timeout & Retry Controller | 0 ms | 0 ms | Nur bei Fehlern aktiv |
| Response Normalizer | 2–3 ms | 5 ms | Redaction + Normalisierung |
| Error Mapper | 1–2 ms | 5 ms | Nur bei Fehlern aktiv |
| Observability Hooks | 3–5 ms | 8 ms | Async, non-blocking |

---

### 1.3 Budget-Verteilung (Visual)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    API PROXY ENGINE LATENCY BUDGET                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Request Normalizer        ████ 2ms                                 │
│  Auth & Context Resolver   ████ 2ms                                 │
│  Routing & Mapper          ██ 1ms                                   │
│  Policy Engine             ██████ 3ms                               │
│  Payload Validator         ████████████████ 8ms                     │
│  Header Sanitizer          ██ 1ms                                   │
│  Response Normalizer       ██████ 3ms                               │
│  Observability Hooks       ██████████ 5ms                           │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  TOTAL (P95 Target):       ████████████████████████████████ 25ms    │
│  HARD LIMIT:               ████████████████████████████████████ 35ms│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 1.4 Gesamtbudget

| Kennzahl | Wert |
|----------|------|
| **Gesamtbudget (P95)** | 20–30 ms |
| **Hard Limit** | 35 ms |
| **P99 Ziel** | < 50 ms |
| **P99.9 Ziel** | < 100 ms |

**Verbleibendes Budget für:**
- Netzwerk-Latenz (Tools Service ↔ Core API): 10–20 ms
- Core-API-Verarbeitung: Variabel (siehe End‑to‑End Modell)
- CDN/Edge-Latenz: 5–10 ms

---

## 🧱 2. End‑to‑End Latenzmodell

### 2.1 Request-Journey

Ein typischer API-Explorer-Call durchläuft folgende Stationen:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     END-TO-END REQUEST JOURNEY                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Portal Frontend                                                  │
│     └── Browser → CDN → Portal Backend                              │
│         Latency: 5–10 ms                                            │
│                                                                     │
│  2. Portal Backend → Tools Service                                   │
│     └── Internal Network (K8s Pod → Pod)                            │
│         Latency: 2–5 ms                                             │
│                                                                     │
│  3. Tools Service (API Proxy Engine)                                 │
│     └── See Component Budget                                        │
│         Latency: 20–30 ms                                           │
│                                                                     │
│  4. Tools Service → CargoBit Core API                                │
│     └── Internal Network (Service → Service)                        │
│         Latency: 5–10 ms                                            │
│                                                                     │
│  5. Core API Processing                                               │
│     └── Business Logic + Database                                   │
│         Latency: 50–150 ms                                          │
│                                                                     │
│  6. Response Journey (Return Path)                                   │
│     └── Same path backwards                                         │
│         Latency: 5–10 ms                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Latenz-Aufschlüsselung

| Phase | Min | P50 | P95 | Max |
|-------|-----|-----|-----|-----|
| 1. Portal → Tools Service | 3 ms | 5 ms | 10 ms | 20 ms |
| 2. Proxy Engine Overhead | 15 ms | 20 ms | 30 ms | 35 ms |
| 3. Tools → Core API | 3 ms | 5 ms | 10 ms | 20 ms |
| 4. Core API Processing | 30 ms | 80 ms | 150 ms | 500 ms |
| 5. Rückweg | 3 ms | 5 ms | 10 ms | 20 ms |
| **Gesamt** | **54 ms** | **115 ms** | **210 ms** | **595 ms** |

---

### 2.3 End‑to‑End SLOs

| Perzentil | Ziel | Hard Limit | Beschreibung |
|-----------|------|------------|--------------|
| P50 | 100–150 ms | 200 ms | Typische Erfahrung |
| P90 | 150–200 ms | 250 ms | Gute Erfahrung |
| P95 | 180–250 ms | 300 ms | Akzeptable Erfahrung |
| P99 | 250–350 ms | 500 ms | Langsame Erfahrung |
| P99.9 | 400–600 ms | 1000 ms | Seltene Ausreißer |

**Bewertung:** Diese Werte sind exzellent für Developer-Tools und Partner-Integrations.

---

## 🧱 3. Throughput-Modell

### 3.1 Charakteristik

Die API Proxy Engine ist **CPU-bound**, nicht I/O-bound.

| Charakteristik | Wert |
|---------------|------|
| Primärer Engpass | CPU |
| I/O-Abhängigkeit | Minimal (async) |
| Memory-Abhängigkeit | Gering |
| Network-Abhängigkeit | Nur Upstream-Calls |

---

### 3.2 Throughput pro vCPU

| Szenario | P50 | P95 | P99 |
|----------|-----|-----|-----|
| Einfache Requests | 500 RPS | 350 RPS | 200 RPS |
| Mittlere Komplexität | 400 RPS | 280 RPS | 180 RPS |
| Komplexe Schemas | 300 RPS | 200 RPS | 150 RPS |

---

### 3.3 Cluster-Beispiele

```yaml
# throughput-examples.yaml
clusterConfigurations:
  - name: small
    vCPUs: 4
    memory: 8GB
    expectedThroughput:
      p50: 1500 RPS
      p95: 1000 RPS
      
  - name: medium
    vCPUs: 8
    memory: 16GB
    expectedThroughput:
      p50: 3000 RPS
      p95: 2000 RPS
      
  - name: large
    vCPUs: 16
    memory: 32GB
    expectedThroughput:
      p50: 6000 RPS
      p95: 4000 RPS
      
  - name: xlarge
    vCPUs: 32
    memory: 64GB
    expectedThroughput:
      p50: 12000 RPS
      p95: 8000 RPS
```

---

### 3.4 Burst-Handling

| Mechanismus | Beschreibung | Threshold |
|-------------|--------------|-----------|
| Rate Limiting | Schützt Core-APIs | Partner-spezifisch |
| Circuit Breaker | Schützt Tools Service | 5 Fehler in 60s |
| Adaptive Throttling | Reduziert Durchsatz bei Überlast | CPU > 80% |
| Request Queueing | Nicht notwendig | Keine langen Tasks |

---

## 🧱 4. Skalierungsmodell

### 4.1 Horizontal Scaling

Die API Proxy Engine ist stateless und horizontal skalierbar.

| Eigenschaft | Wert |
|-------------|------|
| Statefulness | Stateless |
| Session-Abhängigkeit | Keine |
| Lokale Caches | Keine (nur verteilte Caches) |
| Sticky Sessions | Nicht erforderlich |
| Skalierbarkeit | Beliebig horizontal |

**Skalierungs-Algorithmus:**

```yaml
# scaling-policy.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-proxy-engine-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-proxy-engine
    
  minReplicas: 3
  maxReplicas: 50
  
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
          
    - type: Pods
      pods:
        metric:
          name: latency_p95_ms
        target:
          type: AverageValue
          averageValue: "35"
          
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
          
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 120
```

---

### 4.2 Vertical Scaling

| Empfehlung | Begründung |
|------------|------------|
| Nicht empfohlen | CPU-bound Workload |
| Besser: Mehr Instanzen | Horizontale Skalierung effizienter |
| Max vCPU pro Instanz | 4 vCPUs |
| Memory pro vCPU | 2 GB |

---

### 4.3 Auto-Scaling Trigger

| Trigger | Threshold | Aktion |
|---------|-----------|--------|
| CPU-Auslastung | > 60% (5 min) | Scale Up |
| P95 Latenz | > 35 ms (3 min) | Scale Up |
| Error Rate | > 1% (2 min) | Alert + Scale Up |
| Memory | > 80% (5 min) | Scale Up |
| Request Queue | > 100 (1 min) | Scale Up |

---

### 4.4 Multi-Region Architecture

```yaml
# multi-region-scaling.yaml
regions:
  - name: eu-west-1
    environments:
      - sandbox
      - production
    scaling:
      minReplicas: 3
      maxReplicas: 25
    isolation:
      network: dedicated-vpc
      database: dedicated-cluster
      
  - name: eu-central-1
    environments:
      - production
    scaling:
      minReplicas: 5
      maxReplicas: 30
    isolation:
      network: dedicated-vpc
      database: dedicated-cluster
      
crossRegionPolicy:
  dataTransfer: DENY
  failoverMode: MANUAL
  sharedState: NONE
```

---

## 🧱 5. Performance-Governance-Modell

### 5.1 Performance Gates (CI/CD)

Jedes Deployment durchläuft automatische Performance-Gates:

```yaml
# performance-gates.yaml
apiVersion: cargobit.io/v1
kind: PerformanceGates
metadata:
  name: api-proxy-performance-gates
spec:
  gates:
    - name: schema-validation-benchmark
      command: "npm run benchmark:validation"
      maxDuration: 10ms
      failureAction: BLOCK
      
    - name: redaction-benchmark
      command: "npm run benchmark:redaction"
      maxDuration: 5ms
      failureAction: BLOCK
      
    - name: error-mapping-benchmark
      command: "npm run benchmark:error-mapping"
      maxDuration: 5ms
      failureAction: BLOCK
      
    - name: observability-hooks-benchmark
      command: "npm run benchmark:observability"
      maxDuration: 8ms
      failureAction: WARN
      
    - name: end-to-end-benchmark
      command: "npm run benchmark:e2e"
      maxDuration: 35ms
      failureAction: BLOCK
```

---

### 5.2 Performance Regression Tests

```yaml
# regression-tests.yaml
apiVersion: cargobit.io/v1
kind: PerformanceRegressionTests
metadata:
  name: api-proxy-regression-tests
spec:
  tests:
    - name: baseline-comparison
      description: "Compare against baseline performance"
      baselineBranch: main
      regressionThreshold: 10%
      failureAction: BLOCK
      
    - name: component-benchmarks
      description: "Test each component individually"
      components:
        - request-normalizer
        - auth-context-resolver
        - routing-mapper
        - policy-engine
        - payload-validator
        - header-sanitizer
        - response-normalizer
      failureAction: BLOCK
      
    - name: load-test
      description: "Sustained load test"
      duration: 10m
      targetRPS: 1000
      maxP95Latency: 35ms
      maxErrorRate: 0.5%
      failureAction: BLOCK
      
    - name: stress-test
      description: "Stress test beyond normal capacity"
      duration: 5m
      targetRPS: 2000
      maxP95Latency: 50ms
      maxErrorRate: 1%
      failureAction: WARN
```

---

### 5.3 Performance SLOs

| SLO | Ziel | Hard Limit | Messung |
|-----|------|------------|---------|
| P95 Latenz | < 35 ms | 40 ms | Rolling 5 min |
| P99 Latenz | < 50 ms | 60 ms | Rolling 5 min |
| Error Rate | < 0.5% | 1% | Rolling 5 min |
| Retry Rate | < 2% | 5% | Rolling 5 min |
| Availability | > 99.9% | 99.5% | Rolling 30 days |
| Throughput | > 300 RPS/vCPU | 200 RPS/vCPU | Rolling 5 min |

---

### 5.4 Performance Dashboards

**Dashboard-Komponenten:**

| Dashboard | Beschreibung | Audience |
|-----------|--------------|----------|
| Latenz pro Komponente | Detaillierte Komponenten-Metriken | SRE, Platform |
| Latenz pro Endpoint | Endpoint-spezifische Latenz | SRE, Product |
| Latenz pro Partner | Partner-spezifische Performance | Partner Support |
| Latenz pro Region | Regionale Performance | SRE, Platform |
| Throughput-Trends | RPS über Zeit | SRE, Platform |
| Error Rate Trends | Fehlerquoten über Zeit | SRE, Platform |
| SLO Compliance | SLO-Erfüllung | Management, SRE |

**Dashboard-SQL (Beispiel):**

```sql
-- Latenz pro Komponente (P95)
SELECT 
  component_name,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_latency,
  COUNT(*) as request_count
FROM performance_metrics
WHERE timestamp > NOW() - INTERVAL '5 minutes'
GROUP BY component_name
ORDER BY p95_latency DESC;

-- Latenz pro Endpoint (P95)
SELECT 
  endpoint,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_duration_ms) as p95_latency,
  COUNT(*) as request_count
FROM request_logs
WHERE timestamp > NOW() - INTERVAL '5 minutes'
GROUP BY endpoint
ORDER BY p95_latency DESC;

-- Latenz pro Partner (P95)
SELECT 
  partner_id,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_duration_ms) as p95_latency,
  COUNT(*) as request_count
FROM request_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY partner_id
ORDER BY p95_latency DESC
LIMIT 20;
```

---

## 🧱 6. Performance-Risiken & Mitigation

### 6.1 Risikomatrix

| Risiko | Wahrscheinlichkeit | Impact | Score | Priorität |
|--------|-------------------|--------|-------|-----------|
| Komplexe Schemas → langsame Validation | Hoch | Hoch | 9 | KRITISCH |
| Redaction-Regeln zu komplex | Mittel | Mittel | 4 | HOCH |
| Observability Hooks blockieren | Niedrig | Hoch | 3 | MITTEL |
| Core-API Latenz steigt | Mittel | Hoch | 6 | HOCH |
| Memory Leaks | Niedrig | Hoch | 3 | MITTEL |
| CPU-Contention | Mittel | Mittel | 4 | HOCH |

---

### 6.2 Mitigation-Strategien

#### 6.2.1 Komplexe Schemas → langsame Validation

**Problem:** JSON-Schema-Validierung kann bei komplexen Schemas langsam werden.

**Mitigation:**

```typescript
// Pre-compiled Schemas
import Ajv from 'ajv';

const ajv = new Ajv({
  allErrors: true,
  strict: true
});

// Compile schemas at startup, not runtime
const compiledSchemas = new Map<string, ValidateFunction>();

function initializeSchemas(schemas: SchemaDefinition[]) {
  for (const schema of schemas) {
    const validate = ajv.compile(schema.definition);
    compiledSchemas.set(schema.id, validate);
  }
}

// Fast validation at runtime
function validatePayload(schemaId: string, payload: unknown): boolean {
  const validate = compiledSchemas.get(schemaId);
  if (!validate) throw new Error(`Schema not found: ${schemaId}`);
  return validate(payload);
}
```

**Alternative: WASM-Validator (für sehr komplexe Schemas)**

```typescript
// WASM-based validator for extreme performance
import { validateSchema } from './wasm-validator';

async function validateWithWasm(schema: object, payload: unknown): Promise<boolean> {
  // Up to 10x faster for complex schemas
  return validateSchema(schema, payload);
}
```

---

#### 6.2.2 Redaction-Regeln zu komplex

**Problem:** Regex-basierte Redaction kann langsam sein.

**Mitigation:**

```typescript
// Pre-compiled Redaction Rules
interface RedactionRule {
  path: string;
  pattern?: RegExp;
  replacement: string;
}

// Compile patterns at startup
function compileRedactionRules(rules: RedactionRuleConfig[]): RedactionRule[] {
  return rules.map(rule => ({
    path: rule.path,
    pattern: rule.pattern ? new RegExp(rule.pattern, 'g') : undefined,
    replacement: rule.replacement
  }));
}

// Avoid complex regex, use simple path matching
function applyRedaction(data: object, rules: RedactionRule[]): object {
  const result = { ...data };
  
  for (const rule of rules) {
    const value = getValueByPath(result, rule.path);
    if (value && rule.pattern) {
      setValueByPath(result, rule.path, value.replace(rule.pattern, rule.replacement));
    }
  }
  
  return result;
}
```

---

#### 6.2.3 Observability Hooks blockieren

**Problem:** Logging und Metrics können bei hoher Last blockieren.

**Mitigation:**

```typescript
// Async, Non-blocking Observability
import { queue } from 'async';

// Create a dedicated queue for observability
const observabilityQueue = queue(async (task: ObservabilityTask) => {
  switch (task.type) {
    case 'log':
      await writeLog(task.data);
      break;
    case 'metric':
      await recordMetric(task.data);
      break;
    case 'trace':
      await recordSpan(task.data);
      break;
  }
}, 10); // Concurrency: 10

// Non-blocking observability hook
function observe(event: ObservabilityEvent): void {
  // Don't await - fire and forget
  observabilityQueue.push({
    type: event.type,
    data: event.data
  });
}

// Sampling at high load
function shouldSample(rate: number): boolean {
  if (getCurrentLoad() > 0.8) {
    return Math.random() < rate * 0.5; // Reduce sampling at high load
  }
  return Math.random() < rate;
}
```

---

#### 6.2.4 Core-API Latenz steigt

**Problem:** Upstream-Latenz kann die Proxy-Engine-Performance beeinflussen.

**Mitigation:**

```yaml
# adaptive-timeout.yaml
apiVersion: cargobit.io/v1
kind: AdaptiveTimeoutConfig
metadata:
  name: api-proxy-adaptive-timeout
spec:
  measurementWindow: 60s
  
  endpoints:
    - path: /v1/payments
      baseTimeout: 15s
      adaptiveRange:
        min: 5s
        max: 30s
      scalingFactor: 1.5  # Timeout = avg * 1.5
        
  circuitBreaker:
    failureThreshold: 5
    failureWindow: 60s
    openDuration: 30s
    
  retryBudget:
    maxRetriesPerSecond: 100
    budgetInterval: 60s
    retryableStatusCodes: [429, 500, 502, 503, 504]
```

---

## 🧱 7. Benchmark-Suite

### 7.1 Benchmark-Konfiguration

```yaml
# benchmark-suite.yaml
apiVersion: cargobit.io/v1
kind: BenchmarkSuite
metadata:
  name: api-proxy-benchmarks
spec:
  scenarios:
    - name: simple-request
      description: "Minimal request with no payload"
      endpoint: /v1/partners/{id}
      method: GET
      expectedMaxP95: 20ms
      
    - name: medium-request
      description: "Request with JSON payload"
      endpoint: /v1/payments
      method: POST
      payload: "fixtures/medium-payload.json"
      expectedMaxP95: 30ms
      
    - name: complex-request
      description: "Request with complex schema validation"
      endpoint: /v1/batch
      method: POST
      payload: "fixtures/complex-payload.json"
      expectedMaxP95: 35ms
      
    - name: error-path
      description: "Error handling path"
      endpoint: /v1/payments
      method: POST
      payload: "fixtures/invalid-payload.json"
      expectedStatus: 400
      expectedMaxP95: 25ms
      
  loadProfiles:
    - name: baseline
      description: "Single request benchmark"
      concurrentUsers: 1
      duration: 10s
      
    - name: normal-load
      description: "Normal operational load"
      concurrentUsers: 10
      duration: 60s
      
    - name: peak-load
      description: "Peak traffic simulation"
      concurrentUsers: 100
      duration: 120s
      
    - name: stress-test
      description: "Beyond capacity"
      concurrentUsers: 500
      duration: 60s
```

---

### 7.2 Benchmark-Scripts

```bash
#!/bin/bash
# run-benchmarks.sh

# Component Benchmarks
echo "Running component benchmarks..."

# Request Normalizer
echo "Benchmarking Request Normalizer..."
node benchmarks/request-normalizer.bench.js

# Auth & Context Resolver
echo "Benchmarking Auth & Context Resolver..."
node benchmarks/auth-context-resolver.bench.js

# Routing & Endpoint Mapper
echo "Benchmarking Routing & Mapper..."
node benchmarks/routing-mapper.bench.js

# Policy Engine
echo "Benchmarking Policy Engine..."
node benchmarks/policy-engine.bench.js

# Payload Validator
echo "Benchmarking Payload Validator..."
node benchmarks/payload-validator.bench.js

# Header Sanitizer
echo "Benchmarking Header Sanitizer..."
node benchmarks/header-sanitizer.bench.js

# Response Normalizer
echo "Benchmarking Response Normalizer..."
node benchmarks/response-normalizer.bench.js

# Full Engine
echo "Benchmarking Full Engine (E2E)..."
node benchmarks/e2e-engine.bench.js

# Generate Report
echo "Generating benchmark report..."
node benchmarks/generate-report.js
```

---

## 🧱 8. Alerting & Monitoring

### 8.1 Alert-Definitionen

```yaml
# alerts.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: api-proxy-performance-alerts
spec:
  groups:
    - name: latency-alerts
      rules:
        - alert: HighP95Latency
          expr: |
            histogram_quantile(0.95, 
              sum(rate(request_duration_seconds_bucket[5m])) by (le)
            ) > 0.035
          for: 3m
          labels:
            severity: warning
          annotations:
            summary: "P95 latency exceeds 35ms"
            description: "P95 latency is {{ $value }}ms"
            
        - alert: CriticalP95Latency
          expr: |
            histogram_quantile(0.95, 
              sum(rate(request_duration_seconds_bucket[5m])) by (le)
            ) > 0.050
          for: 2m
          labels:
            severity: critical
          annotations:
            summary: "P95 latency exceeds 50ms"
            
        - alert: HighP99Latency
          expr: |
            histogram_quantile(0.99, 
              sum(rate(request_duration_seconds_bucket[5m])) by (le)
            ) > 0.060
          for: 3m
          labels:
            severity: warning
          annotations:
            summary: "P99 latency exceeds 60ms"
            
    - name: throughput-alerts
      rules:
        - alert: LowThroughput
          expr: |
            sum(rate(requests_total[5m])) < 100
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Throughput below 100 RPS"
            
    - name: error-alerts
      rules:
        - alert: HighErrorRate
          expr: |
            sum(rate(requests_total{status=~"5.."}[5m])) / 
            sum(rate(requests_total[5m])) > 0.01
          for: 2m
          labels:
            severity: critical
          annotations:
            summary: "Error rate exceeds 1%"
            
        - alert: ElevatedErrorRate
          expr: |
            sum(rate(requests_total{status=~"5.."}[5m])) / 
            sum(rate(requests_total[5m])) > 0.005
          for: 3m
          labels:
            severity: warning
          annotations:
            summary: "Error rate exceeds 0.5%"
```

---

### 8.2 SLO-Tracking

```yaml
# slo-tracking.yaml
apiVersion: cargobit.io/v1
kind: SLOTracker
metadata:
  name: api-proxy-slo-tracker
spec:
  slos:
    - name: latency-slo
      target: 0.99  # 99% of requests under 35ms
      window: 30d
      metric: |
        sum(rate(request_duration_seconds_bucket{le="0.035"}[30d])) /
        sum(rate(request_duration_seconds_bucket[30d]))
        
    - name: availability-slo
      target: 0.999  # 99.9% availability
      window: 30d
      metric: |
        sum(rate(requests_total{status!~"5.."}[30d])) /
        sum(rate(requests_total[30d]))
        
    - name: error-rate-slo
      target: 0.005  # Max 0.5% error rate
      window: 30d
      metric: |
        sum(rate(requests_total{status=~"5.."}[30d])) /
        sum(rate(requests_total[30d]))
        
  errorBudgetPolicy:
    burnRateAlerts:
      - threshold: 0.01
        severity: warning
        message: "Consuming error budget at normal rate"
        
      - threshold: 0.02
        severity: warning
        message: "Consuming error budget at 2x rate"
        
      - threshold: 0.10
        severity: critical
        message: "Consuming error budget at 10x rate"
```

---

## 📊 Zusammenfassung

### Kernmetriken

| Metrik | Ziel | Hard Limit |
|--------|------|------------|
| Engine Overhead (P95) | 25–35 ms | 35 ms |
| End‑to‑End (P95) | 120–250 ms | 300 ms |
| Throughput (pro vCPU) | 300–500 RPS | 200 RPS min |
| Error Rate | < 0.5% | 1% |
| Availability | > 99.9% | 99.5% |

### Skalierung

| Aspekt | Empfehlung |
|--------|------------|
| Skalierungstyp | Horizontal |
| Min Instanzen | 3 |
| Max Instanzen | 50 |
| Auto-Scaling Trigger | CPU > 60%, Latenz > 35ms |

### Governance

| Mechanismus | Beschreibung |
|-------------|--------------|
| Performance Gates | CI/CD Validierung |
| Regression Tests | 10% Threshold |
| SLO Tracking | Rolling 30 Tage |
| Alerting | P95, P99, Error Rate |

---

## 🔗 Verwandte Dokumente

| Dokument | Beschreibung |
|----------|--------------|
| [Block BD] C4 Level 4 — API Proxy Engine | Architektur-Blueprint |
| [Block BE] STRIDE Threat Model | Bedrohungsanalyse |
| [Block BF] Security Hardening Plan | Sicherheitsmaßnahmen |
| [Block AH] Operational Excellence Framework | Betriebs excellence |

---

## 📝 Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|----------|
| 1.0.0 | 2025-01-15 | SRE Team | Initiale Erstellung |

---

> **CargoBit** — Enterprise Payment Infrastructure
>
> Dieses Dokument ist Teil der CargoBit Multi-Agent System Dokumentation.
> © 2025 CargoBit GmbH. Alle Rechte vorbehalten.
