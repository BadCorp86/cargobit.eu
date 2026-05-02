# 📡 Agent-Kommunikationsmatrix

## Übersicht

Diese Matrix definiert die Kommunikation, Abhängigkeiten und Datenflüsse zwischen allen Agenten im Multi-Agent-System.

---

## Agent-Matrix

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           AGENT COMMUNICATION MATRIX                                     │
├──────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────────┤
│              │ ARCHITECT   │   BACKEND   │    SRE      │     QA      │   COMPLIANCE    │
├──────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────────┤
│ ARCHITECT    │      —      │   SENDS     │   SENDS     │   SENDS     │     SENDS       │
│              │             │  Prisma     │  Schema     │  Schema     │  Architecture   │
│              │             │  Schema     │  Info       │  Models     │  Docs           │
├──────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────────┤
│   BACKEND    │   WAITS     │      —      │   SENDS     │   SENDS     │     SENDS       │
│              │  For Schema │             │  Audit      │  Modules    │  Security       │
│              │             │             │  Events     │  for Test   │  Requirements   │
├──────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────────┤
│     SRE      │   WAITS     │   WAITS     │      —      │   SENDS     │     SENDS       │
│              │  For Schema │  For Audit  │             │  Scripts    │  Backup         │
│              │             │  Service    │             │  for Test   │  Policies       │
├──────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────────┤
│      QA      │   WAITS     │   WAITS     │   WAITS     │      —      │     SENDS       │
│              │  For Schema │  For Modules│  For Scripts│             │  Test Criteria  │
├──────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────────┤
│  COMPLIANCE  │   WAITS     │   SENDS     │   SENDS     │   SENDS     │        —        │
│              │  For Arch   │  Security   │  Backup     │  Test       │                 │
│              │  Overview   │  Specs      │  Specs      │  Standards  │                 │
└──────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────────────┘
```

---

## Detaillierte Kommunikation

### 1. Architect-Agent

| Empfänger | Nachrichtentyp | Inhalt | Trigger |
|-----------|---------------|--------|---------|
| Backend | `SCHEMA_READY` | Prisma Schema, Model-Definitionen | Nach Schema-Erstellung |
| SRE | `SCHEMA_READY` | Tabellen-Struktur, Indexe | Nach Schema-Erstellung |
| QA | `MODELS_DEFINED` | Model-Interfaces, Types | Nach Schema-Erstellung |
| Compliance | `ARCHITECTURE_DOC` | Architecture Overview | Nach Dokumentation |

**Output-Dateien:**
```json
{
  "agent": "architect",
  "outputs": [
    "prisma/schema.prisma",
    "migrations/0001_init.sql",
    "migrations/0002_indexes.sql",
    "docs/architecture-overview.md"
  ],
  "signals": ["SCHEMA_READY", "MODELS_DEFINED"]
}
```

---

### 2. Backend-Agent

| Empfänger | Nachrichtentyp | Inhalt | Trigger |
|-----------|---------------|--------|---------|
| SRE | `AUDIT_SERVICE_READY` | AuditLog Service Interface | Nach Service-Erstellung |
| QA | `MODULES_READY` | Rate Limiting, Webhook Module | Nach Implementation |
| Compliance | `SECURITY_SPECS` | Rate Limit Policies, Validation Logic | Nach Implementation |

**Abhängigkeiten:**
```json
{
  "agent": "backend",
  "depends_on": ["architect"],
  "wait_for": ["SCHEMA_READY"],
  "outputs": [
    "src/lib/rateLimit.ts",
    "src/middleware/rateLimit.ts",
    "src/webhooks/stripe.ts",
    "src/services/stripeEvents.ts",
    "src/services/auditLog.ts",
    "src/jobs/auditVerify.ts"
  ],
  "signals": ["MODULES_READY", "AUDIT_SERVICE_READY"]
}
```

---

### 3. SRE-Agent

| Empfänger | Nachrichtentyp | Inhalt | Trigger |
|-----------|---------------|--------|---------|
| QA | `SCRIPTS_READY` | Backup/Restore Scripts | Nach Skript-Erstellung |
| Compliance | `BACKUP_SPECS` | RTO/RPO, Retention Policies | Nach Policy-Definition |

**Abhängigkeiten:**
```json
{
  "agent": "sre",
  "depends_on": ["architect", "backend"],
  "wait_for": ["SCHEMA_READY", "AUDIT_SERVICE_READY"],
  "outputs": [
    "ops/backup-db.sh",
    "ops/restore-db.sh",
    "ops/cron-backup.yaml",
    "ops/export-audit-log.ts",
    "docs/backup-policy.md",
    "docs/restore-playbook.md"
  ],
  "signals": ["SCRIPTS_READY", "BACKUP_SPECS"]
}
```

---

### 4. QA-Agent

| Empfänger | Nachrichtentyp | Inhalt | Trigger |
|-----------|---------------|--------|---------|
| Compliance | `TEST_STANDARDS` | Coverage Requirements, Test Criteria | Nach Test-Erstellung |

**Abhängigkeiten:**
```json
{
  "agent": "qa",
  "depends_on": ["architect", "backend", "sre"],
  "wait_for": ["MODELS_DEFINED", "MODULES_READY", "SCRIPTS_READY"],
  "outputs": [
    "tests/rateLimit.test.ts",
    "tests/stripeWebhook.test.ts",
    "tests/auditLog.test.ts",
    "tests/fixtures/stripeEvents.json"
  ],
  "signals": ["TESTS_COMPLETE"]
}
```

---

### 5. Compliance-Agent

| Empfänger | Nachrichtentyp | Inhalt | Trigger |
|-----------|---------------|--------|---------|
| Alle | `COMPLIANCE_REQUIREMENTS` | Security Standards, Policies | Bei Start |

**Abhängigkeiten:**
```json
{
  "agent": "compliance",
  "depends_on": ["architect"],
  "wait_for": ["ARCHITECTURE_DOC", "SECURITY_SPECS", "BACKUP_SPECS", "TEST_STANDARDS"],
  "outputs": [
    "docs/security-policy.md",
    "docs/compliance-readiness.md",
    "docs/slas.md",
    "docs/incident-playbook-payment-outage.md",
    "docs/on-call-runbook.md",
    "docs/operational-readiness-checklist.md",
    "docs/audit-log-policy.md"
  ],
  "signals": ["COMPLIANCE_COMPLETE"]
}
```

---

## Message Bus Protokoll

### Nachrichtenaufbau

```typescript
interface AgentMessage {
  id: string;                    // UUID
  timestamp: string;             // ISO 8601
  sender: AgentRole;             // Absender-Agent
  receiver: AgentRole | 'all';   // Empfänger-Agent oder Broadcast
  type: MessageType;             // Nachrichtentyp
  priority: 'low' | 'normal' | 'high' | 'critical';
  payload: Record<string, any>;  // Nachrichtinhalt
  correlationId?: string;        // Für Request-Response
}

type AgentRole = 'orchestrator' | 'architect' | 'backend' | 'sre' | 'qa' | 'compliance';

type MessageType = 
  | 'TASK_ASSIGNMENT'
  | 'TASK_COMPLETION'
  | 'TASK_FAILURE'
  | 'DEPENDENCY_READY'
  | 'OUTPUT_PRODUCED'
  | 'VALIDATION_REQUEST'
  | 'VALIDATION_RESULT'
  | 'ERROR'
  | 'PROGRESS_UPDATE';
```

### Beispiel-Nachrichten

**Task Assignment (Orchestrator → Agent):**
```json
{
  "id": "msg-001",
  "timestamp": "2024-01-15T10:00:00Z",
  "sender": "orchestrator",
  "receiver": "architect",
  "type": "TASK_ASSIGNMENT",
  "priority": "high",
  "payload": {
    "taskId": "TASK-A-001",
    "block": "A",
    "description": "Create Prisma Schema",
    "files": ["prisma/schema.prisma"],
    "requirements": {
      "models": ["User", "Wallet", "Payment", "Payout", "Transaction", "AuditLog", "StripeEvent"],
      "enums": ["UserRole", "PaymentStatus", "TransactionType", ...],
      "indexes": true
    }
  }
}
```

**Dependency Ready (Agent → Agent):**
```json
{
  "id": "msg-002",
  "timestamp": "2024-01-15T10:05:00Z",
  "sender": "architect",
  "receiver": "backend",
  "type": "DEPENDENCY_READY",
  "priority": "normal",
  "payload": {
    "dependencyType": "SCHEMA_READY",
    "files": ["prisma/schema.prisma"],
    "metadata": {
      "modelCount": 7,
      "enumCount": 10,
      "indexCount": 15
    }
  }
}
```

**Task Completion (Agent → Orchestrator):**
```json
{
  "id": "msg-003",
  "timestamp": "2024-01-15T10:10:00Z",
  "sender": "backend",
  "receiver": "orchestrator",
  "type": "TASK_COMPLETION",
  "priority": "normal",
  "payload": {
    "taskId": "TASK-B-001",
    "status": "completed",
    "outputs": [
      {
        "file": "src/lib/rateLimit.ts",
        "lines": 150,
        "checksum": "sha256:abc123..."
      }
    ],
    "nextAgents": ["sre", "qa"]
  }
}
```

---

## Ausführungsphasen

### Phase 1: Initialisierung
```
Orchestrator → Compliance: "COMPLIANCE_REQUIREMENTS"
Compliance → All: Security Standards, Policies
```

### Phase 2: Core Development (Parallel)
```
Orchestrator → Architect: "TASK_ASSIGNMENT Block A"
Orchestrator → Backend: "WAIT for Architect"
Orchestrator → SRE: "WAIT for Architect + Backend"
```

### Phase 3: Integration
```
Architect → Backend: "SCHEMA_READY"
Architect → SRE: "SCHEMA_READY"
Backend → SRE: "AUDIT_SERVICE_READY"
Backend → QA: "MODULES_READY"
```

### Phase 4: Testing & Compliance
```
SRE → QA: "SCRIPTS_READY"
All → Compliance: Specs & Outputs
Compliance → Orchestrator: "COMPLIANCE_COMPLETE"
```

### Phase 5: Finalisierung
```
QA → Orchestrator: "TESTS_COMPLETE"
Orchestrator → All: "PIPELINE_COMPLETE"
```

---

## Error Handling

### Error Types

| Error Code | Beschreibung | Aktion |
|------------|--------------|--------|
| `E001` | Dependency nicht erfüllt | Wait & Retry |
| `E002` | Output-Validierung fehlgeschlagen | Re-generate |
| `E003` | Timeout überschritten | Escalate |
| `E004` | Agent nicht verfügbar | Reassign Task |
| `E005` | Kritischer Fehler | Halt Pipeline |

### Error Message Format
```json
{
  "id": "err-001",
  "timestamp": "2024-01-15T10:15:00Z",
  "sender": "backend",
  "receiver": "orchestrator",
  "type": "ERROR",
  "priority": "critical",
  "payload": {
    "errorCode": "E002",
    "taskId": "TASK-B-001",
    "message": "Output validation failed: TypeScript compilation error",
    "details": {
      "file": "src/lib/rateLimit.ts",
      "line": 42,
      "error": "Type 'string' is not assignable to type 'number'"
    },
    "retryCount": 2,
    "maxRetries": 3
  }
}
```

---

## State Machine

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENT STATE MACHINE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐   │
│   │  IDLE   │─────▶│ WAITING │─────▶│WORKING  │─────▶│ COMPLETE│   │
│   └─────────┘      └─────────┘      └─────────┘      └─────────┘   │
│        │                │                │                │        │
│        │                │                │                │        │
│        │           ┌────┴────┐      ┌────┴────┐           │        │
│        │           │ BLOCKED │      │  ERROR  │           │        │
│        │           └─────────┘      └─────────┘           │        │
│        │                                 │                │        │
│        └─────────────────────────────────┴────────────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

States:
- IDLE: Agent wartet auf Task
- WAITING: Agent wartet auf Dependencies
- WORKING: Agent generiert Output
- COMPLETE: Task abgeschlossen
- BLOCKED: Dependency nicht erfüllbar
- ERROR: Fehler aufgetreten
```

---

## Monitoring & Observability

### Metriken pro Agent

```yaml
metrics:
  - name: agent_task_duration_seconds
    type: histogram
    labels: [agent, task_type, status]
    
  - name: agent_tasks_total
    type: counter
    labels: [agent, status]
    
  - name: agent_output_lines
    type: gauge
    labels: [agent, file_type]
    
  - name: agent_errors_total
    type: counter
    labels: [agent, error_code]
    
  - name: dependency_wait_seconds
    type: histogram
    labels: [agent, dependency_type]
```

### Dashboard Query
```promql
# Durchschnittliche Task-Dauer pro Agent
avg by (agent) (rate(agent_task_duration_seconds_sum[5m]) / rate(agent_task_duration_seconds_count[5m]))

# Fehler-Rate
sum by (agent) (rate(agent_errors_total[5m]))

# Tasks pro Status
sum by (agent, status) (agent_tasks_total)
```

---

*Diese Kommunikationsmatrix definiert das vollständige Interaktionsmuster zwischen allen Agenten.*
