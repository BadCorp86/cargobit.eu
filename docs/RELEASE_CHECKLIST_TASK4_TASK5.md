# CargoBit Payment Platform - Release Checklist
## Task 4: Payout Reconciliation & Task 5: Reconciliation Reporting & Export

**Release Version:** v1.0.0
**Target Date:** [DATE]
**Release Manager:** [NAME]
**Document Created:** 2026-04-24

---

## 📋 Pre-Release Checklist

### Phase 1: Code & PR Management (T-7 Days)

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1.1 | Create PR for Task 4 (feat/reconciliation-task4) | Backend Lead | ⬜ | |
| 1.2 | Create PR for Task 5 (feat/reports-task5-improvements) | Backend Lead | ⬜ | |
| 1.3 | Code Review completed | Tech Lead | ⬜ | Min. 2 approvals |
| 1.4 | Security Review approved | Security Eng | ⬜ | IAM, Secrets, Encryption |
| 1.5 | All CI checks green | DevOps | ⬜ | Unit, Integration, Lint |
| 1.6 | Merge PRs to main | Release Mgr | ⬜ | Squash merge preferred |

### Phase 2: Database Migration (T-5 Days)

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 2.1 | DB Backup created | DBA | ⬜ | Full backup before migration |
| 2.2 | Apply migration to Staging | DBA | ⬜ | `psql "$DATABASE_URL" -f migrations/20260423_create_export_jobs.sql` |
| 2.3 | Verify migration success | DBA | ⬜ | Check `export_jobs` table exists |
| 2.4 | Run rollback test (dry) | DBA | ⬜ | Validate rollback script works |
| 2.5 | Document migration timestamp | DBA | ⬜ | Record for audit |

### Phase 3: Secrets & Configuration (T-3 Days)

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 3.1 | DATABASE_URL secret configured | DevOps | ⬜ | Kubernetes Secret |
| 3.2 | REDIS_HOST secret configured | DevOps | ⬜ | Redis endpoint |
| 3.3 | AWS credentials configured | DevOps | ⬜ | AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY |
| 3.4 | EXPORT_BUCKET configured | DevOps | ⬜ | S3 bucket name |
| 3.5 | ADMIN_JWT configured | Security | ⬜ | Admin authentication |
| 3.6 | Verify secrets in namespace | DevOps | ⬜ | `kubectl get secrets -n staging` |

### Phase 4: Helm Deployment - Staging (T-2 Days)

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 4.1 | Helm lint passed | DevOps | ⬜ | `helm lint helm/payments` |
| 4.2 | Values file reviewed | DevOps | ⬜ | reports.enabled: true |
| 4.3 | Deploy to staging | DevOps | ⬜ | `helm upgrade --install payments ./helm/payments -n staging --wait --timeout 5m` |
| 4.4 | CronJob deployment verified | DevOps | ⬜ | `kubectl get cronjobs -n staging` |
| 4.5 | Worker deployment verified | DevOps | ⬜ | `kubectl get deploy payments-report-worker -n staging` |
| 4.6 | Pod health check | DevOps | ⬜ | All pods Running |

### Phase 5: Functional Verification (T-1 Day)

#### Task 4: Payout Reconciliation

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 5.1 | CronJob manual trigger | Backend | ⬜ | `kubectl create job --from=cronjob/...` |
| 5.2 | Logs show successful run | Backend | ⬜ | No errors in reconciliation logs |
| 5.3 | Open payouts detected | Backend | ⬜ | Check `reconciliation_open_payouts_gauge` |
| 5.4 | Manual mark endpoint works | Backend | ⬜ | POST /admin/reconciliation/{id}/mark |
| 5.5 | Newman E2E passed | QA | ⬜ | `newman run postman_reconciliation.json` |

#### Task 5: Reporting & Export

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 5.6 | Export enqueue works | Backend | ⬜ | POST /admin/reconciliation/report/export returns jobId |
| 5.7 | Worker processes job | Backend | ⬜ | Job transitions queued → running → done |
| 5.8 | S3 artifact created | Backend | ⬜ | `aws s3 ls s3://$EXPORT_BUCKET/exports/` |
| 5.9 | result_url populated | Backend | ⬜ | Check export_jobs table |
| 5.10 | Newman E2E passed | QA | ⬜ | `newman run postman_reconciliation_export.json` |

### Phase 6: Monitoring & Alerts (T-1 Day)

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 6.1 | Prometheus scraping metrics | DevOps | ⬜ | Check targets page |
| 6.2 | Grafana dashboard imported | DevOps | ⬜ | reconciliation-reports-dashboard.json |
| 6.3 | Alert rules configured | DevOps | ⬜ | reconciliation-reports-alerts.yaml |
| 6.4 | Alert routing tested | DevOps | ⬜ | Test notification channel |
| 6.5 | SLO dashboards ready | DevOps | ⬜ | 99.5% success rate visible |

### Phase 7: Security Hardening (T-1 Day)

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 7.1 | IAM least privilege verified | Security | ⬜ | Only s3:PutObject on exports/* |
| 7.2 | Signed URLs for downloads | Security | ⬜ | Time-limited access |
| 7.3 | Network policies applied | Security | ⬜ | Pod-to-pod restrictions |
| 7.4 | Resource limits set | DevOps | ⬜ | CPU/Memory limits for worker |
| 7.5 | Liveness/Readiness probes | DevOps | ⬜ | Health check endpoints |

---

## 🚀 Production Deployment

### Phase 8: Go-Live (Day 0)

| # | Task | Owner | Status | Time | Notes |
|---|------|-------|--------|------|-------|
| 8.1 | Final backup | DBA | ⬜ | | Full production backup |
| 8.2 | Apply migration to Prod | DBA | ⬜ | | Same as staging |
| 8.3 | Deploy to production | DevOps | ⬜ | | Helm upgrade |
| 8.4 | Smoke test | QA | ⬜ | | Basic functionality |
| 8.5 | Monitor metrics | DevOps | ⬜ | | Watch for anomalies |
| 8.6 | Announce to stakeholders | Release Mgr | ⬜ | | Slack/Email |

### Phase 9: Post-Launch Monitoring (24h)

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 9.1 | First hour monitoring | On-Call | ⬜ | Watch error rates |
| 9.2 | First CronJob execution | On-Call | ⬜ | Verify scheduled run |
| 9.3 | First export request | On-Call | ⬜ | Test real export |
| 9.4 | 12h health check | On-Call | ⬜ | All metrics green |
| 9.5 | 24h signoff | Release Mgr | ⬜ | Production stable |

---

## 📊 Verification Commands

### Task 4 Verification
```bash
# Trigger CronJob manually
kubectl -n staging create job --from=cronjob/payments-reconciliation temp-recon-$(date +%s)

# Check logs
POD=$(kubectl -n staging get pods -l job-name=temp-recon-$(date +%s) -o jsonpath='{.items[0].metadata.name}')
kubectl -n staging logs "$POD" --tail=500

# Check metrics
curl -fsS https://payments.staging.example.com/metrics | grep reconciliation_
```

### Task 5 Verification
```bash
# Enqueue export
curl -sS -X POST "${BASE_URL}/admin/reconciliation/report/export" \
  -H "Authorization: Bearer ${ADMIN_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"format":"csv","filter":{"status":"paid"}}'

# Check job status
psql "$DATABASE_URL" -At -c "SELECT id,status,result_url,error FROM export_jobs ORDER BY created_at DESC LIMIT 10;"

# Verify S3
aws s3 ls "s3://${EXPORT_BUCKET}/exports/"
```

### Newman E2E
```bash
# Task 4
newman run postman/postman_reconciliation.json \
  -e postman/cargobit-payment-playbook/postman_env_staging.json \
  --reporters cli,junit \
  --reporter-junit-export reports/newman-reconciliation.xml

# Task 5
newman run postman/postman_reconciliation_export.json \
  -e postman/cargobit-payment-playbook/postman_env_staging.json \
  --reporters cli,junit \
  --reporter-junit-export reports/newman-reports-export.xml
```

---

## 🔄 Rollback Plan

### Immediate Rollback (First 30 min)
```bash
# 1. Helm rollback to previous revision
helm rollback payments <previous_revision> -n staging

# 2. Verify rollback
kubectl -n staging rollout status deploy/payments-report-worker

# 3. Check metrics return to baseline
curl -fsS https://payments.staging.example.com/metrics | grep report_export
```

### Database Rollback (If Required)
```bash
# CAUTION: Only with DBA approval
# 1. Stop all workers
kubectl -n staging scale deploy payments-report-worker --replicas=0

# 2. Apply rollback migration
psql "$DATABASE_URL" -f migrations/20260423_rollback_export_jobs.sql

# 3. Verify table dropped
psql "$DATABASE_URL" -c "\d export_jobs" 2>&1 | grep "does not exist"

# 4. Restart workers
kubectl -n staging scale deploy payments-report-worker --replicas=1
```

### Incident Response Steps
1. **Detect**: Alert fires or user reports issue
2. **Assess**: Check logs, metrics, error rates
3. **Decide**: Rollback or hotfix
4. **Execute**: Follow rollback plan
5. **Communicate**: Update stakeholders
6. **Postmortem**: Document timeline and root cause

---

## 👥 Contacts & Escalation

| Role | Name | Slack | Phone |
|------|------|-------|-------|
| Release Manager | [NAME] | @release-mgr | [PHONE] |
| Backend Lead | [NAME] | @backend-lead | [PHONE] |
| DevOps | [NAME] | @devops | [PHONE] |
| DBA | [NAME] | @dba | [PHONE] |
| Security | [NAME] | @security | [PHONE] |
| On-Call | Rotation | @oncall | PagerDuty |

---

## ✅ Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Tech Lead | | | |
| Security | | | |
| DevOps | | | |
| Release Manager | | | |

---

**Document Version:** 1.0
**Last Updated:** 2026-04-24
**Next Review:** [DATE]
