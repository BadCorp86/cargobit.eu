# SOC 2 Evidence Checklist

**CargoBit Transport Platform**  
**SOC 2 Type II Audit Evidence Requirements**  
**Version:** 1.0  
**Classification:** Internal – Compliance Team  
**Last Updated:** 2025-01-15

---

## 1. Executive Summary

This document provides a comprehensive checklist of evidence required for SOC 2 Type II certification across all five Trust Service Criteria: Security, Availability, Processing Integrity, Confidentiality, and Privacy. It serves as the primary reference for evidence collection, organization, and audit preparation.

### Trust Service Criteria Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SOC 2 TRUST SERVICE CRITERIA                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     SECURITY (CC6)                          │   │
│  │                    [MANDATORY]                               │   │
│  │  • Access Control                                           │   │
│  │  • Authentication                                           │   │
│  │  • Network Security                                         │   │
│  │  • Vulnerability Management                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                │
│         │                    │                    │                │
│         ▼                    ▼                    ▼                │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐       │
│  │ AVAILABILITY│      │  PROCESSING │      │CONFIDENTIAL │       │
│  │    (A1)     │      │ INTEGRITY   │      │    (C1)     │       │
│  │             │      │    (PI1)    │      │             │       │
│  │ • Uptime    │      │ • Validation│      │ • Encryption│       │
│  │ • DR/BC     │      │ • Accuracy  │      │ • Access    │       │
│  │ • Capacity  │      │ • Timeliness│      │ • Retention │       │
│  └─────────────┘      └─────────────┘      └─────────────┘       │
│                              │                                      │
│                              ▼                                      │
│                    ┌─────────────┐                                 │
│                    │   PRIVACY   │                                 │
│                    │    (P1)     │                                 │
│                    │             │                                 │
│                    │ • Collection│                                 │
│                    │ • Use       │                                 │
│                    │ • Retention │                                 │
│                    │ • Disposal  │                                 │
│                    └─────────────┘                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Evidence Collection Schedule

| Frequency | Evidence Types | Collection Method |
|-----------|----------------|-------------------|
| Continuous | Logs, alerts, access records | Automated export |
| Daily | Log integrity, system status | Automated verification |
| Weekly | Vulnerability scans, security metrics | Automated export |
| Monthly | Access reviews, backup tests | Semi-automated |
| Quarterly | Penetration tests, access attestation | Manual collection |
| Annual | Policy reviews, risk assessments | Manual collection |

---

## 2. Security Evidence (CC6 - Mandatory)

### 2.1 Access Control Logs

| Evidence ID | Description | Format | Retention | Collection |
|-------------|-------------|--------|-----------|------------|
| SEC-AC-001 | User login attempts (success/failure) | JSON logs | 7 years | Automated |
| SEC-AC-002 | User logout events | JSON logs | 7 years | Automated |
| SEC-AC-003 | Session creation/termination | JSON logs | 7 years | Automated |
| SEC-AC-004 | Privileged access events | JSON logs | 7 years | Automated |
| SEC-AC-005 | Service account access | JSON logs | 7 years | Automated |
| SEC-AC-006 | API access logs | JSON logs | 7 years | Automated |
| SEC-AC-007 | Admin console access | JSON logs | 7 years | Automated |

**Sample Log Entry:**

```json
{
  "event_id": "evt-abc123",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "event_type": "LOGIN_SUCCESS",
  "service": "api-gateway",
  "actor": {
    "type": "USER",
    "id": "user-456",
    "email": "user@company.com",
    "roles": ["shipper"],
    "tenant_id": "tenant-789"
  },
  "context": {
    "source_ip": "192.168.1.100",
    "user_agent": "CargoBit-Web/2.1.0",
    "mfa_method": "totp",
    "session_id": "sess-xyz123"
  },
  "outcome": "SUCCESS",
  "correlation_id": "corr-def456"
}
```

**Audit Questions:**
- [ ] How are access control events logged?
- [ ] What authentication events are captured?
- [ ] How are privileged actions tracked?
- [ ] What is the log retention period?

### 2.2 RBAC/ABAC Configuration

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| SEC-RBAC-001 | Role definitions | YAML/JSON config | Per change |
| SEC-RBAC-002 | Permission matrices | Spreadsheet/Document | Quarterly |
| SEC-RBAC-003 | Role assignment records | Database export | Monthly |
| SEC-RBAC-004 | ABAC policy definitions | Policy files | Per change |
| SEC-RBAC-005 | Access request/approval records | Ticket system export | Monthly |

**Role Definition Example:**

```yaml
# Role Definition: Security Admin
role:
  name: security_admin
  description: "Security administration role"
  permissions:
    - security_config:read
    - security_config:write
    - audit_log:read
    - alert:acknowledge
    - incident:create
    - incident:update
  constraints:
    - requires_mfa: true
    - requires_approval: false
    - session_timeout: 30m
    - ip_restriction: internal_only
```

**Audit Questions:**
- [ ] How are roles defined and maintained?
- [ ] How are permissions assigned?
- [ ] How is separation of duties enforced?
- [ ] How are role changes tracked?

### 2.3 mTLS Certificates

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| SEC-TLS-001 | Certificate inventory | Spreadsheet | Monthly |
| SEC-TLS-002 | Certificate rotation logs | JSON logs | Per rotation |
| SEC-TLS-003 | TLS configuration scan results | PDF/JSON | Monthly |
| SEC-TLS-004 | Certificate authority configuration | Config files | Per change |
| SEC-TLS-005 | Service mesh mTLS status | Dashboard export | Weekly |

**Certificate Inventory Example:**

```yaml
certificate_inventory:
  - name: api-gateway-cert
    type: server
    issuer: internal-ca
    valid_from: 2025-01-01
    valid_until: 2025-04-01
    algorithm: ECDSA-P384
    status: valid
    auto_rotate: true
    
  - name: pricing-service-client
    type: client
    issuer: internal-ca
    valid_from: 2025-01-01
    valid_until: 2025-04-01
    algorithm: ECDSA-P384
    status: valid
    auto_rotate: true
```

**Audit Questions:**
- [ ] How are certificates managed?
- [ ] What is the certificate rotation process?
- [ ] How is mTLS enforced?
- [ ] How are certificate expirations prevented?

### 2.4 NetworkPolicies

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| SEC-NP-001 | NetworkPolicy definitions | YAML files | Per change |
| SEC-NP-002 | NetworkPolicy audit logs | JSON logs | Continuous |
| SEC-NP-003 | Network segmentation diagram | Diagram (PNG/PDF) | Quarterly |
| SEC-NP-004 | Firewall rule inventory | Spreadsheet | Monthly |
| SEC-NP-005 | Network traffic analysis | Reports | Monthly |

**NetworkPolicy Example:**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: pricing-service-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: pricing-service
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api-gateway
      ports:
        - protocol: TCP
          port: 8080
```

**Audit Questions:**
- [ ] How is network segmentation enforced?
- [ ] What traffic is allowed between services?
- [ ] How are NetworkPolicy changes controlled?
- [ ] How is network traffic monitored?

### 2.5 WAF/Gateway Rules

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| SEC-WAF-001 | WAF rule configuration | Config files | Per change |
| SEC-WAF-002 | WAF block logs | JSON logs | Continuous |
| SEC-WAF-003 | Rate limit configuration | YAML config | Per change |
| SEC-WAF-004 | API Gateway routing rules | Config files | Per change |
| SEC-WAF-005 | Input validation rules | Schema files | Per change |

**WAF Configuration Example:**

```yaml
waf_rules:
  - id: "OWASP-CRS-941100"
    name: "XSS Attack Detection"
    action: block
    severity: critical
    enabled: true
    
  - id: "OWASP-CRS-942100"
    name: "SQL Injection Detection"
    action: block
    severity: critical
    enabled: true
    
  - id: "CUSTOM-RATE-001"
    name: "API Rate Limiting"
    action: throttle
    threshold: 100
    window: 60s
    enabled: true
```

**Audit Questions:**
- [ ] What WAF rules are in place?
- [ ] How are malicious requests handled?
- [ ] How are rate limits configured?
- [ ] How are WAF rules updated?

### 2.6 Vulnerability Scan Reports

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| SEC-VUL-001 | Infrastructure vulnerability scans | PDF/JSON | Weekly |
| SEC-VUL-002 | Container vulnerability scans | JSON reports | Per build |
| SEC-VUL-003 | Web application scans | PDF/JSON | Monthly |
| SEC-VUL-004 | Dependency vulnerability scans | JSON reports | Per commit |
| SEC-VUL-005 | Remediation tracking | Spreadsheet | Continuous |
| SEC-VUL-006 | Exception documentation | Documents | As needed |

**Vulnerability Report Summary:**

```yaml
scan_summary:
  scan_id: scan-20250115
  scan_date: 2025-01-15
  scanner: Qualys
  scope: production
  
  findings:
    critical: 0
    high: 2
    medium: 8
    low: 15
    
  remediation_status:
    critical:
      sla_met: 0/0
      overdue: 0
    high:
      sla_met: 2/2
      overdue: 0
    medium:
      sla_met: 6/8
      overdue: 0
      
  top_findings:
    - id: VUL-001
      severity: high
      description: "Outdated TLS configuration on legacy endpoint"
      status: remediated
      remediation_date: 2025-01-12
```

**Audit Questions:**
- [ ] How often are vulnerability scans performed?
- [ ] What is the remediation SLA?
- [ ] How are vulnerabilities tracked?
- [ ] How are exceptions documented?

### 2.7 Penetration Test Report

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| SEC-PT-001 | Penetration test report | PDF | Annual |
| SEC-PT-002 | Scope document | Document | Annual |
| SEC-PT-003 | Findings remediation | Spreadsheet | Per finding |
| SEC-PT-004 | Retest results | PDF | Post-remediation |
| SEC-PT-005 | Vendor qualifications | Certificate | Initial |

**Penetration Test Summary:**

```yaml
pentest_summary:
  test_id: PT-2025-001
  vendor: NCC Group
  dates: 2025-03-01 to 2025-03-14
  scope:
    - API Gateway
    - Domain Services
    - Core Services
    - Infrastructure
    
  findings:
    critical: 0
    high: 1
    medium: 4
    low: 8
    informational: 12
    
  remediation_status:
    critical: 0/0 complete
    high: 1/1 complete
    medium: 3/4 complete (1 in progress)
    
  key_findings:
    - id: PT-001
      severity: high
      title: "IDOR vulnerability in order API"
      status: remediated
      retest_date: 2025-04-15
```

**Audit Questions:**
- [ ] When was the last penetration test?
- [ ] What was the scope?
- [ ] What findings were identified?
- [ ] What is the remediation status?

### 2.8 Incident Logs

| Evidence ID | Description | Format | Retention |
|-------------|-------------|--------|-----------|
| SEC-INC-001 | Incident tickets | Ticket export | 7 years |
| SEC-INC-002 | Incident timeline | Documents | 7 years |
| SEC-INC-003 | Post-incident reports | Documents | 7 years |
| SEC-INC-004 | Lessons learned | Documents | 7 years |
| SEC-INC-005 | Incident metrics | Dashboard export | 7 years |

**Incident Summary:**

```yaml
incident_summary:
  period: 2025-Q1
  total_incidents: 12
  
  by_severity:
    sev1: 0
    sev2: 2
    sev3: 5
    sev4: 5
    
  by_category:
    unauthorized_access: 2
    data_exposure: 0
    malware: 0
    denial_of_service: 1
    policy_violation: 5
    other: 4
    
  metrics:
    mttd: 8 minutes
    mttr: 45 minutes
    detection_rate: 100%
    
  trends:
    - "Decrease in unauthorized access attempts"
    - "Improved detection time vs previous quarter"
```

**Audit Questions:**
- [ ] How are incidents tracked?
- [ ] What is the incident classification?
- [ ] What is the response SLA?
- [ ] How are lessons learned documented?

### 2.9 Audit Logs (WORM)

| Evidence ID | Description | Format | Retention |
|-------------|-------------|--------|-----------|
| SEC-AUD-001 | User activity audit logs | JSON (WORM) | 7 years |
| SEC-AUD-002 | Configuration change audit | JSON (WORM) | 7 years |
| SEC-AUD-003 | Data access audit logs | JSON (WORM) | 7 years |
| SEC-AUD-004 | System event audit logs | JSON (WORM) | 7 years |
| SEC-AUD-005 | Log integrity verification | Reports | Monthly |

**Audit Log Verification:**

```yaml
log_integrity_check:
  date: 2025-01-15
  scope: all_audit_logs
  
  verification:
    method: merkle_tree
    chain_valid: true
    missing_blocks: 0
    tampered_blocks: 0
    
  storage:
    type: S3 Object Lock (COMPLIANCE mode)
    encryption: AES-256
    replication: enabled
    
  retention:
    policy: 7 years
    enforcement: WORM
    earliest_deletion: 2032-01-15
```

**Audit Questions:**
- [ ] How are audit logs protected?
- [ ] What is the WORM implementation?
- [ ] How is log integrity verified?
- [ ] What is the retention policy?

---

## 3. Availability Evidence (A1)

### 3.1 Uptime Reports

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| AVA-UP-001 | System availability metrics | Dashboard export | Monthly |
| AVA-UP-002 | SLA compliance reports | PDF | Monthly |
| AVA-UP-003 | Incident impact analysis | Documents | Per incident |
| AVA-UP-004 | Availability trend analysis | Reports | Quarterly |

**Uptime Report Example:**

```yaml
availability_report:
  period: 2025-01
  target_sla: 99.9%
  achieved_sla: 99.95%
  
  components:
    api-gateway:
      availability: 99.98%
      downtime_minutes: 8
    pricing-service:
      availability: 99.99%
      downtime_minutes: 4
    matching-service:
      availability: 99.97%
      downtime_minutes: 13
    execution-service:
      availability: 99.96%
      downtime_minutes: 17
      
  incidents:
    total: 3
    affecting_availability: 1
    
  sla_status:
    met: true
    credits_issued: $0
```

**Audit Questions:**
- [ ] What is the availability target?
- [ ] How is availability measured?
- [ ] What SLAs are committed?
- [ ] How are SLA breaches handled?

### 3.2 HPA Configuration

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| AVA-HPA-001 | HPA policy definitions | YAML configs | Per change |
| AVA-HPA-002 | Scaling event logs | JSON logs | Continuous |
| AVA-HPA-003 | Capacity planning reports | Documents | Quarterly |
| AVA-HPA-004 | Resource utilization metrics | Dashboard export | Weekly |

**HPA Configuration Example:**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: pricing-service-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pricing-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

**Audit Questions:**
- [ ] How is auto-scaling configured?
- [ ] What triggers scaling?
- [ ] What are the scaling limits?
- [ ] How is capacity monitored?

### 3.3 PDB Configuration

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| AVA-PDB-001 | PDB definitions | YAML configs | Per change |
| AVA-PDB-002 | Node maintenance records | Ticket exports | Per maintenance |
| AVA-PDB-003 | Pod disruption logs | JSON logs | Continuous |
| AVA-PDB-004 | Availability impact analysis | Documents | Per maintenance |

**PDB Configuration Example:**

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: pricing-service-pdb
  namespace: production
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: pricing-service
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-gateway-pdb
  namespace: production
spec:
  minAvailable: 50%
  selector:
    matchLabels:
      app: api-gateway
```

**Audit Questions:**
- [ ] How is minimum availability enforced?
- [ ] What happens during node maintenance?
- [ ] How are PDBs monitored?
- [ ] What is the impact of pod disruptions?

### 3.4 Disaster Recovery Plan

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| AVA-DR-001 | Disaster Recovery Plan | Document | Annual |
| AVA-DR-002 | DR test results | PDF | Annual |
| AVA-DR-003 | Failover procedures | Runbooks | Annual |
| AVA-DR-004 | Recovery time objectives | Document | Annual |
| AVA-DR-005 | Communication plan | Document | Annual |

**DR Plan Summary:**

```yaml
disaster_recovery:
  rto: 4 hours
  rpo: 1 hour
  
  scenarios:
    - name: "Single zone failure"
      response: "Automatic failover to other zones"
      expected_rto: "< 5 minutes"
      
    - name: "Region failure"
      response: "Failover to DR region"
      expected_rto: "< 4 hours"
      
    - name: "Complete service outage"
      response: "Full restore from backup"
      expected_rto: "< 8 hours"
      
  testing:
    frequency: annual
    last_test: 2024-09-15
    next_test: 2025-09-15
    test_type: full_failover
    
  responsibilities:
    incident_commander: Platform Lead
    technical_lead: DevOps Lead
    communications: Comms Team
```

**Audit Questions:**
- [ ] What are the RTO/RPO targets?
- [ ] How is DR tested?
- [ ] What scenarios are covered?
- [ ] Who is responsible for DR?

### 3.5 Backup Logs

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| AVA-BK-001 | Backup completion logs | JSON logs | Daily |
| AVA-BK-002 | Backup verification logs | JSON logs | Daily |
| AVA-BK-003 | Backup failure alerts | Alert records | As needed |
| AVA-BK-004 | Storage utilization | Reports | Weekly |
| AVA-BK-005 | Retention compliance | Reports | Monthly |

**Backup Report Example:**

```yaml
backup_report:
  date: 2025-01-15
  type: daily_incremental
  
  databases:
    - name: pricing-db
      status: success
      size_gb: 45
      duration_min: 12
      location: s3://backups/pricing-db/2025/01/15/
      
    - name: order-db
      status: success
      size_gb: 120
      duration_min: 28
      location: s3://backups/order-db/2025/01/15/
      
  verification:
    integrity_check: passed
    restore_test: passed (sample)
    
  retention:
    daily: 30 days (30/30)
    weekly: 12 weeks (12/12)
    monthly: 12 months (12/12)
```

**Audit Questions:**
- [ ] What is the backup schedule?
- [ ] How are backups verified?
- [ ] What is the retention policy?
- [ ] Where are backups stored?

### 3.6 Restore Test Results

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| AVA-RS-001 | Weekly restore tests | Test reports | Weekly |
| AVA-RS-002 | Monthly full restore | Test reports | Monthly |
| AVA-RS-003 | Annual DR test | Test reports | Annual |
| AVA-RS-004 | Restore timing analysis | Reports | Per test |
| AVA-RS-005 | Issue tracking | Ticket exports | Continuous |

**Restore Test Report:**

```yaml
restore_test:
  test_id: RT-20250115
  test_date: 2025-01-15
  test_type: monthly_full_restore
  
  scope:
    - pricing-db
    - matching-db
    
  execution:
    start_time: 2025-01-15T02:00:00Z
    end_time: 2025-01-15T02:45:00Z
    duration_min: 45
    
  results:
    pricing-db:
      restore_time_min: 18
      verification: passed
      data_integrity: confirmed
      
    matching-db:
      restore_time_min: 27
      verification: passed
      data_integrity: confirmed
      
  conclusions:
    rto_met: true
    rpo_met: true
    issues_found: 0
    
  next_test: 2025-02-15
```

**Audit Questions:**
- [ ] How often are restores tested?
- [ ] What is the restore procedure?
- [ ] What are the test results?
- [ ] How are issues tracked?

### 3.7 Monitoring Dashboards

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| AVA-MON-001 | System health dashboard | Screenshots | Monthly |
| AVA-MON-002 | Capacity dashboard | Screenshots | Monthly |
| AVA-MON-003 | SLA dashboard | Screenshots | Monthly |
| AVA-MON-004 | Incident dashboard | Screenshots | Weekly |

**Dashboard Metrics:**

```yaml
monitoring_dashboards:
  system_health:
    metrics:
      - cpu_utilization
      - memory_utilization
      - disk_io
      - network_throughput
      - request_latency_p99
      - error_rate
      
  capacity:
    metrics:
      - pod_count
      - node_count
      - storage_used
      - database_connections
      
  sla:
    metrics:
      - availability_percentage
      - response_time_p95
      - error_budget_remaining
```

**Audit Questions:**
- [ ] What metrics are monitored?
- [ ] How are dashboards configured?
- [ ] Who has access to dashboards?
- [ ] How are trends analyzed?

### 3.8 Alerting Rules

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| AVA-ALT-001 | Availability alerts | YAML configs | Per change |
| AVA-ALT-002 | Alert response records | Ticket exports | Per alert |
| AVA-ALT-003 | Alert tuning history | Documents | Per change |
| AVA-ALT-004 | Alert fatigue metrics | Reports | Monthly |

**Alert Configuration Example:**

```yaml
alerting_rules:
  - name: HighErrorRate
    expr: |
      sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
      / sum(rate(http_requests_total[5m])) by (service) > 0.01
    severity: critical
    response_time: 15m
    
  - name: ServiceDown
    expr: up == 0
    severity: critical
    response_time: 5m
    
  - name: HighLatency
    expr: |
      histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
    severity: high
    response_time: 30m
```

**Audit Questions:**
- [ ] What availability alerts exist?
- [ ] What are the response SLAs?
- [ ] How are alerts escalated?
- [ ] How is alert fatigue managed?

---

## 4. Processing Integrity Evidence (PI1)

### 4.1 Fraud Score Validation Logs

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| PI-FRD-001 | Fraud score calculation logs | JSON logs | Continuous |
| PI-FRD-002 | Fraud threshold configuration | YAML config | Per change |
| PI-FRD-003 | Fraud alert records | Ticket exports | Per alert |
| PI-FRD-004 | Fraud model version tracking | Documents | Per update |
| PI-FRD-005 | False positive/negative analysis | Reports | Monthly |

**Fraud Score Log Example:**

```json
{
  "event_id": "fraud-evt-123",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "pricing-service",
  "event_type": "FRAUD_SCORE_CALCULATED",
  "order_id": "order-456",
  "fraud_score": {
    "total_score": 0.25,
    "model_version": "v2.3.1",
    "components": {
      "velocity_check": 0.05,
      "geographic_check": 0.10,
      "payment_check": 0.05,
      "account_check": 0.05
    }
  },
  "threshold": {
    "block": 0.80,
    "review": 0.50
  },
  "action": "approved",
  "validation_passed": true
}
```

**Audit Questions:**
- [ ] How are fraud scores calculated?
- [ ] What thresholds are configured?
- [ ] How is model accuracy tracked?
- [ ] How are false positives handled?

### 4.2 Matching Audit Logs

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| PI-MCH-001 | Match calculation logs | JSON logs | Continuous |
| PI-MCH-002 | Match scoring details | JSON logs | Per match |
| PI-MCH-003 | Carrier selection rationale | JSON logs | Per match |
| PI-MCH-004 | Match quality metrics | Reports | Weekly |
| PI-MCH-005 | Manual override records | Ticket exports | Per override |

**Matching Audit Log:**

```json
{
  "event_id": "match-evt-789",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "matching-service",
  "event_type": "MATCH_CREATED",
  "match_id": "match-012",
  "order_id": "order-456",
  "carrier_id": "carrier-789",
  "scoring": {
    "total_score": 0.92,
    "components": {
      "proximity_score": 0.95,
      "availability_score": 1.00,
      "preference_score": 0.85,
      "price_score": 0.90
    },
    "algorithm_version": "v1.5.0"
  },
  "candidates_evaluated": 5,
  "selection_rationale": "Highest combined score with availability",
  "validation_passed": true
}
```

**Audit Questions:**
- [ ] How are matches calculated?
- [ ] What factors influence matching?
- [ ] How is match quality measured?
- [ ] How are manual overrides tracked?

### 4.3 Pricing Audit Logs

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| PI-PRC-001 | Price calculation logs | JSON logs | Continuous |
| PI-PRC-002 | Pricing rule configuration | YAML config | Per change |
| PI-PRC-003 | Discount application logs | JSON logs | Per discount |
| PI-PRC-004 | Pricing discrepancy reports | Reports | Weekly |
| PI-PRC-005 | Price validation tests | Test reports | Per release |

**Pricing Audit Log:**

```json
{
  "event_id": "price-evt-456",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "pricing-service",
  "event_type": "PRICE_CALCULATED",
  "quote_id": "quote-789",
  "order_id": "order-456",
  "pricing": {
    "base_price": 1500.00,
    "distance_km": 450,
    "weight_kg": 2500,
    "modifications": [
      {"type": "distance_surcharge", "amount": 75.00},
      {"type": "fuel_surcharge", "amount": 45.00},
      {"type": "discount", "amount": -120.00, "code": "LOYAL10"}
    ],
    "final_price": 1500.00,
    "currency": "EUR"
  },
  "algorithm_version": "v2.1.0",
  "validation_passed": true
}
```

**Audit Questions:**
- [ ] How are prices calculated?
- [ ] What pricing rules apply?
- [ ] How are discounts validated?
- [ ] How is pricing accuracy verified?

### 4.4 Configuration Versioning

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| PI-CFG-001 | Config version history | Git history | Per change |
| PI-CFG-002 | Config diff records | Documents | Per change |
| PI-CFG-003 | Config approval records | Ticket exports | Per change |
| PI-CFG-004 | Config rollback records | Documents | Per rollback |
| PI-CFG-005 | Config audit trail | JSON logs | Continuous |

**Config Version History:**

```yaml
config_history:
  config_type: rate_limits
  current_version: v1.2.3
  
  history:
    - version: v1.2.3
      date: 2025-01-15
      author: security-team
      approver: ciso
      changes:
        - "Increased rate limit for /api/v1/orders to 150/min"
      approved_by: "CISO"
      
    - version: v1.2.2
      date: 2025-01-10
      author: platform-team
      approver: security-team
      changes:
        - "Added rate limit for /api/v1/matching endpoint"
```

**Audit Questions:**
- [ ] How are configs versioned?
- [ ] What is the approval process?
- [ ] How are changes tracked?
- [ ] How is rollback handled?

### 4.5 CI/CD Pipeline Logs

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| PI-CI-001 | Pipeline execution logs | JSON logs | Per pipeline |
| PI-CI-002 | Build artifacts | Artifact registry | Per build |
| PI-CI-003 | Test results | JSON/XML reports | Per build |
| PI-CI-004 | Deployment records | JSON logs | Per deployment |
| PI-CI-005 | Pipeline configuration | YAML configs | Per change |

**Pipeline Execution Record:**

```yaml
pipeline_execution:
  pipeline_id: pipe-20250115-001
  date: 2025-01-15
  trigger: merge_request
  
  stages:
    - name: build
      status: success
      duration_sec: 180
      
    - name: test
      status: success
      duration_sec: 300
      coverage: 87%
      
    - name: security_scan
      status: success
      findings:
        critical: 0
        high: 0
        medium: 0
        
    - name: deploy_staging
      status: success
      duration_sec: 120
      
    - name: integration_test
      status: success
      duration_sec: 600
      
    - name: deploy_production
      status: success
      duration_sec: 90
```

**Audit Questions:**
- [ ] What pipeline stages exist?
- [ ] How are changes tested?
- [ ] What security checks run?
- [ ] How are deployments tracked?

### 4.6 Test Coverage Reports

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| PI-TC-001 | Unit test coverage | Reports | Per build |
| PI-TC-002 | Integration test coverage | Reports | Per build |
| PI-TC-003 | E2E test results | Reports | Per release |
| PI-TC-004 | Test trend analysis | Reports | Monthly |
| PI-TC-005 | Test gap analysis | Documents | Quarterly |

**Test Coverage Report:**

```yaml
test_coverage:
  date: 2025-01-15
  commit: abc123def
  
  unit_tests:
    coverage: 87%
    total_tests: 1250
    passed: 1248
    failed: 0
    skipped: 2
    
  integration_tests:
    coverage: 75%
    total_tests: 340
    passed: 340
    failed: 0
    
  e2e_tests:
    total_scenarios: 85
    passed: 85
    failed: 0
    
  coverage_by_service:
    pricing-service: 91%
    matching-service: 88%
    execution-service: 85%
    order-service: 84%
```

**Audit Questions:**
- [ ] What test coverage is required?
- [ ] How is coverage measured?
- [ ] What types of tests run?
- [ ] How are test gaps addressed?

---

## 5. Confidentiality Evidence (C1)

### 5.1 Encryption-at-Rest Configuration

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| CF-ENC-001 | Database encryption config | Config files | Per change |
| CF-ENC-002 | Storage encryption config | Config files | Per change |
| CF-ENC-003 | Encryption key inventory | Spreadsheet | Monthly |
| CF-ENC-004 | Encryption algorithm documentation | Documents | Annual |
| CF-ENC-005 | Encryption audit results | Reports | Quarterly |

**Encryption Configuration:**

```yaml
encryption_at_rest:
  databases:
    - name: pricing-db
      type: PostgreSQL
      encryption: AES-256
      key_management: AWS KMS
      key_rotation: annual
      
    - name: order-db
      type: PostgreSQL
      encryption: AES-256
      key_management: AWS KMS
      key_rotation: annual
      
  object_storage:
    - name: audit-logs
      encryption: AES-256
      key_management: S3 SSE-KMS
      bucket_key: enabled
      
  volumes:
    encryption: AES-256
    key_management: AWS KMS
    all_volumes_encrypted: true
```

**Audit Questions:**
- [ ] What data is encrypted at rest?
- [ ] What encryption algorithms are used?
- [ ] How are keys managed?
- [ ] How is encryption verified?

### 5.2 Key Management Procedures

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| CF-KM-001 | Key management policy | Document | Annual |
| CF-KM-002 | Key generation procedures | Procedure doc | Annual |
| CF-KM-003 | Key rotation records | JSON logs | Per rotation |
| CF-KM-004 | Key access audit | JSON logs | Continuous |
| CF-KM-005 | Key destruction records | Documents | Per destruction |

**Key Inventory:**

```yaml
key_inventory:
  date: 2025-01-15
  
  keys:
    - id: key-001
      type: AES-256
      purpose: database_encryption
      location: AWS KMS
      created: 2024-01-15
      rotation: annual
      next_rotation: 2025-01-15
      
    - id: key-002
      type: RSA-4096
      purpose: jwt_signing
      location: HashiCorp Vault
      created: 2024-06-01
      rotation: quarterly
      next_rotation: 2025-03-01
      
  vault_status:
    cluster_health: healthy
    seal_status: unsealed
    replication: enabled
```

**Audit Questions:**
- [ ] How are keys generated?
- [ ] Where are keys stored?
- [ ] How often are keys rotated?
- [ ] How is key access controlled?

### 5.3 Secrets Management (Vault/KMS)

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| CF-SEC-001 | Vault architecture diagram | Diagram | Annual |
| CF-SEC-002 | Vault audit logs | JSON logs | Continuous |
| CF-SEC-003 | Secret access patterns | Reports | Monthly |
| CF-SEC-004 | Vault health status | Dashboard export | Weekly |
| CF-SEC-005 | Secret rotation logs | JSON logs | Per rotation |

**Vault Configuration:**

```yaml
vault_configuration:
  cluster:
    nodes: 5
    storage: consul
    ha_mode: true
    
  engines:
    - name: kv
      type: kv-v2
      description: "Application secrets"
      
    - name: database
      type: database
      description: "Dynamic database credentials"
      
    - name: pki
      type: pki
      description: "Certificate authority"
      
  audit:
    - type: file
      path: /vault/audit/audit.log
      
    - type: syslog
      facility: LOCAL0
      
  policies:
    - name: pricing-service
      paths:
        - "kv/data/pricing/*"
        - "database/creds/pricing-db"
```

**Audit Questions:**
- [ ] How is Vault configured?
- [ ] How are secrets accessed?
- [ ] What audit logging exists?
- [ ] How is Vault monitored?

### 5.4 Data Retention Policies

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| CF-RET-001 | Data retention policy | Document | Annual |
| CF-RET-002 | Retention schedule | Spreadsheet | Annual |
| CF-RET-003 | Deletion verification logs | JSON logs | Per deletion |
| CF-RET-004 | Retention compliance reports | Reports | Quarterly |
| CF-RET-005 | Legal hold records | Documents | As needed |

**Retention Schedule:**

```yaml
retention_schedule:
  data_categories:
    - category: audit_logs
      retention: 7 years
      justification: "Regulatory requirement"
      deletion_method: automatic
      
    - category: application_logs
      retention: 90 days
      justification: "Operational needs"
      deletion_method: automatic
      
    - category: user_data
      retention: "Account lifetime + 30 days"
      justification: "Business need, privacy"
      deletion_method: user_request
      
    - category: financial_records
      retention: 7 years
      justification: "Tax requirements"
      deletion_method: manual
      
  enforcement:
    automated: true
    verification: monthly
    exceptions: documented
```

**Audit Questions:**
- [ ] What retention periods apply?
- [ ] How is retention enforced?
- [ ] How is deletion verified?
- [ ] How are exceptions handled?

### 5.5 Access Reviews

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| CF-AR-001 | Access review reports | Documents | Quarterly |
| CF-AR-002 | Manager attestations | Signed forms | Quarterly |
| CF-AR-003 | Remediation records | Ticket exports | Per remediation |
| CF-AR-004 | Exception documentation | Documents | As needed |
| CF-AR-005 | Access matrix | Spreadsheet | Quarterly |

**Access Review Summary:**

```yaml
access_review:
  quarter: 2025-Q1
  date: 2025-03-31
  
  scope:
    - all_user_accounts
    -all_service_accounts
    - privileged_access
    
  results:
    total_accounts: 450
    accounts_reviewed: 450
    completion_rate: 100%
    
    actions:
      retain: 420
      modify: 15
      revoke: 15
      
  exceptions:
    count: 3
    documented: true
    expiration: 2025-06-30
    
  attestation:
    managers_responded: 25/25
    completion_date: 2025-03-25
```

**Audit Questions:**
- [ ] How often are access reviews performed?
- [ ] Who performs the reviews?
- [ ] What is the scope?
- [ ] How are exceptions handled?

---

## 6. Privacy Evidence (P1)

### 6.1 PII Inventory

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| PRV-PII-001 | PII inventory document | Spreadsheet | Quarterly |
| PRV-PII-002 | Data flow mapping | Diagram | Annual |
| PRV-PII-003 | PII classification | Documents | Per change |
| PRV-PII-004 | Third-party PII sharing | Documents | Per agreement |
| PRV-PII-005 | PII storage locations | Spreadsheet | Quarterly |

**PII Inventory Example:**

```yaml
pii_inventory:
  update_date: 2025-01-15
  
  data_elements:
    - name: user_name
      category: direct_identifier
      sensitivity: medium
      storage:
        - service: auth-service
          database: user_db
          encrypted: true
        - service: order-service
          database: order_db
          encrypted: true
          
    - name: email_address
      category: direct_identifier
      sensitivity: high
      storage:
        - service: auth-service
          database: user_db
          encrypted: true
        - service: notification-service
          retention: 90 days
          
    - name: phone_number
      category: direct_identifier
      sensitivity: high
      storage:
        - service: auth-service
          database: user_db
          encrypted: true
          
    - name: location_data
      category: behavioral
      sensitivity: high
      storage:
        - service: execution-service
          database: tracking_db
          retention: 30 days
          anonymization: after 7 days
```

**Audit Questions:**
- [ ] What PII is collected?
- [ ] Where is PII stored?
- [ ] How is PII classified?
- [ ] Who has access to PII?

### 6.2 Data Minimization Policy

| Evidence ID | Description | Format | Update Frequency |
|-------------|-------------|--------|------------------|
| PRV-DM-001 | Data minimization policy | Document | Annual |
| PRV-DM-002 | Data collection justification | Documents | Per data type |
| PRV-DM-003 | Unnecessary data deletion records | JSON logs | Per deletion |
| PRV-DM-004 | Data minimization audits | Reports | Quarterly |

**Data Minimization Principles:**

```yaml
data_minimization:
  principles:
    - "Collect only data necessary for stated purpose"
    - "Delete data when purpose is fulfilled"
    - "Limit access to minimum required"
    - "Anonymize where possible"
    
  implementation:
    collection_review:
      frequency: quarterly
      owner: privacy_team
      
    deletion_automation:
      enabled: true
      verification: true
      
    access_limitation:
      method: rbac
      review: quarterly
      
  audit:
    last_audit: 2025-01-01
    findings: 0
    next_audit: 2025-04-01
```

**Audit Questions:**
- [ ] How is data minimization enforced?
- [ ] What data is truly necessary?
- [ ] How is unnecessary data removed?
- [ ] How is minimization audited?

### 6.3 Consent Management

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| PRV-CM-001 | Consent policy | Document | Annual |
| PRV-CM-002 | Consent records | Database export | Continuous |
| PRV-CM-003 | Consent withdrawal logs | JSON logs | Per withdrawal |
| PRV-CM-004 | Consent banner configuration | Config files | Per change |
| PRV-CM-005 | Consent audit reports | Reports | Quarterly |

**Consent Record Structure:**

```json
{
  "consent_id": "consent-abc123",
  "user_id": "user-456",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "consent_type": "marketing",
  "consent_version": "v2.1",
  "consent_text_hash": "sha256:...",
  "user_action": "accepted",
  "collection_method": "web_banner",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "expiry": "2026-01-15T10:30:00.000Z",
  "withdrawn": false
}
```

**Audit Questions:**
- [ ] How is consent obtained?
- [ ] What consent types exist?
- [ ] How is consent recorded?
- [ ] How is consent withdrawn?

### 6.4 Privacy Impact Assessments

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| PRV-PIA-001 | PIA template | Document template | Annual update |
| PRV-PIA-002 | Completed PIAs | Documents | Per new processing |
| PRV-PIA-003 | PIA register | Spreadsheet | Continuous |
| PRV-PIA-004 | Risk mitigation records | Documents | Per PIA |
| PRV-PIA-005 | PIA review records | Meeting minutes | Annual |

**PIA Summary:**

```yaml
privacy_impact_assessment:
  pia_id: PIA-2025-001
  project: "Carrier Location Tracking Enhancement"
  date: 2025-01-10
  status: approved
  
  data_processing:
    purpose: "Real-time carrier tracking for customers"
    legal_basis: "Contract performance"
    data_types:
      - location_data
      - timestamp
      
  risks_identified:
    - risk: "Location data exposure"
      likelihood: medium
      impact: high
      mitigation: "Location anonymization after 7 days, encrypted storage"
      
    - risk: "Unauthorized access"
      likelihood: low
      impact: high
      mitigation: "RBAC, audit logging, MFA required"
      
  recommendation: "Proceed with enhanced controls"
  approved_by: "DPO"
  approval_date: "2025-01-15"
```

**Audit Questions:**
- [ ] When are PIAs required?
- [ ] What is the PIA process?
- [ ] How are risks mitigated?
- [ ] Who approves PIAs?

### 6.5 Data Deletion Logs

| Evidence ID | Description | Format | Frequency |
|-------------|-------------|--------|-----------|
| PRV-DL-001 | Data deletion request records | Ticket exports | Per request |
| PRV-DL-002 | Deletion completion logs | JSON logs | Per deletion |
| PRV-DL-003 | Deletion verification records | Documents | Per deletion |
| PRV-DL-004 | DSAR response tracking | Spreadsheet | Continuous |
| PRV-DL-005 | Retention expiry deletions | JSON logs | Automated |

**Data Deletion Record:**

```json
{
  "deletion_id": "del-xyz789",
  "request_id": "dsar-123",
  "user_id": "user-456",
  "request_date": "2025-01-10T00:00:00Z",
  "request_type": "account_deletion",
  
  "deletion_execution": {
    "start_date": "2025-01-15T10:00:00Z",
    "completion_date": "2025-01-15T10:30:00Z",
    "status": "completed"
  },
  
  "data_deleted": [
    {"system": "auth-service", "table": "users", "records": 1},
    {"system": "order-service", "table": "orders", "records": 15},
    {"system": "pricing-service", "table": "quotes", "records": 23}
  ],
  
  "backups": {
    "scheduled_deletion": "2025-02-15",
    "verified": true
  },
  
  "verification": {
    "method": "query_verification",
    "result": "no_records_found",
    "verified_by": "privacy-team"
  }
}
```

**Audit Questions:**
- [ ] How are deletion requests handled?
- [ ] What is the deletion SLA?
- [ ] How is deletion verified?
- [ ] How are backups handled?

---

## 7. Evidence Collection Automation

### 7.1 Automated Collection Schedule

| Evidence Category | Collection Frequency | Automation Level | Tool |
|-------------------|---------------------|------------------|------|
| Logs | Continuous | Fully automated | Fluentd → Loki |
| Metrics | Continuous | Fully automated | Prometheus |
| Access Reviews | Quarterly | Semi-automated | IAM → Report |
| Vulnerability Scans | Weekly | Fully automated | Qualys/Snyk |
| Backup Tests | Weekly | Fully automated | Scripts |
| Config Snapshots | Daily | Fully automated | Git sync |

### 7.2 Evidence Storage

| Evidence Type | Storage Location | Retention | Access |
|---------------|------------------|-----------|--------|
| Audit Logs | s3://audit-logs/ | 7 years | Security Team |
| Reports | /compliance/evidence/ | 7 years | Compliance Team |
| Configurations | Git repository | Permanent | DevOps Team |
| Screenshots | /compliance/screenshots/ | Audit period | Compliance Team |

### 7.3 Evidence Verification

```yaml
evidence_verification:
  integrity_checks:
    - name: log_chain_verification
      frequency: daily
      method: merkle_tree
      
    - name: backup_integrity
      frequency: weekly
      method: restore_test
      
    - name: config_drift_detection
      frequency: daily
      method: diff_comparison
      
  compliance_checks:
    - name: retention_compliance
      frequency: monthly
      automated: true
      
    - name: access_review_completeness
      frequency: quarterly
      automated: false
```

---

## 8. Audit Preparation Checklist

### 8.1 Pre-Audit Checklist

| Item | Owner | Due Date | Status |
|------|-------|----------|--------|
| All evidence collected | Compliance | -14 days | ☐ |
| Evidence organized by TSC | Compliance | -7 days | ☐ |
| Evidence access verified | IT | -7 days | ☐ |
| Staff briefed | CISO | -3 days | ☐ |
| Demo environment ready | IT | -3 days | ☐ |
| Auditor logistics confirmed | Compliance | -2 days | ☐ |

### 8.2 Evidence Checklist by TSC

| TSC | Evidence Count | Collected | Verified |
|-----|----------------|-----------|----------|
| Security (CC6) | 36 | ☐ | ☐ |
| Availability (A1) | 24 | ☐ | ☐ |
| Processing Integrity (PI1) | 18 | ☐ | ☐ |
| Confidentiality (C1) | 15 | ☐ | ☐ |
| Privacy (P1) | 15 | ☐ | ☐ |

---

## 9. Document Control

| Attribute | Value |
|-----------|-------|
| Owner | Compliance Team |
| Reviewers | CISO, Security Lead, Privacy Officer |
| Version | 1.0 |
| Last Updated | 2025-01-15 |
| Next Review | 2025-04-15 |
| Classification | Internal |

---

**Related Documents:**
- ISO 27001 Audit Preparation Kit
- Compliance Mapping
- Security Architecture Diagram
- Privacy Policy
- Data Classification Policy
