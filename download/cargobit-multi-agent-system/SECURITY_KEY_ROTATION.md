# Key Rotation & Incident Response Runbook

**Status:** Production-Ready  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-05-06  
**Owner:** Platform Security Team

---

## 1. Signing-Strategie Übersicht

| Strategie | Use Case | Rotation |
|-----------|----------|----------|
| **Keyless (OIDC)** | CI/CD Pipelines | Automatisch (OIDC Tokens) |
| **Keyed (KMS)** | Prod-Signing, Air-gapped | 90 Tage manuell |
| **Keyed (Secret)** | Legacy, Non-KMS | 90 Tage manuell |

---

## 2. Key Rotation (Keyed Signing)

### 2.1 Vorbereitung

```bash
# Prüfe aktuelle Key-Version
cosign verify --key cosign.pub "${IMAGE_NAME}:${IMAGE_TAG}"

# Liste aktive Keys in KMS
gcloud kms keys versions list --key=cosign-key --keyring=signing --location=global
```

### 2.2 Neuen Key generieren

**Option A: KMS (empfohlen)**

```bash
# GCP KMS
gcloud kms keys create cosign-key-v2 \
  --location=global \
  --keyring=signing \
  --purpose=asymmetric-signing \
  --default-algorithm=ec-sign-p256-sha256

# AWS KMS
aws kms create-key \
  --description "cosign-signing-key-v2" \
  --key-usage SIGN_VERIFY \
  --customer-master-key-spec ECC_NIST_P256
```

**Option B: Lokal (offline)**

```bash
# Key-Pair generieren
cosign generate-key-pair

# Output: cosign.key (private), cosign.pub (public)
# Private Key sicher speichern (z.B. in Vault)
```

### 2.3 Test-Signierung

```bash
# Test-Image mit neuem Key signieren
cosign sign --key cosign-new.key "${IMAGE_NAME}:test-v2"

# Signatur verifizieren
cosign verify --key cosign-new.pub "${IMAGE_NAME}:test-v2"
```

### 2.4 CI Secret aktualisieren

**GitHub Actions:**

```bash
# Secret aktualisieren via GitHub CLI
gh secret set COSIGN_KEY_BASE64 --repo your-org/governance-postcheck < cosign-new.key.base64
```

**GitLab CI:**

```bash
# Variable aktualisieren via GitLab API
curl --request PUT \
  --header "PRIVATE-TOKEN: ${GITLAB_TOKEN}" \
  --data "value=$(cat cosign-new.key.base64)" \
  "https://gitlab.com/api/v4/projects/${PROJECT_ID}/variables/COSIGN_KEY_BASE64"
```

### 2.5 Alten Key revoke/archivieren

```bash
# KMS: Key-Version deaktivieren
gcloud kms keys versions destroy 1 \
  --key=cosign-key \
  --keyring=signing \
  --location=global

# Dokumentation
echo "$(date -I): Key v1 revoked, Key v2 activated" >> KEY_ROTATION_LOG.md
```

---

## 3. Key Rotation (Keyless Signing)

### 3.1 OIDC-Konfiguration prüfen

```bash
# GitHub Actions: id-token permission
grep -r "id-token: write" .github/workflows/

# GitLab CI: CI_JOB_JWT Variable
grep -r "CI_JOB_JWT" .gitlab-ci.yml
```

### 3.2 Rekor-Audit

```bash
# Alle Signaturen für Image auflisten
cosign triangulate "${IMAGE_NAME}:${IMAGE_TAG}"

# Rekor-Einträge prüfen
rekor-cli search --sha <sha256-digest>

# Signatur-Details
rekor-cli get --uuid <rekor-uuid>
```

### 3.3 Policy-Update

```yaml
# Kyverno Policy für Keyless-Verifikation
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-keyless
spec:
  validationFailureAction: enforce
  background: false
  rules:
  - name: verify-signature
    match:
      resources:
        kinds:
        - Pod
    verifyImages:
    - imageReferences:
      - "ghcr.io/cargobit/governance-postcheck:*"
      attestors:
      - entries:
        - keyless:
            subject: "https://github.com/cargobit/governance-postcheck/.github/workflows/*"
            issuer: "https://token.actions.githubusercontent.com"
```

---

## 4. Incident Response (Key-Kompromittierung)

### 4.1 Sofortmaßnahmen (0-15 Min)

| Schritt | Aktion | Verantwortlich |
|---------|--------|----------------|
| 1 | CI-Pipeline stoppen | On-Call SRE |
| 2 | Secret in CI widerrufen | Platform Security |
| 3 | Betroffene Accounts sperren | IT Security |
| 4 | Incident-Ticket erstellen | On-Call SRE |

### 4.2 Key-Emergency-Rotation (15-60 Min)

```bash
#!/bin/bash
# emergency-key-rotation.sh
# Sofortige Key-Rotation bei Kompromittierung

set -e

echo "=== EMERGENCY KEY ROTATION ==="
echo "Timestamp: $(date -Iseconds)"

# 1. Neuen Key generieren
echo "[1/5] Generating new key..."
cosign generate-key-pair
mv cosign.key cosign-emergency.key
mv cosign.pub cosign-emergency.pub

# 2. CI Secret aktualisieren
echo "[2/5] Updating CI secret..."
COSIGN_KEY_B64=$(base64 -w0 cosign-emergency.key)
gh secret set COSIGN_KEY_BASE64 --repo "${REPO}" <<< "${COSIGN_KEY_B64}"

# 3. Kritische Images re-signieren
echo "[3/5] Re-signing critical images..."
for IMAGE in "${CRITICAL_IMAGES[@]}"; do
  cosign sign --key cosign-emergency.key "${IMAGE}"
done

# 4. Alten Key revoke
echo "[4/5] Revoking old key..."
# KMS: Version deaktivieren oder lokal: Key löschen

# 5. Incident dokumentieren
echo "[5/5] Documenting incident..."
echo "$(date -Iseconds): Emergency key rotation completed" >> INCIDENT_LOG.md

echo "=== ROTATION COMPLETE ==="
```

### 4.3 Kommunikation (60+ Min)

| Stakeholder | Kanal | Inhalt |
|-------------|-------|--------|
| Platform Team | Slack #platform-alerts | Incident Summary |
| Security Team | Email security@ | Key kompromittiert |
| Stakeholder | Status Page | Service Impact |

### 4.4 Post-Mortem (24-48h)

```markdown
## Post-Mortem: Key-Kompromittierung

**Datum:** YYYY-MM-DD  
**Severity:** S1/S2/S3  
**Dauer:** X Stunden  

### Timeline
- T+0: Detection
- T+15: Containment
- T+60: Resolution

### Root Cause
- [Beschreibung]

### Lessons Learned
- [Action Items]

### Action Items
- [ ] AI-1: [Beschreibung] (Owner, Due Date)
- [ ] AI-2: [Beschreibung] (Owner, Due Date)
```

---

## 5. cosign verify für Deploy-Pipelines

### 5.1 Kubernetes Admission Controller

```yaml
# kyverno-policy.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-signed-images
spec:
  validationFailureAction: enforce
  background: false
  rules:
  - name: verify-governance-postcheck
    match:
      resources:
        kinds:
        - Pod
        namespaces:
        - governance
    verifyImages:
    - imageReferences:
      - "ghcr.io/cargobit/governance-postcheck:*"
      attestors:
      - entries:
        - keys:
            publicKeys: |-
              -----BEGIN PUBLIC KEY-----
              [cosign public key]
              -----END PUBLIC KEY-----
```

### 5.2 Argo Rollout Pre-Deploy Hook

```yaml
# argocd-presign-hook.yaml
apiVersion: batch/v1
kind: Job
metadata:
  generateName: verify-image-signature-
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      containers:
      - name: cosign-verify
        image: gcr.io/projectsigstore/cosign:latest
        command:
        - /bin/sh
        - -c
        - |
          cosign verify \
            --key cosign.pub \
            "${IMAGE_NAME}:${IMAGE_TAG}"
      restartPolicy: Never
```

### 5.3 GitLab CI Deploy Gate

```yaml
# .gitlab-ci.yml
verify-before-deploy:
  stage: deploy
  image: gcr.io/projectsigstore/cosign:latest
  script:
    - |
      cosign verify \
        --key cosign.pub \
        "${IMAGE_NAME}:${IMAGE_TAG}" || {
          echo "Image signature verification failed!"
          exit 1
        }
  only:
    - main
```

---

## 6. Checklist: Rotation-Readiness

| Item | Status | Verantwortlich |
|------|--------|----------------|
| KMS Key erstellt | [ ] | Platform Security |
| CI Secret konfiguriert | [ ] | Platform CI |
| Test-Signierung erfolgreich | [ ] | Platform CI |
| Rekor-Audit aktiviert | [ ] | Platform Security |
| Incident-Runbook vorhanden | [ ] | Platform Security |
| Stakeholder informiert | [ ] | Platform Team |

---

## 7. Kontakte

| Rolle | Name | Kontakt |
|-------|------|---------|
| Platform Security Lead | [Name] | security@cargobit.io |
| On-Call SRE | [Name] | #sre-oncall |
| KMS Admin | [Name] | kms-admin@cargobit.io |

---

## 8. Referenzen

- [cosign Documentation](https://docs.sigstore.dev/cosign/overview/)
- [Sigstore Rekor](https://docs.sigstore.dev/rekor/overview/)
- [Kyverno Image Verification](https://kyverno.io/docs/writing-policies/verify-images/)
