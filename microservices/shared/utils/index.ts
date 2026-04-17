// Shared Utilities for CargoBit Microservices
// =============================================

import crypto from 'crypto';
import { Permission, UserRole, JWTPayload, ServiceJWTPayload } from '../types';

// ============================================
// CRYPTO UTILITIES
// ============================================

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(32).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512')
    .toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: newHash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(newHash));
}

export function generateApiKey(): string {
  return `cb_${crypto.randomBytes(32).toString('base64url')}`;
}

export function generateId(prefix: string = ''): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function createHashChain(previousHash: string, data: string): string {
  return crypto
    .createHash('sha256')
    .update(previousHash + data)
    .digest('hex');
}

// ============================================
// PERMISSION UTILITIES
// ============================================

// Permission Matrix: Role -> Permissions
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    { resource: '*', action: 'manage', scope: 'all' }
  ],
  support: [
    { resource: 'users', action: 'read', scope: 'all' },
    { resource: 'orders', action: 'read', scope: 'all' },
    { resource: 'tickets', action: 'manage', scope: 'all' },
    { resource: 'audit', action: 'read', scope: 'all' }
  ],
  shipper: [
    { resource: 'orders', action: 'create', scope: 'own' },
    { resource: 'orders', action: 'read', scope: 'own' },
    { resource: 'orders', action: 'update', scope: 'own' },
    { resource: 'insurance', action: 'create', scope: 'own' },
    { resource: 'insurance', action: 'read', scope: 'own' }
  ],
  carrier: [
    { resource: 'orders', action: 'read', scope: 'company' },
    { resource: 'orders', action: 'update', scope: 'company' },
    { resource: 'vehicles', action: 'manage', scope: 'company' },
    { resource: 'drivers', action: 'manage', scope: 'company' }
  ],
  driver: [
    { resource: 'orders', action: 'read', scope: 'own' },
    { resource: 'orders', action: 'update', scope: 'own' },
    { resource: 'tracking', action: 'create', scope: 'own' }
  ],
  dispatcher: [
    { resource: 'orders', action: 'read', scope: 'company' },
    { resource: 'offers', action: 'create', scope: 'company' },
    { resource: 'vehicles', action: 'read', scope: 'company' },
    { resource: 'drivers', action: 'read', scope: 'company' }
  ],
  marketer: [
    { resource: 'campaigns', action: 'manage', scope: 'company' },
    { resource: 'analytics', action: 'read', scope: 'company' }
  ],
  partner: [
    // Partner permissions are defined per API key scope
  ]
};

export function hasPermission(
  userRole: UserRole,
  resource: string,
  action: Permission['action'],
  scope?: Permission['scope']
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  
  return permissions.some(perm => {
    // Check wildcard permission
    if (perm.resource === '*') return true;
    
    // Check resource match
    if (perm.resource !== resource) return false;
    
    // Check action match
    if (perm.action !== 'manage' && perm.action !== action) return false;
    
    // Check scope if provided
    if (scope && perm.scope !== 'all') {
      if (perm.scope !== scope) return false;
    }
    
    return true;
  });
}

export function hasPermissionFromJWT(
  payload: JWTPayload,
  resource: string,
  action: Permission['action']
): boolean {
  return payload.permissions.some(perm => {
    if (perm.resource === '*') return true;
    if (perm.resource !== resource) return false;
    if (perm.action === 'manage' || perm.action === action) return true;
    return false;
  });
}

// ============================================
// VALIDATION UTILITIES
// ============================================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return { valid: errors.length === 0, errors };
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// ============================================
// DATE UTILITIES
// ============================================

export function formatDate(date: Date, format: string = 'ISO'): string {
  if (format === 'ISO') {
    return date.toISOString();
  }
  if (format === 'DE') {
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  return date.toISOString();
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isExpired(date: Date): boolean {
  return date < new Date();
}

export function getExpiryDate(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ============================================
// STRING UTILITIES
// ============================================

export function generateRandomString(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  const masked = localPart.slice(0, 2) + '***' + localPart.slice(-2);
  return `${masked}@${domain}`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 3) + '***' + phone.slice(-3);
}

// ============================================
// ERROR UTILITIES
// ============================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', true, { retryAfter });
  }
}

// ============================================
// RESPONSE UTILITIES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    duration?: number;
  };
}

export function successResponse<T>(data: T, requestId: string): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString()
    }
  };
}

export function errorResponse(
  error: AppError | Error,
  requestId: string
): ApiResponse {
  const isAppError = error instanceof AppError;
  
  return {
    success: false,
    error: {
      code: isAppError ? (error as AppError).code : 'INTERNAL_ERROR',
      message: error.message,
      details: isAppError ? (error as AppError).details : undefined
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString()
    }
  };
}

// ============================================
// LOGGING UTILITIES
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  requestId?: string;
  userId?: string;
  partnerId?: string;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
  };
}

export class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...data
    };

    const output = JSON.stringify(entry);
    
    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug') {
      this.log('debug', message, data);
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log('error', message, {
      ...data,
      error: error ? { message: error.message, stack: error.stack } : undefined
    });
  }
}

// ============================================
// RATE LIMIT UTILITIES
// ============================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (identifier: string) => string;
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetAt: Date } {
    const key = this.config.keyGenerator 
      ? this.config.keyGenerator(identifier) 
      : identifier;
    
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Get existing requests
    let requests = this.requests.get(key) || [];
    
    // Filter out expired requests
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check limit
    const remaining = Math.max(0, this.config.maxRequests - requests.length);
    const resetAt = new Date(windowStart + this.config.windowMs);
    
    if (requests.length >= this.config.maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }
    
    // Add current request
    requests.push(now);
    this.requests.set(key, requests);
    
    return { allowed: true, remaining: remaining - 1, resetAt };
  }

  reset(identifier: string): void {
    const key = this.config.keyGenerator 
      ? this.config.keyGenerator(identifier) 
      : identifier;
    this.requests.delete(key);
  }
}

// ============================================
// ENVIRONMENT UTILITIES
// ============================================

export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

export function getEnvNumber(key: string, defaultValue?: number): number {
  const value = getEnv(key, defaultValue?.toString());
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

export function getEnvBoolean(key: string, defaultValue?: boolean): boolean {
  const value = getEnv(key, defaultValue?.toString());
  return value.toLowerCase() === 'true' || value === '1';
}

// ============================================
// EXPORT ALL
// ============================================

export default {
  // Crypto
  hashPassword,
  verifyPassword,
  generateApiKey,
  generateId,
  generateRequestId,
  hashData,
  createHashChain,
  
  // Permissions
  ROLE_PERMISSIONS,
  hasPermission,
  hasPermissionFromJWT,
  
  // Validation
  isValidEmail,
  isValidPassword,
  sanitizeInput,
  
  // Date
  formatDate,
  addDays,
  isExpired,
  getExpiryDate,
  
  // String
  generateRandomString,
  maskEmail,
  maskPhone,
  
  // Errors
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  
  // Response
  successResponse,
  errorResponse,
  
  // Logging
  Logger,
  
  // Rate Limiting
  RateLimiter,
  
  // Environment
  getEnv,
  getEnvNumber,
  getEnvBoolean
};
