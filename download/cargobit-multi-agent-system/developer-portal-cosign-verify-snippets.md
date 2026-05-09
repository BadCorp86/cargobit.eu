# Block CE – cosign verify Snippets für Deploy-Pipelines

**Status:** Production-Ready  
**Version:** 1.0.0  
**Letzte Aktualisierung:** 2026-05-06  
**Teil von:** CargoBit Multi-Agent System – Self-Healing Implementation Stack

---

## Übersicht

| Komponente | Plattform | Beschreibung |
|------------|-----------|--------------|
| Kyverno Policy | Kubernetes | Admission Controller für Image-Verifikation |
| ArgoCD PreSync Hook | ArgoCD | Pre-Deploy Signatur-Check |
| GitLab CI Gate | GitLab | Deploy-Gate vor Production |
| GitHub Actions Gate | GitHub | Deploy-Job mit Verify |

---

## 1. Kubernetes Admission Controller (Kyverno)

### Policy: Nur signierte Images zulassen

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-signed-governance-images
  annotations:
    policies.kyverno.io/title: Require Signed Governance Images
    policies.kyverno.io/category: Security
    policies.kyverno.io/severity: high
    policies.kyverno.io/subject: Pod
spec:
  validationFailureAction: enforce
  background: false
  rules:
  - name: verify-governance-postcheck
    match:
      any:
      - resources:
          kinds:
          - Pod
          namespaces:
          - governance
          - governance-prod
    verifyImages:
    - imageReferences:
      - "ghcr.io/cargobit/governance-postcheck:*"
      - "registry.example.com/governance-postcheck:*"
      attestors:
      - entries:
        - keys:
            publicKeys: |-
              -----BEGIN PUBLIC KEY-----
              MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE[...]
              -----END PUBLIC KEY-----
      - entries:
        - keyless:
            subject: "https://github.com/cargobit/governance-postcheck/.github/workflows/*"
            issuer: "https://token.actions.githubusercontent.com"
```

### Anwendung

```bash
kubectl apply -f kyverno-verify-policy.yaml
```

---

## 2. ArgoCD PreSync Hook

### Job: Signatur-Verifikation vor Deployment

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  generateName: verify-image-signature-
  namespace: governance
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  ttlSecondsAfterFinished: 300
  template:
    spec:
      serviceAccountName: argocd-verify-sa
      containers:
      - name: cosign-verify
        image: gcr.io/projectsigstore/cosign:v2.1.0
        env:
        - name: IMAGE_NAME
          value: "ghcr.io/cargobit/governance-postcheck"
        - name: IMAGE_TAG
          value: "latest"
        command:
        - /bin/sh
        - -c
        - |
          set -e
          echo "=== Verifying Image Signature ==="
          echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
          
          # Option 1: Keyless verification (OIDC)
          cosign verify \
            --certificate-identity="https://github.com/cargobit/governance-postcheck/.github/workflows/postcheck-ci-keyless.yml@refs/heads/main" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            "${IMAGE_NAME}:${IMAGE_TAG}"
          
          # Option 2: Key-based verification
          # cosign verify --key /secrets/cosign.pub "${IMAGE_NAME}:${IMAGE_TAG}"
          
          echo "=== Signature Verification PASSED ==="
        volumeMounts:
        - name: cosign-pub
          mountPath: /secrets
          readOnly: true
      volumes:
      - name: cosign-pub
        secret:
          secretName: cosign-public-key
      restartPolicy: Never
  backoffLimit: 1
```

### RBAC für ServiceAccount

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: argocd-verify-sa
  namespace: governance
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: argocd-verify-role
  namespace: governance
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
  resourceNames: ["cosign-public-key"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: argocd-verify-binding
  namespace: governance
subjects:
- kind: ServiceAccount
  name: argocd-verify-sa
  namespace: governance
roleRef:
  kind: Role
  name: argocd-verify-role
  apiGroup: rbac.authorization.k8s.io
```

---

## 3. GitLab CI Deploy Gate

### Stage: verify-signature

```yaml
# .gitlab-ci.yml
stages:
  - build
  - scan
  - sign
  - verify
  - deploy

verify-signature:
  stage: verify
  image: gcr.io/projectsigstore/cosign:v2.1.0
  script:
    - |
      echo "=== Verifying Image Signature ==="
      
      # Keyless verification
      cosign verify \
        --certificate-identity="https://gitlab.com/${CI_PROJECT_PATH}//.gitlab-ci.yml@refs/heads/${CI_DEFAULT_BRANCH}" \
        --certificate-oidc-issuer="https://gitlab.com" \
        "${IMAGE_NAME}:${IMAGE_TAG}" || {
          echo "❌ Signature verification failed!"
          echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
          exit 1
        }
      
      echo "✅ Signature verification passed"
  needs: ["sign-image"]
  only:
    - main
    - production

deploy-production:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl set image deployment/governance-postcheck \
        governance-postcheck="${IMAGE_NAME}:${IMAGE_TAG}" \
        -n governance-prod
  needs: ["verify-signature"]
  only:
    - production
  environment:
    name: production
    url: https://governance.cargobit.io
```

---

## 4. GitHub Actions Deploy Gate

### Job: verify-and-deploy

```yaml
# .github/workflows/deploy.yml
name: Deploy Governance PostCheck

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  packages: read
  id-token: write

env:
  IMAGE_NAME: ghcr.io/cargobit/governance-postcheck
  IMAGE_TAG: ${{ github.sha }}

jobs:
  verify-signature:
    runs-on: ubuntu-latest
    outputs:
      verified: ${{ steps.verify.outputs.verified }}
    steps:
      - name: Install cosign
        uses: sigstore/cosign-installer@v3

      - name: Verify image signature
        id: verify
        run: |
          echo "=== Verifying Image Signature ==="
          
          # Keyless verification
          cosign verify \
            --certificate-identity="https://github.com/${{ github.repository }}/.github/workflows/postcheck-ci-keyless.yml@refs/heads/main" \
            --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
            "${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}" || {
              echo "❌ Signature verification failed!"
              exit 1
            }
          
          echo "✅ Signature verification passed"
          echo "verified=true" >> $GITHUB_OUTPUT

  deploy-production:
    runs-on: ubuntu-latest
    needs: verify-signature
    if: needs.verify-signature.outputs.verified == 'true'
    environment:
      name: production
      url: https://governance.cargobit.io
    steps:
      - name: Set up kubectl
        uses: azure/setup-kubectl@v3

      - name: Configure kubeconfig
        run: |
          echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=kubeconfig

      - name: Deploy to production
        run: |
          kubectl set image deployment/governance-postcheck \
            governance-postcheck="${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}" \
            -n governance-prod

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/governance-postcheck \
            -n governance-prod \
            --timeout=300s
```

---

## 5. Argo Rollout PostCheck Integration

### PostCheck mit Signatur-Verifikation

```yaml
# governance-postcheck-canary.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: governance-postcheck
  namespace: governance
spec:
  replicas: 3
  strategy:
    canary:
      steps:
      - setWeight: 1
      - pause: {duration: 300s}
      - setWeight: 10
      - pause: {duration: 300s}
      - setWeight: 50
      - pause: {duration: 300s}
      analysis:
        templates:
        - templateName: governance-health-check
        startingStep: 1
        args:
        - name: image-tag
          value: "{{args.image-tag}}"
  selector:
    matchLabels:
      app: governance-postcheck
  template:
    metadata:
      labels:
        app: governance-postcheck
      annotations:
        # Wird von Kyverno verifiziert
        cosign.sigstore.dev/imageRef: "ghcr.io/cargobit/governance-postcheck:{{args.image-tag}}"
    spec:
      containers:
      - name: governance-postcheck
        image: ghcr.io/cargobit/governance-postcheck:{{args.image-tag}}
        ports:
        - containerPort: 8443
        readinessProbe:
          httpGet:
            path: /health
            port: 8443
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 8443
          initialDelaySeconds: 15
          periodSeconds: 20
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: governance-health-check
  namespace: governance
spec:
  args:
  - name: image-tag
  metrics:
  - name: signature-verified
    provider:
      job:
        spec:
          template:
            spec:
              containers:
              - name: cosign-verify
                image: gcr.io/projectsigstore/cosign:v2.1.0
                command:
                - /bin/sh
                - -c
                - |
                  cosign verify \
                    --certificate-identity="https://github.com/cargobit/governance-postcheck/.github/workflows/*" \
                    --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
                    "ghcr.io/cargobit/governance-postcheck:{{args.image-tag}}"
              restartPolicy: Never
          backoffLimit: 1
    successCondition: result == 'pass'
```

---

## 6. cosign verify CLI Referenz

### Keyless Verification

```bash
# GitHub Actions OIDC
cosign verify \
  --certificate-identity="https://github.com/cargobit/governance-postcheck/.github/workflows/postcheck-ci-keyless.yml@refs/heads/main" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/cargobit/governance-postcheck:latest

# GitLab CI OIDC
cosign verify \
  --certificate-identity="https://gitlab.com/cargobit/governance-postcheck//.gitlab-ci.yml@refs/heads/main" \
  --certificate-oidc-issuer="https://gitlab.com" \
  registry.gitlab.com/cargobit/governance-postcheck:latest
```

### Key-based Verification

```bash
# Mit öffentlichem Key
cosign verify \
  --key cosign.pub \
  ghcr.io/cargobit/governance-postcheck:latest

# Mit KMS Key
cosign verify \
  --key gcpkms://projects/cargobit/locations/global/keyRings/signing/cryptoKeys/cosign-key \
  ghcr.io/cargobit/governance-postcheck:latest
```

### Attestation Verification

```bash
# SBOM Attestation
cosign verify-attestation \
  --key cosign.pub \
  --type spdxjson \
  ghcr.io/cargobit/governance-postcheck:latest

# Vulnerability Scan Attestation
cosign verify-attestation \
  --key cosign.pub \
  --type vuln \
  ghcr.io/cargobit/governance-postcheck:latest
```

---

## Block-Metadaten

| Feld | Wert |
|------|------|
| Block-ID | CE |
| Erstellt | 2026-05-06 |
| Abhängigkeiten | Block CD |
| Vorgänger | CD |
| Status | Production-Ready |

---

## Self-Healing Stack – Deploy Security Blocks

```
CD → GitLab CI + GitHub Keyless + Key Management
CE → cosign verify Snippets für Deploy-Pipelines ← NEU
```
