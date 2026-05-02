# CargoBit Payment System - Architecture Overview

**Version:** 1.0.0  
**Generated:** 2026-05-02

---

## 1. System Overview

CargoBit is a production-ready payment processing system designed for reliability, compliance, and scalability. The system integrates with Stripe for payment processing and implements comprehensive audit logging, rate limiting, and operational tooling.

### 1.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Security First** | All sensitive operations are logged and verified |
| **Compliance Ready** | Built-in audit trails and GDPR-compliant data handling |
| **High Availability** | Designed for 99.9% uptime SLA |
| **Observable** | Comprehensive logging and monitoring integration points |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  Web App  │  Mobile App  │  API Consumers  │  Admin Dashboard   │
└─────┬─────┴──────┬───────┴────────┬────────┴────────┬───────────┘
      │            │                │                 │
      ▼            ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY / LOAD BALANCER                  │
│                    (Rate Limiting Middleware)                    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                            │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Payment API    │  Webhook API    │  Admin API                  │
│  /api/payments  │  /webhooks/*    │  /api/admin/*               │
└────────┬────────┴────────┬────────┴─────────────────────────────┘
         │                 │
         ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                                │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  PaymentService │  StripeService  │  AuditLogService            │
│  UserService    │  WebhookHandler │  RateLimitService           │
└────────┬────────┴────────┬────────┴─────────────────────────────┘
         │                 │
         ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                   │
├─────────────────────────┬───────────────────────────────────────┤
│      PostgreSQL         │              Redis                    │
│   (Primary Database)    │     (Cache + Rate Limiting)           │
│   - Users               │     - Rate limit counters             │
│   - Payments            │     - Session cache                   │
│   - Audit Logs          │     - Webhook idempotency             │
│   - Webhook Events      │                                       │
└─────────────────────────┴───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                              │
├─────────────────────────────────────────────────────────────────┤
│  Stripe API  │  S3/Storage  │  Monitoring (Prometheus/Grafana)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 Entity Relationship Diagram

```
┌───────────────┐       ┌───────────────┐
│     User      │       │    Payment    │
├───────────────┤       ├───────────────┤
│ id            │───┐   │ id            │
│ email         │   │   │ userId (FK)   │───┐
│ name          │   └──▶│ amount        │   │
│ stripeCustomer│       │ currency      │   │
│ createdAt     │       │ status        │   │
│ updatedAt     │       │ stripePI      │   │
└───────────────┘       │ createdAt     │   │
                        └───────────────┘   │
                                            │
┌───────────────┐                           │
│   AuditLog    │                           │
├───────────────┤                           │
│ id            │                           │
│ userId (FK)   │───────────────────────────┘
│ action        │
│ entityType    │       ┌───────────────┐
│ entityId      │       │ WebhookEvent  │
│ oldValues     │       ├───────────────┤
│ newValues     │       │ id            │
│ ipAddress     │       │ stripeEventId │
│ createdAt     │       │ eventType     │
└───────────────┘       │ processed     │
                        │ payload       │
┌───────────────┐       │ receivedAt    │
│RateLimitCntr  │       └───────────────┘
├───────────────┤
│ id            │       ┌───────────────┐
│ key           │       │BackupMetadata │
│ count         │       ├───────────────┤
│ windowStart   │       │ id            │
│ expiresAt     │       │ backupType    │
└───────────────┘       │ status        │
                        │ sizeBytes     │
                        │ startedAt     │
                        └───────────────┘
```

### 3.2 Table Descriptions

| Table | Purpose | Key Constraints |
|-------|---------|-----------------|
| `users` | User accounts and Stripe customer mapping | Email unique, Stripe customer ID unique |
| `payments` | Payment transactions | Cascade delete with user |
| `audit_logs` | Immutable audit trail for compliance | Retention policy: 7 years |
| `webhook_events` | Stripe webhook event processing | Idempotency key on stripeEventId |
| `rate_limit_counters` | Request rate limiting counters | TTL-based expiration |
| `backup_metadata` | Backup operation tracking | For PITR and restore operations |

---

## 4. Security Architecture

### 4.1 Authentication & Authorization

| Layer | Implementation |
|-------|----------------|
| **Authentication** | JWT-based with refresh tokens |
| **Authorization** | Role-based access control (RBAC) |
| **API Keys** | Scoped API keys for service-to-service auth |

### 4.2 Data Protection

| Protection Type | Implementation |
|-----------------|----------------|
| **Encryption at Rest** | AES-256 for sensitive fields |
| **Encryption in Transit** | TLS 1.3 mandatory |
| **PII Handling** | Anonymization for audit logs |

### 4.3 Stripe Integration Security

- Webhook signature verification using HMAC-SHA256
- Idempotency keys for all mutating operations
- No storage of full card numbers (tokenized via Stripe)

---

## 5. Rate Limiting Strategy

### 5.1 Limits

| Endpoint Category | Rate Limit | Window |
|-------------------|------------|--------|
| Public API | 100 requests | 1 minute |
| Authenticated API | 1000 requests | 1 minute |
| Webhook Processing | 500 events | 1 minute |
| Admin API | 5000 requests | 1 minute |
| Payment Creation | 10 requests | 1 minute |
| Auth Attempts | 5 requests | 1 minute |

### 5.2 Implementation

- Redis-based sliding window counter
- Graceful degradation with retry-after headers
- Per-user and per-IP limiting

---

## 6. Audit Logging

### 6.1 Logged Events

| Category | Events |
|----------|--------|
| **Payment** | Created, Succeeded, Failed, Refunded, Disputed |
| **User** | Created, Updated, Deleted, Login, Logout |
| **Webhook** | Received, Processed, Error |
| **Admin** | All administrative actions |
| **System** | Backup, Restore, Export |

### 6.2 Log Structure

Each audit log entry contains:

```json
{
  "id": "clx123...",
  "userId": "clx456...",
  "action": "PAYMENT_SUCCEEDED",
  "entityType": "Payment",
  "entityId": "clx789...",
  "oldValues": { "status": "PENDING" },
  "newValues": { "status": "SUCCEEDED" },
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "requestId": "req_abc123",
  "createdAt": "2026-05-02T12:00:00Z"
}
```

---

## 7. Backup & Recovery

### 7.1 Backup Schedule

| Type | Frequency | Retention |
|------|-----------|-----------|
| Full Backup | Daily | 30 days |
| Incremental | Hourly | 7 days |
| WAL Archive | Continuous | 7 days |

### 7.2 Recovery Objectives

| Metric | Target |
|--------|--------|
| **RTO** (Recovery Time Objective) | 4 hours |
| **RPO** (Recovery Point Objective) | 5 minutes (with PITR) |

---

## 8. Monitoring & Alerting

### 8.1 Key Metrics

| Category | Metrics |
|----------|---------|
| **Payment** | Success rate, Processing time, Failure reasons |
| **API** | Response time (p50, p95, p99), Error rate |
| **Database** | Connection pool, Query time, Replication lag |
| **Rate Limiting** | Rejection rate, Top offenders |

### 8.2 Alert Conditions

| Alert | Threshold |
|-------|-----------|
| Payment failure rate | > 1% |
| API latency p95 | > 500ms |
| Database connections | > 80% pool |
| Webhook queue backlog | > 100 events |

---

## 9. Deployment Architecture

### 9.1 Environments

| Environment | Purpose | Data |
|-------------|---------|------|
| Development | Feature development | Synthetic data |
| Staging | Integration testing | Anonymized production subset |
| Production | Live traffic | Real customer data |

### 9.2 CI/CD Pipeline

```
Code Commit → Build → Unit Tests → Security Scan → Staging Deploy
    → Integration Tests → Manual Approval → Production Deploy
```

---

## 10. Compliance Considerations

### 10.1 GDPR Compliance

| Requirement | Implementation |
|-------------|----------------|
| Right to Access | User data export endpoint |
| Right to Erasure | Cascading delete with audit trail |
| Data Portability | Standard export formats |
| Consent Management | Opt-in tracking |

### 10.2 PCI DSS Compliance

| Requirement | Status |
|-------------|--------|
| Card Data Storage | ❌ Not stored (Stripe handles) |
| SAQ Type | ✅ SAQ A |
| Annual Assessment | ✅ Required |

---

## 11. API Overview

### 11.1 Payment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments` | Create payment |
| GET | `/api/payments/:id` | Get payment status |
| POST | `/api/payments/:id/refund` | Refund payment |

### 11.2 Webhook Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/stripe` | Stripe webhook receiver |
| GET | `/api/webhooks/health` | Health check |

---

## 12. File Structure

```
project/
├── prisma/
│   └── schema.prisma          # Database schema
├── migrations/
│   ├── 0001_init.sql          # Initial tables
│   └── 0002_indexes.sql       # Performance indexes
├── src/
│   ├── lib/
│   │   └── rateLimit.ts       # Rate limiting library
│   ├── middleware/
│   │   └── rateLimit.ts       # Express middleware
│   ├── webhooks/
│   │   └── stripe.ts          # Stripe webhook handler
│   ├── services/
│   │   ├── stripeEvents.ts    # Event processing
│   │   └── auditLog.ts        # Audit logging
│   └── jobs/
│       └── auditVerify.ts     # Audit verification job
├── ops/
│   ├── backup-db.sh           # Backup script
│   ├── restore-db.sh          # Restore script
│   └── cron-backup.yaml       # Cron configuration
├── tests/
│   ├── rateLimit.test.ts      # Rate limit tests
│   └── stripeWebhook.test.ts  # Webhook tests
└── docs/
    ├── security-policy.md
    ├── compliance-readiness.md
    ├── slas.md
    └── operational-readiness-checklist.md
```

---

*Document generated for CargoBit Payment System*  
*Version 1.0.0 | 2026-05-02*
