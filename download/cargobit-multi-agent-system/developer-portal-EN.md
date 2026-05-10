# EN – Automatisierte Key Rotation (Minimal)

> **Zweck**: Automatische Key-Rotation alle 90 Tage. Kein manueller Aufwand.

---

## 🔑 Key Rotation – Minimal-Architektur

### Prinzip

| Aspekt | Wert |
|--------|------|
| Frequenz | Alle 90 Tage |
| Methode | Keyless bevorzugt |
| Fallback | Automatisches Key-Pair |
| Aufwand | 0 Wartung (automatisch) |

---

## Option 1: Keyless (Empfohlen)

**Keine Key-Rotation nötig!**

```yaml
# Keyless Mode - OIDC verwaltet Identität
cosign sign --keyless ghcr.io/company/app@sha256:xxx

# Verifikation
cosign verify \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  --certificate-identity-regexp=".*" \
  ghcr.io/company/app@sha256:xxx
```

**Vorteile**:
- Keine Keys zu verwalten
- Automatische Rotation via OIDC-Tokens
- Kostenlos über Sigstore

---

## Option 2: Key Rotation CronJob

Wenn du eigene Keys benötigst:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: key-rotation
  namespace: security
spec:
  schedule: "0 0 1 */3 *"  # Alle 90 Tage (1. des Monats, alle 3 Monate)
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: key-rotation-sa
          containers:
            - name: rotate-keys
              image: alpine:3.19
              env:
                - name: REGISTRY
                  value: "ghcr.io/company"
                - name: KEY_SECRET
                  value: "cosign-keys"
              command:
                - /bin/sh
                - -c
                - |
                  set -e
                  
                  echo "🔑 Starting Key Rotation..."
                  
                  # Install cosign
                  curl -fsSL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 -o /usr/local/bin/cosign
                  chmod +x /usr/local/bin/cosign
                  
                  # Generate new key pair
                  cosign generate-key-pair k8s://security/cosign-keys
                  
                  # Get current images
                  IMAGES=$(kubectl get deployments -A -o jsonpath='{.items[*].spec.template.spec.containers[*].image}' | tr ' ' '\n' | sort -u)
                  
                  # Re-sign all images with new key
                  for IMAGE in $IMAGES; do
                    echo "Re-signing: $IMAGE"
                    cosign sign --key k8s://security/cosign-keys "$IMAGE"
                  done
                  
                  echo "✅ Key Rotation Complete"
                  
                  # Notify
                  kubectl create event key-rotation-complete --type=Normal --reason=KeyRotated --message="Keys rotated successfully"
                  
          restartPolicy: OnFailure
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: key-rotation-sa
  namespace: security
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: key-rotation-role
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "create", "update"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list"]
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: key-rotation-binding
subjects:
  - kind: ServiceAccount
    name: key-rotation-sa
    namespace: security
roleRef:
  kind: ClusterRole
  name: key-rotation-role
  apiGroup: rbac.authorization.k8s.io
```

---

## Option 3: GitHub Actions Key Rotation

```yaml
name: Key Rotation

on:
  schedule:
    - cron: '0 0 1 */3 *'  # Alle 90 Tage
  workflow_dispatch:

jobs:
  rotate:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write

    steps:
      - uses: actions/checkout@v4
      - uses: sigstore/cosign-installer@main

      - name: Generate New Keys
        run: |
          cosign generate-key-pair
          # Save keys to repository secrets via API

      - name: Re-sign All Images
        run: |
          # Get all production images
          IMAGES=$(gh api /orgs/company/packages?package_type=container --paginate | jq -r '.[].name')
          
          for IMAGE in $IMAGES; do
            echo "Re-signing: ghcr.io/company/$IMAGE"
            cosign sign --key cosign.key "ghcr.io/company/$IMAGE:production"
          done

      - name: Update Secrets
        run: |
          # Upload new public key
          gh secret set COSIGN_PUBLIC_KEY < cosign.pub
```

---

## Emergency Key Rotation

```yaml
name: Emergency Key Rotation

on:
  workflow_dispatch:
    inputs:
      reason:
        description: 'Reason for emergency rotation'
        required: true

jobs:
  emergency-rotate:
    runs-on: ubuntu-latest
    steps:
      - uses: sigstore/cosign-installer@main

      - name: Generate Emergency Keys
        run: |
          echo "🚨 EMERGENCY KEY ROTATION"
          echo "Reason: ${{ inputs.reason }}"
          
          cosign generate-key-pair

      - name: Re-sign All Images Immediately
        run: |
          # All production images
          for IMAGE in $(cat production-images.txt); do
            cosign sign --key cosign.key "$IMAGE"
          done

      - name: Update Admission Policies
        run: |
          # Update Kyverno with new public key
          kubectl patch clusterpolicy require-signed-images --type=json -p='[{"op": "replace", "path": "/spec/rules/0/verifyImages/0/attestors/0/entries/0/key/data", "value": "'"$(base64 -w0 cosign.pub)"'"}]'

      - name: Notify Team
        run: |
          curl -X POST "${{ secrets.SLACK_WEBHOOK }}" \
            -d '{"text": "🚨 Emergency Key Rotation completed. Reason: ${{ inputs.reason }}"}'
```

---

## Key Rotation Status Dashboard

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: key-rotation-status
  namespace: security
data:
  last-rotation: "2024-01-15"
  next-rotation: "2024-04-15"
  rotation-interval-days: "90"
```

---

## Check-Script

```bash
#!/bin/bash
# key-rotation-check.sh

echo "🔑 Key Rotation Status"
echo "======================"

# Check last rotation
LAST_ROTATION=$(kubectl get configmap key-rotation-status -n security -o jsonpath='{.data.last-rotation}')
NEXT_ROTATION=$(kubectl get configmap key-rotation-status -n security -o jsonpath='{.data.next-rotation}')

echo "Last Rotation: $LAST_ROTATION"
echo "Next Rotation: $NEXT_ROTATION"

# Days until next rotation
DAYS_UNTIL=$(( ($(date -d "$NEXT_ROTATION" +%s) - $(date +%s)) / 86400 ))
echo "Days until next rotation: $DAYS_UNTIL"

if [ "$DAYS_UNTIL" -lt 7 ]; then
  echo "⚠️  Key rotation due in less than 7 days!"
fi

# Verify current keys
echo ""
echo "Verifying current keys..."
kubectl get secret cosign-keys -n security -o jsonpath='{.data.cosign\.pub}' | base64 -d > /tmp/current-key.pub

# Check if any images are signed with old key
for IMAGE in $(kubectl get deployments -A -o jsonpath='{.items[*].spec.template.spec.containers[*].image}' | tr ' ' '\n' | sort -u); do
  if cosign verify --key /tmp/current-key.pub "$IMAGE" 2>/dev/null; then
    echo "✅ $IMAGE"
  else
    echo "❌ $IMAGE - not signed with current key!"
  fi
done
```

---

## Rotation Calendar

| Quartal | Datum | Status |
|---------|-------|--------|
| Q1 | 15. Januar | ✅ Erledigt |
| Q2 | 15. April | ⏳ Geplant |
| Q3 | 15. Juli | ⏳ Geplant |
| Q4 | 15. Oktober | ⏳ Geplant |

---

## Vorteile

| Vorteil | Beschreibung |
|---------|--------------|
| Automatisch | CronJob übernimmt alles |
| Keyless | OIDC verwaltet Identität |
| Emergency | Schnelle Rotation möglich |
| Audit-Ready | Logs für Compliance |

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Signatur-Chain | EI |
| Admission Enforcement | EK |
| Monitoring Alerts | EM |
| Go-Live Gate | EO |

---

*Block EN – Key Rotation (Minimal) – v1.0*
