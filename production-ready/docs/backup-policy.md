# Backup Policy

## Overview

This document defines the backup strategy for CargoBit Payment System, ensuring data durability and business continuity.

## Backup Types

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Full Database | Daily (00:30 UTC) | 30 days | S3 (Standard-IA) |
| WAL Archive | Continuous | 7 days | S3 (Standard) |
| Audit Logs | Daily (04:00 UTC) | 90 days | S3 (Glacier) |
| Configuration | On change | 90 days | S3 (Standard) |

## Infrastructure

### Primary Database
- **Provider**: Neon (PostgreSQL)
- **Region**: EU-Central-1
- **PITR**: Enabled (7 days retention, up to 30 days on Pro)
- **Auto-backup**: Enabled

### Backup Storage
- **Bucket**: `cargobit-backups` (S3-compatible)
- **Encryption**: SSE-KMS (AWS managed keys)
- **Versioning**: Enabled
- **Lifecycle**: Transition to Glacier after 30 days

## Retention Policy

### Standard Backups
- **Daily backups**: 30 days
- **Weekly backups**: 90 days (first backup of each week)
- **Monthly backups**: 1 year (first backup of each month)

### Audit Logs
- **Hot storage**: 90 days
- **Cold storage (Glacier)**: 7 years (compliance)

## Backup Schedule

```
┌─────────────────────────────────────────────────────────────┐
│                     Daily Backup Schedule                    │
├──────────┬──────────────────────────────────────────────────┤
│ 00:00    │ WAL archiving (continuous)                       │
│ 00:30    │ Full database backup (pg_dump)                   │
│ 01:00    │ Backup upload to S3                              │
│ 02:00    │ Backup verification (checksum)                   │
│ 04:00    │ Audit log export to S3                           │
│ 05:00    │ Retention policy enforcement                     │
└──────────┴──────────────────────────────────────────────────┘
```

## Restore Procedures

### Standard Restore (Full Database)

```bash
# 1. List available backups
./ops/restore-db.sh --list

# 2. Download and restore (WARNING: overwrites existing data!)
./ops/restore-db.sh latest

# 3. Verify restore
psql $DATABASE_URL -c "SELECT count(*) FROM users"
```

### Point-in-Time Recovery (PITR)

For Neon databases, use the console:
1. Navigate to console.neon.tech
2. Select project → Branches
3. Click "Time Travel"
4. Select target timestamp
5. Create new branch from that point

### Emergency Restore

1. **Notify stakeholders** of expected downtime
2. **Stop all services** connecting to the database
3. **Run restore script** with appropriate backup
4. **Verify data integrity** before resuming services
5. **Document incident** and root cause

## Backup Verification

### Automated Checks
- **Daily**: Checksum verification after backup
- **Weekly**: Test restore to staging environment
- **Monthly**: Full restore drill with timing

### Verification Checklist
- [ ] Backup file exists and is readable
- [ ] Checksum matches expected value
- [ ] Database structure is intact (all tables exist)
- [ ] Data row counts are within expected range
- [ ] Critical queries return expected results
- [ ] Indexes are valid

## Monitoring & Alerting

### Alerts
| Alert | Threshold | Severity |
|-------|-----------|----------|
| Backup failed | Any failure | Critical |
| Backup delayed | > 30 min late | Warning |
| Storage nearly full | > 80% capacity | Warning |
| Restore failed | Any failure | Critical |

### Notifications
- **Slack**: #ops-alerts channel
- **Email**: ops-team@cargobit.com
- **PagerDuty**: For critical failures (outside business hours)

## Security

### Access Control
- Backup files encrypted at rest (SSE-KMS)
- Access restricted to DevOps team
- Download requires MFA approval
- All access logged to audit trail

### Compliance
- GDPR: Data encrypted, EU region only
- PCI-DSS: Encrypted backups, 7-year retention for financial records
- SOC 2: Quarterly restore tests documented

## Roles & Responsibilities

| Role | Responsibility |
|------|---------------|
| **SRE Lead** | Backup policy ownership, monthly review |
| **DevOps** | Daily backup monitoring, restore execution |
| **Security** | Access control, encryption key management |
| **Compliance** | Retention policy enforcement, audit support |

## Exceptions

### Planned Maintenance
- Backups paused during schema migrations
- Documented in change management system
- Manual backup before/after migration

### Emergency Situations
- Contact SRE Lead for backup policy exceptions
- All exceptions must be documented

---

**Document Owner**: SRE Lead  
**Last Updated**: 2024-01-15  
**Review Cycle**: Quarterly
