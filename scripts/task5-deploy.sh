#!/usr/bin/env bash
set -euo pipefail

# task5-deploy.sh
# Deploy Task 5: Reconciliation Reporting and Export
#
# Usage:
#   ./scripts/task5-deploy.sh --kubeconfig ~/.kube/config --namespace staging

KUBECONFIG_PATH="${HOME}/.kube/config"
NAMESPACE="staging"
RELEASE="payments"
VALUES_FILE="helm/payments-service/values.yaml"
CHART_PATH="helm/payments-service"
DB_URL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --kubeconfig) KUBECONFIG_PATH="$2"; shift 2;;
    --namespace) NAMESPACE="$2"; shift 2;;
    --release) RELEASE="$2"; shift 2;;
    --db-url) DB_URL="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

export KUBECONFIG="$KUBECONFIG_PATH"

echo "=== Task 5: Reconciliation Reporting and Export ==="
echo ""

echo "1) Applying database migration..."
if [ -n "$DB_URL" ]; then
  psql "$DB_URL" -f migrations/20260423_create_export_jobs.sql
  echo "Migration applied successfully."
else
  echo "DB_URL not provided. Apply migration manually:"
  echo "  psql \$DATABASE_URL -f migrations/20260423_create_export_jobs.sql"
fi
echo ""

echo "2) Creating reports directory structure..."
mkdir -p reports
echo ""

echo "3) Helm lint..."
helm lint "$CHART_PATH" || echo "Helm lint warnings (non-blocking)"
echo ""

echo "4) Deploying with reports.enabled=true..."
helm upgrade --install "$RELEASE" "$CHART_PATH" \
  --namespace "$NAMESPACE" --create-namespace \
  --values "$VALUES_FILE" \
  --set reports.enabled=true \
  --set reports.replicas=1 \
  --wait --timeout 5m
echo ""

echo "5) Verifying report-worker deployment..."
kubectl -n "$NAMESPACE" get deployment "${RELEASE}-report-worker" -o wide || {
  echo "Report worker deployment not found. Check if reports.enabled is true."
}
echo ""

echo "6) Verifying export_jobs table..."
if [ -n "$DB_URL" ]; then
  psql "$DB_URL" -c "\d export_jobs"
fi
echo ""

echo "=== Task 5 Deployment Complete ==="
echo ""
echo "API Endpoints:"
echo "  GET  /admin/reconciliation/report          - List reports"
echo "  GET  /admin/reconciliation/report/summary  - Get summary stats"
echo "  POST /admin/reconciliation/report/export   - Enqueue export job"
echo "  GET  /admin/reconciliation/report/export/:id - Get job status"
echo "  GET  /admin/reconciliation/report/exports  - List export jobs"
echo ""
echo "Metrics:"
echo "  report_exports_queued_total      - Total jobs queued"
echo "  report_exports_running           - Jobs currently running"
echo "  report_exports_completed_total   - Completed exports"
echo "  report_exports_failed_total      - Failed exports"
echo "  report_export_duration_seconds   - Export duration histogram"
echo "  report_export_in_progress        - Jobs in progress gauge"
echo ""
echo "Next steps:"
echo "  1. Run Newman E2E: newman run postman/postman_reconciliation_export.json -e postman_env_staging.json"
echo "  2. Check worker logs: kubectl -n $NAMESPACE logs -l app=${RELEASE}-report-worker"
echo "  3. Verify metrics: curl https://payments.staging.example.com/metrics | grep report_export"
