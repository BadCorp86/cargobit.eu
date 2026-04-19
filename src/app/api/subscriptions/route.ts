// ============================================
// CARGOBIT SUBSCRIPTION API
// GET /subscriptions/me - Get current subscription
// POST /subscriptions/checkout - Create Stripe Checkout Session
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Stripe Price IDs (would be configured in env in production)
const STRIPE_PRICES: Record<string, { monthly: string; yearly: string }> = {
  starter: {
    monthly: 'price_starter_monthly_mock',
    yearly: 'price_starter_yearly_mock',
  },
  professional: {
    monthly: 'price_professional_monthly_mock',
    yearly: 'price_professional_yearly_mock',
  },
  enterprise: {
    monthly: 'price_enterprise_monthly_mock',
    yearly: 'price_enterprise_yearly_mock',
  },
};

// Plan configurations
const PLAN_CONFIG: Record<string, {
  name: string;
  monthlyFee: number;
  yearlyFee: number;
  commissionPercent: number;
  walletFeePercent: number;
  features: string[];
}> = {
  free: {
    name: 'Free',
    monthlyFee: 0,
    yearlyFee: 0,
    commissionPercent: 14,
    walletFeePercent: 3.5,
    features: ['5 Transporte/Monat', 'Basis-Matching', 'E-Mail Support'],
  },
  starter: {
    name: 'Starter',
    monthlyFee: 89,
    yearlyFee: 890,
    commissionPercent: 10,
    walletFeePercent: 3.5,
    features: ['25 Transporte/Monat', 'Erweitertes Matching', 'Prioritäts-Support', 'API-Zugang'],
  },
  professional: {
    name: 'Professional',
    monthlyFee: 699,
    yearlyFee: 6990,
    commissionPercent: 8,
    walletFeePercent: 3.5,
    features: ['Unbegrenzte Transporte', 'Smart Matching Premium', '24/7 Support', 'API-Zugang', 'Automatische Dokumente', 'Custom Branding'],
  },
  enterprise: {
    name: 'Enterprise',
    monthlyFee: 0, // On request
    yearlyFee: 0,
    commissionPercent: 6,
    walletFeePercent: 3.5,
    features: ['Alles aus Professional', 'Dedizierter Account Manager', 'Individuelle Integration', 'SLA Garantie'],
  },
};

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

// ============================================
// GET /api/subscriptions/me - Get current subscription
// ============================================
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';

    // Get user's company
    const companyUser = await db.companyUser.findFirst({
      where: { userId },
      include: { company: true },
    });

    if (!companyUser) {
      // Return free plan for users without company
      return NextResponse.json({
        success: true,
        subscription: {
          plan: 'free',
          ...PLAN_CONFIG.free,
          status: 'active',
          currentPeriodEnd: null,
          stripeSubscriptionId: null,
        },
      });
    }

    // Get company's active plan
    const companyPlan = await db.companyPlan.findFirst({
      where: {
        companyId: companyUser.companyId,
        validTo: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    if (!companyPlan) {
      return NextResponse.json({
        success: true,
        subscription: {
          plan: 'free',
          ...PLAN_CONFIG.free,
          status: 'active',
          currentPeriodEnd: null,
          stripeSubscriptionId: null,
          companyId: companyUser.companyId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      subscription: {
        plan: companyPlan.plan.name.toLowerCase(),
        ...PLAN_CONFIG[companyPlan.plan.name.toLowerCase()] || PLAN_CONFIG.free,
        status: 'active',
        currentPeriodEnd: companyPlan.validTo,
        validFrom: companyPlan.validFrom,
        stripeSubscriptionId: null, // Would come from a subscription table
        companyId: companyUser.companyId,
      },
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler beim Abrufen des Abonnements',
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
    const { plan, billingCycle = 'monthly' } = body;
    const userId = request.headers.get('x-user-id') || 'demo-user';

    // Validate plan
    if (!['starter', 'professional', 'enterprise'].includes(plan)) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Ungültiger Plan',
        code: 'INVALID_PLAN',
      }, { status: 400 });
    }

    // Enterprise requires contact
    if (plan === 'enterprise') {
      return NextResponse.json({
        success: false,
        message: 'Enterprise erfordert Kontaktaufnahme. Bitte schreiben Sie an sales@cargobit.de',
        redirect: 'mailto:sales@cargobit.de',
      });
    }

    // Get user's company
    const companyUser = await db.companyUser.findFirst({
      where: { userId, roleInCompany: 'owner' },
    });

    if (!companyUser) {
      return NextResponse.json({
        error: 'PermissionError',
        message: 'Nur Firmeneigner können Abonnements abschließen',
        code: 'NOT_COMPANY_OWNER',
      }, { status: 403 });
    }

    // Get price ID
    const priceId = STRIPE_PRICES[plan]?.[billingCycle];
    if (!priceId) {
      return NextResponse.json({
        error: 'ConfigurationError',
        message: 'Preiskonfiguration nicht gefunden',
        code: 'PRICE_NOT_FOUND',
      }, { status: 500 });
    }

    // Create Stripe Checkout Session
    const session = await mockStripeCheckout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'sepa_debit'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: `${process.env.NEXT_PUBLIC_URL || 'https://cargobit.de'}/app?subscription=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL || 'https://cargobit.de'}/app?subscription=cancel`,
      client_reference_id: userId,
      metadata: {
        userId,
        companyId: companyUser.companyId,
        plan,
        billingCycle,
      },
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      plan,
      billingCycle,
      price: billingCycle === 'yearly' 
        ? PLAN_CONFIG[plan].yearlyFee 
        : PLAN_CONFIG[plan].monthlyFee,
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
