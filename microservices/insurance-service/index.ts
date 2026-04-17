// CargoBit Insurance Service
// ============================
// Handles: Insurance Quotes, Policies, Claims, Commissions

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import {
  InsuranceQuote,
  InsurancePolicy,
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

const logger = new Logger('insurance-service');
const app = express();

// Insurance partner API keys (in production, from database)
const PARTNER_CONFIG: Record<string, { name: string; rateLimit: number }> = {
  'partner_allianz': { name: 'Allianz Transport', rateLimit: 300 },
  'partner_hiscox': { name: 'Hiscox Logistics', rateLimit: 300 },
  'partner_helvetia': { name: 'Helvetia Cargo', rateLimit: 300 }
};

// Coverage configurations
const COVERAGE_TYPES = {
  basic: {
    name: 'Basis-Deckung',
    coverageMultiplier: 1.0,
    premiumRate: 0.015, // 1.5% of cargo value
    deductibleRate: 0.05, // 5% deductible
    features: ['Diebstahl', 'Beschädigung', 'Verlust']
  },
  standard: {
    name: 'Standard-Deckung',
    coverageMultiplier: 1.2,
    premiumRate: 0.025, // 2.5%
    deductibleRate: 0.03, // 3%
    features: ['Diebstahl', 'Beschädigung', 'Verlust', 'Wasserschaden', 'Feuer']
  },
  premium: {
    name: 'Premium-Deckung',
    coverageMultiplier: 1.5,
    premiumRate: 0.04, // 4%
    deductibleRate: 0.01, // 1%
    features: ['Volldeckung', 'Keine Selbstbeteiligung bei Totalverlust', 'Express-Abwicklung']
  }
};

// Commission rates by partner tier
const COMMISSION_RATES = {
  free: 0.03,      // 3%
  starter: 0.025,  // 2.5%
  professional: 0.02, // 2%
  enterprise: 0.015   // 1.5%
};

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(express.json());

interface AuthRequest extends Request {
  partnerId?: string;
  userId?: string;
}

app.use((req: AuthRequest, res: Response, next: NextFunction) => {
  req.partnerId = req.headers['x-partner-id'] as string;
  req.userId = req.headers['x-user-id'] as string;
  req.headers['x-request-id'] = req.headers['x-request-id'] || `req_${Date.now()}`;
  next();
});

// Partner auth middleware
function requirePartner(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.partnerId) {
    return res.status(401).json({
      success: false,
      error: { code: 'PARTNER_AUTH_REQUIRED', message: 'Partner authentication required' }
    });
  }
  next();
}

// ============================================
// IN-MEMORY DATABASE
// ============================================

interface StoredQuote extends InsuranceQuote {
  cargoValue: number;
  transportType: string;
  route: {
    from: string;
    to: string;
  };
  partnerName: string;
}

interface StoredPolicy extends InsurancePolicy {
  cargoValue: number;
  transportType: string;
  route: {
    from: string;
    to: string;
  };
  shipperId: string;
  orderId: string;
}

interface Claim {
  id: string;
  policyId: string;
  orderId: string;
  type: 'damage' | 'theft' | 'loss' | 'other';
  description: string;
  claimedAmount: number;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'paid';
  documents: string[];
  createdAt: Date;
  updatedAt: Date;
}

const quotes: Map<string, StoredQuote> = new Map();
const policies: Map<string, StoredPolicy> = new Map();
const claims: Map<string, Claim> = new Map();

// ============================================
// ROUTES: QUOTES
// ============================================

// POST /insurance/quote - Create quote (Partner only)
app.post('/insurance/quote', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      orderId,
      cargoValue,
      coverageType = 'standard',
      transportType,
      route,
      currency = 'EUR'
    } = req.body;

    // Validate
    if (!orderId || !cargoValue || !transportType) {
      throw new ValidationError('Missing required fields: orderId, cargoValue, transportType');
    }

    if (!COVERAGE_TYPES[coverageType as keyof typeof COVERAGE_TYPES]) {
      throw new ValidationError('Invalid coverage type. Use: basic, standard, or premium');
    }

    // Calculate premium
    const config = COVERAGE_TYPES[coverageType as keyof typeof COVERAGE_TYPES];
    const coverageAmount = Math.round(cargoValue * config.coverageMultiplier);
    const premium = Math.round(cargoValue * config.premiumRate * 100) / 100;
    const deductible = Math.round(cargoValue * config.deductibleRate * 100) / 100;

    // Create quote
    const quoteId = generateId('qt');
    const quote: StoredQuote = {
      id: quoteId,
      orderId,
      partnerId: req.partnerId!,
      partnerName: PARTNER_CONFIG[req.partnerId!]?.name || 'Unknown Partner',
      coverageType: coverageType as 'basic' | 'standard' | 'premium',
      coverageAmount,
      premium,
      currency,
      cargoValue,
      transportType,
      route,
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h validity
      createdAt: new Date()
    };

    quotes.set(quoteId, quote);

    logger.info('Quote created', { 
      quoteId, 
      orderId, 
      coverageAmount, 
      premium,
      partnerId: req.partnerId 
    });

    res.status(201).json(successResponse({
      ...quote,
      details: {
        deductible,
        features: config.features,
        premiumRate: config.premiumRate * 100 + '%',
        deductibleRate: config.deductibleRate * 100 + '%'
      }
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /insurance/quote/:id - Get quote
app.get('/insurance/quote/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const quote = quotes.get(req.params.id);
    
    if (!quote) {
      throw new NotFoundError('Quote');
    }

    res.json(successResponse(quote, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: POLICIES
// ============================================

// POST /insurance/policy - Create policy from quote
app.post('/insurance/policy', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { quoteId, shipperId, orderId } = req.body;

    if (!quoteId || !shipperId || !orderId) {
      throw new ValidationError('Missing required fields: quoteId, shipperId, orderId');
    }

    const quote = quotes.get(quoteId);
    if (!quote) {
      throw new NotFoundError('Quote');
    }

    // Check quote validity
    if (quote.validUntil < new Date()) {
      throw new ValidationError('Quote has expired');
    }

    // Generate policy number
    const policyNumber = `CB-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Calculate commission (assume professional tier for demo)
    const commissionRate = COMMISSION_RATES.professional;
    const commissionAmount = Math.round(quote.premium * commissionRate * 100) / 100;

    // Create policy
    const policyId = generateId('pol');
    const policy: StoredPolicy = {
      id: policyId,
      orderId,
      quoteId,
      partnerId: quote.partnerId,
      policyNumber,
      coverageType: quote.coverageType,
      coverageAmount: quote.coverageAmount,
      premium: quote.premium,
      deductible: Math.round(quote.cargoValue * COVERAGE_TYPES[quote.coverageType].deductibleRate * 100) / 100,
      currency: quote.currency,
      status: 'active',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      commissionAmount,
      commissionPaid: false,
      cargoValue: quote.cargoValue,
      transportType: quote.transportType,
      route: quote.route,
      shipperId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    policies.set(policyId, policy);

    // Invalidate quote
    quote.validUntil = new Date(0);
    quotes.set(quoteId, quote);

    logger.info('Policy created', { 
      policyId, 
      policyNumber, 
      orderId,
      premium: policy.premium,
      commission: commissionAmount
    });

    // Trigger webhook to partner
    triggerPartnerWebhook(quote.partnerId, 'policy_created', {
      policyId,
      policyNumber,
      orderId,
      premium: policy.premium
    });

    res.status(201).json(successResponse(policy, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /insurance/policy/:id - Get policy
app.get('/insurance/policy/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const policy = policies.get(req.params.id);
    
    if (!policy) {
      throw new NotFoundError('Policy');
    }

    // Check access
    if (req.userId && policy.shipperId !== req.userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Access denied to this policy' }
      });
    }

    res.json(successResponse(policy, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /insurance/policies - List policies
app.get('/insurance/policies', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId, shipperId, status } = req.query;

    let filtered = Array.from(policies.values());

    if (orderId) {
      filtered = filtered.filter(p => p.orderId === orderId);
    }
    if (shipperId) {
      filtered = filtered.filter(p => p.shipperId === shipperId);
    }
    if (status) {
      filtered = filtered.filter(p => p.status === status);
    }
    if (req.userId) {
      filtered = filtered.filter(p => p.shipperId === req.userId);
    }

    res.json(successResponse({
      data: filtered,
      total: filtered.length
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /insurance/policy/:id/cancel - Cancel policy
app.post('/insurance/policy/:id/cancel', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const policy = policies.get(req.params.id);
    
    if (!policy) {
      throw new NotFoundError('Policy');
    }

    if (policy.status === 'cancelled') {
      throw new ValidationError('Policy is already cancelled');
    }

    policy.status = 'cancelled';
    policy.updatedAt = new Date();
    policies.set(policy.id, policy);

    logger.info('Policy cancelled', { policyId: policy.id, reason });

    res.json(successResponse(policy, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: CLAIMS
// ============================================

// POST /insurance/claim - Create claim
app.post('/insurance/claim', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { policyId, type, description, claimedAmount, documents = [] } = req.body;

    if (!policyId || !type || !description || !claimedAmount) {
      throw new ValidationError('Missing required fields');
    }

    const policy = policies.get(policyId);
    if (!policy) {
      throw new NotFoundError('Policy');
    }

    // Validate claim amount
    if (claimedAmount > policy.coverageAmount) {
      throw new ValidationError(`Claim amount exceeds coverage limit of ${policy.coverageAmount} ${policy.currency}`);
    }

    // Create claim
    const claimId = generateId('clm');
    const claim: Claim = {
      id: claimId,
      policyId,
      orderId: policy.orderId,
      type,
      description,
      claimedAmount,
      status: 'pending',
      documents,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    claims.set(claimId, claim);

    logger.info('Claim created', { 
      claimId, 
      policyId, 
      type, 
      claimedAmount 
    });

    // Notify partner
    triggerPartnerWebhook(policy.partnerId, 'claim_created', {
      claimId,
      policyId,
      orderId: policy.orderId,
      claimedAmount
    });

    res.status(201).json(successResponse(claim, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /insurance/claim/:id - Get claim
app.get('/insurance/claim/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const claim = claims.get(req.params.id);
    
    if (!claim) {
      throw new NotFoundError('Claim');
    }

    res.json(successResponse(claim, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /insurance/claim/:id/process - Process claim (Partner only)
app.post('/insurance/claim/:id/process', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, approvedAmount, notes } = req.body;
    const claim = claims.get(req.params.id);
    
    if (!claim) {
      throw new NotFoundError('Claim');
    }

    claim.status = status;
    claim.updatedAt = new Date();
    claims.set(claim.id, claim);

    // If approved, update policy
    if (status === 'approved' || status === 'paid') {
      const policy = policies.get(claim.policyId);
      if (policy && status === 'paid') {
        policy.status = 'claimed';
        policy.updatedAt = new Date();
        policies.set(policy.id, policy);
      }
    }

    logger.info('Claim processed', { 
      claimId: claim.id, 
      status,
      approvedAmount 
    });

    res.json(successResponse(claim, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: COMMISSIONS
// ============================================

// GET /insurance/commissions - List commissions
app.get('/insurance/commissions', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const partnerPolicies = Array.from(policies.values())
      .filter(p => p.partnerId === req.partnerId);

    const commissions = partnerPolicies.map(p => ({
      policyId: p.id,
      policyNumber: p.policyNumber,
      premium: p.premium,
      commissionAmount: p.commissionAmount,
      commissionPaid: p.commissionPaid,
      createdAt: p.createdAt
    }));

    const totalCommission = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const unpaidCommission = commissions
      .filter(c => !c.commissionPaid)
      .reduce((sum, c) => sum + c.commissionAmount, 0);

    res.json(successResponse({
      commissions,
      summary: {
        total: totalCommission,
        unpaid: unpaidCommission,
        paid: totalCommission - unpaidCommission
      }
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function triggerPartnerWebhook(
  partnerId: string, 
  event: string, 
  data: unknown
): Promise<void> {
  // In production: fetch webhook URL from partner config and POST
  logger.info('Partner webhook triggered', { partnerId, event });
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'insurance-service',
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    stats: {
      quotes: quotes.size,
      policies: policies.size,
      claims: claims.size
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

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  logger.info(`Insurance service started on port ${PORT}`);
});

export default app;
