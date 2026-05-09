#!/usr/bin/env bash
set -euo pipefail

# scripts/run-task5-verify.sh
# Usage example:
# ./scripts/run-task5-verify.sh \
#   --kubeconfig ~/.kube/config \
#   --namespace staging \
#   --release payments \
#   --db-url "postgres://user:pass@host:5432/db" \
#   --redis-host redis-host \
#   --export-bucket my-export-bucket \
#   --run-newman

KUBECONFIG_PATH="${HOME}/.kube/config"
NAMESPACE="staging"
RELEASE="payments"
DB_URL=""
REDIS_HOST=""
EXPORT_BUCKET=""
RUN_NEWMAN=false
REPORT_DIR="reports/task5"
VALUES_FILE="helm/payments/values.yaml"

while [[ $# -gt 0 ]]; do
  case $1 in
    --kubeconfig) KUBECONFIG_PATH="$2"; shift 2;;
    --namespace) NAMESPACE="$2"; shift 2;;
    --release) RELEASE="$2"; shift 2;;
    --db-url) DB_URL="$2"; shift 2;;
    --redis-host) REDIS_HOST="$2"; shift 2;;
    --export-bucket) EXPORT_BUCKET="$2"; shift 2;;
    --run-newman) RUN_NEWMAN=true; shift;;
    --values-file) VALUES_FILE="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

export KUBECONFIG="$KUBECONFIG_PATH"
mkdir -p "$REPORT_DIR"

echo "STEP 1: Helm lint"
helm lint helm/payments || echo "helm lint returned warnings"

echo "STEP 2: Prepare values for deploy"
if command -v yq >/dev/null 2>&1; then
  yq e ".reports.enabled = true | .reports.exportBucket = \"${EXPORT_BUCKET}\" | .redis.host = \"${REDIS_HOST}\"" "$VALUES_FILE" > "$REPORT_DIR/values_for_deploy.yaml"
  DEPLOY_VALUES="$REPORT_DIR/values_for_deploy.yaml"
else
  cp "$VALUES_FILE" "$REPORT_DIR/values_for_deploy.yaml"
  DEPLOY_VALUES="$REPORT_DIR/values_for_deploy.yaml"
  echo "yq not found; copied values file to $DEPLOY_VALUES. Edit exportBucket and redis.host manually if needed."
fi

echo "STEP 3: Deploy Helm chart"
helm upgrade --install "$RELEASE" helm/payments -n "$NAMESPACE" --values "$DEPLOY_VALUES" --wait --timeout 5m

echo "STEP 4: Verify report worker deployment"
kubectl -n "$NAMESPACE" get deploy "${RELEASE}-report-worker" -o wide || { echo "Deployment not found"; exit 1; }
kubectl -n "$NAMESPACE" rollout status deploy/"${RELEASE}-report-worker" --timeout=120s

echo "STEP 5: Collect worker logs"
POD=$(kubectl -n "$NAMESPACE" get pods -l app=${RELEASE}-report-worker -o jsonpath='{.items[0].metadata.name}' || true)
if [ -n "$POD" ]; then
  kubectl -n "$NAMESPACE" logs "$POD" --tail=200 > "$REPORT_DIR/worker_logs.txt" || true
  echo "Worker logs saved to $REPORT_DIR/worker_logs.txt"
else
  echo "No worker pod found; skipping logs."
fi

if [ -n "${ADMIN_JWT:-}" ] && [ -n "${BASE_URL:-}" ]; then
  echo "STEP 6: Enqueue export via API"
  RESP=$(curl -sS -X POST "${BASE_URL}/admin/reconciliation/report/export" \
    -H "Authorization: ${ADMIN_JWT}" \
    -H "Content-Type: application/json" \
    -d '{"format":"csv","filter":{"status":"paid"}}')
  echo "$RESP" > "$REPORT_DIR/enqueue_response.json"
  echo "Enqueue response saved to $REPORT_DIR/enqueue_response.json"
  JOB_ID=$(jq -r '.jobId' "$REPORT_DIR/enqueue_response.json" || true)
  echo "JobId: $JOB_ID"
else
  echo "ADMIN_JWT or BASE_URL not set; skipping API enqueue step."
fi

if [ "$RUN_NEWMAN" = true ]; then
  if command -v newman >/dev/null 2>&1; then
    echo "STEP 7: Running Newman E2E"
    newman run postman/postman_reconciliation_export.json -e postman/cargobit-payment-playbook/postman_env_staging.json --reporters cli,junit --reporter-junit-export "$REPORT_DIR/newman-export.xml" || {
      echo "Newman failed; see $REPORT_DIR/newman-export.xml"; exit 1;
    }
    echo "Newman report: $REPORT_DIR/newman-export.xml"
  else
    echo "Newman not installed; skipping E2E"
  fi
fi

if [ -n "$DB_URL" ]; then
  echo "STEP 8: Poll export_jobs table for job status"
  for i in {1..30}; do
    echo "Polling export_jobs (attempt $i)..."
    psql "$DB_URL" -At -c "SELECT id,status,result_url,error,updated_at FROM export_jobs ORDER BY created_at DESC LIMIT 10;" > "$REPORT_DIR/export_jobs_snapshot.txt" || true
    cat "$REPORT_DIR/export_jobs_snapshot.txt"
    grep -q "done" "$REPORT_DIR/export_jobs_snapshot.txt" && break || sleep 5
  done
fi

if [ -n "$EXPORT_BUCKET" ]; then
  echo "STEP 9: List S3 exports"
  aws s3 ls "s3://${EXPORT_BUCKET}/exports/" > "$REPORT_DIR/s3_exports.txt" || true
  cat "$REPORT_DIR/s3_exports.txt"
fi

echo "Verification artifacts saved in $REPORT_DIR"
echo "Artifacts to share for review:"
echo "- $REPORT_DIR/worker_logs.txt"
echo "- $REPORT_DIR/enqueue_response.json"
echo "- $REPORT_DIR/export_jobs_snapshot.txt"
echo "- $REPORT_DIR/newman-export.xml"
echo "- $REPORT_DIR/s3_exports.txt"
