// CargoBit Risk Engine Service
// ==============================
// Handles: Risk Scoring, Fraud Rules, Geo-Checks, Device Fingerprinting

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  RiskScore,
  RiskLevel,
  RiskEvent,
  RiskFactor,
  ApiResponse
} from '../shared/types';
import {
  generateId,
  Logger,
  AppError,
  ValidationError,
  NotFoundError,
  successResponse,
  errorResponse,
  getEnv
} from '../shared/utils';

// ============================================
// CONFIGURATION
// ============================================

const logger = new Logger('risk-engine');
const app = express();

// Risk thresholds
const RISK_THRESHOLDS = {
  green: { min: 0, max: 30, actions: { allow: true, requireDelay: false, require2FA: false } },
  yellow: { min: 31, max: 60, actions: { allow: true, requireDelay: true, require2FA: false } },
  red: { min: 61, max: 100, actions: { allow: false, requireDelay: false, require2FA: false } }
};

// Risk rules configuration
interface RiskRule {
  id: string;
  name: string;
  category: 'user' | 'company' | 'transaction' | 'behavior' | 'document';
  entityType: 'user' | 'company' | 'transaction';
  weight: number;
  condition: (data: Record<string, unknown>) => boolean;
  description: string;
  active: boolean;
}

const RISK_RULES: RiskRule[] = [
  // User Rules
  {
    id: 'rule_001',
    name: 'user_kyc_missing',
    category: 'user',
    entityType: 'user',
    weight: 20,
    condition: (data) => !data.kycVerified,
    description: 'User has not completed KYC verification',
    active: true
  },
  {
    id: 'rule_002',
    name: 'user_new_account',
    category: 'user',
    entityType: 'user',
    weight: 10,
    condition: (data) => {
      const createdAt = data.createdAt as Date;
      const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreation < 7;
    },
    description: 'Account created less than 7 days ago',
    active: true
  },
  {
    id: 'rule_003',
    name: 'user_multiple_failed_logins',
    category: 'behavior',
    entityType: 'user',
    weight: 15,
    condition: (data) => (data.failedLoginCount as number) >= 3,
    description: 'Multiple failed login attempts',
    active: true
  },
  {
    id: 'rule_004',
    name: 'user_suspicious_location',
    category: 'behavior',
    entityType: 'user',
    weight: 25,
    condition: (data) => data.suspiciousLocation === true,
    description: 'Login from suspicious location',
    active: true
  },
  {
    id: 'rule_005',
    name: 'user_verified',
    category: 'user',
    entityType: 'user',
    weight: -15,
    condition: (data) => data.kycVerified === true && data.kybVerified === true,
    description: 'User is fully verified (positive)',
    active: true
  },
  
  // Company Rules
  {
    id: 'rule_006',
    name: 'company_new',
    category: 'company',
    entityType: 'company',
    weight: 10,
    condition: (data) => {
      const createdAt = data.createdAt as Date;
      const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreation < 30;
    },
    description: 'Company registered less than 30 days ago',
    active: true
  },
  {
    id: 'rule_007',
    name: 'company_no_history',
    category: 'company',
    entityType: 'company',
    weight: 15,
    condition: (data) => (data.completedTransports as number) < 5,
    description: 'Company has less than 5 completed transports',
    active: true
  },
  {
    id: 'rule_008',
    name: 'company_verified',
    category: 'company',
    entityType: 'company',
    weight: -20,
    condition: (data) => data.kybVerified === true,
    description: 'Company is KYB verified (positive)',
    active: true
  },
  
  // Transaction Rules
  {
    id: 'rule_009',
    name: 'transaction_high_value',
    category: 'transaction',
    entityType: 'transaction',
    weight: 15,
    condition: (data) => (data.amount as number) > 5000,
    description: 'Transaction value exceeds 5000 EUR',
    active: true
  },
  {
    id: 'rule_010',
    name: 'transaction_very_high_value',
    category: 'transaction',
    entityType: 'transaction',
    weight: 25,
    condition: (data) => (data.amount as number) > 20000,
    description: 'Transaction value exceeds 20000 EUR',
    active: true
  },
  {
    id: 'rule_011',
    name: 'transaction_cross_border',
    category: 'transaction',
    entityType: 'transaction',
    weight: 10,
    condition: (data) => data.isInternational === true,
    description: 'Cross-border transaction',
    active: true
  },
  {
    id: 'rule_012',
    name: 'transaction_new_route',
    category: 'transaction',
    entityType: 'transaction',
    weight: 8,
    condition: (data) => data.newRoute === true,
    description: 'First time on this route',
    active: true
  },
  
  // Document Rules
  {
    id: 'rule_013',
    name: 'document_expired',
    category: 'document',
    entityType: 'user',
    weight: 30,
    condition: (data) => data.hasExpiredDocuments === true,
    description: 'User has expired documents',
    active: true
  },
  {
    id: 'rule_014',
    name: 'driver_license_expired',
    category: 'document',
    entityType: 'user',
    weight: 35,
    condition: (data) => data.driverLicenseExpired === true,
    description: 'Driver license expired',
    active: true
  }
];

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(express.json());

interface AuthRequest extends Request {
  serviceId?: string;
  userId?: string;
}

app.use((req: AuthRequest, res: Response, next: NextFunction) => {
  req.serviceId = req.headers['x-service-id'] as string;
  req.userId = req.headers['x-user-id'] as string;
  req.headers['x-request-id'] = req.headers['x-request-id'] || `req_${Date.now()}`;
  next();
});

// Service auth middleware
function requireServiceAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.serviceId && !req.headers.authorization?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'SERVICE_AUTH_REQUIRED', message: 'Service authentication required' }
    });
  }
  next();
}

// ============================================
// IN-MEMORY DATABASE
// ============================================

interface StoredRiskScore extends RiskScore {
  entityType: 'user' | 'company' | 'transaction';
  entityId: string;
}

interface StoredRiskEvent extends RiskEvent {
  riskScoreId?: string;
}

const riskScores: Map<string, StoredRiskScore> = new Map();
const riskEvents: Map<string, StoredRiskEvent> = new Map();
const riskHistory: Map<string, { timestamp: Date; oldScore: number; newScore: number; reason: string }[]> = new Map();

// ============================================
// ROUTES: RISK CALCULATION
// ============================================

// POST /risk/calculate - Calculate risk score
app.post('/risk/calculate', requireServiceAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId, data } = req.body;

    if (!entityType || !entityId || !data) {
      throw new ValidationError('Missing required fields: entityType, entityId, data');
    }

    // Get applicable rules
    const applicableRules = RISK_RULES.filter(
      rule => rule.active && rule.entityType === entityType
    );

    // Evaluate rules
    const factors: RiskFactor[] = [];
    let totalScore = 0;

    for (const rule of applicableRules) {
      try {
        const triggered = rule.condition(data);
        
        factors.push({
          name: rule.name,
          weight: rule.weight,
          value: triggered ? 1 : 0,
          description: rule.description
        });

        if (triggered) {
          totalScore += rule.weight;
          
          // Record risk event
          recordRiskEvent(entityType, entityId, rule, data);
        }
      } catch (error) {
        logger.warn('Rule evaluation failed', { ruleId: rule.id, error });
      }
    }

    // Normalize score to 0-100
    totalScore = Math.max(0, Math.min(100, totalScore));

    // Determine risk level
    const level = getRiskLevel(totalScore);

    // Create or update risk score
    const scoreId = generateId('rs');
    const existingScore = Array.from(riskScores.values())
      .find(s => s.entityType === entityType && s.entityId === entityId);

    if (existingScore) {
      // Update existing score
      existingScore.score = totalScore;
      existingScore.level = level;
      existingScore.factors = factors;
      existingScore.updatedAt = new Date();
      riskScores.set(existingScore.id, existingScore);

      // Record history
      addRiskHistory(existingScore.id, existingScore.score, totalScore, 'Recalculated');
      
      logger.info('Risk score updated', { 
        scoreId: existingScore.id, 
        entityType, 
        entityId, 
        score: totalScore,
        level 
      });

      res.json(successResponse(existingScore, req.headers['x-request-id'] as string));
    } else {
      // Create new score
      const riskScore: StoredRiskScore = {
        id: scoreId,
        entityType,
        entityId,
        score: totalScore,
        level,
        factors,
        factorsCount: factors.filter(f => f.value > 0).length,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      riskScores.set(scoreId, riskScore);

      logger.info('Risk score calculated', { 
        scoreId, 
        entityType, 
        entityId, 
        score: totalScore,
        level 
      });

      res.status(201).json(successResponse(riskScore, req.headers['x-request-id'] as string));
    }
  } catch (error) {
    next(error);
  }
});

// GET /risk/score/:id - Get risk score by ID
app.get('/risk/score/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const score = riskScores.get(req.params.id);
    
    if (!score) {
      throw new NotFoundError('Risk score');
    }

    res.json(successResponse(score, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /risk/entity/:entityType/:entityId - Get risk score by entity
app.get('/risk/entity/:entityType/:entityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId } = req.params;
    
    const score = Array.from(riskScores.values())
      .find(s => s.entityType === entityType && s.entityId === entityId);

    if (!score) {
      throw new NotFoundError('Risk score for entity');
    }

    res.json(successResponse(score, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /risk/event - Record risk event
app.post('/risk/event', requireServiceAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId, ruleName, metadata, triggeredBy, ipAddress } = req.body;

    // Find rule
    const rule = RISK_RULES.find(r => r.name === ruleName);
    if (!rule) {
      throw new ValidationError(`Unknown rule: ${ruleName}`);
    }

    const event = recordRiskEvent(entityType, entityId, rule, metadata, triggeredBy, ipAddress);

    // Recalculate risk score
    // In production: trigger async calculation

    res.status(201).json(successResponse(event, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /risk/events/:entityType/:entityId - Get events for entity
app.get('/risk/events/:entityType/:entityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId } = req.params;

    const entityEvents = Array.from(riskEvents.values())
      .filter(e => e.entityType === entityType && e.entityId === entityId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json(successResponse({
      data: entityEvents,
      total: entityEvents.length
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: RISK RULES
// ============================================

// GET /risk/rules - List all rules
app.get('/risk/rules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, active } = req.query;

    let filtered = [...RISK_RULES];

    if (category) {
      filtered = filtered.filter(r => r.category === category);
    }
    if (active !== undefined) {
      filtered = filtered.filter(r => r.active === (active === 'true'));
    }

    res.json(successResponse({
      data: filtered,
      total: filtered.length
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /risk/rules/:id - Get rule details
app.get('/risk/rules/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = RISK_RULES.find(r => r.id === req.params.id);
    
    if (!rule) {
      throw new NotFoundError('Risk rule');
    }

    res.json(successResponse(rule, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: RISK THRESHOLDS
// ============================================

// GET /risk/thresholds - Get risk thresholds
app.get('/risk/thresholds', (req: Request, res: Response) => {
  res.json(successResponse(RISK_THRESHOLDS, req.headers['x-request-id'] as string));
});

// GET /risk/level/:score - Get risk level for score
app.get('/risk/level/:score', (req: Request, res: Response) => {
  const score = parseInt(req.params.score);
  const level = getRiskLevel(score);
  const threshold = RISK_THRESHOLDS[level];

  res.json(successResponse({
    score,
    level,
    threshold: {
      range: `${threshold.min} - ${threshold.max}`,
      actions: threshold.actions
    }
  }, req.headers['x-request-id'] as string));
});

// ============================================
// ROUTES: GEO-CHECK
// ============================================

// POST /risk/geo/check - Check geo-location risk
app.post('/risk/geo/check', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { latitude, longitude, userId, deviceId } = req.body;

    if (!latitude || !longitude) {
      throw new ValidationError('Missing latitude or longitude');
    }

    // In production: check against:
    // - Previous user locations
    // - VPN/Proxy databases
    // - High-risk countries
    // - Impossible travel detection

    const geoRisk = {
      score: 0,
      factors: [] as string[],
      isVPN: false,
      isProxy: false,
      country: 'DE',
      city: 'Berlin',
      timezone: 'Europe/Berlin'
    };

    // Simulate some checks
    const distanceFromHome = Math.random() * 500; // km
    if (distanceFromHome > 100) {
      geoRisk.factors.push('Location far from usual area');
      geoRisk.score += 10;
    }

    // Check if in high-risk country (simplified)
    const highRiskCountries = ['XX', 'YY'];
    if (highRiskCountries.includes(geoRisk.country)) {
      geoRisk.factors.push('High-risk country');
      geoRisk.score += 30;
    }

    res.json(successResponse({
      latitude,
      longitude,
      ...geoRisk,
      riskLevel: getRiskLevel(geoRisk.score)
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: DEVICE FINGERPRINT
// ============================================

// POST /risk/device/fingerprint - Analyze device fingerprint
app.post('/risk/device/fingerprint', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fingerprint, userId } = req.body;

    if (!fingerprint) {
      throw new ValidationError('Missing device fingerprint');
    }

    // In production: compare with stored fingerprints
    // - Detect device changes
    // - Detect emulators/virtual machines
    // - Detect tampered browsers

    const deviceRisk = {
      score: 0,
      factors: [] as string[],
      isNewDevice: true,
      isEmulator: false,
      isRooted: false,
      browserIntegrity: 'ok'
    };

    // Simulate device analysis
    if (deviceRisk.isEmulator) {
      deviceRisk.factors.push('Device appears to be an emulator');
      deviceRisk.score += 25;
    }

    if (deviceRisk.isRooted) {
      deviceRisk.factors.push('Device is rooted/jailbroken');
      deviceRisk.score += 15;
    }

    res.json(successResponse({
      fingerprint,
      ...deviceRisk,
      riskLevel: getRiskLevel(deviceRisk.score)
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRiskLevel(score: number): RiskLevel {
  if (score <= RISK_THRESHOLDS.green.max) return 'green';
  if (score <= RISK_THRESHOLDS.yellow.max) return 'yellow';
  return 'red';
}

function recordRiskEvent(
  entityType: 'user' | 'company' | 'transaction',
  entityId: string,
  rule: RiskRule,
  metadata?: Record<string, unknown>,
  triggeredBy?: string,
  ipAddress?: string
): StoredRiskEvent {
  const eventId = generateId('re');
  const event: StoredRiskEvent = {
    id: eventId,
    entityType,
    entityId,
    ruleId: rule.id,
    ruleName: rule.name,
    ruleCategory: rule.category,
    weight: rule.weight,
    metadata,
    triggeredBy,
    ipAddress,
    createdAt: new Date()
  };

  riskEvents.set(eventId, event);
  return event;
}

function addRiskHistory(
  scoreId: string,
  oldScore: number,
  newScore: number,
  reason: string
): void {
  if (!riskHistory.has(scoreId)) {
    riskHistory.set(scoreId, []);
  }
  
  riskHistory.get(scoreId)!.push({
    timestamp: new Date(),
    oldScore,
    newScore,
    reason
  });
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'risk-engine',
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    stats: {
      scores: riskScores.size,
      events: riskEvents.size,
      rules: RISK_RULES.length
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

const PORT = process.env.PORT || 3005;

app.listen(PORT, () => {
  logger.info(`Risk engine started on port ${PORT}`);
  logger.info(`Loaded ${RISK_RULES.length} risk rules`);
});

export default app;
