#!/usr/bin/env bash
# =============================================================================
# verify_smoke.sh - Smoke Test für Payments Service
# =============================================================================
# Usage: ./scripts/verify_smoke.sh <BASE_URL> <ADMIN_JWT>
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
ADMIN_JWT="${2:-}"

echo "=== Smoke Test für Payments Service ==="
echo "Base URL: $BASE_URL"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0

# =============================================================================
# Test 1: Health Endpoint
# =============================================================================
echo -n "Testing /api/health... "
HEALTH_RESPONSE=$(curl -s -o /dev/stdout -w "\n%{http_code}" "${BASE_URL}/api/health" 2>/dev/null || echo -e "\n000")
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)

if [ "$HEALTH_CODE" = "200" ]; then
  echo -e "${GREEN}✓ OK${NC} (HTTP $HEALTH_CODE)"
else
  echo -e "${RED}✗ FAILED${NC} (HTTP $HEALTH_CODE)"
  FAILED=1
fi

# =============================================================================
# Test 2: API Docs (optional)
# =============================================================================
echo -n "Testing /api/docs... "
DOCS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/docs" 2>/dev/null || echo "000")

if [ "$DOCS_CODE" = "200" ] || [ "$DOCS_CODE" = "404" ]; then
  echo -e "${GREEN}✓ OK${NC} (HTTP $DOCS_CODE)"
else
  echo -e "${YELLOW}⚠ WARNING${NC} (HTTP $DOCS_CODE)"
fi

# =============================================================================
# Test 3: Authenticated Endpoint (if JWT provided)
# =============================================================================
if [ -n "$ADMIN_JWT" ]; then
  echo -n "Testing /api/admin/stats (authenticated)... "
  STATS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $ADMIN_JWT" \
    "${BASE_URL}/api/admin/stats" 2>/dev/null || echo "000")

  if [ "$STATS_CODE" = "200" ]; then
    echo -e "${GREEN}✓ OK${NC} (HTTP $STATS_CODE)"
  elif [ "$STATS_CODE" = "401" ]; then
    echo -e "${YELLOW}⚠ WARNING${NC} (Unauthorized - JWT may be expired)"
  else
    echo -e "${RED}✗ FAILED${NC} (HTTP $STATS_CODE)"
    FAILED=1
  fi
fi

# =============================================================================
# Test 4: Database Connectivity (via health endpoint)
# =============================================================================
echo -n "Testing database connectivity... "
DB_CHECK=$(curl -s "${BASE_URL}/api/health" 2>/dev/null | grep -o '"database":"[^"]*"' | head -1 || echo "")

if echo "$DB_CHECK" | grep -q "connected\|healthy\|ok"; then
  echo -e "${GREEN}✓ OK${NC}"
elif [ -n "$DB_CHECK" ]; then
  echo -e "${RED}✗ FAILED${NC} ($DB_CHECK)"
  FAILED=1
else
  echo -e "${YELLOW}⚠ WARNING${NC} (Could not verify)"
fi

# =============================================================================
# Test 5: Redis Connectivity (via health endpoint)
# =============================================================================
echo -n "Testing Redis connectivity... "
REDIS_CHECK=$(curl -s "${BASE_URL}/api/health" 2>/dev/null | grep -o '"redis":"[^"]*"' | head -1 || echo "")

if echo "$REDIS_CHECK" | grep -q "connected\|healthy\|ok"; then
  echo -e "${GREEN}✓ OK${NC}"
elif [ -n "$REDIS_CHECK" ]; then
  echo -e "${RED}✗ FAILED${NC} ($REDIS_CHECK)"
  FAILED=1
else
  echo -e "${YELLOW}⚠ WARNING${NC} (Could not verify)"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "=== Smoke Test Summary ==="

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All critical tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi
