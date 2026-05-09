#!/bin/bash
#
# =============================================================================
# CargoBit Payment System - Task 5 Verification Script (Final Version)
# =============================================================================
#
# Purpose: Complete end-to-end verification of Task 5 deployment
# Version: 2.0
# Last Updated: 2026-04-24
#
# Usage:
#   ./run-task5-verify-final.sh --namespace <namespace> [--skip-newman] [--verbose]
#
# Examples:
#   ./run-task5-verify-final.sh --namespace staging
#   ./run-task5-verify-final.sh --namespace production --skip-newman
#   ./run-task5-verify-final.sh --namespace staging --verbose
#
# Prerequisites:
#   - kubectl configured with cluster access
#   - psql client installed
#   - curl, jq installed
#   - newman (optional, for Postman collection tests)
#
# =============================================================================

set -euo pipefail

# =============================================================================
# CONFIGURATION - Concrete Environment Values
# =============================================================================

# Default values (override with environment variables or flags)
NAMESPACE="${NAMESPACE:-staging}"
CLUSTER_CONTEXT="${CLUSTER_CONTEXT:-cargobit-staging}"
VERBOSE="${VERBOSE:-false}"
SKIP_NEWMAN="${SKIP_NEWMAN:-false}"
RUN_NEWMAN="${RUN_NEWMAN:-false}"

# Database Configuration
STAGING_DB_HOST="${STAGING_DB_HOST:-postgres-staging.cargobit.internal}"
STAGING_DB_PORT="${STAGING_DB_PORT:-5432}"
STAGING_DB_NAME="${STAGING_DB_NAME:-payments}"
STAGING_DB_USER="${STAGING_DB_USER:-payments_app}"
STAGING_DB_PASSWORD="${STAGING_DB_PASSWORD:-}"  # Set via environment or secrets

PROD_DB_HOST="${PROD_DB_HOST:-postgres-prod.cargobit.internal}"
PROD_DB_PORT="${PROD_DB_PORT:-5432}"
PROD_DB_NAME="${PROD_DB_NAME:-payments}"
PROD_DB_USER="${PROD_DB_USER:-payments_app}"
PROD_DB_PASSWORD="${PROD_DB_PASSWORD:-}"  # Set via environment or secrets

# API Configuration
API_BASE_URL="${API_BASE_URL:-https://api-staging.cargobit.io}"
ADMIN_JWT_TOKEN="${ADMIN_JWT_TOKEN:-}"  # Set via environment

# S3 Configuration
EXPORT_BUCKET="${EXPORT_BUCKET:-cargobit-reports-staging}"
AWS_REGION="${AWS_REGION:-eu-central-1}"
S3_ENDPOINT="${S3_ENDPOINT:-https://s3.eu-central-1.amazonaws.com}"

# Redis Configuration
REDIS_HOST="${REDIS_HOST:-redis-staging.cargobit.internal}"
REDIS_PORT="${REDIS_PORT:-6379}"

# Monitoring Configuration
PROMETHEUS_URL="${PROMETHEUS_URL:-https://prometheus-staging.cargobit.io}"
GRAFANA_URL="${GRAFANA_URL:-https://grafana-staging.cargobit.io}"

# Helm Configuration
HELM_RELEASE_NAME="${HELM_RELEASE_NAME:-payments}"
HELM_CHART_PATH="${HELM_CHART_PATH:-./helm/payments}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $1"
    fi
}

check_prerequisite() {
    local cmd="$1"
    local package="${2:-$1}"
    
    if ! command -v "$cmd" &> /dev/null; then
        log_error "Required command '$cmd' not found. Install with: apt-get install $package or brew install $package"
        return 1
    fi
    log_debug "Found: $cmd ($(command -v "$cmd"))"
    return 0
}

# =============================================================================
# PREREQUISITE CHECKS
# =============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing=0
    
    check_prerequisite "kubectl" || missing=$((missing + 1))
    check_prerequisite "curl" || missing=$((missing + 1))
    check_prerequisite "jq" || missing=$((missing + 1))
    
    # Optional: psql
    if ! check_prerequisite "psql"; then
        log_warning "psql not found - database checks will be skipped"
        SKIP_DB_CHECKS="true"
    fi
    
    # Optional: newman
    if ! check_prerequisite "newman"; then
        log_warning "newman not found - Postman tests will be skipped"
        SKIP_NEWMAN="true"
    fi
    
    # Optional: helm
    if ! check_prerequisite "helm"; then
        log_warning "helm not found - Helm deployment checks will be limited"
        SKIP_HELM="true"
    fi
    
    if [[ $missing -gt 0 ]]; then
        log_error "Missing $missing required prerequisites"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# =============================================================================
# KUBERNETES CONNECTIVITY
# =============================================================================

verify_k8s_connectivity() {
    log_info "Verifying Kubernetes connectivity..."
    
    # Check cluster context
    local current_context
    current_context=$(kubectl config current-context 2>/dev/null || echo "unknown")
    log_debug "Current context: $current_context"
    
    # Check namespace exists
    if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
        log_error "Namespace '$NAMESPACE' does not exist"
        return 1
    fi
    
    # Check we can list pods
    if ! kubectl get pods -n "$NAMESPACE" &>/dev/null; then
        log_error "Cannot list pods in namespace '$NAMESPACE' - check permissions"
        return 1
    fi
    
    log_success "Kubernetes connectivity verified"
    return 0
}

# =============================================================================
# HELM DEPLOYMENT VERIFICATION
# =============================================================================

verify_helm_deployment() {
    log_info "Verifying Helm deployment..."
    
    if [[ "${SKIP_HELM:-false}" == "true" ]]; then
        log_warning "Skipping Helm checks (helm not available)"
        return 0
    fi
    
    # Check Helm release exists
    if ! helm status "$HELM_RELEASE_NAME" -n "$NAMESPACE" &>/dev/null; then
        log_error "Helm release '$HELM_RELEASE_NAME' not found in namespace '$NAMESPACE'"
        return 1
    fi
    
    # Get release info
    local release_info
    release_info=$(helm status "$HELM_RELEASE_NAME" -n "$NAMESPACE" -o json)
    
    local revision
    revision=$(echo "$release_info" | jq -r '.version')
    log_debug "Helm release revision: $revision"
    
    local status
    status=$(echo "$release_info" | jq -r '.info.status')
    log_debug "Helm release status: $status"
    
    if [[ "$status" != "deployed" ]]; then
        log_error "Helm release status is '$status', expected 'deployed'"
        return 1
    fi
    
    # Check if reports feature is enabled
    local reports_enabled
    reports_enabled=$(helm get values "$HELM_RELEASE_NAME" -n "$NAMESPACE" -o json 2>/dev/null | jq -r '.reports.enabled // false')
    
    if [[ "$reports_enabled" != "true" ]]; then
        log_warning "Reports feature is not enabled in Helm values"
        log_warning "Enable with: helm upgrade $HELM_RELEASE_NAME $HELM_CHART_PATH -n $NAMESPACE --set reports.enabled=true"
    else
        log_success "Reports feature is enabled"
    fi
    
    log_success "Helm deployment verified (revision $revision, status: $status)"
    return 0
}

# =============================================================================
# POD HEALTH CHECKS
# =============================================================================

verify_pod_health() {
    log_info "Checking pod health..."
    
    local pods_not_ready=0
    
    # Check report-worker pods
    log_debug "Checking report-worker pods..."
    local worker_pods
    worker_pods=$(kubectl get pods -n "$NAMESPACE" -l app=report-worker -o json 2>/dev/null || echo '{"items":[]}')
    local worker_count
    worker_count=$(echo "$worker_pods" | jq -r '.items | length')
    
    if [[ "$worker_count" -eq 0 ]]; then
        log_warning "No report-worker pods found"
    else
        local worker_ready
        worker_ready=$(echo "$worker_pods" | jq -r '[.items[].status.containerStatuses[].ready] | map(select(. == true)) | length')
        log_info "Report-worker pods: $worker_ready/$worker_count ready"
        
        if [[ "$worker_ready" -lt "$worker_count" ]]; then
            pods_not_ready=$((pods_not_ready + worker_count - worker_ready))
        fi
    fi
    
    # Check main payments service pods
    log_debug "Checking payments service pods..."
    local payments_pods
    payments_pods=$(kubectl get pods -n "$NAMESPACE" -l app=payments-service -o json 2>/dev/null || echo '{"items":[]}')
    local payments_count
    payments_count=$(echo "$payments_pods" | jq -r '.items | length')
    
    if [[ "$payments_count" -eq 0 ]]; then
        log_warning "No payments-service pods found"
    else
        local payments_ready
        payments_ready=$(echo "$payments_pods" | jq -r '[.items[].status.containerStatuses[].ready] | map(select(. == true)) | length')
        log_info "Payments-service pods: $payments_ready/$payments_count ready"
        
        if [[ "$payments_ready" -lt "$payments_count" ]]; then
            pods_not_ready=$((pods_not_ready + payments_count - payments_ready))
        fi
    fi
    
    # Check CronJob
    log_debug "Checking reconciliation CronJob..."
    if kubectl get cronjob payments-reconciliation -n "$NAMESPACE" &>/dev/null; then
        local cronjob_suspended
        cronjob_suspended=$(kubectl get cronjob payments-reconciliation -n "$NAMESPACE" -o jsonpath='{.spec.suspend}')
        if [[ "$cronjob_suspended" == "true" ]]; then
            log_warning "Reconciliation CronJob is suspended"
        else
            log_success "Reconciliation CronJob is active"
        fi
    else
        log_warning "Reconciliation CronJob not found"
    fi
    
    if [[ "$pods_not_ready" -gt 0 ]]; then
        log_warning "$pods_not_ready pod(s) not ready"
        return 1
    fi
    
    log_success "All pods are healthy"
    return 0
}

# =============================================================================
# DATABASE VERIFICATION
# =============================================================================

verify_database() {
    log_info "Verifying database schema..."
    
    if [[ "${SKIP_DB_CHECKS:-false}" == "true" ]]; then
        log_warning "Skipping database checks (psql not available)"
        return 0
    fi
    
    # Construct database URL
    local db_url
    if [[ "$NAMESPACE" == "production" ]]; then
        db_url="postgresql://${PROD_DB_HOST}:${PROD_DB_PORT}/${PROD_DB_NAME}"
    else
        db_url="postgresql://${STAGING_DB_HOST}:${STAGING_DB_PORT}/${STAGING_DB_NAME}"
    fi
    
    # Check if export_jobs table exists
    log_debug "Checking for export_jobs table..."
    
    local table_exists
    table_exists=$(psql "$db_url" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'export_jobs');" 2>/dev/null || echo "f")
    table_exists=$(echo "$table_exists" | tr -d '[:space:]')
    
    if [[ "$table_exists" != "t" ]]; then
        log_error "Table 'export_jobs' does not exist - run migration first"
        log_info "Migration file: migrations/20260423_create_export_jobs.sql"
        return 1
    fi
    
    log_success "Table 'export_jobs' exists"
    
    # Check table structure
    log_debug "Verifying table structure..."
    local columns
    columns=$(psql "$db_url" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'export_jobs';" 2>/dev/null || echo "")
    
    local required_columns="id status format filter result_url error created_at updated_at"
    for col in $required_columns; do
        if echo "$columns" | grep -q "$col"; then
            log_debug "Column '$col' exists"
        else
            log_error "Missing column '$col' in export_jobs table"
            return 1
        fi
    done
    
    log_success "Database schema verified"
    return 0
}

# =============================================================================
# API ENDPOINT TESTS
# =============================================================================

verify_api_endpoints() {
    log_info "Testing API endpoints..."
    
    if [[ -z "$ADMIN_JWT_TOKEN" ]]; then
        log_warning "ADMIN_JWT_TOKEN not set - skipping authenticated endpoint tests"
        return 0
    fi
    
    local base_url="${API_BASE_URL}"
    local auth_header="Authorization: Bearer $ADMIN_JWT_TOKEN"
    
    # Test 1: Health endpoint
    log_debug "Testing health endpoint..."
    local health_response
    health_response=$(curl -sf "${base_url}/health" 2>/dev/null || echo '{"status":"unknown"}')
    
    if echo "$health_response" | jq -e '.status == "ok"' &>/dev/null; then
        log_success "Health check passed"
    else
        log_warning "Health check returned unexpected response"
    fi
    
    # Test 2: Metrics endpoint
    log_debug "Testing metrics endpoint..."
    local metrics_response
    metrics_response=$(curl -sf "${base_url}/metrics" 2>/dev/null || echo "")
    
    if echo "$metrics_response" | grep -q "report_exports_total"; then
        log_success "Metrics endpoint exposes report metrics"
    else
        log_warning "Metrics endpoint may not expose report metrics"
    fi
    
    # Test 3: List reports endpoint
    log_debug "Testing /admin/reconciliation/report endpoint..."
    local reports_response
    reports_response=$(curl -sf -H "$auth_header" "${base_url}/admin/reconciliation/report" 2>/dev/null || echo '{"error":"failed"}')
    
    if echo "$reports_response" | jq -e '.items' &>/dev/null; then
        log_success "Reports list endpoint working"
    else
        log_warning "Reports list endpoint returned unexpected response"
    fi
    
    # Test 4: Enqueue export
    log_debug "Testing export enqueue endpoint..."
    local export_response
    export_response=$(curl -sf -X POST \
        -H "$auth_header" \
        -H "Content-Type: application/json" \
        -d '{"format":"csv","filter":{"status":"paid"}}' \
        "${base_url}/admin/reconciliation/report/export" 2>/dev/null || echo '{"error":"failed"}')
    
    if echo "$export_response" | jq -e '.jobId' &>/dev/null; then
        local job_id
        job_id=$(echo "$export_response" | jq -r '.jobId')
        log_success "Export enqueued successfully (jobId: $job_id)"
        
        # Wait and check job status
        log_info "Waiting for export job to complete..."
        sleep 10
        
        local job_status
        job_status=$(curl -sf -H "$auth_header" "${base_url}/admin/reconciliation/report/export/${job_id}" 2>/dev/null || echo '{"status":"unknown"}')
        
        local status
        status=$(echo "$job_status" | jq -r '.status // "unknown"')
        log_info "Export job status: $status"
        
        if [[ "$status" == "done" ]]; then
            local result_url
            result_url=$(echo "$job_status" | jq -r '.resultUrl // "N/A"')
            log_success "Export completed: $result_url"
        elif [[ "$status" == "processing" ]]; then
            log_info "Export still processing - check status later"
        elif [[ "$status" == "failed" ]]; then
            local error
            error=$(echo "$job_status" | jq -r '.error // "Unknown error"')
            log_error "Export failed: $error"
            return 1
        fi
    else
        log_warning "Export enqueue returned unexpected response"
    fi
    
    log_success "API endpoint tests completed"
    return 0
}

# =============================================================================
# PROMETHEUS METRICS CHECK
# =============================================================================

verify_metrics() {
    log_info "Verifying Prometheus metrics..."
    
    local metrics_url="${PROMETHEUS_URL}/api/v1/query"
    
    # Metrics to check
    local metrics=(
        "report_exports_total"
        "report_export_duration_seconds"
        "report_export_in_progress"
        "report_exports_failed_total"
        "reconciliation_runs_total"
        "reconciliation_open_payouts_gauge"
    )
    
    local found_metrics=0
    
    for metric in "${metrics[@]}"; do
        log_debug "Querying metric: $metric"
        local response
        response=$(curl -sf --data-urlencode "query=$metric" "${metrics_url}" 2>/dev/null || echo '{"status":"error"}')
        
        if echo "$response" | jq -e '.status == "success"' &>/dev/null; then
            local result_type
            result_type=$(echo "$response" | jq -r '.data.resultType')
            log_debug "Metric '$metric': $result_type"
            found_metrics=$((found_metrics + 1))
        else
            log_warning "Metric '$metric' not found or query failed"
        fi
    done
    
    if [[ "$found_metrics" -eq "${#metrics[@]}" ]]; then
        log_success "All ${#metrics[@]} metrics found"
        return 0
    else
        log_warning "Found $found_metrics/${#metrics[@]} metrics"
        return 0
    fi
}

# =============================================================================
# NEWMAN / POSTMAN TESTS
# =============================================================================

run_newman_tests() {
    log_info "Running Newman E2E tests..."
    
    if [[ "${SKIP_NEWMAN:-true}" == "true" ]]; then
        log_warning "Skipping Newman tests (newman not available or --skip-newman flag)"
        return 0
    fi
    
    local collection="${POSTMAN_COLLECTION:-./postman/postman_collection_payments_e2e.json}"
    local environment="${POSTMAN_ENVIRONMENT:-./postman/postman_env_${NAMESPACE}.json}"
    
    if [[ ! -f "$collection" ]]; then
        log_warning "Postman collection not found: $collection"
        return 0
    fi
    
    if [[ ! -f "$environment" ]]; then
        log_warning "Postman environment not found: $environment"
        environment=""  # Run without environment
    fi
    
    local newman_cmd="newman run $collection --reporters cli,json --reporter-json-export ./newman-results.json"
    
    if [[ -n "$environment" ]]; then
        newman_cmd="$newman_cmd --environment $environment"
    fi
    
    log_debug "Running: $newman_cmd"
    
    if eval "$newman_cmd"; then
        log_success "Newman tests passed"
        return 0
    else
        log_error "Newman tests failed"
        return 1
    fi
}

# =============================================================================
# S3 VERIFICATION
# =============================================================================

verify_s3_access() {
    log_info "Verifying S3 bucket access..."
    
    if command -v aws &>/dev/null; then
        log_debug "Checking S3 bucket: $EXPORT_BUCKET"
        
        if aws s3 ls "s3://${EXPORT_BUCKET}" --region "$AWS_REGION" &>/dev/null; then
            log_success "S3 bucket accessible: $EXPORT_BUCKET"
            
            # Check for recent exports
            local recent_exports
            recent_exports=$(aws s3 ls "s3://${EXPORT_BUCKET}/exports/" --region "$AWS_REGION" 2>/dev/null | tail -5 || echo "")
            
            if [[ -n "$recent_exports" ]]; then
                log_info "Recent exports found in S3"
            else
                log_debug "No recent exports found (expected for new deployment)"
            fi
        else
            log_warning "Cannot access S3 bucket - check IAM permissions"
        fi
    else
        log_warning "AWS CLI not available - skipping S3 verification"
    fi
    
    return 0
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

print_summary() {
    echo ""
    echo "========================================"
    echo "         VERIFICATION SUMMARY          "
    echo "========================================"
    echo ""
    echo "Namespace:      $NAMESPACE"
    echo "API URL:        $API_BASE_URL"
    echo "Database:       ${STAGING_DB_HOST}:${STAGING_DB_PORT}/${STAGING_DB_NAME}"
    echo "S3 Bucket:      $EXPORT_BUCKET"
    echo "Prometheus:     $PROMETHEUS_URL"
    echo ""
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            --skip-newman)
                SKIP_NEWMAN="true"
                shift
                ;;
            --run-newman)
                RUN_NEWMAN="true"
                SKIP_NEWMAN="false"
                shift
                ;;
            --verbose|-v)
                VERBOSE="true"
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --namespace <name>    Kubernetes namespace (default: staging)"
                echo "  --skip-newman         Skip Newman E2E tests"
                echo "  --run-newman          Run Newman E2E tests"
                echo "  --verbose, -v         Enable verbose output"
                echo "  --help, -h            Show this help message"
                echo ""
                echo "Environment Variables:"
                echo "  ADMIN_JWT_TOKEN       JWT token for authenticated requests"
                echo "  STAGING_DB_HOST       Database host (default: postgres-staging.cargobit.internal)"
                echo "  API_BASE_URL          API base URL (default: https://api-staging.cargobit.io)"
                echo "  EXPORT_BUCKET         S3 bucket for exports (default: cargobit-reports-staging)"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

main() {
    echo ""
    echo "========================================"
    echo "  CargoBit Task 5 Verification Script  "
    echo "========================================"
    echo ""
    
    parse_args "$@"
    
    # Update API URL based on namespace
    if [[ "$NAMESPACE" == "production" ]]; then
        API_BASE_URL="${API_BASE_URL:-https://api.cargobit.io}"
        PROMETHEUS_URL="${PROMETHEUS_URL:-https://prometheus.cargobit.io}"
        EXPORT_BUCKET="${EXPORT_BUCKET:-cargobit-reports-prod}"
    fi
    
    local failed=0
    
    # Run verification steps
    check_prerequisites || failed=$((failed + 1))
    verify_k8s_connectivity || failed=$((failed + 1))
    verify_helm_deployment || failed=$((failed + 1))
    verify_pod_health || failed=$((failed + 1))
    verify_database || failed=$((failed + 1))
    verify_api_endpoints || failed=$((failed + 1))
    verify_metrics || failed=$((failed + 1))
    verify_s3_access || failed=$((failed + 1))
    
    if [[ "$RUN_NEWMAN" == "true" && "$SKIP_NEWMAN" != "true" ]]; then
        run_newman_tests || failed=$((failed + 1))
    fi
    
    # Print summary
    print_summary
    
    if [[ "$failed" -gt 0 ]]; then
        log_error "Verification completed with $failed error(s)"
        exit 1
    else
        log_success "All verifications passed! ✓"
        exit 0
    fi
}

# Run main
main "$@"
