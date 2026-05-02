#!/usr/bin/env bash
# =============================================================================
# PostgreSQL Backup Script
# =============================================================================
# Creates compressed backups of the PostgreSQL database and uploads to S3
# 
# Usage:
#   ./backup-db.sh [--full | --incremental]
#
# Environment Variables:
#   DATABASE_URL     - PostgreSQL connection string
#   BACKUP_BUCKET    - S3 bucket name (e.g., cargobit-backups)
#   AWS_REGION       - AWS region (default: eu-central-1)
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/tmp/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y-%m-%d)
BACKUP_TYPE="${1:-full}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Prerequisites Check
# =============================================================================

check_prerequisites() {
  local missing=()

  if [[ -z "${DATABASE_URL:-}" ]]; then
    missing+=("DATABASE_URL")
  fi

  if [[ -z "${BACKUP_BUCKET:-}" ]]; then
    missing+=("BACKUP_BUCKET")
  fi

  if ! command -v pg_dump &> /dev/null; then
    missing+=("pg_dump (postgresql-client)")
  fi

  if ! command -v aws &> /dev/null; then
    missing+=("aws-cli")
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    log_error "Missing prerequisites: ${missing[*]}"
    exit 1
  fi
}

# =============================================================================
# Backup Functions
# =============================================================================

create_backup_dir() {
  mkdir -p "${BACKUP_DIR}"
}

create_full_backup() {
  local backup_file="${BACKUP_DIR}/cargobit_full_${TIMESTAMP}.dump"
  local sql_file="${BACKUP_DIR}/cargobit_full_${TIMESTAMP}.sql"

  log_info "Creating full backup..."

  # Create compressed custom format backup (for pg_restore)
  pg_dump --format=custom \
          --no-owner \
          --no-privileges \
          --verbose \
          "${DATABASE_URL}" > "${backup_file}"

  if [[ $? -eq 0 ]]; then
    log_info "Created: ${backup_file} ($(du -h "${backup_file}" | cut -f1))"

    # Also create plain SQL (for human readability)
    pg_dump --format=plain \
            --no-owner \
            --no-privileges \
            "${DATABASE_URL}" | gzip > "${sql_file}.gz"

    log_info "Created: ${sql_file}.gz ($(du -h "${sql_file}.gz" | cut -f1))"

    # Upload to S3
    upload_to_s3 "${backup_file}" "full/"
    upload_to_s3 "${sql_file}.gz" "sql/"

    # Cleanup local files
    rm -f "${backup_file}" "${sql_file}.gz"

    return 0
  else
    log_error "Backup failed!"
    return 1
  fi
}

create_incremental_backup() {
  # Note: Incremental backups require WAL archiving to be enabled
  # This is a simplified version for Neon/managed Postgres

  log_info "Creating incremental backup (WAL segments)..."

  if command -v wal-g &> /dev/null; then
    wal-g backup-push "${DATABASE_URL}"
  else
    log_warn "wal-g not installed, falling back to full backup"
    create_full_backup
  fi
}

upload_to_s3() {
  local file="$1"
  local prefix="$2"
  local filename=$(basename "${file}")
  local s3_path="s3://${BACKUP_BUCKET}/postgres/${prefix}${filename}"

  log_info "Uploading to S3: ${s3_path}"

  aws s3 cp "${file}" "${s3_path}" \
    --storage-class STANDARD_IA \
    --server-side-encryption aws:kms \
    --only-show-errors

  if [[ $? -eq 0 ]]; then
    log_info "Upload successful"
  else
    log_error "Upload failed!"
    exit 1
  fi
}

cleanup_old_backups() {
  log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."

  # Delete old backups from S3
  local cutoff_date=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d)

  aws s3 ls "s3://${BACKUP_BUCKET}/postgres/full/" | \
    awk '{print $2}' | \
    while read -r prefix; do
      local backup_date=$(echo "${prefix}" | grep -oE '[0-9]{8}' | head -1)
      if [[ -n "${backup_date}" ]]; then
        local formatted_date=$(echo "${backup_date}" | sed 's/\(....\)\(..\)/\1-\2-/')
        if [[ "${formatted_date}" < "${cutoff_date}" ]]; then
          log_info "Deleting old backup: ${prefix}"
          aws s3 rm "s3://${BACKUP_BUCKET}/postgres/full/${prefix}" --recursive
        fi
      fi
    done

  # Cleanup local temp files
  find "${BACKUP_DIR}" -name "*.dump" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
  find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
}

send_notification() {
  local status="$1"
  local message="$2"

  # Send to Slack (if configured)
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    local color="${status}"
    [[ "${status}" == "success" ]] && color="good"
    [[ "${status}" == "error" ]] && color="danger"

    curl -s -X POST "${SLACK_WEBHOOK_URL}" \
      -H 'Content-Type: application/json' \
      -d "{
        \"attachments\": [{
          \"color\": \"${color}\",
          \"title\": \"Backup ${status}\",
          \"text\": \"${message}\",
          \"fields\": [
            {\"title\": \"Environment\", \"value\": \"${NODE_ENV:-production}\", \"short\": true},
            {\"title\": \"Timestamp\", \"value\": \"${TIMESTAMP}\", \"short\": true}
          ]
        }]
      }" > /dev/null
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  log_info "=========================================="
  log_info "PostgreSQL Backup - ${TIMESTAMP}"
  log_info "=========================================="

  check_prerequisites
  create_backup_dir

  local start_time=$(date +%s)

  if [[ "${BACKUP_TYPE}" == "--incremental" ]]; then
    create_incremental_backup
  else
    create_full_backup
  fi

  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  if [[ $? -eq 0 ]]; then
    log_info "Backup completed in ${duration}s"
    cleanup_old_backups
    send_notification "success" "Backup completed in ${duration}s"
    exit 0
  else
    log_error "Backup failed after ${duration}s"
    send_notification "error" "Backup failed after ${duration}s"
    exit 1
  fi
}

# Run
main "$@"
