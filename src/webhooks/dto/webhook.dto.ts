/**
 * CargoBit Webhook DTOs
 * 
 * Data Transfer Objects for webhook API endpoints.
 * 
 * @module @cargobit/webhooks
 * @version 1.0.0
 */

import {
  WebhookEventType,
  WebhookStatus,
  AuthenticationType,
  WebhookRetryConfig,
  WebhookAuthentication,
  WebhookHeader,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_TIMEOUT_MS,
  ALL_EVENT_TYPES,
} from '../entities/webhook-configuration.entity';

// =============================================================================
// CREATE WEBHOOK DTO
// =============================================================================

export interface CreateWebhookDto {
  /** Human-readable name */
  name: string;
  
  /** Description */
  description?: string;
  
  /** Target URL for webhook delivery */
  url: string;
  
  /** HTTP method (POST, PUT) */
  method?: 'POST' | 'PUT';
  
  /** Events to subscribe to */
  events: WebhookEventType[];
  
  /** Authentication configuration */
  authentication: WebhookAuthentication;
  
  /** Custom headers to include */
  headers?: WebhookHeader[];
  
  /** Retry configuration */
  retryConfig?: Partial<WebhookRetryConfig>;
  
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  
  /** Organization/company ID */
  organizationId?: string;
}

export function validateCreateWebhookDto(dto: CreateWebhookDto): string[] {
  const errors: string[] = [];
  
  if (!dto.name || dto.name.trim().length === 0) {
    errors.push('name is required');
  }
  
  if (!dto.url || !isValidUrl(dto.url)) {
    errors.push('url must be a valid HTTP/HTTPS URL');
  }
  
  if (!dto.events || dto.events.length === 0) {
    errors.push('at least one event type is required');
  }
  
  for (const event of dto.events) {
    if (!ALL_EVENT_TYPES.includes(event)) {
      errors.push(`invalid event type: ${event}`);
    }
  }
  
  if (dto.authentication) {
    const authErrors = validateAuthentication(dto.authentication);
    errors.push(...authErrors);
  }
  
  if (dto.timeoutMs && (dto.timeoutMs < 1000 || dto.timeoutMs > 120000)) {
    errors.push('timeoutMs must be between 1000 and 120000');
  }
  
  return errors;
}

// =============================================================================
// UPDATE WEBHOOK DTO
// =============================================================================

export interface UpdateWebhookDto {
  /** Human-readable name */
  name?: string;
  
  /** Description */
  description?: string;
  
  /** Target URL for webhook delivery */
  url?: string;
  
  /** HTTP method (POST, PUT) */
  method?: 'POST' | 'PUT';
  
  /** Events to subscribe to */
  events?: WebhookEventType[];
  
  /** Authentication configuration */
  authentication?: WebhookAuthentication;
  
  /** Custom headers to include */
  headers?: WebhookHeader[];
  
  /** Retry configuration */
  retryConfig?: Partial<WebhookRetryConfig>;
  
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  
  /** Status */
  status?: WebhookStatus;
  
  /** Whether webhook is active */
  isActive?: boolean;
}

// =============================================================================
// WEBHOOK RESPONSE DTO
// =============================================================================

export interface WebhookResponseDto {
  id: string;
  name: string;
  description?: string;
  url: string;
  method: 'POST' | 'PUT';
  events: WebhookEventType[];
  status: WebhookStatus;
  authentication: {
    type: AuthenticationType;
    // Secrets are not returned
  };
  headers: Array<{
    key: string;
    value: string;
    isSecret: boolean;
  }>;
  retryConfig: WebhookRetryConfig;
  timeoutMs: number;
  isActive: boolean;
  consecutiveFailures: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastFailureReason?: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  createdAt: string;
  updatedAt: string;
}

export function toWebhookResponseDto(webhook: any): WebhookResponseDto {
  return {
    id: webhook.id,
    name: webhook.name,
    description: webhook.description,
    url: webhook.url,
    method: webhook.method || 'POST',
    events: webhook.events,
    status: webhook.status,
    authentication: {
      type: webhook.authentication?.type || 'none',
    },
    headers: (webhook.headers || []).map((h: WebhookHeader) => ({
      key: h.key,
      value: h.isSecret ? '***' : h.value,
      isSecret: h.isSecret,
    })),
    retryConfig: webhook.retryConfig || DEFAULT_RETRY_CONFIG,
    timeoutMs: webhook.timeoutMs || DEFAULT_TIMEOUT_MS,
    isActive: webhook.isActive,
    consecutiveFailures: webhook.consecutiveFailures || 0,
    lastSuccessAt: webhook.lastSuccessAt?.toISOString(),
    lastFailureAt: webhook.lastFailureAt?.toISOString(),
    lastFailureReason: webhook.lastFailureReason,
    totalDeliveries: webhook.totalDeliveries || 0,
    successfulDeliveries: webhook.successfulDeliveries || 0,
    failedDeliveries: webhook.failedDeliveries || 0,
    createdAt: webhook.createdAt?.toISOString(),
    updatedAt: webhook.updatedAt?.toISOString(),
  };
}

// =============================================================================
// DELIVERY RESPONSE DTO
// =============================================================================

export interface DeliveryResponseDto {
  id: string;
  webhookId: string;
  webhookName?: string;
  eventType: WebhookEventType;
  eventId: string;
  entityType: string;
  entityId: string;
  status: string;
  attempts: number;
  responseStatusCode?: number;
  durationMs?: number;
  errorMessage?: string;
  createdAt: string;
  lastAttemptAt?: string;
  deliveredAt?: string;
}

export function toDeliveryResponseDto(delivery: any, webhookName?: string): DeliveryResponseDto {
  return {
    id: delivery.id,
    webhookId: delivery.webhookId,
    webhookName,
    eventType: delivery.eventType,
    eventId: delivery.eventId,
    entityType: delivery.entityType,
    entityId: delivery.entityId,
    status: delivery.status,
    attempts: delivery.attempts,
    responseStatusCode: delivery.responseStatusCode,
    durationMs: delivery.durationMs,
    errorMessage: delivery.errorMessage,
    createdAt: delivery.createdAt?.toISOString(),
    lastAttemptAt: delivery.lastAttemptAt?.toISOString(),
    deliveredAt: delivery.deliveredAt?.toISOString(),
  };
}

// =============================================================================
// TEST WEBHOOK DTO
// =============================================================================

export interface TestWebhookDto {
  /** Webhook ID to test */
  webhookId: string;
  
  /** Optional event type to test */
  eventType?: WebhookEventType;
  
  /** Optional custom payload */
  payload?: Record<string, unknown>;
}

export interface TestWebhookResultDto {
  success: boolean;
  webhookId: string;
  eventType: WebhookEventType;
  responseStatusCode?: number;
  responseTimeMs: number;
  errorMessage?: string;
  requestPayload: Record<string, unknown>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}

// =============================================================================
// WEBHOOK LIST QUERY DTO
// =============================================================================

export interface WebhookListQueryDto {
  /** Filter by status */
  status?: WebhookStatus;
  
  /** Filter by event type */
  eventType?: WebhookEventType;
  
  /** Filter by active status */
  isActive?: boolean;
  
  /** Organization ID filter */
  organizationId?: string;
  
  /** Page number (1-indexed) */
  page?: number;
  
  /** Page size */
  limit?: number;
  
  /** Sort by field */
  sortBy?: 'name' | 'createdAt' | 'lastSuccessAt' | 'totalDeliveries';
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

export interface WebhookListResponseDto {
  items: WebhookResponseDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// =============================================================================
// DELIVERY LIST QUERY DTO
// =============================================================================

export interface DeliveryListQueryDto {
  /** Filter by webhook ID */
  webhookId?: string;
  
  /** Filter by event type */
  eventType?: WebhookEventType;
  
  /** Filter by status */
  status?: string;
  
  /** Filter by entity ID */
  entityId?: string;
  
  /** Start date filter */
  startDate?: string;
  
  /** End date filter */
  endDate?: string;
  
  /** Page number (1-indexed) */
  page?: number;
  
  /** Page size */
  limit?: number;
}

export interface DeliveryListResponseDto {
  items: DeliveryResponseDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// =============================================================================
// REPLAY DELIVERY DTO
// =============================================================================

export interface ReplayDeliveryDto {
  /** Delivery ID to replay */
  deliveryId: string;
}

export interface ReplayDeliveryResultDto {
  success: boolean;
  originalDeliveryId: string;
  newDeliveryId?: string;
  message?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateAuthentication(auth: WebhookAuthentication): string[] {
  const errors: string[] = [];
  
  switch (auth.type) {
    case 'hmac_sha256':
      if (!auth.secret || auth.secret.length < 16) {
        errors.push('hmac_sha256 authentication requires a secret of at least 16 characters');
      }
      break;
      
    case 'bearer_token':
      if (!auth.token || auth.token.length < 8) {
        errors.push('bearer_token authentication requires a token of at least 8 characters');
      }
      break;
      
    case 'basic_auth':
      if (!auth.username || !auth.password) {
        errors.push('basic_auth authentication requires both username and password');
      }
      break;
  }
  
  return errors;
}
