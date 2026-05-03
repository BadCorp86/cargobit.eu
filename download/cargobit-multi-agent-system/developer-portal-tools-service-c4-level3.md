# 🧱 BLOCK BC — C4 Level 3 — Tools Service (Component Model)

## Detailliertester Architektur-Layer vor Code-/Deployment-Details

---

## 1. Überblick

Der **Tools Service** ist ein **Backend-Microservice**, der alle interaktiven Funktionen des Developer-Portals bereitstellt:

| Funktion | Beschreibung |
|----------|--------------|
| **API Explorer** | Interaktive API-Tests im Browser |
| **Webhook Simulator** | Test-Webhooks an Partner-Endpoints |
| **Event Replay** | Wiederholung historischer Events |
| **Schema Viewer** | Anzeige von API/Event-Schemas |
| **Determinism Checker** | Validierung deterministischer Outputs |

### 1.1 Service-Charakteristika

| Eigenschaft | Ausprägung |
|-------------|------------|
| **Isoliert** | Kein direkter Zugriff auf Produktionsdaten |
| **Sicher** | Sandbox-Umgebung, Signature-Validation |
| **Deterministisch** | Reproduzierbare Ergebnisse |
| **Stateless** | Horizontale Skalierbarkeit |
| **Auditierbar** | Vollständige Protokollierung |

---

## 2. C4 Level 3 Diagramm (Textuell)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TOOLS SERVICE (CONTAINER)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      ENTRY LAYER                                    │    │
│  │                                                                     │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │    │
│  │  │    [1] Request  │  │    [10] Rate    │  │    [8] Valid.   │     │    │
│  │  │      Router     │  │    Limit &      │  │  & Sanitization │     │    │
│  │  │                 │  │ Abuse Protection│  │     Layer       │     │    │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │    │
│  │           │                    │                    │               │    │
│  └───────────┼────────────────────┼────────────────────┼───────────────┘    │
│              │                    │                    │                     │
│              └────────────────────┼────────────────────┘                     │
│                                   │                                          │
│  ┌────────────────────────────────┼────────────────────────────────────┐    │
│  │                      ENGINE LAYER                                    │    │
│  │                                 │                                    │    │
│  │  ┌──────────────┐  ┌───────────┴──────────┐  ┌──────────────┐       │    │
│  │  │    [2] API   │  │    [3] Webhook      │  │    [4] Event │       │    │
│  │  │   Proxy      │  │    Delivery         │  │    Replay    │       │    │
│  │  │   Engine     │  │    Engine           │  │    Engine    │       │    │
│  │  └──────────────┘  └─────────────────────┘  └──────────────┘       │    │
│  │                                                                     │    │
│  │  ┌──────────────┐  ┌─────────────────────┐  ┌──────────────┐       │    │
│  │  │    [5] Deter.│  │    [6] Schema       │  │    [7] Sign. │       │    │
│  │  │    Engine    │  │    Registry         │  │    Engine    │       │    │
│  │  │              │  │    Adapter          │  │              │       │    │
│  │  └──────────────┘  └─────────────────────┘  └──────────────┘       │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      CROSS-CUTTING LAYER                            │    │
│  │                                                                     │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │    │
│  │  │    [9] Observ.  │  │    [11] AI      │  │   Audit Logger  │     │    │
│  │  │    Adapter      │  │    Hinting      │  │   (Internal)    │     │    │
│  │  │                 │  │    Adapter      │  │                 │     │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Komponentenbeschreibung

### 3.1 Entry Layer

#### [1] Request Router

**Verantwortlichkeit:**
Zentrale Routing-Komponente, die alle eingehenden Requests entgegennimmt und an die entsprechende Engine weiterleitet.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REQUEST ROUTER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Funktionen:                                                                │
│  ├── Request Routing (Path-based)                                          │
│  ├── Authentication (API Key / Session Token)                              │
│  ├── Authorization (RBAC Check)                                            │
│  ├── Request Logging (Correlation ID)                                      │
│  └── Health Check Endpoint                                                 │
│                                                                             │
│  Routing Table:                                                             │
│  ├── POST /api/explorer/*     → API Proxy Engine                           │
│  ├── POST /webhook/simulate   → Webhook Delivery Engine                    │
│  ├── POST /webhook/replay     → Event Replay Engine                        │
│  ├── GET  /schema/*           → Schema Registry Adapter                    │
│  ├── POST /determinism/check  → Determinism Engine                         │
│  └── GET  /health             → Health Check Response                      │
│                                                                             │
│  Interfaces:                                                                │
│  ├── IN:  HTTP/HTTPS (from Portal Frontend)                                │
│  └── OUT: Internal Engine Calls                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Konfiguration:**

```yaml
request_router:
  authentication:
    enabled: true
    providers:
      - api_key
      - session_token
  
  authorization:
    enabled: true
    rbac_service: partner-service
  
  logging:
    enabled: true
    format: structured_json
    correlation_id: true
    pii_filter: true
  
  rate_limiting:
    enabled: true
    per_ip: 100/minute
    per_key: 1000/minute
```

#### [10] Rate Limit & Abuse Protection

**Verantwortlichkeit:**
Schutz vor Überlastung und Missbrauch durch mehrstufige Rate-Limiting-Mechanismen.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RATE LIMIT & ABUSE PROTECTION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Rate Limit Levels:                                                         │
│  ├── Per-IP (Anonymous Requests)                                           │
│  ├── Per-API-Key (Authenticated Requests)                                  │
│  ├── Per-Tool (API Explorer, Webhook, Replay, etc.)                        │
│  └── Global (System-Wide Protection)                                       │
│                                                                             │
│  Protection Mechanisms:                                                     │
│  ├── Token Bucket Algorithm                                                │
│  ├── Sliding Window Counter                                                │
│  ├── Burst Protection                                                      │
│  └── Circuit Breaker (Downstream Protection)                               │
│                                                                             │
│  Actions on Limit Exceeded:                                                 │
│  ├── Return 429 Too Many Requests                                          │
│  ├── Log Warning with Context                                              │
│  ├── Increment Abuse Score                                                 │
│  └── Alert on Anomalous Patterns                                           │
│                                                                             │
│  Storage:                                                                   │
│  └── Redis (Distributed Rate Limiting)                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Rate Limit Konfiguration:**

```yaml
rate_limits:
  per_ip:
    anonymous: 60/minute
    authenticated: 100/minute
    
  per_api_key:
    standard: 1000/minute
    premium: 5000/minute
    enterprise: 20000/minute
    
  per_tool:
    api_explorer: 100/minute
    webhook_simulate: 50/minute
    event_replay: 20/minute
    determinism_check: 30/minute
    
  burst:
    multiplier: 2
    window: 10s
    
  circuit_breaker:
    threshold: 50% error rate
    timeout: 30s
    recovery: 60s
```

#### [8] Validation & Sanitization Layer

**Verantwortlichkeit:**
Validierung und Bereinigung aller eingehenden und ausgehenden Daten.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VALIDATION & SANITIZATION LAYER                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Validation Functions:                                                      │
│  ├── JSON Schema Validation                                                │
│  ├── Type Checking                                                         │
│  ├── Required Field Validation                                             │
│  ├── Enum Value Validation                                                 │
│  └── Custom Business Rules                                                 │
│                                                                             │
│  Sanitization Functions:                                                    │
│  ├── HTML/Script Tag Removal                                               │
│  ├── SQL Injection Prevention                                              │
│  ├── Path Traversal Prevention                                             │
│  ├── Unicode Normalization                                                 │
│  └── Whitespace Trimming                                                   │
│                                                                             │
│  PII Filtering:                                                             │
│  ├── Email Detection & Masking                                             │
│  ├── Credit Card Number Masking                                            │
│  ├── Phone Number Masking                                                  │
│  └── Custom Pattern Detection                                              │
│                                                                             │
│  Security Guards:                                                           │
│  ├── Maximum Payload Size (1MB)                                            │
│  ├── Maximum Header Size (8KB)                                             │
│  ├── Maximum URL Length (2048 chars)                                       │
│  └── Forbidden Characters/Patterns                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Validierungs-Pipeline:**

```typescript
interface ValidationPipeline {
  // 1. Schema Validation
  validateSchema(payload: unknown, schema: JSONSchema): ValidationResult;
  
  // 2. Type Checking
  validateTypes(payload: unknown): ValidationResult;
  
  // 3. Sanitization
  sanitize(payload: unknown): SanitizedPayload;
  
  // 4. PII Detection
  detectPII(payload: unknown): PIIDetectionResult;
  
  // 5. Security Check
  checkSecurity(payload: unknown): SecurityResult;
}
```

---

### 3.2 Engine Layer

#### [2] API Proxy Engine

**Verantwortlichkeit:**
Führt API-Requests im Namen des Entwicklers aus, mit Sandbox-Isolation und Response-Normalization.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API PROXY ENGINE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Core Functions:                                                            │
│  ├── Request Forwarding                                                     │
│  ├── Sandbox Environment Routing                                           │
│  ├── Header Sanitization                                                   │
│  ├── Timeout Management                                                    │
│  └── Response Normalization                                                │
│                                                                             │
│  Request Processing:                                                        │
│  ├── 1. Receive Request from Router                                        │
│  ├── 2. Validate API Key / Session                                         │
│  ├── 3. Determine Target Environment (Sandbox/Production)                  │
│  ├── 4. Sanitize Headers                                                   │
│  ├── 5. Forward to CargoBit Core API                                       │
│  ├── 6. Receive Response                                                   │
│  ├── 7. Normalize Response Format                                          │
│  └── 8. Return to Requester                                                │
│                                                                             │
│  Sandbox Isolation:                                                         │
│  ├── Separate API Keys                                                     │
│  ├── Isolated Database (Sandbox)                                           │
│  ├── Mock Data for Testing                                                 │
│  └── No Production Data Access                                             │
│                                                                             │
│  Header Management:                                                         │
│  ├── Remove: Authorization (replace with sandbox key)                      │
│  ├── Add: X-Request-ID, X-Correlation-ID                                   │
│  ├── Add: X-Sandbox-Mode: true                                             │
│  └── Preserve: Content-Type, Accept                                        │
│                                                                             │
│  Timeout Configuration:                                                     │
│  ├── Connect Timeout: 5s                                                   │
│  ├── Read Timeout: 30s                                                     │
│  └── Total Timeout: 60s                                                    │
│                                                                             │
│  Response Normalization:                                                    │
│  ├── Standard Error Format                                                 │
│  ├── Timing Information                                                    │
│  └── Request/Response Logging                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**API Proxy Flow:**

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│          │     │              │     │    API       │     │   CargoBit   │
│  User    │────►│   Request    │────►│    Proxy     │────►│    Core      │
│          │     │   Router     │     │   Engine     │     │    API       │
└──────────┘     └──────────────┘     └──────┬───────┘     └──────┬───────┘
                                              │                     │
                                              │                     │
                                              │  ┌──────────────────┘
                                              │  │
                                              ▼  ▼
                                       ┌──────────────┐
                                       │  Response    │
                                       │  Normalizer  │
                                       └──────┬───────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │    User      │
                                       │  (Response)  │
                                       └──────────────┘
```

#### [3] Webhook Delivery Engine

**Verantwortlichkeit:**
Zustellung von Webhook-Events an Partner-Endpoints mit Retry-Logik und Delivery-Protokollierung.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      WEBHOOK DELIVERY ENGINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Core Functions:                                                            │
│  ├── Event Delivery                                                         │
│  ├── Retry Management                                                       │
│  ├── Backoff Strategy                                                       │
│  ├── Signature Generation                                                   │
│  └── Delivery Logging                                                       │
│                                                                             │
│  Delivery Process:                                                           │
│  ├── 1. Receive Event Payload                                               │
│  ├── 2. Calculate Signature (HMAC-SHA256)                                   │
│  ├── 3. Add Headers (Signature, Timestamp, Event-Type)                      │
│  ├── 4. Send to Partner Endpoint                                            │
│  ├── 5. Check Response Status                                               │
│  ├── 6. Log Delivery Result                                                 │
│  └── 7. Queue Retry if Failed                                               │
│                                                                             │
│  Retry Strategy:                                                             │
│  ├── Algorithm: Exponential Backoff with Jitter                             │
│  ├── Max Attempts: 10                                                       │
│  ├── Initial Delay: 60s                                                     │
│  ├── Max Delay: 86400s (24h)                                                │
│  └── Jitter: 10%                                                            │
│                                                                             │
│  Retry Schedule:                                                             │
│  ├── Attempt 1:  60s   (1 min)                                              │
│  ├── Attempt 2:  120s  (3 min total)                                        │
│  ├── Attempt 3:  300s  (8 min total)                                        │
│  ├── Attempt 4:  600s  (18 min total)                                       │
│  ├── Attempt 5:  1800s (48 min total)                                       │
│  ├── Attempt 6:  3600s (1h 48min total)                                     │
│  ├── Attempt 7:  7200s (3h 48min total)                                     │
│  ├── Attempt 8:  14400s (7h 48min total)                                    │
│  ├── Attempt 9:  28800s (15h 48min total)                                   │
│  └── Attempt 10: 86400s (1d 15h 48min total)                                │
│                                                                             │
│  Delivery Headers:                                                           │
│  ├── X-CargoBit-Signature: sha256={signature}                               │
│  ├── X-CargoBit-Timestamp: {unix_timestamp}                                 │
│  ├── X-CargoBit-Event: {event_type}                                         │
│  ├── X-CargoBit-Delivery: {delivery_id}                                     │
│  └── Content-Type: application/json                                         │
│                                                                             │
│  Failure Handling:                                                           │
│  ├── Non-2xx Response → Retry                                               │
│  ├── Timeout → Retry                                                        │
│  ├── Connection Error → Retry                                               │
│  └── 10 Failed Attempts → Disable Endpoint, Alert Partner                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Webhook Delivery Flow:**

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Event   │     │   Webhook    │     │  Signature   │     │   Partner    │
│  Source  │────►│   Delivery   │────►│   Engine     │────►│   Endpoint   │
│          │     │   Engine     │     │              │     │              │
└──────────┘     └──────────────┘     └──────────────┘     └──────┬───────┘
                                                              │
                      ┌───────────────────────────────────────┘
                      │
                      ▼
               ┌──────────────┐     ┌──────────────┐
               │   Delivery   │     │    Retry     │
               │     Log      │◄────│    Queue     │
               └──────────────┘     └──────────────┘
```

#### [4] Event Replay Engine

**Verantwortlichkeit:**
Wiederholung historischer Events mit Payload-Manipulation und Diff-Vergleich.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EVENT REPLAY ENGINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Core Functions:                                                            │
│  ├── Historical Event Retrieval                                             │
│  ├── Payload Manipulation (optional)                                        │
│  ├── Signature Recalculation                                                │
│  ├── Replay Execution                                                       │
│  └── Diff Comparison                                                        │
│                                                                             │
│  Replay Process:                                                             │
│  ├── 1. Retrieve Event from Event Store                                     │
│  ├── 2. Optionally Modify Payload                                           │
│  ├── 3. Recalculate Signature                                               │
│  ├── 4. Send to Partner Endpoint                                            │
│  ├── 5. Capture Response                                                    │
│  ├── 6. Compare with Original Delivery (Diff)                               │
│  └── 7. Log Replay Result                                                   │
│                                                                             │
│  Payload Manipulation Options:                                               │
│  ├── Field Addition                                                         │
│  ├── Field Modification                                                     │
│  ├── Field Removal                                                          │
│  └── Timestamp Update                                                       │
│                                                                             │
│  Diff Comparison:                                                            │
│  ├── Original vs. Replay Response                                           │
│  ├── Status Code Comparison                                                 │
│  ├── Body Comparison (JSON Diff)                                            │
│  ├── Timing Comparison                                                      │
│  └── Highlight Differences                                                  │
│                                                                             │
│  Replay Modes:                                                               │
│  ├── Single Event Replay                                                    │
│  ├── Batch Replay (multiple events)                                         │
│  ├── Time-Range Replay                                                      │
│  └── Filtered Replay (by event type)                                        │
│                                                                             │
│  Safety Guards:                                                              │
│  ├── Maximum Replay Count per Day                                           │
│  ├── Sandbox Mode Available                                                 │
│  ├── Audit Log for all Replays                                              │
│  └── Partner Consent Required for Production                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Event Replay Flow:**

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User   │     │    Event     │     │  Signature   │     │   Partner    │
│  Request │────►│    Replay    │────►│   Engine     │────►│   Endpoint   │
│          │     │   Engine     │     │              │     │              │
└──────────┘     └──────┬───────┘     └──────────────┘     └──────┬───────┘
                        │                                          │
                        │                                          │
                        ▼                                          ▼
                 ┌──────────────┐                          ┌──────────────┐
                 │    Event     │                          │    Diff      │
                 │    Store     │                          │   Engine     │
                 └──────────────┘                          └──────────────┘
```

#### [5] Determinism Engine

**Verantwortlichkeit:**
Validierung deterministischer Outputs durch Vergleich von Checksums und Erkennung nicht-deterministischer Muster.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DETERMINISM ENGINE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Core Functions:                                                            │
│  ├── Output Comparison                                                      │
│  ├── Checksum Verification                                                  │
│  ├── Manifest Validation                                                    │
│  └── Pattern Detection                                                      │
│                                                                             │
│  Determinism Check Process:                                                  │
│  ├── 1. Receive Two Outputs to Compare                                      │
│  ├── 2. Calculate Checksums (SHA-256)                                       │
│  ├── 3. Compare Checksums                                                   │
│  ├── 4. If Different → Identify Differences                                 │
│  ├── 5. Validate Against Manifest                                           │
│  ├── 6. Check for Non-Deterministic Fields                                  │
│  └── 7. Generate Report                                                     │
│                                                                             │
│  Checksum Algorithm:                                                         │
│  ├── Normalize JSON (sorted keys, no whitespace)                            │
│  ├── Remove known non-deterministic fields                                  │
│  ├── Calculate SHA-256                                                      │
│  └── Compare Hashes                                                         │
│                                                                             │
│  Non-Deterministic Field Detection:                                          │
│  ├── Timestamps (created_at, updated_at, etc.)                              │
│  ├── UUIDs (id, request_id, etc.)                                           │
│  ├── Random Values (nonce, token, etc.)                                     │
│  └── Runtime-Dependent Values (processing_time, etc.)                       │
│                                                                             │
│  Manifest Validation:                                                        │
│  ├── Check Required Fields Present                                          │
│  ├── Check Field Types                                                      │
│  ├── Check Field Constraints                                                │
│  └── Check Enum Values                                                      │
│                                                                             │
│  Output Report:                                                              │
│  ├── Determinism Score (0-100%)                                             │
│  ├── Matching Fields                                                        │
│  ├── Differing Fields                                                       │
│  ├── Non-Deterministic Fields Detected                                      │
│  └── Recommendations                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Determinism Check Result:**

```json
{
  "check_id": "det_abc123",
  "timestamp": "2024-01-20T12:34:56Z",
  "result": {
    "deterministic": false,
    "score": 85,
    "checksums": {
      "output_1": "sha256:abc123...",
      "output_2": "sha256:def456..."
    },
    "differences": [
      {
        "path": "data.created_at",
        "type": "timestamp",
        "value_1": 1705555555,
        "value_2": 1705555556,
        "deterministic": false
      },
      {
        "path": "data.id",
        "type": "uuid",
        "value_1": "id_abc123",
        "value_2": "id_def456",
        "deterministic": false
      }
    ],
    "non_deterministic_fields": [
      "data.created_at",
      "data.id"
    ]
  },
  "recommendations": [
    "Exclude timestamp fields from determinism check",
    "Use idempotency keys for deterministic IDs"
  ]
}
```

#### [6] Schema Registry Adapter

**Verantwortlichkeit:**
Zugriff auf API- und Event-Schemas für Validierung und Anzeige.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SCHEMA REGISTRY ADAPTER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Core Functions:                                                            │
│  ├── Schema Retrieval                                                       │
│  ├── Schema Validation                                                      │
│  ├── Version Management                                                     │
│  └── Schema Diff                                                            │
│                                                                             │
│  Supported Schema Types:                                                     │
│  ├── OpenAPI 3.x (API Schemas)                                              │
│  ├── JSON Schema (Event Schemas)                                            │
│  ├── AsyncAPI (Event Specifications)                                        │
│  └── Custom Schemas                                                         │
│                                                                             │
│  Schema Operations:                                                          │
│  ├── GET /schemas/{type}/{name}/{version}                                   │
│  ├── GET /schemas/{type}/{name}/latest                                      │
│  ├── POST /schemas/{type}/{name}/validate                                   │
│  └── GET /schemas/{type}/{name}/diff/{v1}/{v2}                              │
│                                                                             │
│  Caching:                                                                    │
│  ├── In-Memory Cache (TTL: 5 minutes)                                       │
│  ├── Redis Cache (TTL: 1 hour)                                              │
│  └── Cache Invalidation on Schema Update                                    │
│                                                                             │
│  Schema Registry Connection:                                                 │
│  ├── Primary: Internal Schema Registry                                      │
│  ├── Fallback: File-based Schema Store                                      │
│  └── Health Check: Every 30 seconds                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### [7] Signature Engine

**Verantwortlichkeit:**
Berechnung und Validierung von kryptografischen Signaturen für Webhooks.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SIGNATURE ENGINE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Core Functions:                                                            │
│  ├── Signature Calculation                                                  │
│  ├── Signature Validation                                                   │
│  ├── Key Management                                                         │
│  └── Algorithm Support                                                      │
│                                                                             │
│  Supported Algorithms:                                                       │
│  ├── HMAC-SHA256 (default)                                                  │
│  ├── HMAC-SHA384                                                            │
│  ├── HMAC-SHA512                                                            │
│  └── RSA-SHA256 (future)                                                    │
│                                                                             │
│  Signature Calculation:                                                      │
│  ├── 1. Serialize Payload (JSON, no whitespace)                             │
│  ├── 2. Concatenate with Timestamp                                          │
│  ├── 3. Calculate HMAC with Secret                                          │
│  ├── 4. Encode as Hexadecimal                                               │
│  └── 5. Format: sha256={hex_signature}                                      │
│                                                                             │
│  Signature Validation:                                                       │
│  ├── 1. Extract Signature from Header                                       │
│  ├── 2. Extract Timestamp from Header                                       │
│  ├── 3. Check Timestamp Validity (±5 minutes)                               │
│  ├── 4. Calculate Expected Signature                                        │
│  ├── 5. Compare Signatures (constant-time)                                  │
│  └── 6. Return Validation Result                                            │
│                                                                             │
│  Key Management:                                                             │
│  ├── Key Generation (256-bit)                                               │
│  ├── Key Rotation (recommended: 180 days)                                   │
│  ├── Key Storage (AWS KMS / Vault)                                          │
│  └── Key Versioning                                                         │
│                                                                             │
│  Replay Attack Prevention:                                                   │
│  ├── Timestamp Validation (±5 minutes tolerance)                            │
│  ├── Nonce Support (optional)                                               │
│  └── Delivery ID Tracking (24 hours)                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Signature Calculation Example:**

```typescript
import crypto from 'crypto';

interface SignatureResult {
  signature: string;
  timestamp: number;
  algorithm: string;
}

function calculateSignature(
  payload: string,
  secret: string,
  timestamp: number = Date.now()
): SignatureResult {
  // Concatenate timestamp and payload
  const signedPayload = `${timestamp}.${payload}`;
  
  // Calculate HMAC-SHA256
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signedPayload);
  const signature = hmac.digest('hex');
  
  return {
    signature: `sha256=${signature}`,
    timestamp,
    algorithm: 'hmac-sha256'
  };
}

function validateSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: number,
  toleranceMs: number = 300000 // 5 minutes
): boolean {
  // Check timestamp
  const now = Date.now();
  if (Math.abs(now - timestamp) > toleranceMs) {
    return false;
  }
  
  // Calculate expected signature
  const expected = calculateSignature(payload, secret, timestamp);
  
  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected.signature)
  );
}
```

---

### 3.3 Cross-Cutting Layer

#### [9] Observability Adapter

**Verantwortlichkeit:**
Zentralisierte Observability für alle Komponenten (Logs, Metrics, Traces).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OBSERVABILITY ADAPTER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Three Pillars:                                                              │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │      LOGS       │  │     METRICS     │  │     TRACES      │             │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤             │
│  │ • Structured    │  │ • RED Metrics   │  │ • Distributed   │             │
│  │ • Correlated    │  │ • Latency       │  │ • End-to-End    │             │
│  │ • No PII        │  │ • Errors        │  │ • Span Export   │             │
│  │ • JSON Format   │  │ • Throughput    │  │ • OTLP          │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  Log Structure:                                                              │
│  {                                                                          │
│    "timestamp": "2024-01-20T12:34:56.789Z",                                │
│    "level": "info",                                                         │
│    "service": "tools-service",                                              │
│    "component": "api-proxy-engine",                                         │
│    "correlation_id": "corr_abc123",                                         │
│    "request_id": "req_xyz789",                                              │
│    "partner_id": "partner_123",                                             │
│    "action": "api_call",                                                    │
│    "duration_ms": 234,                                                      │
│    "status": "success"                                                      │
│  }                                                                          │
│                                                                             │
│  Key Metrics:                                                                │
│  ├── tools_request_duration_seconds (histogram)                             │
│  ├── tools_request_total (counter)                                          │
│  ├── tools_error_total (counter)                                            │
│  ├── tools_rate_limit_hits_total (counter)                                  │
│  └── tools_active_requests (gauge)                                          │
│                                                                             │
│  Trace Instrumentation:                                                      │
│  ├── Request Router → Span: routing                                         │
│  ├── API Proxy Engine → Span: proxy_request                                 │
│  ├── Webhook Delivery Engine → Span: webhook_delivery                       │
│  └── All Spans linked by Correlation ID                                     │
│                                                                             │
│  Export Destinations:                                                        │
│  ├── Logs → Datadog / Elasticsearch                                         │
│  ├── Metrics → Prometheus / Datadog                                         │
│  └── Traces → Jaeger / Datadog APM                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### [11] AI Hinting Adapter (Optional)

**Verantwortlichkeit:**
Kontextuelle Hinweise für Entwickler, basierend auf Dokumentation (kein PII-Zugriff).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI HINTING ADAPTER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Core Functions:                                                            │
│  ├── Error Analysis                                                         │
│  ├── Documentation Retrieval (RAG)                                          │
│  ├── Hint Generation                                                        │
│  └── Code Example Suggestions                                               │
│                                                                             │
│  Data Access Constraints:                                                    │
│  ├── ✅ Access: Documentation, API Reference, Guides                        │
│  ├── ✅ Access: Error Code Definitions                                      │
│  ├── ❌ No Access: Partner Data                                             │
│  ├── ❌ No Access: Transaction Data                                         │
│  └── ❌ No Access: PII                                                      │
│                                                                             │
│  Hint Types:                                                                 │
│  ├── Error Fix Suggestions                                                  │
│  ├── API Usage Tips                                                         │
│  ├── Schema Field Explanations                                              │
│  └── Best Practice Recommendations                                          │
│                                                                             │
│  Guardrails:                                                                 │
│  ├── Input Validation (no PII in prompts)                                   │
│  ├── Output Filtering (no sensitive data)                                   │
│  ├── Rate Limiting (per partner)                                            │
│  └── Audit Logging (all AI interactions)                                    │
│                                                                             │
│  Example Hint:                                                               │
│  {                                                                          │
│    "error_code": "INVALID_AMOUNT",                                          │
│    "hint": "The amount field must be a positive integer in the smallest     │
│             currency unit (e.g., cents for EUR). For €10.00, use 1000.",    │
│    "documentation_url": "https://developer.cargobit.io/docs/amounts",       │
│    "example": { "amount": 1000, "currency": "EUR" }                         │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Interaktionen & Sequenzen

### 4.1 API Explorer Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        API EXPLORER FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User          Portal         Request       Validation      API Proxy      │
│                              Router          Layer          Engine          │
│   │             │              │               │               │            │
│   │  1. Build   │              │               │               │            │
│   │  Request    │              │               │               │            │
│   │────────────►│              │               │               │            │
│   │             │  2. Route    │               │               │            │
│   │             │─────────────►│               │               │            │
│   │             │              │  3. Validate  │               │            │
│   │             │              │──────────────►│               │            │
│   │             │              │               │  4. Forward   │            │
│   │             │              │               │──────────────►│            │
│   │             │              │               │               │            │
│   │             │              │               │               │ 5. Call    │
│   │             │              │               │               │ Core API   │
│   │             │              │               │               │─────────►  │
│   │             │              │               │               │            │
│   │             │              │               │               │ 6. Response│
│   │             │              │               │               │◄─────────  │
│   │             │              │               │  7. Normalize │            │
│   │             │              │               │◄──────────────│            │
│   │             │              │  8. Log       │               │            │
│   │             │              │◄──────────────│               │            │
│   │             │  9. Return   │               │               │            │
│   │             │◄─────────────│               │               │            │
│   │  10. Show   │              │               │               │            │
│   │  Response   │              │               │               │            │
│   │◄────────────│              │               │               │            │
│   │             │              │               │               │            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Webhook Simulator Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      WEBHOOK SIMULATOR FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User       Portal      Router    Validation   Signature    Webhook       │
│                                               Engine       Delivery       │
│   │          │           │           │           │           │             │
│   │ 1. Config│           │           │           │           │             │
│   │ & Send   │           │           │           │           │             │
│   │─────────►│           │           │           │           │             │
│   │          │ 2. Route  │           │           │           │             │
│   │          │──────────►│           │           │           │             │
│   │          │           │ 3. Valid. │           │           │             │
│   │          │           │──────────►│           │           │             │
│   │          │           │           │ 4. Calc   │           │             │
│   │          │           │           │ Signature │           │             │
│   │          │           │           │──────────►│           │             │
│   │          │           │           │           │ 5. Deliver│             │
│   │          │           │           │           │──────────►│             │
│   │          │           │           │           │           │             │
│   │          │           │           │           │           │ 6. Partner  │
│   │          │           │           │           │           │    Endpoint │
│   │          │           │           │           │           │────────────►│
│   │          │           │           │           │           │             │
│   │          │           │           │           │ 7. Log    │             │
│   │          │           │           │           │◄──────────│             │
│   │          │           │ 8. Result │           │           │             │
│   │          │           │◄──────────│           │           │             │
│   │          │ 9. Return │           │           │           │             │
│   │          │◄──────────│           │           │           │             │
│   │ 10. Show │           │           │           │           │             │
│   │ Result   │           │           │           │           │             │
│   │◄─────────│           │           │           │           │             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Event Replay Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EVENT REPLAY FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User       Portal      Replay      Event       Signature    Partner       │
│                          Engine      Store      Engine       Endpoint      │
│   │          │           │           │           │           │             │
│   │ 1. Select│           │           │           │           │             │
│   │ Event    │           │           │           │           │             │
│   │─────────►│           │           │           │           │             │
│   │          │ 2. Request│           │           │           │             │
│   │          │──────────►│           │           │           │             │
│   │          │           │ 3. Fetch  │           │           │             │
│   │          │           │──────────►│           │           │             │
│   │          │           │◄──────────│           │           │             │
│   │          │           │ 4. Recalc │           │           │             │
│   │          │           │ Signature │           │           │             │
│   │          │           │──────────────────────►│           │             │
│   │          │           │           │           │ 5. Send   │             │
│   │          │           │           │           │──────────►│             │
│   │          │           │           │           │           │             │
│   │          │           │           │           │           │ 6. Partner  │
│   │          │           │           │           │           │    Response │
│   │          │           │           │           │           │◄────────────│
│   │          │           │ 7. Diff   │           │           │             │
│   │          │           │ Analysis  │           │           │             │
│   │          │ 8. Result │           │           │           │             │
│   │          │◄──────────│           │           │           │             │
│   │ 9. Show  │           │           │           │           │             │
│   │ Diff     │           │           │           │           │             │
│   │◄─────────│           │           │           │           │             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Determinism Check Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DETERMINISM CHECK FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User       Portal      Router      Determinism    Observability           │
│   │          │           │           Engine         Adapter                 │
│   │          │           │           │               │                      │
│   │ 1. Submit│           │           │               │                      │
│   │ Outputs  │           │           │               │                      │
│   │─────────►│           │           │               │                      │
│   │          │ 2. Route  │           │               │                      │
│   │          │──────────►│           │               │                      │
│   │          │           │ 3. Compare│               │                      │
│   │          │           │──────────►│               │                      │
│   │          │           │           │               │                      │
│   │          │           │           │ 4. Calculate  │                      │
│   │          │           │           │    Checksums  │                      │
│   │          │           │           │               │                      │
│   │          │           │           │ 5. Validate   │                      │
│   │          │           │           │    Manifest   │                      │
│   │          │           │           │               │                      │
│   │          │           │           │ 6. Detect     │                      │
│   │          │           │           │    Patterns   │                      │
│   │          │           │           │               │                      │
│   │          │           │           │ 7. Log        │                      │
│   │          │           │           │──────────────►│                      │
│   │          │           │ 8. Report │               │                      │
│   │          │           │◄──────────│               │                      │
│   │          │ 9. Return │           │               │                      │
│   │          │◄──────────│           │               │                      │
│   │ 10. Show │           │           │               │                      │
│   │ Report   │           │           │               │                      │
│   │◄─────────│           │           │               │                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Sicherheits- und Governance-Aspekte

### 5.1 Security

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SECURITY ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Network Security:                                                           │
│  ├── Isolated Network Segment                                               │
│  ├── No Direct Database Access                                              │
│  ├── All Traffic via API Gateway                                            │
│  └── DDoS Protection at Edge                                                │
│                                                                             │
│  Data Security:                                                              │
│  ├── No Access to Production Data                                           │
│  ├── Sandbox-Only Data Access                                               │
│  ├── No PII in Logs                                                         │
│  └── Encryption in Transit (TLS 1.3)                                        │
│                                                                             │
│  Application Security:                                                       │
│  ├── Strict CSP Headers                                                     │
│  ├── Input Validation & Sanitization                                        │
│  ├── Signature Validation for Webhooks                                      │
│  └── Rate Limiting per Tool                                                 │
│                                                                             │
│  Authentication & Authorization:                                             │
│  ├── API Key Required for All Operations                                    │
│  ├── RBAC for Tool Access                                                   │
│  ├── Session Management with Timeout                                        │
│  └── MFA for Sensitive Operations                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Governance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GOVERNANCE FRAMEWORK                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Version Control:                                                            │
│  ├── Every Engine Versioned                                                 │
│  ├── Semantic Versioning (v{major}.{minor}.{patch})                         │
│  └── Changelog for Every Release                                            │
│                                                                             │
│  Change Management:                                                          │
│  ├── Every Change → ADR (Architecture Decision Record)                      │
│  ├── RFC Process for New Features                                           │
│  ├── Security Review for All Changes                                        │
│  └── Approval Workflow Required                                             │
│                                                                             │
│  Quality Assurance:                                                          │
│  ├── Every Payload → Schema-Validated                                       │
│  ├── Every Action → Audit-Logged                                            │
│  ├── Every Error → Documented                                               │
│  └── Every Flow → Tested                                                    │
│                                                                             │
│  Documentation:                                                              │
│  ├── API Documentation (OpenAPI)                                            │
│  ├── Runbooks for Operations                                                │
│  ├── Incident Response Procedures                                           │
│  └── Architecture Decision Records                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Compliance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMPLIANCE FRAMEWORK                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GDPR:                                                                       │
│  ├── Keine personenbezogenen Daten verarbeitet                              │
│  ├── Keine PII in Logs gespeichert                                          │
│  ├── Datenminimierung durch Design                                          │
│  └── Audit-Trails für alle Zugriffe                                        │
│                                                                             │
│  SOC2:                                                                       │
│  ├── Vollständige Protokollierung                                           │
│  ├── Monitoring & Alerting                                                  │
│  ├── Access Control (RBAC)                                                  │
│  └── Change Management Process                                              │
│                                                                             │
│  ISO27001:                                                                   │
│  ├── Information Security Controls                                          │
│  ├── Risk Assessment für neue Features                                      │
│  ├── Incident Management Process                                            │
│  └── Continuous Improvement                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Erweiterbarkeit & Skalierung

### 6.1 Horizontal Scaling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      HORIZONTAL SCALING                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Scaling Principles:                                                         │
│  ├── Stateless Engines (keine lokalen Daten)                                │
│  ├── Shared Schema Registry                                                 │
│  ├── Shared Observability Infrastructure                                    │
│  └── External State (Redis, PostgreSQL)                                     │
│                                                                             │
│  Scaling Architecture:                                                       │
│                                                                             │
│          ┌─────────────┐                                                    │
│          │    Load     │                                                    │
│          │   Balancer  │                                                    │
│          └──────┬──────┘                                                    │
│                 │                                                           │
│     ┌───────────┼───────────┐                                               │
│     │           │           │                                               │
│     ▼           ▼           ▼                                               │
│  ┌──────┐   ┌──────┐   ┌──────┐                                            │
│  │Tools │   │Tools │   │Tools │                                            │
│  │Service│   │Service│   │Service│                                           │
│  │  #1  │   │  #2  │   │  #3  │                                            │
│  └──────┘   └──────┘   └──────┘                                            │
│     │           │           │                                               │
│     └───────────┼───────────┘                                               │
│                 │                                                           │
│                 ▼                                                           │
│          ┌─────────────┐                                                    │
│          │   Shared    │                                                    │
│          │   State     │                                                    │
│          │ (Redis/DB)  │                                                    │
│          └─────────────┘                                                    │
│                                                                             │
│  Auto-Scaling Triggers:                                                      │
│  ├── CPU > 70% for 2 minutes → Scale Up                                    │
│  ├── Request Latency > 500ms → Scale Up                                     │
│  ├── Request Queue > 100 → Scale Up                                         │
│  └── CPU < 30% for 10 minutes → Scale Down                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Modularität

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MODULARITÄT                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Engine Independence:                                                        │
│  ├── Jede Engine ist eigenständig                                          │
│  ├── Jede Engine kann einzeln deployt werden                                │
│  ├── Jede Engine kann einzeln skaliert werden                              │
│  └── Neue Engines ohne Impact auf bestehende                                │
│                                                                             │
│  Adding New Tools:                                                           │
│  ├── 1. Define Engine Interface                                            │
│  ├── 2. Implement Engine                                                    │
│  ├── 3. Add Routing Rules                                                   │
│  ├── 4. Configure Rate Limits                                               │
│  ├── 5. Add Observability                                                   │
│  └── 6. Deploy with Feature Flag                                            │
│                                                                             │
│  Plugin Architecture (Future):                                               │
│  ├── Standardized Engine Interface                                         │
│  ├── Plugin Registration API                                                │
│  ├── Dynamic Loading                                                        │
│  └── Sandboxed Execution                                                    │
│                                                                             │
│  Current Engines:                                                            │
│  ├── API Proxy Engine ✓                                                     │
│  ├── Webhook Delivery Engine ✓                                              │
│  ├── Event Replay Engine ✓                                                  │
│  ├── Determinism Engine ✓                                                   │
│  ├── Schema Registry Adapter ✓                                              │
│  └── AI Hinting Adapter (optional) ✓                                        │
│                                                                             │
│  Future Engines (Planned):                                                   │
│  ├── Load Testing Engine                                                    │
│  ├── Mock Server Engine                                                     │
│  └── Code Generation Engine                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Multi-Region

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MULTI-REGION ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Regional Deployment:                                                        │
│  ├── Tools Service kann pro Region laufen                                   │
│  ├── Keine State-Abhängigkeiten zwischen Regionen                          │
│  └── Event Replay & Webhook Delivery region-aware                           │
│                                                                             │
│  Region-Aware Routing:                                                       │
│                                                                             │
│          ┌─────────────┐                                                    │
│          │   Global    │                                                    │
│          │   Router    │                                                    │
│          └──────┬──────┘                                                    │
│                 │                                                           │
│     ┌───────────┼───────────┐                                               │
│     │           │           │                                               │
│     ▼           ▼           ▼                                               │
│  ┌──────┐   ┌──────┐   ┌──────┐                                            │
│  │ EU   │   │ US   │   │ APAC │                                            │
│  │Region│   │Region│   │Region│                                            │
│  └──────┘   └──────┘   └──────┘                                            │
│                                                                             │
│  Data Residency:                                                             │
│  ├── Partner Data stays in Home Region                                      │
│  ├── Event Replay in Partner's Home Region                                  │
│  └── Webhook Delivery from Nearest Region                                   │
│                                                                             │
│  Failover:                                                                   │
│  ├── Primary Region Failure → Route to Secondary                            │
│  ├── Automatic Health Checks                                                │
│  └── DNS-based Failover                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Nächste Vertiefungen

### 7.1 C4 Level 4 (Code/Module Level)

Für folgende Engines wird Code-Level-Dokumentation empfohlen:

| Engine | Module für Level 4 |
|--------|-------------------|
| **API Proxy Engine** | RequestHandler, ResponseNormalizer, SandboxRouter |
| **Webhook Delivery Engine** | DeliveryQueue, RetryManager, SignatureCalculator |
| **Determinism Engine** | ChecksumCalculator, DiffEngine, PatternDetector |

### 7.2 Operating Model für Tools Service

Detaillierte Prozess-Dokumentation:

| Prozess | Beschreibung |
|---------|--------------|
| **Rollen** | Tools Service Owner, SRE, Support |
| **Verantwortlichkeiten** | Deployment, Monitoring, Incident Response |
| **RACI** | Pro Flow (API Call, Webhook, Replay) |
| **Incident Flows** | Error Handling, Escalation, Recovery |

### 7.3 Threat Model (STRIDE)

Sicherheitsanalyse pro Engine:

| Threat | Relevante Engines |
|--------|-------------------|
| **Spoofing** | Request Router, Signature Engine |
| **Tampering** | Validation Layer, API Proxy |
| **Repudiation** | Audit Logger, Observability |
| **Information Disclosure** | All Engines |
| **Denial of Service** | Rate Limiter, All Engines |
| **Elevation of Privilege** | Request Router, RBAC |

---

## 8. Referenzen

- [Enterprise Architecture Blueprint](./developer-portal-enterprise-architecture-blueprint.md)
- [API Governance Framework](./developer-portal-api-governance-framework.md)
- [Event Governance Framework](./developer-portal-event-governance-framework.md)
- [Security Hardening Guide](./developer-portal-security-hardening-guide.md)
- [Threat Model STRIDE](./developer-portal-threat-model-stride.md)

---

*Letzte Aktualisierung: Januar 2025*
*Owner: Architecture Board*
*Status: Approved*
