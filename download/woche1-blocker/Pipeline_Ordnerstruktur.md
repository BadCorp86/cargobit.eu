# 📁 Pipeline-Ordnerstruktur

## Vollständige Verzeichnisstruktur

```
cargobit-payment-system/
│
├── .github/
│   ├── workflows/
│   │   ├── generate.yml                    # GitHub Actions Pipeline
│   │   ├── validate.yml                    # Validierungs-Workflow
│   │   └── test.yml                        # Test-Workflow
│   ├── copilot-instructions.md             # GitHub Copilot Context
│   └── CODEOWNERS                          # Code Ownership
│
├── .vscode/
│   ├── settings.json                       # VS Code Settings
│   ├── extensions.json                     # Empfohlene Extensions
│   └── launch.json                         # Debug Konfiguration
│
├── prisma/
│   ├── schema.prisma                       # Prisma Schema
│   ├── migrations/
│   │   └── .gitkeep
│   └── seed.ts                             # Seed Data Script
│
├── migrations/
│   ├── 0001_init.sql                       # Initiale Schema-Migration
│   ├── 0002_indexes.sql                    # Performance-Indexe
│   └── rollback/
│       ├── 0001_rollback.sql
│       └── 0002_rollback.sql
│
├── src/
│   ├── lib/
│   │   ├── prisma.ts                       # Prisma Client Singleton
│   │   ├── redis.ts                        # Redis Client
│   │   ├── rateLimit.ts                    # Rate Limiting Module
│   │   ├── logger.ts                       # Logging Utility
│   │   └── config.ts                       # Configuration
│   │
│   ├── middleware/
│   │   ├── rateLimit.ts                    # Rate Limit Middleware
│   │   ├── auth.ts                         # Authentication Middleware
│   │   └── errorHandler.ts                 # Error Handler
│   │
│   ├── webhooks/
│   │   ├── stripe.ts                       # Stripe Webhook Handler
│   │   └── index.ts                        # Webhook Router
│   │
│   ├── services/
│   │   ├── stripeEvents.ts                 # Stripe Event Processing
│   │   ├── auditLog.ts                     # Audit Log Service
│   │   ├── payment.ts                      # Payment Service
│   │   ├── wallet.ts                       # Wallet Service
│   │   └── user.ts                         # User Service
│   │
│   ├── jobs/
│   │   ├── auditVerify.ts                  # Audit Chain Verification
│   │   ├── cleanup.ts                      # Cleanup Job
│   │   └── index.ts                        # Job Scheduler
│   │
│   ├── scripts/
│   │   ├── export-sqlite-data.ts           # SQLite Export
│   │   └── import-postgres-data.ts         # PostgreSQL Import
│   │
│   ├── types/
│   │   ├── index.ts                        # Type Exports
│   │   └── global.d.ts                     # Global Type Definitions
│   │
│   └── index.ts                            # App Entry Point
│
├── ops/
│   ├── backup-db.sh                        # Backup Script
│   ├── restore-db.sh                       # Restore Script
│   ├── cron-backup.yaml                    # Kubernetes CronJob
│   ├── export-audit-log.ts                 # Audit Export Script
│   ├── docker-compose.yml                  # Docker Compose
│   └── Dockerfile                          # Container Build
│
├── tests/
│   ├── unit/
│   │   ├── rateLimit.test.ts               # Rate Limit Unit Tests
│   │   ├── auditLog.test.ts                # Audit Log Unit Tests
│   │   └── stripeWebhook.test.ts           # Webhook Unit Tests
│   │
│   ├── integration/
│   │   ├── payment.flow.test.ts            # Payment Flow Tests
│   │   └── webhook.e2e.test.ts             # Webhook E2E Tests
│   │
│   ├── fixtures/
│   │   ├── stripeEvents.json               # Stripe Event Fixtures
│   │   ├── users.json                      # User Test Data
│   │   └── payments.json                   # Payment Test Data
│   │
│   ├── mocks/
│   │   ├── redis.mock.ts                   # Redis Mock
│   │   ├── prisma.mock.ts                  # Prisma Mock
│   │   └── stripe.mock.ts                  # Stripe Mock
│   │
│   └── setup.ts                            # Test Setup
│
├── docs/
│   ├── architecture/
│   │   ├── overview.md                     # Architecture Overview
│   │   ├── database.md                     # Database Design
│   │   └── security.md                     # Security Architecture
│   │
│   ├── policies/
│   │   ├── security-policy.md              # Security Policy
│   │   ├── backup-policy.md                # Backup Policy
│   │   ├── audit-log-policy.md             # Audit Policy
│   │   └── rate-limit-policy.md            # Rate Limit Policy
│   │
│   ├── playbooks/
│   │   ├── incident-payment-outage.md      # Incident Playbook
│   │   ├── restore-playbook.md             # Restore Playbook
│   │   └── on-call-runbook.md              # On-Call Runbook
│   │
│   ├── compliance/
│   │   ├── compliance-readiness.md         # Compliance Checklist
│   │   ├── slas.md                         # SLA Definitions
│   │   └── operational-readiness-checklist.md
│   │
│   ├── api/
│   │   └── webhook-architecture.md         # Webhook Architecture
│   │
│   └── README.md                           # Documentation Index
│
├── scripts/
│   ├── generate-all.sh                     # Generate Everything
│   ├── validate.sh                         # Validate All
│   ├── setup.sh                            # Initial Setup
│   └── deploy.sh                           # Deployment Script
│
├── config/
│   ├── pipeline-config.json                # Pipeline Configuration
│   ├── rate-limits.json                    # Rate Limit Config
│   └── audit-config.json                   # Audit Config
│
├── .env.example                            # Environment Template
├── .gitignore                              # Git Ignore
├── .dockerignore                           # Docker Ignore
├── .eslintrc.js                            # ESLint Config
├── .prettierrc                             # Prettier Config
├── tsconfig.json                           # TypeScript Config
├── package.json                            # NPM Package
├── Makefile                                # Build Commands
└── README.md                               # Project README
```

---

## Datei-Inhaltsbeschreibungen

### Root-Level

| Datei | Zweck |
|-------|-------|
| `.env.example` | Environment-Variablen Template (keine Secrets!) |
| `tsconfig.json` | TypeScript strict mode Konfiguration |
| `package.json` | Dependencies, Scripts, Metadata |
| `Makefile` | Build, Test, Deploy Commands |
| `README.md` | Projekt-Dokumentation |

### `.github/workflows/`

| Datei | Trigger | Zweck |
|-------|---------|-------|
| `generate.yml` | workflow_dispatch | Code-Generierung |
| `validate.yml` | push, pull_request | Validierung |
| `test.yml` | push, pull_request | Test-Ausführung |

### `prisma/`

| Datei | Zeilen | Zweck |
|-------|--------|-------|
| `schema.prisma` | ~300 | Datenmodell-Definition |
| `seed.ts` | ~50 | Test-Daten Seeding |

### `migrations/`

| Datei | Zeilen | Zweck |
|-------|--------|-------|
| `0001_init.sql` | ~500 | Initiales Schema |
| `0002_indexes.sql` | ~100 | Performance-Indexe |

### `src/lib/`

| Datei | Zeilen | Export |
|-------|--------|--------|
| `prisma.ts` | ~20 | PrismaClient Singleton |
| `redis.ts` | ~30 | Redis Client Factory |
| `rateLimit.ts` | ~200 | TokenBucketRateLimiter, SlidingWindowRateLimiter |
| `logger.ts` | ~50 | Winston Logger |
| `config.ts` | ~40 | Environment Config |

### `src/middleware/`

| Datei | Zeilen | Export |
|-------|--------|--------|
| `rateLimit.ts` | ~80 | rateLimitMiddleware, globalRateLimit, authRateLimit |
| `auth.ts` | ~60 | authMiddleware, requireRole |
| `errorHandler.ts` | ~40 | errorHandler |

### `src/webhooks/`

| Datei | Zeilen | Export |
|-------|--------|--------|
| `stripe.ts` | ~250 | stripeWebhookHandler |
| `index.ts` | ~30 | Webhook Router |

### `src/services/`

| Datei | Zeilen | Export |
|-------|--------|--------|
| `stripeEvents.ts` | ~150 | processStripeEvent, routeEvent |
| `auditLog.ts` | ~200 | writeAuditLog, verifyAuditChain, exportAuditLogs |
| `payment.ts` | ~100 | createPayment, processPayment |
| `wallet.ts` | ~80 | getWallet, updateBalance |

### `src/jobs/`

| Datei | Zeilen | Export |
|-------|--------|--------|
| `auditVerify.ts` | ~100 | runAuditVerification |
| `cleanup.ts` | ~60 | runCleanup |
| `index.ts` | ~40 | startScheduler |

### `ops/`

| Datei | Zeilen | Typ |
|-------|--------|-----|
| `backup-db.sh` | ~150 | Bash Script |
| `restore-db.sh` | ~100 | Bash Script |
| `cron-backup.yaml` | ~80 | Kubernetes YAML |
| `export-audit-log.ts` | ~60 | TypeScript Script |
| `docker-compose.yml` | ~60 | Docker Compose |
| `Dockerfile` | ~30 | Docker Image |

### `tests/`

| Verzeichnis | Dateien | Zweck |
|-------------|---------|------|
| `unit/` | 3 | Isolierte Unit Tests |
| `integration/` | 2 | Integrations-Tests |
| `fixtures/` | 3 | Test-Daten |
| `mocks/` | 3 | Mock-Implementierungen |

### `docs/`

| Verzeichnis | Dateien | Zweck |
|-------------|---------|------|
| `architecture/` | 3 | Architektur-Dokumentation |
| `policies/` | 4 | Policy-Dokumente |
| `playbooks/` | 3 | Operative Playbooks |
| `compliance/` | 3 | Compliance-Dokumente |
| `api/` | 1 | API-Dokumentation |

---

## Größe-Schätzungen

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROJECT SIZE ESTIMATION                       │
├─────────────────────┬───────────────┬───────────────────────────┤
│ Verzeichnis         │ Dateien       │ Geschätzte Zeilen         │
├─────────────────────┼───────────────┼───────────────────────────┤
│ prisma/             │ 2             │ ~320                      │
├─────────────────────┼───────────────┼───────────────────────────┤
│ migrations/         │ 2             │ ~600                      │
├─────────────────────┼───────────────┼───────────────────────────┤
│ src/lib/            │ 5             │ ~340                      │
├─────────────────────┼───────────────┼───────────────────────────┤
│ src/middleware/     │ 3             │ ~180                      │
├─────────────────────┼───────────────┼───────────────────────────┤
│ src/webhooks/       │ 2             │ ~280                      │
├─────────────────────┼───────────────┼───────────────────────────┤
│ src/services/       │ 5             │ ~630                      │
├─────────────────────┼───────────────┼───────────────────────────┤
│ src/jobs/           │ 3             │ ~200                      │
├─────────────────────┼───────────────┼───────────────────────────┤
│ src/scripts/        │ 2             │ ~150                      │
├─────────────────────┼───────────────┼───────────────────────────┤
│ ops/                │ 6             │ ~480                      │
├─────────────────────┼───────────────┼───────────────────────────┤
│ tests/              │ 12            │ ~800                      │
├─────────────────────┼───────────────┼───────────────────────────┤
│ docs/               │ 14            │ ~2000                     │
├─────────────────────┼───────────────┼───────────────────────────┤
│ config/             │ 3             │ ~100                      │
├─────────────────────┼───────────────┼───────────────────────────┤
│ .github/            │ 4             │ ~200                      │
├─────────────────────┼───────────────┼───────────────────────────┤
│ TOTAL               │ ~63           │ ~6,280                    │
└─────────────────────┴───────────────┴───────────────────────────┘
```

---

## Initialisierungs-Script

```bash
#!/bin/bash
# scripts/setup.sh
# Erstellt die vollständige Verzeichnisstruktur

set -e

PROJECT_ROOT="cargobit-payment-system"

echo "📁 Erstelle Projektstruktur..."

# Root
mkdir -p "$PROJECT_ROOT"

# GitHub
mkdir -p "$PROJECT_ROOT/.github/workflows"

# VS Code
mkdir -p "$PROJECT_ROOT/.vscode"

# Prisma
mkdir -p "$PROJECT_ROOT/prisma/migrations"

# Migrations
mkdir -p "$PROJECT_ROOT/migrations/rollback"

# Source
mkdir -p "$PROJECT_ROOT/src"/{lib,middleware,webhooks,services,jobs,scripts,types}

# Ops
mkdir -p "$PROJECT_ROOT/ops"

# Tests
mkdir -p "$PROJECT_ROOT/tests"/{unit,integration,fixtures,mocks}

# Docs
mkdir -p "$PROJECT_ROOT/docs"/{architecture,policies,playbooks,compliance,api}

# Config
mkdir -p "$PROJECT_ROOT/config"

# Scripts
mkdir -p "$PROJECT_ROOT/scripts"

# Root Files
touch "$PROJECT_ROOT"/{.env.example,.gitignore,.dockerignore,.eslintrc.js,.prettierrc,tsconfig.json,package.json,Makefile,README.md}

echo "✅ Projektstruktur erstellt: $PROJECT_ROOT"
echo ""
echo "Nächste Schritte:"
echo "  1. cd $PROJECT_ROOT"
echo "  2. npm init -y"
echo "  3. npm install typescript @types/node prisma ioredis express stripe"
echo "  4. npm install -D vitest eslint prettier"
```

---

## .gitignore

```gitignore
# Dependencies
node_modules/

# Build
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# Test
coverage/
.nyc_output/

# Prisma
prisma/migrations/*_*/

# Temporary
tmp/
temp/
*.tmp
```

---

## package.json Template

```json
{
  "name": "cargobit-payment-system",
  "version": "1.0.0",
  "description": "Payment Platform for Logistics",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src tests --ext .ts",
    "format": "prettier --write \"**/*.{ts,js,json,md}\"",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "validate": "npm run lint && npm run test",
    "generate": "./scripts/generate-all.sh"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "express": "^4.18.0",
    "ioredis": "^5.3.0",
    "stripe": "^14.0.0",
    "uuid": "^9.0.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/uuid": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "prisma": "^5.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

---

## tsconfig.json Template

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

*Diese Ordnerstruktur ist vollständig und produktionsbereit.*
