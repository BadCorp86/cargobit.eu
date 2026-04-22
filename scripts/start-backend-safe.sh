#!/usr/bin/env bash
# =============================================================================
# start-backend-safe.sh
# Safely starts the Payments Backend with environment validation and sanitization
# =============================================================================
set -euo pipefail

ENV_FILE="/srv/app/.env"
REQUIRED_VARS=(STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET DATABASE_URL REDIS_HOST REDIS_PORT DEFAULT_STRIPE_ACCOUNT_ID)

# Farben für Logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# =============================================================================
# 1. Prüfe Environment-File existiert
# =============================================================================
if [ ! -f "$ENV_FILE" ]; then
  log_error "Missing env file: $ENV_FILE"
  exit 1
fi

# Prüfe Dateirechte (sollten 600 sein)
ENV_PERMS=$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE" 2>/dev/null || echo "unknown")
if [ "$ENV_PERMS" != "600" ] && [ "$ENV_PERMS" != "unknown" ]; then
  log_warn "Env file permissions are $ENV_PERMS, recommended: 600"
fi

log_info "Loading environment from $ENV_FILE"

# =============================================================================
# 2. Lade Environment-Variablen sicher
# =============================================================================
set -o allexport
# shellcheck disable=SC1090
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

trim() { echo -n "$1" | tr -d '\r\n' | xargs; }

STRIPE_SECRET_KEY="$(trim "$STRIPE_SECRET_KEY")"
STRIPE_WEBHOOK_SECRET="$(trim "$STRIPE_WEBHOOK_SECRET")"
DATABASE_URL="$(trim "$DATABASE_URL")"
REDIS_HOST="$(trim "$REDIS_HOST")"
REDIS_PORT="$(trim "$REDIS_PORT")"
DEFAULT_STRIPE_ACCOUNT_ID="$(trim "$DEFAULT_STRIPE_ACCOUNT_ID")"

# Hostname mit Fallback
HOSTNAME="${HOSTNAME:-$(hostname)}"
HOSTNAME="$(trim "$HOSTNAME")"

# =============================================================================
# 5. Export für Node.js Prozess
# =============================================================================
export STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET DATABASE_URL REDIS_HOST REDIS_PORT DEFAULT_STRIPE_ACCOUNT_ID HOSTNAME NODE_ENV

# =============================================================================
# 6. Health Check: Warte auf Redis
# =============================================================================
log_info "Waiting for Redis $REDIS_HOST:$REDIS_PORT..."

MAX_RETRIES=12
RETRY_INTERVAL=5
REDIS_READY=false

for i in $(seq 1 $MAX_RETRIES); do
  if nc -z "$REDIS_HOST" "$REDIS_PORT" >/dev/null 2>&1; then
    log_info "Redis reachable at $REDIS_HOST:$REDIS_PORT"
    REDIS_READY=true
    break
  fi
  log_info "Waiting for Redis... ($i/$MAX_RETRIES)"
  sleep $RETRY_INTERVAL
done

if [ "$REDIS_READY" = false ]; then
  log_warn "Redis not reachable after $MAX_RETRIES attempts - proceeding anyway"
fi

# =============================================================================
# 7. Start Node.js Anwendung
# =============================================================================
log_info "Starting Payments Backend..."
log_info "NODE_ENV=${NODE_ENV:-production}, HOSTNAME=$HOSTNAME"

cd /srv/app
exec /usr/bin/node dist/src/main.js
