import { prisma } from '@/lib/db';

export type InsuranceReferralRole = 'SHIPPER' | 'CARRIER' | 'ADMIN';
export type InsuranceReferralSource = 'SHIPPER_CREATE' | 'CARRIER_ACCEPTANCE' | 'ADMIN';
export type InsuranceReferralLeadStatus = 'LEAD_CREATED' | 'REDIRECTED' | 'CONVERTED' | 'DECLINED' | 'EXPIRED';
export type InsuranceReferralActorType = 'SYSTEM' | 'ADMIN' | 'PARTNER' | 'WEBHOOK';
export type InsuranceReferralCommissionStatus = 'PENDING' | 'EARNED' | 'INVOICED' | 'PAID' | 'VOID';

export const INSURANCE_REFERRAL_LEAD_STATUSES: InsuranceReferralLeadStatus[] = [
  'LEAD_CREATED',
  'REDIRECTED',
  'CONVERTED',
  'DECLINED',
  'EXPIRED',
];

export interface InsuranceReferralQuoteInput {
  transportId?: string | null;
  requestedByUserId?: string | null;
  requestedByRole?: InsuranceReferralRole;
  source?: InsuranceReferralSource;
  cargoDescription?: string | null;
  cargoValueEur?: number | null;
  weightKg?: number | null;
  pickupCity?: string | null;
  pickupCountry?: string | null;
  deliveryCity?: string | null;
  deliveryCountry?: string | null;
  consentAccepted?: boolean;
  persistLead?: boolean;
  markRedirected?: boolean;
}

interface InsuranceReferralEventInput {
  leadId: string;
  partnerId?: string | null;
  actorType?: InsuranceReferralActorType;
  actorId?: string | null;
  eventType: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  externalReference?: string | null;
  premiumEur?: number | null;
  commissionEur?: number | null;
  metadata?: Record<string, unknown> | null;
}

const COMPLIANCE_NOTICE =
  'CargoBit agiert in dieser Version nur als technischer Tippgeber/Partner-Lead. Beratung, Risikoannahme, Vertragsschluss, Police und Schadenbearbeitung erfolgen ausschliesslich beim lizenzierten Versicherer oder Makler.';

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildReferralUrl(providerWebsite?: string | null, leadId?: string) {
  const fallbackUrl = 'https://www.allianz.de/business/transportversicherung/';
  const website = providerWebsite || fallbackUrl;
  const baseUrl = /^https?:\/\//i.test(website) ? website : fallbackUrl;
  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', 'cargobit');
  url.searchParams.set('utm_medium', 'partner_lead');
  if (leadId) url.searchParams.set('lead_id', leadId);
  return url.toString();
}

export function normalizeInsuranceReferralLeadStatus(value?: string | null): InsuranceReferralLeadStatus | null {
  const normalized = String(value || '').trim().toUpperCase();
  const eventAlias = normalized
    .replace(/^INSURANCE[_:.]/, '')
    .replace(/^LEAD[_:.]/, '')
    .replace(/[^A-Z]/g, '_');

  if (INSURANCE_REFERRAL_LEAD_STATUSES.includes(normalized as InsuranceReferralLeadStatus)) {
    return normalized as InsuranceReferralLeadStatus;
  }

  if (eventAlias.includes('CONVERT')) return 'CONVERTED';
  if (eventAlias.includes('DECLIN') || eventAlias.includes('REJECT')) return 'DECLINED';
  if (eventAlias.includes('EXPIRE')) return 'EXPIRED';
  if (eventAlias.includes('REDIRECT') || eventAlias.includes('CLICK')) return 'REDIRECTED';
  if (eventAlias.includes('CREAT')) return 'LEAD_CREATED';

  return null;
}

export function normalizeInsuranceReferralCommissionStatus(value?: string | null): InsuranceReferralCommissionStatus | null {
  const normalized = String(value || '').trim().toUpperCase();

  if (['PENDING', 'EARNED', 'INVOICED', 'PAID', 'VOID'].includes(normalized)) {
    return normalized as InsuranceReferralCommissionStatus;
  }

  if (normalized.includes('SETTLED') || normalized.includes('PAID')) return 'PAID';
  if (normalized.includes('INVOICE')) return 'INVOICED';
  if (normalized.includes('EARN')) return 'EARNED';
  if (normalized.includes('VOID') || normalized.includes('CANCEL')) return 'VOID';
  if (normalized.includes('PEND')) return 'PENDING';

  return null;
}

function getCommissionStatusForLeadStatus(status: InsuranceReferralLeadStatus, fallback?: string | null) {
  if (status === 'CONVERTED') return 'EARNED';
  if (status === 'DECLINED' || status === 'EXPIRED') return 'VOID';
  return fallback || 'PENDING';
}

function getLeadEventType(status: InsuranceReferralLeadStatus) {
  return `lead_${status.toLowerCase()}`;
}

export async function recordInsuranceReferralLeadEvent(input: InsuranceReferralEventInput) {
  const db = prisma as any;

  return db.insuranceReferralEvent.create({
    data: {
      leadId: input.leadId,
      partnerId: input.partnerId || null,
      actorType: input.actorType || 'SYSTEM',
      actorId: input.actorId || null,
      eventType: input.eventType,
      oldStatus: input.oldStatus || null,
      newStatus: input.newStatus || null,
      externalReference: input.externalReference || null,
      premiumEur: typeof input.premiumEur === 'number' ? input.premiumEur : null,
      commissionEur: typeof input.commissionEur === 'number' ? input.commissionEur : null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

async function getPreferredInsuranceProduct() {
  const db = prisma as any;

  try {
    const product = await db.insuranceProduct.findFirst({
      where: {
        isActive: true,
        partner: {
          type: 'INSURANCE',
          status: 'ACTIVE',
        },
      },
      include: { partner: true },
      orderBy: { coverageEur: 'asc' },
    });

    if (product) return product;
  } catch (error) {
    console.warn('[InsuranceReferral] Falling back to static provider:', error);
  }

  return {
    id: null,
    partnerId: null,
    name: 'Cargo Transport Lead',
    description: 'Warentransportversicherung ueber lizenzierten Partner',
    coverageEur: 100_000,
    deductibleEur: 0,
    basePremiumEur: 24.9,
    premiumType: 'percentage',
    coversTheft: true,
    coversDamage: true,
    coversDelay: false,
    coversHazmat: false,
    partner: {
      id: null,
      name: 'Allianz Partner Lead',
      website: 'https://www.allianz.de/business/transportversicherung/',
      commissionRate: 12,
    },
  };
}

export async function createInsuranceReferralQuote(input: InsuranceReferralQuoteInput) {
  const product = await getPreferredInsuranceProduct();
  const cargoValueEur = safeNumber(input.cargoValueEur, 10_000);
  const weightKg = safeNumber(input.weightKg, 500);
  const isInternational = Boolean(
    input.pickupCountry &&
    input.deliveryCountry &&
    input.pickupCountry.toLowerCase() !== input.deliveryCountry.toLowerCase()
  );
  const riskMultiplier =
    1 +
    (cargoValueEur > 50_000 ? 0.18 : 0) +
    (cargoValueEur > 100_000 ? 0.12 : 0) +
    (weightKg > 5_000 ? 0.08 : 0) +
    (isInternational ? 0.15 : 0);
  const basePremium =
    product.premiumType === 'fixed'
      ? safeNumber(product.basePremiumEur, 24.9)
      : Math.max(safeNumber(product.basePremiumEur, 24.9), cargoValueEur * 0.006);
  const premiumEstimateEur = roundMoney(Math.max(12.9, basePremium * riskMultiplier));
  const coverageEstimateEur = roundMoney(Math.min(Math.max(cargoValueEur, 10_000), safeNumber(product.coverageEur, 100_000)));
  const commissionRate = safeNumber(product.partner?.commissionRate, 12);
  const commissionEstimateEur = roundMoney(premiumEstimateEur * (commissionRate / 100));
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const initialReferralUrl = buildReferralUrl(product.partner?.website);

  let lead: any = null;
  if (input.persistLead) {
    const db = prisma as any;
    lead = await db.insuranceReferralLead.create({
      data: {
        partnerId: product.partnerId || null,
        productId: product.id || null,
        transportId: input.transportId || null,
        requestedByUserId: input.requestedByUserId || null,
        requestedByRole: input.requestedByRole || 'SHIPPER',
        source: input.source || 'SHIPPER_CREATE',
        status: input.markRedirected ? 'REDIRECTED' : 'LEAD_CREATED',
        providerName: product.partner?.name || 'Allianz Partner Lead',
        productName: product.name,
        referralUrl: initialReferralUrl,
        cargoDescription: input.cargoDescription || null,
        cargoValueEur,
        weightKg,
        pickupCity: input.pickupCity || null,
        pickupCountry: input.pickupCountry || null,
        deliveryCity: input.deliveryCity || null,
        deliveryCountry: input.deliveryCountry || null,
        premiumEstimateEur,
        coverageEstimateEur,
        deductibleEur: safeNumber(product.deductibleEur, 0),
        commissionRate,
        commissionEstimateEur,
        consentAccepted: Boolean(input.consentAccepted),
        complianceNotice: COMPLIANCE_NOTICE,
        validUntil,
        redirectedAt: input.markRedirected ? new Date() : null,
      },
    });

    const referralUrl = buildReferralUrl(product.partner?.website, lead.id);
    lead = await db.insuranceReferralLead.update({
      where: { id: lead.id },
      data: { referralUrl },
    });

    await recordInsuranceReferralLeadEvent({
      leadId: lead.id,
      partnerId: lead.partnerId,
      actorType: 'SYSTEM',
      eventType: 'lead_created',
      newStatus: 'LEAD_CREATED',
      premiumEur: premiumEstimateEur,
      commissionEur: commissionEstimateEur,
      metadata: {
        source: input.source || 'SHIPPER_CREATE',
        requestedByRole: input.requestedByRole || 'SHIPPER',
        referralUrl,
      },
    });

    if (input.markRedirected) {
      await recordInsuranceReferralLeadEvent({
        leadId: lead.id,
        partnerId: lead.partnerId,
        actorType: 'SYSTEM',
        eventType: 'lead_redirected',
        oldStatus: 'LEAD_CREATED',
        newStatus: 'REDIRECTED',
        premiumEur: premiumEstimateEur,
        commissionEur: commissionEstimateEur,
        metadata: {
          referralUrl,
        },
      });
    }
  }

  return {
    mode: 'partner_lead',
    leadId: lead?.id || null,
    provider: lead?.providerName || product.partner?.name || 'Allianz Partner Lead',
    product: lead?.productName || product.name,
    premiumEstimateEur,
    coverageEstimateEur,
    deductibleEur: safeNumber(product.deductibleEur, 0),
    currency: 'EUR',
    commission: {
      type: 'PERCENT',
      rate: commissionRate,
      estimateEur: commissionEstimateEur,
    },
    referralUrl: lead?.referralUrl || initialReferralUrl,
    validUntil: validUntil.toISOString(),
    consentAccepted: Boolean(input.consentAccepted),
    complianceNotice: COMPLIANCE_NOTICE,
    riskFactors: {
      cargoValueEur,
      weightKg,
      isInternational,
      riskMultiplier: roundMoney(riskMultiplier),
    },
  };
}

export async function updateInsuranceReferralLeadStatus(
  leadId: string,
  input: {
    status: InsuranceReferralLeadStatus;
    externalReference?: string | null;
    premiumEur?: number | null;
    commissionEur?: number | null;
    convertedAt?: string | Date | null;
    actorType?: InsuranceReferralActorType;
    actorId?: string | null;
    eventType?: string | null;
    metadata?: Record<string, unknown> | null;
  }
) {
  const db = prisma as any;
  const lead = await db.insuranceReferralLead.findUnique({
    where: { id: leadId },
  });

  if (!lead) return null;

  const data: Record<string, unknown> = {
    status: input.status,
    commissionStatus: getCommissionStatusForLeadStatus(input.status, lead.commissionStatus),
  };

  if (input.status === 'REDIRECTED' && !lead.redirectedAt) {
    data.redirectedAt = new Date();
  }

  if (input.status === 'CONVERTED') {
    data.convertedAt = input.convertedAt ? new Date(input.convertedAt) : lead.convertedAt || new Date();
  }

  if (input.externalReference) {
    data.externalReference = input.externalReference;
  }

  if (typeof input.premiumEur === 'number' && Number.isFinite(input.premiumEur) && input.premiumEur > 0) {
    data.premiumEstimateEur = Math.round(input.premiumEur * 100) / 100;
  }

  if (typeof input.commissionEur === 'number' && Number.isFinite(input.commissionEur) && input.commissionEur >= 0) {
    data.commissionEstimateEur = Math.round(input.commissionEur * 100) / 100;
  }

  const updatedLead = await db.insuranceReferralLead.update({
    where: { id: leadId },
    data,
  });

  await recordInsuranceReferralLeadEvent({
    leadId,
    partnerId: lead.partnerId,
    actorType: input.actorType || 'SYSTEM',
    actorId: input.actorId || null,
    eventType: input.eventType || getLeadEventType(input.status),
    oldStatus: lead.status,
    newStatus: input.status,
    externalReference: updatedLead.externalReference,
    premiumEur: updatedLead.premiumEstimateEur,
    commissionEur: updatedLead.commissionEstimateEur,
    metadata: input.metadata || null,
  });

  return updatedLead;
}

export async function updateInsuranceReferralCommissionStatus(
  leadId: string,
  input: {
    commissionStatus: InsuranceReferralCommissionStatus;
    invoiceReference?: string | null;
    actorType?: InsuranceReferralActorType;
    actorId?: string | null;
    note?: string | null;
  }
) {
  const db = prisma as any;
  const lead = await db.insuranceReferralLead.findUnique({
    where: { id: leadId },
  });

  if (!lead) return null;

  const updatedLead = await db.insuranceReferralLead.update({
    where: { id: leadId },
    data: {
      commissionStatus: input.commissionStatus,
      commissionInvoiceReference: input.invoiceReference || lead.commissionInvoiceReference,
      commissionSettledAt: input.commissionStatus === 'PAID' ? new Date() : lead.commissionSettledAt,
    },
  });

  await recordInsuranceReferralLeadEvent({
    leadId,
    partnerId: lead.partnerId,
    actorType: input.actorType || 'ADMIN',
    actorId: input.actorId || null,
    eventType: `commission_${input.commissionStatus.toLowerCase()}`,
    oldStatus: lead.commissionStatus,
    newStatus: input.commissionStatus,
    externalReference: updatedLead.commissionInvoiceReference,
    premiumEur: updatedLead.premiumEstimateEur,
    commissionEur: updatedLead.commissionEstimateEur,
    metadata: {
      invoiceReference: updatedLead.commissionInvoiceReference,
      note: input.note || null,
    },
  });

  return updatedLead;
}

export { COMPLIANCE_NOTICE as INSURANCE_REFERRAL_COMPLIANCE_NOTICE };
