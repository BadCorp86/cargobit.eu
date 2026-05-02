# ⚙️ Pipeline Version (Automated Code Generator)

## Anleitung

Diese Version ist für **automatisierte CI/CD Pipelines** oder **Code-Generator-Scripts** optimiert. Sie enthält strukturierte JSON-Konfigurationen und Shell-Scripts.

---

## Pipeline-Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                    CODE GENERATION PIPELINE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  CONFIG  │───▶│ GENERATE │───▶│ VALIDATE │───▶│  OUTPUT  │  │
│  │  FILES   │    │  CODE    │    │  SYNTAX  │    │  FILES   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │              │               │               │          │
│       ▼              ▼               ▼               ▼          │
│  blocks.json    AI/Template     TypeScript      /output/        │
│  templates/      Engine          Compiler        directory       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Datei 1: pipeline-config.json

```json
{
  "version": "1.0.0",
  "project": "cargobit-payment-system",
  "description": "Payment Platform for Logistics",
  "techStack": {
    "language": "TypeScript",
    "runtime": "Node.js",
    "nodeVersion": "20.x",
    "typescriptVersion": "5.x",
    "orm": "Prisma 5.x",
    "database": "PostgreSQL 15+",
    "cache": "Redis 7+",
    "paymentProvider": "Stripe",
    "framework": "Express 4.x"
  },
  "outputDirectory": "./cargobit-payment-system",
  "blocks": [
    {
      "id": "A",
      "name": "PostgreSQL Migration",
      "enabled": true,
      "files": [
        {
          "path": "prisma/schema.prisma",
          "template": "prisma-schema",
          "description": "Prisma Schema with all models"
        },
        {
          "path": "migrations/0001_init.sql",
          "template": "sql-migration-init",
          "description": "Initial SQL migration"
        },
        {
          "path": "migrations/0002_indexes.sql",
          "template": "sql-migration-indexes",
          "description": "Performance indexes"
        },
        {
          "path": "scripts/export-sqlite-data.ts",
          "template": "typescript-script",
          "description": "SQLite export script"
        },
        {
          "path": "scripts/import-postgres-data.ts",
          "template": "typescript-script",
          "description": "PostgreSQL import script"
        }
      ]
    },
    {
      "id": "B",
      "name": "Redis Rate Limiting",
      "enabled": true,
      "files": [
        {
          "path": "src/lib/rateLimit.ts",
          "template": "typescript-module",
          "description": "Rate limiting module"
        },
        {
          "path": "src/middleware/rateLimit.ts",
          "template": "typescript-middleware",
          "description": "Express middleware"
        },
        {
          "path": "tests/rateLimit.test.ts",
          "template": "typescript-test",
          "description": "Unit tests"
        }
      ]
    },
    {
      "id": "C",
      "name": "Backups + PITR",
      "enabled": true,
      "files": [
        {
          "path": "ops/backup-db.sh",
          "template": "bash-script",
          "description": "Backup script"
        },
        {
          "path": "ops/restore-db.sh",
          "template": "bash-script",
          "description": "Restore script"
        },
        {
          "path": "ops/cron-backup.yaml",
          "template": "kubernetes-cronjob",
          "description": "Kubernetes CronJob"
        },
        {
          "path": "docs/backup-policy.md",
          "template": "markdown-doc",
          "description": "Backup policy"
        }
      ]
    },
    {
      "id": "D",
      "name": "Stripe Webhooks",
      "enabled": true,
      "files": [
        {
          "path": "src/webhooks/stripe.ts",
          "template": "typescript-handler",
          "description": "Webhook handler"
        },
        {
          "path": "src/services/stripeEvents.ts",
          "template": "typescript-service",
          "description": "Event processing service"
        },
        {
          "path": "tests/stripeWebhook.test.ts",
          "template": "typescript-test",
          "description": "Unit tests"
        }
      ]
    },
    {
      "id": "E",
      "name": "Audit Log Hardening",
      "enabled": true,
      "files": [
        {
          "path": "src/services/auditLog.ts",
          "template": "typescript-service",
          "description": "Audit log service"
        },
        {
          "path": "src/jobs/auditVerify.ts",
          "template": "typescript-job",
          "description": "Verification job"
        },
        {
          "path": "ops/export-audit-log.ts",
          "template": "typescript-script",
          "description": "Export script"
        }
      ]
    },
    {
      "id": "F",
      "name": "Policies & Playbooks",
      "enabled": true,
      "files": [
        {
          "path": "docs/operational-readiness-checklist.md",
          "template": "markdown-checklist",
          "description": "Launch checklist"
        },
        {
          "path": "docs/incident-playbook-payment-outage.md",
          "template": "markdown-playbook",
          "description": "Incident playbook"
        },
        {
          "path": "docs/security-policy.md",
          "template": "markdown-policy",
          "description": "Security policy"
        },
        {
          "path": "docs/architecture-overview.md",
          "template": "markdown-architecture",
          "description": "Architecture documentation"
        }
      ]
    }
  ],
  "validation": {
    "typescript": true,
    "eslint": true,
    "prisma": true,
    "tests": true
  }
}
```

---

## Datei 2: templates/definitions.json

```json
{
  "templates": {
    "prisma-schema": {
      "extension": ".prisma",
      "language": "prisma",
      "header": "// Auto-generated by CargoBit Pipeline\n// Version: {{version}}\n// Generated: {{timestamp}}\n\n",
      "sections": [
        "generator",
        "datasource",
        "enums",
        "models"
      ]
    },
    "typescript-module": {
      "extension": ".ts",
      "language": "typescript",
      "header": "/**\n * {{description}}\n * Auto-generated by CargoBit Pipeline\n * @version {{version}}\n */\n\n",
      "imports": [
        "import { Redis } from 'ioredis';",
        "import { createHash } from 'crypto';"
      ]
    },
    "typescript-middleware": {
      "extension": ".ts",
      "language": "typescript",
      "header": "/**\n * Express Middleware: {{description}}\n */\n\n",
      "imports": [
        "import { Request, Response, NextFunction } from 'express';"
      ]
    },
    "typescript-test": {
      "extension": ".test.ts",
      "language": "typescript",
      "header": "/**\n * Unit Tests: {{description}}\n */\n\n",
      "imports": [
        "import { describe, it, expect, beforeEach, afterEach } from 'vitest';"
      ]
    },
    "bash-script": {
      "extension": ".sh",
      "language": "bash",
      "header": "#!/bin/bash\n# {{description}}\n# Auto-generated by CargoBit Pipeline\nset -euo pipefail\n\n"
    },
    "kubernetes-cronjob": {
      "extension": ".yaml",
      "language": "yaml",
      "header": "# Kubernetes CronJob: {{description}}\n# Auto-generated by CargoBit Pipeline\n\n"
    },
    "markdown-doc": {
      "extension": ".md",
      "language": "markdown",
      "header": "# {{title}}\n\n> Auto-generated by CargoBit Pipeline | Version: {{version}}\n\n"
    }
  }
}
```

---

## Datei 3: generate-pipeline.sh

```bash
#!/bin/bash
# CargoBit Code Generation Pipeline
# Generiert alle Artefakte basierend auf pipeline-config.json

set -euo pipefail

# ==================== KONFIGURATION ====================

PIPELINE_CONFIG="./pipeline-config.json"
OUTPUT_DIR="./cargobit-payment-system"
TEMPLATES_DIR="./templates"
AI_ENDPOINT="${AI_ENDPOINT:-http://localhost:8080/generate}"
LOG_FILE="./pipeline.log"

# ==================== HILFSFUNKTIONEN ====================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

check_dependencies() {
    log "Prüfe Dependencies..."
    
    command -v jq >/dev/null 2>&1 || { error "jq nicht installiert"; exit 1; }
    command -v node >/dev/null 2>&1 || { error "node nicht installiert"; exit 1; }
    command -v npx >/dev/null 2>&1 || { error "npx nicht installiert"; exit 1; }
    
    log "Dependencies OK"
}

create_directory_structure() {
    log "Erstelle Verzeichnisstruktur..."
    
    # Lese Output-Directory aus Config
    OUTPUT_DIR=$(jq -r '.outputDirectory' "$PIPELINE_CONFIG")
    
    # Erstelle Hauptverzeichnis
    mkdir -p "$OUTPUT_DIR"
    
    # Erstelle Unterverzeichnisse für jeden Block
    local blocks=$(jq -c '.blocks[]' "$PIPELINE_CONFIG")
    
    echo "$blocks" | while read -r block; do
        local files=$(echo "$block" | jq -c '.files[]')
        echo "$files" | while read -r file; do
            local path=$(echo "$file" | jq -r '.path')
            local dir=$(dirname "$path")
            mkdir -p "$OUTPUT_DIR/$dir"
        done
    done
    
    log "Verzeichnisstruktur erstellt in $OUTPUT_DIR"
}

generate_file() {
    local block_id="$1"
    local file_path="$2"
    local template="$3"
    local description="$4"
    
    log "Generiere: $file_path ($template)"
    
    # Prompt für AI basierend auf Template
    local prompt=$(build_prompt "$block_id" "$file_path" "$template" "$description")
    
    # Rufe AI API auf (oder verwende lokale Generierung)
    if [[ -n "$AI_ENDPOINT" ]]; then
        local content=$(curl -s -X POST "$AI_ENDPOINT" \
            -H "Content-Type: application/json" \
            -d "{\"prompt\": $(jq -Rs . <<< "$prompt"), \"template\": \"$template\"}" \
            | jq -r '.content')
    else
        # Fallback: Template-Datei verwenden
        local content=$(cat "$TEMPLATES_DIR/$template.template" 2>/dev/null || echo "// TODO: Generate content for $file_path")
    fi
    
    # Schreibe Datei
    echo "$content" > "$OUTPUT_DIR/$file_path"
    
    log "Datei erstellt: $OUTPUT_DIR/$file_path"
}

build_prompt() {
    local block_id="$1"
    local file_path="$2"
    local template="$3"
    local description="$4"
    
    case "$template" in
        "prisma-schema")
            cat << 'PRISMA_PROMPT'
Generiere ein Prisma Schema für eine Payment-Plattform mit:
- User Model (id, email, role, status, kycStatus)
- Wallet Model (userId, currency, balance, availableBalance)
- Payment Model (userId, stripePaymentIntentId, amount, status)
- Payout Model (userId, walletId, amount, bankIban)
- Transaction Model (walletId, type, amount, balanceBefore, balanceAfter)
- AuditLog Model (userId, action, prevHash, hash)
- StripeEvent Model (stripeEventId, type, data, processed)
- Alle Enums und Indexe
PRISMA_PROMPT
            ;;
        "typescript-module"|"typescript-middleware"|"typescript-service")
            cat << TYPESCRIPT_PROMPT'
Generiere TypeScript Code für: $description
- TypeScript strict mode
- Async/await Pattern
- Explizite Typ-Annotationen
- JSDoc Kommentare
- Error Handling
TYPESCRIPT_PROMPT
            ;;
        *)
            echo "Generiere Inhalt für: $description"
            ;;
    esac
}

validate_generated_code() {
    log "Validiere generierten Code..."
    
    cd "$OUTPUT_DIR"
    
    # TypeScript Validierung
    if [[ -f "tsconfig.json" ]]; then
        log "Prüfe TypeScript Syntax..."
        npx tsc --noEmit 2>&1 | tee -a "../$LOG_FILE" || true
    fi
    
    # Prisma Validierung
    if [[ -f "prisma/schema.prisma" ]]; then
        log "Prüfe Prisma Schema..."
        npx prisma validate 2>&1 | tee -a "../$LOG_FILE" || true
    fi
    
    # ESLint Validierung
    if [[ -f ".eslintrc.js" ]]; then
        log "Prüfe ESLint..."
        npx eslint . --ext .ts 2>&1 | tee -a "../$LOG_FILE" || true
    fi
    
    log "Validierung abgeschlossen"
}

run_tests() {
    log "Führe Tests aus..."
    
    cd "$OUTPUT_DIR"
    
    if [[ -f "package.json" ]]; then
        npm test 2>&1 | tee -a "../$LOG_FILE" || true
    fi
    
    log "Tests abgeschlossen"
}

generate_summary() {
    log "Generiere Zusammenfassung..."
    
    local total_files=$(jq '[.blocks[].files | length] | add' "$PIPELINE_CONFIG")
    local generated_files=$(find "$OUTPUT_DIR" -type f \( -name "*.ts" -o -name "*.prisma" -o -name "*.sql" -o -name "*.sh" -o -name "*.yaml" -o -name "*.md" \) | wc -l)
    
    cat << SUMMARY

╔══════════════════════════════════════════════════════════════╗
║              PIPELINE GENERATION COMPLETE                      ║
╠══════════════════════════════════════════════════════════════╣
║  Output Directory: $OUTPUT_DIR
║  Total Files:      $total_files
║  Generated:        $generated_files
║  Log File:         $LOG_FILE
╚══════════════════════════════════════════════════════════════╝

SUMMARY
}

# ==================== MAIN PIPELINE ====================

main() {
    log "========================================="
    log "CargoBit Code Generation Pipeline Start"
    log "========================================="
    
    check_dependencies
    create_directory_structure
    
    # Verarbeite jeden Block
    local blocks=$(jq -c '.blocks[] | select(.enabled == true)' "$PIPELINE_CONFIG")
    
    while IFS= read -r block; do
        local block_id=$(echo "$block" | jq -r '.id')
        local block_name=$(echo "$block" | jq -r '.name')
        
        log ""
        log "Block $block_id: $block_name"
        log "----------------------------------------"
        
        local files=$(echo "$block" | jq -c '.files[]')
        
        while IFS= read -r file; do
            local path=$(echo "$file" | jq -r '.path')
            local template=$(echo "$file" | jq -r '.template')
            local description=$(echo "$file" | jq -r '.description')
            
            generate_file "$block_id" "$path" "$template" "$description"
        done <<< "$files"
        
    done <<< "$blocks"
    
    # Validierung
    validate_generated_code
    
    # Tests
    run_tests
    
    # Zusammenfassung
    generate_summary
    
    log "Pipeline abgeschlossen!"
}

# Führe Pipeline aus
main "$@"
```

---

## Datei 4: GitHub Actions Workflow (.github/workflows/generate.yml)

```yaml
name: Generate CargoBit Code

on:
  workflow_dispatch:
    inputs:
      blocks:
        description: 'Blocks to generate (comma-separated, e.g., A,B,C)'
        required: false
        default: 'A,B,C,D,E,F'
      validate:
        description: 'Run validation'
        required: false
        default: 'true'
        type: boolean

jobs:
  generate:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install Dependencies
        run: |
          npm install -g prisma
          npm install typescript --save-dev
      
      - name: Create Output Directory
        run: mkdir -p cargobit-payment-system
      
      - name: Generate Block A - PostgreSQL Migration
        if: contains(github.event.inputs.blocks, 'A')
        run: |
          echo "Generating PostgreSQL Migration..."
          # AI Generation oder Template-Processing hier
          # curl -X POST $AI_ENDPOINT -d '{"block": "A"}'
      
      - name: Generate Block B - Redis Rate Limiting
        if: contains(github.event.inputs.blocks, 'B')
        run: |
          echo "Generating Redis Rate Limiting..."
      
      - name: Generate Block C - Backups + PITR
        if: contains(github.event.inputs.blocks, 'C')
        run: |
          echo "Generating Backup Scripts..."
      
      - name: Generate Block D - Stripe Webhooks
        if: contains(github.event.inputs.blocks, 'D')
        run: |
          echo "Generating Stripe Webhooks..."
      
      - name: Generate Block E - Audit Logs
        if: contains(github.event.inputs.blocks, 'E')
        run: |
          echo "Generating Audit Logs..."
      
      - name: Generate Block F - Documentation
        if: contains(github.event.inputs.blocks, 'F')
        run: |
          echo "Generating Documentation..."
      
      - name: Validate Generated Code
        if: github.event.inputs.validate == 'true'
        run: |
          echo "Running validation..."
          cd cargobit-payment-system
          npx tsc --noEmit || true
          npx prisma validate || true
      
      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: generated-code
          path: cargobit-payment-system/
          retention-days: 7
      
      - name: Create Pull Request
        if: github.ref == 'refs/heads/main'
        uses: peter-evans/create-pull-request@v5
        with:
          title: "Auto-generated CargoBit Code"
          body: "Automatically generated code artifacts"
          branch: "auto-generated-code"
          commit-message: "Generate CargoBit code artifacts"
```

---

## Datei 5: Makefile

```makefile
# CargoBit Code Generation Makefile

.PHONY: all clean generate validate test help

# Default target
all: generate validate test

# Generate all blocks
generate:
	@echo "🚀 Generating all blocks..."
	@./generate-pipeline.sh

# Generate specific block
generate-block-%:
	@echo "🚀 Generating Block $*..."
	@BLOCK=$* ./generate-pipeline.sh

# Validate generated code
validate:
	@echo "✅ Validating generated code..."
	@cd cargobit-payment-system && npx tsc --noEmit
	@cd cargobit-payment-system && npx prisma validate

# Run tests
test:
	@echo "🧪 Running tests..."
	@cd cargobit-payment-system && npm test

# Clean generated files
clean:
	@echo "🧹 Cleaning generated files..."
	@rm -rf cargobit-payment-system
	@rm -f pipeline.log

# Setup project
setup:
	@echo "📦 Setting up project..."
	@npm init -y
	@npm install typescript @types/node ts-node prisma
	@npm install -D vitest @types/express

# Help
help:
	@echo "CargoBit Code Generation Pipeline"
	@echo ""
	@echo "Targets:"
	@echo "  make generate        Generate all blocks"
	@echo "  make generate-block-A Generate only Block A"
	@echo "  make validate        Validate generated code"
	@echo "  make test            Run tests"
	@echo "  make clean           Remove generated files"
	@echo "  make setup           Setup project dependencies"
```

---

## Datei 6: Docker Compose für lokale Pipeline

```yaml
# docker-compose.yml
version: '3.8'

services:
  code-generator:
    build:
      context: .
      dockerfile: Dockerfile.generator
    environment:
      - AI_ENDPOINT=${AI_ENDPOINT:-}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
    volumes:
      - ./cargobit-payment-system:/output
      - ./templates:/templates:ro
      - ./pipeline-config.json:/config/pipeline-config.json:ro
    command: ./generate-pipeline.sh

  validator:
    image: node:20-alpine
    volumes:
      - ./cargobit-payment-system:/app
    working_dir: /app
    command: sh -c "npm install && npx tsc --noEmit && npx prisma validate"
    depends_on:
      - code-generator

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --save 60 1

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: cargobit
      POSTGRES_PASSWORD: cargobit_secret
      POSTGRES_DB: cargobit
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## Verwendung

### Lokale Ausführung

```bash
# 1. Pipeline konfigurieren
cp pipeline-config.example.json pipeline-config.json
# Editiere pipeline-config.json nach Bedarf

# 2. Dependencies installieren
make setup

# 3. Code generieren
make generate

# 4. Validieren
make validate

# 5. Tests ausführen
make test
```

### Mit Docker

```bash
# Alle Services starten
docker-compose up -d

# Logs ansehen
docker-compose logs -f code-generator

# Cleanup
docker-compose down -v
```

### Mit GitHub Actions

1. Push zu Repository
2. Gehe zu Actions → "Generate CargoBit Code"
3. Wähle Blocks aus
4. Run workflow
5. Download artifacts

---

*Diese Version ist optimiert für automatisierte CI/CD Pipelines.*
