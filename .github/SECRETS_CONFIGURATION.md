# GitHub Secrets Configuration Guide

## Required Secrets for Load Test Workflows

Set these secrets in GitHub Repository Settings → Secrets and variables → Actions

---

## Required Secrets

| Secret Name | Description | Environment |
|-------------|-------------|-------------|
| `STAGING_BASE_URL` | Staging API base URL | Staging |
| `STAGING_ADMIN_JWT` | Admin JWT for Staging | Staging |
| `PROD_BASE_URL` | Production API base URL | Production |
| `PROD_ADMIN_JWT` | Admin JWT for Production | Production |

---

## Setting Secrets

### Via GitHub UI

1. Navigate to your repository
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

### Via GitHub CLI

```bash
# Set staging secrets
gh secret set STAGING_BASE_URL --body "https://payments.staging.example.com"
gh secret set STAGING_ADMIN_JWT --body "eyJhbGciOiJSUzI1NiIs..."

# Set production secrets
gh secret set PROD_BASE_URL --body "https://payments.example.com"
gh secret set PROD_ADMIN_JWT --body "eyJhbGciOiJSUzI1NiIs..."
```

---

## JWT Token Requirements

The Admin JWT must have the following permissions:

- Role: `admin` or `service_account`
- Scopes: `reports:export`, `reports:read`
- Expiration: Recommended 24h for manual tests, 1h for CI

### Generating a JWT for Testing

```bash
# Example using your auth service
curl -X POST https://auth.example.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "scope=reports:export reports:read"
```

---

## Security Best Practices

1. **Rotate JWT tokens regularly** - Set up automated rotation
2. **Use short-lived tokens** - Max 24h for staging, 1h for CI jobs
3. **Limit scopes** - Only grant `reports:export` and `reports:read`
4. **Monitor usage** - Track JWT usage in audit logs
5. **Never commit tokens** - Always use GitHub Secrets

---

## Environment Variables Reference

### k6 Workflow (`load-test-k6.yml`)

| Variable | Source | Description |
|----------|--------|-------------|
| `BASE_URL` | Secret | API base URL |
| `ADMIN_JWT` | Secret | Auth token |
| `PROFILE` | Input | Test profile (small/medium/large/mixed) |
| `K6_VUS` | Input | Virtual users |
| `K6_DURATION` | Input | Test duration |

### Enqueue Workflow (`load-test-enqueue.yml`)

| Variable | Source | Description |
|----------|--------|-------------|
| `BASE_URL` | Secret | API base URL |
| `ADMIN_JWT` | Secret | Auth token |
| `CONCURRENCY` | Input | Concurrent workers |
| `JOBS` | Input | Jobs per worker |
| `PROFILE` | Input | Test profile |

---

## S3 Configuration (Optional)

If tests need to verify S3 uploads, ensure the worker environment has:

```yaml
# Helm values for worker
env:
  - name: EXPORT_BUCKET
    value: "cargobit-exports"
  - name: AWS_REGION
    value: "eu-central-1"
```

**Note:** S3 bucket names should NOT be stored as secrets unless they contain sensitive information.

---

## Workflow Dispatch Inputs

### k6 Load Test

| Input | Default | Options |
|-------|---------|---------|
| profile | large | small, medium, large, mixed |
| vus | 100 | Any number |
| duration | 15m | Any duration (e.g., 10m, 30m) |
| environment | staging | staging, production |

### Enqueue Load Test

| Input | Default | Options |
|-------|---------|---------|
| concurrency | 5 | Any number |
| jobs | 20 | Any number |
| profile | mixed | small, medium, large, mixed |
| environment | staging | staging, production |

---

## Running Workflows

1. Go to **Actions** tab in GitHub
2. Select the workflow
3. Click **Run workflow**
4. Select inputs and environment
5. Click **Run workflow**

Results will be available in:
- GitHub Actions summary
- Artifacts (downloadable logs)
- Prometheus/Grafana (if configured)
