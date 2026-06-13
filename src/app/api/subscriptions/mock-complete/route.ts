import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateSubscriptionPrice, getBillingPlan } from '@/lib/billing/plans';
import { getOptionalRequestUser } from '@/lib/request-user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Mock-Checkout ist in Production deaktiviert.',
        code: 'MOCK_CHECKOUT_DISABLED',
      },
      { status: 403 },
    );
  }

  const requestUser = await getOptionalRequestUser(request);
  const userId = requestUser?.id || 'demo-user';
  const body = await request.json().catch(() => ({}));
  const sessionId = String(body.sessionId || `cs_mock_${Date.now()}`);
  const businessPlan = getBillingPlan('STARTER');
  const price = calculateSubscriptionPrice(businessPlan.monthlyFee);
  const now = new Date();
  const validTo = new Date(now);
  validTo.setMonth(validTo.getMonth() + 1);

  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { id: userId },
      update: {
        status: 'ACTIVE',
      },
      create: {
        id: userId,
        email: `${userId}@demo.cargobit.local`,
        passwordHash: 'development-mock-user',
        firstName: 'Demo',
        lastName: 'User',
        status: 'ACTIVE',
      },
    });

    const company = await tx.company.upsert({
      where: { id: 'demo-business-company' },
      update: {
        name: 'CargoBit Demo Business',
        type: 'SHIPPER',
        country: 'DE',
        status: 'ACTIVE',
        stripeCustomerId: 'cus_demo_business',
      },
      create: {
        id: 'demo-business-company',
        name: 'CargoBit Demo Business',
        type: 'SHIPPER',
        country: 'DE',
        status: 'ACTIVE',
        stripeCustomerId: 'cus_demo_business',
      },
    });

    await tx.companyUser.upsert({
      where: {
        companyId_userId: {
          companyId: company.id,
          userId: user.id,
        },
      },
      create: {
        companyId: company.id,
        userId: user.id,
        roleInCompany: 'owner',
      },
      update: {
        roleInCompany: 'owner',
      },
    });

    const plan = await tx.plan.upsert({
      where: { name: 'STARTER' },
      create: {
        name: 'STARTER',
        monthlyFee: businessPlan.monthlyFee,
        yearlyFee: businessPlan.yearlyFee || null,
        currency: 'EUR',
        commissionPercent: businessPlan.commissionPercent,
        walletFeePercent: businessPlan.walletFeePercent,
        featuresJson: JSON.stringify({
          label: businessPlan.name,
          maxTransports: businessPlan.maxTransportsMonthly,
          features: businessPlan.features,
          pricesExcludeVat: true,
          vatNotice: businessPlan.vatNotice,
        }),
      },
      update: {
        monthlyFee: businessPlan.monthlyFee,
        yearlyFee: businessPlan.yearlyFee || null,
        currency: 'EUR',
        commissionPercent: businessPlan.commissionPercent,
        walletFeePercent: businessPlan.walletFeePercent,
        featuresJson: JSON.stringify({
          label: businessPlan.name,
          maxTransports: businessPlan.maxTransportsMonthly,
          features: businessPlan.features,
          pricesExcludeVat: true,
          vatNotice: businessPlan.vatNotice,
        }),
      },
    });

    await tx.companyPlan.updateMany({
      where: {
        companyId: company.id,
        OR: [
          { validTo: null },
          { validTo: { gte: now } },
        ],
      },
      data: { validTo: now },
    });

    const companyPlan = await tx.companyPlan.upsert({
      where: { stripeSubscriptionId: `sub_mock_${sessionId}` },
      create: {
        companyId: company.id,
        planId: plan.id,
        validFrom: now,
        validTo,
        stripeCustomerId: 'cus_demo_business',
        stripeSubscriptionId: `sub_mock_${sessionId}`,
        stripeCheckoutSessionId: sessionId,
        stripeStatus: 'active',
        billingCycle: 'monthly',
        latestInvoiceId: `in_mock_${sessionId}`,
        cancelAtPeriodEnd: false,
      },
      update: {
        planId: plan.id,
        validFrom: now,
        validTo,
        stripeCustomerId: 'cus_demo_business',
        stripeCheckoutSessionId: sessionId,
        stripeStatus: 'active',
        billingCycle: 'monthly',
        latestInvoiceId: `in_mock_${sessionId}`,
        cancelAtPeriodEnd: false,
      },
    });

    const invoice = await tx.subscriptionInvoice.upsert({
      where: { stripeInvoiceId: `in_mock_${sessionId}` },
      create: {
        companyId: company.id,
        stripeInvoiceId: `in_mock_${sessionId}`,
        stripeCustomerId: 'cus_demo_business',
        stripeSubscriptionId: companyPlan.stripeSubscriptionId,
        invoiceNumber: `CB-BUS-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        status: 'paid',
        currency: 'EUR',
        subtotal: price.netAmount,
        tax: price.vatAmount,
        total: price.grossAmount,
        amountPaid: price.grossAmount,
        amountDue: 0,
        periodStart: now,
        periodEnd: validTo,
        issuedAt: now,
        dueAt: now,
        paidAt: now,
        emailRecipient: user.email,
        emailSent: false,
        emailProvider: 'development-mock',
        rawPayload: JSON.stringify({ sessionId, provider: 'mock' }),
      },
      update: {
        companyId: company.id,
        stripeSubscriptionId: companyPlan.stripeSubscriptionId,
        status: 'paid',
        subtotal: price.netAmount,
        tax: price.vatAmount,
        total: price.grossAmount,
        amountPaid: price.grossAmount,
        amountDue: 0,
        periodStart: now,
        periodEnd: validTo,
        issuedAt: now,
        dueAt: now,
        paidAt: now,
        emailRecipient: user.email,
        emailProvider: 'development-mock',
        rawPayload: JSON.stringify({ sessionId, provider: 'mock' }),
      },
    });

    return {
      company,
      companyPlan,
      invoice,
    };
  });

  return NextResponse.json({
    success: true,
    source: 'development_mock',
    plan: 'business',
    internalPlan: 'starter',
    companyId: result.company.id,
    companyPlanId: result.companyPlan.id,
    invoiceId: result.invoice.id,
    validTo,
  });
}
