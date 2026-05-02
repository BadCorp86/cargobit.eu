#!/bin/bash
# ================================================================================
# CARGOBIT CODE-GENERATOR SYSTEM - MAIN RUN SCRIPT
# ================================================================================
# Usage: ./run.sh [options]
# Options:
#   --output-dir DIR    Set output directory
#   --dry-run           Show what would be generated
#   --help              Show this help message
# ================================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
OUTPUT_DIR="${OUTPUT_DIR:-./output/cargobit-payment-system}"
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "CargoBit Code-Generator System"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --output-dir DIR    Set output directory (default: ./output/cargobit-payment-system)"
            echo "  --dry-run           Show what would be generated without creating files"
            echo "  --help              Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# ================================================================================
# HEADER
# ================================================================================

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║         CARGOBIT CODE-GENERATOR SYSTEM v1.0.0                    ║"
echo "║                                                                   ║"
echo "║  Multi-Agent System für automatisierte Code-Generierung          ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Output Directory: $OUTPUT_DIR"
echo "  Dry Run: $DRY_RUN"
echo ""

# ================================================================================
# CHECK DEPENDENCIES
# ================================================================================

echo -e "${BLUE}Checking dependencies...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Please install Node.js 20+${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

if ! command -v npx &> /dev/null; then
    echo -e "${RED}✗ npx not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npx available${NC}"

echo ""

# ================================================================================
# INSTALL DEPENDENCIES
# ================================================================================

if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
    echo ""
fi

# ================================================================================
# DRY RUN CHECK
# ================================================================================

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Dry Run Mode - Showing what would be generated:${NC}"
    echo ""
    echo "Blocks to generate:"
    echo "  A) PostgreSQL Migration"
    echo "     - prisma/schema.prisma"
    echo "     - migrations/0001_init.sql"
    echo "     - migrations/0002_indexes.sql"
    echo ""
    echo "  B) Redis Rate Limiting"
    echo "     - src/lib/rateLimit.ts"
    echo "     - src/middleware/rateLimit.ts"
    echo ""
    echo "  C) Backups + PITR"
    echo "     - ops/backup-db.sh"
    echo "     - ops/restore-db.sh"
    echo "     - ops/cron-backup.yaml"
    echo ""
    echo "  D) Stripe Webhook"
    echo "     - src/webhooks/stripe.ts"
    echo "     - src/services/stripeEvents.ts"
    echo ""
    echo "  E) Audit Log Hardening"
    echo "     - src/services/auditLog.ts"
    echo "     - src/jobs/auditVerify.ts"
    echo ""
    echo "  F) Policies & Playbooks"
    echo "     - docs/policies/security-policy.md"
    echo "     - docs/playbooks/incident-payment-outage.md"
    echo "     - docs/operational-readiness-checklist.md"
    echo ""
    echo "Total: ~25 files, ~6000 lines of code"
    exit 0
fi

# ================================================================================
# RUN GENERATION
# ================================================================================

echo -e "${BLUE}Starting code generation...${NC}"
echo ""

export OUTPUT_DIR="$OUTPUT_DIR"

npx ts-node orchestrator/index.ts

# ================================================================================
# VALIDATION
# ================================================================================

echo ""
echo -e "${BLUE}Validating generated code...${NC}"

if [ -f "$OUTPUT_DIR/prisma/schema.prisma" ]; then
    echo -e "${GREEN}✓ prisma/schema.prisma exists${NC}"
else
    echo -e "${RED}✗ prisma/schema.prisma not found${NC}"
fi

if [ -f "$OUTPUT_DIR/manifest.json" ]; then
    echo -e "${GREEN}✓ manifest.json exists${NC}"
else
    echo -e "${RED}✗ manifest.json not found${NC}"
fi

# ================================================================================
# SUMMARY
# ================================================================================

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              CODE GENERATION COMPLETE                             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Output: $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "  1. cd $OUTPUT_DIR"
echo "  2. npm install"
echo "  3. npx prisma generate"
echo "  4. npm test"
echo ""
