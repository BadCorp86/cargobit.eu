#!/bin/bash
# =============================================================================
# CargoBit Payout Worker Startup Script
# =============================================================================
# Usage: ./start-payout-worker.sh [--env-file .env.local]
#
# Environment Variables:
#   REDIS_HOST       - Redis server host (default: 127.0.0.1)
#   REDIS_PORT       - Redis server port (default: 6379)
#   DATABASE_URL     - PostgreSQL connection string
#   STRIPE_SECRET_KEY - Stripe API key for transfers
#   NODE_ENV         - Environment (development/production)
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENV_FILE=".env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
PID_FILE="$PROJECT_ROOT/payout-worker.pid"
LOG_FILE="$LOG_DIR/payout-worker.log"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --env-file PATH   Path to environment file (default: .env)"
            echo "  --help, -h        Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  REDIS_HOST        Redis server host (default: 127.0.0.1)"
            echo "  REDIS_PORT        Redis server port (default: 6379)"
            echo "  DATABASE_URL      PostgreSQL connection string"
            echo "  STRIPE_SECRET_KEY Stripe API key"
            echo "  NODE_ENV          Environment (development/production)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}=============================================================${NC}"
echo -e "${BLUE}CargoBit Payout Worker${NC}"
echo -e "${BLUE}=============================================================${NC}"

# Create log directory if not exists
mkdir -p "$LOG_DIR"

# Load environment file
if [[ -f "$PROJECT_ROOT/$ENV_FILE" ]]; then
    echo -e "${GREEN}Loading environment from: $ENV_FILE${NC}"
    set -a
    source "$PROJECT_ROOT/$ENV_FILE"
    set +a
elif [[ -f "$ENV_FILE" ]]; then
    echo -e "${GREEN}Loading environment from: $ENV_FILE${NC}"
    set -a
    source "$ENV_FILE"
    set +a
else
    echo -e "${YELLOW}Warning: Environment file not found: $ENV_FILE${NC}"
    echo -e "${YELLOW}Using system environment variables.${NC}"
fi

# Validate required environment variables
MISSING_VARS=()

if [[ -z "${REDIS_HOST}" ]]; then
    export REDIS_HOST="127.0.0.1"
    echo -e "${YELLOW}REDIS_HOST not set, using default: $REDIS_HOST${NC}"
fi

if [[ -z "${REDIS_PORT}" ]]; then
    export REDIS_PORT="6379"
    echo -e "${YELLOW}REDIS_PORT not set, using default: $REDIS_PORT${NC}"
fi

if [[ -z "${DATABASE_URL}" ]]; then
    MISSING_VARS+=("DATABASE_URL")
fi

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
    echo -e "${RED}Error: Missing required environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "${RED}  - $var${NC}"
    done
    exit 1
fi

# Check if worker is already running
if [[ -f "$PID_FILE" ]]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}Worker already running with PID: $OLD_PID${NC}"
        echo -e "${YELLOW}Use 'stop-payout-worker.sh' to stop it first.${NC}"
        exit 1
    else
        echo -e "${YELLOW}Removing stale PID file${NC}"
        rm -f "$PID_FILE"
    fi
fi

# Check Redis connection
echo -e "${BLUE}Checking Redis connection...${NC}"
if command -v redis-cli &> /dev/null; then
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
        echo -e "${GREEN}Redis connection OK: $REDIS_HOST:$REDIS_PORT${NC}"
    else
        echo -e "${RED}Error: Cannot connect to Redis at $REDIS_HOST:$REDIS_PORT${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}redis-cli not found, skipping Redis check${NC}"
fi

# Build TypeScript if needed
DIST_FILE="$PROJECT_ROOT/dist/src/main.worker.js"
SOURCE_FILE="$PROJECT_ROOT/src/main.worker.ts"

if [[ ! -f "$DIST_FILE" ]] || [[ "$SOURCE_FILE" -nt "$DIST_FILE" ]]; then
    echo -e "${BLUE}Building worker...${NC}"
    cd "$PROJECT_ROOT"
    
    if command -v bun &> /dev/null; then
        bun run build
    elif command -v npm &> /dev/null; then
        npm run build
    else
        echo -e "${RED}Error: Neither bun nor npm found${NC}"
        exit 1
    fi
fi

# Start the worker
echo -e "${BLUE}Starting payout worker...${NC}"
echo -e "${BLUE}Redis: $REDIS_HOST:$REDIS_PORT${NC}"
echo -e "${BLUE}Log file: $LOG_FILE${NC}"

cd "$PROJECT_ROOT"

# Export environment for the worker
export NODE_ENV="${NODE_ENV:-production}"

# Start worker in background with logging
if command -v bun &> /dev/null; then
    nohup bun "$DIST_FILE" >> "$LOG_FILE" 2>&1 &
else
    nohup node "$DIST_FILE" >> "$LOG_FILE" 2>&1 &
fi

WORKER_PID=$!
echo $WORKER_PID > "$PID_FILE"

# Wait a moment and check if process is running
sleep 2

if ps -p "$WORKER_PID" > /dev/null 2>&1; then
    echo -e "${GREEN}=============================================================${NC}"
    echo -e "${GREEN}Payout worker started successfully!${NC}"
    echo -e "${GREEN}=============================================================${NC}"
    echo -e "PID: $WORKER_PID"
    echo -e "Log file: $LOG_FILE"
    echo ""
    echo -e "To view logs: tail -f $LOG_FILE"
    echo -e "To stop worker: ./scripts/stop-payout-worker.sh"
else
    echo -e "${RED}=============================================================${NC}"
    echo -e "${RED}Failed to start payout worker!${NC}"
    echo -e "${RED}=============================================================${NC}"
    echo -e "Check the log file for errors: $LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
fi
