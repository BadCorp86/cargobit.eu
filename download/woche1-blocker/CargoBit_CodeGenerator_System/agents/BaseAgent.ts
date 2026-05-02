/**
 * Base Agent Class
 * 
 * Abstrakte Basisklasse für alle CargoBit Code-Generator Agenten.
 * Implementiert gemeinsame Funktionalität für Task-Ausführung, 
 * Signal-Handling und Output-Generierung.
 */

import { EventEmitter } from 'events';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';

// ================================================================================
// TYPES
// ================================================================================

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  priority: number;
  maxConcurrentTasks: number;
  inputs: string[];
  outputs: OutputFile[];
  signals: {
    emits: string[];
    consumes: string[];
  };
  dependencies: string[];
  prompts: {
    system: string;
    task: string;
  };
}

export interface OutputFile {
  path: string;
  type: string;
  description: string;
}

export interface Task {
  id: string;
  agentId: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  inputs: Record<string, any>;
  outputs: GeneratedFile[];
  retryCount: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  lines: number;
  checksum: string;
}

export interface Signal {
  type: string;
  source: string;
  payload: any;
  timestamp: Date;
}

export interface AgentResult {
  success: boolean;
  agentId: string;
  taskId: string;
  outputs: GeneratedFile[];
  signals: string[];
  duration: number;
  error?: string;
}

// ================================================================================
// ABSTRACT BASE AGENT
// ================================================================================

export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected currentTask: Task | null = null;
  protected outputDir: string;
  protected state: Map<string, any>;

  constructor(config: AgentConfig, outputDir: string) {
    super();
    this.config = config;
    this.outputDir = outputDir;
    this.state = new Map();
  }

  // ------------------------------------------------------------------------------
  // ABSTRACT METHODS
  // ------------------------------------------------------------------------------

  /**
   * Hauptlogik des Agenten - muss von Subklassen implementiert werden
   */
  abstract execute(task: Task): Promise<GeneratedFile[]>;

  // ------------------------------------------------------------------------------
  // PUBLIC METHODS
  // ------------------------------------------------------------------------------

  /**
   * Startet die Ausführung eines Tasks
   */
  async run(task: Task): Promise<AgentResult> {
    const startTime = Date.now();
    this.currentTask = task;

    this.emit('task:start', { agent: this.config.id, task: task.id });

    try {
      // Validiere Inputs
      this.validateInputs(task.inputs);

      // Führe Task aus
      task.status = 'running';
      task.startedAt = new Date();

      const outputs = await this.execute(task);

      // Speichere Outputs
      await this.saveOutputs(outputs);

      // Aktualisiere Task-Status
      task.status = 'completed';
      task.completedAt = new Date();
      task.outputs = outputs;

      const result: AgentResult = {
        success: true,
        agentId: this.config.id,
        taskId: task.id,
        outputs,
        signals: this.config.signals.emits,
        duration: Date.now() - startTime,
      };

      this.emit('task:complete', result);
      return result;

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);

      const result: AgentResult = {
        success: false,
        agentId: this.config.id,
        taskId: task.id,
        outputs: [],
        signals: [],
        duration: Date.now() - startTime,
        error: task.error,
      };

      this.emit('task:error', result);
      return result;

    } finally {
      this.currentTask = null;
    }
  }

  /**
   * Gibt Agent-Konfiguration zurück
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Prüft ob Agent bereit für neuen Task ist
   */
  isReady(): boolean {
    return this.currentTask === null;
  }

  /**
   * Prüft ob alle Dependencies erfüllt sind
   */
  areDependenciesResolved(resolvedAgents: string[]): boolean {
    return this.config.dependencies.every(dep => resolvedAgents.includes(dep));
  }

  /**
   * Wartet auf ein Signal
   */
  async waitForSignal(signalType: string, timeoutMs: number = 60000): Promise<Signal> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for signal: ${signalType}`));
      }, timeoutMs);

      this.once(`signal:${signalType}`, (signal: Signal) => {
        clearTimeout(timeout);
        resolve(signal);
      });
    });
  }

  /**
   * Verarbeitet eingehendes Signal
   */
  receiveSignal(signal: Signal): void {
    if (this.config.signals.consumes.includes(signal.type)) {
      this.state.set(signal.type, signal.payload);
      this.emit(`signal:${signal.type}`, signal);
    }
  }

  // ------------------------------------------------------------------------------
  // PROTECTED METHODS
  // ------------------------------------------------------------------------------

  /**
   * Validiert Inputs gegen erwartete Input-Types
   */
  protected validateInputs(inputs: Record<string, any>): void {
    for (const expectedInput of this.config.inputs) {
      if (!(expectedInput in inputs) && !this.state.has(expectedInput)) {
        console.warn(`Missing input: ${expectedInput}`);
      }
    }
  }

  /**
   * Speichert generierte Dateien
   */
  protected async saveOutputs(outputs: GeneratedFile[]): Promise<void> {
    for (const file of outputs) {
      const fullPath = join(this.outputDir, file.path);
      const dir = join(fullPath, '..');

      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, file.content, 'utf-8');

      console.log(`  📄 Created: ${file.path} (${file.lines} lines)`);
    }
  }

  /**
   * Erstellt eine GeneratedFile aus Inhalt
   */
  protected createFile(path: string, content: string, language: string): GeneratedFile {
    return {
      path,
      content,
      language,
      lines: content.split('\n').length,
      checksum: createHash('sha256').update(content).digest('hex'),
    };
  }

  /**
   * Baut Prompt aus Template und Variablen
   */
  protected buildPrompt(description: string, requirements: Record<string, any>): string {
    let prompt = this.config.prompts.task;

    prompt = prompt.replace('{task_description}', description);
    prompt = prompt.replace('{requirements}', JSON.stringify(requirements, null, 2));
    prompt = prompt.replace('{output_files}', 
      this.config.outputs.map(o => `- ${o.path}: ${o.description}`).join('\n')
    );

    return `${this.config.prompts.system}\n\n---\n\n${prompt}`;
  }

  /**
   * Simuliert AI-Antwort (in echter Implementation würde hier API aufgerufen)
   */
  protected async callAI(prompt: string): Promise<string> {
    // In echter Implementation:
    // - OpenAI API aufrufen
    // - Anthropic API aufrufen
    // - Lokale LLM nutzen
    
    console.log(`  🤖 Calling AI with ${prompt.length} chars prompt...`);
    
    // Placeholder - simulierte Antwort
    return `// Generated by ${this.config.name}\n// Prompt: ${prompt.substring(0, 100)}...`;
  }

  /**
   * Parst AI-Antwort und extrahiert Dateien
   */
  protected parseAIResponse(response: string): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    
    // Regex für FILE-Blöcke
    const fileRegex = /### FILE: (.+?)\n```(\w+)?\n([\s\S]*?)```/g;
    
    let match;
    while ((match = fileRegex.exec(response)) !== null) {
      const path = match[1].trim();
      const language = match[2] || 'text';
      const content = match[3];
      
      files.push(this.createFile(path, content, language));
    }
    
    return files;
  }
}
