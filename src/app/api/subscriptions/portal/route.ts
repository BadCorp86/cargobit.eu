import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { requireRequestUser } from '@/lib/request-user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getPublicAppUrl(request: NextRequest) {
  const localOrigin = request.nextUrl.origin;
  if (process.env.NODE_ENV !== 'production' && localOrigin.startsWith('http')) {
    return localOrigin;
  }

  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || process.env.VERCEL_URL || localOrigin || 'https://cargobit.eu';
  return url.startsWith('http') ? url : `https://${url}`;
}

export async function POST(request: NextRequest) {
  const auth = await requireRequestUser(request);
  if (auth.response) return auth.response;
  const userId = auth.user!.id;
  const appUrl = getPublicAppUrl(request);

  try {
    const companyUser = await db.companyUser.findFirst({
      where: {
        userId,
        roleInCompany: { in: ['owner', 'admin'] },
      },
      include: {
        company: {
          select: {
            stripeCustomerId: true,
          },
        },
      },
    });

    if (!companyUser) {
      return NextResponse.json(
        {
          error: 'PermissionError',
          message: 'Nur Firmeneigner oder Firmenadmins können den Business-Tarif verwalten.',
          code: 'NOT_COMPANY_ADMIN',
        },
        { status: 403 },
      );
    }

    const activePlan = await db.companyPlan.findFirst({
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
    });

    const stripeCustomerId = companyUser.company.stripeCustomerId || activePlan?.stripeCustomerId;
    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error: 'NoStripeCustomer',
          message: 'Für dieses Unternehmen ist noch kein Stripe-Kunde hinterlegt.',
          code: 'NO_STRIPE_CUSTOMER',
        },
        { status: 409 },
      );
    }

    if (!process.env.STRIPE_SECRET_KEY || !stripeCustomerId.startsWith('cus_')) {
      return NextResponse.json(
        {
          error: 'StripeConfigurationError',
          message: 'Stripe Customer Portal ist nicht vollständig konfiguriert.',
          code: 'STRIPE_PORTAL_NOT_CONFIGURED',
        },
        { status: 500 },
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/billing?portal=return`,
    });

    return NextResponse.json({
      success: true,
      provider: 'stripe',
      portalUrl: session.url,
    });
  } catch (error) {
    console.error('[SubscriptionPortal] Failed to create customer portal session:', error);

    return NextResponse.json(
      {
        error: 'InternalServerError',
        message: 'Business-Verwaltung konnte nicht geöffnet werden.',
        code: 'PORTAL_SESSION_FAILED',
      },
      { status: 500 },
    );
  }
}
