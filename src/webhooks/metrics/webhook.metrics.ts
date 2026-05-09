/**
 * CargoBit Webhook Prometheus Metrics
 * 
 * Metrics for monitoring webhook delivery performance and reliability.
 * 
 * @module @cargobit/webhooks
 * @version 1.0.0
 */

import { client as promClient, Registry } from 'prom-client';

// =============================================================================
// REGISTRY
// =============================================================================

// Use default registry or create a custom one
const register = promClient.register;

// =============================================================================
// WEBHOOK METRICS
// =============================================================================

/**
 * Total number of webhook configurations by status
 */
export const webhooksTotal = new promClient.Gauge({
  name: 'webhooks_total',
  help: 'Total number of webhook configurations by status',
  labelNames: ['status'],
  registers: [register],
});

/**
 * Total events dispatched
 */
export const eventsDispatched = new promClient.Counter({
  name: 'webhook_events_dispatched_total',
  help: 'Total number of webhook events dispatched',
  labelNames: ['event_type'],
  registers: [register],
});

/**
 * Deliveries created
 */
export const deliveriesCreated = new promClient.Counter({
  name: 'webhook_deliveries_created_total',
  help: 'Total number of webhook deliveries created',
  labelNames: ['webhook_id', 'event_type'],
  registers: [register],
});

/**
 * Delivery attempts
 */
export const deliveryAttempts = new promClient.Counter({
  name: 'webhook_delivery_attempts_total',
  help: 'Total number of webhook delivery attempts',
  labelNames: ['webhook_id', 'event_type', 'status'],
  registers: [register],
});

/**
 * Delivery duration histogram
 */
export const deliveryDuration = new promClient.Histogram({
  name: 'webhook_delivery_duration_seconds',
  help: 'Duration of webhook delivery attempts in seconds',
  labelNames: ['webhook_id', 'event_type', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

/**
 * Delivery status counter
 */
export const deliveryStatus = new promClient.Counter({
  name: 'webhook_delivery_status_total',
  help: 'Webhook delivery status counts',
  labelNames: ['webhook_id', 'event_type', 'status'],
  registers: [register],
});

/**
 * Current deliveries in progress
 */
export const deliveriesInProgress = new promClient.Gauge({
  name: 'webhook_deliveries_in_progress',
  help: 'Number of webhook deliveries currently in progress',
  registers: [register],
});

/**
 * Pending deliveries gauge
 */
export const pendingDeliveries = new promClient.Gauge({
  name: 'webhook_pending_deliveries',
  help: 'Number of pending webhook deliveries',
  labelNames: ['webhook_id'],
  registers: [register],
});

/**
 * Dead letter queue size
 */
export const deadLetterQueueSize = new promClient.Gauge({
  name: 'webhook_dead_letter_queue_size',
  help: 'Number of deliveries in dead letter queue',
  registers: [register],
});

/**
 * Retry queue size
 */
export const retryQueueSize = new promClient.Gauge({
  name: 'webhook_retry_queue_size',
  help: 'Number of deliveries waiting for retry',
  registers: [register],
});

/**
 * Test deliveries counter
 */
export const testDeliveries = new promClient.Counter({
  name: 'webhook_test_deliveries_total',
  help: 'Total number of webhook test deliveries',
  labelNames: ['webhook_id', 'success'],
  registers: [register],
});

/**
 * Replay attempts counter
 */
export const replaysTotal = new promClient.Counter({
  name: 'webhook_replays_total',
  help: 'Total number of webhook delivery replays',
  labelNames: ['webhook_id'],
  registers: [register],
});

/**
 * Webhook failures by error type
 */
export const failuresByError = new promClient.Counter({
  name: 'webhook_failures_by_error_total',
  help: 'Webhook delivery failures by error type',
  labelNames: ['webhook_id', 'error_type'],
  registers: [register],
});

/**
 * Signature validation failures
 */
export const signatureFailures = new promClient.Counter({
  name: 'webhook_signature_validation_failures_total',
  help: 'Number of webhook signature validation failures (reported by consumers)',
  labelNames: ['webhook_id'],
  registers: [register],
});

/**
 * Consecutive failures gauge
 */
export const consecutiveFailures = new promClient.Gauge({
  name: 'webhook_consecutive_failures',
  help: 'Consecutive failures per webhook',
  labelNames: ['webhook_id'],
  registers: [register],
});

/**
 * Webhook disabled due to failures
 */
export const webhooksDisabled = new promClient.Counter({
  name: 'webhook_disabled_total',
  help: 'Number of webhooks disabled due to consecutive failures',
  labelNames: ['webhook_id'],
  registers: [register],
});

// =============================================================================
// AGGREGATED METRICS
// =============================================================================

/**
 * Update aggregated metrics from statistics
 */
export function updateAggregatedMetrics(stats: {
  totalWebhooks: number;
  activeWebhooks: number;
  pausedWebhooks: number;
  failedWebhooks: number;
  totalDeliveries24h: number;
  successfulDeliveries24h: number;
  failedDeliveries24h: number;
  avgDeliveryTimeMs: number;
  successRate: number;
}): void {
  // These are already tracked via webhooksTotal gauge
  // Just ensure initial values are set
  webhooksTotal.set({ status: 'active' }, stats.activeWebhooks);
  webhooksTotal.set({ status: 'paused' }, stats.pausedWebhooks);
  webhooksTotal.set({ status: 'failed' }, stats.failedWebhooks);
  webhooksTotal.set({ status: 'disabled' }, stats.totalWebhooks - stats.activeWebhooks - stats.pausedWebhooks - stats.failedWebhooks);
}

// =============================================================================
// EXPORT
// =============================================================================

export const webhookMetrics = {
  webhooksTotal,
  eventsDispatched,
  deliveriesCreated,
  deliveryAttempts,
  deliveryDuration,
  deliveryStatus,
  deliveriesInProgress,
  pendingDeliveries,
  deadLetterQueueSize,
  retryQueueSize,
  testDeliveries,
  replaysTotal,
  failuresByError,
  signatureFailures,
  consecutiveFailures,
  webhooksDisabled,
  updateAggregatedMetrics,
};

export default webhookMetrics;
