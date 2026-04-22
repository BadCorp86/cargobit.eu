#!/usr/bin/env bash
# =============================================================================
# start-backend-safe.sh
# Safely starts the Payments Backend with environment validation and sanitization
# =============================================================================
#
# Deployment: chmod 700 und chown appuser:appuser
# Usage: Wird von systemd backend.service aufgerufen
#
# Sicherheits-Hinweise:
# - .env nur für Staging; in Produktion Secrets aus Secret Manager
# - Dateirechte: chmod 600 /srv/app/.env
# - Dieses Skript sollte nur von appuser ausgeführt werden
# =============================================================================

set -euo pipefail

ENV_FILE="/srv/app/.env"
REQUIRED_VARS=(
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  DATABASE_URL
  REDIS_HOST
  REDIS_PORT
  DEFAULT_STRIPE_ACCOUNT_ID
)

# Farbcodes für Logging
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
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

# =============================================================================
# 1. Prüfe Environment-File existiert
# =============================================================================
if [ ! -f "$ENV_FILE" ]; then
  log_error "Missing env file: $ENV_FILE"
  exit 1
fi

# Prüfe Dateirechte (sollten 600 sein)
ENV_PERMS=$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE" 2>/dev/null)
if [ "$ENV_PERMS" != "600" ]; then
  log_warn "Env file permissions are $ENV_PERMS, recommended: 600"
fi

# =============================================================================
# 2. Lade Environment-Variablen
# =============================================================================
log_info "Loading environment from $ENV_FILE"

set -o allexport
source "$ENV_FILE"
set +o allexport

# =============================================================================
# 3. Validierung der Required Variables
# =============================================================================
log_info "Validating required environment variables..."

MISSING_VARS=()
for v in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!v:-}" ]; then
    MISSING_VARS+=("$v")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  log_error "Required env vars not set: ${MISSING_VARS[*]}"
  exit 1
fi

log_info "All required environment variables are set"

# =============================================================================
# 4. Sanitization (entferne Whitespaces, Newlines, Carriage Returns)
# =============================================================================
log_info "Sanitizing environment variables..."

STRIPE_SECRET_KEY="$(echo -n "$STRIPE_SECRET_KEY" | tr -d '\r\n' | xargs)"
STRIPE_WEBHOOK_SECRET="$(echo -n "$STRIPE_WEBHOOK_SECRET" | tr -d '\r\n' | xargs)"
DATABASE_URL="$(echo -n "$DATABASE_URL" | tr -d '\r\n' | xargs)"
REDIS_HOST="$(echo -n "$REDIS_HOST" | tr -d '\r\n' | xargs)"
REDIS_PORT="$(echo -n "$REDIS_PORT" | tr -d '\r\n' | xargs)"
DEFAULT_STRIPE_ACCOUNT_ID="$(echo -n "$DEFAULT_STRIPE_ACCOUNT_ID" | tr -d '\r\n' | xargs)"

# Hostname mit Fallback
HOSTNAME="${HOSTNAME:-$(hostname)}"
HOSTNAME="$(echo -n "$HOSTNAME" | tr -d '\r\n' | xargs)"

# =============================================================================
# 5. Validierung der Formate
# =============================================================================
log_info "Validating variable formats..."

# Stripe Key Format
if [[ ! "$STRIPE_SECRET_KEY" =~ ^sk_(test|live)_[a-zA-Z0-9]+$ ]]; then
  log_warn "STRIPE_SECRET_KEY does not match expected format (sk_test_... or sk_live_...)"
fi

# Database URL Format
if [[ ! "$DATABASE_URL" =~ ^postgres(ql)?:// ]]; then
  log_error "DATABASE_URL must start with postgres:// or postgresql://"
  exit 1
fi

# Redis Port Range
if ! [[ "$REDIS_PORT" =~ ^[0-9]+$ ]] || [ "$REDIS_PORT" -lt 1 ] || [ "$REDIS_PORT" -gt 65535 ]; then
  log_error "REDIS_PORT must be a valid port number (1-65535)"
  exit 1
fi

# =============================================================================
# 6. Export für Node.js Prozess
# =============================================================================
export STRIPE_SECRET_KEY
export STRIPE_WEBHOOK_SECRET
export DATABASE_URL
export REDIS_HOST
export REDIS_PORT
export DEFAULT_STRIPE_ACCOUNT_ID
export HOSTNAME
export NODE_ENV="${NODE_ENV:-production}"

# =============================================================================
# 7. Health Check: Redis Verbindung
# =============================================================================
log_info "Checking Redis connectivity..."
if command -v redis-cli &> /dev/null; then
  if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
    log_info "Redis connection OK"
  else
    log_warn "Redis connection failed - proceeding anyway (may fail at runtime)"
  fi
else
  log_info "redis-cli not available, skipping Redis connectivity check"
fi

# =============================================================================
# 8. Start Node.js Anwendung
# =============================================================================
log_info "Starting Payments Backend..."
log_info "NODE_ENV=$NODE_ENV, HOSTNAME=$HOSTNAME"
log_info "Redis: $REDIS_HOST:$REDIS_PORT"

# Wechsle ins Arbeitsverzeichnis
cd /srv/app

# Starte Node.js (exec ersetzt die Shell, damit Signale korrekt weitergeleitet werden)
exec /usr/bin/node dist/src/main.js
