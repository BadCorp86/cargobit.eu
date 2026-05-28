import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withPartnerAuth, PARTNER_SCOPES } from '@/lib/partner-auth';
import {
  normalizeInsuranceReferralLeadStatus,
  updateInsuranceReferralLeadStatus,
} from '@/lib/insurance/referral';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ leadId: string }> | { leadId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await withPartnerAuth(request, [PARTNER_SCOPES.INSURANCE_READ]);

  if ('error' in authResult) {
    return authResult.error;
  }

  const { session } = authResult;
  const { leadId } = await params;
  const lead = await db.insuranceReferralLead.findFirst({
    where: {
      id: leadId,
      partnerId: session.partnerId,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          productCode: true,
        },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: 'Insurance lead not found' }, { status: 404 });
  }

  return NextResponse.json({
    mode: 'partner_lead',
    lead: formatPartnerLead(lead),
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return updateLeadFromPartner(request, params);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return updateLeadFromPartner(request, params);
}

async function updateLeadFromPartner(
  request: NextRequest,
  params: RouteParams['params']
) {
  const authResult = await withPartnerAuth(request, [PARTNER_SCOPES.INSURANCE_WRITE]);

  if ('error' in authResult) {
    return authResult.error;
  }

  const { session } = authResult;
  const { leadId } = await params;
  const body = await readBody(request);
  const status = normalizeInsuranceReferralLeadStatus(body.status || body.event || body.type);

  if (!status) {
    return NextResponse.json(
      { error: 'Valid status is required: LEAD_CREATED, REDIRECTED, CONVERTED, DECLINED, EXPIRED' },
      { status: 400 }
    );
  }

  const existingLead = await db.insuranceReferralLead.findFirst({
    where: {
      id: leadId,
      partnerId: session.partnerId,
    },
  });

  if (!existingLead) {
    return NextResponse.json({ error: 'Insurance lead not found' }, { status: 404 });
  }

  const externalReference =
    body.externalReference ||
    body.policyNumber ||
    body.contractNumber ||
    body.partnerReference ||
    null;

  const lead = await updateInsuranceReferralLeadStatus(leadId, {
    status,
    externalReference: typeof externalReference === 'string' ? externalReference.trim() : null,
    premiumEur: toOptionalNumber(body.premiumEur || body.premium || body.finalPremiumEur),
    commissionEur: toOptionalNumber(body.commissionEur || body.commission || body.partnerCommissionEur),
    convertedAt: body.convertedAt,
    actorType: 'PARTNER',
    actorId: session.partnerId,
    metadata: {
      apiKeyId: session.apiKeyId,
      apiKeyName: session.apiKeyName,
      source: 'partner_api',
    },
  });

  return NextResponse.json({
    ok: true,
    mode: 'partner_lead',
    lead: formatPartnerLead(lead),
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
    product: lead.product || null,
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

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function toOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
