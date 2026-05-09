/**
 * CargoBit Webhook API Routes
 * 
 * REST API endpoints for webhook management.
 * 
 * @module @cargobit/webhooks
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  WebhookService,
  InMemoryWebhookStore,
  IWebhookStore,
} from '../services/webhooks.service';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookListQueryDto,
  DeliveryListQueryDto,
  TestWebhookDto,
  toWebhookResponseDto,
  toDeliveryResponseDto,
} from '../dto/webhook.dto';
import { WebhookEventType } from '../entities/webhook-configuration.entity';

// =============================================================================
// SINGLETON SERVICE
// =============================================================================

let webhookService: WebhookService | null = null;

function getWebhookService(): WebhookService {
  if (!webhookService) {
    const store = new InMemoryWebhookStore();
    webhookService = new WebhookService(store);
  }
  return webhookService;
}

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================

async function authenticateRequest(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  // Check for Authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  // In production, validate JWT token
  // For now, check for admin JWT from environment
  if (token === process.env.ADMIN_JWT_SECRET) {
    return { userId: 'admin', role: 'ADMIN' };
  }

  return null;
}

function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
    { status: 401 }
  );
}

function forbiddenResponse(message: string): NextResponse {
  return NextResponse.json(
    { error: message, code: 'FORBIDDEN' },
    { status: 403 }
  );
}

// =============================================================================
// WEBHOOK CRUD ENDPOINTS
// =============================================================================

/**
 * GET /api/webhooks
 * List all webhooks with optional filtering
 */
export async function GET_webhooks(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  
  const query: WebhookListQueryDto = {
    status: searchParams.get('status') as any || undefined,
    eventType: searchParams.get('eventType') as WebhookEventType || undefined,
    isActive: searchParams.get('isActive') === 'true' ? true : searchParams.get('isActive') === 'false' ? false : undefined,
    organizationId: searchParams.get('organizationId') || undefined,
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '20'),
    sortBy: searchParams.get('sortBy') as any || 'createdAt',
    sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc',
  };

  try {
    const service = getWebhookService();
    const { items, total } = await service.listWebhooks(query);

    const response = {
      items: items.map(toWebhookResponseDto),
      total,
      page: query.page,
      limit: query.limit,
      hasMore: total > (query.page! * query.limit!),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/webhooks] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks
 * Create a new webhook
 */
export async function POST_webhooks(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== 'ADMIN') {
    return forbiddenResponse('Only admins can create webhooks');
  }

  try {
    const body = await request.json();
    const dto: CreateWebhookDto = body;

    const service = getWebhookService();
    const webhook = await service.createWebhook(dto, auth.userId);

    return NextResponse.json(toWebhookResponseDto(webhook), { status: 201 });
  } catch (error) {
    console.error('[POST /api/webhooks] Error:', error);
    
    if (error instanceof Error && error.message.includes('Validation failed')) {
      return NextResponse.json(
        { error: error.message, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/[id]
 * Get a specific webhook
 */
export async function GET_webhook(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const service = getWebhookService();
    const webhook = await service.getWebhook(params.id);

    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(toWebhookResponseDto(webhook));
  } catch (error) {
    console.error('[GET /api/webhooks/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/webhooks/[id]
 * Update a webhook
 */
export async function PUT_webhook(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== 'ADMIN') {
    return forbiddenResponse('Only admins can update webhooks');
  }

  try {
    const body = await request.json();
    const dto: UpdateWebhookDto = body;

    const service = getWebhookService();
    const webhook = await service.updateWebhook(params.id, dto);

    if (!webhook) {
      return NextResponse.json(
        { error: 'Webhook not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(toWebhookResponseDto(webhook));
  } catch (error) {
    console.error('[PUT /api/webhooks/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhooks/[id]
 * Delete a webhook
 */
export async function DELETE_webhook(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== 'ADMIN') {
    return forbiddenResponse('Only admins can delete webhooks');
  }

  try {
    const service = getWebhookService();
    const deleted = await service.deleteWebhook(params.id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Webhook not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/webhooks/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/[id]/test
 * Test a webhook endpoint
 */
export async function POST_webhook_test(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const service = getWebhookService();
    
    const testDto: TestWebhookDto = {
      webhookId: params.id,
    };

    const result = await service.testWebhook(testDto);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/webhooks/[id]/test] Error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message, code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELIVERY ENDPOINTS
// =============================================================================

/**
 * GET /api/webhooks/deliveries
 * List webhook deliveries
 */
export async function GET_deliveries(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  
  const query: DeliveryListQueryDto = {
    webhookId: searchParams.get('webhookId') || undefined,
    eventType: searchParams.get('eventType') as WebhookEventType || undefined,
    status: searchParams.get('status') || undefined,
    entityId: searchParams.get('entityId') || undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '20'),
  };

  try {
    const service = getWebhookService();
    const { items, total } = await service.listDeliveries(query);

    // Get webhook names for response
    const webhookNames = new Map<string, string>();
    for (const item of items) {
      if (!webhookNames.has(item.webhookId)) {
        const webhook = await service.getWebhook(item.webhookId);
        webhookNames.set(item.webhookId, webhook?.name || 'Unknown');
      }
    }

    const response = {
      items: items.map(d => toDeliveryResponseDto(d, webhookNames.get(d.webhookId))),
      total,
      page: query.page,
      limit: query.limit,
      hasMore: total > (query.page! * query.limit!),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/webhooks/deliveries] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/deliveries/[id]
 * Get a specific delivery
 */
export async function GET_delivery(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const service = getWebhookService();
    const delivery = await service.getDelivery(params.id);

    if (!delivery) {
      return NextResponse.json(
        { error: 'Delivery not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const webhook = await service.getWebhook(delivery.webhookId);
    return NextResponse.json(toDeliveryResponseDto(delivery, webhook?.name));
  } catch (error) {
    console.error('[GET /api/webhooks/deliveries/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/deliveries/[id]/replay
 * Replay a failed delivery
 */
export async function POST_delivery_replay(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.role !== 'ADMIN') {
    return forbiddenResponse('Only admins can replay deliveries');
  }

  try {
    const service = getWebhookService();
    const newDelivery = await service.replayDelivery(params.id);

    return NextResponse.json({
      success: true,
      originalDeliveryId: params.id,
      newDeliveryId: newDelivery.id,
      message: 'Delivery queued for retry',
    });
  } catch (error) {
    console.error('[POST /api/webhooks/deliveries/[id]/replay] Error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message, code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// =============================================================================
// STATISTICS ENDPOINT
// =============================================================================

/**
 * GET /api/webhooks/statistics
 * Get webhook statistics
 */
export async function GET_statistics(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const service = getWebhookService();
    const stats = await service.getStatistics();

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[GET /api/webhooks/statistics] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// =============================================================================
// EVENT TYPES ENDPOINT
// =============================================================================

/**
 * GET /api/webhooks/event-types
 * Get available event types
 */
export async function GET_event_types(request: NextRequest): Promise<NextResponse> {
  const { EVENT_TYPE_DESCRIPTIONS, ALL_EVENT_TYPES } = await import('../entities/webhook-configuration.entity');
  
  const eventTypes = ALL_EVENT_TYPES.map(type => ({
    type,
    description: EVENT_TYPE_DESCRIPTIONS[type],
  }));

  return NextResponse.json({ eventTypes });
}
