import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withPartnerAuth, PARTNER_SCOPES } from '@/lib/partner-auth';
import { normalizeInsuranceReferralLeadStatus } from '@/lib/insurance/referral';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authResult = await withPartnerAuth(request, [PARTNER_SCOPES.INSURANCE_READ]);

  if ('error' in authResult) {
    return authResult.error;
  }

  const { session } = authResult;
  const { searchParams } = new URL(request.url);
  const status = normalizeInsuranceReferralLeadStatus(searchParams.get('status'));
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '50')));
  const from = parseDate(searchParams.get('from'));
  const to = parseDate(searchParams.get('to'));

  const where: Record<string, unknown> = {
    partnerId: session.partnerId,
  };

  if (status) {
    where.status = status;
  }

  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const [leads, total] = await Promise.all([
    db.insuranceReferralLead.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            productCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.insuranceReferralLead.count({ where }),
  ]);

  return NextResponse.json({
    mode: 'partner_lead',
    partner: {
      id: session.partnerId,
      name: session.partnerName,
      type: session.partnerType,
      isTestMode: session.isTestMode,
    },
    leads: leads.map(formatPartnerLead),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

function formatPartnerLead(lead: any) {
  return {
    id: lead.id,
    transportId: lead.transportId,
    requestedByRole: lead.requestedByRole,
    source: lead.source,
    status: lead.status,
    providerName: lead.providerName,
    productName: lead.productName,
    product: lead.product,
    externalReference: lead.externalReference,
    cargo: {
      description: lead.cargoDescription,
      valueEur: lead.cargoValueEur,
      weightKg: lead.weightKg,
    },
    route: {
      pickupCity: lead.pickupCity,
      pickupCountry: lead.pickupCountry,
      deliveryCity: lead.deliveryCity,
      deliveryCountry: lead.deliveryCountry,
    },
    quote: {
      premiumEstimateEur: lead.premiumEstimateEur,
      coverageEstimateEur: lead.coverageEstimateEur,
      deductibleEur: lead.deductibleEur,
      currency: lead.currency,
      commissionType: lead.commissionType,
      commissionRate: lead.commissionRate,
      commissionEstimateEur: lead.commissionEstimateEur,
      commissionStatus: lead.commissionStatus,
      commissionInvoiceReference: lead.commissionInvoiceReference,
      commissionSettledAt: lead.commissionSettledAt,
    },
    referralUrl: lead.referralUrl,
    complianceNotice: lead.complianceNotice,
    validUntil: lead.validUntil,
    redirectedAt: lead.redirectedAt,
    convertedAt: lead.convertedAt,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
