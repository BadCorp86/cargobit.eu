# EG – Release-Risk Heatmap Dashboard

> **Zweck**: Visuelle Risikodarstellung für Management und Teams. Zeigt Risiken nach Kategorie und Schweregrad.

---

## 📊 Release-Risk Heatmap Dashboard

### Letzte Aktualisierung: `YYYY-MM-DD`

---

## 🎯 Risk Matrix

```
                    IMPACT
           Low      Medium      High      Critical
         ┌────────┬────────┬────────┬────────┐
    High │   🟡   │   🟠   │   🔴   │   🔴   │
W        ├────────┼────────┼────────┼────────┤
P   Med  │   🟢   │   🟡   │   🟠   │   🔴   │
R        ├────────┼────────┼────────┼────────┤
O   Low  │   🟢   │   🟢   │   🟡   │   🟠   │
B        ├────────┼────────┼────────┼────────┤
  VLow   │   🟢   │   🟢   │   🟢   │   🟡   │
         └────────┴────────┴────────┴────────┘

🟢 Low Risk   🟡 Medium Risk   🟠 High Risk   🔴 Critical Risk
```

---

## 🔍 Risiko-Kategorien

### 1. Technical Risks

| Risiko | Probability | Impact | Score | Status |
|--------|-------------|--------|-------|--------|
| Pipeline Failure | Low | Medium | 🟢 Low | Mitigated |
| Signing Service Outage | Low | High | 🟡 Medium | Monitored |
| Admission Controller Failure | Low | Critical | 🟠 High | Mitigated |
| CVE Zero-Day | Medium | High | 🟠 High | Monitored |
| Database Failure | Low | Critical | 🟠 High | Monitored |

**Category Risk Score**: 🟠 **High** (4 risks)

---

### 2. Security Risks

| Risiko | Probability | Impact | Score | Status |
|--------|-------------|--------|-------|--------|
| Supply Chain Attack | Low | Critical | 🟠 High | Mitigated |
| Key Compromise | Very Low | Critical | 🟡 Medium | Mitigated |
| CVE in Production | Medium | Medium | 🟡 Medium | Monitored |
| Unauthorized Access | Low | High | 🟡 Medium | Mitigated |
| SBOM Drift | Medium | Low | 🟢 Low | Monitored |

**Category Risk Score**: 🟡 **Medium** (5 risks)

---

### 3. Operational Risks

| Risiko | Probability | Impact | Score | Status |
|--------|-------------|--------|-------|--------|
| Rollback Failure | Low | High | 🟡 Medium | Tested |
| Canary Regression | Low | Medium | 🟢 Low | Monitored |
| Key Rotation Missed | Low | Medium | 🟢 Low | Automated |
| Alert Fatigue | Medium | Low | 🟢 Low | Managed |
| On-Call Burnout | Medium | Medium | 🟡 Medium | Monitored |

**Category Risk Score**: 🟢 **Low** (5 risks)

---

### 4. Compliance Risks

| Risiko | Probability | Impact | Score | Status |
|--------|-------------|--------|-------|--------|
| Audit Finding | Low | High | 🟡 Medium | Prepared |
| Missing Documentation | Low | Medium | 🟢 Low | Complete |
| Policy Violation | Low | High | 🟡 Medium | Enforced |
| Key Rotation Gap | Low | Medium | 🟢 Low | Scheduled |
| Exception Not Documented | Medium | Medium | 🟡 Medium | Processed |

**Category Risk Score**: 🟡 **Medium** (5 risks)

---

### 5. Business Risks

| Risiko | Probability | Impact | Score | Status |
|--------|-------------|--------|-------|--------|
| Service Downtime | Low | Critical | 🟠 High | Mitigated |
| Data Loss | Very Low | Critical | 🟡 Medium | Protected |
| Customer Impact | Low | High | 🟡 Medium | Monitored |
| Reputational Damage | Very Low | Critical | 🟡 Medium | Mitigated |
| Revenue Loss | Low | High | 🟡 Medium | Monitored |

**Category Risk Score**: 🟡 **Medium** (5 risks)

---

## 📈 Heatmap Visualization

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        GOVERNANCE POSTCHECK RISK HEATMAP                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Technical     ████████████████████░░░░░░░░░░  🟠 HIGH                 │
│  Security      ████████████████░░░░░░░░░░░░░░  🟡 MEDIUM               │
│  Operational   ████████░░░░░░░░░░░░░░░░░░░░░░  🟢 LOW                  │
│  Compliance    ████████████████░░░░░░░░░░░░░░  🟡 MEDIUM               │
│  Business      ████████████████░░░░░░░░░░░░░░  🟡 MEDIUM               │
│                                                                         │
│  Overall Risk: ████████████████████░░░░░░░░░░  🟡 MEDIUM               │
│                                                                         │
│  Legend: 🟢 LOW (< 30%)  🟡 MEDIUM (30-60%)  🟠 HIGH (60-80%)          │
│          🔴 CRITICAL (> 80%)                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Risk Trend (Last 4 Weeks)

```
Week    Overall    Technical    Security    Ops    Compliance    Business
────    ───────    ─────────    ────────    ───    ──────────    ────────
W-4       🟠          🟠           🟠        🟡        🟡           🟠
W-3       🟡          🟠           🟡        🟢        🟡           🟡
W-2       🟡          🟡           🟡        🟢        🟡           🟡
W-1       🟡          🟠           🟡        🟢        🟡           🟡
Current   🟡          🟠           🟡        🟢        🟡           🟡

Trend: → Stable (Risk level maintained)
```

---

## 🔥 Top 5 Risks Requiring Attention

| Rank | Risiko | Category | Score | Action | Owner | Due |
|------|--------|----------|-------|--------|-------|-----|
| 1 | Admission Controller Failure | Technical | 🟠 High | Test failover | Platform | W+1 |
| 2 | CVE Zero-Day | Technical | 🟠 High | SBOM drill | Security | W+2 |
| 3 | Supply Chain Attack | Security | 🟠 High | Verify signing | Security | Ongoing |
| 4 | Service Downtime | Business | 🟠 High | SLO monitoring | SRE | Ongoing |
| 5 | Audit Finding | Compliance | 🟡 Medium | Prepare docs | Compliance | W+4 |

---

## 📋 Mitigation Status

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Mitigated | 12 | 48% |
| 🔄 In Progress | 8 | 32% |
| 📋 Planned | 4 | 16% |
| ⚠️ Accept | 1 | 4% |

---

## 🎯 Risk Reduction Actions

### Immediate (This Week)

| Action | Risk | Owner | Status |
|--------|------|-------|--------|
| Admission failover test | Technical | Platform | In Progress |
| SBOM-based CVE drill | Security | Security | Planned |
| Rollback drill | Operational | SRE | In Progress |

### Short-term (This Month)

| Action | Risk | Owner | Status |
|--------|------|-------|--------|
| Key rotation automation | Security | Security | Planned |
| Exception process improvement | Compliance | Compliance | In Progress |
| Alert tuning | Operational | SRE | In Progress |

### Long-term (This Quarter)

| Action | Risk | Owner | Status |
|--------|------|-------|--------|
| Multi-region failover | Technical | Platform | Planned |
| SOC 2 preparation | Compliance | Compliance | Planned |
| Chaos engineering | Operational | SRE | Planned |

---

## 📊 Risk Score Calculation

```
Risk Score = Probability × Impact

Probability Scale:
- Very Low:  1
- Low:       2
- Medium:    3
- High:      4

Impact Scale:
- Low:       1
- Medium:    2
- High:      3
- Critical:  4

Risk Level:
- 1-4:   🟢 Low
- 5-8:   🟡 Medium
- 9-12:  🟠 High
- 13-16: 🔴 Critical
```

---

## 📎 Guided Links

| Thema | Block |
|-------|-------|
| Risiko-Register | DT |
| Go-Live Checklist | EC |
| Day-2 Runbook | DY |
| SRE On-Call | EA |

---

*Block EG – Release-Risk Heatmap Dashboard – v1.0*
