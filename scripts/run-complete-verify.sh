#!/usr/bin/env bash
#
# ============================================================================
# CargoBit Payment Platform - Complete Verification Script
# Task 4: Payout Reconciliation + Task 5: Reconciliation Reporting & Export
# ============================================================================
#
# Usage:
#   ./scripts/run-complete-verify.sh \
#     --kubeconfig ~/.kube/config \
#     --namespace staging \
#     --release payments \
#     --db-url "postgres://user:pass@host:5432/db" \
#     --base-url "https://payments.staging.cargobit.io" \
#     --admin-jwt "Bearer xxx" \
#     --export-bucket "cargobit-exports" \
#     --aws-region "eu-central-1" \
#     --run-newman \
#     --full-verify
#
# Environment Variables (alternatives to flags):
#   DATABASE_URL, BASE_URL, ADMIN_JWT, EXPORT_BUCKET, AWS_REGION
#
set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

# Default values
KUBECONFIG_PATH="${KUBECONFIG:-$HOME/.kube/config}"
NAMESPACE="${NAMESPACE:-staging}"
RELEASE="${RELEASE:-payments}"
DB_URL="${DATABASE_URL:-}"
BASE_URL="${BASE_URL:-}"
ADMIN_JWT="${ADMIN_JWT:-}"
EXPORT_BUCKET="${EXPORT_BUCKET:-}"
REDIS_HOST="${REDIS_HOST:-}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
RUN_NEWMAN=false
FULL_VERIFY=false
REPORT_DIR="reports/verification"
VALUES_FILE="helm/payments/values.yaml"
TIMEOUT_MINUTES=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

while [[ $# -gt 0 ]]; do
  case $1 in
    --kubeconfig) KUBECONFIG_PATH="$2"; shift 2;;
    --namespace) NAMESPACE="$2"; shift 2;;
    --release) RELEASE="$2"; shift 2;;
    --db-url) DB_URL="$2"; shift 2;;
    --base-url) BASE_URL="$2"; shift 2;;
    --admin-jwt) ADMIN_JWT="$2"; shift 2;;
    --export-bucket) EXPORT_BUCKET="$2"; shift 2;;
    --redis-host) REDIS_HOST="$2"; shift 2;;
    --aws-region) AWS_REGION="$2"; shift 2;;
    --report-dir) REPORT_DIR="$2"; shift 2;;
    --values-file) VALUES_FILE="$2"; shift 2;;
    --timeout) TIMEOUT_MINUTES="$2"; shift 2;;
    --run-newman) RUN_NEWMAN=true; shift;;
    --full-verify) FULL_VERIFY=true; shift;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --kubeconfig PATH      Kubernetes config file (default: ~/.kube/config)"
      echo "  --namespace NAMESPACE  Kubernetes namespace (default: staging)"
      echo "  --release NAME         Helm release name (default: payments)"
      echo "  --db-url URL           Database connection string"
      echo "  --base-url URL         API base URL"
      echo "  --admin-jwt TOKEN      Admin JWT token"
      echo "  --export-bucket BUCKET S3 bucket for exports"
      echo "  --redis-host HOST      Redis host"
      echo "  --aws-region REGION    AWS region (default: eu-central-1)"
      echo "  --run-newman           Run Newman E2E tests"
      echo "  --full-verify          Run all verification steps"
      echo "  --report-dir DIR       Output directory for reports (default: reports/verification)"
      echo "  --timeout MINUTES      Helm timeout (default: 5)"
      exit 0
      ;;
    *) echo -e "${RED}Unknown argument: $1${NC}"; exit 1;;
  esac
done

# Export KUBECONFIG for kubectl
export KUBECONFIG="$KUBECONFIG_PATH"

# Create report directory
mkdir -p "$REPORT_DIR"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
  if ! command -v "$1" &> /dev/null; then
    log_warning "Command '$1' not found"
    return 1
  fi
  return 0
}

# ============================================================================
# BANNER
# ============================================================================

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}CargoBit Payment Platform Verification${NC}"
echo -e "${BLUE}Task 4: Payout Reconciliation${NC}"
echo -e "${BLUE}Task 5: Reconciliation Reporting & Export${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Configuration:"
echo "  Namespace:      ${NAMESPACE}"
echo "  Release:        ${RELEASE}"
echo "  Report Dir:     ${REPORT_DIR}"
echo "  Newman E2E:     ${RUN_NEWMAN}"
echo "  Full Verify:    ${FULL_VERIFY}"
echo ""

# ============================================================================
# PREREQUISITE CHECKS
# ============================================================================

log_info "Checking prerequisites..."

PREREQ_FAILED=false

if ! check_command kubectl; then
  log_error "kubectl is required for verification"
  PREREQ_FAILED=true
fi

if ! check_command helm; then
  log_error "helm is required for deployment"
  PREREQ_FAILED=true
fi

if [[ -n "$DB_URL" ]] && ! check_command psql; then
  log_warning "psql not found - database checks will be skipped"
fi

if [[ "$RUN_NEWMAN" == true ]] && ! check_command newman; then
  log_warning "newman not found - E2E tests will be skipped"
  RUN_NEWMAN=false
fi

if [[ -n "$EXPORT_BUCKET" ]] && ! check_command aws; then
  log_warning "aws CLI not found - S3 checks will be skipped"
fi

# ============================================================================
# STEP 1: HELM LINT
# ============================================================================

log_info "STEP 1: Helm lint..."
if helm lint helm/payments > "$REPORT_DIR/helm_lint.txt" 2>&1; then
  log_success "Helm lint passed"
else
  log_warning "Helm lint returned warnings (see $REPORT_DIR/helm_lint.txt)"
fi

# ============================================================================
# STEP 2: PREPARE VALUES
# ============================================================================

log_info "STEP 2: Preparing Helm values..."

if check_command yq; then
  yq e "
    .reports.enabled = true |
    .reports.exportBucket = \"${EXPORT_BUCKET}\" |
    .reports.replicas = 1 |
    .redis.host = \"${REDIS_HOST}\" |
    .aws.region = \"${AWS_REGION}\"
  " "$VALUES_FILE" > "$REPORT_DIR/values_for_deploy.yaml"
  DEPLOY_VALUES="$REPORT_DIR/values_for_deploy.yaml"
  log_success "Values prepared with yq"
else
  cp "$VALUES_FILE" "$REPORT_DIR/values_for_deploy.yaml"
  DEPLOY_VALUES="$REPORT_DIR/values_for_deploy.yaml"
  log_warning "yq not found - manual values editing may be required"
fi

# ============================================================================
# STEP 3: DEPLOY
# ============================================================================

log_info "STEP 3: Deploying Helm chart (timeout: ${TIMEOUT_MINUTES}m)..."

if helm upgrade --install "$RELEASE" helm/payments \
  -n "$NAMESPACE" \
  --values "$DEPLOY_VALUES" \
  --wait \
  --timeout "${TIMEOUT_MINUTES}m" > "$REPORT_DIR/helm_deploy.txt" 2>&1; then
  log_success "Helm deployment successful"
else
  log_error "Helm deployment failed - check $REPORT_DIR/helm_deploy.txt"
  exit 1
fi

# ============================================================================
# STEP 4: VERIFY DEPLOYMENTS
# ============================================================================

log_info "STEP 4: Verifying deployments..."

# Check main deployment
if kubectl -n "$NAMESPACE" get deploy "${RELEASE}" > /dev/null 2>&1; then
  log_success "Main deployment exists"
  kubectl -n "$NAMESPACE" rollout status deploy/"${RELEASE}" --timeout=60s > "$REPORT_DIR/main_rollout.txt" 2>&1 || true
fi

# Check reconciliation CronJob (Task 4)
if kubectl -n "$NAMESPACE" get cronjob "${RELEASE}-reconciliation" > /dev/null 2>&1; then
  log_success "Reconciliation CronJob exists (Task 4)"
  kubectl -n "$NAMESPACE" get cronjob "${RELEASE}-reconciliation" -o wide > "$REPORT_DIR/cronjob_status.txt" 2>&1
else
  log_warning "Reconciliation CronJob not found"
fi

# Check report worker deployment (Task 5)
if kubectl -n "$NAMESPACE" get deploy "${RELEASE}-report-worker" > /dev/null 2>&1; then
  log_success "Report worker deployment exists (Task 5)"
  kubectl -n "$NAMESPACE" rollout status deploy/"${RELEASE}-report-worker" --timeout=120s > "$REPORT_DIR/worker_rollout.txt" 2>&1 || true
else
  log_warning "Report worker deployment not found"
fi

# List all pods
kubectl -n "$NAMESPACE" get pods -l "app.kubernetes.io/instance=${RELEASE}" > "$REPORT_DIR/pods_list.txt" 2>&1
log_info "Pod list saved to $REPORT_DIR/pods_list.txt"

# ============================================================================
# STEP 5: COLLECT LOGS
# ============================================================================

log_info "STEP 5: Collecting logs..."

# CronJob logs (if recently run)
CRONJOB_POD=$(kubectl -n "$NAMESPACE" get pods -l "job-name" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [[ -n "$CRONJOB_POD" ]]; then
  kubectl -n "$NAMESPACE" logs "$CRONJOB_POD" --tail=500 > "$REPORT_DIR/cronjob_logs.txt" 2>&1 || true
  log_success "CronJob logs saved"
fi

# Worker logs
WORKER_POD=$(kubectl -n "$NAMESPACE" get pods -l "app.kubernetes.io/component=report-worker" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [[ -n "$WORKER_POD" ]]; then
  kubectl -n "$NAMESPACE" logs "$WORKER_POD" --tail=500 > "$REPORT_DIR/worker_logs.txt" 2>&1 || true
  log_success "Worker logs saved to $REPORT_DIR/worker_logs.txt"
else
  log_warning "No worker pod found"
fi

# ============================================================================
# STEP 6: TASK 4 VERIFICATION - RECONCILIATION
# ============================================================================

if [[ "$FULL_VERIFY" == true ]]; then
  log_info "STEP 6: Task 4 - Triggering reconciliation..."

  # Create manual job from CronJob
  JOB_NAME="temp-recon-$(date +%s)"
  if kubectl -n "$NAMESPACE" create job "$JOB_NAME" --from="cronjob/${RELEASE}-reconciliation" > /dev/null 2>&1; then
    log_success "Created reconciliation job: $JOB_NAME"

    # Wait for job to complete
    sleep 10
    kubectl -n "$NAMESPACE" wait --for=condition=complete "job/${JOB_NAME}" --timeout=300s > "$REPORT_DIR/recon_job_wait.txt" 2>&1 || true

    # Get job logs
    JOB_POD=$(kubectl -n "$NAMESPACE" get pods -l "job-name=${JOB_NAME}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
    if [[ -n "$JOB_POD" ]]; then
      kubectl -n "$NAMESPACE" logs "$JOB_POD" --tail=200 > "$REPORT_DIR/recon_job_logs.txt" 2>&1 || true
      log_success "Reconciliation job logs saved"
    fi

    # Clean up
    kubectl -n "$NAMESPACE" delete job "$JOB_NAME" > /dev/null 2>&1 || true
  else
    log_warning "Could not create reconciliation job"
  fi
fi

# ============================================================================
# STEP 7: TASK 5 VERIFICATION - EXPORT FLOW
# ============================================================================

if [[ -n "$BASE_URL" && -n "$ADMIN_JWT" ]]; then
  log_info "STEP 7: Task 5 - Testing export flow..."

  # Enqueue export
  ENQUEUE_RESPONSE=$(curl -sS -X POST "${BASE_URL}/admin/reconciliation/report/export" \
    -H "Authorization: ${ADMIN_JWT}" \
    -H "Content-Type: application/json" \
    -d '{"format":"csv","filter":{"status":"paid"}}' 2>&1 || echo '{"error": "request failed"}')

  echo "$ENQUEUE_RESPONSE" > "$REPORT_DIR/enqueue_response.json"

  if echo "$ENQUEUE_RESPONSE" | jq -e '.jobId' > /dev/null 2>&1; then
    JOB_ID=$(echo "$ENQUEUE_RESPONSE" | jq -r '.jobId')
    log_success "Export enqueued with jobId: $JOB_ID"

    # Poll for completion
    if [[ -n "$DB_URL" ]]; then
      log_info "Polling export_jobs table for completion..."
      for i in {1..30}; do
        sleep 5
        JOB_STATUS=$(psql "$DB_URL" -At -c "SELECT status FROM export_jobs WHERE id = '$JOB_ID';" 2>/dev/null || echo "unknown")
        log_info "Attempt $i: status = $JOB_STATUS"
        if [[ "$JOB_STATUS" == "done" || "$JOB_STATUS" == "failed" ]]; then
          break
        fi
      done

      # Get final snapshot
      psql "$DB_URL" -At -c "SELECT id,status,result_url,error,rows_exported,duration_ms FROM export_jobs ORDER BY created_at DESC LIMIT 10;" > "$REPORT_DIR/export_jobs_snapshot.txt" 2>&1 || true
      log_success "Export jobs snapshot saved"
    fi
  else
    log_error "Failed to enqueue export: $ENQUEUE_RESPONSE"
  fi
else
  log_warning "Skipping export flow test (BASE_URL or ADMIN_JWT not set)"
fi

# ============================================================================
# STEP 8: S3 VERIFICATION
# ============================================================================

if [[ -n "$EXPORT_BUCKET" ]] && check_command aws; then
  log_info "STEP 8: Checking S3 exports..."
  aws s3 ls "s3://${EXPORT_BUCKET}/exports/" > "$REPORT_DIR/s3_exports.txt" 2>&1 || true
  if [[ -s "$REPORT_DIR/s3_exports.txt" ]]; then
    log_success "S3 exports found:"
    cat "$REPORT_DIR/s3_exports.txt"
  else
    log_warning "No S3 exports found (bucket may be empty)"
  fi
fi

# ============================================================================
# STEP 9: METRICS VERIFICATION
# ============================================================================

if [[ -n "$BASE_URL" ]]; then
  log_info "STEP 9: Checking Prometheus metrics..."

  METRICS_URL="${BASE_URL}/metrics"

  # Task 4 metrics
  curl -fsS "$METRICS_URL" 2>/dev/null | grep -E "reconciliation_" > "$REPORT_DIR/metrics_task4.txt" || true

  # Task 5 metrics
  curl -fsS "$METRICS_URL" 2>/dev/null | grep -E "report_export" > "$REPORT_DIR/metrics_task5.txt" || true

  if [[ -s "$REPORT_DIR/metrics_task4.txt" ]]; then
    log_success "Task 4 metrics found:"
    cat "$REPORT_DIR/metrics_task4.txt" | head -10
  else
    log_warning "No Task 4 metrics found"
  fi

  if [[ -s "$REPORT_DIR/metrics_task5.txt" ]]; then
    log_success "Task 5 metrics found:"
    cat "$REPORT_DIR/metrics_task5.txt" | head -10
  else
    log_warning "No Task 5 metrics found"
  fi
fi

# ============================================================================
# STEP 10: NEWMAN E2E TESTS
# ============================================================================

if [[ "$RUN_NEWMAN" == true ]]; then
  log_info "STEP 10: Running Newman E2E tests..."

  # Task 4 tests
  if [[ -f "postman/postman_reconciliation.json" ]]; then
    log_info "Running Task 4 Newman tests..."
    newman run postman/postman_reconciliation.json \
      -e postman/cargobit-payment-playbook/postman_env_staging.json \
      --reporters cli,junit \
      --reporter-junit-export "$REPORT_DIR/newman_task4.xml" \
      --bail 2>&1 | tee "$REPORT_DIR/newman_task4_output.txt" || true
  fi

  # Task 5 tests
  if [[ -f "postman/postman_reconciliation_export.json" ]]; then
    log_info "Running Task 5 Newman tests..."
    newman run postman/postman_reconciliation_export.json \
      -e postman/cargobit-payment-playbook/postman_env_staging.json \
      --reporters cli,junit \
      --reporter-junit-export "$REPORT_DIR/newman_task5.xml" \
      --bail 2>&1 | tee "$REPORT_DIR/newman_task5_output.txt" || true
  fi
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Verification Complete${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Generated Artifacts:"
echo "  $REPORT_DIR/"
ls -la "$REPORT_DIR/" 2>/dev/null | tail -n +2 | while read line; do
  echo "    $line"
done
echo ""
echo "Key Files to Review:"
echo "  - worker_logs.txt         : Worker startup and processing logs"
echo "  - enqueue_response.json   : Export API response"
echo "  - export_jobs_snapshot.txt: Database job status"
echo "  - s3_exports.txt          : S3 artifact listing"
echo "  - metrics_task4.txt       : Reconciliation metrics"
echo "  - metrics_task5.txt       : Export metrics"
if [[ "$RUN_NEWMAN" == true ]]; then
  echo "  - newman_task4.xml        : Task 4 E2E test results"
  echo "  - newman_task5.xml        : Task 5 E2E test results"
fi
echo ""
echo -e "${GREEN}Verification completed at $(date)${NC}"
echo ""
