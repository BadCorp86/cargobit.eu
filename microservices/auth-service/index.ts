// CargoBit Auth Service
// =====================
// Handles: Login, Registration, JWT, Password Reset, Partner API-Keys

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  User,
  UserCreateInput,
  UserLoginInput,
  JWTPayload,
  ServiceJWTPayload,
  Partner,
  Permission,
  UserRole,
  ApiResponse
} from '../shared/types';
import {
  hashPassword,
  verifyPassword,
  generateApiKey,
  generateId,
  Logger,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  successResponse,
  errorResponse,
  generateRequestId,
  isValidEmail,
  isValidPassword,
  ROLE_PERMISSIONS,
  getEnv
} from '../shared/utils';

// ============================================
// CONFIGURATION
// ============================================

const logger = new Logger('auth-service');
const app = express();

const JWT_SECRET = getEnv('JWT_SECRET', 'cargobit-jwt-secret-key-change-in-production');
const JWT_EXPIRY = getEnv('JWT_EXPIRY', '15m');
const REFRESH_TOKEN_EXPIRY = getEnv('REFRESH_TOKEN_EXPIRY', '7d');
const SERVICE_TOKEN_EXPIRY = getEnv('SERVICE_TOKEN_EXPIRY', '5m');

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(express.json());

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || generateRequestId();
  next();
});

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    requestId: req.headers['x-request-id'],
    ip: req.ip
  });
  next();
});

// ============================================
// IN-MEMORY DATABASE (Replace with Prisma/PostgreSQL)
// ============================================

interface StoredUser extends User {
  passwordHash: string;
  passwordSalt: string;
  refreshTokens: string[];
}

interface StoredPartner extends Partner {}

// Mock databases
const users: Map<string, StoredUser> = new Map();
const partners: Map<string, StoredPartner> = new Map();
const apiKeys: Map<string, string> = new Map(); // apiKey -> partnerId
const revokedTokens: Set<string> = new Set();

// ============================================
// JWT FUNCTIONS
// ============================================

function generateAccessToken(user: User): string {
  const permissions = ROLE_PERMISSIONS[user.roles[0]] || [];
  
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    role: user.roles[0],
    permissions,
    jti: generateId('jti'),
    type: 'access'
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function generateRefreshToken(user: User): string {
  const payload = {
    sub: user.id,
    jti: generateId('rt'),
    type: 'refresh'
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

function generateServiceToken(service: string, permissions: string[]): string {
  const payload: Omit<ServiceJWTPayload, 'iat' | 'exp'> = {
    service,
    permissions,
    jti: generateId('svct'),
    type: 'service'
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: SERVICE_TOKEN_EXPIRY });
}

function verifyToken(token: string): JWTPayload | ServiceJWTPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload | ServiceJWTPayload;
    
    // Check if token is revoked
    if (revokedTokens.has(payload.jti)) {
      throw new AuthenticationError('Token has been revoked');
    }
    
    return payload;
  } catch (error) {
    throw new AuthenticationError('Invalid or expired token');
  }
}

// ============================================
// AUTH MIDDLEWARE
// ============================================

interface AuthRequest extends Request {
  user?: JWTPayload;
  partner?: Partner;
  service?: ServiceJWTPayload;
}

function authenticateUser(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('No token provided');
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  
  if (payload.type === 'service') {
    throw new AuthenticationError('Service token cannot be used for user authentication');
  }
  
  req.user = payload as JWTPayload;
  next();
}

function authenticatePartner(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    throw new AuthenticationError('No API key provided');
  }

  const partnerId = apiKeys.get(apiKey);
  if (!partnerId) {
    throw new AuthenticationError('Invalid API key');
  }

  const partner = partners.get(partnerId);
  if (!partner || partner.status !== 'active') {
    throw new AuthenticationError('Partner not found or inactive');
  }

  req.partner = partner;
  next();
}

function authenticateService(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthenticationError('No service token provided');
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  
  if (payload.type !== 'service') {
    throw new AuthenticationError('Invalid service token');
  }
  
  req.service = payload as ServiceJWTPayload;
  next();
}

function requirePermission(resource: string, action: Permission['action']) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthorizationError('No user context');
    }

    const hasPermission = req.user.permissions.some(perm => {
      if (perm.resource === '*') return true;
      if (perm.resource !== resource) return false;
      if (perm.action === 'manage' || perm.action === action) return true;
      return false;
    });

    if (!hasPermission) {
      throw new AuthorizationError(`Missing permission: ${resource}:${action}`);
    }

    next();
  };
}

function requirePartnerScope(scope: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.partner) {
      throw new AuthorizationError('No partner context');
    }

    const hasScope = req.partner.scopes.some(s => 
      s.resource === scope || s.resource === '*'
    );

    if (!hasScope) {
      throw new AuthorizationError(`Missing partner scope: ${scope}`);
    }

    next();
  };
}

// ============================================
// ROUTES: USER AUTHENTICATION
// ============================================

// POST /auth/register
app.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, phone, roles = ['shipper'] } = req.body as UserCreateInput;

    // Validate input
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    if (!isValidEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      throw new ValidationError('Invalid password', { errors: passwordValidation.errors });
    }

    // Check if user exists
    const existingUser = Array.from(users.values()).find(u => u.email === email);
    if (existingUser) {
      throw new ValidationError('Email already registered');
    }

    // Hash password
    const { hash, salt } = hashPassword(password);

    // Create user
    const userId = generateId('usr');
    const user: StoredUser = {
      id: userId,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      firstName,
      lastName,
      phone,
      language: 'de',
      status: 'pending',
      roles: roles as UserRole[],
      refreshTokens: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    users.set(userId, user);

    logger.info('User registered', { userId, email });

    res.status(201).json(successResponse({
      id: user.id,
      email: user.email,
      status: user.status,
      roles: user.roles
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /auth/login
app.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, deviceId } = req.body as UserLoginInput;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    // Find user
    const user = Array.from(users.values()).find(u => u.email === email);
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Verify password
    if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      logger.warn('Failed login attempt', { email, ip: req.ip });
      throw new AuthenticationError('Invalid credentials');
    }

    // Check status
    if (user.status === 'blocked' || user.status === 'suspended') {
      throw new AuthenticationError('Account is blocked or suspended');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token
    user.refreshTokens.push(refreshToken);
    user.lastLoginAt = new Date();
    users.set(user.id, user);

    logger.info('User logged in', { userId: user.id, email });

    res.json(successResponse({
      accessToken,
      refreshToken,
      expiresIn: JWT_EXPIRY,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        status: user.status
      }
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /auth/refresh
app.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    // Verify refresh token
    const payload = jwt.verify(refreshToken, JWT_SECRET) as { sub: string; jti: string };
    
    // Find user
    const user = users.get(payload.sub);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Check if refresh token is valid
    if (!user.refreshTokens.includes(refreshToken)) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Remove old refresh token
    user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);

    // Generate new tokens
    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshTokens.push(newRefreshToken);
    users.set(user.id, user);

    res.json(successResponse({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: JWT_EXPIRY
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /auth/logout
app.post('/logout', authenticateUser, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user!.sub;

    const user = users.get(userId);
    if (user) {
      // Remove refresh token
      if (refreshToken) {
        user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
      } else {
        user.refreshTokens = [];
      }
      
      // Revoke access token
      revokedTokens.add(req.user!.jti);
      
      users.set(userId, user);
    }

    logger.info('User logged out', { userId });

    res.json(successResponse({ message: 'Logged out successfully' }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /auth/password/reset
app.post('/password/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    const user = Array.from(users.values()).find(u => u.email === email);
    
    // Always return success to prevent email enumeration
    if (user) {
      // In production: generate reset token and send email
      logger.info('Password reset requested', { userId: user.id });
    }

    res.json(successResponse({
      message: 'If the email exists, a reset link has been sent'
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /auth/me
app.get('/me', authenticateUser, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = users.get(req.user!.sub);
    if (!user) {
      throw new NotFoundError('User');
    }

    res.json(successResponse({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      roles: user.roles,
      status: user.status,
      language: user.language,
      lastLoginAt: user.lastLoginAt
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: PARTNER API KEYS
// ============================================

// POST /partners (Admin only)
app.post('/partners', authenticateUser, requirePermission('partners', 'create'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, type, scopes, rateLimit = 300, webhookUrl } = req.body;

    if (!name || !type || !scopes) {
      throw new ValidationError('Name, type, and scopes are required');
    }

    const partnerId = generateId('prt');
    const apiKey = generateApiKey();
    const apiSecretHash = hashPassword(crypto.randomBytes(32).toString('hex')).hash;

    const partner: StoredPartner = {
      id: partnerId,
      name,
      type,
      apiKey,
      apiSecretHash,
      scopes,
      rateLimit,
      webhookUrl,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    partners.set(partnerId, partner);
    apiKeys.set(apiKey, partnerId);

    logger.info('Partner created', { partnerId, name, type });

    res.status(201).json(successResponse({
      id: partner.id,
      name: partner.name,
      type: partner.type,
      apiKey: partner.apiKey,
      scopes: partner.scopes,
      rateLimit: partner.rateLimit
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /partners/:id
app.get('/partners/:id', authenticatePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const partner = partners.get(req.params.id);
    if (!partner) {
      throw new NotFoundError('Partner');
    }

    // Partners can only access their own data
    if (req.partner?.id !== partner.id && !req.user) {
      throw new AuthorizationError('Access denied');
    }

    res.json(successResponse({
      id: partner.id,
      name: partner.name,
      type: partner.type,
      scopes: partner.scopes,
      status: partner.status,
      rateLimit: partner.rateLimit
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: SERVICE TOKENS
// ============================================

// POST /auth/service-token (Internal only - requires shared secret)
app.post('/service-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service, permissions, sharedSecret } = req.body;

    // Verify shared secret (in production, use mTLS)
    if (sharedSecret !== getEnv('SERVICE_SHARED_SECRET', 'internal-secret')) {
      throw new AuthenticationError('Invalid shared secret');
    }

    const token = generateServiceToken(service, permissions);

    res.json(successResponse({
      accessToken: token,
      expiresIn: SERVICE_TOKEN_EXPIRY
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: TOKEN VALIDATION (for Gateway)
// ============================================

// POST /auth/validate
app.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new ValidationError('Token is required');
    }

    const payload = verifyToken(token);

    res.json(successResponse({
      valid: true,
      payload
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    res.json(successResponse({
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid token'
    }, req.headers['x-request-id'] as string));
  }
});

// POST /auth/validate-api-key
app.post('/validate-api-key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      throw new ValidationError('API key is required');
    }

    const partnerId = apiKeys.get(apiKey);
    if (!partnerId) {
      res.json(successResponse({
        valid: false,
        error: 'Invalid API key'
      }, req.headers['x-request-id'] as string));
      return;
    }

    const partner = partners.get(partnerId);
    if (!partner || partner.status !== 'active') {
      res.json(successResponse({
        valid: false,
        error: 'Partner not found or inactive'
      }, req.headers['x-request-id'] as string));
      return;
    }

    res.json(successResponse({
      valid: true,
      partner: {
        id: partner.id,
        name: partner.name,
        type: partner.type,
        scopes: partner.scopes,
        rateLimit: partner.rateLimit
      }
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'auth-service',
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
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
// SEED DATA
// ============================================

function seedData() {
  // Create admin user
  const adminPassword = hashPassword('admin123');
  const adminId = generateId('usr');
  users.set(adminId, {
    id: adminId,
    email: 'admin@cargobit.test',
    passwordHash: adminPassword.hash,
    passwordSalt: adminPassword.salt,
    firstName: 'Admin',
    lastName: 'User',
    language: 'de',
    status: 'active',
    roles: ['admin'],
    refreshTokens: [],
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Create insurance partner
  const insurancePartnerId = generateId('prt');
  const insuranceApiKey = generateApiKey();
  partners.set(insurancePartnerId, {
    id: insurancePartnerId,
    name: 'Allianz Transport',
    type: 'insurance',
    apiKey: insuranceApiKey,
    apiSecretHash: hashPassword('secret').hash,
    scopes: [
      { resource: 'insurance', actions: ['quote', 'policy', 'claim'] }
    ],
    rateLimit: 300,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  apiKeys.set(insuranceApiKey, insurancePartnerId);

  // Create ad partner
  const adPartnerId = generateId('prt');
  const adApiKey = generateApiKey();
  partners.set(adPartnerId, {
    id: adPartnerId,
    name: 'TransportAds GmbH',
    type: 'advertiser',
    apiKey: adApiKey,
    apiSecretHash: hashPassword('secret').hash,
    scopes: [
      { resource: 'ads', actions: ['campaigns', 'tracking', 'impressions'] }
    ],
    rateLimit: 500,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  apiKeys.set(adApiKey, adPartnerId);

  logger.info('Seed data created', { 
    users: users.size, 
    partners: partners.size,
    insuranceApiKey,
    adApiKey
  });
}

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3001;

seedData();

app.listen(PORT, () => {
  logger.info(`Auth service started on port ${PORT}`);
});

export default app;
