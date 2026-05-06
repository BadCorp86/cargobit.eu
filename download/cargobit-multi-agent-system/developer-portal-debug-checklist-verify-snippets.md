# Debug Checklist for Reviewers and CI Debugging

**Purpose**: Fast, copy/paste checklist reviewers can use to triage CI failures and verify security/signing results.

**When to attach**: Add this block to MR/PR comments or to the first CI failure comment.

---

## Checklist

### Repo and Branch
- **Repo**: `{{repo}}`
- **Branch**: `{{branch}}`
- **Commit**: `{{sha}}`

### CI Run
- **Workflow/Job**: name and link to failing job.
- **Start time**: ISO timestamp.
- **Runner type**: GitHub Actions `ubuntu-latest` or GitLab runner image.

### Unit Tests
- **Status**: pass/fail.
- **Failing tests**: list test names and first failing stack trace lines.

### Build
- **Docker build log**: include last 40 lines.
- **Base image**: image name and digest used.

### Trivy Scan
- **Scan status**: pass/fail.
- **Top findings**: list each HIGH/CRITICAL with package, version, CVE id, and short remediation note.

### Signing
- **Signing method**: keyless (OIDC) or keyed (COSIGN_KEY).
- **Sign step logs**: include cosign output lines.
- **Rekor entry**: Rekor log index or URL if keyless.

### Registry Push
- **Push status**: success/fail.
- **Image tags pushed**: list tags and registry path.

### Verification
- **Verify command used**: exact `cosign verify` command and output.
- **If verify failed**: include `cosign verify` stderr and any public key used.

### Environment and Secrets
- **Secrets present in CI**: list which secrets were set in sandbox (do not paste secret values).
- **OIDC/ID token**: confirm `id-token` permission enabled for workflow or Runner supports JWT.

### Quick Remediations
- **Trivy**: update base image; pin or upgrade vulnerable dependency; add documented exception.
- **Signing**: re-run with temporary keyed signing if OIDC fails; verify base64 decoding of key.
- **Push**: check registry credentials and IP allowlist.

### Attachments
- **Logs**: attach `unit-tests.log`, `build.log`, `trivy.log`, `sign.log`.
- **Commands to reproduce locally**: `docker build`, `trivy image`, `cosign verify` commands.

---

## GitHub Actions cosign Verify Job Snippet

**Purpose**: Add to deploy workflow to block deployment unless image is signed and verified.

```yaml
# job: verify-image-signature
# Insert into your deploy workflow jobs and set needs appropriately
verify-image-signature:
  runs-on: ubuntu-latest
  needs: [build-and-push] # adjust to your job name
  steps:
    - name: Install cosign
      run: |
        COSIGN_VERSION="2.1.0"
        curl -sSLf -o /tmp/cosign.tar.gz "https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign-linux-amd64.tar.gz"
        sudo tar -C /usr/local/bin -xzf /tmp/cosign.tar.gz

    - name: Verify image signature keyless
      env:
        IMAGE_REF: ghcr.io/${{ github.repository_owner }}/governance-postcheck:${{ github.sha }}
      run: |
        set -e
        echo "Verifying keyless signature for $IMAGE_REF"
        cosign verify --keyless "$IMAGE_REF"

    # Optional keyed verify (uncomment if using keyed signing)
    #- name: Verify image signature keyed
    #  env:
    #    IMAGE_REF: ghcr.io/${{ github.repository_owner }}/governance-postcheck:${{ github.sha }}
    #    COSIGN_PUB: ${{ secrets.COSIGN_PUB }} # public key content
    #  run: |
    #    echo "$COSIGN_PUB" > cosign.pub
    #    cosign verify --key cosign.pub "$IMAGE_REF"
```

---

## GitLab CI cosign Verify Job Snippet

**Purpose**: Add to `gitlab-ci.yml` deploy stage to enforce signed images.

```yaml
verify-image-signature:
  stage: verify
  image: docker:24.0.5
  services:
    - docker:24-dind
  variables:
    IMAGE_NAME: "$CI_REGISTRY_IMAGE/governance-postcheck"
    IMAGE_TAG: "$CI_COMMIT_SHA"
  before_script:
    - apk add --no-cache curl
    - curl -sSL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 -o /usr/local/bin/cosign
    - chmod +x /usr/local/bin/cosign
  script:
    - echo "Verifying keyless signature for ${IMAGE_NAME}:${IMAGE_TAG}"
    - cosign verify --keyless "${IMAGE_NAME}:${IMAGE_TAG}"
  only:
    - branches
```

---

## Quick Integration Notes

| Topic | Guidance |
|-------|----------|
| **Keyless vs keyed** | Prefer keyless for CI (OIDC). If using keyed signing, store public key in CI secret `COSIGN_PUB` and use the keyed verify variant. |
| **Failure handling** | Make verify job `required` for deploy; fail fast and attach logs to MR/PR. |
| **Attestations** | Consider `cosign attest` and `cosign verify-attestation` to enforce SBOM or provenance metadata. |

---

## Block Metadata

| Field | Value |
|-------|-------|
| **Block ID** | CF |
| **Title** | Debug Checklist + Verify Snippets |
| **Category** | CI/CD, Security, Troubleshooting |
| **Related Blocks** | CC (GitHub Actions), CD (GitLab CI), CE (cosign Verify) |
| **Created** | 2026-05-06 |

---

*CargoBit Developer Portal – Multi-Agent System Documentation*
