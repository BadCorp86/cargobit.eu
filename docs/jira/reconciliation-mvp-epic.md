# Jira Epic and Ticket Templates

## Epic: Reconciliation Data Product MVP — Reconciliation Score and Export

**Epic Key**: `PAY-RECON-MVP`

### Epic Description

| Field | Value |
|-------|-------|
| **Goal** | Deliver a Reconciliation Score for payouts and an exportable report (CSV/JSON) with signed URLs and job tracking |
| **Success Metrics** | p95 score calculation < 2s; first 100 pilot exports completed without failures; adoption ≥ 10 exports/week in pilot |
| **Owners** | Product: *[name]*; Backend Lead: *[name]*; Data Engineer: *[name]*; QA: *[name]*; DevOps: *[name]* |
| **Timeline** | 2 sprints (10 working days) |

### Sprint Overview

| Sprint | Duration | Focus |
|--------|----------|-------|
| Sprint 0 | 3 days | Design & Data Prep |
| Sprint 1 | 5 days | Backend MVP (Score-Berechnung, API, DB) |
| Sprint 2 | 5 days | Export + UI + Telemetry |

---

## Ticket Template 1 — Design Score Spec

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Key** | PAY-RECON-MVP-1 |
| **Summary** | Define Reconciliation Score model and API contract |
| **Story Points** | 3 |

### Description

The Reconciliation Score provides a standardized metric to assess the health and accuracy of each payout reconciliation. This ticket covers the design phase where we define the scoring model, API contract, and UI wireframes.

**Key Deliverables:**
- Define score inputs, rules, and weights (examples: amount mismatch, missing payment, duplicate, stale)
- Provide SQL pseudocode and materialized view design
- Provide OpenAPI schema for `GET /admin/reconciliation/report?withScore=true`
- Deliver UI wireframe for score display and reasons

### Technical Details

**Score Calculation Logic:**
```
Score = 100 - (Penalty Points)

Penalty Conditions:
- Payout status not 'paid': -100 points (Score = 0)
- Amount mismatch with expected: -60 points (Score = 40)
- Duplicate payout detected: -20 points (Score = 80)
- Stale payout (>30 days old): -10 points (Score = 90)
- Missing reference: -30 points (Score = 70)
```

**Score Categories:**
| Score Range | Status | Color |
|-------------|--------|-------|
| 90-100 | Healthy | Green |
| 70-89 | Warning | Yellow |
| 50-69 | Attention | Orange |
| 0-49 | Critical | Red |

### Acceptance Criteria

- [ ] Score spec document in repo `docs/reconciliation/score-spec.md`
- [ ] Example SQL and sample dataset with expected outputs
- [ ] API contract added to OpenAPI and reviewed by Backend and Product
- [ ] UI wireframe showing score badge and breakdown tooltip

### Definition of Done

- [ ] Documentation reviewed and approved by Product
- [ ] SQL pseudocode validated against sample dataset
- [ ] OpenAPI spec passes linting
- [ ] Wireframe approved by Design

---

## Ticket Template 2 — Backend Score Implementation

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Key** | PAY-RECON-MVP-2 |
| **Summary** | Implement reconciliation score materialized view and API support |
| **Story Points** | 5 |

### Description

Implement the backend infrastructure for calculating and serving reconciliation scores. This includes database migrations, materialized view creation, refresh strategies, and API endpoint modifications.

**Key Deliverables:**
- Create migration for `reconciliation_scores` materialized view or table
- Implement score calculation job or on-read materialized view refresh strategy
- Add `score` and `score_reasons` to report API response

### Technical Implementation

**Migration SQL:**
```sql
-- migrations/20260425_create_reconciliation_scores.sql

CREATE MATERIALIZED VIEW reconciliation_scores AS
SELECT 
    p.id AS payout_id,
    p.reference,
    p.status,
    p.amount_cents,
    expected.amount_cents AS expected_amount_cents,
    CASE 
        WHEN p.status <> 'paid' THEN 0
        WHEN p.amount_cents <> expected.amount_cents THEN 40
        WHEN p.duplicate_count > 0 THEN 80
        WHEN p.created_at < NOW() - INTERVAL '30 days' THEN 90
        ELSE 100 
    END AS score,
    CASE 
        WHEN p.status <> 'paid' THEN ARRAY['payout_not_completed']
        WHEN p.amount_cents <> expected.amount_cents THEN ARRAY['amount_mismatch']
        WHEN p.duplicate_count > 0 THEN ARRAY['duplicate_detected']
        WHEN p.created_at < NOW() - INTERVAL '30 days' THEN ARRAY['stale_payout']
        ELSE ARRAY[]::TEXT[]
    END AS score_reasons,
    NOW() AS calculated_at
FROM payouts p 
LEFT JOIN expected_payouts expected ON p.reference = expected.reference
LEFT JOIN (
    SELECT reference, COUNT(*) as duplicate_count
    FROM payouts
    WHERE status = 'paid'
    GROUP BY reference
    HAVING COUNT(*) > 1
) dupes ON p.reference = dupes.reference;

-- Create index for fast lookups
CREATE INDEX idx_reconciliation_scores_payout_id ON reconciliation_scores(payout_id);
CREATE INDEX idx_reconciliation_scores_score ON reconciliation_scores(score);

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_reconciliation_scores()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY reconciliation_scores;
END;
$$ LANGUAGE plpgsql;
```

**API Response Enhancement:**
```json
{
  "payout_id": "uuid-1234",
  "reference": "PO-2026-001",
  "status": "paid",
  "amount_cents": 50000,
  "score": {
    "value": 80,
    "category": "warning",
    "reasons": ["duplicate_detected"],
    "calculated_at": "2026-04-24T10:30:00Z"
  }
}
```

### Acceptance Criteria

- [ ] Materialized view exists and can be refreshed
- [ ] API returns `score` and `score_reasons` for sample dataset
- [ ] Unit tests covering all score calculation rules
- [ ] Edge case tests for null values and missing references
- [ ] Performance test: score calculation < 2s for 10k payouts

### Definition of Done

- [ ] Migration tested on staging
- [ ] API endpoint documented in OpenAPI
- [ ] Unit tests passing with >90% coverage
- [ ] Code review approved
- [ ] QA validation complete

---

## Ticket Template 3 — Export with Signed URLs

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Key** | PAY-RECON-MVP-3 |
| **Summary** | Implement export job, streaming multipart upload, and signed URL delivery |
| **Story Points** | 8 |

### Description

Implement a robust export system that handles large datasets efficiently using streaming multipart S3 uploads. The system must generate secure signed URLs with configurable TTL for artifact access.

**Key Deliverables:**
- Create `export_jobs` entity if not present; worker uses streaming multipart S3 upload
- Generate signed URL with TTL (configurable, default 24h)
- Add metrics and logs for export duration, parts uploaded, retries

### Technical Implementation

**Export Job Entity:**
```typescript
// src/reports/entities/export-job.entity.ts
@Entity('export_jobs')
export class ExportJob {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  format: 'csv' | 'json';

  @Column('jsonb')
  filters: Record<string, any>;

  @Column({
    type: 'enum',
    enum: ['queued', 'running', 'done', 'failed'],
    default: 'queued'
  })
  status: string;

  @Column({ nullable: true })
  result_url: string;

  @Column({ nullable: true })
  result_key: string;

  @Column({ nullable: true })
  error_message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'int', default: 0 })
  rows_exported: number;

  @Column({ type: 'int', default: 0 })
  bytes_uploaded: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  completed_at: Date;
}
```

**Multipart Upload Service:**
```typescript
// src/services/multipart-upload.service.ts
export class MultipartUploadService {
  async uploadStream(
    key: string,
    stream: Readable,
    options: { contentType: string }
  ): Promise<{ key: string; size: number }> {
    const multipartUpload = await this.s3
      .createMultipartUpload({
        Bucket: this.bucket,
        Key: key,
        ContentType: options.contentType,
        ServerSideEncryption: 'aws:kms',
      })
      .promise();

    const parts: ManagedUpload.SendData[] = [];
    let partNumber = 1;
    let totalSize = 0;

    // Process stream in chunks
    for await (const chunk of stream) {
      const part = await this.s3
        .uploadPart({
          Bucket: this.bucket,
          Key: key,
          PartNumber: partNumber,
          UploadId: multipartUpload.UploadId,
          Body: chunk,
        })
        .promise();
      
      parts.push({ PartNumber: partNumber, ETag: part.ETag });
      totalSize += chunk.length;
      partNumber++;
    }

    await this.s3
      .completeMultipartUpload({
        Bucket: this.bucket,
        Key: key,
        UploadId: multipartUpload.UploadId,
        MultipartUpload: { Parts: parts },
      })
      .promise();

    return { key, size: totalSize };
  }
}
```

**Signed URL Generation:**
```typescript
// src/services/secure-export.service.ts
export class SecureExportService {
  async generateSignedUrl(
    key: string,
    ttlSeconds: number = 86400 // 24 hours default
  ): Promise<string> {
    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: this.bucket,
      Key: key,
      Expires: ttlSeconds,
      ResponseContentDisposition: `attachment; filename="${path.basename(key)}"`,
    });
  }
}
```

### Metrics to Track

| Metric | Type | Description |
|--------|------|-------------|
| `report_export_duration_seconds` | Histogram | Time to complete export job |
| `report_export_rows_total` | Counter | Total rows exported |
| `report_export_bytes_total` | Counter | Total bytes uploaded to S3 |
| `report_export_multipart_parts` | Histogram | Number of parts in multipart upload |
| `report_export_retries_total` | Counter | Number of upload retries |

### Acceptance Criteria

- [ ] Export job lifecycle: queued → running → done with `result_url`
- [ ] Signed URL valid and expires after TTL
- [ ] Load test for medium dataset (1M rows) passes
- [ ] Retry logic handles transient S3 errors
- [ ] Metrics emitted for all export phases

### Definition of Done

- [ ] Code reviewed and merged
- [ ] Integration tests passing
- [ ] Load test results documented
- [ ] Monitoring dashboards updated
- [ ] Documentation updated

---

## Ticket Template 4 — UI and E2E

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Key** | PAY-RECON-MVP-4 |
| **Summary** | Add Export button and Score UI; E2E tests |
| **Story Points** | 5 |

### Description

Implement the frontend UI for displaying reconciliation scores and triggering exports. This includes the export button with format selection, score visualization, and comprehensive E2E tests.

**Key Deliverables:**
- Add Export button in Admin UI with format selection
- Show score and reasons in report rows and detail view
- Add Newman collection tests for enqueue → process → artifact verification

### UI Components

**Score Badge Component:**
```tsx
// src/components/admin/score-badge.tsx
interface ScoreBadgeProps {
  score: number;
  reasons: string[];
}

export function ScoreBadge({ score, reasons }: ScoreBadgeProps) {
  const category = getScoreCategory(score);
  const colorMap = {
    healthy: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    attention: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge className={colorMap[category]}>
          Score: {score}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        {reasons.length > 0 ? (
          <ul>
            {reasons.map((reason, i) => (
              <li key={i}>{formatReason(reason)}</li>
            ))}
          </ul>
        ) : (
          <span>No issues detected</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
```

**Export Button Component:**
```tsx
// src/components/admin/export-button.tsx
export function ExportButton({ filters }: ExportButtonProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/admin/reconciliation/report/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, filter: filters }),
      });
      const { jobId } = await response.json();
      toast.success(`Export started. Job ID: ${jobId}`);
    } catch (error) {
      toast.error('Export failed to start');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={format} onValueChange={setFormat}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="csv">CSV</SelectItem>
          <SelectItem value="json">JSON</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={handleExport} disabled={isExporting}>
        {isExporting ? 'Exporting...' : 'Export'}
      </Button>
    </div>
  );
}
```

### Newman E2E Test Collection

```json
{
  "info": {
    "name": "Reconciliation Export E2E",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Enqueue Export Job",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('Status is 202', () => pm.response.to.have.status(202));",
              "pm.test('Job ID returned', () => {",
              "  const json = pm.response.json();",
              "  pm.expect(json.jobId).to.exist;",
              "  pm.collectionVariables.set('jobId', json.jobId);",
              "});"
            ]
          }
        }
      ],
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/admin/reconciliation/report/export",
        "header": [
          { "key": "Authorization", "value": "Bearer {{adminJwt}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{ \"format\": \"csv\", \"filter\": {} }"
        }
      }
    },
    {
      "name": "Wait for Job Completion",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('Job is done', () => {",
              "  const json = pm.response.json();",
              "  pm.expect(json.status).to.equal('done');",
              "  pm.expect(json.result_url).to.exist;",
              "  pm.collectionVariables.set('resultUrl', json.result_url);",
              "});"
            ]
          }
        }
      ],
      "request": {
        "method": "GET",
        "url": "{{baseUrl}}/admin/reconciliation/report/export/{{jobId}}",
        "header": [
          { "key": "Authorization", "value": "Bearer {{adminJwt}}" }
        ]
      }
    },
    {
      "name": "Verify Artifact Download",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('Artifact downloadable', () => {",
              "  pm.response.to.have.status(200);",
              "  pm.response.to.have.header('Content-Type');",
              "});",
              "pm.test('Artifact has content', () => {",
              "  pm.expect(pm.response.body.length).to.be.greaterThan(0);",
              "});"
            ]
          }
        }
      ],
      "request": {
        "method": "GET",
        "url": "{{resultUrl}}"
      }
    }
  ]
}
```

### Acceptance Criteria

- [ ] UI shows score badge with tooltip for reasons
- [ ] Export button triggers job with format selection
- [ ] Newman E2E passes in staging
- [ ] Job status polling shows progress
- [ ] Download link works after completion

### Definition of Done

- [ ] UI components reviewed by Design
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] E2E tests running in CI pipeline
- [ ] QA sign-off complete
- [ ] Release notes updated

---

## Sprint Timeline

```
Week 1 (Sprint 0-1):
├── Day 1-3: Sprint 0 - Design & Data Prep
│   ├── PAY-RECON-MVP-1: Design Score Spec (3 SP)
│   └── Prepare test datasets
├── Day 4-5: Sprint 1 Start - Backend MVP
│   ├── PAY-RECON-MVP-2: Backend Score Implementation (5 SP)
│   └── DB migrations and API work

Week 2 (Sprint 1-2):
├── Day 6-8: Sprint 1 End - Backend Complete
│   └── Score calculation and testing
├── Day 9-10: Sprint 2 Start - Export Implementation
│   └── PAY-RECON-MVP-3: Export with Signed URLs (8 SP)

Week 3 (Sprint 2):
├── Day 11-13: Export Testing & Load Tests
│   └── Performance validation
├── Day 14-15: Sprint 2 End - UI & E2E
│   └── PAY-RECON-MVP-4: UI and E2E (5 SP)
```

**Total Story Points: 21**
