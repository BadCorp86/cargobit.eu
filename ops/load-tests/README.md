# CargoBit Reconciliation Export - Load Tests

This directory contains k6 load test scripts for the Reconciliation Export MVP.

## Files

| File | Description |
|------|-------------|
| `k6-export-load-param.js` | Parameterized load test for export API |
| `enqueue-load-test.js` | Simple queue stress test |
| `enqueue-load-test-param.js` | Parameterized queue stress test |
| `test-data-generator.sql` | SQL script for generating test data |

## Prerequisites

- k6 installed (`brew install k6` or `choco install k6`)
- Valid `ADMIN_JWT` token for the target environment
- Network access to the target API

## Quick Start

### Basic Export Test

```bash
# Run against staging with defaults
k6 run k6-export-load-param.js \
  -e BASE_URL=https://api.staging.cargobit.io \
  -e ADMIN_JWT=$STAGING_ADMIN_JWT
```

### Full Flow Test (with polling and download)

```bash
k6 run k6-export-load-param.js \
  -e BASE_URL=https://api.staging.cargobit.io \
  -e ADMIN_JWT=$STAGING_ADMIN_JWT \
  -e SCENARIO=full-flow
```

### Burst Test

```bash
k6 run k6-export-load-param.js \
  -e BASE_URL=https://api.staging.cargobit.io \
  -e ADMIN_JWT=$STAGING_ADMIN_JWT \
  -e SCENARIO=burst
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | Target API URL |
| `ADMIN_JWT` | *(required)* | JWT token for authentication |
| `SCENARIO` | `create-only` | Test scenario to run |
| `VUS` | `10` | Number of virtual users |
| `DURATION` | `2m` | Test duration |
| `RAMP_UP` | `30s` | Ramp-up duration |
| `P95_LATENCY` | `2000` | P95 latency threshold (ms) |
| `ERROR_RATE` | `0.01` | Error rate threshold |
| `FORMATS` | `csv,json` | Export formats to test |
| `MAX_POLL_ATTEMPTS` | `12` | Max polling attempts for full-flow |
| `POLL_INTERVAL` | `5` | Polling interval in seconds |

## Test Scenarios

### 1. create-only (default)

Creates export jobs without waiting for completion.

```bash
k6 run k6-export-load-param.js \
  -e SCENARIO=create-only \
  -e VUS=20 \
  -e DURATION=5m
```

### 2. full-flow

Complete export flow: create → poll → download.

```bash
k6 run k6-export-load-param.js \
  -e SCENARIO=full-flow \
  -e VUS=5 \
  -e DURATION=10m
```

### 3. concurrent

Concurrent export requests from multiple VUs.

```bash
k6 run k6-export-load-param.js \
  -e SCENARIO=concurrent \
  -e VUS=50
```

### 4. burst

Simulates sudden traffic spike.

```bash
k6 run k6-export-load-param.js \
  -e SCENARIO=burst
```

### 5. mixed

Mixed workload: 70% create-only + 30% full-flow.

```bash
k6 run k6-export-load-param.js \
  -e SCENARIO=mixed \
  -e VUS=20
```

## GitHub Actions Integration

Load tests can be triggered via GitHub Actions workflow:

1. Go to Actions → "k6 Export Load Test"
2. Select parameters
3. Run workflow

Required secrets:
- `STAGING_ADMIN_JWT` - JWT token for staging environment

## Thresholds

Default thresholds for all scenarios:

| Metric | Threshold |
|--------|-----------|
| P95 Latency | < 2000ms |
| Error Rate | < 1% |
| Export Success | > 95% |

Adjust via environment variables:

```bash
k6 run k6-export-load-param.js \
  -e P95_LATENCY=3000 \
  -e ERROR_RATE=0.02
```

## Test Data Generation

Generate test data in the database:

```bash
psql $DATABASE_URL -f test-data-generator.sql
```

This creates:
- 10,000 test payouts
- Various statuses and amounts
- Realistic distribution

## CI/CD Integration

### Staging (Automated)

Run automatically after deployment:

```yaml
# .github/workflows/deploy-staging.yml
- name: Run load tests
  run: |
    k6 run ops/load-tests/k6-export-load-param.js \
      -e BASE_URL=https://api.staging.cargobit.io \
      -e ADMIN_JWT=${{ secrets.STAGING_ADMIN_JWT }} \
      -e SCENARIO=create-only \
      -e VUS=10 \
      -e DURATION=2m
```

### Production (Manual)

Run before go-live:

```bash
k6 run k6-export-load-param.js \
  -e BASE_URL=https://api.cargobit.io \
  -e ADMIN_JWT=$PROD_ADMIN_JWT \
  -e SCENARIO=full-flow \
  -e VUS=5 \
  -e DURATION=5m
```

## Troubleshooting

### Authentication Errors

```bash
# Verify token is valid
curl -H "Authorization: Bearer $ADMIN_JWT" \
  https://api.staging.cargobit.io/api/health
```

### Rate Limiting

If tests are rate-limited:

```bash
k6 run k6-export-load-param.js \
  -e VUS=5 \
  -e RAMP_UP=2m
```

### Timeout Issues

Increase poll attempts:

```bash
k6 run k6-export-load-param.js \
  -e SCENARIO=full-flow \
  -e MAX_POLL_ATTEMPTS=20 \
  -e POLL_INTERVAL=10
```

## Metrics Explained

| Metric | Description |
|--------|-------------|
| `export_success` | Rate of successful exports |
| `export_error` | Rate of export errors |
| `export_latency` | Time to create export job |
| `download_latency` | Time to download export file |
| `queued_jobs` | Total jobs created |
| `completed_jobs` | Jobs that completed successfully |
| `failed_jobs` | Jobs that failed |

---

**Last updated:** April 2026
**Maintainer:** Platform Team
