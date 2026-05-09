/**
 * CargoBit Webhook Service
 * 
 * Core service for managing webhook configurations and dispatching events.
 * 
 * @module @cargobit/webhooks
 * @version 1.0.0
 */

import {
  WebhookConfiguration,
  WebhookDelivery,
  WebhookEvent,
  WebhookEventType,
  WebhookStatistics,
  DeliveryStatus,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_TIMEOUT_MS,
  MAX_CONSECUTIVE_FAILURES,
} from '../entities/webhook-configuration.entity';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  TestWebhookDto,
  TestWebhookResultDto,
  WebhookListQueryDto,
  DeliveryListQueryDto,
  validateCreateWebhookDto,
  toWebhookResponseDto,
} from '../dto/webhook.dto';
import { webhookMetrics } from '../metrics/webhook.metrics';

// =============================================================================
// INTERFACES
// =============================================================================

export interface IWebhookStore {
  // Webhook configuration operations
  createWebhook(webhook: Partial<WebhookConfiguration>): Promise<WebhookConfiguration>;
  getWebhook(id: string): Promise<WebhookConfiguration | null>;
  updateWebhook(id: string, data: Partial<WebhookConfiguration>): Promise<WebhookConfiguration | null>;
  deleteWebhook(id: string): Promise<boolean>;
  listWebhooks(query: WebhookListQueryDto): Promise<{ items: WebhookConfiguration[]; total: number }>;
  
  // Webhook delivery operations
  createDelivery(delivery: Partial<WebhookDelivery>): Promise<WebhookDelivery>;
  getDelivery(id: string): Promise<WebhookDelivery | null>;
  updateDelivery(id: string, data: Partial<WebhookDelivery>): Promise<WebhookDelivery | null>;
  listDeliveries(query: DeliveryListQueryDto): Promise<{ items: WebhookDelivery[]; total: number }>;
  getPendingDeliveries(limit: number): Promise<WebhookDelivery[]>;
  
  // Event operations
  createEvent(event: Partial<WebhookEvent>): Promise<WebhookEvent>;
  getPendingEvents(limit: number): Promise<WebhookEvent[]>;
  markEventProcessed(id: string, webhookCount: number, deliveredCount: number): Promise<void>;
  
  // Statistics
  getStatistics(since: Date): Promise<WebhookStatistics>;
}

// =============================================================================
// IN-MEMORY STORE (Development/Testing)
// =============================================================================

export class InMemoryWebhookStore implements IWebhookStore {
  private webhooks: Map<string, WebhookConfiguration> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private events: Map<string, WebhookEvent> = new Map();

  async createWebhook(webhook: Partial<WebhookConfiguration>): Promise<WebhookConfiguration> {
    const id = `wh_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const config: WebhookConfiguration = {
      id,
      name: webhook.name || '',
      description: webhook.description,
      url: webhook.url || '',
      method: webhook.method || 'POST',
      events: webhook.events || [],
      status: webhook.status || 'active',
      authentication: webhook.authentication || { type: 'none' },
      headers: webhook.headers || [],
      retryConfig: webhook.retryConfig || DEFAULT_RETRY_CONFIG,
      timeoutMs: webhook.timeoutMs || DEFAULT_TIMEOUT_MS,
      createdBy: webhook.createdBy || 'system',
      organizationId: webhook.organizationId,
      isActive: webhook.isActive ?? true,
      consecutiveFailures: 0,
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      createdAt: now,
      updatedAt: now,
      ...webhook,
    };
    
    this.webhooks.set(id, config);
    return config;
  }

  async getWebhook(id: string): Promise<WebhookConfiguration | null> {
    return this.webhooks.get(id) || null;
  }

  async updateWebhook(id: string, data: Partial<WebhookConfiguration>): Promise<WebhookConfiguration | null> {
    const existing = this.webhooks.get(id);
    if (!existing) return null;
    
    const updated: WebhookConfiguration = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    
    this.webhooks.set(id, updated);
    return updated;
  }

  async deleteWebhook(id: string): Promise<boolean> {
    return this.webhooks.delete(id);
  }

  async listWebhooks(query: WebhookListQueryDto): Promise<{ items: WebhookConfiguration[]; total: number }> {
    let items = Array.from(this.webhooks.values());
    
    if (query.status) {
      items = items.filter(w => w.status === query.status);
    }
    if (query.eventType) {
      items = items.filter(w => w.events.includes(query.eventType!));
    }
    if (query.isActive !== undefined) {
      items = items.filter(w => w.isActive === query.isActive);
    }
    if (query.organizationId) {
      items = items.filter(w => w.organizationId === query.organizationId);
    }
    
    const total = items.length;
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;
    
    items = items.slice(offset, offset + limit);
    
    return { items, total };
  }

  async createDelivery(delivery: Partial<WebhookDelivery>): Promise<WebhookDelivery> {
    const id = `del_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    
    const record: WebhookDelivery = {
      id,
      webhookId: delivery.webhookId || '',
      eventType: delivery.eventType || 'payout.open',
      eventId: delivery.eventId || '',
      entityType: delivery.entityType || '',
      entityId: delivery.entityId || '',
      status: delivery.status || 'pending',
      payload: delivery.payload || {},
      requestHeaders: delivery.requestHeaders || {},
      attempts: delivery.attempts || 0,
      createdAt: new Date(),
      ...delivery,
    };
    
    this.deliveries.set(id, record);
    return record;
  }

  async getDelivery(id: string): Promise<WebhookDelivery | null> {
    return this.deliveries.get(id) || null;
  }

  async updateDelivery(id: string, data: Partial<WebhookDelivery>): Promise<WebhookDelivery | null> {
    const existing = this.deliveries.get(id);
    if (!existing) return null;
    
    const updated: WebhookDelivery = {
      ...existing,
      ...data,
    };
    
    this.deliveries.set(id, updated);
    return updated;
  }

  async listDeliveries(query: DeliveryListQueryDto): Promise<{ items: WebhookDelivery[]; total: number }> {
    let items = Array.from(this.deliveries.values());
    
    if (query.webhookId) {
      items = items.filter(d => d.webhookId === query.webhookId);
    }
    if (query.eventType) {
      items = items.filter(d => d.eventType === query.eventType);
    }
    if (query.status) {
      items = items.filter(d => d.status === query.status);
    }
    if (query.entityId) {
      items = items.filter(d => d.entityId === query.entityId);
    }
    
    // Sort by created date desc
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    const total = items.length;
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;
    
    items = items.slice(offset, offset + limit);
    
    return { items, total };
  }

  async getPendingDeliveries(limit: number): Promise<WebhookDelivery[]> {
    const now = new Date();
    const pending = Array.from(this.deliveries.values())
      .filter(d => 
        (d.status === 'pending' || d.status === 'retrying') &&
        (!d.nextRetryAt || d.nextRetryAt <= now)
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);
    
    return pending;
  }

  async createEvent(event: Partial<WebhookEvent>): Promise<WebhookEvent> {
    const id = `evt_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    
    const record: WebhookEvent = {
      id,
      type: event.type || 'payout.open',
      entityType: event.entityType || '',
      entityId: event.entityId || '',
      payload: event.payload || {},
      timestamp: event.timestamp || new Date(),
      processed: false,
      webhookCount: 0,
      deliveredCount: 0,
      createdAt: new Date(),
      ...event,
    };
    
    this.events.set(id, record);
    return record;
  }

  async getPendingEvents(limit: number): Promise<WebhookEvent[]> {
    return Array.from(this.events.values())
      .filter(e => !e.processed)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(0, limit);
  }

  async markEventProcessed(id: string, webhookCount: number, deliveredCount: number): Promise<void> {
    const event = this.events.get(id);
    if (event) {
      event.processed = true;
      event.webhookCount = webhookCount;
      event.deliveredCount = deliveredCount;
    }
  }

  async getStatistics(since: Date): Promise<WebhookStatistics> {
    const webhooks = Array.from(this.webhooks.values());
    const deliveries = Array.from(this.deliveries.values()).filter(d => d.createdAt >= since);
    
    const successfulDeliveries = deliveries.filter(d => d.status === 'delivered');
    const failedDeliveries = deliveries.filter(d => d.status === 'failed' || d.status === 'dead_letter');
    
    const avgDeliveryTimeMs = successfulDeliveries.length > 0
      ? successfulDeliveries.reduce((sum, d) => sum + (d.durationMs || 0), 0) / successfulDeliveries.length
      : 0;
    
    return {
      totalWebhooks: webhooks.length,
      activeWebhooks: webhooks.filter(w => w.status === 'active').length,
      pausedWebhooks: webhooks.filter(w => w.status === 'paused').length,
      failedWebhooks: webhooks.filter(w => w.status === 'failed').length,
      totalDeliveries24h: deliveries.length,
      successfulDeliveries24h: successfulDeliveries.length,
      failedDeliveries24h: failedDeliveries.length,
      avgDeliveryTimeMs,
      successRate: deliveries.length > 0 ? (successfulDeliveries.length / deliveries.length) * 100 : 0,
      byEventType: {} as any,
      byWebhook: {} as any,
    };
  }
}

// =============================================================================
// WEBHOOK SERVICE
// =============================================================================

export class WebhookService {
  private store: IWebhookStore;
  private signingSecret: string;

  constructor(store: IWebhookStore, options?: { signingSecret?: string }) {
    this.store = store;
    this.signingSecret = options?.signingSecret || process.env.WEBHOOK_SIGNING_SECRET || 'default-signing-secret';
  }

  // ===========================================================================
  // WEBHOOK CONFIGURATION MANAGEMENT
  // ===========================================================================

  /**
   * Create a new webhook configuration
   */
  async createWebhook(dto: CreateWebhookDto, userId: string): Promise<WebhookConfiguration> {
    const errors = validateCreateWebhookDto(dto);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const webhook = await this.store.createWebhook({
      name: dto.name,
      description: dto.description,
      url: dto.url,
      method: dto.method || 'POST',
      events: dto.events,
      status: 'active',
      authentication: dto.authentication,
      headers: dto.headers || [],
      retryConfig: { ...DEFAULT_RETRY_CONFIG, ...dto.retryConfig },
      timeoutMs: dto.timeoutMs || DEFAULT_TIMEOUT_MS,
      createdBy: userId,
      organizationId: dto.organizationId,
      isActive: true,
      consecutiveFailures: 0,
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
    });

    webhookMetrics.webhooksTotal.inc({ status: 'active' });
    
    return webhook;
  }

  /**
   * Get a webhook by ID
   */
  async getWebhook(id: string): Promise<WebhookConfiguration | null> {
    return this.store.getWebhook(id);
  }

  /**
   * Update a webhook configuration
   */
  async updateWebhook(id: string, dto: UpdateWebhookDto): Promise<WebhookConfiguration | null> {
    const existing = await this.store.getWebhook(id);
    if (!existing) {
      return null;
    }

    const updated = await this.store.updateWebhook(id, dto);
    
    if (updated && dto.status && dto.status !== existing.status) {
      webhookMetrics.webhooksTotal.inc({ status: dto.status });
      webhookMetrics.webhooksTotal.dec({ status: existing.status });
    }
    
    return updated;
  }

  /**
   * Delete a webhook configuration
   */
  async deleteWebhook(id: string): Promise<boolean> {
    const webhook = await this.store.getWebhook(id);
    if (!webhook) {
      return false;
    }

    const deleted = await this.store.deleteWebhook(id);
    
    if (deleted) {
      webhookMetrics.webhooksTotal.dec({ status: webhook.status });
    }
    
    return deleted;
  }

  /**
   * List webhooks with filtering and pagination
   */
  async listWebhooks(query: WebhookListQueryDto): Promise<{ items: WebhookConfiguration[]; total: number }> {
    return this.store.listWebhooks(query);
  }

  // ===========================================================================
  // EVENT DISPATCHING
  // ===========================================================================

  /**
   * Dispatch an event to all subscribed webhooks
   */
  async dispatchEvent(
    type: WebhookEventType,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>
  ): Promise<WebhookEvent> {
    // Create event record
    const event = await this.store.createEvent({
      type,
      entityType,
      entityId,
      payload,
      timestamp: new Date(),
      processed: false,
    });

    // Find all webhooks subscribed to this event type
    const { items: webhooks } = await this.store.listWebhooks({ 
      isActive: true, 
      status: 'active',
      limit: 100 
    });
    
    const subscribedWebhooks = webhooks.filter(w => 
      w.events.includes(type) && w.status === 'active'
    );

    // Create pending deliveries for each webhook
    for (const webhook of subscribedWebhooks) {
      await this.createDeliveryForEvent(webhook, event);
    }

    // Mark event as processed
    await this.store.markEventProcessed(event.id, subscribedWebhooks.length, 0);

    webhookMetrics.eventsDispatched.inc({ event_type: type });

    return event;
  }

  /**
   * Create a delivery record for an event
   */
  private async createDeliveryForEvent(
    webhook: WebhookConfiguration,
    event: WebhookEvent
  ): Promise<WebhookDelivery> {
    // Build payload
    const payload = this.buildPayload(webhook, event);
    
    // Build headers
    const headers = this.buildHeaders(webhook, payload);

    const delivery = await this.store.createDelivery({
      webhookId: webhook.id,
      eventType: event.type,
      eventId: event.id,
      entityType: event.entityType,
      entityId: event.entityId,
      status: 'pending',
      payload,
      requestHeaders: headers,
      attempts: 0,
    });

    webhookMetrics.deliveriesCreated.inc({ 
      webhook_id: webhook.id, 
      event_type: event.type 
    });

    return delivery;
  }

  /**
   * Build the webhook payload
   */
  private buildPayload(webhook: WebhookConfiguration, event: WebhookEvent): Record<string, unknown> {
    return {
      id: event.id,
      type: event.type,
      timestamp: event.timestamp.toISOString(),
      data: {
        entityType: event.entityType,
        entityId: event.entityId,
        ...event.payload,
      },
      webhook: {
        id: webhook.id,
        name: webhook.name,
      },
    };
  }

  /**
   * Build headers including authentication
   */
  private buildHeaders(webhook: WebhookConfiguration, payload: Record<string, unknown>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CargoBit-Webhook/1.0',
      'X-Webhook-ID': webhook.id,
      'X-Event-Type': payload.type as string,
      'X-Event-ID': payload.id as string,
      'X-Timestamp': new Date().toISOString(),
    };

    // Add signature for HMAC authentication
    if (webhook.authentication.type === 'hmac_sha256' && webhook.authentication.secret) {
      const signature = this.generateSignature(payload, webhook.authentication.secret);
      headers['X-Signature'] = signature;
      headers['X-Signature-Algorithm'] = 'hmac-sha256';
    }

    // Add bearer token
    if (webhook.authentication.type === 'bearer_token' && webhook.authentication.token) {
      headers['Authorization'] = `Bearer ${webhook.authentication.token}`;
    }

    // Add basic auth
    if (webhook.authentication.type === 'basic_auth' && webhook.authentication.username && webhook.authentication.password) {
      const credentials = Buffer.from(`${webhook.authentication.username}:${webhook.authentication.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Add custom headers
    for (const header of webhook.headers) {
      if (!header.isSecret || header.value !== '***') {
        headers[header.key] = header.value;
      }
    }

    return headers;
  }

  /**
   * Generate HMAC signature for payload
   */
  private generateSignature(payload: Record<string, unknown>, secret: string): string {
    const crypto = require('crypto');
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    return `sha256=${hmac.digest('hex')}`;
  }

  // ===========================================================================
  // WEBHOOK TESTING
  // ===========================================================================

  /**
   * Test a webhook configuration
   */
  async testWebhook(dto: TestWebhookDto): Promise<TestWebhookResultDto> {
    const webhook = await this.store.getWebhook(dto.webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${dto.webhookId}`);
    }

    const eventType = dto.eventType || webhook.events[0] || 'payout.open';
    
    // Build test payload
    const payload = dto.payload || {
      id: `test_${Date.now()}`,
      type: eventType,
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook delivery',
      },
      webhook: {
        id: webhook.id,
        name: webhook.name,
      },
    };

    const headers = this.buildHeaders(webhook, payload);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(webhook.timeoutMs),
      });

      const responseTimeMs = Date.now() - startTime;
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      const responseBody = await response.text();

      const success = response.ok;

      webhookMetrics.testDeliveries.inc({ 
        webhook_id: webhook.id, 
        success: success.toString() 
      });

      return {
        success,
        webhookId: webhook.id,
        eventType,
        responseStatusCode: response.status,
        responseTimeMs,
        errorMessage: success ? undefined : `HTTP ${response.status}: ${responseBody.substring(0, 500)}`,
        requestPayload: payload,
        responseHeaders,
        responseBody: responseBody.substring(0, 1000),
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      
      webhookMetrics.testDeliveries.inc({ 
        webhook_id: webhook.id, 
        success: 'false' 
      });

      return {
        success: false,
        webhookId: webhook.id,
        eventType,
        responseTimeMs,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        requestPayload: payload,
      };
    }
  }

  // ===========================================================================
  // DELIVERY MANAGEMENT
  // ===========================================================================

  /**
   * Get pending deliveries for processing
   */
  async getPendingDeliveries(limit: number = 100): Promise<WebhookDelivery[]> {
    return this.store.getPendingDeliveries(limit);
  }

  /**
   * List deliveries with filtering
   */
  async listDeliveries(query: DeliveryListQueryDto): Promise<{ items: WebhookDelivery[]; total: number }> {
    return this.store.listDeliveries(query);
  }

  /**
   * Get a delivery by ID
   */
  async getDelivery(id: string): Promise<WebhookDelivery | null> {
    return this.store.getDelivery(id);
  }

  /**
   * Replay a failed delivery
   */
  async replayDelivery(deliveryId: string): Promise<WebhookDelivery> {
    const existing = await this.store.getDelivery(deliveryId);
    if (!existing) {
      throw new Error(`Delivery not found: ${deliveryId}`);
    }

    // Create a new delivery with same data
    const newDelivery = await this.store.createDelivery({
      webhookId: existing.webhookId,
      eventType: existing.eventType,
      eventId: existing.eventId,
      entityType: existing.entityType,
      entityId: existing.entityId,
      status: 'pending',
      payload: existing.payload,
      requestHeaders: existing.requestHeaders,
      attempts: 0,
    });

    webhookMetrics.replaysTotal.inc({ webhook_id: existing.webhookId });

    return newDelivery;
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get webhook statistics
   */
  async getStatistics(): Promise<WebhookStatistics> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    return this.store.getStatistics(since);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { webhookMetrics } from '../metrics/webhook.metrics';
