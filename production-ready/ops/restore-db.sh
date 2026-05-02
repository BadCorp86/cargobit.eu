#!/usr/bin/env bash
# =============================================================================
# PostgreSQL Restore Script
# =============================================================================
# Restores database from S3 backup
#
# Usage:
#   ./restore-db.sh <backup-file> [--target <database-url>]
#   ./restore-db.sh latest                    # Restore latest backup
#   ./restore-db.sh cargobit_full_20240115_030000.dump
#
# WARNING: This will OVERWRITE the existing database!
# =============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESTORE_DIR="${RESTORE_DIR:-/tmp/restore}"
BACKUP_BUCKET="${BACKUP_BUCKET:-cargobit-backups}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
# Functions
# =============================================================================

show_backups() {
  log_info "Available backups in S3:"
  echo ""
  aws s3 ls "s3://${BACKUP_BUCKET}/postgres/full/" | \
    awk '{print $2}' | \
    sort -r | \
    head -20
  echo ""
}

find_latest_backup() {
  local latest=$(aws s3 ls "s3://${BACKUP_BUCKET}/postgres/full/" | \
    awk '{print $2}' | \
    sort -r | \
    head -1 | \
    tr -d '/')

  if [[ -z "${latest}" ]]; then
    log_error "No backups found in S3"
    exit 1
  fi

  echo "${latest}"
}

download_backup() {
  local backup_name="$1"
  local backup_path="s3://${BACKUP_BUCKET}/postgres/full/${backup_name}/"

  mkdir -p "${RESTORE_DIR}"

  # Find the dump file in the backup folder
  local dump_file=$(aws s3 ls "${backup_path}" | \
    grep "\.dump$" | \
    awk '{print $4}' | \
    head -1)

  if [[ -z "${dump_file}" ]]; then
    log_error "No .dump file found in ${backup_path}"
    exit 1
  fi

  local local_file="${RESTORE_DIR}/${dump_file}"

  log_info "Downloading backup: ${backup_path}${dump_file}"
  aws s3 cp "${backup_path}${dump_file}" "${local_file}" \
    --no-progress

  echo "${local_file}"
}

confirm_restore() {
  local target_db="$1"

  echo ""
  echo "=========================================="
  echo "  WARNING: DATABASE RESTORE"
  echo "=========================================="
  echo ""
  echo "This will OVERWRITE the database:"
  echo "  ${target_db}"
  echo ""
  echo "All existing data will be LOST!"
  echo ""
  read -p "Type 'yes' to confirm: " confirm

  if [[ "${confirm}" != "yes" ]]; then
    log_info "Restore cancelled"
    exit 0
  fi
}

terminate_connections() {
  local db_url="$1"

  log_info "Terminating existing connections..."

  # Extract database name from URL
  local db_name=$(echo "${db_url}" | sed -n 's/.*\/\([^?]*\).*/\1/p')

  psql "${db_url}" -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '${db_name}'
    AND pid <> pg_backend_pid();
  " 2>/dev/null || true
}

restore_database() {
  local dump_file="$1"
  local target_url="$2"

  log_info "Restoring database from: ${dump_file}"

  # Terminate existing connections
  terminate_connections "${target_url}"

  # Restore using pg_restore
  pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --verbose \
    --dbname="${target_url}" \
    "${dump_file}"

  if [[ $? -eq 0 ]]; then
    log_info "Restore completed successfully"
    return 0
  else
    log_error "Restore failed!"
    return 1
  fi
}

verify_restore() {
  local db_url="$1"

  log_info "Verifying restore..."

  # Check critical tables exist
  local tables=$(psql "${db_url}" -t -c "
    SELECT count(*)
    FROM information_schema.tables
    WHERE table_schema = 'public'
  ")

  tables=$(echo "${tables}" | tr -d ' ')

  log_info "Found ${tables} tables in restored database"

  # Check row counts
  local users=$(psql "${db_url}" -t -c "SELECT count(*) FROM users" 2>/dev/null || echo "0")
  local payments=$(psql "${db_url}" -t -c "SELECT count(*) FROM payments" 2>/dev/null || echo "0")

  log_info "Row counts: users=${users}, payments=${payments}"

  return 0
}

# =============================================================================
# Main
# =============================================================================

main() {
  local backup_arg="${1:-}"
  local target_url="${DATABASE_URL:-}"

  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --target)
        target_url="$2"
        shift 2
        ;;
      --list)
        show_backups
        exit 0
        ;;
      *)
        backup_arg="$1"
        shift
        ;;
    esac
  done

  # Validate
  if [[ -z "${backup_arg}" ]]; then
    echo "Usage: $0 <backup-name|latest> [--target <database-url>]"
    echo "       $0 --list    # Show available backups"
    exit 1
  fi

  if [[ -z "${target_url}" ]]; then
    log_error "DATABASE_URL not set and --target not provided"
    exit 1
  fi

  # Find backup
  local backup_name="${backup_arg}"
  if [[ "${backup_arg}" == "latest" ]]; then
    backup_name=$(find_latest_backup)
    log_info "Latest backup: ${backup_name}"
  fi

  # Download
  local dump_file=$(download_backup "${backup_name}")

  # Confirm
  confirm_restore "${target_url}"

  # Restore
  local start_time=$(date +%s)
  restore_database "${dump_file}" "${target_url}"
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  # Verify
  verify_restore "${target_url}"

  # Cleanup
  rm -f "${dump_file}"

  log_info "=========================================="
  log_info "Restore completed in ${duration}s"
  log_info "=========================================="
}

main "$@"
