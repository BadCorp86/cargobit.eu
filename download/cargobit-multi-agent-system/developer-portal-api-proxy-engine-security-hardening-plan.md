# CargoBit API Proxy Engine — Security Hardening Plan

> **Block BF** | Security Master Level | Version 1.0.0
>
> **Zweck:** Operationalisierbarer, auditierbarer, deterministischer und Enterprise‑ready Hardening‑Blueprint für die API Proxy Engine.

---

## 📋 Dokumenten-Metadaten

| Attribut | Wert |
|----------|------|
| **Dokument-ID** | CB-DOC-BF-001 |
| **Version** | 1.0.0 |
| **Status** | Final |
| **Klassifikation** | Internal — Security Critical |
| **Gültig ab** | 2025-01-15 |
| **Review-Zyklus** | Quartalsweise |
| **Owner** | Security Team + SRE Team |
| **Reviewer** | CISO, Lead Architect, Compliance Officer |

---

## 🎯 Executive Summary

Dieser Security Hardening Plan definiert die vollständigen Sicherheitsmaßnahmen für die CargoBit API Proxy Engine. Der Plan ist entlang sechs Hardening‑Domänen strukturiert, die zusammen einen mehrschichtigen Sicherheitsperimeter bilden.

**Die sechs Hardening‑Domänen:**

1. **Boundary Hardening** — Schutz der Engine an allen Ein- und Austrittspunkten
2. **Input/Output Hardening** — Schutz vor Manipulation, Injection, Leakage
3. **Execution Hardening** — Schutz der Engine während der Ausführung
4. **Identity & Access Hardening** — Schutz vor Spoofing, Privilege Escalation, Kontextverlust
5. **Observability & Audit Hardening** — Sicherstellen der Nachvollziehbarkeit bei DSGVO‑Konformität
6. **Operational Hardening** — Sicherstellen des sicheren Betriebs

Jede Domäne enthält konkrete Maßnahmen, technische Mechanismen, Governance‑Regeln und Audit‑Kriterien.

---

## 🧱 Domäne 1: Boundary Hardening

### Schutz der Engine an allen Ein- und Austrittspunkten

Die Boundary Hardening Domäne etabliert den ersten Sicherheitsperimeter um die API Proxy Engine. Dieser Perimeter definiert, welche Kommunikation erlaubt ist und welche strikt blockiert wird. Das Prinzip ist simpel: Was nicht explizit erlaubt ist, wird standardmäßig abgelehnt.

---

### 1.1 Endpoint Allowlisting

Die API Proxy Engine darf ausschließlich CargoBit‑Core‑APIs ansprechen. Dies verhindert, dass die Engine als Open Proxy missbraucht wird oder Daten an nicht autorisierte Endpunkte weiterleitet.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Nur CargoBit‑Core‑APIs | Alle Ziel‑URLs müssen in der Allowlist stehen |
| Keine externen Domains | Keine Kommunikation zu Systemen außerhalb der CargoBit‑Infrastruktur |
| Keine dynamischen URLs | Keine zur Laufzeit konstruierten Ziel‑URLs |
| Kein Open Proxy Verhalten | Die Engine darf niemals als generischer Proxy fungieren |

**Technische Mechanismen:**

```yaml
# endpoint-allowlist.yaml
apiVersion: cargobit.io/v1
kind: EndpointAllowlist
metadata:
  name: api-proxy-engine-allowlist
  version: "2025.01.15"
spec:
  allowedEndpoints:
    - name: ledger-service
      url: https://ledger.internal.cargobit.io
      methods: [GET, POST, PUT]
      environments: [sandbox, production]
      
    - name: payment-orchestrator
      url: https://payments.internal.cargobit.io
      methods: [POST]
      environments: [sandbox, production]
      
    - name: partner-service
      url: https://partners.internal.cargobit.io
      methods: [GET, POST]
      environments: [sandbox, production]

  defaultAction: DENY
  validationMode: STRICT
```

**Audit‑Kriterium:**

> ✅ Jede Ziel‑URL muss in einer versionierten Allowlist stehen. Bei jedem Deployment wird die Allowlist gegen den Cluster‑State validiert.

**Validierungs-Pipeline:**

```javascript
// validate-allowlist.js
async function validateEndpointAllowlist(config, clusterState) {
  const violations = [];
  
  for (const endpoint of clusterState.activeEndpoints) {
    if (!config.allowedEndpoints.some(e => e.url === endpoint.url)) {
      violations.push({
        severity: 'CRITICAL',
        message: `Endpoint not in allowlist: ${endpoint.url}`,
        endpoint: endpoint.url
      });
    }
  }
  
  if (violations.length > 0) {
    throw new Error(`Allowlist validation failed: ${violations.length} violations`);
  }
  
  return { status: 'VALIDATED', timestamp: new Date().toISOString() };
}
```

---

### 1.2 Strict HTTP Method Enforcement

Jeder Endpoint akzeptiert nur die HTTP‑Methoden, die für seine Funktion explizit definiert sind. Dies verhindert "Verb Tunneling" und reduziert die Angriffsfläche.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Nur definierte Methoden | Jeder Endpoint hat eine explizite Methoden‑Allowlist |
| Kein Verb Tunneling | Methoden wie `X-HTTP-Method-Override` sind verboten |
| Keine dynamischen Methoden | Methoden können nicht zur Laufzeit geändert werden |

**Methodenmatrix pro Endpoint:**

```yaml
# method-matrix.yaml
apiVersion: cargobit.io/v1
kind: MethodMatrix
metadata:
  name: api-proxy-method-matrix
spec:
  endpoints:
    - path: /v1/payments
      methods:
        - method: POST
          description: Create payment
          idempotent: true
        - method: GET
          description: List payments
          idempotent: true
      deniedMethods: [PUT, DELETE, PATCH]
      
    - path: /v1/partners/{id}
      methods:
        - method: GET
          description: Get partner details
          idempotent: true
      deniedMethods: [POST, PUT, DELETE, PATCH]
```

**Audit‑Kriterium:**

> ✅ Methodenmatrix pro Endpoint dokumentiert. Bei Audit wird stichprobenartig verifiziert, dass nicht definierte Methoden mit `405 Method Not Allowed` abgelehnt werden.

---

### 1.3 TLS Enforcement

Alle Kommunikation erfolgt ausschließlich über verschlüsselte Verbindungen. Downgrade‑Angriffe und unsichere Cipher Suites werden strikt unterbunden.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| TLS 1.2+ Minimum | Keine Verbindungen unter TLS 1.2 |
| No Downgrade | TLS‑Version wird erzwungen, nicht verhandelt |
| No Insecure Ciphers | Nur starke Cipher Suites erlaubt |

**TLS‑Konfiguration:**

```yaml
# tls-config.yaml
apiVersion: cargobit.io/v1
kind: TLSConfig
metadata:
  name: api-proxy-tls-config
spec:
  minimumVersion: TLS1_2
  preferredVersion: TLS1_3
  
  cipherSuites:
    - TLS_AES_256_GCM_SHA384
    - TLS_CHACHA20_POLY1305_SHA256
    - TLS_AES_128_GCM_SHA256
    - ECDHE-RSA-AES256-GCM-SHA384
    - ECDHE-RSA-AES128-GCM-SHA256
    
  rejectedCipherSuites:
    - TLS_RSA_WITH_RC4_128_SHA
    - TLS_RSA_WITH_3DES_EDE_CBC_SHA
    - TLS_RSA_WITH_AES_128_CBC_SHA
    
  certificateRotation:
    enabled: true
    validityDays: 90
    alertDaysBeforeExpiry: 14
```

**Audit‑Kriterium:**

> ✅ TLS‑Scanner (z.B. SSL Labs, testssl.sh) zeigt 0 Warnungen. Score muss A+ sein.

**Automatisierte TLS‑Validierung:**

```bash
#!/bin/bash
# tls-scan.sh
TARGET="api-proxy.internal.cargobit.io"

# Run testssl.sh
testssl.sh --quiet --json $TARGET > tls-report.json

# Check for warnings
WARNINGS=$(jq '.scanResult[0].warnings | length' tls-report.json)

if [ "$WARNINGS" -gt 0 ]; then
  echo "TLS validation failed: $WARNINGS warnings found"
  exit 1
fi

echo "TLS validation passed"
```

---

### 1.4 Request Size Limits

Alle Requests werden auf ihre Größe beschränkt, um Denial‑of‑Service‑Angriffe durch oversized Payloads zu verhindern.

**Regeln:**

| Limit | Wert | Beschreibung |
|-------|------|--------------|
| Max Body Size | 1 MB | Maximale Request‑Body‑Größe |
| Max Header Size | 16 KB | Maximale Header‑Größe (alle Header kombiniert) |
| Max Query Length | 2 KB | Maximale Query‑String‑Länge |
| Max URL Length | 2 KB | Maximale Gesamt‑URL‑Länge |

**Konfiguration:**

```yaml
# size-limits.yaml
apiVersion: cargobit.io/v1
kind: RequestSizeLimits
metadata:
  name: api-proxy-size-limits
spec:
  bodySize:
    default: 1MB
    endpoints:
      - path: /v1/webhooks
        limit: 512KB
      - path: /v1/batch
        limit: 5MB
        
  headerSize: 16KB
  queryLength: 2KB
  urlLength: 2KB
  
  exceededAction:
    statusCode: 413
    message: "Request entity too large"
    logLevel: WARN
```

**Audit‑Kriterium:**

> ✅ Limits dokumentiert und getestet. Bei Audit werden Oversized‑Requests mit `413 Request Entity Too Large` abgelehnt.

---

## 🧱 Domäne 2: Input/Output Hardening

### Schutz vor Manipulation, Injection, Leakage

Die Input/Output Hardening Domäne schützt die API Proxy Engine vor Angriffen, die über die Ein- und Ausgabekanäle erfolgen. Dies umfasst Schema‑Validation, Header‑Sanitization, Response‑Redaction und Error‑Normalization.

---

### 2.1 Schema Validation (Mandatory)

Jeder Request‑Body wird gegen das API‑Schema validiert. Es gibt keine optionalen Validierungen und keine "Best Effort"‑Modi.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Mandatory Validation | Kein Request ohne Schema‑Validierung |
| Strict Mode | Keine Toleranz bei Schema‑Verletzungen |
| No Best Effort | Entweder gültig oder abgelehnt |

**Schema‑Validierungs-Pipeline:**

```yaml
# schema-validation.yaml
apiVersion: cargobit.io/v1
kind: SchemaValidationConfig
metadata:
  name: api-proxy-schema-validation
spec:
  mode: STRICT
  validationSteps:
    - name: structure
      description: Validate JSON structure
      onFailure: REJECT
      
    - name: types
      description: Validate field types
      onFailure: REJECT
      
    - name: required
      description: Validate required fields
      onFailure: REJECT
      
    - name: format
      description: Validate field formats (dates, UUIDs, etc.)
      onFailure: REJECT
      
    - name: constraints
      description: Validate value constraints (min, max, pattern)
      onFailure: REJECT
      
  responseOnError:
    statusCode: 400
    format:
      error: "VALIDATION_ERROR"
      message: "{validationError}"
      path: "{fieldPath}"
```

**Validierungs-Implementation:**

```typescript
// schema-validator.ts
import Ajv from 'ajv';

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  removeAdditional: false
});

export async function validateRequest(
  schema: object,
  payload: unknown
): Promise<ValidationResult> {
  const validate = ajv.compile(schema);
  const valid = validate(payload);
  
  if (!valid) {
    return {
      valid: false,
      errors: validate.errors?.map(err => ({
        path: err.instancePath,
        message: err.message,
        value: err.data
      }))
    };
  }
  
  return { valid: true };
}
```

**Audit‑Kriterium:**

> ✅ Validation Logs vorhanden. Bei Audit werden Logs auf Schema‑Validierungs‑Events geprüft.

---

### 2.2 Header Sanitization

Header werden strikt gefiltert, um Injection und Context‑Leakage zu verhindern. Es gilt das Allowlist‑Prinzip.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Allowlist statt Blocklist | Nur definierte Header werden durchgereicht |
| Interne Header entfernen | Alle `X-CargoBit-*` Header werden entfernt |
| Partner‑Injected Header entfernen | Keine Header von Partnern werden vertraut |

**Header‑Allowlist:**

```yaml
# header-allowlist.yaml
apiVersion: cargobit.io/v1
kind: HeaderAllowlist
metadata:
  name: api-proxy-header-allowlist
spec:
  incomingHeaders:
    allowed:
      - name: Authorization
        transform: VALIDATE_ONLY
      - name: Content-Type
        transform: PASS_THROUGH
      - name: Accept
        transform: PASS_THROUGH
      - name: Idempotency-Key
        transform: VALIDATE_FORMAT
        
    removed:
      - pattern: "X-CargoBit-*"
        reason: "Internal headers must not be accepted"
      - pattern: "X-Forwarded-*"
        reason: "Can be spoofed by client"
        
  outgoingHeaders:
    injected:
      - name: X-CargoBit-Partner-Id
        source: "executionContext.partnerId"
      - name: X-CargoBit-Environment
        source: "executionContext.environment"
      - name: X-CargoBit-Request-Id
        source: "executionContext.requestId"
```

**Sanitization‑Implementation:**

```typescript
// header-sanitizer.ts
export function sanitizeHeaders(
  incomingHeaders: Record<string, string>,
  allowlist: HeaderAllowlist
): SanitizedHeaders {
  const sanitized: Record<string, string> = {};
  
  for (const [name, value] of Object.entries(incomingHeaders)) {
    const normalizedName = name.toLowerCase();
    
    // Check if header is in allowlist
    const allowed = allowlist.incomingHeaders.allowed.find(
      h => h.name.toLowerCase() === normalizedName
    );
    
    if (allowed) {
      sanitized[normalizedName] = value;
    }
  }
  
  return sanitized;
}
```

**Audit‑Kriterium:**

> ✅ Sanitization‑Report pro Release. Bei Audit werden Test‑Requests mit nicht erlaubten Headern gesendet und Verifikation durchgeführt, dass diese entfernt wurden.

---

### 2.3 Response Redaction

Antworten werden bereinigt, bevor sie an den Partner zurückgesendet werden. Sensible Felder werden maskiert, interne Fehlerdetails und IDs entfernt.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Maskierung sensibler Felder | PANs, IBANs, etc. werden maskiert |
| Interne Fehlerdetails entfernen | Stacktraces und interne IDs werden entfernt |
| Interne IDs entfernen | Database‑IDs, Trace‑IDs bleiben intern |

**Redaction‑Rules:**

```yaml
# redaction-rules.yaml
apiVersion: cargobit.io/v1
kind: RedactionRules
metadata:
  name: api-proxy-redaction-rules
spec:
  fieldRedactions:
    - path: "$.paymentMethod.cardNumber"
      pattern: "[0-9]{13,19}"
      replacement: "****-****-****-{last4}"
      
    - path: "$.bankAccount.iban"
      pattern: "[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}"
      replacement: "{country}****************{last4}"
      
    - path: "$.partner.apiKey"
      replacement: "***REDACTED***"
      
    - path: "$.internal.*"
      action: REMOVE
      
  errorRedactions:
    - pattern: "stack\\s*:"
      action: REMOVE
      
    - pattern: "at\\s+[a-zA-Z0-9_.]+\\s*\\("
      action: REMOVE
      
    - pattern: "(password|secret|token|key)\\s*[:=]\\s*['\"]?[^'\"\\s]+"
      replacement: "$1=***REDACTED***"
```

**Audit‑Kriterium:**

> ✅ Redaction‑Rules versioniert. Bei Audit werden Test‑Responses auf verbliebene sensible Daten geprüft.

---

### 2.4 Error Normalization

Alle Fehler werden in ein einheitliches Format überführt. Dies verhindert Information Leakage und verbessert die Debuggbarkeit für Partner.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Einheitliches Fehlerformat | Alle Errors folgen demselben Schema |
| Keine Stacktraces | Interne Fehlerdetails werden nicht geleaked |
| Keine Core‑API‑Interna | Keine Details über interne Systeme |

**Error‑Schema:**

```yaml
# error-schema.yaml
apiVersion: cargobit.io/v1
kind: ErrorSchema
metadata:
  name: api-proxy-error-schema
spec:
  format:
    type: object
    required: [error, message, requestId, timestamp]
    properties:
      error:
        type: string
        description: "Error code (e.g., VALIDATION_ERROR, RATE_LIMIT_EXCEEDED)"
        
      message:
        type: string
        description: "Human-readable error message"
        
      requestId:
        type: string
        format: uuid
        description: "Correlation ID for support"
        
      timestamp:
        type: string
        format: date-time
        
      details:
        type: object
        description: "Optional additional context"
        
  errorMapping:
    - internalCode: "SQL_ERROR"
      externalCode: "INTERNAL_ERROR"
      externalMessage: "An internal error occurred"
      
    - internalCode: "VALIDATION_FAILED"
      externalCode: "VALIDATION_ERROR"
      externalMessage: "Request validation failed"
      
    - internalCode: "RATE_LIMIT"
      externalCode: "RATE_LIMIT_EXCEEDED"
      externalMessage: "Rate limit exceeded. Please retry after {retryAfter}s"
```

**Audit‑Kriterium:**

> ✅ Error‑Model dokumentiert und enforced. Bei Audit werden verschiedene Fehlerfälle getriggert und Responses gegen das Schema validiert.

---

## 🧱 Domäne 3: Execution Hardening

### Schutz der Engine während der Ausführung

Die Execution Hardening Domäne schützt die API Proxy Engine während der Laufzeit. Dies umfasst Timeout‑Enforcement, Retry‑Control, Circuit‑Breaker und Immutable ExecutionContext.

---

### 3.1 Timeout Enforcement

Jeder Endpoint hat definierte Timeouts, die strikt durchgesetzt werden. Dies verhindert "Hanging Requests" und schützt die Systemressourcen.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Per‑Endpoint Timeouts | Jeder Endpoint hat individuelle Timeouts |
| Kein unendliches Warten | Timeouts werden strikt durchgesetzt |
| Kein Hanging Risk | Bei Timeout wird der Request abgebrochen |

**Timeout‑Matrix:**

```yaml
# timeout-matrix.yaml
apiVersion: cargobit.io/v1
kind: TimeoutMatrix
metadata:
  name: api-proxy-timeout-matrix
spec:
  defaults:
    connection: 5s
    read: 30s
    write: 10s
    total: 60s
    
  endpoints:
    - path: /v1/payments
      connection: 3s
      read: 15s
      total: 20s
      
    - path: /v1/partners/{id}
      connection: 2s
      read: 10s
      total: 15s
      
    - path: /v1/webhooks
      connection: 3s
      read: 60s
      total: 65s
      
  timeoutResponse:
    statusCode: 504
    error:
      error: "GATEWAY_TIMEOUT"
      message: "The upstream service did not respond in time"
```

**Audit‑Kriterium:**

> ✅ Timeout‑Matrix vorhanden. Bei Audit werden Test‑Requests mit künstlich verzögerten Upstreams durchgeführt.

---

### 3.2 Retry Control

Retries werden kontrolliert durchgeführt, um Thundering‑Herd‑Probleme zu vermeiden und die Systemstabilität zu gewährleisten.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Nur idempotente Methoden | Nur GET, PUT, DELETE dürfen retried werden |
| Exponentielles Backoff | Backoff zwischen Retries |
| Max Retry Count | Maximale Anzahl an Retries |

**Retry‑Policy:**

```yaml
# retry-policy.yaml
apiVersion: cargobit.io/v1
kind: RetryPolicy
metadata:
  name: api-proxy-retry-policy
spec:
  allowedMethods: [GET, PUT, DELETE]
  deniedMethods: [POST, PATCH]  # Unless idempotency-key present
  
  retryConfig:
    maxRetries: 3
    initialDelay: 100ms
    maxDelay: 5s
    backoffMultiplier: 2.0
    jitterPercent: 10
    
  retryableStatusCodes: [429, 500, 502, 503, 504]
  nonRetryableStatusCodes: [400, 401, 403, 404, 422]
  
  circuitBreakerTrigger:
    failureThreshold: 5
    failureWindow: 60s
```

**Audit‑Kriterium:**

> ✅ Retry‑Policy dokumentiert. Bei Audit werden Logs auf Retry‑Events geprüft.

---

### 3.3 Circuit Breaker

Der Circuit Breaker schützt die Core‑APIs und die Tools‑Infrastruktur vor Überlastung durch automatische Abschaltung bei Fehlerhäufung.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Automatische Abschaltung | Bei Fehlerhäufung wird der Endpoint deaktiviert |
| Schutz der Core‑APIs | Upstreams werden vor Überlastung geschützt |
| Automatische Wiederherstellung | Nach Cool‑Down wird der Endpoint reaktiviert |

**Circuit Breaker Config:**

```yaml
# circuit-breaker.yaml
apiVersion: cargobit.io/v1
kind: CircuitBreakerConfig
metadata:
  name: api-proxy-circuit-breaker
spec:
  failureThreshold: 5
  failureWindow: 60s
  successThreshold: 3
  successWindow: 30s
  
  states:
    CLOSED:
      description: "Normal operation"
      transitions: [OPEN]
      
    OPEN:
      description: "Circuit tripped, requests fail fast"
      transitionAfter: 30s
      transitions: [HALF_OPEN]
      
    HALF_OPEN:
      description: "Testing if service recovered"
      allowedRequests: 3
      transitions: [CLOSED, OPEN]
      
  openResponse:
    statusCode: 503
    error:
      error: "SERVICE_UNAVAILABLE"
      message: "The service is temporarily unavailable. Please retry later."
```

**Audit‑Kriterium:**

> ✅ Circuit‑Breaker‑Dashboard vorhanden. Bei Audit wird der Circuit Breaker manuell getriggert und die Response validiert.

---

### 3.4 Immutable ExecutionContext

Der ExecutionContext wird serverseitig erzeugt und ist unveränderbar. Dies verhindert Context‑Manipulation und Privilege Escalation.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Partner‑ID unveränderbar | Wird aus Token extrahiert, nicht übernommen |
| Environment unveränderbar | Wird aus Deployment‑Config bestimmt |
| Feature Flags unveränderbar | Werden serverseitig ausgewertet |

**ExecutionContext Definition:**

```typescript
// execution-context.ts
interface ExecutionContext {
  // Immutable after creation
  readonly partnerId: string;
  readonly environment: 'sandbox' | 'production';
  readonly requestId: string;
  readonly correlationId: string;
  readonly timestamp: Date;
  
  // Feature flags from server config
  readonly featureFlags: Readonly<FeatureFlags>;
  
  // Rate limiting state
  readonly rateLimit: Readonly<RateLimitState>;
  
  // Audit metadata
  readonly audit: Readonly<AuditMetadata>;
}

// Factory function - only way to create ExecutionContext
function createExecutionContext(
  token: ValidatedToken,
  deploymentConfig: DeploymentConfig
): ExecutionContext {
  return Object.freeze({
    partnerId: token.partnerId,
    environment: deploymentConfig.environment,
    requestId: generateUUID(),
    correlationId: generateUUID(),
    timestamp: new Date(),
    featureFlags: Object.freeze(deploymentConfig.featureFlags),
    rateLimit: Object.freeze(token.rateLimit),
    audit: Object.freeze({
      initiatedBy: token.subject,
      ipAddress: token.ipAddress,
      userAgent: token.userAgent
    })
  });
}
```

**Audit‑Kriterium:**

> ✅ ExecutionContext wird serverseitig erzeugt. Bei Audit wird verifiziert, dass client‑seitige Überschreibungsversuche ignoriert werden.

---

## 🧱 Domäne 4: Identity & Access Hardening

### Schutz vor Spoofing, Privilege Escalation, Kontextverlust

Die Identity & Access Hardening Domäne schützt die API Proxy Engine vor Identitätsdiebstahl, Rechteausweitung und Kontextverlust. Dies umfasst Token Validation, RBAC Enforcement und Zero‑Trust bei Client‑Daten.

---

### 4.1 Token Validation

Alle Requests müssen mit einem validen Token authentifiziert sein. Die Token‑Validierung umfasst Signatur, Ablaufdatum und Audience.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| JWT/OAuth2 | Nur OAuth2‑Tokens werden akzeptiert |
| Signature Validation | Token‑Signatur wird kryptografisch verifiziert |
| Expiry Check | Abgelaufene Tokens werden abgelehnt |
| Audience Check | Token muss für CargoBit ausgestellt sein |

**Token‑Validierungs-Pipeline:**

```yaml
# token-validation.yaml
apiVersion: cargobit.io/v1
kind: TokenValidationConfig
metadata:
  name: api-proxy-token-validation
spec:
  tokenType: JWT
  
  validationSteps:
    - name: structure
      description: "Validate JWT structure"
      onFailure: REJECT_401
      
    - name: signature
      description: "Verify cryptographic signature"
      onFailure: REJECT_401
      
    - name: expiry
      description: "Check not expired"
      onFailure: REJECT_401
      
    - name: audience
      description: "Check audience matches CargoBit"
      onFailure: REJECT_403
      
    - name: issuer
      description: "Check issuer is trusted"
      onFailure: REJECT_403
      
    - name: claims
      description: "Extract and validate claims"
      onFailure: REJECT_403
      
  requiredClaims:
    - sub
    - partner_id
    - environment
    - scope
    
  tokenCache:
    enabled: true
    ttl: 60s
    maxSize: 10000
```

**Audit‑Kriterium:**

> ✅ Token Validation Logs vorhanden. Bei Audit werden Test‑Requests mit manipulierten Tokens gesendet und Rejection verifiziert.

---

### 4.2 RBAC Enforcement

Role‑Based Access Control stellt sicher, dass Partner nur auf ihre eigenen Ressourcen zugreifen können und Sandbox/Production strikt getrennt sind.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Partner → eigene Ressourcen | Ein Partner kann nur auf seine eigenen Daten zugreifen |
| Sandbox/Prod getrennt | Kein Cross‑Environment Zugriff |
| Kein Cross‑Tenant Zugriff | Partner können nicht auf Daten anderer Partner zugreifen |

**RBAC‑Matrix:**

```yaml
# rbac-matrix.yaml
apiVersion: cargobit.io/v1
kind: RBACMatrix
metadata:
  name: api-proxy-rbac-matrix
spec:
  roles:
    - name: partner_readonly
      permissions:
        - resource: "/v1/partners/{partnerId}"
          action: READ
          condition: "partnerId == context.partnerId"
          
        - resource: "/v1/payments"
          action: READ
          condition: "filter.partnerId == context.partnerId"
          
    - name: partner_standard
      inherits: [partner_readonly]
      permissions:
        - resource: "/v1/payments"
          action: CREATE
          condition: "body.partnerId == context.partnerId"
          
    - name: partner_admin
      inherits: [partner_standard]
      permissions:
        - resource: "/v1/webhooks"
          action: [CREATE, UPDATE, DELETE]
          condition: "body.partnerId == context.partnerId"
          
  environmentIsolation:
    sandbox:
      allowedResources: ["*"]
      deniedResources: []
    production:
      allowedResources: ["*"]
      deniedResources: []
    crossEnvironment: DENY_ALL
```

**Audit‑Kriterium:**

> ✅ RBAC‑Matrix vorhanden. Bei Audit werden Cross‑Tenant‑Zugriffsversuche durchgeführt und Rejection verifiziert.

---

### 4.3 No Trust in Client‑Provided Data

Client‑seitige Daten werden niemals vertraut. Header, Idempotency Keys und Correlation‑IDs werden serverseitig generiert oder validiert.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Keine Header übernehmen | Client‑Header werden nicht blind übernommen |
| Keine Idempotency Keys übernehmen | Idempotency Keys werden serverseitig validiert |
| Keine Correlation‑IDs übernehmen | Correlation‑IDs werden serverseitig generiert |

**Zero‑Trust Implementation:**

```typescript
// zero-trust-middleware.ts
export function zeroTrustMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Generate all IDs server-side
  const serverContext = {
    requestId: generateUUID(),
    correlationId: generateUUID(),
    idempotencyKey: null
  };
  
  // If client provided idempotency key, validate format only
  if (req.headers['idempotency-key']) {
    const clientKey = req.headers['idempotency-key'];
    if (isValidUUID(clientKey)) {
      serverContext.idempotencyKey = clientKey;
    } else {
      // Reject invalid format, don't trust client value
      res.status(400).json({
        error: 'INVALID_IDEMPOTENCY_KEY',
        message: 'Idempotency key must be a valid UUID'
      });
      return;
    }
  }
  
  // Attach server-generated context
  req.context = serverContext;
  next();
}
```

**Audit‑Kriterium:**

> ✅ Sanitization Tests vorhanden. Bei Audit werden Requests mit manipulierten Client‑Werten gesendet und Verifikation durchgeführt.

---

## 🧱 Domäne 5: Observability & Audit Hardening

### Sicherstellen, dass alles nachvollziehbar, aber DSGVO‑konform ist

Die Observability & Audit Hardening Domäne stellt sicher, dass alle Operationen nachvollziehbar sind, während gleichzeitig die DSGVO‑Konformität gewährleistet wird.

---

### 5.1 Structured Logging

Alle Logs sind strukturiert (JSON), enthalten keine PII, keine Payloads und keine Secrets.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| JSON Logs | Alle Logs sind JSON‑formatiert |
| Keine PII | Persönliche Daten werden nicht geloggt |
| Keine Payloads | Request/Response Bodies werden nicht geloggt |
| Keine Secrets | Tokens, Passwörter, etc. werden nicht geloggt |

**Log‑Schema:**

```yaml
# log-schema.yaml
apiVersion: cargobit.io/v1
kind: LogSchema
metadata:
  name: api-proxy-log-schema
spec:
  format: JSON
  
  requiredFields:
    - name: timestamp
      type: string
      format: date-time
      
    - name: level
      type: string
      enum: [DEBUG, INFO, WARN, ERROR]
      
    - name: requestId
      type: string
      format: uuid
      
    - name: partnerId
      type: string
      
    - name: environment
      type: string
      enum: [sandbox, production]
      
  optionalFields:
    - name: duration
      type: number
      description: "Request duration in ms"
      
    - name: statusCode
      type: number
      
    - name: endpoint
      type: string
      
  forbiddenContent:
    - pattern: "[0-9]{13,19}"  # Credit card numbers
      description: "No card numbers"
      
    - pattern: "[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}"  # IBAN
      description: "No bank accounts"
      
    - pattern: "(password|token|secret|apiKey).*=.*"
      description: "No credentials"
```

**Audit‑Kriterium:**

> ✅ Log‑Schema dokumentiert. Bei Audit werden Log‑Samples auf PII/Secrets geprüft.

---

### 5.2 Correlation‑ID Enforcement

Correlation‑IDs werden serverseitig generiert, durchgängig weitergereicht und können nicht überschrieben werden.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Serverseitig generiert | Correlation‑ID wird von der Engine erstellt |
| Durchgängig weitergereicht | ID wird an alle Downstream‑Services weitergegeben |
| Nicht überschreibbar | Client‑seitige Correlation‑IDs werden ignoriert |

**Correlation‑ID Implementation:**

```typescript
// correlation-id-middleware.ts
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Always generate server-side
  const correlationId = generateUUID();
  
  // Attach to request context
  req.context.correlationId = correlationId;
  
  // Add to response headers
  res.setHeader('X-Correlation-Id', correlationId);
  
  // Add to all downstream requests
  req.downstreamHeaders = {
    ...req.downstreamHeaders,
    'X-Correlation-Id': correlationId
  };
  
  next();
}
```

**Audit‑Kriterium:**

> ✅ Correlation‑ID Coverage > 99%. Bei Audit wird eine Stichprobe von Requests durch das System verfolgt und die Correlation‑ID‑Konsistenz validiert.

---

### 5.3 Metrics & Tracing

Metriken und Traces erfassen Latenz, Error Rate, Retry Count und Circuit Breaker State.

**Metrik‑Definitionen:**

```yaml
# metrics.yaml
apiVersion: cargobit.io/v1
kind: MetricsConfig
metadata:
  name: api-proxy-metrics
spec:
  metrics:
    - name: request_duration_seconds
      type: histogram
      description: "Request duration in seconds"
      labels: [endpoint, method, status_code, environment]
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
      
    - name: request_total
      type: counter
      description: "Total number of requests"
      labels: [endpoint, method, status_code, environment]
      
    - name: error_total
      type: counter
      description: "Total number of errors"
      labels: [error_type, endpoint, environment]
      
    - name: retry_total
      type: counter
      description: "Total number of retries"
      labels: [endpoint, environment]
      
    - name: circuit_breaker_state
      type: gauge
      description: "Circuit breaker state (0=closed, 1=open, 2=half-open)"
      labels: [endpoint, environment]
      
  tracing:
    enabled: true
    sampler: probabilistic
    sampleRate: 0.1  # 10% of requests
    propagation: w3c
```

**Audit‑Kriterium:**

> ✅ Observability Dashboard vorhanden. Bei Audit werden Dashboard‑Verfügbarkeit und Metrik‑Konsistenz geprüft.

---

### 5.4 Audit Logs

Audit Logs erfassen jede Policy‑Entscheidung, jede Validation, jeden Block und jede Redaction. Sie sind unveränderbar (append‑only).

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Jede Policy‑Entscheidung | Access decisions werden geloggt |
| Jede Validation | Schema‑Validierungs‑Ergebnisse werden geloggt |
| Jeder Block | Blockierte Requests werden geloggt |
| Jede Redaction | Redacted Fields werden geloggt |

**Audit‑Log Schema:**

```yaml
# audit-log-schema.yaml
apiVersion: cargobit.io/v1
kind: AuditLogSchema
metadata:
  name: api-proxy-audit-log
spec:
  events:
    - name: POLICY_DECISION
      fields:
        - decision
        - policy
        - reason
        - partnerId
        
    - name: VALIDATION_RESULT
      fields:
        - result
        - schema
        - errors
        
    - name: REQUEST_BLOCKED
      fields:
        - reason
        - endpoint
        - method
        - clientIp
        
    - name: FIELD_REDACTED
      fields:
        - field
        - reason
        
  storage:
    type: append-only
    retention: 7 years  # Compliance requirement
    immutable: true
    encryption: AES-256-GCM
```

**Audit‑Kriterium:**

> ✅ Audit‑Trail unveränderbar (append‑only). Bei Audit wird die Unveränderbarkeit durch Schreibversuch verifiziert.

---

## 🧱 Domäne 6: Operational Hardening

### Sicherstellen, dass die Engine sicher betrieben wird

Die Operational Hardening Domäne stellt sicher, dass die API Proxy Engine sicher betrieben wird. Dies umfasst Zero‑Trust Deployment, Immutable Infrastructure, Secrets Management und Multi‑Region Isolation.

---

### 6.1 Zero‑Trust Deployment

Die API Proxy Engine ist vollständig isoliert und nur über den Request Router erreichbar.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Keine offenen Ports | Keine öffentlich erreichbaren Ports |
| Kein direkter Internet‑Zugriff | Nur über Request Router erreichbar |
| Nur Request Router darf zugreifen | Netzwerk‑Policy beschränkt Zugriff |

**Netzwerk‑Policy:**

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-proxy-engine-network-policy
  namespace: cargobit
spec:
  podSelector:
    matchLabels:
      app: api-proxy-engine
      
  policyTypes:
    - Ingress
    - Egress
    
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: request-router
      ports:
        - protocol: TCP
          port: 8080
          
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: ledger-service
        - podSelector:
            matchLabels:
              app: payment-orchestrator
        - podSelector:
            matchLabels:
              app: partner-service
      ports:
        - protocol: TCP
          port: 8080
          
    - to:
        - namespaceSelector:
            matchLabels:
              name: kube-system
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
```

---

### 6.2 Immutable Infrastructure

Alle Infrastruktur ist unveränderbar. Es gibt keine manuellen Änderungen, Deployments erfolgen über GitOps, und die Konfiguration ist versioniert.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Keine manuellen Änderungen | Alle Änderungen erfolgen über Code |
| Deployments → GitOps | Alle Deployments werden über ArgoCD durchgeführt |
| Config → versioniert | Alle Konfiguration ist in Git versioniert |

**GitOps‑Workflow:**

```yaml
# gitops-workflow.yaml
apiVersion: cargobit.io/v1
kind: GitOpsConfig
metadata:
  name: api-proxy-gitops
spec:
  repository: git@github.com:cargobit/infrastructure.git
  branch: main
  
  deployment:
    tool: argocd
    syncPolicy:
      automated:
        prune: true
        selfHeal: true
      syncOptions:
        - CreateNamespace=true
        
  configManagement:
    tool: kustomize
    overlays:
      - name: sandbox
        path: overlays/sandbox
      - name: production
        path: overlays/production
        
  changeManagement:
    requiredApprovals: 2
    approvalGroups:
      - security-team
      - sre-team
```

---

### 6.3 Secrets Management

Secrets werden niemals im Code oder in der Engine gespeichert. Alle Secrets kommen aus einem zentralen Secrets Manager.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Keine Secrets im Code | Secrets werden nie committed |
| Keine Secrets im Tools Service | Secrets werden nicht in der Anwendung gespeichert |
| Nur Vault/Key Management | Secrets kommen aus zentralem Secrets Manager |

**Secrets‑Konfiguration:**

```yaml
# secrets-config.yaml
apiVersion: cargobit.io/v1
kind: SecretsConfig
metadata:
  name: api-proxy-secrets
spec:
  provider: vault
  vaultAddress: https://vault.internal.cargobit.io
  
  secretPaths:
    - name: database-credentials
      path: secret/data/api-proxy/database
      refreshInterval: 1h
      
    - name: jwt-signing-key
      path: secret/data/api-proxy/jwt
      refreshInterval: 24h
      
  injection:
    method: sidecar
    template: |
      {{- with secret "{{.Path}}" -}}
      export {{.EnvVar}}={{.Data.data.value}}
      {{- end }}
      
  audit:
    enabled: true
    logAccess: true
    alertOnUnauthorizedAccess: true
```

---

### 6.4 Multi‑Region Isolation

Sandbox und Production sind strikt getrennt. Regionen sind isoliert und es gibt kein Cross‑Region Leakage.

**Regeln:**

| Regel | Beschreibung |
|-------|--------------|
| Sandbox/Prod getrennt | Keine gemeinsame Infrastruktur |
| Regionen getrennt | Keine Cross‑Region Kommunikation |
| Kein Cross‑Region Leakage | Daten bleiben in ihrer Region |

**Multi‑Region‑Konfiguration:**

```yaml
# multi-region-config.yaml
apiVersion: cargobit.io/v1
kind: MultiRegionConfig
metadata:
  name: api-proxy-multi-region
spec:
  regions:
    - name: eu-west-1
      environments:
        - sandbox
        - production
      isolation:
        network: dedicated-vpc
        database: dedicated-cluster
        secrets: dedicated-vault-namespace
        
    - name: eu-central-1
      environments:
        - production
      isolation:
        network: dedicated-vpc
        database: dedicated-cluster
        secrets: dedicated-vault-namespace
        
  crossRegionPolicy:
    dataTransfer: DENY
    failoverMode: MANUAL
    dataResidency:
      default: EU
      enforcement: STRICT
```

---

## 📊 Zusammenfassung: Die 10 wichtigsten Hardening‑Maßnahmen

| # | Maßnahme | Domäne | Priorität |
|---|----------|--------|-----------|
| 1 | Endpoint Allowlist | Boundary | KRITISCH |
| 2 | Mandatory Schema Validation | Input/Output | KRITISCH |
| 3 | Header Sanitization | Input/Output | HOCH |
| 4 | Response Redaction | Input/Output | HOCH |
| 5 | Error Normalization | Input/Output | MITTEL |
| 6 | Timeout Enforcement | Execution | KRITISCH |
| 7 | Retry Control | Execution | HOCH |
| 8 | Immutable ExecutionContext | Execution | KRITISCH |
| 9 | Structured Logging ohne PII | Observability | KRITISCH |
| 10 | Zero‑Trust Deployment | Operational | KRITISCH |

---

## 📈 Implementation Roadmap

### Phase 1: Foundation (Monat 1-2)
- [ ] Endpoint Allowlist implementieren
- [ ] Schema Validation Pipeline aufsetzen
- [ ] TLS‑Konfiguration härten
- [ ] Timeout‑Matrix definieren

### Phase 2: Core Security (Monat 3-4)
- [ ] Header Sanitization implementieren
- [ ] Response Redaction Rules definieren
- [ ] Token Validation Pipeline aufsetzen
- [ ] RBAC Matrix implementieren

### Phase 3: Operational Excellence (Monat 5-6)
- [ ] Circuit Breaker Dashboard
- [ ] Audit Log Pipeline
- [ ] GitOps Deployment Pipeline
- [ ] Multi‑Region Isolation

### Phase 4: Continuous Improvement (Laufend)
- [ ] Quartalsweise Security Reviews
- [ ] Penetration Tests
- [ ] Compliance Audits
- [ ] Incident Response Übungen

---

## 🔗 Verwandte Dokumente

| Dokument | Beschreibung |
|----------|--------------|
| [Block BD] C4 Level 4 — API Proxy Engine | Architektur‑Blueprint |
| [Block BE] STRIDE Threat Model | Bedrohungsanalyse |
| [Block AZ] Data Governance Framework | Data‑Handling‑Regeln |
| [Block BA] Compliance Framework | GDPR, SOC2, ISO27001 |

---

## 📝 Änderungshistorie

| Version | Datum | Autor | Änderung |
|---------|-------|-------|----------|
| 1.0.0 | 2025-01-15 | Security Team | Initiale Erstellung |

---

> **CargoBit** — Enterprise Payment Infrastructure
>
> Dieses Dokument ist Teil der CargoBit Multi-Agent System Dokumentation.
> © 2025 CargoBit GmbH. Alle Rechte vorbehalten.
