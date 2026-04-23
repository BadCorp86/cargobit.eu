#!/usr/bin/env bash
set -euo pipefail

# Usage:
# ./scripts/run-task4-verify.sh \
#   --repo-owner my-org --repo-name my-repo --pr-branch feat/reconciliation-task4 \
#   --kubeconfig ~/.kube/config --namespace staging --release payments \
#   [--run-newman] [--db-url "postgres://user:pass@host:5432/db"]

# Defaults
REPO_OWNER="my-org"
REPO_NAME="my-repo"
PR_BRANCH="feat/reconciliation-task4"
KUBECONFIG_PATH="${HOME}/.kube/config"
NAMESPACE="staging"
RELEASE="payments"
VALUES_FILE="helm/payments/values.yaml"
CHART_PATH="helm/payments"
RUN_NEWMAN=false
DB_URL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --repo-owner) REPO_OWNER="$2"; shift 2;;
    --repo-name) REPO_NAME="$2"; shift 2;;
    --pr-branch) PR_BRANCH="$2"; shift 2;;
    --kubeconfig) KUBECONFIG_PATH="$2"; shift 2;;
    --namespace) NAMESPACE="$2"; shift 2;;
    --release) RELEASE="$2"; shift 2;;
    --values-file) VALUES_FILE="$2"; shift 2;;
    --chart-path) CHART_PATH="$2"; shift 2;;
    --run-newman) RUN_NEWMAN=true; shift;;
    --db-url) DB_URL="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

export KUBECONFIG="$KUBECONFIG_PATH"

echo "=== 1) PR prüfen ==="
if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI fehlt. Installiere gh und auth bevor du fortfährst." >&2
  exit 1
fi
gh pr view "$PR_BRANCH" --repo "${REPO_OWNER}/${REPO_NAME}" --json number,title,state,url || true

echo "=== 2) PR mergen ==="
gh pr merge "$PR_BRANCH" --repo "${REPO_OWNER}/${REPO_NAME}" --merge || {
  echo "Merge fehlgeschlagen. Bitte Konflikte manuell lösen." >&2
  exit 1
}

echo "=== 3) Helm lint & deploy ==="
helm lint "$CHART_PATH" || echo "helm lint: warnings"
helm upgrade --install "$RELEASE" "$CHART_PATH" \
  --namespace "$NAMESPACE" --create-namespace \
  --values "$VALUES_FILE" \
  --wait --timeout 5m

echo "=== 4) CronJob prüfen ==="
kubectl -n "$NAMESPACE" get cronjob "${RELEASE}-reconciliation" -o wide

echo "=== 5) CronJob manuell triggern ==="
TS=$(date +%s)
JOB_NAME="temp-recon-${TS}"
kubectl -n "$NAMESPACE" create job --from=cronjob/"${RELEASE}-reconciliation" "${JOB_NAME}"
echo "Warte auf Pod..."
sleep 3
POD=$(kubectl -n "$NAMESPACE" get pods -l job-name="${JOB_NAME}" -o jsonpath='{.items[0].metadata.name}')
echo "Pod: $POD"
echo "=== Logs (letzte 500 Zeilen) ==="
kubectl -n "$NAMESPACE" logs "$POD" --tail=500 || true

if [ "$RUN_NEWMAN" = true ]; then
  if ! command -v newman >/dev/null 2>&1; then
    echo "Newman nicht installiert; überspringe E2E." >&2
  else
    echo "=== 6) Newman E2E ausführen ==="
    newman run postman_reconciliation.json -e postman_env_staging.json --reporters cli,junit --reporter-junit-export reports/newman-reconciliation.xml || {
      echo "Newman Tests sind fehlgeschlagen. Report: reports/newman-reconciliation.xml" >&2
      exit 1
    }
    echo "Newman E2E erfolgreich. Report: reports/newman-reconciliation.xml"
  fi
else
  echo "Newman E2E übersprungen. Setze --run-newman um auszuführen."
fi

echo "=== 7) Metriken prüfen ==="
mkdir -p reports
if command -v curl >/dev/null 2>&1; then
  curl -fsS "https://payments.staging.example.com/metrics" -o reports/metrics.txt || echo "Metrics endpoint nicht erreichbar"
  echo "Gefundene reconciliation Metriken:"
  grep -E "reconciliation_runs_total|reconciliation_open_payouts_gauge|reconciliation_duration_seconds" reports/metrics.txt || true
else
  echo "curl fehlt; kann Metriken nicht prüfen."
fi

if [ -n "$DB_URL" ]; then
  if command -v psql >/dev/null 2>&1; then
    echo "=== 8) DB Prüfungen ==="
    psql "$DB_URL" -At -c "SELECT id, status, amount_cents FROM payouts WHERE status IN ('pending','processing') ORDER BY created_at DESC LIMIT 20;" > reports/db_open_payouts.txt || true
    psql "$DB_URL" -At -c "SELECT id, payout_id, type, created_at FROM payout_events ORDER BY created_at DESC LIMIT 50;" > reports/db_payout_events.txt || true
    psql "$DB_URL" -At -c "SELECT id, event_type, created_at FROM audit_events WHERE event_type LIKE 'reconciliation.%' ORDER BY created_at DESC LIMIT 50;" > reports/db_audit_events.txt || true
    echo "DB Prüfungen gespeichert in reports/"
  else
    echo "psql fehlt; DB Prüfungen übersprungen."
  fi
fi

echo "=== Fertig ==="
echo "Bitte kopiere hierher die folgenden Ausgaben falls du möchtest, dass ich sie bewerte:"
echo "- gh pr view Ausgabe (JSON) oder PR URL"
echo "- Helm status: helm status ${RELEASE} -n ${NAMESPACE}"
echo "- CronJob describe: kubectl -n ${NAMESPACE} describe cronjob ${RELEASE}-reconciliation"
echo "- Pod Logs (die Ausgabe oben)"
echo "- Newman Report (reports/newman-reconciliation.xml) falls ausgeführt"
echo "- reports/metrics.txt Inhalt"
echo "- reports/db_*.txt falls DB_URL gesetzt war"
