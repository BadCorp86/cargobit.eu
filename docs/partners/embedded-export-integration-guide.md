# Pilot Pack: Embedded Export Integration Guide

## Overview

This guide explains how to embed an Export button in your UI that triggers a secure export job on the CargoBit platform and receives a webhook when the export is ready. This integration enables your users to download reconciliation reports directly from your interface without needing to access the CargoBit admin portal.

---

## Pilot Pack Email Template

### Subject: Pilot Invitation — Embedded Reconciliation Export Integration

```
Hi [Partner Name],

We'd like to invite [Partner Company] to a pilot integrating our Reconciliation Reporting & Export feature directly into your platform.

What we offer in the pilot
- Embedded Export Button in your UI that triggers secure background exports (CSV/JSON).
- Webhook notifications when exports complete with signed download URLs.
- Sandbox environment, SDK snippets, and 1:1 engineering support.

Pilot scope
- OAuth2 integration for authentication.
- One export flow embedded in your UI.
- 5–10 pilot customers for 4–6 weeks.

Next steps
1. Confirm technical contact and NDA.
2. Kickoff call to align on scope and timeline.
3. Provide sandbox credentials and sample customer IDs.

Please reply with the best contact and available times for a 30‑minute kickoff this week.

Best,
[Your Name]
[Title]
CargoBit Payments Team
```

---

## Integration Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Partner   │     │   CargoBit  │     │   Export    │     │     S3      │
│     UI      │     │    API      │     │   Worker    │     │  Storage    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ 1. User clicks    │                   │                   │
       │    Export         │                   │                   │
       │                   │                   │                   │
       │ 2. POST /export   │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
       │                   │ 3. Enqueue job    │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
       │ 4. Return jobId   │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │                   │                   │ 5. Process export │
       │                   │                   │    stream data    │
       │                   │                   │──────────────────>│
       │                   │                   │                   │
       │                   │                   │ 6. Upload parts   │
       │                   │                   │<──────────────────│
       │                   │                   │                   │
       │                   │ 7. Webhook with   │                   │
       │                   │    signed URL     │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
       │ 8. Webhook to     │                   │                   │
       │    partner        │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
       │ 9. Show download  │                   │                   │
       │    link to user   │                   │                   │
       │                   │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┘
```

### Flow Steps

1. **User clicks Export** in partner UI
2. **Partner calls CargoBit API** `POST /admin/reconciliation/report/export` with partner JWT
3. **CargoBit enqueues** an export job and returns `jobId`
4. **Worker processes job**, uploads artifact to S3 via multipart upload
5. **Worker generates** signed URL with configurable TTL
6. **Worker sends webhook** `POST /webhooks/report_exported` to partner callback URL
7. **Partner receives webhook** with `result_url` (signed URL)
8. **Partner shows download link** to user

---

## Authentication

### OAuth2 Client Credentials Flow

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={partner_client_id}
&client_secret={partner_client_secret}
&scope=reports:export
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "reports:export"
}
```

### Required Scopes

| Scope | Description |
|-------|-------------|
| `reports:export` | Required to trigger export jobs and retrieve job status |
| `reports:read` | Required to view reconciliation reports |

---

## API Reference

### Request Export Job

**Endpoint:** `POST /admin/reconciliation/report/export`

**Headers:**
```http
Authorization: Bearer <partner_jwt>
Content-Type: application/json
```

**Request Body:**
```json
{
  "format": "csv",
  "filter": {
    "status": "paid",
    "from": "2026-04-01",
    "to": "2026-04-23",
    "score_min": 70
  },
  "callback_url": "https://partner.example.com/webhooks/report_exported",
  "metadata": {
    "partnerCustomerId": "abc-123",
    "reference": "Q1-Report"
  },
  "options": {
    "include_score": true,
    "mask_pii": true,
    "timezone": "Europe/Berlin"
  }
}
```

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `format` | string | Yes | Export format: `csv` or `json` |
| `filter` | object | No | Filter criteria for export data |
| `filter.status` | string | No | Filter by payout status |
| `filter.from` | string | No | Start date (ISO 8601) |
| `filter.to` | string | No | End date (ISO 8601) |
| `filter.score_min` | number | No | Minimum score threshold |
| `callback_url` | string | Yes | Webhook URL for completion notification |
| `metadata` | object | No | Custom metadata returned in webhook |
| `options.include_score` | boolean | No | Include score columns (default: true) |
| `options.mask_pii` | boolean | No | Mask PII fields (default: true) |
| `options.timezone` | string | No | Timezone for timestamps (default: UTC) |

**Response (202 Accepted):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "estimatedRows": 15000,
  "estimatedTimeSeconds": 45,
  "createdAt": "2026-04-24T10:30:00Z"
}
```

---

### Check Job Status

**Endpoint:** `GET /admin/reconciliation/report/export/{jobId}`

**Headers:**
```http
Authorization: Bearer <partner_jwt>
```

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "progress": {
    "rowsProcessed": 8500,
    "totalRows": 15000,
    "percentComplete": 57
  },
  "createdAt": "2026-04-24T10:30:00Z",
  "startedAt": "2026-04-24T10:30:02Z"
}
```

**Job Status Values:**

| Status | Description |
|--------|-------------|
| `queued` | Job is waiting to be processed |
| `running` | Job is currently being processed |
| `done` | Job completed successfully, artifact available |
| `failed` | Job failed, see `error_message` for details |

---

### Completed Job Response

**Response (status=done):**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "done",
  "result_url": "https://exports.cargobit.example.com/signed/xK9mN2pL...",
  "result_expires_at": "2026-04-25T10:30:00Z",
  "rows_exported": 15000,
  "bytes": 2456789,
  "format": "csv",
  "createdAt": "2026-04-24T10:30:00Z",
  "completedAt": "2026-04-24T10:30:45Z",
  "metadata": {
    "partnerCustomerId": "abc-123",
    "reference": "Q1-Report"
  }
}
```

---

## Webhook Payload

### Report Exported Event

**POST to `callback_url`:**

```json
{
  "event": "report_exported",
  "timestamp": "2026-04-24T10:30:45.123Z",
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "done",
    "result_url": "https://exports.cargobit.example.com/signed/xK9mN2pL...",
    "result_expires_at": "2026-04-25T10:30:00Z",
    "rows_exported": 15000,
    "format": "csv",
    "metadata": {
      "partnerCustomerId": "abc-123",
      "reference": "Q1-Report"
    }
  }
}
```

### Webhook Headers

```http
Content-Type: application/json
X-CargoBit-Signature: sha256=<hmac_signature>
X-CargoBit-Event: report_exported
X-CargoBit-Delivery: <uuid>
```

### Signature Verification

```javascript
// Node.js example
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + 
    crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage
const isValid = verifySignature(
  req.body,
  req.headers['x-cargobit-signature'],
  process.env.CARGOBIT_WEBHOOK_SECRET
);
```

### Failed Export Webhook

```json
{
  "event": "report_export_failed",
  "timestamp": "2026-04-24T10:31:00.123Z",
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "failed",
    "error_code": "EXPORT_LIMIT_EXCEEDED",
    "error_message": "Export exceeds maximum row limit of 1,000,000",
    "metadata": {
      "partnerCustomerId": "abc-123",
      "reference": "Q1-Report"
    }
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_FORMAT` | 400 | Unsupported export format |
| `INVALID_FILTER` | 400 | Invalid filter parameters |
| `MISSING_CALLBACK` | 400 | callback_url is required |
| `UNAUTHORIZED` | 401 | Invalid or expired token |
| `FORBIDDEN` | 403 | Missing required scope |
| `RATE_LIMITED` | 429 | Too many export requests |
| `EXPORT_LIMIT_EXCEEDED` | 422 | Export exceeds row/size limit |
| `JOB_NOT_FOUND` | 404 | Job ID does not exist |

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { CargoBitClient } from '@cargobit/partner-sdk';

const client = new CargoBitClient({
  clientId: process.env.CARGOBIT_CLIENT_ID,
  clientSecret: process.env.CARGOBIT_CLIENT_SECRET,
  environment: 'sandbox' // or 'production'
});

// Trigger export
const job = await client.exports.create({
  format: 'csv',
  filter: {
    status: 'paid',
    from: '2026-04-01',
    to: '2026-04-23'
  },
  callback_url: 'https://partner.example.com/webhooks/cargobit'
});

console.log('Export started:', job.jobId);

// Poll for status
const status = await client.exports.get(job.jobId);
if (status.status === 'done') {
  console.log('Download URL:', status.result_url);
}
```

### Python

```python
from cargobit import CargoBitClient

client = CargoBitClient(
    client_id=os.environ['CARGOBIT_CLIENT_ID'],
    client_secret=os.environ['CARGOBIT_CLIENT_SECRET'],
    environment='sandbox'
)

# Trigger export
job = client.exports.create(
    format='csv',
    filter={
        'status': 'paid',
        'from': '2026-04-01',
        'to': '2026-04-23'
    },
    callback_url='https://partner.example.com/webhooks/cargobit'
)

print(f'Export started: {job.job_id}')

# Poll for status
status = client.exports.get(job.job_id)
if status.status == 'done':
    print(f'Download URL: {status.result_url}')
```

---

## Best Practices

### 1. Webhook Security

- **Always verify signatures** using HMAC-SHA256
- **Use timing-safe comparison** to prevent timing attacks
- **Return 200 quickly** - process webhooks asynchronously
- **Implement idempotency** using `X-CargoBit-Delivery` header

```javascript
// Store processed delivery IDs
const processedDeliveries = new Set();

app.post('/webhooks/cargobit', async (req, res) => {
  const deliveryId = req.headers['x-cargobit-delivery'];
  
  // Idempotency check
  if (processedDeliveries.has(deliveryId)) {
    return res.status(200).send('Already processed');
  }
  
  // Verify signature
  if (!verifySignature(req.body, req.headers['x-cargobit-signature'], secret)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Mark as processed
  processedDeliveries.add(deliveryId);
  
  // Return quickly, process async
  res.status(200).send('OK');
  
  // Process webhook in background
  processWebhook(req.body);
});
```

### 2. Signed URL Handling

- **Use short TTL** (default 24h, can be configured lower)
- **Download immediately** when user clicks
- **Don't store URLs** - they expire
- **Handle expiration gracefully** with retry option

### 3. Error Handling

- **Retry webhook delivery** with exponential backoff
- **Log all failures** for debugging
- **Alert on repeated failures**
- **Provide user feedback** on export status

### 4. Performance

- **Use streaming download** for large files
- **Consider async UI** - don't block user while waiting
- **Cache job status** - don't poll too frequently
- **Implement pagination** for large datasets

---

## Sandbox Environment

### Base URLs

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api.sandbox.cargobit.example.com` |
| Production | `https://api.cargobit.example.com` |

### Test Data

Sandbox environment includes pre-seeded test data:
- 1,000 sample payouts with various statuses
- Score distribution across all categories
- Edge cases (duplicates, mismatches, stale payouts)

### Rate Limits

| Endpoint | Sandbox | Production |
|----------|---------|------------|
| `POST /export` | 10/min | 60/min |
| `GET /export/{id}` | 100/min | 1000/min |
| Webhook delivery | 100/min | Unlimited |

---

## Support

- **Technical Documentation**: https://docs.cargobit.example.com
- **SDK Repository**: https://github.com/cargobit/partner-sdk
- **Support Email**: partners@cargobit.example.com
- **Status Page**: https://status.cargobit.example.com

---

## Appendix: Sample Export Formats

### CSV Format

```csv
payout_id,reference,status,amount_cents,score,score_reasons,created_at
uuid-001,PO-2026-001,paid,50000,100,,2026-04-20T10:00:00Z
uuid-002,PO-2026-002,paid,75000,40,amount_mismatch,2026-04-21T11:30:00Z
uuid-003,PO-2026-003,paid,25000,80,duplicate_detected,2026-04-22T09:15:00Z
```

### JSON Format

```json
[
  {
    "payout_id": "uuid-001",
    "reference": "PO-2026-001",
    "status": "paid",
    "amount_cents": 50000,
    "score": {
      "value": 100,
      "category": "healthy",
      "reasons": []
    },
    "created_at": "2026-04-20T10:00:00Z"
  },
  {
    "payout_id": "uuid-002",
    "reference": "PO-2026-002",
    "status": "paid",
    "amount_cents": 75000,
    "score": {
      "value": 40,
      "category": "critical",
      "reasons": ["amount_mismatch"]
    },
    "created_at": "2026-04-21T11:30:00Z"
  }
]
```
