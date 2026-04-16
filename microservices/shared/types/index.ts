// Shared Types for CargoBit Microservices
// ==========================================

// ============================================
// USER TYPES
// ============================================

export type UserRole = 'admin' | 'support' | 'shipper' | 'carrier' | 'driver' | 'dispatcher' | 'marketer' | 'partner';

export type UserStatus = 'active' | 'pending' | 'blocked' | 'suspended';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  language: string;
  status: UserStatus;
  roles: UserRole[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface UserCreateInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  language?: string;
  roles?: UserRole[];
}

export interface UserLoginInput {
  email: string;
  password: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================
// JWT & AUTH TYPES
// ============================================

export interface JWTPayload {
  sub: string;           // User ID
  email: string;
  role: UserRole;
  permissions: Permission[];
  exp: number;
  iat: number;
  jti: string;           // JWT ID for revocation
  type: 'access' | 'refresh' | 'service';
}

export interface ServiceJWTPayload {
  service: string;
  permissions: string[];
  exp: number;
  iat: number;
  jti: string;
}

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
  scope?: 'own' | 'company' | 'all';
}

// ============================================
// PARTNER TYPES
// ============================================

export type PartnerType = 'insurance' | 'advertiser' | 'payment' | 'logistics';

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  apiKey: string;
  apiSecretHash: string;
  scopes: PartnerScope[];
  rateLimit: number;
  webhookUrl?: string;
  status: 'active' | 'suspended' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface PartnerScope {
  resource: string;
  actions: string[];
}

export interface APIKeyValidation {
  valid: boolean;
  partner?: Partner;
  error?: string;
}

// ============================================
// ORDER TYPES
// ============================================

export type TransportType = 
  | 'pallet' | 'bulk' | 'liquid' | 'oversize' 
  | 'lowloader' | 'car_transport' | 'cooling' 
  | 'hazmat' | 'container';

export type OrderStatus = 
  | 'created' | 'published' | 'assigned' 
  | 'in_transit' | 'pickup_done' | 'delivery_done' 
  | 'completed' | 'cancelled';

export interface Order {
  id: string;
  shipperId: string;
  carrierId?: string;
  driverId?: string;
  vehicleId?: string;
  
  transportType: TransportType;
  status: OrderStatus;
  
  pickupAddress: Address;
  deliveryAddress: Address;
  
  pickupDatetime: Date;
  deliveryDatetime?: Date;
  
  description?: string;
  weightKg?: number;
  volumeM3?: number;
  
  price?: number;
  currency: string;
  
  riskScore?: number;
  riskLevel?: RiskLevel;
  
  insurancePolicyId?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  streetNumber?: string;
  postalCode: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

// ============================================
// INSURANCE TYPES
// ============================================

export interface InsuranceQuote {
  id: string;
  orderId: string;
  partnerId: string;
  
  coverageType: 'basic' | 'standard' | 'premium';
  coverageAmount: number;
  premium: number;
  currency: string;
  
  validUntil: Date;
  createdAt: Date;
}

export interface InsurancePolicy {
  id: string;
  orderId: string;
  quoteId: string;
  partnerId: string;
  
  policyNumber: string;
  coverageType: 'basic' | 'standard' | 'premium';
  coverageAmount: number;
  premium: number;
  deductible: number;
  currency: string;
  
  status: 'active' | 'claimed' | 'expired' | 'cancelled';
  
  validFrom: Date;
  validUntil: Date;
  
  commissionAmount: number;
  commissionPaid: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// AD TYPES
// ============================================

export type AdPosition = 'banner_top' | 'banner_sidebar' | 'listing_highlight' | 'popup';

export interface AdCampaign {
  id: string;
  partnerId: string;
  
  name: string;
  description?: string;
  
  position: AdPosition;
  bannerUrl?: string;
  targetUrl: string;
  
  budget: number;
  spentAmount: number;
  currency: string;
  
  status: 'draft' | 'pending' | 'active' | 'paused' | 'completed';
  
  startDate: Date;
  endDate?: Date;
  
  targeting?: AdTargeting;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface AdTargeting {
  countries?: string[];
  userRoles?: UserRole[];
  transportTypes?: TransportType[];
}

export interface AdImpression {
  id: string;
  campaignId: string;
  userId?: string;
  sessionId: string;
  
  page: string;
  position: AdPosition;
  
  ipAddress: string;
  userAgent: string;
  
  createdAt: Date;
}

export interface AdClick {
  id: string;
  impressionId: string;
  campaignId: string;
  userId?: string;
  
  clickedAt: Date;
}

// ============================================
// RISK TYPES
// ============================================

export type RiskLevel = 'green' | 'yellow' | 'red';

export interface RiskScore {
  id: string;
  entityType: 'user' | 'company' | 'order' | 'transaction';
  entityId: string;
  
  score: number;           // 0-100
  level: RiskLevel;
  
  factors: RiskFactor[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskFactor {
  name: string;
  weight: number;
  value: number;
  description?: string;
}

export interface RiskEvent {
  id: string;
  entityType: 'user' | 'company' | 'order' | 'transaction';
  entityId: string;
  
  ruleId: string;
  ruleName: string;
  category: string;
  
  weight: number;
  metadata?: Record<string, unknown>;
  
  triggeredBy?: string;
  ipAddress?: string;
  
  createdAt: Date;
}

// ============================================
// AUDIT TYPES
// ============================================

export type AuditAction = 
  | 'create' | 'update' | 'delete' | 'status_change'
  | 'login' | 'logout' | 'api_key_used'
  | 'payout' | 'fraud_alert' | 'insurance_claim';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  
  action: AuditAction;
  entityType: string;
  entityId: string;
  
  userId?: string;
  partnerId?: string;
  serviceId?: string;
  
  dataBefore?: Record<string, unknown>;
  dataAfter?: Record<string, unknown>;
  
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
  
  // Hash chain for integrity
  previousHash: string;
  hash: string;
}

// ============================================
// NOTIFICATION TYPES
// ============================================

export type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook' | 'slack';

export interface Notification {
  id: string;
  userId?: string;
  partnerId?: string;
  
  type: string;
  channel: NotificationChannel;
  
  subject: string;
  message: string;
  data?: Record<string, unknown>;
  
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  
  scheduledFor?: Date;
  sentAt?: Date;
  
  retryCount: number;
  lastError?: string;
  
  createdAt: Date;
}

// ============================================
// GATEWAY TYPES
// ============================================

export interface GatewayRequest {
  id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
  
  userId?: string;
  partnerId?: string;
  serviceId?: string;
  
  ipAddress: string;
  userAgent: string;
  
  timestamp: Date;
}

export interface GatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  
  duration: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

// ============================================
// EVENT TYPES (for inter-service communication)
// ============================================

export interface ServiceEvent<T = unknown> {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: T;
  correlationId: string;
}

export type EventHandler<T = unknown> = (event: ServiceEvent<T>) => Promise<void>;

// ============================================
// HEALTH CHECK TYPES
// ============================================

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: Record<string, { status: boolean; latency?: number; message?: string }>;
  timestamp: Date;
}

// ============================================
// PAGINATION TYPES
// ============================================

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
