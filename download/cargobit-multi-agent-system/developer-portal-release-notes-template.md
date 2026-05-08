# Release-Notes Template – Governance Postcheck

Vorlage für Release-Notes an Endkunden und Stakeholder.

---

## Release-Info

| Feld | Wert |
|------|------|
| **Version** | vX.Y.Z |
| **Release-Datum** | <!-- YYYY-MM-DD --> |
| **Release-Typ** | Major / Minor / Patch |
| **Author** | <!-- Name --> |

---

## Zusammenfassung

<!-- 2-3 Sätze, was dieser Release bringt. Fokus auf User-Value. -->

---

## Highlights

### 🚀 Neue Features

| Feature | Beschreibung | Impact |
|---------|--------------|--------|
| <!-- Feature 1 --> | <!-- Beschreibung --> | <!-- User Benefit --> |
| <!-- Feature 2 --> | <!-- Beschreibung --> | <!-- User Benefit --> |

### 🛠️ Verbesserungen

| Verbesserung | Beschreibung |
|--------------|--------------|
| <!-- Verbesserung 1 --> | <!-- Beschreibung --> |
| <!-- Verbesserung 2 --> | <!-- Beschreibung --> |

### 🐛 Bugfixes

| Bug | Beschreibung |
|-----|--------------|
| <!-- Bug 1 --> | <!-- Beschreibung --> |
| <!-- Bug 2 --> | <!-- Beschreibung --> |

### 🔒 Security

| Update | Beschreibung | CVE |
|--------|--------------|-----|
| <!-- Update 1 --> | <!-- Beschreibung --> | CVE-XXXX-XXXXX |

---

## Breaking Changes

### ⚠️ Wichtige Änderungen

| Änderung | Migration | Impact |
|----------|-----------|--------|
| <!-- Änderung --> | <!-- Wie migrieren --> | <!-- Wer ist betroffen --> |

### Deprecations

| Feature | Deprecation | Removal |
|---------|-------------|---------|
| <!-- Feature --> | <!-- Version --> | <!-- Version --> |

---

## API-Änderungen

### Neue Endpoints

```
<!-- API-Dokumentation -->
POST /api/v2/agents
GET /api/v2/tasks/{id}/status
```

### Geänderte Endpoints

| Endpoint | Änderung |
|----------|----------|
| <!-- Endpoint --> | <!-- Änderung --> |

### Entfernte Endpoints

| Endpoint | Alternative |
|----------|-------------|
| <!-- Endpoint --> | <!-- Alternative --> |

---

## Changelog

### Detaillierte Änderungen

```markdown
## [vX.Y.Z] - YYYY-MM-DD

### Added
- <!-- Neue Features -->

### Changed
- <!-- Änderungen -->

### Deprecated
- <!-- Deprecations -->

### Removed
- <!-- Entfernte Features -->

### Fixed
- <!-- Bugfixes -->

### Security
- <!-- Security Updates -->
```

---

## Upgrade-Guide

### Vorbereitung

- [ ] Backup erstellt
- [ ] Dependencies geprüft
- [ ] Migration-Scripts bereit

### Upgrade-Schritte

```bash
# 1. Pull latest image
docker pull cargobit/cargobit-agent:vX.Y.Z

# 2. Stop current version
docker-compose down

# 3. Update configuration
# Edit docker-compose.yml with new version

# 4. Start new version
docker-compose up -d

# 5. Verify
curl http://localhost:8080/health
```

### Rollback

```bash
# Falls Probleme auftreten
docker pull cargobit/cargobit-agent:vX.Y.Z-1
docker-compose down
# Edit docker-compose.yml with previous version
docker-compose up -d
```

---

## Known Issues

| Issue | Workaround | Fix geplant |
|-------|------------|-------------|
| <!-- Issue --> | <!-- Workaround --> | <!-- Version --> |

---

## Performance

| Metrik | Vorher | Nachher | Änderung |
|--------|--------|---------|----------|
| P99 Latency | <!-- ms --> | <!-- ms --> | ↑/↓ X% |
| Throughput | <!-- req/s --> | <!-- req/s --> | ↑/↓ X% |
| Memory Usage | <!-- MB --> | <!-- MB --> | ↑/↓ X% |

---

## Security-Hinweise

### Verifizierung

```bash
# SBOM herunterladen
curl -O https://releases.cargobit.io/vX.Y.Z/sbom.json

# Signatur verifizieren
cosign verify --keyless cargobit/cargobit-agent:vX.Y.Z

# Vulnerability Report
curl -O https://releases.cargobit.io/vX.Y.Z/trivy-report.json
```

### Security-Updates

| Komponente | Alte Version | Neue Version | CVE |
|------------|--------------|--------------|-----|
| <!-- Component --> | <!-- Old --> | <!-- New --> | CVE-XXXX |

---

## Dependencies

### Runtime Dependencies

| Dependency | Version | Lizenz |
|------------|---------|--------|
| <!-- Dep --> | <!-- Version --> | <!-- License --> |

### Development Dependencies

| Dependency | Version | Lizenz |
|------------|---------|--------|
| <!-- Dep --> | <!-- Version --> | <!-- License --> |

---

## Danksagungen

```
<!-- Contributors, Reviewers, Beta-Tester -->
```

---

## Support

| Kanal | Verfügbarkeit |
|-------|---------------|
| GitHub Issues | 24/7 |
| Slack #support | Mo–Fr 9–18 |
| Email support@ | 24/7 |

---

## Nächste Schritte

### Roadmap-Preview

| Feature | Geplant |
|---------|---------|
| <!-- Feature --> | <!-- Version/Datum --> |

---

*Block CZ – Release-Notes Template*
