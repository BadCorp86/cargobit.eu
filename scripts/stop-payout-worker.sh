#!/bin/bash
# =============================================================================
# CargoBit Payout Worker Stop Script
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$PROJECT_ROOT/payout-worker.pid"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping payout worker...${NC}"

if [[ ! -f "$PID_FILE" ]]; then
    echo -e "${YELLOW}No PID file found. Worker may not be running.${NC}"
    exit 0
fi

PID=$(cat "$PID_FILE")

if ! ps -p "$PID" > /dev/null 2>&1; then
    echo -e "${YELLOW}Worker process (PID: $PID) is not running.${NC}"
    rm -f "$PID_FILE"
    exit 0
fi

# Send SIGTERM for graceful shutdown
echo -e "${YELLOW}Sending SIGTERM to worker (PID: $PID)...${NC}"
kill -TERM "$PID"

# Wait for graceful shutdown (max 30 seconds)
for i in {1..30}; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${GREEN}Worker stopped gracefully.${NC}"
        rm -f "$PID_FILE"
        exit 0
    fi
    sleep 1
done

# Force kill if still running
echo -e "${RED}Worker did not stop gracefully, sending SIGKILL...${NC}"
kill -KILL "$PID" 2>/dev/null || true
sleep 1

if ps -p "$PID" > /dev/null 2>&1; then
    echo -e "${RED}Failed to stop worker!${NC}"
    exit 1
else
    echo -e "${GREEN}Worker stopped (forcefully).${NC}"
    rm -f "$PID_FILE"
fi
