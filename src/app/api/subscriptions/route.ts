// ============================================
// CARGOBIT SUBSCRIPTION API
// GET /subscriptions/me - Get current subscription
// POST /subscriptions/checkout - Create Stripe Checkout Session
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { getSubscriptionPlanConfig } from '@/lib/billing/plans';
import { requireRequestUser } from '@/lib/request-user-auth';

const STRIPE_PRICE_ENV_KEYS: Record<string, { monthly: string; yearly?: string }> = {
  starter: {
    monthly: 'STRIPE_PRICE_BUSINESS_MONTHLY',
  },
};

const PLAN_CONFIG = getSubscriptionPlanConfig();

type BillingCycle = 'monthly' | 'yearly';

// Mock Stripe Checkout
const mockStripeCheckout = {
  sessions: {
    create: async (params: any) => ({
      id: `cs_mock_${Date.now()}`,
      url: `https://checkout.stripe.com/mock/${Date.now()}`,
      client_reference_id: params.client_reference_id,
      metadata: params.metadata,
    }),
  },
};

function getStripePriceId(plan: string, billingCycle: 'monthly' | 'yearly') {
  const envKey = STRIPE_PRICE_ENV_KEYS[plan]?.[billingCycle];
  if (envKey) {
    return process.env[envKey]
      || (plan === 'starter' && billingCycle === 'monthly' ? process.env.STRIPE_PRICE_STARTER_MONTHLY : undefined)
      || `price_${plan}_${billingCycle}_mock`;
  }

  return undefined;
}

function normalizePublicPlan(plan: unknown) {
  const normalized = String(plan || '').toLowerCase();
  if (normalized === 'business') return 'starter';
  return normalized;
}

function getPublicAppUrl(request?: NextRequest) {
  const localOrigin = request?.nextUrl.origin;
  if (process.env.NODE_ENV !== 'production' && localOrigin?.startsWith('http')) {
    return localOrigin;
  }

  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL || localOrigin || 'https://cargobit.eu';
  return url.startsWith('http') ? url : `https://${url}`;
}

async function createStripeCheckoutSession(params: {
  priceId: string;
  userId: string;
  companyId: string;
  stripeCustomerId?: string | null;
  plan: string;
  billingCycle: BillingCycle;
  metadata: Record<string, string | number>;
  appUrl: string;
  forceMock?: boolean;
}) {
  const appUrl = params.appUrl;

  if (params.forceMock || !process.env.STRIPE_SECRET_KEY || params.priceId.includes('_mock')) {
    const sessionId = `cs_mock_${Date.now()}`;
    const session = await mockStripeCheckout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'sepa_debit'],
      line_items: [{
        price: params.priceId,
        quantity: 1,
      }],
      success_url: `${appUrl}/billing?checkout=mock_success&session_id=${sessionId}`,
      cancel_url: `${appUrl}/billing?checkout=cancel`,
      client_reference_id: params.userId,
      metadata: params.metadata,
    });

    return {
      ...session,
      id: sessionId,
      url: `${appUrl}/billing?checkout=mock_success&session_id=${sessionId}`,
      provider: 'mock',
    };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const metadata = Object.fromEntries(
    Object.entries(params.metadata).map(([key, value]) => [key, String(value)]),
  );
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card', 'sepa_debit'],
    line_items: [{
      price: params.priceId,
      quantity: 1,
    }],
    ...(params.stripeCustomerId?.startsWith('cus_') ? { customer: params.stripeCustomerId } : {}),
    success_url: `${appUrl}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/billing?checkout=cancel`,
    client_reference_id: params.userId,
    metadata,
    subscription_data: {
      metadata,
    },
    automatic_tax: {
      enabled: process.env.STRIPE_TAX_ENABLED === 'true',
    },
  });

  return {
    id: session.id,
    url: session.url,
    provider: 'stripe',
  };
}

function subscriptionResponse(subscription: Record<string, unknown>, source = 'database') {
  return NextResponse.json({
    success: true,
    subscription,
    plans: PLAN_CONFIG,
    source,
  });
}

function freeSubscription(companyId?: string | null) {
  return {
    plan: 'free',
    ...PLAN_CONFIG.free,
    status: 'active',
    currentPeriodEnd: null,
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    billingCycle: null,
    cancelAtPeriodEnd: false,
    companyId: companyId || null,
  };
}

async function findCompanyOwner(userId: string) {
  try {
    const companyUser = await db.companyUser.findFirst({
      where: { userId, roleInCompany: 'owner' },
      include: {
        company: {
          select: {
            stripeCustomerId: true,
          },
        },
      },
    });

    const activePlan = companyUser
      ? await db.companyPlan.findFirst({
          where: {
            companyId: companyUser.companyId,
            OR: [
              { validTo: null },
              { validTo: { gte: new Date() } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: {
            stripeCustomerId: true,
          },
      })
      : null;

    if (!companyUser && process.env.NODE_ENV !== 'production') {
      return {
        companyId: 'demo-company',
        stripeCustomerId: 'cus_demo_customer',
        source: 'development_fallback' as const,
        dbAvailable: false,
      };
    }

    return {
      companyId: companyUser?.companyId || null,
      stripeCustomerId: companyUser?.company?.stripeCustomerId || activePlan?.stripeCustomerId || null,
      source: 'database' as const,
      dbAvailable: true,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Subscriptions] Company owner lookup failed, using development fallback:', error);
      return {
        companyId: 'demo-company',
        stripeCustomerId: 'cus_demo_customer',
        source: 'development_fallback' as const,
        dbAvailable: false,
      };
    }

    throw error;
  }
}

// ============================================
// GET /api/subscriptions/me - Get current subscription
// ============================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user!.id;

    // Get user's company
    const companyUser = await db.companyUser.findFirst({
      where: { userId },
      include: {
        company: {
          select: {
            stripeCustomerId: true,
          },
        },
      },
    });

    if (!companyUser) {
      // Return free plan for users without company
      return subscriptionResponse(freeSubscription());
    }

    // Get company's active plan
    const companyPlan = await db.companyPlan.findFirst({
      where: {
        companyId: companyUser.companyId,
        OR: [
          { validTo: null },
          { validTo: { gte: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    if (!companyPlan) {
      return subscriptionResponse(freeSubscription(companyUser.companyId));
    }

    const planKey = companyPlan.plan.name.toLowerCase();
    const publicPlan = planKey === 'starter' ? 'business' : planKey;
    return subscriptionResponse({
      plan: planKey,
      publicPlan,
      planLabel: (PLAN_CONFIG[planKey] || PLAN_CONFIG.free).name,
      ...(PLAN_CONFIG[planKey] || PLAN_CONFIG.free),
      status: 'active',
      currentPeriodEnd: companyPlan.validTo,
      validFrom: companyPlan.validFrom,
      stripeSubscriptionId: companyPlan.stripeSubscriptionId,
      stripeCustomerId: companyPlan.stripeCustomerId || companyUser.company.stripeCustomerId,
      billingCycle: companyPlan.billingCycle,
      cancelAtPeriodEnd: companyPlan.cancelAtPeriodEnd,
      stripeStatus: companyPlan.stripeStatus,
      companyId: companyUser.companyId,
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    if (process.env.NODE_ENV !== 'production') {
      return subscriptionResponse(freeSubscription('demo-company'), 'development_fallback');
    }

    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler beim Abrufen des Business-Tarifs',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}

// ============================================
// POST /api/subscriptions/checkout - Create checkout session
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const plan = normalizePublicPlan(body.plan);
    const billingCycle = body.billingCycle === 'monthly' || !body.billingCycle ? 'monthly' : null;
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user!.id;
    const appUrl = getPublicAppUrl(request);

    // Validate plan
    if (plan !== 'starter') {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Aktuell ist nur der Business-Tarif verfügbar.',
        code: 'INVALID_PLAN',
      }, { status: 400 });
    }

    if (!billingCycle) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Business ist aktuell nur monatlich verfügbar.',
        code: 'INVALID_BILLING_CYCLE',
      }, { status: 400 });
    }

    const companyOwner = await findCompanyOwner(userId);
    const companyId = companyOwner.companyId;
    if (!companyId) {
      return NextResponse.json({
        error: 'PermissionError',
        message: 'Nur Firmeneigner können den Business-Tarif abschließen',
        code: 'NOT_COMPANY_OWNER',
      }, { status: 403 });
    }

    // Get price ID
    const priceId = getStripePriceId(plan, billingCycle);
    const planConfig = PLAN_CONFIG[plan];
    if (!priceId) {
      return NextResponse.json({
        error: 'ConfigurationError',
        message: 'Preiskonfiguration nicht gefunden',
        code: 'PRICE_NOT_FOUND',
      }, { status: 500 });
    }

    const selectedPrice = planConfig.monthlyPrice;

    const session = await createStripeCheckoutSession({
      priceId,
      userId,
      companyId,
      stripeCustomerId: companyOwner.stripeCustomerId,
      plan,
      billingCycle,
      appUrl,
      forceMock: !companyOwner.dbAvailable,
      metadata: {
        userId,
        companyId,
        plan,
        billingCycle,
        priceNet: selectedPrice.netAmount,
        vatAmount: selectedPrice.vatAmount,
        priceGross: selectedPrice.grossAmount,
        vatPercent: selectedPrice.vatPercent,
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      checkoutProvider: session.provider,
      plan: 'business',
      internalPlan: plan,
      billingCycle,
      price: selectedPrice.netAmount,
      priceNet: selectedPrice.netAmount,
      vatPercent: selectedPrice.vatPercent,
      vatAmount: selectedPrice.vatAmount,
      priceGross: selectedPrice.grossAmount,
      currency: selectedPrice.currency,
      vatNotice: planConfig.vatNotice,
      source: companyOwner.source,
    });
  } catch (error) {
    console.error('Checkout creation error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler beim Erstellen der Checkout-Session',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}
