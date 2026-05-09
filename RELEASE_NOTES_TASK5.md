# Release Notes: Task 5 - Reconciliation Reporting and Export

## Title
feat(reports): Reconciliation reporting and export

## Summary
Adds admin API to list reconciliation reports and enqueue exports, background worker to process export_jobs and upload CSV artifacts to S3, DB migration for export_jobs, Prometheus metrics, Helm templates and CI.

## Changes

### API Endpoints
- **GET** `/admin/reconciliation/report` - List reconciliation reports with pagination
- **GET** `/admin/reconciliation/report/summary` - Get summary statistics
- **POST** `/admin/reconciliation/report/export` - Enqueue export job (returns jobId)
- **GET** `/admin/reconciliation/report/export/:jobId` - Get export job status
- **GET** `/admin/reconciliation/report/exports` - List export jobs

### Database
- **Migration**: `migrations/20260423_create_export_jobs.sql`
- **Rollback**: `migrations/20260423_rollback_export_jobs.sql`

### Components
- ExportJob entity and worker implementation using pg direct connection
- S3 upload for export artifacts with streaming multipart upload and retries
- Prometheus metrics: `report_exports_total`, `report_export_duration_seconds`, `report_export_in_progress`
- Helm templates for report worker deployment
- Postman collection `postman/postman_reconciliation_export.json`
- Unit tests for ReportsService

### Prometheus Metrics (6)
1. `report_exports_queued_total{format}` - Total export jobs queued
2. `report_exports_running` - Currently running exports
3. `report_exports_completed_total{format}` - Completed exports
4. `report_exports_failed_total{error_type}` - Failed exports
5. `report_export_duration_seconds{format}` - Export duration histogram
6. `report_export_in_progress` - Exports in progress gauge

## How to Test in Staging

### 1. Apply DB Migration
```bash
psql "$DATABASE_URL" -f migrations/20260423_create_export_jobs.sql
```

### 2. Ensure Secrets
- `DATABASE_URL`
- `REDIS_HOST`
- AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- `EXPORT_BUCKET`
- `ADMIN_JWT`

### 3. Configure Helm Values
```yaml
# helm/payments/values.yaml
reports:
  enabled: true
  replicas: 1
  exportBucket: "<EXPORT_BUCKET>"
  pollIntervalMs: 5000
  batchSize: 10000
  resources:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 100m
      memory: 128Mi

redis:
  host: "<REDIS_HOST>"

aws:
  region: "<AWS_REGION>"
```

### 4. Deploy
```bash
helm upgrade --install payments ./helm/payments -n staging \
  --values helm/payments/values.yaml \
  --wait --timeout 5m
```

### 5. Verify Worker
```bash
kubectl -n staging rollout status deploy/payments-report-worker
kubectl -n staging logs deploy/payments-report-worker --tail=200
```

### 6. Enqueue Export via API
```bash
# Using curl
curl -X POST "https://payments.staging.cargobit.io/admin/reconciliation/report/export" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"format":"csv","filter":{"status":"paid"}}'

# Or use Postman collection
newman run postman/postman_reconciliation_export.json \
  -e postman/cargobit-payment-playbook/postman_env_staging.json
```

### 7. Poll Export Jobs Table
```sql
SELECT id, status, result_url, error, created_at, updated_at
FROM export_jobs
ORDER BY created_at DESC
LIMIT 10;
```

### 8. Verify Artifact
```bash
# S3 check
aws s3 ls "s3://${EXPORT_BUCKET}/exports/"

# Or check worker pod
kubectl -n staging exec -it <report-worker-pod> -- ls -l /tmp/exports/
```

### 9. Run Newman E2E Tests
```bash
newman run postman/postman_reconciliation_export.json \
  -e postman/cargobit-payment-playbook/postman_env_staging.json \
  --reporters cli,junit \
  --reporter-junit-export reports/newman-reports-export.xml
```

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| Export job lifecycle: queued → running → done | ✅ |
| `result_url` points to S3 object or artifact exists | ✅ |
| Prometheus metrics visible and increase on runs | ✅ |
| Unit tests pass in CI | ✅ |
| Helm chart deploys successfully | ✅ |
| Postman collection passes | ✅ |

## Suggested Reviewers
- @backend-lead
- @infra
- @payments-eng
- @devops

## Rollback Plan

### Helm Rollback
```bash
helm rollback payments <revision>
```

### DB Migration Rollback
```bash
psql "$DATABASE_URL" -f migrations/20260423_rollback_export_jobs.sql
```

## Files Changed
```
src/reports/
├── reports.module.ts
├── controllers/reports.controller.ts
├── services/reports.service.ts
├── entities/export-job.entity.ts
├── worker/report-worker.ts
├── metrics/reports.metrics.ts
└── __tests__/reports.service.spec.ts

migrations/
├── 20260423_create_export_jobs.sql
└── 20260423_rollback_export_jobs.sql

helm/payments-service/
├── templates/report-worker-deployment.yaml
└── values-reports.yaml

postman/
└── postman_reconciliation_export.json

scripts/
├── run-task5-verify.sh
└── task5-staging-verify.sh
```
