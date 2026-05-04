# Developer-Portal Security-Hardening-Guide

## Sicherheit auf Enterprise-Niveau — für Portal, Tools und Inhalte

Dieses Dokument definiert alle Sicherheitsmaßnahmen, Standards und Best Practices für das CargoBit Developer-Portal.

---

## 1. Sicherheitsziele

| Ziel | Beschreibung | Metrik |
|------|--------------|--------|
| Schutz vor Angriffen | Abwehr aller bekannten Angriffsvektoren | 0 erfolgreiche Angriffe |
| Schutz sensibler Daten | Keine Datenlecks | 0 Data Breaches |
| Schutz der Integrität | Keine unbefugten Änderungen | 0 Integrity Violations |
| Schutz der Partner | Sichere Entwicklungsumgebung | 100% Compliance |

---

## 2. Hardening-Bereiche

### 2.1 Frontend Security

#### 2.1.1 Content Security Policy (CSP)

**Konfiguration:**
```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'sha256-abc123...' https://cdn.cargobit.io;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.cargobit.io https://sandbox.cargobit.io;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

**Policy-Erklärung:**

| Directive | Wert | Begründung |
|-----------|------|------------|
| default-src | 'self' | Nur eigene Ressourcen |
| script-src | 'self' + hashes | Keine inline scripts |
| style-src | 'self' + inline | Für styled-components |
| img-src | 'self' + data + https | Bilder aus erlaubten Quellen |
| frame-ancestors | 'none' | Clickjacking-Schutz |
| upgrade-insecure-requests | - | HTTPS erzwingen |

#### 2.1.2 XSS-Schutz

**Präventionsmaßnahmen:**

1. **Output Encoding:**
```javascript
// React automatic escaping (default)
<div>{userInput}</div>

// Für HTML-Inhalte: DOMPurify
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ 
  __html: DOMPurify.sanitize(userInput) 
}} />
```

2. **Input Validation:**
```javascript
// Zod Schema für User Input
const SearchSchema = z.object({
  query: z.string().max(100).regex(/^[\w\s-]+$/),
  filters: z.array(z.enum(['api', 'guides', 'tools']))
});

function validateInput(input) {
  return SearchSchema.parse(input);
}
```

3. **Context-Aware Encoding:**
```javascript
// URL Context
const safeUrl = encodeURIComponent(userInput);

// HTML Attribute Context
const safeAttr = escapeHtml(userInput);

// JavaScript Context
const safeJs = JSON.stringify(userInput);
```

#### 2.1.3 CSRF-Schutz

**Implementation:**
```javascript
// CSRF Token Generation
function generateCsrfToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// CSRF Token Validation
function validateCsrfToken(req) {
  const tokenFromCookie = req.cookies.csrf_token;
  const tokenFromHeader = req.headers['x-csrf-token'];
  
  if (!tokenFromCookie || !tokenFromHeader) {
    throw new Error('CSRF token missing');
  }
  
  if (tokenFromCookie !== tokenFromHeader) {
    throw new Error('CSRF token mismatch');
  }
}
```

**Cookie-Einstellungen:**
```http
Set-Cookie: csrf_token=abc123; 
  HttpOnly; 
  SameSite=Strict; 
  Secure; 
  Path=/;
  Max-Age=3600
```

#### 2.1.4 No Inline Scripts

**Regel:** Keine inline scripts oder event handlers

**Verboten:**
```html
<!-- NICHT ERLAUBT -->
<script>alert('test');</script>
<button onclick="doSomething()">Click</button>
<a href="javascript:void(0)">Link</a>
```

**Erlaubt:**
```html
<!-- ERLAUBT -->
<script src="/js/app.js" integrity="sha256-abc123"></script>
<button id="myButton">Click</button>
<script>
  document.getElementById('myButton').addEventListener('click', doSomething);
</script>
```

#### 2.1.5 Strict MIME Types

**Konfiguration:**
```http
X-Content-Type-Options: nosniff
```

**Server-Konfiguration (Nginx):**
```nginx
types {
    text/html                             html htm;
    text/css                              css;
    application/javascript                js;
    application/json                      json;
    image/png                             png;
    image/svg+xml                         svg;
}

# Reject unknown types
location ~* \.(?:exe|dll|bat|cmd|com|pif|scr|vbs|js)$ {
    add_header Content-Type "application/octet-stream";
    add_header Content-Disposition "attachment";
}
```

---

### 2.2 API Explorer Security

#### 2.2.1 Sandbox-Isolation

**Architektur:**
```
┌─────────────────────────────────────────────────────────┐
│                    Developer Portal                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │              API Explorer UI                     │   │
│  └─────────────────────┬───────────────────────────┘   │
│                        │                                │
│                        ▼                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Sandbox Gateway (Rate Limited)         │   │
│  │  - Input Sanitization                            │   │
│  │  - Request Validation                            │   │
│  │  - No Production Access                          │   │
│  └─────────────────────┬───────────────────────────┘   │
│                        │                                │
└────────────────────────┼────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                 Sandbox Environment                      │
│  - Isolierte Datenbank                                  │
│  - Gesischtete Testdaten                                │
│  - Keine echten Transaktionen                           │
└─────────────────────────────────────────────────────────┘
```

**Sandbox-Regeln:**

| Regel | Enforcement |
|-------|-------------|
| Kein Zugriff auf Produktionsdaten | Network Isolation |
| Keine echten API Keys | Sandbox-Only Keys |
| Beschränkte Funktionalität | Feature Flags |
| Daten werden nach 24h gelöscht | Automated Cleanup |

#### 2.2.2 Rate Limiting

**Implementation:**
```javascript
// Rate Limit Configuration
const rateLimits = {
  anonymous: {
    windowMs: 15 * 60 * 1000,  // 15 Minuten
    max: 50,                    // 50 Requests pro Fenster
    message: 'Too many requests, please try again later'
  },
  
  authenticated: {
    windowMs: 15 * 60 * 1000,
    max: 200,
  },
  
  apiExplorer: {
    windowMs: 60 * 1000,         // 1 Minute
    max: 20,
    keyGenerator: (req) => req.user?.id || req.ip
  }
};

// Express Rate Limit
import rateLimit from 'express-rate-limit';

const apiExplorerLimiter = rateLimit(rateLimits.apiExplorer);
app.use('/api-explorer/*', apiExplorerLimiter);
```

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1705312800
```

#### 2.2.3 Input Sanitization

**Schema Validation:**
```javascript
// API Explorer Request Schema
const ApiRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  endpoint: z.string().regex(/^\/v[0-9]\/[a-z0-9\-\/{}]+$/),
  headers: z.record(z.string().max(100)).optional(),
  body: z.any().optional(),
  queryParams: z.record(z.string().max(500)).optional()
});

// Sanitize and Validate
function sanitizeApiExplorerRequest(req) {
  // 1. Validate against schema
  const validated = ApiRequestSchema.parse(req.body);
  
  // 2. Remove dangerous headers
  delete validated.headers?.['authorization'];
  delete validated.headers?.['x-api-key'];
  
  // 3. Sanitize body
  if (validated.body) {
    validated.body = sanitizeObject(validated.body);
  }
  
  return validated;
}
```

---

### 2.3 Webhook Simulator Security

#### 2.3.1 Keine Speicherung sensibler Payloads

**Regel:** Webhook-Payloads werden nicht persistent gespeichert

**Implementation:**
```javascript
// In-Memory Storage mit TTL
const webhookCache = new Map();

function storeWebhookTemporarily(webhookId, payload) {
  webhookCache.set(webhookId, {
    payload: anonymizePayload(payload),
    timestamp: Date.now()
  });
  
  // Auto-delete nach 5 Minuten
  setTimeout(() => {
    webhookCache.delete(webhookId);
  }, 5 * 60 * 1000);
}
```

#### 2.3.2 Payload Anonymisierung

**Anonymisierungs-Regeln:**
```javascript
function anonymizePayload(payload) {
  const sensitiveFields = [
    'email', 'phone', 'name', 'address',
    'card_number', 'cvv', 'iban', 'bic',
    'ssn', 'tax_id', 'account_number'
  ];
  
  const anonymized = JSON.parse(JSON.stringify(payload));
  
  function redact(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        redact(obj[key]);
      } else if (sensitiveFields.includes(key.toLowerCase())) {
        obj[key] = '[REDACTED]';
      }
    }
  }
  
  redact(anonymized);
  return anonymized;
}
```

#### 2.3.3 Replay-Schutz

**Implementation:**
```javascript
// Webhook Replay Protection
const replayProtection = new Map();

function checkReplay(webhookId, timestamp, signature) {
  const key = `${webhookId}:${timestamp}`;
  
  // Prüfe ob bereits verarbeitet
  if (replayProtection.has(key)) {
    throw new Error('Replay detected: webhook already processed');
  }
  
  // Prüfe Timestamp (max 5 Minuten alt)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    throw new Error('Webhook timestamp expired');
  }
  
  // Markiere als verarbeitet
  replayProtection.set(key, true);
  setTimeout(() => replayProtection.delete(key), 5 * 60 * 1000);
  
  return true;
}
```

---

### 2.4 Authentication

#### 2.4.1 OAuth2 / JWT

**JWT Konfiguration:**
```javascript
// JWT Token Configuration
const jwtConfig = {
  algorithm: 'RS256',           // RSA Signature
  accessTokenExpiry: '15m',     // Kurze Lebensdauer
  refreshTokenExpiry: '7d',
  issuer: 'developer.cargobit.io',
  audience: 'api.cargobit.io'
};

// Token Generation
function generateAccessToken(user) {
  return jwt.sign(
    { 
      sub: user.id, 
      email: user.email,
      role: user.role,
      permissions: user.permissions
    },
    privateKey,
    {
      algorithm: jwtConfig.algorithm,
      expiresIn: jwtConfig.accessTokenExpiry,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      jwtid: crypto.randomUUID()
    }
  );
}
```

**Token Validation:**
```javascript
function validateAccessToken(token) {
  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: [jwtConfig.algorithm],
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    });
    
    // Prüfe Token Revocation
    if (isTokenRevoked(decoded.jti)) {
      throw new Error('Token revoked');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}
```

#### 2.4.2 API Key Encryption

**Storage:**
```javascript
// API Key wird NIE im Klartext gespeichert
import { hash, compare } from 'bcrypt';

async function storeApiKey(userId, apiKey) {
  // Generiere Key Prefix für Identifikation
  const prefix = apiKey.substring(0, 8);
  
  // Hash den gesamten Key
  const hashedKey = await hash(apiKey, 12);
  
  await db.apiKeys.create({
    userId,
    keyPrefix: prefix,
    keyHash: hashedKey,
    createdAt: new Date()
  });
}

async function validateApiKey(providedKey) {
  const prefix = providedKey.substring(0, 8);
  const storedKey = await db.apiKeys.findByPrefix(prefix);
  
  if (!storedKey) {
    return false;
  }
  
  return compare(providedKey, storedKey.keyHash);
}
```

#### 2.4.3 Session Hardening

**Session Configuration:**
```javascript
const sessionConfig = {
  name: 'cargobit_session',      // Nicht 'connect.sid'
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,                // HTTPS only
    sameSite: 'strict',          // CSRF protection
    maxAge: 15 * 60 * 1000,      // 15 Minuten
    domain: '.cargobit.io',
    path: '/'
  },
  
  // Session Store (Redis)
  store: new RedisStore({
    client: redisClient,
    prefix: 'sess:',
    ttl: 15 * 60  // 15 Minuten
  })
};
```

**Session Regeneration:**
```javascript
// Bei Login: Neue Session
app.post('/login', async (req, res) => {
  const user = await authenticateUser(req.body);
  
  if (user) {
    // Alte Session invalidieren
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      
      // Neue Session-Daten
      req.session.userId = user.id;
      req.session.createdAt = Date.now();
      
      res.json({ success: true });
    });
  }
});
```

---

### 2.5 Infrastructure

#### 2.5.1 HTTPS Enforced

**Nginx Configuration:**
```nginx
# Redirect all HTTP to HTTPS
server {
    listen 80;
    server_name developer.cargobit.io;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name developer.cargobit.io;
    
    ssl_certificate /etc/letsencrypt/live/cargobit.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cargobit.io/privkey.pem;
    
    # TLS 1.3 only
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
}
```

#### 2.5.2 HSTS

**Header Configuration:**
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Nginx:**
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

#### 2.5.3 WAF (Web Application Firewall)

**WAF Rules:**
```yaml
waf_rules:
  # SQL Injection
  - id: 1001
    name: "SQL Injection Block"
    pattern: "(?i)(union.*select|select.*from|insert.*into|delete.*from)"
    action: block
    
  # XSS
  - id: 1002
    name: "XSS Block"
    pattern: "(?i)(<script|javascript:|onerror=|onload=)"
    action: block
    
  # Path Traversal
  - id: 1003
    name: "Path Traversal Block"
    pattern: "\.\.\/|\.\.\\"
    action: block
    
  # Command Injection
  - id: 1004
    name: "Command Injection Block"
    pattern: "(;|\\||&|`|\\$\\(|\\$\\{)"
    action: block
```

#### 2.5.4 DDoS Protection

**Rate Limiting Layers:**

| Layer | Scope | Limit |
|-------|-------|-------|
| CDN | Global | 10,000 req/s |
| Load Balancer | Per IP | 100 req/s |
| Application | Per Endpoint | Varies |
| Database | Per Query | 1000 req/s |

**Implementation:**
```yaml
# Cloudflare / CDN Configuration
ddos_protection:
  mode: "under_attack"
  challenge_ttl: 300
  
  rate_limiting:
    - path: "/api/*"
      threshold: 100
      period: 60
      action: "challenge"
      
    - path: "/auth/*"
      threshold: 10
      period: 60
      action: "block"
```

---

## 3. Security Testing

### 3.1 Penetration Tests

**Scope:**
```yaml
penetration_test:
  scope:
    - "developer.cargobit.io"
    - "api.cargobit.io"
    - "sandbox.cargobit.io"
    
  exclusions:
    - "production databases"
    - "third-party services"
    
  methodology:
    - "OWASP Top 10"
    - "OWASP ASVS Level 2"
    
  frequency: "quarterly"
```

### 3.2 Static Code Analysis

**Tools:**
```yaml
sast_tools:
  - name: "SonarQube"
    scope: "all code"
    rules: "owasp-top10, security-hotspots"
    
  - name: "ESLint Security"
    plugins:
      - "eslint-plugin-security"
      - "eslint-plugin-no-secrets"
      
  - name: "Snyk Code"
    scope: "all repositories"
```

**ESLint Security Config:**
```javascript
// .eslintrc.js
module.exports = {
  plugins: ['security', 'no-secrets'],
  extends: ['plugin:security/recommended'],
  rules: {
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-object-injection': 'warn',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-unsafe-regex': 'error',
    'no-secrets/no-secrets': 'error'
  }
};
```

### 3.3 Dependency Scanning

**Automated Scanning:**
```yaml
# Snyk Configuration
snyk:
  monitor:
    - package.json
    - package-lock.json
    
  threshold: "high"
  
  ignore:
    - "CVE-2024-12345":
        reason: "Not affected by this vulnerability"
        expires: "2025-06-01"
```

**Dependabot:**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "security"
      - "dependencies"
```

### 3.4 Secret Scanning

**GitLeaks Configuration:**
```yaml
# .gitleaks.toml
title = "CargoBit Secret Scanning"

[[rules]]
id = "api-key"
description = "API Key"
regex = '''(?i)(api[_-]?key|apikey)\s*[=:]\s*['"]?[a-zA-Z0-9]{32,}'''
tags = ["key", "api"]

[[rules]]
id = "secret"
description = "Generic Secret"
regex = '''(?i)(secret|password|passwd|pwd)\s*[=:]\s*['"]?[^\s'"{}]+'''
tags = ["secret"]

[allowlist]
paths = [
  '''\.env\.example$''',
  '''test/fixtures/.*'''
]
```

**Pre-commit Hook:**
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Run GitLeaks
gitleaks protect --staged --config .gitleaks.toml
if [ $? -ne 0 ]; then
  echo "Secrets detected! Commit blocked."
  exit 1
fi
```

### 3.5 Threat Modeling

**STRIDE Analysis:**

| Threat | Example | Mitigation |
|--------|---------|------------|
| **S**poofing | Fake API requests | OAuth2, API Key validation |
| **T**ampering | Modified payloads | Input validation, HMAC |
| **R**epudiation | Denying actions | Audit logs, signed requests |
| **I**nformation Disclosure | Data leaks | Encryption, access controls |
| **D**enial of Service | Overwhelming requests | Rate limiting, WAF |
| **E**levation of Privilege | Unauthorized access | RBAC, least privilege |

---

## 4. Security Headers

### 4.1 Vollständige Header-Konfiguration

```http
# Security Headers
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-...'; ...
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

### 4.2 Header Testing

```javascript
// Automated header check
async function checkSecurityHeaders(url) {
  const response = await fetch(url);
  const headers = response.headers;
  
  const requiredHeaders = {
    'content-security-policy': true,
    'strict-transport-security': true,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'x-xss-protection': '1; mode=block',
    'referrer-policy': 'strict-origin-when-cross-origin'
  };
  
  for (const [header, expected] of Object.entries(requiredHeaders)) {
    const actual = headers.get(header);
    if (expected === true) {
      assert(actual !== null, `Missing header: ${header}`);
    } else {
      assert(actual === expected, `Invalid ${header}: ${actual}`);
    }
  }
}
```

---

## 5. Incident Response

### 5.1 Security Incident Classification

| Severity | Beschreibung | Response Time |
|----------|--------------|---------------|
| Critical | Aktiver Angriff, Datenleck | 15 Minuten |
| High | Verwundbarkeit exploited | 1 Stunde |
| Medium | Verwundbarkeit identifiziert | 24 Stunden |
| Low | Potenzielles Risiko | 1 Woche |

### 5.2 Incident Response Plan

```
1. IDENTIFY
   ├── Monitoring Alert
   ├── User Report
   └── External Report

2. CONTAIN
   ├── Isolate affected systems
   ├── Block attack vectors
   └── Preserve evidence

3. ERADICATE
   ├── Remove malware/vulnerability
   ├── Apply patches
   └── Update configurations

4. RECOVER
   ├── Restore services
   ├── Monitor for recurrence
   └── Update defenses

5. LESSONS LEARNED
   ├── Post-mortem
   ├── Update runbooks
   └── Improve detection
```

---

## 6. Compliance

### 6.1 Sicherheitsstandards

| Standard | Status | Letztes Audit |
|----------|--------|---------------|
| OWASP Top 10 | ✅ Compliant | Q4 2024 |
| SOC 2 Type II | ✅ Certified | Q3 2024 |
| ISO 27001 | ✅ Certified | Q2 2024 |
| PCI DSS | ✅ Compliant | Q4 2024 |
| GDPR | ✅ Compliant | Ongoing |

### 6.2 Audit Trail

**Erfasste Events:**
- Authentication events (login, logout, failed attempts)
- Authorization decisions
- Data access and modifications
- Configuration changes
- Administrative actions

```javascript
// Audit Log Format
{
  "timestamp": "2025-01-15T10:30:00Z",
  "event_type": "authentication.login",
  "actor": {
    "type": "user",
    "id": "usr_abc123",
    "ip": "192.168.1.100"
  },
  "resource": {
    "type": "api_key",
    "id": "key_xyz789"
  },
  "action": "create",
  "result": "success",
  "metadata": {
    "user_agent": "Mozilla/5.0...",
    "session_id": "sess_def456"
  }
}
```

---

## 7. Security Training

### 7.1 Pflichtschulungen

| Training | Zielgruppe | Frequenz |
|----------|------------|----------|
| Secure Coding | Alle Entwickler | Jährlich |
| OWASP Top 10 | Alle Entwickler | Jährlich |
| Security Awareness | Alle Mitarbeiter | Halbjährlich |
| Incident Response | Security Team | Quartalsweise |

### 7.2 Security Champions

**Rolle:**
- Anlaufpunkt für Security-Fragen im Team
- Review von Security-relevanten PRs
- Promotion von Security Best Practices

---

*Dieser Security-Hardening-Guide wird quartalsweise überprüft und aktualisiert. Letzte Überprüfung: Januar 2025.*
