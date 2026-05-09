/**
 * CargoBit Webhooks Module
 * 
 * NestJS module for webhook notifications in the CargoBit platform.
 * Provides webhook configuration management, event dispatching, and delivery tracking.
 * 
 * @module @cargobit/webhooks
 * @version 1.0.0
 */

import { WebhookService, InMemoryWebhookStore, IWebhookStore } from './services/webhooks.service';
import { WebhookWorker, getWorker, stopWorker } from './workers/webhook.worker';
import { webhookMetrics } from './metrics/webhook.metrics';

// =============================================================================
// MODULE EXPORTS
// =============================================================================

export * from './entities/webhook-configuration.entity';
export * from './dto/webhook.dto';
export * from './services/webhooks.service';
export * from './workers/webhook.worker';
export * from './metrics/webhook.metrics';
export * from './controllers/webhooks.controller';

// =============================================================================
// MODULE INITIALIZATION
// =============================================================================

export interface WebhooksModuleConfig {
  /** Webhook signing secret */
  signingSecret?: string;
  
  /** Worker configuration */
  worker?: {
    enabled?: boolean;
    pollIntervalMs?: number;
    concurrency?: number;
    batchSize?: number;
  };
  
  /** Data store implementation */
  store?: IWebhookStore;
}

let moduleConfig: WebhooksModuleConfig = {};
let serviceInstance: WebhookService | null = null;
let workerInstance: WebhookWorker | null = null;

/**
 * Initialize the webhooks module
 */
export function initWebhooksModule(config: WebhooksModuleConfig = {}): {
  service: WebhookService;
  worker: WebhookWorker | null;
} {
  moduleConfig = config;

  // Create data store
  const store = config.store || new InMemoryWebhookStore();

  // Create service
  serviceInstance = new WebhookService(store, {
    signingSecret: config.signingSecret,
  });

  // Create and optionally start worker
  if (config.worker?.enabled !== false) {
    workerInstance = new WebhookWorker(store, {
      pollIntervalMs: config.worker?.pollIntervalMs,
      concurrency: config.worker?.concurrency,
      batchSize: config.worker?.batchSize,
    });
  }

  return {
    service: serviceInstance,
    worker: workerInstance,
  };
}

/**
 * Get the webhook service instance
 */
export function getWebhookService(): WebhookService {
  if (!serviceInstance) {
    throw new Error('Webhooks module not initialized. Call initWebhooksModule() first.');
  }
  return serviceInstance;
}

/**
 * Start the webhook worker
 */
export function startWebhookWorker(): void {
  if (!workerInstance) {
    throw new Error('Webhook worker not initialized. Call initWebhooksModule() with worker.enabled=true.');
  }
  workerInstance.start();
}

/**
 * Stop the webhook worker
 */
export function stopWebhookWorker(): void {
  if (workerInstance) {
    workerInstance.stop();
  }
}

/**
 * Get module status
 */
export function getModuleStatus(): {
  initialized: boolean;
  workerRunning: boolean;
  workerStatus?: ReturnType<WebhookWorker['getStatus']>;
} {
  return {
    initialized: serviceInstance !== null,
    workerRunning: workerInstance?.getStatus().isRunning || false,
    workerStatus: workerInstance?.getStatus(),
  };
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export const webhooks = {
  init: initWebhooksModule,
  getService: getWebhookService,
  startWorker: startWebhookWorker,
  stopWorker: stopWebhookWorker,
  getStatus: getModuleStatus,
  metrics: webhookMetrics,
};

export default webhooks;
