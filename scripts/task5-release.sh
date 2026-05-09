#!/usr/bin/env bash
set -euo pipefail

# task5-release.sh
# Release script for Task 5: Reconciliation Reporting and Export
#
# Usage:
#   ./scripts/task5-release.sh --repo-owner <owner> --repo-name <repo>

REPO_OWNER="${REPO_OWNER:-my-org}"
REPO_NAME="${REPO_NAME:-my-repo}"
PR_BRANCH="feat/reports-task5"
BASE_BRANCH="main"
LOG_DIR="reports"
mkdir -p "$LOG_DIR"

while [[ $# -gt 0 ]]; do
  case $1 in
    --repo-owner) REPO_OWNER="$2"; shift 2;;
    --repo-name) REPO_NAME="$2"; shift 2;;
    --pr-branch) PR_BRANCH="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

echo "=== Task 5 Release Script ==="
echo "Repo: ${REPO_OWNER}/${REPO_NAME}"
echo "Branch: ${PR_BRANCH}"
echo ""

# Check for gh CLI
if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI not found. Install and authenticate first." >&2
  exit 1
fi

echo "1) Checking git status..."
git status --short
echo ""

echo "2) Creating PR..."
PR_URL=$(gh pr create \
  --repo "${REPO_OWNER}/${REPO_NAME}" \
  --base "$BASE_BRANCH" \
  --head "$PR_BRANCH" \
  --title "feat(reports): Reconciliation reporting and export" \
  --body-file docs/pr-template-reports-task5.md \
  --label "enhancement,reports" \
  2>&1 || echo "PR may already exist")

echo "$PR_URL"
echo ""

# Extract PR number if available
PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+' | head -1 || echo "")

if [ -n "$PR_NUMBER" ]; then
  echo "3) PR #${PR_NUMBER} created/updated"
  
  echo "4) Waiting for CI checks..."
  sleep 5
  gh pr checks "$PR_NUMBER" --repo "${REPO_OWNER}/${REPO_NAME}" --watch || echo "Some checks may have failed"
  
  echo "5) PR Status:"
  gh pr view "$PR_NUMBER" --repo "${REPO_OWNER}/${REPO_NAME}" --json number,title,state,url,mergeable,statusCheckRollup
  
  # Save PR info
  gh pr view "$PR_NUMBER" --repo "${REPO_OWNER}/${REPO_NAME}" --json number,title,state,url > "$LOG_DIR/pr_info_task5.json"
else
  echo "Could not extract PR number. Check output above."
fi

echo ""
echo "=== Next Steps ==="
echo "1. Review PR in GitHub: $PR_URL"
echo "2. Ensure CI passes (gh pr checks)"
echo "3. Merge PR: gh pr merge $PR_NUMBER --merge"
echo "4. Apply migration in staging"
echo "5. Deploy to staging: helm upgrade --install payments ./helm/payments -n staging --set reports.enabled=true"
echo "6. Run E2E tests: newman run postman/postman_reconciliation_export.json -e postman_env_staging.json"
echo "7. Verify metrics: curl https://payments.staging.example.com/metrics | grep report_export"
echo ""
echo "Release notes template saved to: docs/pr-template-reports-task5.md"
