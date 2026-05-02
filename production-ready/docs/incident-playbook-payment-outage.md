# Incident Playbook: Payment Outage

## Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P1** | Complete outage | < 5 minutes | All payments failing |
| **P2** | Partial outage | < 15 minutes | Some payment types failing |
| **P3** | Degraded service | < 1 hour | Slow processing, intermittent errors |
| **P4** | Minor issue | < 4 hours | Single user affected |

---

## Quick Reference

### Emergency Contacts
- **Incident Commander**: [Name] - [Phone]
- **On-Call Engineer**: PagerDuty rotation
- **Stripe Support**: dashboard.stripe.com/support
- **Neon Support**: support@neon.tech

### Key Dashboards
- Payments: [Grafana URL]
- Errors: [Sentry URL]
- Database: [Neon Console URL]

### Critical Endpoints
- Health Check: `GET /api/health`
- Payment Status: `GET /api/payments/:id`
- Stripe Webhook: `POST /api/webhooks/stripe`

---

## P1: Complete Payment Outage

### Symptoms
- All payment requests failing with 5xx errors
- Stripe webhooks not being processed
- Database connection errors
- No payments being recorded

### Immediate Actions (0-5 min)

```bash
# 1. Check application health
curl -s https://api.cargobit.com/api/health | jq

# 2. Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# 3. Check Redis connectivity
redis-cli -u $REDIS_URL ping

# 4. Check recent deployments
kubectl rollout history deployment/api

# 5. Check error rates
# (Open Grafana dashboard)
```

### Decision Tree

```
Payment requests failing?
├── All failing (100%)?
│   ├── Database error?
│   │   └── Check Neon status page
│   │   └── If Neon down: Use read replica, notify users
│   │   └── If connection pool: Restart app, increase pool
│   │
│   ├── Stripe error?
│   │   └── Check Stripe status page
│   │   └── Enable maintenance mode, queue payments
│   │
│   └── App error?
│       └── Check recent deployment
│       └── Rollback if deployment issue
│
├── Some failing (< 100%)?
│   ├── Check error logs
│   ├── Identify pattern (specific card types, currencies)
│   └── Report to Stripe if pattern-based
│
└── Webhooks failing?
    ├── Check webhook endpoint
    ├── Check signature validation
    └── Reprocess from Stripe dashboard
```

### Communication Template

**Internal Slack (first update within 5 min):**
```
🚨 INCIDENT: Payment Outage
Severity: P1
Status: Investigating
Impact: All payment requests failing
IC: [Name]
Next update: 10 minutes
```

**Customer-Facing (if > 15 min):**
```
We're currently experiencing issues with payment processing.
Our team is actively working on a fix.
We'll update this message every 30 minutes.
```

---

## P2: Stripe Webhook Failures

### Symptoms
- Stripe dashboard shows failed webhook deliveries
- Payments succeeded in Stripe but not reflected in app
- Error logs showing webhook signature failures

### Diagnosis

```bash
# 1. Check recent webhook failures in Stripe
# Dashboard → Developers → Webhooks → [Endpoint] → Recent deliveries

# 2. Test webhook endpoint locally
stripe trigger payment_intent.succeeded

# 3. Check webhook secret
echo $STRIPE_WEBHOOK_SECRET

# 4. Check for duplicate events
psql $DATABASE_URL -c "
  SELECT id, type, processed, created_at 
  FROM stripe_events 
  WHERE created_at > now() - interval '1 hour'
  ORDER BY created_at DESC
"
```

### Resolution Steps

**If signature validation failing:**
1. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
2. Ensure raw body parser is configured
3. Check for middleware interfering with body parsing

**If processing errors:**
1. Check error logs for specific event failures
2. Fix the underlying issue
3. Reprocess failed events from Stripe dashboard

**If duplicate events:**
1. Verify idempotency key check
2. Check `stripe_events` table for duplicates
3. Implement additional deduplication if needed

---

## P3: Slow Payment Processing

### Symptoms
- Payment requests timing out
- High latency (> 5s) for payment endpoints
- User complaints about slow checkout

### Diagnosis

```bash
# 1. Check API latency
curl -w "Time: %{time_total}s\n" -X POST https://api.cargobit.com/api/payments

# 2. Check database query performance
psql $DATABASE_URL -c "
  SELECT query, mean_exec_time, calls 
  FROM pg_stat_statements 
  ORDER BY mean_exec_time DESC 
  LIMIT 10
"

# 3. Check connection pool
psql $DATABASE_URL -c "
  SELECT count(*) as connections, state 
  FROM pg_stat_activity 
  GROUP BY state
"

# 4. Check Redis latency
redis-cli -u $REDIS_URL --latency-history
```

### Resolution

**Database slow:**
- Add missing indexes
- Optimize slow queries
- Increase connection pool size
- Consider read replica for reporting

**Redis slow:**
- Check memory usage
- Review slowlog: `redis-cli slowlog get 10`
- Consider scaling up

**External API slow (Stripe):**
- Implement caching where possible
- Add timeout handling
- Consider async processing for non-critical updates

---

## Post-Incident

### Within 24 hours
- [ ] Incident documented in Jira/Linear
- [ ] Root cause identified
- [ ] Timeline reconstructed
- [ ] Stakeholders notified

### Within 48 hours
- [ ] Postmortem written
- [ ] Action items created
- [ ] Runbooks updated
- [ ] Detection improvements identified

### Postmortem Template

```markdown
# Incident: [Title]

**Date**: [Date]
**Duration**: [Start] - [End] ([Total])
**Severity**: [P1/P2/P3/P4]

## Summary
[1-2 sentence description]

## Impact
- [Number] users affected
- [Number] payments failed
- [Dollar amount] revenue impact

## Timeline
| Time | Event |
|------|-------|
| ... | ... |

## Root Cause
[Detailed explanation]

## Resolution
[What fixed it]

## Action Items
- [ ] [Action 1] (Owner: X, Due: Y)
- [ ] [Action 2] (Owner: X, Due: Y)

## Lessons Learned
- What went well
- What could be improved
- What was surprising
```

---

**Document Owner**: SRE Lead  
**Last Updated**: 2024-01-15  
**Review Cycle**: After each P1/P2 incident
