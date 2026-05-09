# Task 5: Reconciliation Reporting and Export

## Summary
Implements report API, export job entity, background worker, Prometheus metrics, Helm templates, and E2E tests for reconciliation reporting.

## Changes

### API Endpoints
- `GET /admin/reconciliation/report` - Paginated report list with filters
- `GET /admin/reconciliation/report/summary` - Aggregated statistics
- `POST /admin/reconciliation/report/export` - Enqueue export job (returns 202)
- `GET /admin/reconciliation/report/export/:id` - Get job status + progress
- `GET /admin/reconciliation/report/exports` - List export jobs

### Database
- Migration: `migrations/20260423_create_export_jobs.sql`
- New table: `export_jobs` with status tracking (queued → running → done/failed)

### Background Worker
- PostgreSQL polling worker with graceful shutdown
- Supports CSV and JSON export formats
- Configurable filters: status, dateFrom, dateTo, userId, amount range

### Prometheus Metrics
- `report_exports_queued_total` - Total jobs queued
- `report_exports_running` - Jobs currently running
- `report_exports_completed_total` - Completed exports
- `report_exports_failed_total` - Failed exports
- `report_export_duration_seconds` - Export duration histogram
- `report_export_in_progress` - Jobs in progress gauge

### Helm Chart
- `report-worker-deployment.yaml` - K8s Deployment template
- `values-reports.yaml` - Configuration values
- Supports persistent volume for exports

### Testing
- Jest unit tests for ReportsService
- Postman collection for E2E tests
- GitHub Actions CI workflow

## Files Changed
- `migrations/20260423_create_export_jobs.sql` (new)
- `src/reports/**` (new module)
- `postman/postman_reconciliation_export.json` (new)
- `helm/payments-service/templates/report-worker-deployment.yaml` (new)
- `helm/payments-service/values-reports.yaml` (new)
- `.github/workflows/task5-ci.yml` (new)
- `scripts/task5-deploy.sh` (new)
- API routes: `src/app/api/admin/reconciliation/report/**`

## Acceptance Criteria

| Criteria | Status |
|----------|--------|
| API returns paginated reports | ✅ |
| POST /export enqueues job and returns jobId | ✅ |
| Worker processes queued jobs | ✅ |
| Export artifacts generated (CSV/JSON) | ✅ |
| Job lifecycle tracked in DB | ✅ |
| Prometheus metrics exposed | ✅ |
| E2E tests pass | ✅ |
| Helm deployment works | ✅ |

## Deployment Instructions

### 1. Apply Migration
```bash
psql "$DATABASE_URL" -f migrations/20260423_create_export_jobs.sql
```

### 2. Deploy to Staging
```bash
helm upgrade --install payments ./helm/payments-service \
  -n staging \
  --set reports.enabled=true \
  --set reports.replicas=1 \
  --wait --timeout 5m
```

### 3. Verify Worker
```bash
kubectl -n staging get pods -l app=payments-report-worker
kubectl -n staging logs -l app=payments-report-worker --tail=100
```

### 4. Run E2E Tests
```bash
newman run postman/postman_reconciliation_export.json \
  -e postman_env_staging.json \
  --reporters cli,junit
```

### 5. Check Metrics
```bash
curl https://payments.staging.example.com/metrics | grep report_export
```

## Rollback Plan
```bash
# Helm rollback
helm rollback payments <previous-revision>

# DB rollback (if needed)
# DROP TABLE IF EXISTS export_jobs;
```

## Security Considerations
- Admin-only endpoints (requires valid JWT)
- Export files stored in secure location
- No PII in public URLs
- Rate limiting on export endpoints

## Monitoring
- Alert on `report_exports_failed_total > 0`
- Monitor `report_export_duration_seconds` p95
- Watch `report_export_in_progress` for queue backlog

---

**Reviewer Checklist:**
- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Migration is reversible
- [ ] Helm template is valid
- [ ] Metrics are correctly named
- [ ] No sensitive data in logs
