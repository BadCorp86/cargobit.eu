# Dependency-Update Policy – Governance Postcheck

Policy für systematische Dependency-Updates im CargoBit Multi-Agent System.

---

## Grundsätze

### Ziele

1. **Sicherheit**: Prompte Behebung von Sicherheitslücken
2. **Stabilität**: Kontrollierte Updates mit Tests
3. **Transparenz**: Nachvollziehbare Änderungen
4. **Automatisierung**: Minimale manuelle Eingriffe

### Update-Kategorien

| Kategorie | Priorität | SLA | Automatisierung |
|-----------|-----------|-----|-----------------|
| Security (CRITICAL) | P1 | 24h | Automatisch + Review |
| Security (HIGH) | P1 | 72h | Automatisch + Review |
| Security (MEDIUM) | P2 | 1 Woche | Automatisch + Review |
| Security (LOW) | P3 | 1 Monat | Automatisch |
| Major Version | P3 | Quarterly | Manuell |
| Minor Version | P2 | Monthly | Automatisch + Tests |
| Patch Version | P1 | Weekly | Automatisch |

---

## Update-Prozess

### Phase 1: Detection

```yaml
# Dependabot Configuration
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
      - "dependencies"
      - "security"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    reviewers:
      - "platform-team"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

### Phase 2: Assessment

| Kriterium | Check | Tool |
|-----------|-------|------|
| CVE vorhanden? | Trivy Scan | `trivy image` |
| Breaking Changes? | Changelog Review | Manuell |
| API kompatibel? | Integration Tests | CI Pipeline |
| Lizenz OK? | License Check | `license-checker` |

### Phase 3: Testing

```bash
# 1. Unit Tests
npm test

# 2. Integration Tests
npm run test:integration

# 3. E2E Tests
npm run test:e2e

# 4. Security Scan
trivy fs --severity HIGH,CRITICAL .

# 5. SBOM Update
syft . -o json > sbom.json
```

### Phase 4: Approval

| Update-Typ | Approver | Process |
|------------|----------|---------|
| Security Patch | Security Team | Auto-merge nach Scan |
| Minor Version | Tech Lead | PR Review |
| Major Version | Architecture Board | RFC + Review |

### Phase 5: Deployment

```
Dev → Staging → Canary (5%) → Canary (25%) → Production
```

---

## Renovate/Dependabot Konfiguration

### Renovate Bot

```json
{
  "extends": [
    "config:base",
    ":dependencyDashboard",
    ":semanticCommits",
    ":automergePatch"
  ],
  "schedule": ["before 10am on Monday"],
  "timezone": "Europe/Berlin",
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "automerge": true,
      "groupName": "patches"
    },
    {
      "matchUpdateTypes": ["minor"],
      "automerge": false,
      "groupName": "minor updates"
    },
    {
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "schedule": ["every 3 months on the first day of the month"]
    },
    {
      "matchPackagePatterns": ["*"],
      "matchDepTypes": ["devDependencies"],
      "automerge": true
    },
    {
      "matchPackageNames": ["react", "react-dom"],
      "groupName": "react monorepo"
    }
  ],
  "vulnerabilityAlerts": {
    "enabled": true
  },
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["before 10am on Monday"]
  }
}
```

---

## Security-Updates

### CVE-Reaktion

| CVSS Score | Reaktion | SLA |
|------------|----------|-----|
| 9.0–10.0 (CRITICAL) | Immediate Patch | 24h |
| 7.0–8.9 (HIGH) | Priority Patch | 72h |
| 4.0–6.9 (MEDIUM) | Scheduled Patch | 1 Woche |
| 0.1–3.9 (LOW) | Next Release | 1 Monat |

### Notfall-Update-Prozess

```bash
# 1. Alert erhalten (PagerDuty/Slack)
# 2. Vulnerability validieren
trivy image <IMAGE> --severity CRITICAL

# 3. Patch identifizieren
npm audit fix --force

# 4. Hotfix-Branch erstellen
git checkout -b hotfix/cve-XXXX

# 5. Update durchführen
npm update <package>

# 6. Tests ausführen
npm test && npm run test:security

# 7. Expedited PR erstellen
gh pr create --title "HOTFIX: CVE-XXXX" --label "security,hotfix"

# 8. Nach Approval: Sofort deployen
```

---

## Major Version Updates

### RFC-Prozess

1. **Proposal erstellen** (RFC-Template)
2. **Impact-Analyse** (Breaking Changes, Migration)
3. **Architecture Review** (Board-Approval)
4. **Migration-Plan** (Schritte, Timeline)
5. **Implementation** (Feature-Flag, Tests)
6. **Rollout** (Canary, Monitoring)

### Beispiel: React 17 → 18

```markdown
## RFC: React 18 Upgrade

### Motivation
- Concurrent Features
- Automatic Batching
- Neue Hooks

### Breaking Changes
- ReactDOM.render → ReactDOM.createRoot
- Strict Mode Verhalten

### Migration-Plan
1. Upgrade React Dependencies
2. Update Entry Points
3. Test Suite anpassen
4. Canary Deployment
5. Production Rollout

### Timeline
- Woche 1: RFC Review
- Woche 2-3: Implementation
- Woche 4: Canary
- Woche 5: Production
```

---

## Dependency-Pinning

### Version-Strategie

| Typ | Format | Beispiel |
|-----|--------|----------|
| Exact | X.Y.Z | `1.2.3` |
| Patch Range | ~X.Y.Z | `~1.2.3` (>= 1.2.3, < 1.3.0) |
| Minor Range | ^X.Y.Z | `^1.2.3` (>= 1.2.3, < 2.0.0) |

### Empfehlung

```json
{
  "dependencies": {
    "react": "18.2.0",           // Exact für Core-Dependencies
    "lodash": "^4.17.21",        // Minor Range für Utilities
    "axios": "~1.4.0"            // Patch Range für HTTP-Clients
  },
  "devDependencies": {
    "typescript": "^5.0.0",      // Minor Range für Dev-Tools
    "eslint": "^8.40.0"          // Minor Range für Linter
  }
}
```

---

## Audit & Reporting

### Wöchentlicher Report

| Metrik | Wert | Trend |
|--------|------|-------|
| Outdated Dependencies | <!-- N --> | ↑/↓ |
| Security Vulnerabilities | <!-- N --> | ↑/↓ |
| Open Update PRs | <!-- N --> | ↑/↓ |
| Merged Updates | <!-- N --> | ↑/↓ |

### Monatlicher Audit

```bash
# Outdated Packages
npm outdated

# Security Audit
npm audit

# License Audit
npx license-checker --summary

# Bundle Size Impact
npx bundlephobia <package>@<version>
```

---

## Lockfile-Management

### package-lock.json

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Update specific package
npm update <package>

# Audit fix
npm audit fix

# Dedupe
npm dedupe
```

### Security-Review bei Konflikten

1. Lockfile diff analysieren
2. Transitiv Dependencies prüfen
3. Security-Scan durchführen
4. Nach Approval: merge

---

## Dokumentation

### CHANGELOG.md

```markdown
## [Unreleased]

### Dependencies
- Updated react from 18.1.0 to 18.2.0 (security)
- Updated axios from 1.3.0 to 1.4.0 (minor)
- Pinned typescript to 5.0.4
```

### ADR (Architecture Decision Records)

```markdown
# ADR-XXX: Dependency Update Strategy

## Status
Accepted

## Context
Need consistent approach to dependency updates

## Decision
Use Renovate Bot with weekly schedule, auto-merge patches

## Consequences
- Faster security patches
- Less manual work for minor updates
- Quarterly review for major updates
```

---

*Block DA – Dependency-Update Policy*
