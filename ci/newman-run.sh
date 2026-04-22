#!/bin/bash
# =============================================================================
# CargoBit Newman E2E Test Runner
# =============================================================================
# Usage: ./ci/newman-run.sh [--env ENV_FILE] [--collection COLLECTION_FILE]
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/postman_env_staging.json"
COLLECTION_FILE="$PROJECT_ROOT/postman_collection_payments_e2e.json"
REPORT_DIR="$PROJECT_ROOT/reports"
TIMEOUT=180000

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env|-e)
            ENV_FILE="$2"
            shift 2
            ;;
        --collection|-c)
            COLLECTION_FILE="$2"
            shift 2
            ;;
        --timeout|-t)
            TIMEOUT="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --env, -e PATH        Path to Postman environment file"
            echo "  --collection, -c PATH Path to Postman collection file"
            echo "  --timeout, -t MS      Request timeout in milliseconds (default: 180000)"
            echo "  --help, -h            Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}=============================================================${NC}"
echo -e "${BLUE}CargoBit E2E Test Runner${NC}"
echo -e "${BLUE}=============================================================${NC}"

# Create report directory
mkdir -p "$REPORT_DIR"

# Check dependencies
if ! command -v newman &> /dev/null; then
    echo -e "${YELLOW}Newman not found. Installing...${NC}"
    npm install -g newman newman-reporter-junitfull newman-reporter-htmlextra
fi

# Validate files
if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}Error: Environment file not found: $ENV_FILE${NC}"
    echo -e "${YELLOW}Creating template...${NC}"
    cat > "$ENV_FILE" <<'EOF'
{
  "id": "cargobit-staging-env",
  "name": "CargoBit Staging",
  "values": [
    {"key": "base_url", "value": "https://staging.cargobit.eu", "enabled": true},
    {"key": "admin_jwt", "value": "Bearer YOUR_JWT_HERE", "enabled": true},
    {"key": "stripe_test_secret", "value": "whsec_YOUR_SECRET_HERE", "enabled": true}
  ]
}
EOF
    echo -e "${YELLOW}Please edit $ENV_FILE with your values and run again.${NC}"
    exit 1
fi

if [[ ! -f "$COLLECTION_FILE" ]]; then
    echo -e "${RED}Error: Collection file not found: $COLLECTION_FILE${NC}"
    exit 1
fi

# Get environment values for logging (without secrets)
BASE_URL=$(grep -o '"base_url"[^}]*"value"[^"]*"[^"]*"' "$ENV_FILE" | head -1 | sed 's/.*"value"[^"]*"\([^"]*\)".*/\1/')
echo -e "${BLUE}Environment: $ENV_FILE${NC}"
echo -e "${BLUE}Collection: $COLLECTION_FILE${NC}"
echo -e "${BLUE}Base URL: $BASE_URL${NC}"
echo -e "${BLUE}Report Dir: $REPORT_DIR${NC}"
echo ""

# Run Newman
echo -e "${GREEN}Starting Newman test run...${NC}"
echo ""

newman run "$COLLECTION_FILE" \
    --environment "$ENV_FILE" \
    --reporters cli,junitfull,htmlextra \
    --reporter-junitfull-export "$REPORT_DIR/newman-junit.xml" \
    --reporter-htmlextra-export "$REPORT_DIR/newman-report.html" \
    --reporter-htmlextra-title "CargoBit E2E Test Report" \
    --reporter-htmlextra-showOnlyFails false \
    --timeout $TIMEOUT \
    --timeout-request 30000 \
    --delay-request 500 \
    --ignore-redirects \
    --color on

EXIT_CODE=$?

echo ""
echo -e "${BLUE}=============================================================${NC}"
if [[ $EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
else
    echo -e "${RED}Some tests failed. Exit code: $EXIT_CODE${NC}"
fi
echo -e "${BLUE}=============================================================${NC}"
echo ""
echo -e "Reports generated:"
echo -e "  JUnit: $REPORT_DIR/newman-junit.xml"
echo -e "  HTML:  $REPORT_DIR/newman-report.html"

exit $EXIT_CODE
