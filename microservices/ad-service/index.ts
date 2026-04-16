// CargoBit Ad Service
// =====================
// Handles: Campaigns, Banner Slots, Impression/Click Tracking, Commissions

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import {
  AdCampaign,
  AdImpression,
  AdClick,
  AdPosition,
  AdTargeting,
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

const logger = new Logger('ad-service');
const app = express();

// Ad slot configurations
const AD_SLOTS: Record<AdPosition, {
  name: string;
  width: number;
  height: number;
  maxFileSizeKB: number;
  formats: string[];
  pricePerImpression: number; // in cents
}> = {
  banner_top: {
    name: 'Top Banner',
    width: 728,
    height: 90,
    maxFileSizeKB: 150,
    formats: ['image/jpeg', 'image/png', 'image/gif'],
    pricePerImpression: 0.5
  },
  banner_sidebar: {
    name: 'Sidebar Banner',
    width: 300,
    height: 250,
    maxFileSizeKB: 100,
    formats: ['image/jpeg', 'image/png', 'image/gif'],
    pricePerImpression: 0.3
  },
  listing_highlight: {
    name: 'Listing Highlight',
    width: 0,
    height: 0,
    maxFileSizeKB: 0,
    formats: [],
    pricePerImpression: 1.0
  },
  popup: {
    name: 'Popup Ad',
    width: 600,
    height: 400,
    maxFileSizeKB: 200,
    formats: ['image/jpeg', 'image/png', 'image/gif'],
    pricePerImpression: 2.0
  }
};

// Commission rates for ad partners
const AD_COMMISSION_RATES = {
  free: 0.10,        // 10%
  starter: 0.08,     // 8%
  professional: 0.05, // 5%
  enterprise: 0.03    // 3%
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

interface StoredCampaign extends AdCampaign {
  partnerId: string;
  clickCount: number;
  impressionCount: number;
  ctr: number;
  totalSpent: number;
}

interface StoredImpression extends AdImpression {
  campaignId: string;
}

interface StoredClick extends AdClick {
  campaignId: string;
}

interface DailyStats {
  campaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  spent: number;
}

const campaigns: Map<string, StoredCampaign> = new Map();
const impressions: Map<string, StoredImpression> = new Map();
const clicks: Map<string, StoredClick> = new Map();
const dailyStats: Map<string, DailyStats> = new Map();

// ============================================
// ROUTES: CAMPAIGNS
// ============================================

// GET /ads/campaigns - List campaigns
app.get('/ads/campaigns', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;

    let filtered = Array.from(campaigns.values())
      .filter(c => c.partnerId === req.partnerId);

    if (status) {
      filtered = filtered.filter(c => c.status === status);
    }

    // Sort by creation date
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Paginate
    const total = filtered.length;
    const startIndex = (Number(page) - 1) * Number(pageSize);
    const paginated = filtered.slice(startIndex, startIndex + Number(pageSize));

    res.setHeader('X-Total-Count', total.toString());
    res.json(successResponse({
      data: paginated,
      total,
      page: Number(page),
      pageSize: Number(pageSize)
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /ads/campaigns - Create campaign
app.post('/ads/campaigns', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      description,
      position,
      bannerUrl,
      targetUrl,
      budget,
      currency = 'EUR',
      startDate,
      endDate,
      targeting
    } = req.body;

    // Validate
    if (!name || !position || !targetUrl || !budget) {
      throw new ValidationError('Missing required fields: name, position, targetUrl, budget');
    }

    if (!AD_SLOTS[position as AdPosition]) {
      throw new ValidationError(`Invalid position. Valid options: ${Object.keys(AD_SLOTS).join(', ')}`);
    }

    // Create campaign
    const campaignId = generateId('camp');
    const campaign: StoredCampaign = {
      id: campaignId,
      partnerId: req.partnerId!,
      name,
      description,
      position: position as AdPosition,
      bannerUrl,
      targetUrl,
      budget,
      spentAmount: 0,
      currency,
      status: 'draft',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined,
      targeting: targeting as AdTargeting,
      clickCount: 0,
      impressionCount: 0,
      ctr: 0,
      totalSpent: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    campaigns.set(campaignId, campaign);

    logger.info('Campaign created', { 
      campaignId, 
      name, 
      position, 
      budget,
      partnerId: req.partnerId 
    });

    res.status(201).json(successResponse(campaign, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /ads/campaigns/:id - Get campaign
app.get('/ads/campaigns/:id', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaign = campaigns.get(req.params.id);
    
    if (!campaign) {
      throw new NotFoundError('Campaign');
    }

    if (campaign.partnerId !== req.partnerId) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Access denied to this campaign' }
      });
    }

    res.json(successResponse(campaign, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// PUT /ads/campaigns/:id - Update campaign
app.put('/ads/campaigns/:id', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaign = campaigns.get(req.params.id);
    
    if (!campaign) {
      throw new NotFoundError('Campaign');
    }

    if (campaign.partnerId !== req.partnerId) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Access denied to this campaign' }
      });
    }

    // Only allow updates if campaign is draft or paused
    if (campaign.status === 'active' || campaign.status === 'completed') {
      throw new ValidationError('Cannot update active or completed campaigns');
    }

    const updates = req.body;
    
    // Apply allowed updates
    const allowedUpdates = ['name', 'description', 'bannerUrl', 'targetUrl', 'budget', 'targeting', 'startDate', 'endDate'];
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        (campaign as Record<string, unknown>)[key] = updates[key];
      }
    }
    
    campaign.updatedAt = new Date();
    campaigns.set(campaign.id, campaign);

    logger.info('Campaign updated', { campaignId: campaign.id });

    res.json(successResponse(campaign, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /ads/campaigns/:id/start - Start campaign
app.post('/ads/campaigns/:id/start', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaign = campaigns.get(req.params.id);
    
    if (!campaign) {
      throw new NotFoundError('Campaign');
    }

    if (campaign.status !== 'draft' && campaign.status !== 'paused') {
      throw new ValidationError(`Cannot start campaign in ${campaign.status} status`);
    }

    if (campaign.spentAmount >= campaign.budget) {
      throw new ValidationError('Campaign budget exhausted');
    }

    campaign.status = 'active';
    campaign.updatedAt = new Date();
    campaigns.set(campaign.id, campaign);

    logger.info('Campaign started', { campaignId: campaign.id });

    res.json(successResponse(campaign, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /ads/campaigns/:id/pause - Pause campaign
app.post('/ads/campaigns/:id/pause', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaign = campaigns.get(req.params.id);
    
    if (!campaign) {
      throw new NotFoundError('Campaign');
    }

    if (campaign.status !== 'active') {
      throw new ValidationError('Can only pause active campaigns');
    }

    campaign.status = 'paused';
    campaign.updatedAt = new Date();
    campaigns.set(campaign.id, campaign);

    logger.info('Campaign paused', { campaignId: campaign.id });

    res.json(successResponse(campaign, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: AD SERVING (Public)
// ============================================

// GET /ads/render - Get ads for a page
app.get('/ads/render', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, position, sessionId, userId } = req.query;

    if (!page || !position) {
      throw new ValidationError('Missing required fields: page, position');
    }

    // Find active campaigns for this position
    const matchingCampaigns = Array.from(campaigns.values())
      .filter(c => 
        c.status === 'active' &&
        c.position === position &&
        c.spentAmount < c.budget &&
        (!c.endDate || c.endDate > new Date())
      );

    if (matchingCampaigns.length === 0) {
      return res.json(successResponse({
        hasAd: false,
        message: 'No ads available'
      }, req.headers['x-request-id'] as string));
    }

    // Simple rotation - pick random campaign
    // In production: use weighted algorithm based on CTR, budget, targeting
    const selectedCampaign = matchingCampaigns[Math.floor(Math.random() * matchingCampaigns.length)];

    // Record impression
    const impressionId = generateId('imp');
    const impression: StoredImpression = {
      id: impressionId,
      campaignId: selectedCampaign.id,
      userId: userId as string,
      sessionId: sessionId as string || crypto.randomUUID(),
      page: page as string,
      position: position as AdPosition,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      createdAt: new Date()
    };

    impressions.set(impressionId, impression);

    // Update campaign stats
    selectedCampaign.impressionCount++;
    const slotConfig = AD_SLOTS[position as AdPosition];
    const cost = slotConfig.pricePerImpression / 100; // Convert cents to currency
    selectedCampaign.spentAmount += cost;
    selectedCampaign.totalSpent += cost;
    campaigns.set(selectedCampaign.id, selectedCampaign);

    // Update daily stats
    updateDailyStats(selectedCampaign.id, 'impression', cost);

    // Return ad data
    res.json(successResponse({
      hasAd: true,
      impressionId,
      campaignId: selectedCampaign.id,
      bannerUrl: selectedCampaign.bannerUrl,
      targetUrl: selectedCampaign.targetUrl,
      clickUrl: `/ads/click?impressionId=${impressionId}`,
      dimensions: {
        width: slotConfig.width,
        height: slotConfig.height
      }
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /ads/click - Record click
app.post('/ads/click', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { impressionId, userId } = req.body;

    if (!impressionId) {
      throw new ValidationError('Missing impressionId');
    }

    const impression = impressions.get(impressionId);
    if (!impression) {
      throw new NotFoundError('Impression');
    }

    const campaign = campaigns.get(impression.campaignId);
    if (!campaign) {
      throw new NotFoundError('Campaign');
    }

    // Record click
    const clickId = generateId('clk');
    const click: StoredClick = {
      id: clickId,
      impressionId,
      campaignId: campaign.id,
      userId,
      clickedAt: new Date()
    };

    clicks.set(clickId, click);

    // Update campaign stats
    campaign.clickCount++;
    campaign.ctr = campaign.clickCount / campaign.impressionCount;
    campaigns.set(campaign.id, campaign);

    // Update daily stats
    updateDailyStats(campaign.id, 'click', 0);

    logger.info('Ad clicked', { clickId, campaignId: campaign.id, impressionId });

    res.json(successResponse({
      clickId,
      redirectUrl: campaign.targetUrl
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /ads/click - Redirect click (for image banners)
app.get('/ads/click', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { impressionId } = req.query;

    if (!impressionId) {
      throw new ValidationError('Missing impressionId');
    }

    const impression = impressions.get(impressionId as string);
    if (!impression) {
      throw new NotFoundError('Impression');
    }

    const campaign = campaigns.get(impression.campaignId);
    if (!campaign) {
      throw new NotFoundError('Campaign');
    }

    // Record click
    const clickId = generateId('clk');
    const click: StoredClick = {
      id: clickId,
      impressionId: impressionId as string,
      campaignId: campaign.id,
      userId: impression.userId,
      clickedAt: new Date()
    };

    clicks.set(clickId, click);

    // Update campaign stats
    campaign.clickCount++;
    campaign.ctr = campaign.clickCount / campaign.impressionCount;
    campaigns.set(campaign.id, campaign);

    // Update daily stats
    updateDailyStats(campaign.id, 'click', 0);

    logger.info('Ad clicked (redirect)', { clickId, campaignId: campaign.id });

    // Redirect to target URL
    res.redirect(campaign.targetUrl);
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: ANALYTICS
// ============================================

// GET /ads/campaigns/:id/stats - Get campaign stats
app.get('/ads/campaigns/:id/stats', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const campaign = campaigns.get(req.params.id);
    
    if (!campaign) {
      throw new NotFoundError('Campaign');
    }

    if (campaign.partnerId !== req.partnerId) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Access denied' }
      });
    }

    // Get daily stats
    const campaignStats = Array.from(dailyStats.values())
      .filter(s => s.campaignId === campaign.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    res.json(successResponse({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        budget: campaign.budget,
        spentAmount: campaign.spentAmount,
        remaining: campaign.budget - campaign.spentAmount
      },
      totals: {
        impressions: campaign.impressionCount,
        clicks: campaign.clickCount,
        ctr: (campaign.ctr * 100).toFixed(2) + '%',
        spent: campaign.totalSpent
      },
      daily: campaignStats
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /ads/commissions - Get partner commissions
app.get('/ads/commissions', requirePartner, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const partnerCampaigns = Array.from(campaigns.values())
      .filter(c => c.partnerId === req.partnerId);

    // Calculate commission (platform fee from ad spend)
    const commissionRate = AD_COMMISSION_RATES.professional;
    const totalSpent = partnerCampaigns.reduce((sum, c) => sum + c.totalSpent, 0);
    const platformCommission = totalSpent * commissionRate;

    res.json(successResponse({
      campaigns: partnerCampaigns.map(c => ({
        id: c.id,
        name: c.name,
        spent: c.totalSpent,
        impressions: c.impressionCount,
        clicks: c.clickCount
      })),
      summary: {
        totalSpent,
        platformCommission,
        commissionRate: (commissionRate * 100) + '%'
      }
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function updateDailyStats(campaignId: string, type: 'impression' | 'click', cost: number): void {
  const today = new Date().toISOString().split('T')[0];
  const key = `${campaignId}_${today}`;
  
  let stats = dailyStats.get(key);
  
  if (!stats) {
    stats = {
      campaignId,
      date: today,
      impressions: 0,
      clicks: 0,
      spent: 0
    };
  }
  
  if (type === 'impression') {
    stats.impressions++;
    stats.spent += cost;
  } else {
    stats.clicks++;
  }
  
  dailyStats.set(key, stats);
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'ad-service',
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    stats: {
      campaigns: campaigns.size,
      impressions: impressions.size,
      clicks: clicks.size
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

const PORT = process.env.PORT || 3004;

// Seed demo campaign
function seedDemoData() {
  const demoCampaign: StoredCampaign = {
    id: 'camp_demo_001',
    partnerId: 'partner_transportads',
    name: 'Demo Logistics Banner',
    description: 'Promotional banner for logistics services',
    position: 'banner_top',
    bannerUrl: 'https://via.placeholder.com/728x90/0066cc/ffffff?text=Your+Ad+Here',
    targetUrl: 'https://example.com',
    budget: 1000,
    spentAmount: 50,
    currency: 'EUR',
    status: 'active',
    startDate: new Date(),
    clickCount: 45,
    impressionCount: 1200,
    ctr: 0.0375,
    totalSpent: 50,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  campaigns.set(demoCampaign.id, demoCampaign);
  logger.info('Demo data seeded');
}

seedDemoData();

app.listen(PORT, () => {
  logger.info(`Ad service started on port ${PORT}`);
});

export default app;
