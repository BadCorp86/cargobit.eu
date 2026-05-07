# Feature-Flag Strategy – Governance Postcheck

Governance und Best Practices für Feature-Flags im CargoBit Multi-Agent System.

---

## Übersicht

### Was sind Feature-Flags?

Feature-Flags (Feature Toggles) ermöglichen das Aktivieren/Deaktivieren von Features zur Laufzeit ohne Code-Deployment.

### Vorteile

| Vorteil | Beschreibung |
|---------|--------------|
| **Sichere Releases** | Features in Produktion testen (Canary) |
| **Schnelle Rollbacks** | Feature deaktivieren ohne Rollback |
| **A/B Testing** | Varianten für verschiedene User |
| **Trunk-Based Development** | Unfertige Features im Main Branch |
| **Ops-Response** | Features bei Incidents deaktivieren |

### Typen

| Typ | Dauer | Use Case |
|-----|-------|----------|
| **Release Flags** | Kurz (Wochen) | Progressive Rollout |
| **Experiment Flags** | Mittel (Monate) | A/B Tests |
| **Ops Flags** | Permanent | Kill Switch |
| **Permission Flags** | Permanent | Feature Access |

---

## Architektur

### Flag-Komponenten

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Application   │────▶│  Flag Provider  │────▶│  Flag Storage   │
│   (SDK)         │     │  (Unleash, etc.)│     │  (Redis/DB)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Admin UI      │
                        │   (Dashboard)   │
                        └─────────────────┘
```

### Provider-Optionen

| Provider | Self-Hosted | SaaS | Preis |
|----------|-------------|------|-------|
| Unleash | ✅ | ✅ | Open Source |
| LaunchDarkly | ❌ | ✅ | Commercial |
| Flagsmith | ✅ | ✅ | Open Source |
| Split | ❌ | ✅ | Commercial |

### Empfehlung: Unleash

```yaml
# docker-compose.yml
version: '3.8'
services:
  unleash:
    image: unleashorg/unleash-server:latest
    ports:
      - "4242:4242"
    environment:
      DATABASE_URL: postgres://unleash:password@postgres:5432/unleash
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: unleash
      POSTGRES_USER: unleash
      POSTGRES_PASSWORD: password
```

---

## Flag-Konventionen

### Namensgebung

```
{team}_{feature}_{type}

Beispiele:
- agents_taskQueue_release    (Release Flag)
- ui_darkMode_experiment      (Experiment Flag)
- api_rateLimit_ops           (Ops Flag)
- billing_advancedPlan_permission (Permission Flag)
```

### Typ-Suffixes

| Suffix | Typ | Farbe (UI) |
|--------|-----|------------|
| `_release` | Release Flag | Blau |
| `_experiment` | Experiment | Gelb |
| `_ops` | Ops/Kill Switch | Rot |
| `_permission` | Permission | Grün |

---

## Implementierung

### SDK Integration

```typescript
// unleash-client.ts
import { UnleashClient } from 'unleash-proxy-client';

export const unleash = new UnleashClient({
  url: 'https://unleash.example.com/api/proxy',
  clientKey: process.env.UNLEASH_CLIENT_KEY,
  appName: 'cargobit-api',
  environment: process.env.NODE_ENV,
});

// Initialize
unleash.start();

// Usage
export function isFeatureEnabled(flagName: string, context?: object): boolean {
  return unleash.isEnabled(flagName, context);
}
```

### Im Code

```typescript
// Beispiel: Task Queue Feature
import { isFeatureEnabled } from './unleash-client';

async function processTask(task: Task) {
  if (isFeatureEnabled('agents_taskQueue_release')) {
    // Neue Implementierung
    return await newTaskQueue.process(task);
  } else {
    // Alte Implementierung
    return await legacyQueue.process(task);
  }
}

// Mit Varianten (A/B Test)
async function renderDashboard(userId: string) {
  const variant = unleash.getVariant('ui_dashboard_experiment', { userId });

  switch (variant.name) {
    case 'new-design':
      return renderNewDashboard();
    case 'simplified':
      return renderSimplifiedDashboard();
    default:
      return renderLegacyDashboard();
  }
}
```

---

## Rollout-Strategien

### Progressive Rollout

```
1% → 5% → 10% → 25% → 50% → 100%
```

```typescript
// Unleash Strategy
{
  "name": "gradualRollout",
  "parameters": {
    "percentage": 10,
    "groupId": "agents_taskQueue_release"
  }
}
```

### Targeted Rollout

```typescript
// Nur für bestimmte User
{
  "name": "userWithId",
  "parameters": {
    "userIds": "user1,user2,user3"
  }
}

// Nur für bestimmte Teams
{
  "name": "byTeam",
  "parameters": {
    "teams": "beta-testers,internal"
  }
}
```

### Canary Rollout

```typescript
// Kombiniert mit Kubernetes
{
  "name": "canary",
  "parameters": {
    "percentage": 5,
    "canaryTag": "canary"
  }
}
```

---

## Governance

### Flag-Lifecycle

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Created │───▶│ Enabled │───▶│ Stable  │───▶│ Archived│
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │
   Request       Testing       Production       Cleanup
   (PR)         (Staging)      (Monitored)      (Code)
```

### Flag-Review-Prozess

| Phase | Action | Owner |
|-------|--------|-------|
| Create | Flag in Code + Unleash | Developer |
| Enable | Staging Test | QA |
| Rollout | Progressive Deploy | SRE |
| Monitor | SLO Check | SRE |
| Archive | Code Cleanup | Developer |

### Review-Termin

| Flag-Typ | Review-Zyklus | Archivierung |
|----------|---------------|--------------|
| Release | Nach Go-Live | Nach 2 Wochen |
| Experiment | Nach Abschluss | Nach Analyse |
| Ops | Quartalsweise | Nie |
| Permission | Bei Änderung | Nie |

---

## Monitoring

### Metrics

| Metrik | Beschreibung |
|--------|--------------|
| `flag_evaluations_total` | Anzahl der Evaluierungen |
| `flag_enabled_ratio` | Verhältnis enabled/disabled |
| `flag_evaluation_latency` | Latenz der Flag-Check |
| `flag_errors_total` | Fehler bei Flag-Evaluation |

### Dashboard

```yaml
# Grafana Dashboard Panels
panels:
  - title: "Active Feature Flags"
    type: stat
    datasource: prometheus
    targets:
      - expr: count(unleash_flag_enabled)

  - title: "Flag Evaluation Rate"
    type: graph
    datasource: prometheus
    targets:
      - expr: rate(unleash_flag_evaluations_total[5m])

  - title: "Flags by Type"
    type: piechart
    datasource: prometheus
    targets:
      - expr: sum by (type)(unleash_flag_enabled)
```

### Alerting

```yaml
# Alert wenn Flag Error Rate hoch
alerts:
  - name: FlagEvaluationErrors
    expr: rate(unleash_flag_errors_total[5m]) > 0.01
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Feature Flag evaluation errors detected"
```

---

## Best Practices

### DO ✅

| Best Practice | Beschreibung |
|---------------|--------------|
| Kurze Lebensdauer | Release Flags nach Go-Live entfernen |
| Fallback-Default | Default-Wert definieren bei Fehlern |
| Logging | Flag-Evaluation loggen für Debug |
| Dokumentation | Flag in README/ADR beschreiben |
| Context nutzen | User-ID, Team, Environment übergeben |

### DON'T ❌

| Anti-Pattern | Problem |
|--------------|---------|
| Flag-Spaghetti | Zu viele Flags im Code |
| Verschachtelte Flags | Komplexe If-Else-Ketten |
| Kein Cleanup | Dead Code durch alte Flags |
| Kein Default | Fehler bei Provider-Ausfall |
| Lange Lebensdauer | Wartungsnightmare |

---

## Incident-Response

### Kill Switch Pattern

```typescript
// Ops Flag als Kill Switch
export async function handleRequest(req: Request): Promise<Response> {
  // Kill Switch Check
  if (!isFeatureEnabled('api_requestHandler_ops')) {
    // Fallback oder Error
    return new Response('Service temporarily unavailable', { status: 503 });
  }

  // Normal processing
  return await processRequest(req);
}
```

### Emergency Toggle

```bash
# Unleash API
curl -X POST https://unleash.example.com/api/admin/features/api_requestHandler_ops/toggle/off \
  -H "Authorization: <API_KEY>"
```

---

## Flag-Inventar

### Template

```markdown
## Flag: agents_taskQueue_release

| Feld | Wert |
|------|------|
| Typ | Release |
| Owner | Team Agents |
| Created | 2024-01-15 |
| Target Removal | 2024-02-01 |
| Description | Neue Task Queue Implementierung |
| Rollout Plan | 1% → 5% → 25% → 100% |
| Fallback | Legacy Queue |
| Related PRs | #123, #456 |
```

### Inventar-Datei

```markdown
# FEATURE_FLAGS.md

## Active Flags

| Flag | Typ | Owner | Status | Removal |
|------|-----|-------|--------|---------|
| agents_taskQueue_release | Release | @team-agents | 25% | 2024-02-01 |
| ui_darkMode_experiment | Experiment | @team-ui | A/B | 2024-03-01 |
| api_rateLimit_ops | Ops | @sre | 100% | Never |

## Archived Flags

| Flag | Removed | Reason |
|------|---------|--------|
| legacy_auth_release | 2023-12-01 | Feature stable |
```

---

## Cleanup-Workflow

### Automatisches Cleanup

```yaml
# GitHub Action für Flag-Cleanup Reminder
name: Feature Flag Cleanup Reminder
on:
  schedule:
    - cron: '0 9 * * MON'  # Jeden Montag

jobs:
  check-flags:
    runs-on: ubuntu-latest
    steps:
      - name: Check stale flags
        run: |
          # Flags älter als 30 Tage melden
          stale_flags=$(curl -s https://unleash.example.com/api/admin/features \
            -H "Authorization: $UNLEASH_API_KEY" \
            | jq '.features[] | select(.createdAt < (now - 2592000))')

          if [ -n "$stale_flags" ]; then
            # Slack Notification
            curl -X POST $SLACK_WEBHOOK -d "{\"text\": \"⚠️ Stale Feature Flags detected: $stale_flags\"}"
          fi
```

---

*Block DB – Feature-Flag Strategy*
