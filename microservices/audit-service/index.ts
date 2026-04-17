// CargoBit Audit Service
// ========================
// Handles: Append-only Audit Log, Hash Chain, WORM Storage

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import {
  AuditEvent,
  AuditAction,
  ApiResponse
} from '../shared/types';
import {
  generateId,
  createHashChain,
  Logger,
  AppError,
  ValidationError,
  successResponse,
  errorResponse,
  getEnv
} from '../shared/utils';

// ============================================
// CONFIGURATION
// ============================================

const logger = new Logger('audit-service');
const app = express();

// Genesis hash (first hash in the chain)
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(express.json());

interface AuthRequest extends Request {
  userId?: string;
  partnerId?: string;
  serviceId?: string;
}

app.use((req: AuthRequest, res: Response, next: NextFunction) => {
  req.userId = req.headers['x-user-id'] as string;
  req.partnerId = req.headers['x-partner-id'] as string;
  req.serviceId = req.headers['x-service-id'] as string;
  req.headers['x-request-id'] = req.headers['x-request-id'] || `req_${Date.now()}`;
  next();
});

// ============================================
// IN-MEMORY DATABASE
// ============================================

interface StoredAuditEvent extends AuditEvent {
  chainIndex: number;
}

const auditEvents: Map<string, StoredAuditEvent> = new Map();
const eventIndex: string[] = []; // For ordered access
let lastHash = GENESIS_HASH;

// Statistics
let stats = {
  totalEvents: 0,
  eventsByAction: {} as Record<string, number>,
  eventsByEntityType: {} as Record<string, number>
};

// ============================================
// ROUTES: AUDIT EVENTS
// ============================================

// POST /audit/events - Create audit event
app.post('/audit/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      action,
      entityType,
      entityId,
      userId,
      partnerId,
      serviceId,
      dataBefore,
      dataAfter,
      ipAddress,
      userAgent,
      requestId
    } = req.body;

    // Validate required fields
    if (!action || !entityType || !entityId) {
      throw new ValidationError('Missing required fields: action, entityType, entityId');
    }

    // Create event data for hashing
    const eventData = JSON.stringify({
      action,
      entityType,
      entityId,
      userId: userId || req.headers['x-user-id'],
      partnerId: partnerId || req.headers['x-partner-id'],
      dataBefore,
      dataAfter,
      timestamp: new Date().toISOString()
    });

    // Calculate hash chain
    const currentHash = createHashChain(lastHash, eventData);
    const chainIndex = eventIndex.length;

    // Create audit event
    const eventId = generateId('aud');
    const event: StoredAuditEvent = {
      id: eventId,
      timestamp: new Date(),
      action: action as AuditAction,
      entityType,
      entityId,
      userId: userId || req.headers['x-user-id'] as string,
      partnerId: partnerId || req.headers['x-partner-id'] as string,
      serviceId: serviceId || req.headers['x-service-id'] as string,
      dataBefore,
      dataAfter,
      ipAddress: ipAddress || req.ip,
      userAgent: userAgent || req.headers['user-agent'],
      requestId: requestId || req.headers['x-request-id'] as string,
      previousHash: lastHash,
      hash: currentHash,
      chainIndex
    };

    // Store event
    auditEvents.set(eventId, event);
    eventIndex.push(eventId);
    lastHash = currentHash;

    // Update statistics
    stats.totalEvents++;
    stats.eventsByAction[action] = (stats.eventsByAction[action] || 0) + 1;
    stats.eventsByEntityType[entityType] = (stats.eventsByEntityType[entityType] || 0) + 1;

    logger.info('Audit event recorded', { 
      eventId, 
      action, 
      entityType, 
      entityId,
      chainIndex 
    });

    res.status(201).json(successResponse({
      id: event.id,
      timestamp: event.timestamp,
      action: event.action,
      hash: event.hash
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /audit/events - List audit events
app.get('/audit/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      action,
      entityType,
      entityId,
      userId,
      startDate,
      endDate,
      page = 1,
      pageSize = 50
    } = req.query;

    // Build filter
    let filtered = Array.from(auditEvents.values());

    if (action) {
      filtered = filtered.filter(e => e.action === action);
    }
    if (entityType) {
      filtered = filtered.filter(e => e.entityType === entityType);
    }
    if (entityId) {
      filtered = filtered.filter(e => e.entityId === entityId);
    }
    if (userId) {
      filtered = filtered.filter(e => e.userId === userId);
    }
    if (startDate) {
      const start = new Date(startDate as string);
      filtered = filtered.filter(e => e.timestamp >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      filtered = filtered.filter(e => e.timestamp <= end);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Paginate
    const total = filtered.length;
    const totalPages = Math.ceil(total / Number(pageSize));
    const startIndex = (Number(page) - 1) * Number(pageSize);
    const paginated = filtered.slice(startIndex, startIndex + Number(pageSize));

    res.setHeader('X-Total-Count', total.toString());
    res.setHeader('X-Page', page.toString());

    res.json(successResponse({
      data: paginated,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /audit/events/:id - Get single event
app.get('/audit/events/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = auditEvents.get(req.params.id);
    
    if (!event) {
      throw new Error('Audit event not found');
    }

    res.json(successResponse(event, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /audit/events/:id/verify - Verify event integrity
app.get('/audit/events/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = auditEvents.get(req.params.id);
    
    if (!event) {
      throw new Error('Audit event not found');
    }

    // Reconstruct the data that was hashed
    const eventData = JSON.stringify({
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      userId: event.userId,
      partnerId: event.partnerId,
      dataBefore: event.dataBefore,
      dataAfter: event.dataAfter,
      timestamp: event.timestamp.toISOString()
    });

    // Verify hash
    const calculatedHash = createHashChain(event.previousHash, eventData);
    const hashValid = calculatedHash === event.hash;

    // Verify chain link (check previous event exists)
    let chainValid = true;
    if (event.chainIndex > 0) {
      const prevEvent = auditEvents.get(eventIndex[event.chainIndex - 1]);
      chainValid = prevEvent?.hash === event.previousHash;
    } else {
      chainValid = event.previousHash === GENESIS_HASH;
    }

    res.json(successResponse({
      eventId: event.id,
      chainIndex: event.chainIndex,
      hashValid,
      chainValid,
      verified: hashValid && chainValid,
      hash: event.hash,
      previousHash: event.previousHash
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /audit/chain/verify - Verify entire chain
app.get('/audit/chain/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromIndex = 0, toIndex } = req.query;
    
    const start = Number(fromIndex);
    const end = toIndex ? Number(toIndex) : eventIndex.length - 1;

    let validEvents = 0;
    let invalidEvents = 0;
    let previousHash = start === 0 ? GENESIS_HASH : 
      (auditEvents.get(eventIndex[start - 1])?.hash || GENESIS_HASH);

    const errors: { index: number; error: string }[] = [];

    for (let i = start; i <= end && i < eventIndex.length; i++) {
      const event = auditEvents.get(eventIndex[i]);
      
      if (!event) {
        invalidEvents++;
        errors.push({ index: i, error: 'Event not found' });
        continue;
      }

      // Verify hash
      const eventData = JSON.stringify({
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        userId: event.userId,
        partnerId: event.partnerId,
        dataBefore: event.dataBefore,
        dataAfter: event.dataAfter,
        timestamp: event.timestamp.toISOString()
      });

      const calculatedHash = createHashChain(previousHash, eventData);
      
      if (calculatedHash !== event.hash) {
        invalidEvents++;
        errors.push({ index: i, error: 'Hash mismatch' });
      } else if (event.previousHash !== previousHash) {
        invalidEvents++;
        errors.push({ index: i, error: 'Chain link broken' });
      } else {
        validEvents++;
      }

      previousHash = event.hash;
    }

    res.json(successResponse({
      verified: invalidEvents === 0,
      totalChecked: (end - start + 1),
      validEvents,
      invalidEvents,
      errors: errors.slice(0, 10), // Limit error output
      lastVerifiedHash: previousHash
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: ENTITY AUDIT TRAIL
// ============================================

// GET /audit/trail/:entityType/:entityId - Get full audit trail for entity
app.get('/audit/trail/:entityType/:entityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId } = req.params;

    const trail = Array.from(auditEvents.values())
      .filter(e => e.entityType === entityType && e.entityId === entityId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    res.json(successResponse({
      entityType,
      entityId,
      events: trail,
      total: trail.length
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: STATISTICS
// ============================================

// GET /audit/stats - Get audit statistics
app.get('/audit/stats', (req: Request, res: Response) => {
  res.json(successResponse({
    totalEvents: stats.totalEvents,
    byAction: stats.eventsByAction,
    byEntityType: stats.eventsByEntityType,
    chainLength: eventIndex.length,
    lastHash,
    genesisHash: GENESIS_HASH
  }, req.headers['x-request-id'] as string));
});

// ============================================
// ROUTES: EXPORT
// ============================================

// GET /audit/export - Export audit log
app.get('/audit/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;

    let filtered = Array.from(auditEvents.values());

    if (startDate) {
      const start = new Date(startDate as string);
      filtered = filtered.filter(e => e.timestamp >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      filtered = filtered.filter(e => e.timestamp <= end);
    }

    // Sort by chain index
    filtered.sort((a, b) => a.chainIndex - b.chainIndex);

    if (format === 'csv') {
      // Generate CSV
      const headers = ['id', 'timestamp', 'action', 'entityType', 'entityId', 'userId', 'hash'];
      const csv = [
        headers.join(','),
        ...filtered.map(e => [
          e.id,
          e.timestamp.toISOString(),
          e.action,
          e.entityType,
          e.entityId,
          e.userId || '',
          e.hash
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-export.csv');
      res.send(csv);
    } else {
      res.json(successResponse({
        data: filtered,
        exportedAt: new Date(),
        count: filtered.length
      }, req.headers['x-request-id'] as string));
    }
  } catch (error) {
    next(error);
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'audit-service',
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    stats: {
      totalEvents: stats.totalEvents,
      chainLength: eventIndex.length
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

const PORT = process.env.PORT || 3006;

app.listen(PORT, () => {
  logger.info(`Audit service started on port ${PORT}`);
  logger.info(`Genesis hash: ${GENESIS_HASH}`);
});

export default app;
