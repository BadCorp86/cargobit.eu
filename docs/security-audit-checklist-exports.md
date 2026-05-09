# CargoBit Security Audit Checklist
## Initiative 3: Security Audit for Exports and Signed URLs

**Version:** 1.0.0  
**Date:** 2026-04-25  
**Status:** ✅ Ready for Implementation

---

## Overview

This checklist ensures that exports are PII-safe, auditable, and only accessible by authorized parties. All items must be implemented or mitigations documented before production rollout.

---

## 1. Access Control

| Item | Status | Implementation | Notes |
|------|--------|----------------|-------|
| 1.1 Export API restricted to Admins | ✅ | `AdminAuthGuard` validates roles | `role in ['ADMIN', 'SUPPORT']` |
| 1.2 Service Account support | ✅ | Service token validation | `X-Service-Authorization` header |
| 1.3 RBAC for export operations | ✅ | Permission matrix check | `EXPORT_CREATE`, `EXPORT_READ` |
| 1.4 Rate limiting per user | ✅ | Redis-based rate limiter | Default: 100 req/10min |
| 1.5 IP allowlisting (optional) | ⚠️ | Configurable per environment | Enterprise feature |

---

## 2. Signed URLs

| Item | Status | Implementation | Notes |
|------|--------|----------------|-------|
| 2.1 Signed URLs with expiry | ✅ | S3 presigned URLs | Default: 24h max |
| 2.2 HTTPS enforced | ✅ | S3 bucket policy | `aws:SecureTransport` |
| 2.3 Token verification | ✅ | HMAC signature validation | `secure-export.service.ts` |
| 2.4 Single-use tokens (optional) | ⚠️ | Configurable | High-security mode |
| 2.5 IP binding | ✅ | Token includes IP hash | Optional verification |
| 2.6 Revocation support | ✅ | Database revocation flag | Immediate invalidation |

### Configuration

```typescript
// Environment variables
SIGNED_URL_DEFAULT_EXPIRY=3600    // 1 hour
SIGNED_URL_MAX_EXPIRY=86400       // 24 hours max
SIGNED_URL_IP_BINDING=true        // Enable IP verification
SIGNED_URL_SINGLE_USE=false       // Single-use tokens
```

### Example S3 Presign

```typescript
const command = new GetObjectCommand({
    Bucket: 'cargobit-exports',
    Key: 'exports/reconciliation-20260425.csv',
});
const url = await getSignedUrl(s3Client, command, { expiresIn: 86400 });
```

---

## 3. Data Minimization

| Item | Status | Implementation | Notes |
|------|--------|----------------|-------|
| 3.1 PII masking by default | ✅ | `SecureExportService.maskPiiFields()` | Email, phone, SSN, IBAN |
| 3.2 Field exclusion options | ✅ | Filter parameter `excludeFields` | User configurable |
| 3.3 PII audit flag | ✅ | Audit log includes `pii_included` | Compliance tracking |
| 3.4 Masking preview | ✅ | API endpoint for preview | Before export |
| 3.5 Custom masking rules | ✅ | Configurable per field | Regex patterns |

### Default PII Fields Masked

| Field | Type | Masking |
|-------|------|---------|
| `email` | Email | `j***@example.com` |
| `phone` | Phone | `****1234` |
| `ssn` | SSN | `****5678` |
| `iban` | IBAN | `DE89****1234` |
| `first_name` | Name | `J***n` |
| `last_name` | Name | `D**e` |
| `address` | Address | `123 Main St****` |

---

## 4. Audit Logging

| Item | Status | Implementation | Notes |
|------|--------|----------------|-------|
| 4.1 User ID logged | ✅ | `user_id` column | Required |
| 4.2 Job ID logged | ✅ | `entity_id` column | Required |
| 4.3 Filters logged | ✅ | `metadata.filters` | Sanitized |
| 4.4 Timestamp logged | ✅ | `created_at` column | Immutable |
| 4.5 IP address logged | ✅ | `ip_address` column | Required |
| 4.6 Result URL logged | ✅ | `metadata.result_url` | NOT the content |
| 4.7 Immutable logs | ✅ | WORM storage | 90-day retention |
| 4.8 Log encryption | ✅ | AES-256 at rest | S3 SSE-KMS |

### Audit Log Schema

```sql
CREATE TABLE export_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    action VARCHAR(64) NOT NULL,        -- 'export_created', 'url_accessed', etc.
    entity_type VARCHAR(64) NOT NULL,   -- 'export_job', 'signed_url'
    entity_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64),
    partner_id VARCHAR(64),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    result VARCHAR(16) NOT NULL,        -- 'success', 'failure', 'denied'
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 5. Encryption

| Item | Status | Implementation | Notes |
|------|--------|----------------|-------|
| 5.1 S3 Server-Side Encryption | ✅ | SSE-S3 by default | AES-256 |
| 5.2 SSE-KMS (recommended) | ⚠️ | Configurable | Key rotation enabled |
| 5.3 TLS in transit | ✅ | Enforced | Minimum TLS 1.2 |
| 5.4 Export artifact encryption | ✅ | S3 managed | Automatic |
| 5.5 Key rotation | ✅ | KMS automatic | Annual rotation |

### S3 Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EnforceTLS",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::cargobit-exports",
        "arn:aws:s3:::cargobit-exports/*"
      ],
      "Condition": {
        "Bool": { "aws:SecureTransport": "false" }
      }
    },
    {
      "Sid": "EnforceEncryption",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::cargobit-exports/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": ["AES256", "aws:kms"]
        }
      }
    }
  ]
}
```

---

## 6. IAM Least Privilege

| Item | Status | Implementation | Notes |
|------|--------|----------------|-------|
| 6.1 Worker IAM role defined | ✅ | `payments-export-worker` | Dedicated role |
| 6.2 Write-only to export path | ✅ | `s3:PutObject` on `/exports/*` | No read access |
| 6.3 No wildcard permissions | ✅ | Specific resource ARNs | No `*` |
| 6.4 Cross-account access denied | ✅ | Explicit deny | Principle of least trust |
| 6.5 MFA for console access | ✅ | IAM policy condition | Required for admins |

### IAM Policy for Export Worker

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPutExportObjects",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::cargobit-exports/exports/*"
    },
    {
      "Sid": "AllowKMSDecrypt",
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ],
      "Resource": "arn:aws:kms:eu-central-1:123456789:key/export-key-id"
    },
    {
      "Sid": "DenyAllOtherS3",
      "Effect": "Deny",
      "Action": "s3:*",
      "NotResource": "arn:aws:s3:::cargobit-exports/exports/*"
    }
  ]
}
```

---

## 7. Retention and Deletion

| Item | Status | Implementation | Notes |
|------|--------|----------------|-------|
| 7.1 Artifact TTL defined | ✅ | 7 days default | Configurable |
| 7.2 Lifecycle policy | ✅ | S3 lifecycle rule | Automatic deletion |
| 7.3 Audit log retention | ✅ | 90 days | Compliance requirement |
| 7.4 Manual deletion API | ✅ | Admin endpoint | Immediate deletion |
| 7.5 Deletion audit | ✅ | Logged in audit table | Track deletions |

### S3 Lifecycle Configuration

```xml
<LifecycleConfiguration>
  <Rule>
    <ID>DeleteExportsAfter7Days</ID>
    <Prefix>exports/</Prefix>
    <Status>Enabled</Status>
    <Expiration>
      <Days>7</Days>
    </Expiration>
  </Rule>
  <Rule>
    <ID>TransitionToGlacierAfter30Days</ID>
    <Prefix>exports/archive/</Prefix>
    <Status>Enabled</Status>
    <Transition>
      <Days>30</Days>
      <StorageClass>GLACIER</StorageClass>
    </Transition>
  </Rule>
</LifecycleConfiguration>
```

---

## 8. Penetration Testing

| Item | Status | Frequency | Notes |
|------|--------|-----------|-------|
| 8.1 Annual pentest | ⏳ | Annual | External vendor |
| 8.2 Quarterly code review | ✅ | Quarterly | Security team |
| 8.3 Injection test | ✅ | CI/CD | SQL injection checks |
| 8.4 Auth bypass test | ✅ | CI/CD | Automated tests |
| 8.5 Rate limit test | ✅ | Load test | k6 script |

---

## 9. Monitoring and Alerts

| Alert | Threshold | Severity | Response |
|-------|-----------|----------|----------|
| Export failures | >5 in 5min | Critical | Page on-call |
| Large export volume | >10GB/user/day | Warning | Review usage |
| Unusual access patterns | Anomaly detection | Warning | Security review |
| Signed URL abuse | >100 URLs/hour | Warning | Rate limit check |
| DLQ growth | >50 items | Warning | Review failures |

---

## 10. Operational Playbooks

### Incident: Leaked Signed URL

1. **Immediate**: Revoke URL via API
   ```bash
   curl -X DELETE "$API/admin/reconciliation/export/url/$KEY/revoke"
   ```

2. **Short-term**: Rotate bucket policy
   ```bash
   aws s3api put-bucket-policy --bucket cargobit-exports --policy file://new-policy.json
   ```

3. **Long-term**: Rotate KMS key if KMS was used

4. **Post-incident**: Audit access logs, notify affected users

---

## Acceptance Criteria

- [ ] All Critical items (1-6) implemented
- [ ] All Warning items (7-9) documented with mitigation plan
- [ ] Security review completed and signed off
- [ ] Penetration test passed or exceptions documented

---

**Approved by:** _ _ _ _ _ _ _ _ _  
**Date:** _ _ _ _ _ _ _ _ _
