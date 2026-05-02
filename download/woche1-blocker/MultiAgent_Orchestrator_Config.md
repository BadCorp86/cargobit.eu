# 🎛️ Multi-Agent Orchestrator Konfiguration

## System-Architektur

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR RUNTIME                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         MESSAGE BROKER                               │    │
│  │                    (Redis / RabbitMQ / In-Memory)                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│         ┌────────────────────────────┼────────────────────────────┐         │
│         │                            │                            │         │
│         ▼                            ▼                            ▼         │
│  ┌─────────────┐             ┌─────────────┐             ┌─────────────┐    │
│  │   AGENT     │             │   AGENT     │             │   AGENT     │    │
│  │  POOL #1    │             │  POOL #2    │             │  POOL #3    │    │
│  │             │             │             │             │             │    │
│  │ Architect   │             │  Backend    │             │    SRE      │    │
│  │ Compliance  │             │     QA      │             │             │    │
│  └─────────────┘             └─────────────┘             └─────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         STATE STORE                                  │    │
│  │                    (Redis / PostgreSQL / SQLite)                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## orchestrator-config.yaml

```yaml
# orchestrator-config.yaml
# Vollständige Konfiguration für den Multi-Agent Orchestrator

version: "1.0.0"
project: "cargobit-payment-system"

# ==================== ORCHESTRATOR ====================

orchestrator:
  id: "orchestrator-001"
  name: "CargoBit Code Generation Orchestrator"
  
  runtime:
    max_concurrent_tasks: 5
    task_timeout_ms: 300000        # 5 Minuten
    retry_attempts: 3
    retry_backoff_ms: 1000
    
  scheduling:
    algorithm: "dependency_graph"   # dependency_graph | round_robin | priority
    parallelism: "phase_based"      # phase_based | full_parallel | sequential

# ==================== MESSAGE BROKER ====================

message_broker:
  type: "redis"                     # redis | rabbitmq | memory
  
  redis:
    url: "${REDIS_URL:-redis://localhost:6379}"
    channel_prefix: "cargobit:agent:"
    
  queues:
    - name: "task_queue"
      type: "list"
      ttl_ms: 3600000
    - name: "result_queue"
      type: "list"
      ttl_ms: 3600000
    - name: "error_queue"
      type: "list"
      ttl_ms: 86400000

# ==================== STATE STORE ====================

state_store:
  type: "redis"                     # redis | postgres | sqlite | memory
  
  redis:
    url: "${REDIS_URL:-redis://localhost:6379}"
    key_prefix: "cargobit:state:"
    
  persistence:
    enabled: true
    snapshot_interval_ms: 60000
    
  recovery:
    enabled: true
    checkpoint_on_complete: true

# ==================== AGENTS ====================

agents:
  # ---------- ARCHITECT AGENT ----------
  - id: "architect"
    name: "Database Architect"
    role: "database_design"
    
    capabilities:
      - prisma_schema_generation
      - sql_migration_writing
      - architecture_documentation
      
    max_concurrent_tasks: 1
    
    inputs:
      - project_requirements
      - tech_stack
      
    outputs:
      - prisma/schema.prisma
      - migrations/0001_init.sql
      - migrations/0002_indexes.sql
      - docs/architecture-overview.md
      
    signals:
      emits:
        - SCHEMA_READY
        - MODELS_DEFINED
      consumes: []
      
    prompts:
      system: |
        Du bist der Database Architect für CargoBit.
        Deine Aufgabe ist es, ein vollständiges Prisma Schema und SQL Migrationen zu erstellen.
        
        Modelle: User, Wallet, Payment, Payout, Transaction, AuditLog, StripeEvent
        Enums: UserRole, PaymentStatus, TransactionType, etc.
        
        Output-Format:
        ### FILE: path/to/file.ext
        ```language
        [vollständiger Dateiinhalt]
        ```
        
      task_template: |
        Erstelle {task_description}.
        
        Anforderungen:
        {requirements}
        
        Output-Dateien: {output_files}

  # ---------- BACKEND AGENT ----------
  - id: "backend"
    name: "Backend Developer"
    role: "implementation"
    
    capabilities:
      - typescript_development
      - rate_limiting_implementation
      - webhook_handler_creation
      - audit_log_service
      
    max_concurrent_tasks: 2
    
    inputs:
      - prisma_schema
      
    outputs:
      - src/lib/rateLimit.ts
      - src/middleware/rateLimit.ts
      - src/webhooks/stripe.ts
      - src/services/stripeEvents.ts
      - src/services/auditLog.ts
      - src/jobs/auditVerify.ts
      
    signals:
      emits:
        - MODULES_READY
        - AUDIT_SERVICE_READY
      consumes:
        - SCHEMA_READY
        
    dependencies:
      - architect
      
    prompts:
      system: |
        Du bist der Backend Developer für CargoBit.
        Deine Aufgabe ist es, produktionsreife TypeScript-Module zu erstellen.
        
        Standards:
        - TypeScript strict mode
        - Async/await Pattern
        - Explizite Typ-Annotationen
        - JSDoc Kommentare
        - Error Handling
        
      task_template: |
        Implementiere {task_description}.
        
        Basis auf Prisma Schema: {schema_file}
        
        Anforderungen:
        {requirements}

  # ---------- SRE AGENT ----------
  - id: "sre"
    name: "Site Reliability Engineer"
    role: "operations"
    
    capabilities:
      - bash_scripting
      - kubernetes_configuration
      - backup_automation
      - disaster_recovery
      
    max_concurrent_tasks: 1
    
    inputs:
      - prisma_schema
      - audit_service_interface
      
    outputs:
      - ops/backup-db.sh
      - ops/restore-db.sh
      - ops/cron-backup.yaml
      - ops/export-audit-log.ts
      - docs/backup-policy.md
      - docs/restore-playbook.md
      
    signals:
      emits:
        - SCRIPTS_READY
        - BACKUP_SPECS
      consumes:
        - SCHEMA_READY
        - AUDIT_SERVICE_READY
        
    dependencies:
      - architect
      - backend

  # ---------- QA AGENT ----------
  - id: "qa"
    name: "Quality Assurance Engineer"
    role: "testing"
    
    capabilities:
      - unit_testing
      - integration_testing
      - test_fixture_creation
      - mocking_strategies
      
    max_concurrent_tasks: 2
    
    inputs:
      - prisma_schema
      - implemented_modules
      - operational_scripts
      
    outputs:
      - tests/rateLimit.test.ts
      - tests/stripeWebhook.test.ts
      - tests/auditLog.test.ts
      - tests/fixtures/*.json
      
    signals:
      emits:
        - TESTS_COMPLETE
        - TEST_STANDARDS
      consumes:
        - MODELS_DEFINED
        - MODULES_READY
        - SCRIPTS_READY
        
    dependencies:
      - architect
      - backend
      - sre
      
    prompts:
      system: |
        Du bist der QA Engineer für CargoBit.
        Deine Aufgabe ist es, umfassende Tests zu schreiben.
        
        Test-Standards:
        - Vitest Framework
        - AAA Pattern (Arrange, Act, Assert)
        - Mindestens 80% Coverage
        - Mock externe Dependencies
        
      task_template: |
        Schreibe Tests für {module_name}.
        
        Zu testende Funktionen:
        {functions}
        
        Testfälle:
        {test_cases}

  # ---------- COMPLIANCE AGENT ----------
  - id: "compliance"
    name: "Compliance Officer"
    role: "documentation"
    
    capabilities:
      - security_policy_writing
      - compliance_documentation
      - incident_playbook_creation
      - sla_definition
      
    max_concurrent_tasks: 1
    
    inputs:
      - architecture_overview
      - security_implementations
      - backup_specifications
      - test_standards
      
    outputs:
      - docs/security-policy.md
      - docs/compliance-readiness.md
      - docs/slas.md
      - docs/incident-playbook-payment-outage.md
      - docs/on-call-runbook.md
      - docs/operational-readiness-checklist.md
      
    signals:
      emits:
        - COMPLIANCE_COMPLETE
      consumes:
        - ARCHITECTURE_DOC
        - SECURITY_SPECS
        - BACKUP_SPECS
        - TEST_STANDARDS
        
    dependencies:
      - architect

# ==================== WORKFLOW ====================

workflow:
  name: "cargobit-generation-pipeline"
  
  phases:
    - id: "phase-1-initialization"
      name: "Initialization"
      parallel: false
      tasks:
        - agent: "compliance"
          task: "emit_requirements"
          outputs: ["COMPLIANCE_REQUIREMENTS"]
          
    - id: "phase-2-core"
      name: "Core Development"
      parallel: true
      tasks:
        - agent: "architect"
          task: "create_schema"
          outputs: ["SCHEMA_READY", "MODELS_DEFINED"]
        - agent: "compliance"
          task: "create_architecture_docs"
          wait_for: []
          
    - id: "phase-3-implementation"
      name: "Implementation"
      parallel: true
      tasks:
        - agent: "backend"
          task: "implement_modules"
          wait_for: ["SCHEMA_READY"]
        - agent: "compliance"
          task: "create_policies"
          wait_for: ["ARCHITECTURE_DOC"]
          
    - id: "phase-4-operations"
      name: "Operations Setup"
      parallel: false
      tasks:
        - agent: "sre"
          task: "create_scripts"
          wait_for: ["SCHEMA_READY", "AUDIT_SERVICE_READY"]
          
    - id: "phase-5-testing"
      name: "Testing"
      parallel: true
      tasks:
        - agent: "qa"
          task: "create_tests"
          wait_for: ["MODULES_READY", "SCRIPTS_READY"]
          
    - id: "phase-6-finalization"
      name: "Finalization"
      parallel: false
      tasks:
        - agent: "compliance"
          task: "finalize_documentation"
          wait_for: ["TESTS_COMPLETE"]
          
  completion:
    require_all_phases: true
    validate_outputs: true
    generate_summary: true

# ==================== OUTPUT CONFIGURATION ====================

output:
  base_directory: "./cargobit-payment-system"
  
  file_naming:
    format: "exact"                 # exact | timestamped | versioned
    encoding: "utf-8"
    
  validation:
    enabled: true
    checks:
      - syntax_check
      - type_check
      - lint_check
      
  artifacts:
    - type: "code"
      extensions: [".ts", ".js", ".prisma"]
    - type: "sql"
      extensions: [".sql"]
    - type: "script"
      extensions: [".sh", ".yaml", ".yml"]
    - type: "documentation"
      extensions: [".md"]
    - type: "config"
      extensions: [".json", ".yaml", ".yml"]

# ==================== MONITORING ====================

monitoring:
  enabled: true
  
  metrics:
    - name: "tasks_completed_total"
      type: "counter"
      labels: ["agent", "status"]
    - name: "task_duration_seconds"
      type: "histogram"
      labels: ["agent", "task_type"]
    - name: "agent_errors_total"
      type: "counter"
      labels: ["agent", "error_type"]
      
  logging:
    level: "info"
    format: "json"
    output: "stdout"
    
  tracing:
    enabled: true
    sample_rate: 1.0

# ==================== ERROR HANDLING ====================

error_handling:
  retry_policy:
    max_attempts: 3
    backoff:
      type: "exponential"
      initial_ms: 1000
      max_ms: 30000
      
  fallback:
    enabled: true
    strategy: "skip_and_continue"   # skip_and_continue | halt | escalate
    
  dead_letter_queue:
    enabled: true
    max_age_ms: 604800000           # 7 Tage
```

---

## orchestrator-runner.ts

```typescript
// orchestrator-runner.ts
// Hauptklasse für den Multi-Agent Orchestrator

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// ==================== TYPES ====================

interface Agent {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  maxConcurrentTasks: number;
  inputs: string[];
  outputs: string[];
  signals: {
    emits: string[];
    consumes: string[];
  };
  dependencies: string[];
  prompts: {
    system: string;
    task_template: string;
  };
}

interface Task {
  id: string;
  agentId: string;
  phaseId: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputs: Record<string, any>;
  outputs: string[];
  retryCount: number;
  startedAt?: Date;
  completedAt?: Date;
}

interface WorkflowPhase {
  id: string;
  name: string;
  parallel: boolean;
  tasks: TaskDefinition[];
}

interface TaskDefinition {
  agent: string;
  task: string;
  outputs?: string[];
  wait_for?: string[];
}

interface OrchestratorConfig {
  version: string;
  project: string;
  orchestrator: {
    id: string;
    name: string;
    runtime: {
      max_concurrent_tasks: number;
      task_timeout_ms: number;
      retry_attempts: number;
      retry_backoff_ms: number;
    };
  };
  agents: Agent[];
  workflow: {
    name: string;
    phases: WorkflowPhase[];
  };
  output: {
    base_directory: string;
  };
}

// ==================== ORCHESTRATOR CLASS ====================

export class MultiAgentOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private redis: Redis;
  private agents: Map<string, Agent>;
  private tasks: Map<string, Task>;
  private state: Map<string, any>;
  private outputDir: string;

  constructor(configPath: string) {
    super();
    this.agents = new Map();
    this.tasks = new Map();
    this.state = new Map();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Multi-Agent Orchestrator...');

    // Load configuration
    const configContent = await readFile(this.configPath, 'utf-8');
    this.config = JSON.parse(configContent);

    // Initialize Redis
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    // Register agents
    for (const agent of this.config.agents) {
      this.agents.set(agent.id, agent);
      console.log(`  ✓ Agent registered: ${agent.name}`);
    }

    // Create output directory
    this.outputDir = this.config.output.base_directory;
    await mkdir(this.outputDir, { recursive: true });

    // Restore state from previous run
    await this.restoreState();

    console.log('✅ Orchestrator initialized');
  }

  async run(): Promise<void> {
    console.log('\n========== STARTING WORKFLOW ==========');
    console.log(`Project: ${this.config.project}`);
    console.log(`Workflow: ${this.config.workflow.name}`);
    console.log('========================================\n');

    const phases = this.config.workflow.phases;

    for (const phase of phases) {
      console.log(`\n📍 Phase: ${phase.name}`);
      console.log('----------------------------------------');

      if (phase.parallel) {
        await this.runPhaseParallel(phase);
      } else {
        await this.runPhaseSequential(phase);
      }
    }

    console.log('\n========== WORKFLOW COMPLETE ==========');
    await this.generateSummary();
  }

  private async runPhaseParallel(phase: WorkflowPhase): Promise<void> {
    const taskPromises = phase.tasks.map(taskDef => this.executeTask(taskDef, phase.id));
    await Promise.all(taskPromises);
  }

  private async runPhaseSequential(phase: WorkflowPhase): Promise<void> {
    for (const taskDef of phase.tasks) {
      await this.executeTask(taskDef, phase.id);
    }
  }

  private async executeTask(taskDef: TaskDefinition, phaseId: string): Promise<void> {
    const agent = this.agents.get(taskDef.agent);
    if (!agent) {
      throw new Error(`Agent not found: ${taskDef.agent}`);
    }

    // Check dependencies
    if (taskDef.wait_for && taskDef.wait_for.length > 0) {
      console.log(`  ⏳ Waiting for signals: ${taskDef.wait_for.join(', ')}`);
      await this.waitForSignals(taskDef.wait_for);
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const task: Task = {
      id: taskId,
      agentId: agent.id,
      phaseId,
      description: taskDef.task,
      status: 'pending',
      inputs: this.gatherInputs(agent),
      outputs: [],
      retryCount: 0,
    };

    this.tasks.set(taskId, task);

    console.log(`  🤖 [${agent.name}] Starting: ${taskDef.task}`);

    task.status = 'running';
    task.startedAt = new Date();
    this.emit('task:start', task);

    try {
      // Generate prompt for agent
      const prompt = this.buildPrompt(agent, task);
      
      // Execute agent (in real implementation, this would call AI API)
      const outputs = await this.callAgent(agent, prompt);
      
      // Save outputs
      for (const output of outputs) {
        await this.saveOutput(output.path, output.content);
        task.outputs.push(output.path);
      }

      task.status = 'completed';
      task.completedAt = new Date();
      
      // Emit completion signals
      for (const signal of agent.signals.emits) {
        await this.emitSignal(signal, task);
      }

      this.emit('task:complete', task);
      console.log(`  ✅ [${agent.name}] Completed: ${taskDef.task}`);

    } catch (error) {
      task.status = 'failed';
      this.emit('task:error', { task, error });
      console.error(`  ❌ [${agent.name}] Failed: ${error}`);
      
      // Retry logic
      if (task.retryCount < this.config.orchestrator.runtime.retry_attempts) {
        task.retryCount++;
        console.log(`  🔄 Retrying (${task.retryCount}/${this.config.orchestrator.runtime.retry_attempts})...`);
        await this.sleep(this.config.orchestrator.runtime.retry_backoff_ms * task.retryCount);
        return this.executeTask(taskDef, phaseId);
      }
    }

    // Save state
    await this.saveState();
  }

  private buildPrompt(agent: Agent, task: Task): string {
    return `${agent.prompts.system}

TASK: ${task.description}

INPUTS:
${JSON.stringify(task.inputs, null, 2)}

OUTPUT FILES:
${agent.outputs.join('\n')}
`;
  }

  private async callAgent(agent: Agent, prompt: string): Promise<Array<{ path: string; content: string }>> {
    // In real implementation, this would call:
    // - OpenAI API
    // - Anthropic API
    // - Local LLM
    // - Or delegate to actual agent process
    
    console.log(`  📤 Sending prompt to ${agent.name}...`);
    
    // Simulated response for now
    // Real implementation would parse AI response and extract files
    return agent.outputs.map(path => ({
      path,
      content: `// Generated by ${agent.name}\n// TODO: Implement`,
    }));
  }

  private async saveOutput(path: string, content: string): Promise<void> {
    const fullPath = join(this.outputDir, path);
    await mkdir(join(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
    console.log(`    📄 Created: ${path}`);
  }

  private gatherInputs(agent: Agent): Record<string, any> {
    const inputs: Record<string, any> = {};
    
    for (const input of agent.inputs) {
      inputs[input] = this.state.get(input) || null;
    }
    
    return inputs;
  }

  private async waitForSignals(signals: string[]): Promise<void> {
    for (const signal of signals) {
      while (!this.state.has(signal)) {
        await this.sleep(100);
      }
    }
  }

  private async emitSignal(signal: string, task: Task): Promise<void> {
    this.state.set(signal, {
      taskId: task.id,
      agentId: task.agentId,
      timestamp: new Date().toISOString(),
    });
    
    await this.redis.publish('cargobit:signals', JSON.stringify({
      signal,
      task: task.id,
    }));
    
    console.log(`    📡 Signal emitted: ${signal}`);
  }

  private async saveState(): Promise<void> {
    const stateObj = Object.fromEntries(this.state);
    await this.redis.set('cargobit:state:current', JSON.stringify(stateObj));
  }

  private async restoreState(): Promise<void> {
    const stateJson = await this.redis.get('cargobit:state:current');
    if (stateJson) {
      const stateObj = JSON.parse(stateJson);
      for (const [key, value] of Object.entries(stateObj)) {
        this.state.set(key, value);
      }
      console.log('  ✓ State restored from previous run');
    }
  }

  private async generateSummary(): Promise<void> {
    const summary = {
      project: this.config.project,
      completedAt: new Date().toISOString(),
      totalTasks: this.tasks.size,
      completedTasks: Array.from(this.tasks.values()).filter(t => t.status === 'completed').length,
      failedTasks: Array.from(this.tasks.values()).filter(t => t.status === 'failed').length,
      outputs: Array.from(this.tasks.values()).flatMap(t => t.outputs),
    };

    await writeFile(
      join(this.outputDir, 'generation-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('\n📊 Generation Summary:');
    console.log(`   Total Tasks: ${summary.totalTasks}`);
    console.log(`   Completed: ${summary.completedTasks}`);
    console.log(`   Failed: ${summary.failedTasks}`);
    console.log(`   Output Files: ${summary.outputs.length}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== MAIN ====================

async function main() {
  const orchestrator = new MultiAgentOrchestrator('./orchestrator-config.yaml');
  
  orchestrator.on('task:start', (task) => {
    console.log(`   [EVENT] Task started: ${task.id}`);
  });
  
  orchestrator.on('task:complete', (task) => {
    console.log(`   [EVENT] Task completed: ${task.id}`);
  });
  
  orchestrator.on('task:error', ({ task, error }) => {
    console.error(`   [EVENT] Task error: ${task.id}`, error);
  });
  
  await orchestrator.initialize();
  await orchestrator.run();
}

main().catch(console.error);
```

---

## Docker Compose für Orchestrator

```yaml
# docker-compose.orchestrator.yml
version: '3.8'

services:
  orchestrator:
    build:
      context: .
      dockerfile: Dockerfile.orchestrator
    environment:
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
    volumes:
      - ./orchestrator-config.yaml:/app/config.yaml:ro
      - ./cargobit-payment-system:/app/output
    depends_on:
      - redis
    command: npm run start

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  # Optional: Monitoring
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

volumes:
  redis_data:
```

---

## Ausführung

```bash
# 1. Konfiguration laden
cp orchestrator-config.yaml.example orchestrator-config.yaml

# 2. Environment setzen
export REDIS_URL="redis://localhost:6379"
export OPENAI_API_KEY="sk-..."

# 3. Orchestrator starten
docker-compose -f docker-compose.orchestrator.yml up -d

# 4. Logs verfolgen
docker-compose -f docker-compose.orchestrator.yml logs -f orchestrator

# 5. Outputs prüfen
ls -la cargobit-payment-system/
```

---

*Diese Orchestrator-Konfiguration ermöglicht vollautomatische Code-Generierung mit Multi-Agent-Systemen.*
