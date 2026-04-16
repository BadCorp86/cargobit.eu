// CargoBit Order Service
// =======================
// Handles: Orders, Matching, Offers, Assignments

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  Order,
  OrderStatus,
  TransportType,
  Address,
  PaginatedResult,
  PaginationParams,
  ApiResponse
} from '../shared/types';
import {
  generateId,
  Logger,
  AppError,
  ValidationError,
  NotFoundError,
  AuthorizationError,
  successResponse,
  errorResponse,
  getEnv
} from '../shared/utils';

// ============================================
// CONFIGURATION
// ============================================

const logger = new Logger('order-service');
const app = express();

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(express.json());

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || `req_${Date.now()}`;
  next();
});

// Auth middleware - extracts user info from gateway headers
interface AuthRequest extends Request {
  userId?: string;
  partnerId?: string;
  authType?: string;
}

app.use((req: AuthRequest, res: Response, next: NextFunction) => {
  req.userId = req.headers['x-user-id'] as string;
  req.partnerId = req.headers['x-partner-id'] as string;
  req.authType = req.headers['x-auth-type'] as string;
  next();
});

// ============================================
// IN-MEMORY DATABASE
// ============================================

interface StoredOrder extends Order {
  shipperCompanyId?: string;
  carrierCompanyId?: string;
  description?: string;
  weightKg?: number;
  volumeM3?: number;
  distanceKm?: number;
  estimatedDuration?: number;
  shipperBudget?: number;
  agreedPrice?: number;
  isInternational?: boolean;
  transitCountries?: string[];
  publishedAt?: Date;
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

interface MatchingSession {
  id: string;
  orderId: string;
  status: 'started' | 'running' | 'stopped' | 'completed';
  candidates: MatchingCandidate[];
  createdAt: Date;
  completedAt?: Date;
}

interface MatchingCandidate {
  id: string;
  sessionId: string;
  driverId: string;
  vehicleId: string;
  score: number;
  status: 'pending' | 'notified' | 'accepted' | 'rejected';
  createdAt: Date;
}

interface Offer {
  id: string;
  orderId: string;
  driverId: string;
  vehicleId: string;
  price: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

const orders: Map<string, StoredOrder> = new Map();
const matchingSessions: Map<string, MatchingSession> = new Map();
const offers: Map<string, Offer> = new Map();

// ============================================
// ROUTES: ORDERS
// ============================================

// GET /orders - List orders
app.get('/orders', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, pageSize = 20, status, transportType, sortBy = 'createdAt', sortOrder = 'desc' } = req.query as PaginationParams & {
      status?: OrderStatus;
      transportType?: TransportType;
    };

    let filteredOrders = Array.from(orders.values());

    // Apply filters
    if (status) {
      filteredOrders = filteredOrders.filter(o => o.status === status);
    }
    if (transportType) {
      filteredOrders = filteredOrders.filter(o => o.transportType === transportType);
    }

    // Filter by user access
    if (req.userId) {
      // User can see their own orders or orders they're assigned to
      filteredOrders = filteredOrders.filter(o => 
        o.shipperId === req.userId || 
        o.driverId === req.userId
      );
    }

    // Sort
    filteredOrders.sort((a, b) => {
      const aVal = a[sortBy as keyof StoredOrder];
      const bVal = b[sortBy as keyof StoredOrder];
      if (aVal === undefined || bVal === undefined) return 0;
      if (sortOrder === 'asc') {
        return aVal < bVal ? -1 : 1;
      }
      return aVal > bVal ? -1 : 1;
    });

    // Paginate
    const total = filteredOrders.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedOrders = filteredOrders.slice(startIndex, startIndex + pageSize);

    // Set pagination headers
    res.setHeader('X-Total-Count', total.toString());
    res.setHeader('X-Page', page.toString());

    res.json(successResponse({
      data: paginatedOrders.map(o => sanitizeOrder(o)),
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /orders/:id - Get order details
app.get('/orders/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = orders.get(req.params.id);
    
    if (!order) {
      throw new NotFoundError('Order');
    }

    // Check access
    if (req.userId && order.shipperId !== req.userId && order.driverId !== req.userId) {
      throw new AuthorizationError('Access denied to this order');
    }

    res.json(successResponse(sanitizeOrder(order), req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /orders - Create order
app.post('/orders', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      throw new AuthorizationError('Authentication required');
    }

    const {
      transportType,
      pickupAddress,
      deliveryAddress,
      pickupDatetime,
      deliveryDatetime,
      description,
      weightKg,
      volumeM3,
      price,
      currency = 'EUR'
    } = req.body;

    // Validate required fields
    if (!transportType || !pickupAddress || !deliveryAddress || !pickupDatetime) {
      throw new ValidationError('Missing required fields: transportType, pickupAddress, deliveryAddress, pickupDatetime');
    }

    // Create order
    const orderId = generateId('ord');
    const order: StoredOrder = {
      id: orderId,
      shipperId: req.userId,
      transportType: transportType as TransportType,
      status: 'created',
      pickupAddress: pickupAddress as Address,
      deliveryAddress: deliveryAddress as Address,
      pickupDatetime: new Date(pickupDatetime),
      deliveryDatetime: deliveryDatetime ? new Date(deliveryDatetime) : undefined,
      description,
      weightKg,
      volumeM3,
      price,
      currency,
      riskScore: 0,
      riskLevel: 'green',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    orders.set(orderId, order);

    logger.info('Order created', { orderId, userId: req.userId });

    // Trigger risk calculation (async)
    triggerRiskCalculation(orderId);

    res.status(201).json(successResponse(sanitizeOrder(order), req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// PUT /orders/:id - Update order
app.put('/orders/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = orders.get(req.params.id);
    
    if (!order) {
      throw new NotFoundError('Order');
    }

    // Check ownership
    if (req.userId && order.shipperId !== req.userId) {
      throw new AuthorizationError('Only the shipper can update this order');
    }

    // Check if order can be updated
    if (order.status !== 'created' && order.status !== 'published') {
      throw new ValidationError('Order cannot be updated in current status');
    }

    const updates = req.body;
    
    // Apply updates
    Object.assign(order, updates, { updatedAt: new Date() });
    orders.set(order.id, order);

    logger.info('Order updated', { orderId: order.id, userId: req.userId });

    res.json(successResponse(sanitizeOrder(order), req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /orders/:id/publish - Publish order to marketplace
app.post('/orders/:id/publish', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = orders.get(req.params.id);
    
    if (!order) {
      throw new NotFoundError('Order');
    }

    if (req.userId && order.shipperId !== req.userId) {
      throw new AuthorizationError('Only the shipper can publish this order');
    }

    if (order.status !== 'created') {
      throw new ValidationError('Order must be in created status to publish');
    }

    // Update status
    order.status = 'published';
    order.publishedAt = new Date();
    order.updatedAt = new Date();
    orders.set(order.id, order);

    // Start matching process
    const sessionId = await startMatching(order.id);

    logger.info('Order published', { orderId: order.id, sessionId });

    res.json(successResponse({
      order: sanitizeOrder(order),
      matchingSessionId: sessionId
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /orders/:id/status - Update order status
app.post('/orders/:id/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, note } = req.body;
    const order = orders.get(req.params.id);
    
    if (!order) {
      throw new NotFoundError('Order');
    }

    // Validate status transition
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      'created': ['published', 'cancelled'],
      'published': ['assigned', 'cancelled'],
      'assigned': ['in_transit', 'cancelled'],
      'in_transit': ['pickup_done', 'cancelled'],
      'pickup_done': ['delivery_done', 'cancelled'],
      'delivery_done': ['completed'],
      'completed': [],
      'cancelled': []
    };

    if (!validTransitions[order.status].includes(status)) {
      throw new ValidationError(`Cannot transition from ${order.status} to ${status}`);
    }

    // Update status
    const previousStatus = order.status;
    order.status = status;
    order.updatedAt = new Date();

    // Set timestamps
    switch (status) {
      case 'assigned':
        order.assignedAt = new Date();
        break;
      case 'pickup_done':
        order.pickedUpAt = new Date();
        break;
      case 'delivery_done':
        order.deliveredAt = new Date();
        break;
      case 'completed':
        order.completedAt = new Date();
        // Trigger commission calculation
        triggerCommissionCalculation(order.id);
        break;
      case 'cancelled':
        order.cancelledAt = new Date();
        order.cancellationReason = note;
        break;
    }

    orders.set(order.id, order);

    // Log to audit service
    logToAudit({
      action: 'status_change',
      entityType: 'order',
      entityId: order.id,
      userId: req.userId,
      dataBefore: { status: previousStatus },
      dataAfter: { status }
    });

    logger.info('Order status updated', { 
      orderId: order.id, 
      previousStatus, 
      newStatus: status,
      userId: req.userId 
    });

    res.json(successResponse(sanitizeOrder(order), req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /orders/:id/assign - Assign driver/vehicle to order
app.post('/orders/:id/assign', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { driverId, vehicleId, price } = req.body;
    const order = orders.get(req.params.id);
    
    if (!order) {
      throw new NotFoundError('Order');
    }

    if (order.status !== 'published') {
      throw new ValidationError('Order must be published before assignment');
    }

    // Assign
    order.driverId = driverId;
    order.vehicleId = vehicleId;
    order.agreedPrice = price;
    order.status = 'assigned';
    order.assignedAt = new Date();
    order.updatedAt = new Date();
    
    orders.set(order.id, order);

    // Stop matching session
    stopMatching(order.id);

    logger.info('Order assigned', { 
      orderId: order.id, 
      driverId, 
      vehicleId,
      userId: req.userId 
    });

    res.json(successResponse(sanitizeOrder(order), req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: MATCHING
// ============================================

// GET /orders/:orderId/matching - Get matching session
app.get('/orders/:orderId/matching', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = orders.get(req.params.orderId);
    if (!order) {
      throw new NotFoundError('Order');
    }

    const session = Array.from(matchingSessions.values())
      .find(s => s.orderId === req.params.orderId);

    if (!session) {
      throw new NotFoundError('Matching session');
    }

    res.json(successResponse(session, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /matching/:sessionId/candidates - Get matching candidates
app.get('/matching/:sessionId/candidates', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const session = matchingSessions.get(req.params.sessionId);
    if (!session) {
      throw new NotFoundError('Matching session');
    }

    // Sort candidates by score
    const candidates = session.candidates.sort((a, b) => b.score - a.score);

    res.json(successResponse(candidates, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: OFFERS
// ============================================

// GET /orders/:orderId/offers - Get offers for order
app.get('/orders/:orderId/offers', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = orders.get(req.params.orderId);
    if (!order) {
      throw new NotFoundError('Order');
    }

    const orderOffers = Array.from(offers.values())
      .filter(o => o.orderId === req.params.orderId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json(successResponse(orderOffers, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /orders/:orderId/offers - Create offer
app.post('/orders/:orderId/offers', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { driverId, vehicleId, price, message } = req.body;
    const order = orders.get(req.params.orderId);
    
    if (!order) {
      throw new NotFoundError('Order');
    }

    if (order.status !== 'published') {
      throw new ValidationError('Offers can only be made on published orders');
    }

    // Check for existing offer from this driver
    const existingOffer = Array.from(offers.values())
      .find(o => o.orderId === req.params.orderId && o.driverId === driverId);
    
    if (existingOffer) {
      throw new ValidationError('Driver already has an offer on this order');
    }

    const offer: Offer = {
      id: generateId('ofr'),
      orderId: req.params.orderId,
      driverId,
      vehicleId,
      price,
      status: 'pending',
      createdAt: new Date()
    };

    offers.set(offer.id, offer);

    logger.info('Offer created', { offerId: offer.id, orderId: req.params.orderId });

    res.status(201).json(successResponse(offer, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /offers/:id/accept - Accept offer
app.post('/offers/:id/accept', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const offer = offers.get(req.params.id);
    if (!offer) {
      throw new NotFoundError('Offer');
    }

    const order = orders.get(offer.orderId);
    if (!order) {
      throw new NotFoundError('Order');
    }

    // Check ownership
    if (req.userId && order.shipperId !== req.userId) {
      throw new AuthorizationError('Only the shipper can accept offers');
    }

    // Accept this offer
    offer.status = 'accepted';
    offers.set(offer.id, offer);

    // Reject all other offers
    Array.from(offers.values())
      .filter(o => o.orderId === offer.orderId && o.id !== offer.id)
      .forEach(o => {
        o.status = 'rejected';
        offers.set(o.id, o);
      });

    // Assign order
    order.driverId = offer.driverId;
    order.vehicleId = offer.vehicleId;
    order.agreedPrice = offer.price;
    order.status = 'assigned';
    order.assignedAt = new Date();
    order.updatedAt = new Date();
    orders.set(order.id, order);

    logger.info('Offer accepted', { offerId: offer.id, orderId: order.id });

    res.json(successResponse({
      offer,
      order: sanitizeOrder(order)
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function sanitizeOrder(order: StoredOrder): Partial<Order> {
  return {
    id: order.id,
    shipperId: order.shipperId,
    driverId: order.driverId,
    vehicleId: order.vehicleId,
    transportType: order.transportType,
    status: order.status,
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    pickupDatetime: order.pickupDatetime,
    deliveryDatetime: order.deliveryDatetime,
    description: order.description,
    weightKg: order.weightKg,
    volumeM3: order.volumeM3,
    price: order.price,
    agreedPrice: order.agreedPrice,
    currency: order.currency,
    riskScore: order.riskScore,
    riskLevel: order.riskLevel,
    insurancePolicyId: order.insurancePolicyId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

async function startMatching(orderId: string): Promise<string> {
  const sessionId = generateId('ms');
  
  // Create matching session
  const session: MatchingSession = {
    id: sessionId,
    orderId,
    status: 'started',
    candidates: [],
    createdAt: new Date()
  };
  
  matchingSessions.set(sessionId, session);

  // In production: trigger matching algorithm
  // This would call the risk engine and find suitable drivers
  
  return sessionId;
}

function stopMatching(orderId: string): void {
  const session = Array.from(matchingSessions.values())
    .find(s => s.orderId === orderId && s.status !== 'completed');
  
  if (session) {
    session.status = 'stopped';
    session.completedAt = new Date();
    matchingSessions.set(session.id, session);
  }
}

async function triggerRiskCalculation(orderId: string): Promise<void> {
  // In production: call risk-engine service
  logger.debug('Triggering risk calculation', { orderId });
}

async function triggerCommissionCalculation(orderId: string): Promise<void> {
  // In production: call insurance/ad service for commission
  logger.debug('Triggering commission calculation', { orderId });
}

async function logToAudit(event: {
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  dataBefore?: unknown;
  dataAfter?: unknown;
}): Promise<void> {
  // In production: call audit-service
  logger.debug('Logging to audit', event);
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'order-service',
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    stats: {
      orders: orders.size,
      matchingSessions: matchingSessions.size,
      offers: offers.size
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err, { requestId: req.headers['x-request-id'] });
  
  const error = err instanceof AppError ? err : new AppError(err.message);
  
  res.status(error.statusCode).json(errorResponse(error, req.headers['x-request-id'] as string));
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3002;

// Seed some demo orders
function seedDemoData() {
  const demoOrder: StoredOrder = {
    id: 'ord_demo_001',
    shipperId: 'usr_admin',
    transportType: 'pallet',
    status: 'published',
    pickupAddress: {
      street: 'Hauptstraße',
      streetNumber: '1',
      postalCode: '10115',
      city: 'Berlin',
      country: 'DE'
    },
    deliveryAddress: {
      street: 'Marienplatz',
      streetNumber: '8',
      postalCode: '80331',
      city: 'München',
      country: 'DE'
    },
    pickupDatetime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    description: '5 Paletten Elektronik',
    weightKg: 500,
    volumeM3: 10,
    price: 450,
    currency: 'EUR',
    riskScore: 15,
    riskLevel: 'green',
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  orders.set(demoOrder.id, demoOrder);
  logger.info('Demo data seeded');
}

seedDemoData();

app.listen(PORT, () => {
  logger.info(`Order service started on port ${PORT}`);
});

export default app;
