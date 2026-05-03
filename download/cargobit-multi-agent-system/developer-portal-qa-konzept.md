# Developer-Portal QA-Konzept

## Qualitätssicherung für Inhalte, Tools, UI und Developer Experience

Dieses Dokument definiert alle QA-Maßnahmen, Prozesse und Standards für das CargoBit Developer-Portal.

---

## 1. QA-Ziele

| Ziel | Metrik | Zielwert |
|------|--------|----------|
| Fehlerfreie Dokumentation | Content Error Rate | < 0.1% |
| Konsistente UI | Visual Regression | 0 Failures |
| Funktionierende Tools | Tool Uptime | > 99.9% |
| Hohe Developer Experience | Developer Satisfaction | > 4.5/5 |
| Accessibility | WCAG 2.1 AA Score | 100% |
| Performance | Lighthouse Score | > 90 |

---

## 2. QA-Bereiche

### 2.1 Content QA

#### 2.1.1 Broken Links

**Automatisierte Prüfungen:**
- Täglich: Alle externen Links
- Bei jedem Build: Alle internen Links
- Weekly: Anchor-Links

**Link-Checker Konfiguration:**
```yaml
linkchecker:
  internal:
    enabled: true
    schedule: "on-build"
    fail-on-error: true
    
  external:
    enabled: true
    schedule: "0 6 * * *"  # Täglich 6:00 UTC
    timeout: 30s
    retry: 3
    ignore:
      - "linkedin.com/*"  # Rate Limited
      - "example.com/*"   # Dummy Domains
```

#### 2.1.2 Syntax-Highlighting

**Unterstützte Sprachen:**
- JSON
- JavaScript/TypeScript
- Python
- cURL
- Go
- Java
- Ruby
- PHP

**Validierung:**
```javascript
// Syntax-Highlighter Test
const codeBlocks = document.querySelectorAll('pre code');
codeBlocks.forEach(block => {
  const language = block.className.replace('language-', '');
  assert(supportedLanguages.includes(language));
  assert(block.innerHTML.includes('hljs-'));  // Highlighting applied
});
```

#### 2.1.3 Code-Beispiele ausführbar

**Automatisierte Tests:**
```yaml
code-example-tests:
  api-examples:
    - endpoint: "/v2/payments"
      method: "POST"
      expected_status: 200
      
  sdk-examples:
    - language: "javascript"
      file: "examples/payment-create.js"
      run: "node"
      expected_output: "Payment created"
      
    - language: "python"
      file: "examples/payment-create.py"
      run: "python"
      expected_output: "Payment created"
```

#### 2.1.4 API-Beispiele korrekt

**Validierungsprozess:**
1. JSON Schema Validierung für Request-Body
2. Response-Format Validierung
3. Header-Validierung
4. Authentication-Header Check

```javascript
// API Example Validator
function validateApiExample(example) {
  // 1. Check endpoint format
  assert(example.endpoint.match(/^\/v[0-9]\/[a-z-]+$/));
  
  // 2. Validate method
  assert(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(example.method));
  
  // 3. Check request body against schema
  const schema = loadSchema(example.endpoint, example.method);
  assert(validateJson(example.requestBody, schema));
  
  // 4. Execute against sandbox
  const response = await sandboxRequest(example);
  assert(response.status === example.expectedStatus);
}
```

#### 2.1.5 Glossar-Konsistenz

**Prüfungen:**
- Alle Begriffe definiert
- Konsistente Schreibweise
- Einheitliche Übersetzungen

```yaml
glossary-check:
  terms:
    - term: "Webhook"
      allowed_variants: ["Webhook", "Webhooks"]
      forbidden_variants: ["web hook", "Web-Hook"]
      
    - term: "API Key"
      allowed_variants: ["API Key", "API-Schlüssel"]
      forbidden_variants: ["apikey", "api-key"]
```

---

### 2.2 UI QA

#### 2.2.1 Responsive Layout

**Breakpoints:**
```css
/* Mobile First */
@media (min-width: 640px)  { /* sm */ }
@media (min-width: 768px)  { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

**Visuelle Tests:**
```yaml
visual-regression:
  viewports:
    - name: "mobile"
      width: 375
      height: 667
      
    - name: "tablet"
      width: 768
      height: 1024
      
    - name: "desktop"
      width: 1920
      height: 1080
      
  pages:
    - "/docs/getting-started"
    - "/api-reference/overview"
    - "/tools/api-explorer"
    - "/tools/webhook-simulator"
```

#### 2.2.2 Dark Mode

**Prüfpunkte:**
- [ ] Alle Texte lesbar
- [ ] Kontrastverhältnis WCAG-konform
- [ ] Bilder/Icons sichtbar
- [ ] Code-Blöcke korrekt
- [ ] Tabellen lesbar

**Kontrast-Anforderungen:**
| Element | Mindestkontrast |
|---------|-----------------|
| Normaler Text | 4.5:1 |
| Großer Text (18px+) | 3:1 |
| UI-Komponenten | 3:1 |
| Icons | 3:1 |

#### 2.2.3 Accessibility

**Automatisierte Tests:**
```yaml
accessibility-tests:
  tools:
    - axe-core
    - WAVE
    - Lighthouse
    
  rules:
    wcag_level: "AA"
    
  checks:
    - "aria-labels"
    - "alt-text"
    - "keyboard-navigation"
    - "focus-management"
    - "color-contrast"
    - "heading-hierarchy"
```

**Manuelle Tests:**
- Screen Reader Test (NVDA, VoiceOver)
- Keyboard-Only Navigation
- Zoom auf 200%

#### 2.2.4 Navigation funktioniert

**Test-Szenarien:**
```yaml
navigation-tests:
  scenarios:
    - name: "Main Navigation"
      steps:
        - click: "[data-testid=nav-api-reference]"
        - assert: "url includes /api-reference"
        
    - name: "Breadcrumb Navigation"
      steps:
        - navigate: "/api-reference/payments/create"
        - click: ".breadcrumb-item:nth-child(2)"
        - assert: "url is /api-reference/payments"
        
    - name: "Search Navigation"
      steps:
        - click: "[data-testid=search-button]"
        - type: "webhook"
        - click: ".search-result:first-child"
        - assert: "url includes webhook"
```

---

### 2.3 Tool QA

#### 2.3.1 API Explorer

**Test-Fälle:**
```yaml
api-explorer-tests:
  authentication:
    - name: "Valid API Key"
      api_key: "test_sk_valid"
      expected: "authenticated"
      
    - name: "Invalid API Key"
      api_key: "invalid_key"
      expected: "401 Unauthorized"
      
  requests:
    - name: "Create Payment"
      method: "POST"
      endpoint: "/v2/payments"
      body:
        amount: 1000
        currency: "EUR"
      expected_status: 201
      
    - name: "Get Payment"
      method: "GET"
      endpoint: "/v2/payments/{payment_id}"
      expected_status: 200
      
  error-handling:
    - name: "Rate Limit"
      simulate: "rate-limit"
      expected: "429 with retry-after header"
```

#### 2.3.2 Webhook Simulator

**Test-Fälle:**
```yaml
webhook-simulator-tests:
  delivery:
    - name: "Successful Delivery"
      payload: "payment.created"
      response_code: 200
      expected: "marked as delivered"
      
    - name: "Failed Delivery"
      payload: "payment.created"
      response_code: 500
      expected: "retry scheduled"
      
  replay:
    - name: "Event Replay"
      event_id: "evt_test123"
      expected: "same payload delivered"
      
  signature:
    - name: "Signature Verification"
      payload: "test payload"
      secret: "whsec_test"
      expected: "valid signature generated"
```

#### 2.3.3 Event Replay

**Test-Fälle:**
```yaml
event-replay-tests:
  - name: "Replay Single Event"
    event_id: "evt_123"
    expected: "event delivered to endpoint"
    
  - name: "Replay Event Range"
    from: "2025-01-01T00:00:00Z"
    to: "2025-01-02T00:00:00Z"
    expected: "all events in range delivered"
    
  - name: "Replay with Transformation"
    event_id: "evt_123"
    transformation:
      add_field: "test: true"
    expected: "transformed event delivered"
```

#### 2.3.4 Schema Viewer

**Test-Fälle:**
```yaml
schema-viewer-tests:
  - name: "Load JSON Schema"
    schema_url: "/schemas/payment.json"
    expected: "schema rendered correctly"
    
  - name: "Property Search"
    search: "amount"
    expected: "highlighted in schema"
    
  - name: "Schema Validation"
    schema: "payment"
    data:
      amount: 1000
      currency: "EUR"
    expected: "validation passed"
```

#### 2.3.5 Determinism Checker

**Test-Fälle:**
```yaml
determinism-checker-tests:
  - name: "Deterministic Response"
    request:
      endpoint: "/v2/payments"
      seed: "test-seed-123"
    iterations: 100
    expected: "all responses identical"
    
  - name: "Non-Deterministic Response"
    request:
      endpoint: "/v2/payments"
      seed: null
    iterations: 100
    expected: "responses vary"
```

---

### 2.4 Performance QA

#### 2.4.1 Lighthouse Score

**Zielwerte:**
| Metrik | Ziel | Schwellenwert |
|--------|------|---------------|
| Performance | > 90 | > 80 |
| Accessibility | 100 | > 95 |
| Best Practices | 100 | > 95 |
| SEO | 100 | > 95 |

**CI Integration:**
```yaml
lighthouse-ci:
  urls:
    - "https://developer.cargobit.io/"
    - "https://developer.cargobit.io/docs"
    - "https://developer.cargobit.io/api-reference"
    
  assertions:
    assertions:
      "categories:performance": ["error", {"minScore": 0.9}]
      "categories:accessibility": ["error", {"minScore": 1.0}]
      "categories:best-practices": ["error", {"minScore": 1.0}]
      "categories:seo": ["error", {"minScore": 1.0}]
```

#### 2.4.2 Page Load Times

**Budgets:**
| Seite | Budget | Warnung |
|-------|--------|---------|
| Homepage | < 2s | < 3s |
| Docs Page | < 1.5s | < 2s |
| API Explorer | < 2.5s | < 4s |
| Search Results | < 1s | < 1.5s |

**Monitoring:**
```javascript
// Performance Observer
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 2000) {
      reportSlowPage(entry);
    }
  }
});
observer.observe({ entryTypes: ['navigation', 'resource'] });
```

#### 2.4.3 Search Performance

**Metriken:**
| Metrik | Ziel |
|--------|------|
| Indexierung | < 1s pro 1000 Dokumente |
| Suchanfrage | < 100ms p95 |
| Autocomplete | < 50ms p95 |

---

## 3. QA-Prozesse

### 3.1 Pre-Release QA

**Checkliste:**
```yaml
pre-release-qa:
  content:
    - [ ] Alle neuen Inhalte reviewed
    - [ ] Broken Links geprüft
    - [ ] Code-Beispiele getestet
    - [ ] Übersetzungen vollständig
    
  ui:
    - [ ] Visual Regression bestanden
    - [ ] Accessibility Tests bestanden
    - [ ] Cross-Browser Tests bestanden
    - [ ] Dark Mode geprüft
    
  tools:
    - [ ] API Explorer funktional
    - [ ] Webhook Simulator funktional
    - [ ] Alle Tools gegen Sandbox getestet
    
  performance:
    - [ ] Lighthouse Score > 90
    - [ ] Load Tests bestanden
    - [ ] Core Web Vitals grün
```

**Dauer:** 2-3 Tage vor Release

### 3.2 Weekly QA

**Automatisierte Reports:**
```yaml
weekly-qa-report:
  sections:
    - name: "Broken Links"
      query: "broken_links_count > 0"
      group_by: "page"
      
    - name: "Search Analytics"
      metrics:
        - "searches_with_no_results"
        - "avg_search_time"
        - "top_searches"
        
    - name: "Error Logs"
      query: "level = 'error'"
      group_by: "page"
      
    - name: "Content Freshness"
      query: "last_updated > 90 days ago"
```

**Review-Meeting:** Jeden Montag, 30 Min.

### 3.3 Monthly QA

**Full Regression Test:**
```yaml
monthly-regression:
  duration: "1 day"
  
  scope:
    - "All pages"
    - "All tools"
    - "All code examples"
    - "All translations"
    
  tests:
    - "Full accessibility audit"
    - "Full visual regression"
    - "Full performance audit"
    - "Security scan"
    - "Load testing"
```

---

## 4. QA-Tools

### 4.1 Link Checker

**Tool:** lychee (Rust-basiert, schnell)

```bash
# Configuration
lychee --config .lychee.toml docs/

# .lychee.toml
[config]
timeout = 30
retry-wait-time = 5
max-retries = 3
exclude = [
  "linkedin.com",
  "example.com"
]
```

### 4.2 Markdown Linter

**Tool:** markdownlint-cli

```yaml
# .markdownlint.json
{
  "default": true,
  "MD013": { "line_length": 120 },
  "MD033": false,  # Allow inline HTML
  "MD041": false   # First line heading optional
}
```

### 4.3 Lighthouse CI

```bash
# Run Lighthouse CI
lighthouse-ci --config=lighthouserc.json

# lighthouserc.json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.9}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### 4.4 Axe Accessibility Scanner

```javascript
// Automated accessibility tests
const { AxePuppeteer } = require('@axe-core/puppeteer');

async function runAccessibilityTest(page) {
  const results = await new AxePuppeteer(page)
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
    
  if (results.violations.length > 0) {
    throw new Error(`Accessibility violations: ${results.violations.length}`);
  }
}
```

### 4.5 API Mock Server

**Tool:** Prism (Stoplight)

```yaml
# Mock Server Configuration
prism:
  spec: "./openapi.yaml"
  validation: true
  errors: true
  
  dynamic:
    enabled: true
    seed: "deterministic-test-seed"
```

---

## 5. Bug-Tracking

### 5.1 Bug-Klassifikation

| Severity | Beschreibung | SLA |
|----------|--------------|-----|
| Critical | Portal nicht nutzbar, Datenverlust | 1 Stunde |
| High | Wichtige Features nicht nutzbar | 4 Stunden |
| Medium | Eingeschränkte Funktionalität | 24 Stunden |
| Low | Kosmetische Issues | 1 Woche |

### 5.2 Bug-Report-Template

```markdown
## Bug Report

**Severity:** [Critical/High/Medium/Low]

**Environment:**
- Browser: [Chrome 120 / Firefox 121 / Safari 17]
- OS: [Windows / macOS / Linux]
- Device: [Desktop / Tablet / Mobile]

**Page:** [URL]

**Description:**
[Klare Beschreibung des Problems]

**Steps to Reproduce:**
1. Navigate to...
2. Click on...
3. Observe...

**Expected Result:**
[Was sollte passieren]

**Actual Result:**
[Was ist passiert]

**Screenshots:**
[Falls relevant]

**Additional Context:**
[Console logs, Network tab, etc.]
```

---

## 6. QA-Metriken Dashboard

### 6.1 Quality Score

```yaml
quality-score:
  components:
    - name: "Content Quality"
      weight: 0.3
      metrics:
        - broken_links: "0.1%"
        - code_examples_working: "99.5%"
        
    - name: "UI Quality"
      weight: 0.25
      metrics:
        - visual_regression_passing: "100%"
        - accessibility_score: "100%"
        
    - name: "Tool Quality"
      weight: 0.25
      metrics:
        - uptime: "99.95%"
        - error_rate: "0.01%"
        
    - name: "Performance"
      weight: 0.2
      metrics:
        - lighthouse_score: "92"
        - p95_load_time: "1.8s"
```

### 6.2 Trend-Tracking

| Woche | Quality Score | Bugs | Avg Response |
|-------|---------------|------|--------------|
| W1 | 94.2 | 12 | 1.2s |
| W2 | 95.1 | 8 | 1.1s |
| W3 | 96.3 | 5 | 1.0s |
| W4 | 97.1 | 3 | 0.9s |

---

## 7. Kontinuierliche Verbesserung

### 7.1 QA Retrospektiven

**Frequenz:** Monatlich

**Agenda:**
1. Review der letzten Month QA-Metriken
2. Analyse wiederkehrender Probleme
3. Verbesserungsvorschläge
4. Aktualisierung der Test-Abdeckung

### 7.2 Automatisierungs-Roadmap

| Q | Initiative | Status |
|---|------------|--------|
| Q1 | Visual Regression CI Integration | ✅ Done |
| Q2 | API Mock Server für Tests | ✅ Done |
| Q3 | Automated Cross-Browser Testing | 🔄 In Progress |
| Q4 | AI-Powered Content Quality Checks | 📋 Planned |

---

*Dieses QA-Konzept wird monatlich überprüft und aktualisiert. Letzte Überprüfung: Januar 2025.*
