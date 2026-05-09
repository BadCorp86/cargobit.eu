# Incident Response Runbook

**Purpose**: Step-by-step guide for Production Incidents affecting the Governance PostCheck system and related services.

**Audience**: SRE, Platform Engineers, On-Call Engineers

**Last Updated**: 2026-05-07

---

## Quick Reference

| Severity | Response Time | Resolution Target | Escalation |
|----------|---------------|-------------------|------------|
| **P1 - Critical** | 5 minutes | 30 minutes | Immediate |
| **P2 - High** | 15 minutes | 2 hours | 30 minutes |
| **P3 - Medium** | 30 minutes | 8 hours | 2 hours |
| **P4 - Low** | 4 hours | 72 hours | Next business day |

---

## Severity Classification

### P1 - Critical
- Complete service outage
- Data loss or corruption risk
- Security breach in progress
- Payment/transaction system down
- Affects > 50% of users

### P2 - High
- Partial service degradation
- Critical feature unavailable
- Significant performance impact (> 5x latency)
- CI/CD pipeline blocked for all teams
- Affects > 10% of users

### P3 - Medium
- Non-critical feature degraded
- Intermittent failures
- Single team impacted
- CI/CD pipeline delayed

### P4 - Low
- Minor UI issues
- Documentation gaps
- Enhancement requests
- Non-blocking warnings

---

## Incident Response Phases

```
┌─────────────────────────────────────────────────────────────┐
│                    INCIDENT LIFECYCLE                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  DETECT ──▶ TRIAGE ──▶ INVESTIGATE ──▶ MITIGATE ──▶ RESOLVE │
│    │          │            │             │            │      │
│    ▼          ▼            ▼             ▼            ▼      │
│  Alert     Severity     Root Cause    Workaround   Fix      │
│  Trigger   Assign       Analysis      Apply        Deploy   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Detection

### Alert Sources

| Source | Type | Response |
|--------|------|----------|
| Prometheus Alertmanager | Metrics-based | Auto-page on P1/P2 |
| Grafana Dashboards | Visual | Check during on-call |
| Sentry | Error tracking | Review error spikes |
| PagerDuty | Aggregated | Primary paging channel |
| Slack #incidents | User reports | Monitor continuously |
| CI/CD Failures | Pipeline alerts | Check GitHub/GitLab |

### Key Metrics to Monitor

```yaml
# Service Health
- service_up{job="governance-postcheck"} == 1
- http_request_duration_seconds_bucket{le="0.5"} > 0.95
- http_requests_failed_total / http_requests_total < 0.01

# Risk Engine
- risk_engine_latency_seconds_p99 < 1.0
- risk_engine_queue_depth < 100
- risk_engine_error_rate < 0.001

# Security Gateway
- security_gateway_decision_latency_p99 < 0.5
- security_gateway_block_rate_spike < 0.1
- security_gateway_circuit_breaker_state == "closed"

# Signing/Verification
- cosign_verify_success_rate > 0.99
- registry_push_success_rate > 0.99
```

### Alert Validation Checklist

- [ ] Is the alert confirmed (not false positive)?
- [ ] What is the affected service/component?
- [ ] How many users are impacted?
- [ ] Is there an ongoing deployment?
- [ ] Check recent changes in last 4 hours
- [ ] Review related alerts in same timeframe

---

## Phase 2: Triage

### Immediate Actions (0-5 minutes)

```
1. ACKNOWLEDGE the incident in PagerDuty/Slack
2. CREATE incident channel: #inc-YYYY-MM-DD-brief-description
3. ANNOUNCE in #incidents channel:
   "🚨 P1/P2/P3: [Service] - [Brief Description] - @oncall investigating"
4. START incident timer
5. ASSIGN incident commander (usually on-call)
```

### Triage Checklist

- [ ] Confirm severity level (P1-P4)
- [ ] Identify affected services
- [ ] Determine blast radius (users/teams affected)
- [ ] Check if related to recent deployment
- [ ] Review related alerts and logs
- [ ] Decide: War room needed? (P1/P2 = Yes)

### Communication Template

```markdown
## Incident Status Update

**Severity**: P1/P2/P3/P4
**Status**: Investigating / Identified / Mitigating / Resolved
**Service**: [Affected service]
**Impact**: [User impact description]
**Started**: [Timestamp]
**Incident Commander**: [Name]
**Slack Channel**: #inc-YYYY-MM-DD-xxx

### Current Status
[2-3 sentence summary]

### Next Steps
- [ ] [Action 1]
- [ ] [Action 2]

### Timeline
- T+0: Alert triggered
- T+X: [Update]
```

---

## Phase 3: Investigation

### Log Collection Commands

```bash
# Kubernetes logs
kubectl logs -n cargobit deployment/governance-postcheck --tail=500

# Risk Engine logs
kubectl logs -n cargobit deployment/risk-engine --tail=500

# Security Gateway logs
kubectl logs -n cargobit deployment/security-gateway --tail=500

# All pods with errors
kubectl logs -n cargobit -l app=governance-postcheck --grep="ERROR" --tail=200

# Centralized logging (if available)
# Loki query: {app="governance-postcheck"} |= "error"
```

### Common Investigation Paths

#### Path 1: High Error Rate
```bash
# Check HTTP error codes
kubectl exec -n cargobit deployment/governance-postcheck -- \
  curl -s localhost:8080/metrics | grep http_requests_failed

# Check upstream dependencies
kubectl exec -n cargobit deployment/governance-postcheck -- \
  curl -s http://risk-engine:3003/health

# Check database connections
kubectl exec -n cargobit deployment/governance-postcheck -- \
  curl -s localhost:8080/health | jq '.dependencies'
```

#### Path 2: High Latency
```bash
# Check p99 latency
curl -s http://prometheus:9090/api/v1/query?query=histogram_quantile\(0.99,rate\(http_request_duration_seconds_bucket\[5m\]\)\)

# Check resource usage
kubectl top pods -n cargobit

# Check database query times
kubectl exec -n cargobit deployment/governance-postcheck -- \
  curl -s localhost:8080/metrics | grep db_query_duration
```

#### Path 3: Service Down
```bash
# Check pod status
kubectl get pods -n cargobit -l app=governance-postcheck

# Check events
kubectl get events -n cargobit --sort-by='.lastTimestamp'

# Check resource limits
kubectl describe pod -n cargobit -l app=governance-postcheck | grep -A5 "Limits:"

# Check liveness/readiness probes
kubectl describe pod -n cargobit -l app=governance-postcheck | grep -A10 "Liveness"
```

#### Path 4: CI/CD Failure
```bash
# Check GitHub Actions run
gh run view [run-id] --log-failed

# Check GitLab pipeline
glab ci view [pipeline-id]

# Check container registry
cosign verify --keyless ghcr.io/cargobit/governance-postcheck:[tag]

# Check Trivy scan results
trivy image ghcr.io/cargobit/governance-postcheck:[tag] --severity HIGH,CRITICAL
```

---

## Phase 4: Mitigation

### Standard Mitigation Playbooks

#### Playbook A: Rolling Restart

```bash
# Graceful rolling restart
kubectl rollout restart deployment/governance-postcheck -n cargobit

# Monitor rollout
kubectl rollout status deployment/governance-postcheck -n cargobit --timeout=300s

# Verify pods healthy
kubectl get pods -n cargobit -l app=governance-postcheck -w
```

#### Playbook B: Scale Out

```bash
# Horizontal scale
kubectl scale deployment/governance-postcheck -n cargobit --replicas=5

# Check HPA status
kubectl get hpa -n cargobit

# Manual HPA adjustment
kubectl patch hpa governance-postcheck -n cargobit --type=json \
  -p='[{"op": "replace", "path": "/spec/maxReplicas", "value": 10}]'
```

#### Playbook C: Rollback Deployment

```bash
# Check rollout history
kubectl rollout history deployment/governance-postcheck -n cargobit

# Rollback to previous version
kubectl rollout undo deployment/governance-postcheck -n cargobit

# Rollback to specific revision
kubectl rollout undo deployment/governance-postcheck -n cargobit --to-revision=3

# Verify rollback
kubectl rollout status deployment/governance-postcheck -n cargobit
```

#### Playbook D: Circuit Breaker Activation

```bash
# Enable circuit breaker (via Security Gateway API)
curl -X POST http://security-gateway:3004/security/circuit-breaker/enable \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service": "risk-engine", "mode": "BLOCK_ALL"}'

# Fallback to permission-only mode
curl -X POST http://security-gateway:3004/security/fallback \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -d '{"mode": "PERMISSION_ONLY"}'
```

#### Playbook E: Traffic Drain

```bash
# Drain traffic from unhealthy pods
kubectl annotate pod -n cargobit -l app=governance-postcheck \
  traffic.sidecar.istio.io/includeOutboundIPRanges="10.0.0.0/8" --overwrite

# Or via ingress
kubectl patch ingress governance-postcheck -n cargobit --type=json \
  -p='[{"op": "replace", "path": "/spec/rules/0/http/paths/0/backend/service/name", "value": "maintenance-page"}]'
```

#### Playbook F: Feature Flag Disable

```bash
# Disable problematic feature via config
kubectl set env deployment/governance-postcheck -n cargobit \
  FEATURE_ADVANCED_RISK_CHECK=false

# Or via feature flag service
curl -X POST http://feature-flags:8080/api/flags/advanced-risk-check/disable \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Mitigation Decision Matrix

| Symptom | Primary Mitigation | Fallback |
|---------|-------------------|----------|
| High error rate | Rolling restart | Rollback |
| High latency | Scale out | Traffic drain |
| Memory leak | Rolling restart + resource limit | Scale out |
| DB connection exhaustion | Restart + connection pool fix | Scale down |
| CI/CD blocked | Skip failing test (documented) | Manual approval |
| Signing failure | Temporary keyed signing | Manual verification |
| Dependency outage | Circuit breaker | Graceful degradation |

---

## Phase 5: Resolution

### Resolution Checklist

- [ ] Service health confirmed (all metrics green)
- [ ] Error rate back to baseline (< 0.1%)
- [ ] Latency within SLO (< 500ms p99)
- [ ] All pods running and ready
- [ ] CI/CD pipeline unblocked
- [ ] Customer impact ended
- [ ] Monitoring dashboards normal
- [ ] On-call handoff updated

### Final Communication

```markdown
## 🔓 Incident Resolved

**Incident**: [Title]
**Duration**: [X hours Y minutes]
**Severity**: P1/P2/P3/P4
**Resolution**: [Brief description of fix]

### Impact Summary
- Users affected: [Number or percentage]
- Features impacted: [List]
- Total downtime: [Duration]

### Root Cause
[One paragraph explanation]

### Immediate Actions Taken
1. [Action 1]
2. [Action 2]

### Follow-up Actions
- [ ] [Action item] - Owner: [Name] - Due: [Date]
- [ ] [Action item] - Owner: [Name] - Due: [Date]

### Lessons Learned
- What went well: [Points]
- What could improve: [Points]

Thank you to everyone who helped resolve this incident.
```

---

## Post-Incident Process

### Timeline

| Time | Activity |
|------|----------|
| T+24h | Draft Postmortem |
| T+48h | Postmortem Review Meeting |
| T+72h | Publish Postmortem |
| T+1 week | Action Items Review |
| T+1 month | Action Items Completion Check |

### Postmortem Template

```markdown
# Postmortem: [Incident Title]

**Date**: YYYY-MM-DD
**Severity**: P1/P2/P3/P4
**Duration**: X hours Y minutes
**Authors**: [Names]

## Summary
[2-3 sentence overview]

## Impact
- **Users affected**: [Number/percentage]
- **Duration**: [Time]
- **Services affected**: [List]

## Timeline (UTC)

| Time | Event |
|------|-------|
| HH:MM | Alert triggered |
| HH:MM | On-call acknowledged |
| HH:MM | [Update] |
| HH:MM | Incident resolved |

## Root Cause
[Detailed explanation]

## Trigger
[What specifically triggered the incident]

## Detection
[How was the incident detected]

## Resolution
[How was the incident resolved]

## Action Items

| Action | Type | Owner | Due Date | Status |
|--------|------|-------|----------|--------|
| [Action] | Prevent | [Name] | YYYY-MM-DD | Open |
| [Action] | Mitigate | [Name] | YYYY-MM-DD | Open |

## Lessons Learned

### What went well
- [Point 1]
- [Point 2]

### What could be improved
- [Point 1]
- [Point 2]

### Where we got lucky
- [Point 1]

## Appendix
- [Links to logs, graphs, etc.]
```

---

## Escalation Contacts

### Primary Contacts

| Role | Name | Slack | Phone | Email |
|------|------|-------|-------|-------|
| On-Call SRE | @sre-oncall | #sre-oncall | +49-xxx | sre-oncall@cargobit.io |
| Platform Lead | @platform-lead | #platform | +49-xxx | platform-lead@cargobit.io |
| Security Lead | @security-lead | #security | +49-xxx | security-lead@cargobit.io |
| Engineering Manager | @eng-manager | #engineering | +49-xxx | eng-manager@cargobit.io |

### External Contacts

| Service | Contact | SLA |
|---------|---------|-----|
| AWS Support | Business Support | 1 hour |
| Azure Support | Premier Support | 1 hour |
| GitHub Support | Enterprise Support | 8 hours |

---

## Appendix: Runbook Links

| Runbook | Link |
|---------|------|
| Risk Engine Troubleshooting | `runbooks/risk-engine.md` |
| Security Gateway Troubleshooting | `runbooks/security-gateway.md` |
| CI/CD Troubleshooting | `runbooks/ci-cd.md` |
| Database Failover | `runbooks/database-failover.md` |
| Kubernetes Debugging | `runbooks/kubernetes-debugging.md` |

---

## Block Metadata

| Field | Value |
|-------|-------|
| **Block ID** | CG |
| **Title** | Incident Response Runbook |
| **Category** | Operations, SRE, On-Call |
| **Related Blocks** | CF (Debug Checklist), CC (GitHub Actions), CD (GitLab CI) |
| **Created** | 2026-05-07 |

---

*CargoBit Developer Portal – Multi-Agent System Documentation*
