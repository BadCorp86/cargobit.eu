/**
 * CargoBit Webhook Configuration Entity
 * 
 * Defines a webhook endpoint that receives reconciliation event notifications.
 * 
 * @module @cargobit/webhooks
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

export type WebhookStatus = 'active' | 'paused' | 'disabled' | 'failed';
export type WebhookEventType = 
  | 'payout.open'
  | 'payout.reconciled'
  | 'payout.failed'
  | 'payout.disputed'
  | 'reconciliation.run_started'
  | 'reconciliation.run_completed'
  | 'reconciliation.run_failed'
  | 'export.completed'
  | 'export.failed'
  | 'report.generated';

export type AuthenticationType = 'none' | 'hmac_sha256' | 'bearer_token' | 'basic_auth';

export interface WebhookRetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  
  /** Backoff multiplier (exponential backoff) */
  backoffMultiplier: number;
  
  /** Retry on HTTP status codes */
  retryOnStatusCodes: number[];
}

export interface WebhookAuthentication {
  /** Authentication type */
  type: AuthenticationType;
  
  /** HMAC secret (for hmac_sha256) */
  secret?: string;
  
  /** Bearer token (for bearer_token) */
  token?: string;
  
  /** Username (for basic_auth) */
  username?: string;
  
  /** Password (for basic_auth) */
  password?: string;
}

export interface WebhookHeader {
  key: string;
  value: string;
  isSecret: boolean;
}

// =============================================================================
// WEBHOOK CONFIGURATION
// =============================================================================

export interface WebhookConfiguration {
  /** Unique identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description */
  description?: string;
  
  /** Target URL for webhook delivery */
  url: string;
  
  /** HTTP method (POST, PUT) */
  method: 'POST' | 'PUT';
  
  /** Events to subscribe to */
  events: WebhookEventType[];
  
  /** Status of the webhook */
  status: WebhookStatus;
  
  /** Authentication configuration */
  authentication: WebhookAuthentication;
  
  /** Custom headers to include */
  headers: WebhookHeader[];
  
  /** Retry configuration */
  retryConfig: WebhookRetryConfig;
  
  /** Request timeout in milliseconds */
  timeoutMs: number;
  
  /** Owner/creator ID */
  createdBy: string;
  
  /** Organization/company ID */
  organizationId?: string;
  
  /** Whether webhook is active */
  isActive: boolean;
  
  /** Consecutive failure count */
  consecutiveFailures: number;
  
  /** Last successful delivery timestamp */
  lastSuccessAt?: Date;
  
  /** Last failure timestamp */
  lastFailureAt?: Date;
  
  /** Last failure reason */
  lastFailureReason?: string;
  
  /** Total deliveries count */
  totalDeliveries: number;
  
  /** Successful deliveries count */
  successfulDeliveries: number;
  
  /** Failed deliveries count */
  failedDeliveries: number;
  
  /** Created timestamp */
  createdAt: Date;
  
  /** Last updated timestamp */
  updatedAt: Date;
}

// =============================================================================
// WEBHOOK DELIVERY
// =============================================================================

export type DeliveryStatus = 
  | 'pending'
  | 'processing'
  | 'delivered'
  | 'failed'
  | 'retrying'
  | 'dead_letter';

export interface WebhookDelivery {
  /** Unique identifier */
  id: string;
  
  /** Webhook configuration ID */
  webhookId: string;
  
  /** Event type */
  eventType: WebhookEventType;
  
  /** Event ID that triggered this delivery */
  eventId: string;
  
  /** Entity type (payout, reconciliation, etc.) */
  entityType: string;
  
  /** Entity ID */
  entityId: string;
  
  /** Delivery status */
  status: DeliveryStatus;
  
  /** Request payload (JSON) */
  payload: Record<string, unknown>;
  
  /** Request headers sent */
  requestHeaders: Record<string, string>;
  
  /** Response status code */
  responseStatusCode?: number;
  
  /** Response headers */
  responseHeaders?: Record<string, string>;
  
  /** Response body */
  responseBody?: string;
  
  /** Number of attempts made */
  attempts: number;
  
  /** Next retry timestamp */
  nextRetryAt?: Date;
  
  /** Delivery duration in milliseconds */
  durationMs?: number;
  
  /** Error message if failed */
  errorMessage?: string;
  
  /** Created timestamp */
  createdAt: Date;
  
  /** Last attempt timestamp */
  lastAttemptAt?: Date;
  
  /** Delivered timestamp */
  deliveredAt?: Date;
}

// =============================================================================
// WEBHOOK EVENT
// =============================================================================

export interface WebhookEvent {
  /** Unique identifier */
  id: string;
  
  /** Event type */
  type: WebhookEventType;
  
  /** Entity type */
  entityType: string;
  
  /** Entity ID */
  entityId: string;
  
  /** Event payload */
  payload: Record<string, unknown>;
  
  /** Event timestamp */
  timestamp: Date;
  
  /** Whether event has been processed */
  processed: boolean;
  
  /** Number of webhooks to notify */
  webhookCount: number;
  
  /** Number of successful deliveries */
  deliveredCount: number;
  
  /** Created timestamp */
  createdAt: Date;
}

// =============================================================================
// WEBHOOK STATISTICS
// =============================================================================

export interface WebhookStatistics {
  /** Total webhooks */
  totalWebhooks: number;
  
  /** Active webhooks */
  activeWebhooks: number;
  
  /** Paused webhooks */
  pausedWebhooks: number;
  
  /** Failed webhooks */
  failedWebhooks: number;
  
  /** Total deliveries (24h) */
  totalDeliveries24h: number;
  
  /** Successful deliveries (24h) */
  successfulDeliveries24h: number;
  
  /** Failed deliveries (24h) */
  failedDeliveries24h: number;
  
  /** Average delivery time (ms) */
  avgDeliveryTimeMs: number;
  
  /** Success rate percentage */
  successRate: number;
  
  /** Deliveries by event type */
  byEventType: Record<WebhookEventType, {
    total: number;
    successful: number;
    failed: number;
  }>;
  
  /** Deliveries by webhook */
  byWebhook: Record<string, {
    total: number;
    successful: number;
    failed: number;
    lastStatus: DeliveryStatus;
  }>;
}

// =============================================================================
// DEFAULTS
// =============================================================================

export const DEFAULT_RETRY_CONFIG: WebhookRetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,     // 1 second
  maxDelayMs: 300000,       // 5 minutes
  backoffMultiplier: 2,
  retryOnStatusCodes: [408, 429, 500, 502, 503, 504],
};

export const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

export const MAX_CONSECUTIVE_FAILURES = 10;

export const ALL_EVENT_TYPES: WebhookEventType[] = [
  'payout.open',
  'payout.reconciled',
  'payout.failed',
  'payout.disputed',
  'reconciliation.run_started',
  'reconciliation.run_completed',
  'reconciliation.run_failed',
  'export.completed',
  'export.failed',
  'report.generated',
];

// =============================================================================
// EVENT TYPE DESCRIPTIONS
// =============================================================================

export const EVENT_TYPE_DESCRIPTIONS: Record<WebhookEventType, string> = {
  'payout.open': 'Triggered when a new open payout is detected during reconciliation',
  'payout.reconciled': 'Triggered when a payout is successfully reconciled',
  'payout.failed': 'Triggered when a payout fails',
  'payout.disputed': 'Triggered when a payout dispute is opened',
  'reconciliation.run_started': 'Triggered when a reconciliation run begins',
  'reconciliation.run_completed': 'Triggered when a reconciliation run completes successfully',
  'reconciliation.run_failed': 'Triggered when a reconciliation run fails',
  'export.completed': 'Triggered when a report export completes successfully',
  'export.failed': 'Triggered when a report export fails',
  'report.generated': 'Triggered when a report is generated',
};
