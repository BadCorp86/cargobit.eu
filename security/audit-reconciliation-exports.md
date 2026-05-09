# Security Audit Checklist: Reconciliation Exports & Signed URLs

**Document Version:** 1.0  
**Last Updated:** 2026-04-24  
**Owner:** Security Team  
**Review Cycle:** Quarterly  

---

## Executive Summary

This checklist ensures the security of the reconciliation export system, covering access control, data protection, audit logging, encryption, and incident response. All items must be verified before production deployment and reviewed quarterly thereafter.

---

## 1. Access Control

### 1.1 Role-Based Access Control (RBAC)

- [ ] **Export API restricted to authorized roles**
  - Verify `POST /admin/reconciliation/report/export` requires admin or service account role
  - Verify `GET /admin/reconciliation/report/export/{jobId}` requires same role
  - Document: `src/lib/admin-rbac.ts`

- [ ] **RBAC rules reviewed and enforced**
  - All routes protected by `AdminAuthGuard`
  - Role hierarchy documented and enforced
  - No bypass routes without explicit approval

```typescript
// Example RBAC configuration
const RBAC_RULES = {
  '/admin/reconciliation/report/export': {
    POST: ['admin', 'finance_manager', 'service_account'],
    GET: ['admin', 'finance_manager', 'service_account']
  }
};
```

### 1.2 Service Account Controls

- [ ] **Service accounts have minimal required permissions**
  - Each service account has documented purpose
  - Service account tokens have expiration
  - Token rotation procedure documented

- [ ] **Partner OAuth scopes are limited**
  - Partners can only access `reports:export` scope
  - No access to other admin functions
  - Scope validation on every request

---

## 2. Signed URLs

### 2.1 URL Generation

- [ ] **Signed URLs generated server-side only**
  - No client-side URL generation
  - Private key never exposed to client
  - URL signing service isolated and monitored

- [ ] **Configurable TTL with safe defaults**
  - Default TTL: 24 hours (86400 seconds)
  - Maximum TTL: 72 hours (configurable per customer)
  - TTL validated on generation, not just at download

```typescript
// Configuration
const SIGNED_URL_CONFIG = {
  default_ttl_seconds: 86400,      // 24 hours
  max_ttl_seconds: 259200,          // 72 hours
  min_ttl_seconds: 300,             // 5 minutes
  algorithm: 'RSA-SHA256'
};
```

### 2.2 URL Delivery

- [ ] **URLs delivered only over HTTPS**
  - All API responses over TLS 1.2+
  - Redirect URLs use HTTPS scheme
  - No mixed content warnings

- [ ] **URLs not logged in plaintext**
  - Signed URLs masked in logs
  - Query parameters redacted
  - Audit logs contain only artifact keys

### 2.3 Revocation Mechanism

- [ ] **Mechanism to revoke signed URLs**
  - URL blacklisting capability exists
  - Immediate revocation for security events
  - Revocation propagation < 5 minutes

- [ ] **Key rotation procedure documented**
  - Signing key rotation runbook exists
  - Rotation can be triggered on demand
  - No service disruption during rotation

---

## 3. Data Minimization and Masking

### 3.1 PII Handling

- [ ] **Default export schema masks PII fields**
  - Email addresses: `j***@example.com`
  - Phone numbers: `+49***123`
  - Names: `J*** D***`
  - Bank account numbers: `DE89***4567`

- [ ] **Explicit flag required to include PII**
  - `mask_pii: false` must be set explicitly
  - PII inclusion logged in audit trail
  - Admin approval required for PII exports

```typescript
// PII masking rules
const PII_FIELDS = {
  email: { pattern: /(.{1}).*@/, replace: '$1***@' },
  phone: { pattern: /(\+\d{2})\d+(\d{4})/, replace: '$1***$2' },
  name: { pattern: /(.{1}).* (.{1}).*/, replace: '$1*** $2***' },
  iban: { pattern: /(.{4}).*(.{4})/, replace: '$1***$2' }
};
```

### 3.2 Data Retention

- [ ] **Export artifacts have retention policy**
  - Default retention: 7 days
  - Maximum retention: 30 days (configurable)
  - Automatic cleanup via S3 lifecycle rules

- [ ] **Customer-specific retention configurable**
  - Retention policy per customer contract
  - Policy enforced automatically
  - Audit trail for all deletions

---

## 4. Audit Logging

### 4.1 Export Events

- [ ] **Log entries for each export event**
  - `userId`: Who initiated the export
  - `jobId`: Unique job identifier
  - `filters`: What data was requested
  - `timestamp`: When export was initiated
  - `ip`: Source IP address
  - `userAgent`: Client information

- [ ] **All audit logs immutable**
  - Logs written to append-only storage
  - No modification or deletion possible
  - Retention period: 90 days minimum

```json
// Audit log entry example
{
  "event_type": "export_initiated",
  "timestamp": "2026-04-24T10:30:00.123Z",
  "user_id": "user-uuid-123",
  "job_id": "job-uuid-456",
  "filters": {
    "status": "paid",
    "from": "2026-04-01",
    "to": "2026-04-23"
  },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "metadata": {
    "format": "csv",
    "include_pii": false,
    "row_count": 15000
  }
}
```

### 4.2 Download Events

- [ ] **Signed URL access logged**
  - Download timestamp
  - Downloading IP (may differ from export initiator)
  - Success/failure status
  - Bytes transferred

- [ ] **Audit logs accessible to Security**
  - Security team has read access to all logs
  - Logs searchable by user, job, date range
  - Export functionality for compliance audits

---

## 5. Encryption

### 5.1 Data at Rest

- [ ] **S3 objects encrypted (SSE-KMS or SSE-S3)**
  - SSE-KMS preferred for customer-managed keys
  - Encryption algorithm: AES-256
  - KMS key rotation enabled (annual)

```yaml
# S3 bucket encryption configuration
ServerSideEncryptionConfiguration:
  - ServerSideEncryptionByDefault:
      SSEAlgorithm: aws:kms
      KMSMasterKeyID: alias/cargobit-exports-key
```

- [ ] **Database encryption enabled**
  - PostgreSQL TDE or encrypted EBS volumes
  - Encryption at rest for all columns
  - Key management documented

### 5.2 Data in Transit

- [ ] **TLS enforced for all transport**
  - Minimum TLS version: 1.2
  - TLS 1.3 preferred where supported
  - No downgrade to unencrypted protocols

- [ ] **Certificate management automated**
  - Certificates auto-renewed before expiration
  - Certificate pinning not used (allows rotation)
  - HSTS headers set on all responses

```yaml
# TLS configuration
tls:
  min_version: TLS1.2
  preferred_version: TLS1.3
  cipher_suites:
    - TLS_AES_256_GCM_SHA384
    - TLS_CHACHA20_POLY1305_SHA256
    - TLS_AES_128_GCM_SHA256
```

---

## 6. IAM Least Privilege

### 6.1 Worker Role Permissions

- [ ] **Worker role limited to required S3 operations**
  - Only `s3:PutObject` on `exports/*` prefix
  - Only `s3:GetObject` for signed URL generation
  - No `s3:DeleteObject` (lifecycle handles cleanup)

```json
// IAM policy for export worker
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::cargobit-exports/exports/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::cargobit-exports/exports/*"
    }
  ]
}
```

- [ ] **No wildcard permissions beyond required scope**
  - No `s3:*` or `*` permissions
  - Each permission reviewed and justified
  - Regular permission audits

### 6.2 Service Account Permissions

- [ ] **Each service account has minimal permissions**
  - Service account per service/component
  - No shared service accounts
  - Permissions reviewed quarterly

---

## 7. Retention and Lifecycle

### 7.1 S3 Lifecycle Rules

- [ ] **Lifecycle rule to delete artifacts after TTL**
  - Automatic transition to IA after 7 days
  - Automatic deletion after retention period
  - Lifecycle rules tested and verified

```xml
<!-- S3 Lifecycle Configuration -->
<LifecycleConfiguration>
  <Rule>
    <ID>DeleteOldExports</ID>
    <Prefix>exports/</Prefix>
    <Status>Enabled</Status>
    <Expiration>
      <Days>7</Days>
    </Expiration>
    <Transition>
      <Days>3</Days>
      <StorageClass>STANDARD_IA</StorageClass>
    </Transition>
  </Rule>
</LifecycleConfiguration>
```

- [ ] **Policy documented and configurable per customer**
  - Customer-specific retention available
  - Contract terms reflected in configuration
  - Policy changes logged and approved

---

## 8. Input Validation

### 8.1 Filter Validation

- [ ] **Export filters validated and parameterized**
  - All filter inputs sanitized
  - Parameterized queries only (no string concatenation)
  - SQL injection tests in CI pipeline

```typescript
// Input validation schema
const ExportFilterSchema = z.object({
  status: z.enum(['paid', 'pending', 'failed', 'all']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  score_min: z.number().min(0).max(100).optional(),
  score_max: z.number().min(0).max(100).optional()
}).refine(data => {
  if (data.from && data.to) {
    return new Date(data.from) <= new Date(data.to);
  }
  return true;
});
```

### 8.2 Size Limits

- [ ] **Max rows/size limits enforced per job**
  - Maximum rows: 1,000,000 per export
  - Maximum file size: 500 MB
  - User notified when limits approached

- [ ] **Rate limiting on export endpoints**
  - Per-user rate limit: 10 exports/minute
  - Per-tenant rate limit: 100 exports/hour
  - Rate limit headers in responses

---

## 9. Monitoring and Alerts

### 9.1 Security Alerts

- [ ] **Alerts for unusual export volume per user**
  - Threshold: >10 exports/hour per user
  - Alert sent to Security team
  - Automated temporary rate limit increase

- [ ] **Alerts for large file sizes**
  - Threshold: >100 MB per export
  - Alert includes user, job details
  - Review queue for manual inspection

### 9.2 Operational Alerts

- [ ] **Alerts for repeated failures**
  - Threshold: >5 consecutive failures
  - Includes error patterns
  - Auto-scaling consideration

```yaml
# Prometheus alert rules
groups:
  - name: export_security
    rules:
      - alert: HighExportVolume
        expr: increase(report_exports_total[1h]) > 50
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High export volume detected"
          
      - alert: LargeExportSize
        expr: histogram_quantile(0.95, report_export_bytes_bucket) > 104857600
        for: 5m
        labels:
          severity: info
        annotations:
          summary: "Large export files detected"
```

---

## 10. Incident Playbook

### 10.1 Immediate Response

- [ ] **Steps to revoke access**
  1. Disable user account in admin panel
  2. Revoke active tokens via `/admin/auth/revoke`
  3. Blacklist active signed URLs
  4. Notify Security team

- [ ] **Steps to delete artifacts**
  1. Identify affected job IDs from audit logs
  2. Delete S3 objects manually or via script
  3. Verify deletion via S3 inventory
  4. Log deletion in incident record

### 10.2 Key Rotation

- [ ] **Steps to rotate signing keys**
  1. Generate new key pair
  2. Deploy new public key to verification service
  3. Deploy new private key to signing service
  4. Monitor for verification failures
  5. Revoke old key after grace period (24h)

### 10.3 Contact List

| Role | Contact | Escalation Time |
|------|---------|-----------------|
| Security On-Call | security-oncall@cargobit.example.com | 15 min |
| Product Lead | product-lead@cargobit.example.com | 30 min |
| Backend Lead | backend-lead@cargobit.example.com | 30 min |
| DevOps On-Call | devops-oncall@cargobit.example.com | 15 min |

---

## 11. Penetration Testing

### 11.1 Test Scope

- [ ] **Export endpoints included in quarterly pentest scope**
  - `POST /admin/reconciliation/report/export`
  - `GET /admin/reconciliation/report/export/{jobId}`
  - Signed URL generation and verification
  - Webhook delivery

### 11.2 Test Cases

| Test Case | Expected Result |
|-----------|-----------------|
| Export without authentication | 401 Unauthorized |
| Export with invalid token | 401 Unauthorized |
| Export with insufficient scope | 403 Forbidden |
| Access another tenant's export | 404 Not Found |
| Access expired signed URL | 403 Forbidden |
| Modify signed URL parameters | 403 Forbidden (signature mismatch) |
| SQL injection in filters | Input sanitized, no data leak |
| XSS in export data | Content properly escaped |

---

## 12. Compliance Review

### 12.1 Legal Requirements

- [ ] **Legal signoff for cross-border data exports**
  - GDPR compliance verified
  - Data transfer agreements in place
  - User consent documented

- [ ] **PII handling procedures documented**
  - Data classification complete
  - Processing purposes documented
  - Retention policies compliant

### 12.2 Regulatory Requirements

- [ ] **SOC 2 Type II controls verified**
  - CC6.1: Logical access controls
  - CC6.6: Transmission protection
  - CC6.7: Data protection

- [ ] **ISO 27001 controls implemented**
  - A.8.2: Information classification
  - A.13.2: Information transfer
  - A.16.1: Information security incident management

---

## Checklist Completion

| Reviewer | Role | Date | Signature |
|----------|------|------|-----------|
| | Security Engineer | | |
| | Backend Lead | | |
| | Product Owner | | |
| | Compliance Officer | | |

**Next Review Date:** [Quarterly from approval date]

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-24 | Security Team | Initial version |
