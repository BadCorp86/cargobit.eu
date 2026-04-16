// CargoBit API Gateway
// =====================
// Single Entry Point for all microservices
// Features: Routing, Auth, Rate-Limiting, mTLS, Logging

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import httpProxy from 'http-proxy-middleware';
import {
  GatewayRequest,
  GatewayResponse,
  RateLimitInfo,
  ApiResponse
} from '../shared/types';
import {
  Logger,
  AppError,
  RateLimitError,
  generateRequestId,
  RateLimiter,
  getEnv
} from '../shared/utils';

// ============================================
// CONFIGURATION
// ============================================

const logger = new Logger('api-gateway');
const app = express();

// Service URLs
const SERVICE_URLS = {
  auth: getEnv('AUTH_SERVICE_URL', 'http://localhost:3001'),
  orders: getEnv('ORDER_SERVICE_URL', 'http://localhost:3002'),
  insurance: getEnv('INSURANCE_SERVICE_URL', 'http://localhost:3003'),
  ads: getEnv('AD_SERVICE_URL', 'http://localhost:3004'),
  risk: getEnv('RISK_SERVICE_URL', 'http://localhost:3005'),
  audit: getEnv('AUDIT_SERVICE_URL', 'http://localhost:3006'),
  notifications: getEnv('NOTIFICATION_SERVICE_URL', 'http://localhost:3007'),
  partners: getEnv('PARTNER_SERVICE_URL', 'http://localhost:3008')
};

// Rate Limiters
const userRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100
});

const partnerRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 300
});

const internalRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10000 // Unlimited for internal services
});

// ============================================
// GATEWAY CONFIGURATION (Kong-like)
// ============================================

interface RouteConfig {
  service: keyof typeof SERVICE_URLS;
  path: string;
  authRequired: boolean;
  authType: 'user' | 'partner' | 'service' | 'public';
  permissions?: string[];
  rateLimit?: 'user' | 'partner' | 'internal';
  cache?: {
    enabled: boolean;
    ttl: number;
  };
}

const routes: RouteConfig[] = [
  // Auth Service
  { service: 'auth', path: '/auth/login', authRequired: false, authType: 'public', rateLimit: 'user' },
  { service: 'auth', path: '/auth/register', authRequired: false, authType: 'public', rateLimit: 'user' },
  { service: 'auth', path: '/auth/refresh', authRequired: false, authType: 'public', rateLimit: 'user' },
  { service: 'auth', path: '/auth/logout', authRequired: true, authType: 'user', rateLimit: 'user' },
  { service: 'auth', path: '/auth/me', authRequired: true, authType: 'user', rateLimit: 'user' },
  { service: 'auth', path: '/auth/validate', authRequired: false, authType: 'service', rateLimit: 'internal' },
  
  // Partner Auth
  { service: 'auth', path: '/partners', authRequired: true, authType: 'user', permissions: ['partners:create'], rateLimit: 'user' },
  { service: 'auth', path: '/partners/:id', authRequired: true, authType: 'partner', rateLimit: 'partner' },
  
  // Order Service
  { service: 'orders', path: '/orders', authRequired: true, authType: 'user', permissions: ['orders:read'], rateLimit: 'user' },
  { service: 'orders', path: '/orders/:id', authRequired: true, authType: 'user', rateLimit: 'user' },
  { service: 'orders', path: '/orders/:id/status', authRequired: true, authType: 'user', permissions: ['orders:update'], rateLimit: 'user' },
  { service: 'orders', path: '/orders/:id/assign', authRequired: true, authType: 'user', permissions: ['orders:update'], rateLimit: 'user' },
  
  // Insurance Service (Partner access)
  { service: 'insurance', path: '/insurance/quote', authRequired: true, authType: 'partner', rateLimit: 'partner', cache: { enabled: true, ttl: 300 } },
  { service: 'insurance', path: '/insurance/policy', authRequired: true, authType: 'partner', rateLimit: 'partner' },
  { service: 'insurance', path: '/insurance/:id', authRequired: true, authType: 'user', rateLimit: 'user' },
  
  // Ad Service (Partner access)
  { service: 'ads', path: '/ads/campaigns', authRequired: true, authType: 'partner', rateLimit: 'partner' },
  { service: 'ads', path: '/ads/impression', authRequired: false, authType: 'public', rateLimit: 'internal', cache: { enabled: true, ttl: 5 } },
  { service: 'ads', path: '/ads/click', authRequired: false, authType: 'public', rateLimit: 'internal' },
  { service: 'ads', path: '/ads/render', authRequired: false, authType: 'public', rateLimit: 'internal', cache: { enabled: true, ttl: 5 } },
  
  // Risk Engine (Internal access)
  { service: 'risk', path: '/risk/calculate', authRequired: true, authType: 'service', rateLimit: 'internal' },
  { service: 'risk', path: '/risk/score/:id', authRequired: true, authType: 'user', rateLimit: 'user' },
  { service: 'risk', path: '/risk/rules', authRequired: true, authType: 'user', permissions: ['admin'], rateLimit: 'user' },
  
  // Audit Service (Admin access)
  { service: 'audit', path: '/audit/events', authRequired: true, authType: 'user', permissions: ['audit:read'], rateLimit: 'user' },
  { service: 'audit', path: '/audit/events/:id', authRequired: true, authType: 'user', permissions: ['audit:read'], rateLimit: 'user' },
  
  // Notification Service
  { service: 'notifications', path: '/notifications', authRequired: true, authType: 'user', rateLimit: 'user' },
  { service: 'notifications', path: '/notifications/:id/read', authRequired: true, authType: 'user', rateLimit: 'user' }
];

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors({
  origin: getEnv('CORS_ORIGINS', '*').split(','),
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || generateRequestId();
  req.headers['x-request-start'] = Date.now().toString();
  next();
});

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info('Incoming request', {
    requestId: req.headers['x-request-id'],
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  next();
});

// ============================================
// AUTH VALIDATION (calls Auth Service)
// ============================================

interface AuthContext {
  type: 'user' | 'partner' | 'service' | 'public';
  userId?: string;
  partnerId?: string;
  serviceId?: string;
  permissions?: string[];
  scopes?: string[];
}

async function validateAuth(authHeader: string | undefined, apiKey: string | undefined): Promise<AuthContext> {
  // Check for API Key (Partner auth)
  if (apiKey) {
    try {
      const response = await fetch(`${SERVICE_URLS.auth}/validate-api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      
      const result = await response.json() as ApiResponse;
      
      if (result.success && result.data?.valid) {
        return {
          type: 'partner',
          partnerId: result.data.partner.id,
          scopes: result.data.partner.scopes.flatMap((s: { actions: string[] }) => s.actions)
        };
      }
    } catch (error) {
      logger.error('Failed to validate API key', error as Error);
    }
  }
  
  // Check for JWT (User auth)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    
    try {
      const response = await fetch(`${SERVICE_URLS.auth}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      const result = await response.json() as ApiResponse;
      
      if (result.success && result.data?.valid) {
        const payload = result.data.payload;
        return {
          type: payload.type === 'service' ? 'service' : 'user',
          userId: payload.sub,
          serviceId: payload.service,
          permissions: payload.permissions
        };
      }
    } catch (error) {
      logger.error('Failed to validate token', error as Error);
    }
  }
  
  return { type: 'public' };
}

// ============================================
// RATE LIMITING MIDDLEWARE
// ============================================

function rateLimitMiddleware(rateLimitType: 'user' | 'partner' | 'internal') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = 
      (req.headers['x-user-id'] as string) ||
      (req.headers['x-partner-id'] as string) ||
      (req.headers['x-api-key'] as string) ||
      req.ip ||
      'anonymous';
    
    let limiter: RateLimiter;
    switch (rateLimitType) {
      case 'partner':
        limiter = partnerRateLimiter;
        break;
      case 'internal':
        limiter = internalRateLimiter;
        break;
      default:
        limiter = userRateLimiter;
    }
    
    const result = limiter.check(identifier);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', result.remaining > 0 ? 100 : 100);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());
    
    if (!result.allowed) {
      throw new RateLimitError(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
    }
    
    next();
  };
}

// ============================================
// ROUTE MATCHING
// ============================================

function matchRoute(path: string): RouteConfig | null {
  // Sort routes by specificity (longer paths first)
  const sortedRoutes = [...routes].sort((a, b) => b.path.length - a.path.length);
  
  for (const route of sortedRoutes) {
    // Convert route pattern to regex
    const pattern = route.path
      .replace(/:[^/]+/g, '[^/]+')
      .replace(/\//g, '\\/');
    
    const regex = new RegExp(`^${pattern}(/.*)?$`);
    
    if (regex.test(path)) {
      return route;
    }
  }
  
  return null;
}

// ============================================
// MAIN ROUTER
// ============================================

app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = req.headers['x-request-id'] as string;
    const startTime = parseInt(req.headers['x-request-start'] as string) || Date.now();
    
    // Match route
    const routeConfig = matchRoute(req.path);
    
    if (!routeConfig) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `No route found for ${req.method} ${req.path}`
        },
        meta: { requestId, timestamp: new Date().toISOString() }
      });
      return;
    }
    
    // Validate authentication
    const authContext = await validateAuth(
      req.headers.authorization,
      req.headers['x-api-key'] as string
    );
    
    // Check if auth is required
    if (routeConfig.authRequired) {
      if (authContext.type === 'public') {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required for this endpoint'
          },
          meta: { requestId, timestamp: new Date().toISOString() }
        });
        return;
      }
      
      // Check auth type matches
      if (routeConfig.authType !== 'public' && authContext.type !== routeConfig.authType) {
        res.status(403).json({
          success: false,
          error: {
            code: 'AUTHORIZATION_FAILED',
            message: `This endpoint requires ${routeConfig.authType} authentication`
          },
          meta: { requestId, timestamp: new Date().toISOString() }
        });
        return;
      }
      
      // Check permissions
      if (routeConfig.permissions && routeConfig.permissions.length > 0) {
        const hasPermission = routeConfig.permissions.some(perm => {
          if (perm === 'admin') {
            return authContext.permissions?.includes('*');
          }
          return authContext.permissions?.includes(perm) || 
                 authContext.permissions?.includes('*');
        });
        
        if (!hasPermission) {
          res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: `Missing required permission: ${routeConfig.permissions.join(', ')}`
            },
            meta: { requestId, timestamp: new Date().toISOString() }
          });
          return;
        }
      }
    }
    
    // Apply rate limiting
    if (routeConfig.rateLimit) {
      const rateLimitType = routeConfig.rateLimit;
      const identifier = 
        authContext.userId ||
        authContext.partnerId ||
        req.ip ||
        'anonymous';
      
      let limiter: RateLimiter;
      switch (rateLimitType) {
        case 'partner':
          limiter = partnerRateLimiter;
          break;
        case 'internal':
          limiter = internalRateLimiter;
          break;
        default:
          limiter = userRateLimiter;
      }
      
      const result = limiter.check(identifier);
      
      res.setHeader('X-RateLimit-Limit', 100);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());
      
      if (!result.allowed) {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            details: { retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000) }
          },
          meta: { requestId, timestamp: new Date().toISOString() }
        });
        return;
      }
    }
    
    // Add auth context to headers for downstream services
    const proxyHeaders: Record<string, string> = {
      'x-request-id': requestId,
      'x-auth-type': authContext.type
    };
    
    if (authContext.userId) {
      proxyHeaders['x-user-id'] = authContext.userId;
    }
    if (authContext.partnerId) {
      proxyHeaders['x-partner-id'] = authContext.partnerId;
    }
    if (authContext.serviceId) {
      proxyHeaders['x-service-id'] = authContext.serviceId;
    }
    
    // Proxy to target service
    const targetUrl = SERVICE_URLS[routeConfig.service];
    const proxyPath = req.path; // Keep original path
    
    // Create proxy request
    const proxyReq = {
      method: req.method,
      headers: {
        ...req.headers,
        ...proxyHeaders,
        host: new URL(targetUrl).host
      },
      body: req.body
    };
    
    try {
      const response = await fetch(`${targetUrl}${proxyPath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`, {
        method: proxyReq.method,
        headers: proxyReq.headers as HeadersInit,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(proxyReq.body) : undefined
      });
      
      const duration = Date.now() - startTime;
      
      // Log request
      logger.info('Request completed', {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: response.status,
        duration,
        service: routeConfig.service
      });
      
      // Forward response
      res.status(response.status);
      
      // Copy relevant headers
      const headersToForward = ['content-type', 'x-total-count', 'x-page'];
      headersToForward.forEach(header => {
        const value = response.headers.get(header);
        if (value) {
          res.setHeader(header, value);
        }
      });
      
      // Add gateway headers
      res.setHeader('x-request-id', requestId);
      res.setHeader('x-response-time', `${duration}ms`);
      
      const responseBody = await response.text();
      res.send(responseBody);
      
    } catch (error) {
      logger.error('Proxy error', error as Error, { requestId, service: routeConfig.service });
      
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: `Service ${routeConfig.service} is unavailable`
        },
        meta: { requestId, timestamp: new Date().toISOString() }
      });
    }
    
  } catch (error) {
    next(error);
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', async (req: Request, res: Response) => {
  const services = Object.keys(SERVICE_URLS);
  const healthChecks: Record<string, { status: boolean; latency?: number }> = {};
  
  for (const service of services) {
    try {
      const start = Date.now();
      const response = await fetch(`${SERVICE_URLS[service as keyof typeof SERVICE_URLS]}/health`, {
        signal: AbortSignal.timeout(2000)
      });
      healthChecks[service] = {
        status: response.ok,
        latency: Date.now() - start
      };
    } catch {
      healthChecks[service] = { status: false };
    }
  }
  
  const allHealthy = Object.values(healthChecks).every(h => h.status);
  
  res.status(allHealthy ? 200 : 503).json({
    service: 'api-gateway',
    status: allHealthy ? 'healthy' : 'degraded',
    version: '1.0.0',
    uptime: process.uptime(),
    checks: healthChecks,
    timestamp: new Date().toISOString()
  });
});

// API Documentation endpoint
app.get('/docs', (req: Request, res: Response) => {
  res.json({
    title: 'CargoBit API Gateway',
    version: '1.0.0',
    description: 'Central API Gateway for CargoBit microservices',
    routes: routes.map(r => ({
      path: r.path,
      service: r.service,
      authRequired: r.authRequired,
      authType: r.authType
    }))
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err, { requestId: req.headers['x-request-id'] });
  
  const error = err instanceof AppError ? err : new AppError(err.message);
  
  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details
    },
    meta: {
      requestId: req.headers['x-request-id'] as string,
      timestamp: new Date().toISOString()
    }
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`API Gateway started on port ${PORT}`);
  logger.info('Service URLs:', SERVICE_URLS);
});

export default app;
