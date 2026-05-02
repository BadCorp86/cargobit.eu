/**
 * CargoBit Code-Generator Orchestrator
 * 
 * Hauptsteuerung für das Multi-Agent-System.
 * Koordiniert alle Agenten und verwaltet den Generierungsprozess.
 */

import { EventEmitter } from 'events';
import { writeFile, mkdir, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { ArchitectAgent, ARCHITECT_CONFIG } from './agents/ArchitectAgent';
import { BackendAgent, BACKEND_CONFIG } from './agents/BackendAgent';
import { BaseAgent, AgentConfig, Task, GeneratedFile, AgentResult } from './agents/BaseAgent';

// ================================================================================
// TYPES
// ================================================================================

interface OrchestratorConfig {
  outputDir: string;
  maxConcurrentAgents: number;
  timeoutMs: number;
  retryAttempts: number;
}

interface GenerationResult {
  success: boolean;
  totalFiles: number;
  totalLines: number;
  duration: number;
  agents: AgentResult[];
  manifest: Manifest;
}

interface Manifest {
  version: string;
  generatedAt: string;
  files: ManifestFile[];
  checksums: Record<string, string>;
}

interface ManifestFile {
  path: string;
  language: string;
  lines: number;
  checksum: string;
}

// ================================================================================
// ORCHESTRATOR CLASS
// ================================================================================

export class Orchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private agents: Map<string, BaseAgent>;
  private results: AgentResult[];
  private outputDir: string;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    super();
    this.config = {
      outputDir: config.outputDir || './output/cargobit-payment-system',
      maxConcurrentAgents: config.maxConcurrentAgents || 5,
      timeoutMs: config.timeoutMs || 600000,
      retryAttempts: config.retryAttempts || 3,
    };
    this.agents = new Map();
    this.results = [];
    this.outputDir = this.config.outputDir;
  }

  // ------------------------------------------------------------------------------
  // INITIALIZATION
  // ------------------------------------------------------------------------------

  async initialize(): Promise<void> {
    console.log('🚀 Initializing CargoBit Code-Generator Orchestrator...\n');

    // Create output directory
    await mkdir(this.outputDir, { recursive: true });

    // Register agents
    this.registerAgent(new ArchitectAgent(this.outputDir));
    this.registerAgent(new BackendAgent(this.outputDir));
    // Add more agents as they are implemented

    console.log(`✅ Orchestrator initialized with ${this.agents.size} agents\n`);
  }

  private registerAgent(agent: BaseAgent): void {
    const config = agent.getConfig();
    this.agents.set(config.id, agent);
    console.log(`  ✓ Registered agent: ${config.name}`);
  }

  // ------------------------------------------------------------------------------
  // EXECUTION
  // ------------------------------------------------------------------------------

  async run(): Promise<GenerationResult> {
    const startTime = Date.now();
    console.log('========================================');
    console.log('Starting Code Generation Pipeline');
    console.log(`Output: ${this.outputDir}`);
    console.log('========================================\n');

    try {
      // Phase 1: Architecture
      await this.runPhase('Architecture', ['architect']);

      // Phase 2: Backend (depends on architect)
      await this.runPhase('Backend', ['backend']);

      // Phase 3: Finalization
      const manifest = await this.createManifest();

      const result: GenerationResult = {
        success: true,
        totalFiles: manifest.files.length,
        totalLines: manifest.files.reduce((sum, f) => sum + f.lines, 0),
        duration: Date.now() - startTime,
        agents: this.results,
        manifest,
      };

      console.log('\n========================================');
      console.log('✅ Code Generation Complete');
      console.log(`   Files: ${result.totalFiles}`);
      console.log(`   Lines: ${result.totalLines}`);
      console.log(`   Duration: ${Math.round(result.duration / 1000)}s`);
      console.log('========================================\n');

      return result;

    } catch (error) {
      console.error('\n❌ Code Generation Failed:', error);
      throw error;
    }
  }

  private async runPhase(phaseName: string, agentIds: string[]): Promise<void> {
    console.log(`\n📍 Phase: ${phaseName}`);
    console.log('----------------------------------------');

    for (const agentId of agentIds) {
      const agent = this.agents.get(agentId);
      if (!agent) {
        console.warn(`  ⚠️ Agent not found: ${agentId}`);
        continue;
      }

      const task: Task = {
        id: `task-${agentId}-${Date.now()}`,
        agentId,
        description: `Execute ${agent.getConfig().name} tasks`,
        status: 'pending',
        inputs: {},
        outputs: [],
        retryCount: 0,
      };

      const result = await agent.run(task);
      this.results.push(result);
    }
  }

  // ------------------------------------------------------------------------------
  // MANIFEST CREATION
  // ------------------------------------------------------------------------------

  private async createManifest(): Promise<Manifest> {
    console.log('\n📋 Creating Manifest...');

    const files = await this.collectFiles(this.outputDir);
    
    const manifest: Manifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      files,
      checksums: {},
    };

    // Calculate checksums
    for (const file of files) {
      manifest.checksums[file.path] = file.checksum;
    }

    // Write manifest
    const manifestPath = join(this.outputDir, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`  📄 Created: manifest.json`);

    return manifest;
  }

  private async collectFiles(dir: string, basePath: string = ''): Promise<ManifestFile[]> {
    const files: ManifestFile[] = [];
    const entries = await readdir(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = basePath ? join(basePath, entry) : entry;
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        const subFiles = await this.collectFiles(fullPath, relativePath);
        files.push(...subFiles);
      } else {
        // For now, create placeholder - in real implementation would read file
        files.push({
          path: relativePath,
          language: this.detectLanguage(entry),
          lines: 0,
          checksum: '',
        });
      }
    }

    return files;
  }

  private detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
      prisma: 'prisma',
      sql: 'sql',
      sh: 'bash',
      yaml: 'yaml',
      yml: 'yaml',
      json: 'json',
      md: 'markdown',
    };
    return languageMap[ext || ''] || 'text';
  }
}

// ================================================================================
// CLI ENTRY POINT
// ================================================================================

async function main() {
  const orchestrator = new Orchestrator({
    outputDir: process.env.OUTPUT_DIR || './output/cargobit-payment-system',
  });

  orchestrator.on('task:start', (data) => {
    console.log(`  🔄 Task started: ${data.agent}`);
  });

  orchestrator.on('task:complete', (result: AgentResult) => {
    console.log(`  ✅ Task completed: ${result.agentId} (${result.outputs.length} files)`);
  });

  orchestrator.on('task:error', (result: AgentResult) => {
    console.error(`  ❌ Task failed: ${result.agentId} - ${result.error}`);
  });

  await orchestrator.initialize();
  const result = await orchestrator.run();

  console.log('\n📊 Generation Summary:');
  console.log(JSON.stringify({
    success: result.success,
    files: result.totalFiles,
    lines: result.totalLines,
    duration: `${Math.round(result.duration / 1000)}s`,
  }, null, 2));

  process.exit(result.success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default Orchestrator;
