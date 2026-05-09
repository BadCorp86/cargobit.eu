# EB – Day-2 Monitoring Dashboard (Markdown)

> **Zweck**: Konsolen-freundliches Dashboard für schnellen Status-Check. Kann in Terminal, Wiki oder als README verwendet werden.

---

## 📊 Governance Postcheck – Monitoring Dashboard

### Letzte Aktualisierung: `YYYY-MM-DD HH:MM UTC`

---

## 🚦 System Health

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GOVERNANCE POSTCHECK STATUS                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Overall Status:  🟢 HEALTHY                                               │
│                                                                             │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│   │   Pipeline      │  │   Admission     │  │   Signing       │            │
│   │   🟢 OK         │  │   🟢 OK         │  │   🟢 OK         │            │
│   │   99.8% Success │  │   0 Denials     │  │   100% Valid    │            │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                             │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│   │   Trivy Scan    │  │   Canary        │  │   SLO Status    │            │
│   │   🟢 OK         │  │   🟢 OK         │  │   🟢 OK         │            │
│   │   0 CRITICAL    │  │   0% Active     │  │   99.95% Avail  │            │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📈 SLO Status

| SLO | Target | Current | Status | Trend |
|-----|--------|---------|--------|-------|
| Availability | ≥ 99.9% | 99.95% | 🟢 | ↗️ |
| Latency P95 | < 200ms | 145ms | 🟢 | → |
| Latency P99 | < 500ms | 320ms | 🟢 | ↘️ |
| Error Rate | < 0.1% | 0.05% | 🟢 | ↘️ |
| Deployment Success | ≥ 99% | 99.8% | 🟢 | ↗️ |
| Signature Verify | ≥ 99.5% | 100% | 🟢 | → |

---

## 🔐 Security Status

### Image Signatures

| Metric | Value | Status |
|--------|-------|--------|
| Total Images | 247 | - |
| Signed Images | 247 | ✅ 100% |
| Unsigned Images | 0 | ✅ |
| Verify Failures (24h) | 0 | ✅ |
| Rekor Entries | 1,234 | - |

### Vulnerability Scan

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | 🟢 |
| HIGH | 2 | 🟡 |
| MEDIUM | 15 | 🟢 |
| LOW | 47 | 🟢 |

**Action Required**: 2 HIGH vulnerabilities need review

---

## 🚀 Deployment Status

### Current Deployments

| Environment | Services | Status | Last Deploy |
|-------------|----------|--------|-------------|
| Production | 45 | 🟢 Running | 2h ago |
| Staging | 45 | 🟢 Running | 4h ago |
| Development | 32 | 🟢 Running | 1h ago |

### Canary Status

| Service | Canary % | Status | Duration |
|---------|----------|--------|----------|
| - | - | None Active | - |

### Recent Deployments (Last 24h)

| Time | Service | Version | Status |
|------|---------|---------|--------|
| 14:32 | api-gateway | v1.2.3 | ✅ Success |
| 12:15 | auth-service | v2.1.0 | ✅ Success |
| 08:45 | task-queue | v1.5.2 | ✅ Success |

---

## 🔄 CI/CD Pipeline Status

### Pipeline Health (Last 24h)

| Stage | Runs | Success | Failed | Rate |
|-------|------|---------|--------|------|
| Build | 156 | 155 | 1 | 99.4% |
| Test | 156 | 156 | 0 | 100% |
| Scan | 156 | 154 | 2 | 98.7% |
| Sign | 155 | 155 | 0 | 100% |
| Deploy | 155 | 154 | 1 | 99.4% |

### Failed Pipelines

| Pipeline | Branch | Reason | Time |
|----------|--------|--------|------|
| #1234 | feature/auth | CVE-2025-XXXX | 2h ago |
| #1231 | fix/api | Test failure | 6h ago |

---

## 📋 Admission Controller

### Policy Status

| Policy | Mode | Status | Denials (24h) |
|--------|------|--------|---------------|
| verify-image-signatures | enforce | 🟢 Active | 0 |
| block-unsigned-images | enforce | 🟢 Active | 0 |
| restrict-registries | enforce | 🟢 Active | 0 |
| resource-limits | audit | 🟡 Monitoring | 3 |

### Admission Events (Last 7 Days)

```
Denials by Reason:
├── Unsigned Image:     0
├── Invalid Signature:  0
├── Registry Blocked:   0
└── Resource Exceeded:  3 (audit only)
```

---

## 📦 SBOM Status

| Metric | Value |
|--------|-------|
| SBOMs Generated (24h) | 156 |
| Total Dependencies | 12,345 |
| Outdated Dependencies | 23 |
| License Violations | 0 |

---

## 🔑 Key Management

| Key | Created | Rotation Due | Status |
|-----|---------|--------------|--------|
| cosign-key-001 | 2025-01-15 | 2025-04-15 | 🟢 Valid |
| cosign-key-002 (backup) | 2025-02-01 | 2025-05-01 | 🟢 Valid |

**Next Rotation**: 68 days

---

## 🚨 Active Alerts

| Alert | Severity | Duration | Assigned |
|-------|----------|----------|----------|
| - | - | - | - |

**No active alerts** 🎉

---

## 📊 Error Budget

| Service | Monthly Budget | Consumed | Remaining |
|---------|----------------|----------|-----------|
| api-gateway | 43.8 min | 2.1 min | 95.2% |
| auth-service | 43.8 min | 1.5 min | 96.6% |
| task-queue | 7.2 min | 0.8 min | 88.9% |
| dashboard | 14.4 min | 3.2 min | 77.8% |

---

## 📅 Upcoming Events

| Date | Event | Action Required |
|------|-------|-----------------|
| 2025-04-15 | Key Rotation | Schedule drill |
| 2025-04-20 | Security Review | Prepare materials |
| 2025-05-01 | Quarterly Audit | Audit bundle |

---

## 🔗 Quick Links

| Resource | URL |
|----------|-----|
| Grafana Dashboard | `/grafana/d/governance` |
| Prometheus Alerts | `/prometheus/alerts` |
| Trivy Reports | `/security/trivy` |
| Rekor Log | `/rekor/entries` |
| Runbooks | `/docs/runbooks` |

---

## 📞 On-Call

| Role | Current | Contact |
|------|---------|---------|
| Primary SRE | @sre-oncall | PagerDuty |
| Secondary SRE | @sre-backup | Slack |
| Platform Lead | @platform-lead | Slack |

---

## 📝 Recent Activity

```
[14:32] ✅ Deployed api-gateway v1.2.3 to production
[12:15] ✅ Deployed auth-service v2.1.0 to production
[08:45] ✅ Deployed task-queue v1.5.2 to production
[Yesterday] 🔄 Key rotation drill completed successfully
[Yesterday] ✅ All images re-signed after dependency update
```

---

## ⚡ Quick Commands

```bash
# Check all pods
kubectl get pods -A | grep -v Running

# Recent events
kubectl get events -A --sort-by='.lastTimestamp' | head -20

# Verify image signature
cosign verify --keyless ghcr.io/company/app@sha256:xxx

# Quick vulnerability scan
trivy image --severity HIGH,CRITICAL ghcr.io/company/app@sha256:xxx

# Check admission policies
kubectl get clusterpolicies

# Generate SBOM
syft ghcr.io/company/app@sha256:xxx -o spdx-json
```

---

## 📎 Runbook Quick Reference

| Issue | Runbook |
|-------|---------|
| Signature Failed | Block CN |
| CVE Blocker | Block CQ |
| Admission Denial | Block CL |
| Canary Rollback | Block CV |
| Key Rotation | Block CO |
| General Debug | Block CF |

---

*Block EB – Day-2 Monitoring Dashboard – v1.0*
*Auto-generated: Refresh every 5 minutes*
