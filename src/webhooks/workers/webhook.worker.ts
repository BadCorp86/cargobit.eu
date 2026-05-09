/**
 * CargoBit Webhook Delivery Worker
 * 
 * Background worker for processing webhook deliveries with retry logic.
 * 
 * @module @cargobit/webhooks
 * @version 1.0.0
 */

import {
  WebhookDelivery,
  WebhookConfiguration,
  DeliveryStatus,
  MAX_CONSECUTIVE_FAILURES,
} from '../entities/webhook-configuration.entity';
import { WebhookService, IWebhookStore } from '../services/webhooks.service';
import { webhookMetrics } from '../metrics/webhook.metrics';

// =============================================================================
// WORKER CONFIGURATION
// =============================================================================

export interface WebhookWorkerConfig {
  /** Polling interval in milliseconds */
  pollIntervalMs: number;
  
  /** Maximum concurrent deliveries */
  concurrency: number;
  
  /** Maximum deliveries per poll */
  batchSize: number;
  
  /** Enable dead letter queue */
  enableDeadLetterQueue: boolean;
  
  /** Max age for dead letter entries in days */
  deadLetterMaxAgeDays: number;
  
  /** Auto-disable webhooks after consecutive failures */
  autoDisableOnFailures: boolean;
}

const DEFAULT_CONFIG: WebhookWorkerConfig = {
  pollIntervalMs: 1000,
  concurrency: 10,
  batchSize: 50,
  enableDeadLetterQueue: true,
  deadLetterMaxAgeDays: 7,
  autoDisableOnFailures: true,
};

// =============================================================================
// WEBHOOK WORKER
// =============================================================================

export class WebhookWorker {
  private store: IWebhookStore;
  private config: WebhookWorkerConfig;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private activeDeliveries: number = 0;
  private processing: boolean = false;

  constructor(store: IWebhookStore, config?: Partial<WebhookWorkerConfig>) {
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.isRunning) {
      console.log('[WebhookWorker] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[WebhookWorker] Starting with config:', {
      pollIntervalMs: this.config.pollIntervalMs,
      concurrency: this.config.concurrency,
      batchSize: this.config.batchSize,
    });

    // Start polling
    this.pollInterval = setInterval(() => {
      this.poll().catch(err => {
        console.error('[WebhookWorker] Poll error:', err);
      });
    }, this.config.pollIntervalMs);

    // Initial poll
    this.poll().catch(err => {
      console.error('[WebhookWorker] Initial poll error:', err);
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    console.log('[WebhookWorker] Stopped');
  }

  /**
   * Poll for pending deliveries
   */
  private async poll(): Promise<void> {
    if (this.processing || this.activeDeliveries >= this.config.concurrency) {
      return;
    }

    this.processing = true;

    try {
      // Get pending deliveries
      const availableSlots = this.config.concurrency - this.activeDeliveries;
      const limit = Math.min(availableSlots, this.config.batchSize);
      
      const pending = await this.store.getPendingDeliveries(limit);

      if (pending.length === 0) {
        return;
      }

      console.log(`[WebhookWorker] Processing ${pending.length} pending deliveries`);

      // Process deliveries in parallel
      const promises = pending.map(delivery => this.processDelivery(delivery));
      await Promise.allSettled(promises);

    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single delivery
   */
  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    this.activeDeliveries++;
    webhookMetrics.deliveriesInProgress.inc();

    const startTime = Date.now();

    try {
      // Update status to processing
      await this.store.updateDelivery(delivery.id, {
        status: 'processing',
        lastAttemptAt: new Date(),
        attempts: delivery.attempts + 1,
      });

      // Get webhook configuration
      const webhook = await this.store.getWebhook(delivery.webhookId);
      
      if (!webhook) {
        console.error(`[WebhookWorker] Webhook not found: ${delivery.webhookId}`);
        await this.handleDeliveryFailure(delivery, null, 'Webhook configuration not found');
        return;
      }

      if (!webhook.isActive || webhook.status !== 'active') {
        console.log(`[WebhookWorker] Webhook ${webhook.id} is not active, skipping`);
        await this.store.updateDelivery(delivery.id, {
          status: 'failed',
          errorMessage: 'Webhook is not active',
        });
        return;
      }

      // Attempt delivery
      const result = await this.deliver(delivery, webhook);

      if (result.success) {
        await this.handleDeliverySuccess(delivery, webhook, result, Date.now() - startTime);
      } else {
        await this.handleDeliveryFailure(delivery, webhook, result.error);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[WebhookWorker] Delivery ${delivery.id} error:`, errorMessage);
      await this.handleDeliveryFailure(delivery, null, errorMessage);
      
    } finally {
      this.activeDeliveries--;
      webhookMetrics.deliveriesInProgress.dec();
    }
  }

  /**
   * Attempt to deliver a webhook
   */
  private async deliver(
    delivery: WebhookDelivery,
    webhook: WebhookConfiguration
  ): Promise<{ success: boolean; statusCode?: number; error?: string; durationMs: number }> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), webhook.timeoutMs);

      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers: delivery.requestHeaders,
        body: JSON.stringify(delivery.payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;

      // Record metrics
      webhookMetrics.deliveryDuration.observe(
        {
          webhook_id: webhook.id,
          event_type: delivery.eventType,
          status_code: response.status.toString(),
        },
        durationMs / 1000
      );

      webhookMetrics.deliveryAttempts.inc({
        webhook_id: webhook.id,
        event_type: delivery.eventType,
        status: response.ok ? 'success' : 'failure',
      });

      if (response.ok) {
        return { success: true, statusCode: response.status, durationMs };
      } else {
        const body = await response.text();
        return {
          success: false,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${body.substring(0, 200)}`,
          durationMs,
        };
      }

    } catch (error) {
      const durationMs = Date.now() - startTime;
      let errorMessage: string;

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = `Timeout after ${webhook.timeoutMs}ms`;
          webhookMetrics.failuresByError.inc({ webhook_id: webhook.id, error_type: 'timeout' });
        } else {
          errorMessage = error.message;
          webhookMetrics.failuresByError.inc({ webhook_id: webhook.id, error_type: 'network' });
        }
      } else {
        errorMessage = 'Unknown error';
        webhookMetrics.failuresByError.inc({ webhook_id: webhook.id, error_type: 'unknown' });
      }

      webhookMetrics.deliveryAttempts.inc({
        webhook_id: webhook.id,
        event_type: delivery.eventType,
        status: 'error',
      });

      return { success: false, error: errorMessage, durationMs };
    }
  }

  /**
   * Handle successful delivery
   */
  private async handleDeliverySuccess(
    delivery: WebhookDelivery,
    webhook: WebhookConfiguration,
    result: { statusCode?: number; durationMs: number },
    totalDurationMs: number
  ): Promise<void> {
    console.log(`[WebhookWorker] Delivery ${delivery.id} succeeded in ${totalDurationMs}ms`);

    // Update delivery record
    await this.store.updateDelivery(delivery.id, {
      status: 'delivered',
      responseStatusCode: result.statusCode,
      durationMs: result.durationMs,
      deliveredAt: new Date(),
    });

    // Update webhook stats
    await this.store.updateWebhook(webhook.id, {
      consecutiveFailures: 0,
      lastSuccessAt: new Date(),
      totalDeliveries: { increment: 1 } as any,
      successfulDeliveries: { increment: 1 } as any,
    });

    // Update metrics
    webhookMetrics.deliveryStatus.inc({
      webhook_id: webhook.id,
      event_type: delivery.eventType,
      status: 'delivered',
    });

    webhookMetrics.consecutiveFailures.set({ webhook_id: webhook.id }, 0);
  }

  /**
   * Handle failed delivery
   */
  private async handleDeliveryFailure(
    delivery: WebhookDelivery,
    webhook: WebhookConfiguration | null,
    error: string
  ): Promise<void> {
    console.error(`[WebhookWorker] Delivery ${delivery.id} failed: ${error}`);

    const attempts = delivery.attempts + 1;
    const retryConfig = webhook?.retryConfig || { maxRetries: 5, initialDelayMs: 1000, maxDelayMs: 300000, backoffMultiplier: 2 };

    // Check if we should retry
    if (attempts < retryConfig.maxRetries && webhook?.status === 'active') {
      // Calculate next retry time with exponential backoff
      const delay = Math.min(
        retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempts - 1),
        retryConfig.maxDelayMs
      );

      const nextRetryAt = new Date(Date.now() + delay);

      await this.store.updateDelivery(delivery.id, {
        status: 'retrying',
        attempts,
        nextRetryAt,
        errorMessage: error,
      });

      console.log(`[WebhookWorker] Delivery ${delivery.id} scheduled for retry at ${nextRetryAt.toISOString()}`);

      webhookMetrics.deliveryStatus.inc({
        webhook_id: webhook?.id || 'unknown',
        event_type: delivery.eventType,
        status: 'retrying',
      });

      webhookMetrics.retryQueueSize.inc();

    } else if (this.config.enableDeadLetterQueue) {
      // Move to dead letter queue
      await this.store.updateDelivery(delivery.id, {
        status: 'dead_letter',
        attempts,
        errorMessage: error,
      });

      console.log(`[WebhookWorker] Delivery ${delivery.id} moved to dead letter queue`);

      webhookMetrics.deliveryStatus.inc({
        webhook_id: webhook?.id || 'unknown',
        event_type: delivery.eventType,
        status: 'dead_letter',
      });

      webhookMetrics.deadLetterQueueSize.inc();

    } else {
      // Mark as failed
      await this.store.updateDelivery(delivery.id, {
        status: 'failed',
        attempts,
        errorMessage: error,
      });

      webhookMetrics.deliveryStatus.inc({
        webhook_id: webhook?.id || 'unknown',
        event_type: delivery.eventType,
        status: 'failed',
      });
    }

    // Update webhook failure stats
    if (webhook) {
      const newConsecutiveFailures = webhook.consecutiveFailures + 1;

      await this.store.updateWebhook(webhook.id, {
        consecutiveFailures: newConsecutiveFailures,
        lastFailureAt: new Date(),
        lastFailureReason: error,
        totalDeliveries: { increment: 1 } as any,
        failedDeliveries: { increment: 1 } as any,
      });

      webhookMetrics.consecutiveFailures.set({ webhook_id: webhook.id }, newConsecutiveFailures);

      // Auto-disable webhook if too many consecutive failures
      if (this.config.autoDisableOnFailures && newConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn(`[WebhookWorker] Disabling webhook ${webhook.id} after ${newConsecutiveFailures} consecutive failures`);
        
        await this.store.updateWebhook(webhook.id, {
          status: 'disabled',
          isActive: false,
        });

        webhookMetrics.webhooksDisabled.inc({ webhook_id: webhook.id });
        webhookMetrics.webhooksTotal.dec({ status: 'active' });
        webhookMetrics.webhooksTotal.inc({ status: 'disabled' });
      }
    }
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    activeDeliveries: number;
    config: WebhookWorkerConfig;
  } {
    return {
      isRunning: this.isRunning,
      activeDeliveries: this.activeDeliveries,
      config: this.config,
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let workerInstance: WebhookWorker | null = null;

export function getWorker(store: IWebhookStore, config?: Partial<WebhookWorkerConfig>): WebhookWorker {
  if (!workerInstance) {
    workerInstance = new WebhookWorker(store, config);
  }
  return workerInstance;
}

export function stopWorker(): void {
  if (workerInstance) {
    workerInstance.stop();
    workerInstance = null;
  }
}
