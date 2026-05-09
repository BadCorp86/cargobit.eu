/**
 * CargoBit Webhook Service Tests
 * 
 * Unit tests for the WebhookService class.
 * 
 * @module @cargobit/webhooks
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WebhookService,
  InMemoryWebhookStore,
} from '../services/webhooks.service';
import {
  WebhookConfiguration,
  WebhookEventType,
  DEFAULT_RETRY_CONFIG,
} from '../entities/webhook-configuration.entity';
import { CreateWebhookDto } from '../dto/webhook.dto';

// =============================================================================
// MOCKS
// =============================================================================

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// =============================================================================
// TESTS
// =============================================================================

describe('WebhookService', () => {
  let service: WebhookService;
  let store: InMemoryWebhookStore;

  beforeEach(() => {
    store = new InMemoryWebhookStore();
    service = new WebhookService(store, {
      signingSecret: 'test-signing-secret',
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // WEBHOOK CREATION
  // ===========================================================================

  describe('createWebhook', () => {
    it('should create a webhook with valid data', async () => {
      const dto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['payout.open', 'payout.reconciled'],
        authentication: { type: 'none' },
      };

      const webhook = await service.createWebhook(dto, 'user-123');

      expect(webhook.id).toBeDefined();
      expect(webhook.name).toBe('Test Webhook');
      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.events).toEqual(['payout.open', 'payout.reconciled']);
      expect(webhook.status).toBe('active');
      expect(webhook.isActive).toBe(true);
    });

    it('should reject invalid URL', async () => {
      const dto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'not-a-url',
        events: ['payout.open'],
        authentication: { type: 'none' },
      };

      await expect(service.createWebhook(dto, 'user-123'))
        .rejects.toThrow('Validation failed');
    });

    it('should reject empty events array', async () => {
      const dto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: [],
        authentication: { type: 'none' },
      };

      await expect(service.createWebhook(dto, 'user-123'))
        .rejects.toThrow('at least one event type is required');
    });

    it('should reject invalid event type', async () => {
      const dto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['invalid.event' as WebhookEventType],
        authentication: { type: 'none' },
      };

      await expect(service.createWebhook(dto, 'user-123'))
        .rejects.toThrow('invalid event type');
    });

    it('should validate HMAC authentication requires secret', async () => {
      const dto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'hmac_sha256' },
      };

      await expect(service.createWebhook(dto, 'user-123'))
        .rejects.toThrow('hmac_sha256 authentication requires a secret');
    });

    it('should validate bearer token authentication requires token', async () => {
      const dto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'bearer_token' },
      };

      await expect(service.createWebhook(dto, 'user-123'))
        .rejects.toThrow('bearer_token authentication requires a token');
    });

    it('should validate basic auth requires username and password', async () => {
      const dto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'basic_auth' },
      };

      await expect(service.createWebhook(dto, 'user-123'))
        .rejects.toThrow('basic_auth authentication requires both username and password');
    });

    it('should apply custom retry configuration', async () => {
      const dto: CreateWebhookDto = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'none' },
        retryConfig: {
          maxRetries: 10,
          initialDelayMs: 2000,
        },
      };

      const webhook = await service.createWebhook(dto, 'user-123');

      expect(webhook.retryConfig.maxRetries).toBe(10);
      expect(webhook.retryConfig.initialDelayMs).toBe(2000);
      // Should keep defaults for unspecified fields
      expect(webhook.retryConfig.backoffMultiplier).toBe(DEFAULT_RETRY_CONFIG.backoffMultiplier);
    });
  });

  // ===========================================================================
  // WEBHOOK MANAGEMENT
  // ===========================================================================

  describe('getWebhook', () => {
    it('should return null for non-existent webhook', async () => {
      const webhook = await service.getWebhook('non-existent');
      expect(webhook).toBeNull();
    });

    it('should return existing webhook', async () => {
      const created = await service.createWebhook({
        name: 'Test',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'none' },
      }, 'user-123');

      const retrieved = await service.getWebhook(created.id);
      expect(retrieved).toEqual(created);
    });
  });

  describe('updateWebhook', () => {
    it('should update webhook name', async () => {
      const created = await service.createWebhook({
        name: 'Test',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'none' },
      }, 'user-123');

      const updated = await service.updateWebhook(created.id, {
        name: 'Updated Name',
      });

      expect(updated?.name).toBe('Updated Name');
    });

    it('should return null for non-existent webhook', async () => {
      const updated = await service.updateWebhook('non-existent', {
        name: 'Updated',
      });
      expect(updated).toBeNull();
    });

    it('should pause webhook', async () => {
      const created = await service.createWebhook({
        name: 'Test',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'none' },
      }, 'user-123');

      const updated = await service.updateWebhook(created.id, {
        status: 'paused',
      });

      expect(updated?.status).toBe('paused');
    });
  });

  describe('deleteWebhook', () => {
    it('should delete existing webhook', async () => {
      const created = await service.createWebhook({
        name: 'Test',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'none' },
      }, 'user-123');

      const deleted = await service.deleteWebhook(created.id);
      expect(deleted).toBe(true);

      const retrieved = await service.getWebhook(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent webhook', async () => {
      const deleted = await service.deleteWebhook('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ===========================================================================
  // EVENT DISPATCHING
  // ===========================================================================

  describe('dispatchEvent', () => {
    it('should create event and deliveries for subscribed webhooks', async () => {
      // Create two webhooks subscribed to payout.open
      await service.createWebhook({
        name: 'Webhook 1',
        url: 'https://example1.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'none' },
      }, 'user-123');

      await service.createWebhook({
        name: 'Webhook 2',
        url: 'https://example2.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'none' },
      }, 'user-123');

      // Create webhook subscribed to different event
      await service.createWebhook({
        name: 'Webhook 3',
        url: 'https://example3.com/webhook',
        events: ['payout.reconciled'],
        authentication: { type: 'none' },
      }, 'user-123');

      const event = await service.dispatchEvent(
        'payout.open',
        'payout',
        'payout-123',
        { amount: 1000, currency: 'EUR' }
      );

      expect(event.id).toBeDefined();
      expect(event.type).toBe('payout.open');
      expect(event.entityType).toBe('payout');
      expect(event.entityId).toBe('payout-123');
      expect(event.processed).toBe(true);
    });

    it('should include correct payload structure', async () => {
      await service.createWebhook({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'none' },
      }, 'user-123');

      const event = await service.dispatchEvent(
        'payout.open',
        'payout',
        'payout-123',
        { amount: 1000 }
      );

      const deliveries = await service.getPendingDeliveries(10);
      expect(deliveries.length).toBeGreaterThan(0);

      const payload = deliveries[0].payload;
      expect(payload.id).toBe(event.id);
      expect(payload.type).toBe('payout.open');
      expect(payload.data).toBeDefined();
      expect((payload.data as any).amount).toBe(1000);
    });
  });

  // ===========================================================================
  // WEBHOOK TESTING
  // ===========================================================================

  describe('testWebhook', () => {
    it('should successfully test a webhook endpoint', async () => {
      const webhook = await service.createWebhook({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'none' },
      }, 'user-123');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{"received": true}',
      });

      const result = await service.testWebhook({ webhookId: webhook.id });

      expect(result.success).toBe(true);
      expect(result.responseStatusCode).toBe(200);
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Object),
          body: expect.any(String),
        })
      );
    });

    it('should handle webhook test failure', async () => {
      const webhook = await service.createWebhook({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'none' },
      }, 'user-123');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: async () => 'Internal Server Error',
      });

      const result = await service.testWebhook({ webhookId: webhook.id });

      expect(result.success).toBe(false);
      expect(result.responseStatusCode).toBe(500);
      expect(result.errorMessage).toContain('500');
    });

    it('should handle network errors', async () => {
      const webhook = await service.createWebhook({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'none' },
      }, 'user-123');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.testWebhook({ webhookId: webhook.id });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Network error');
    });

    it('should throw for non-existent webhook', async () => {
      await expect(service.testWebhook({ webhookId: 'non-existent' }))
        .rejects.toThrow('Webhook not found');
    });
  });

  // ===========================================================================
  // SIGNATURE GENERATION
  // ===========================================================================

  describe('signature generation', () => {
    it('should include HMAC signature when configured', async () => {
      const webhook = await service.createWebhook({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: {
          type: 'hmac_sha256',
          secret: 'super-secret-key-12345',
        },
      }, 'user-123');

      // Trigger event to create delivery
      await service.dispatchEvent('payout.open', 'payout', 'payout-123', {});

      const deliveries = await service.getPendingDeliveries(10);
      expect(deliveries.length).toBe(1);

      const headers = deliveries[0].requestHeaders;
      expect(headers['X-Signature']).toBeDefined();
      expect(headers['X-Signature-Algorithm']).toBe('hmac-sha256');
    });

    it('should include bearer token when configured', async () => {
      const webhook = await service.createWebhook({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: {
          type: 'bearer_token',
          token: 'my-api-token-123',
        },
      }, 'user-123');

      await service.dispatchEvent('payout.open', 'payout', 'payout-123', {});

      const deliveries = await service.getPendingDeliveries(10);
      const headers = deliveries[0].requestHeaders;

      expect(headers['Authorization']).toBe('Bearer my-api-token-123');
    });

    it('should include basic auth when configured', async () => {
      const webhook = await service.createWebhook({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['payout.open'],
        authentication: {
          type: 'basic_auth',
          username: 'user',
          password: 'pass',
        },
      }, 'user-123');

      await service.dispatchEvent('payout.open', 'payout', 'payout-123', {});

      const deliveries = await service.getPendingDeliveries(10);
      const headers = deliveries[0].requestHeaders;

      const expected = `Basic ${Buffer.from('user:pass').toString('base64')}`;
      expect(headers['Authorization']).toBe(expected);
    });
  });

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  describe('getStatistics', () => {
    it('should return statistics', async () => {
      await service.createWebhook({
        name: 'Webhook 1',
        url: 'https://example1.com/webhook',
        events: ['payout.open'],
        authentication: { type: 'none' },
      }, 'user-123');

      await service.createWebhook({
        name: 'Webhook 2',
        url: 'https://example2.com/webhook',
        events: ['payout.reconciled'],
        authentication: { type: 'none' },
      }, 'user-123');

      const stats = await service.getStatistics();

      expect(stats.totalWebhooks).toBe(2);
      expect(stats.activeWebhooks).toBe(2);
      expect(stats.pausedWebhooks).toBe(0);
      expect(stats.failedWebhooks).toBe(0);
    });
  });
});
