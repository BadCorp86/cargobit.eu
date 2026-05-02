# Security Policy

## Overview

This document outlines security requirements and practices for CargoBit Payment System.

---

## 1. Access Control

### Authentication

| System | Method | MFA | Notes |
|--------|--------|-----|-------|
| Application | JWT + Session | Optional | OAuth for SSO |
| Database | Password + SSL | N/A | IP whitelist |
| Redis | Password + TLS | N/A | VPC only |
| AWS/GCP | IAM | Required | SSO preferred |
| Stripe | API Key | Required | Separate keys per environment |

### Authorization

- **Role-Based Access Control (RBAC)** implemented
- **Principle of Least Privilege** enforced
- Regular access reviews (quarterly)

### Secrets Management

```
Environment Variables
├── Production (Infisical/Vault)
│   ├── Database credentials
│   ├── API keys
│   └── Encryption keys
├── Staging (Infisical/Vault)
└── Development (.env.local, gitignored)
```

**Rotation Schedule:**
- Database passwords: 90 days
- API keys: 90 days
- JWT secret: 180 days
- Encryption keys: 1 year

---

## 2. Data Protection

### Classification

| Level | Description | Examples | Handling |
|-------|-------------|----------|----------|
| **Critical** | Financial, auth | Card numbers, passwords | Encrypted, masked, strict access |
| **Sensitive** | PII | Email, name, address | Encrypted, logged access |
| **Internal** | Business data | Transactions, logs | Access controlled |
| **Public** | Non-sensitive | Product info | No restrictions |

### Encryption

**At Rest:**
- Database: Transparent Data Encryption (TDE) via provider
- S3: SSE-KMS (AWS managed keys)
- Backups: AES-256

**In Transit:**
- TLS 1.2+ required everywhere
- HSTS enabled (1 year, includeSubdomains)
- Certificate pinning for mobile apps

**Application-Level:**
- Sensitive fields encrypted before storage
- Key rotation without data re-encryption

### Data Retention

| Data Type | Retention | Deletion |
|-----------|-----------|----------|
| Transactions | 7 years | Archive |
| Audit logs | 90 days hot, 7 years cold | Archive |
| User data | Until deletion request + 30 days | Hard delete |
| Sessions | 30 days | Auto-delete |
| Error logs | 90 days | Auto-delete |

---

## 3. Application Security

### Input Validation

- **All user input is untrusted**
- Server-side validation required (client-side is UX only)
- Parameterized queries for all database operations
- Allowlist validation for structured input

### Output Encoding

- Context-aware encoding (HTML, JSON, URL)
- Content Security Policy (CSP) implemented
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY

### Rate Limiting

```typescript
const RATE_LIMITS = {
  // Prevent brute force
  "POST /api/auth/login": { limit: 5, window: 300 },
  "POST /api/auth/forgot-password": { limit: 3, window: 3600 },
  
  // Prevent abuse
  "POST /api/payments": { limit: 20, window: 60 },
  "GET /api/exports": { limit: 5, window: 300 },
  
  // Standard API
  "GET /api/*": { limit: 100, window: 60 },
};
```

### Security Headers

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

---

## 4. Payment Security

### PCI-DSS Compliance

- **SAQ A** (Stripe handles card data)
- No card data stored on our servers
- Stripe Elements for card collection
- 3D Secure enabled

### Webhook Security

1. **Signature Validation** - Every webhook verified
2. **Idempotency** - Duplicate protection
3. **Timeout Handling** - Respond within 5 seconds
4. **Error Handling** - 5xx for retry, 4xx for permanent failure

### Fraud Prevention

- Velocity checks (max payments per hour)
- Amount thresholds (flag > €10,000)
- Geographic anomaly detection
- Manual review queue for suspicious activity

---

## 5. Infrastructure Security

### Network

- **VPC** with private subnets for databases
- **Security Groups** with minimal ports
- **WAF** for application layer protection
- **DDoS protection** via Cloudflare/AWS Shield

### Containers

- Base images from trusted sources only
- Vulnerability scanning in CI/CD
- No secrets in images
- Read-only root filesystem

### Monitoring

- Security event logging
- Anomaly detection
- Failed authentication alerts
- Privilege escalation detection

---

## 6. Incident Response

### Security Incident Severity

| Level | Example | Response |
|-------|---------|----------|
| **Critical** | Data breach, active attack | Immediate containment |
| **High** | Vulnerability exploit attempt | Same-day fix |
| **Medium** | Policy violation | Weekly review |
| **Low** | Minor misconfiguration | Monthly remediation |

### Response Process

1. **Identify** - Detect and confirm incident
2. **Contain** - Limit damage spread
3. **Eradicate** - Remove threat
4. **Recover** - Restore service
5. **Review** - Post-incident analysis

### Communication

- **Internal**: Slack #security-incidents
- **Legal**: Notify within 24 hours for data breach
- **Customers**: Notify within 72 hours per GDPR
- **Regulators**: Notify within 72 hours per GDPR

---

## 7. Development Security

### Code Review

- All changes require PR review
- Security-sensitive changes require security team approval
- Automated checks for secrets, vulnerabilities

### Dependency Management

- Dependabot for automated updates
- Weekly vulnerability scans
- Lock files committed

### Security Testing

| Type | Frequency | Tools |
|------|-----------|-------|
| SAST | Every commit | Semgrep, CodeQL |
| DAST | Weekly | OWASP ZAP |
| Dependency scan | Daily | Dependabot, Snyk |
| Penetration test | Annually | External vendor |

---

## 8. Compliance

### GDPR

- Data Processing Agreement (DPA) with all processors
- Right to erasure implemented
- Data portability supported
- Consent management in place

### SOC 2 Type II

- Annual audit
- Controls documented
- Evidence collection automated

### PCI-DSS

- SAQ A completed annually
- Quarterly security scans
- Annual penetration test

---

## 9. Security Checklist

### Pre-Launch
- [ ] Security review completed
- [ ] Penetration test passed
- [ ] All critical/high vulnerabilities resolved
- [ ] Security monitoring configured
- [ ] Incident response tested
- [ ] Team trained on security policies

### Ongoing
- [ ] Weekly vulnerability review
- [ ] Monthly access review
- [ ] Quarterly security training
- [ ] Annual penetration test
- [ ] Annual policy review

---

**Document Owner**: Security Lead  
**Last Updated**: 2024-01-15  
**Review Cycle**: Quarterly  
**Classification**: Internal
