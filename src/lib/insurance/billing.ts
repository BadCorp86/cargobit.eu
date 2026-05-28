import { prisma } from '@/lib/db';
import {
  recordInsuranceReferralLeadEvent,
  updateInsuranceReferralCommissionStatus,
} from '@/lib/insurance/referral';

const DEFAULT_VAT_RATE = 0.19;

type BillingLead = {
  id: string;
  partnerId: string;
  providerName: string;
  productName: string;
  status: string;
  commissionStatus: string;
  premiumEstimateEur: number;
  coverageEstimateEur: number;
  commissionEstimateEur: number;
  commissionInvoiceReference?: string | null;
  externalReference?: string | null;
  createdAt: Date;
  convertedAt?: Date | null;
  commissionSettledAt?: Date | null;
  partner: {
    id: string;
    name: string;
    contactEmail: string;
    commissionRate: number;
  };
};

export type InsuranceBillingStatus = 'OPEN' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface GenerateInsuranceBillingInput {
  month?: string | null;
  partnerId?: string | null;
  adminId: string;
  vatRate?: number;
  force?: boolean;
}

export interface UpdateInsuranceBillingInput {
  billingId: string;
  status: InsuranceBillingStatus;
  adminId: string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  invoiceUrl?: string | null;
  note?: string | null;
}

export function parseInsuranceBillingMonth(value?: string | null) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  return new Date().toISOString().slice(0, 7);
}

export function getInsuranceBillingMonthWindow(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0));
  const label = new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(start);

  return { year, monthNumber, start, end, label };
}

export async function generateInsurancePartnerBillings(input: GenerateInsuranceBillingInput) {
  const db = prisma as any;
  const month = parseInsuranceBillingMonth(input.month);
  const { year, monthNumber, start, end, label } = getInsuranceBillingMonthWindow(month);
  const vatRate = normalizeVatRate(input.vatRate);

  const where: Record<string, unknown> = {
    partnerId: {
      not: null,
    },
    commissionStatus: {
      in: ['EARNED', 'INVOICED'],
    },
    convertedAt: {
      gte: start,
      lt: end,
    },
  };

  if (input.partnerId && input.partnerId !== 'all') {
    where.partnerId = input.partnerId;
  }

  const leads = await db.insuranceReferralLead.findMany({
    where,
    include: {
      partner: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
          commissionRate: true,
        },
      },
    },
    orderBy: [{ convertedAt: 'asc' }, { createdAt: 'asc' }],
  });

  const groupedLeads = groupLeadsByPartner(leads.filter((lead: BillingLead) => lead.partner));
  const generated = [];
  const skipped = [];

  for (const [partnerId, partnerLeads] of groupedLeads.entries()) {
    const existingBillings = await db.partnerBilling.findMany({
      where: {
        partnerId,
        type: 'INSURANCE',
        periodMonth: monthNumber,
        periodYear: year,
      },
      orderBy: { createdAt: 'desc' },
    });
    const existingBilling = input.force
      ? existingBillings[0]
      : existingBillings.find((billing: any) => billing.status !== 'PAID' && billing.status !== 'CANCELLED');

    const partner = partnerLeads[0].partner;
    const invoiceNumber = existingBilling?.invoiceNumber
      || buildInsuranceInvoiceNumber(year, monthNumber, partnerId, existingBillings.length + 1);
    const grossAmountEur = roundMoney(partnerLeads.reduce((sum, lead) => sum + Number(lead.premiumEstimateEur || 0), 0));
    const commissionEur = roundMoney(partnerLeads.reduce((sum, lead) => sum + Number(lead.commissionEstimateEur || 0), 0));
    const vatEur = roundMoney(commissionEur * vatRate);
    const totalEur = roundMoney(commissionEur + vatEur);
    const netAmountEur = roundMoney(Math.max(0, grossAmountEur - commissionEur));
    const lineItems = partnerLeads.map((lead) => ({
      type: 'insurance_referral_commission',
      leadId: lead.id,
      providerName: lead.providerName,
      productName: lead.productName,
      externalReference: lead.externalReference,
      premiumEstimateEur: roundMoney(Number(lead.premiumEstimateEur || 0)),
      coverageEstimateEur: roundMoney(Number(lead.coverageEstimateEur || 0)),
      commissionEstimateEur: roundMoney(Number(lead.commissionEstimateEur || 0)),
      commissionRate: partner.commissionRate,
      commissionStatus: lead.commissionStatus,
      convertedAt: lead.convertedAt?.toISOString() || null,
    }));

    const billingData = {
      partnerId,
      invoiceNumber,
      type: 'INSURANCE',
      periodMonth: monthNumber,
      periodYear: year,
      grossAmountEur,
      commissionEur,
      netAmountEur,
      vatEur,
      totalEur,
      status: 'OPEN',
      dueDate: new Date(end.getTime() + 14 * 24 * 60 * 60 * 1000),
      lineItems: JSON.stringify(lineItems),
    };

    const billing = existingBilling
      ? await db.partnerBilling.update({
          where: { id: existingBilling.id },
          data: billingData,
        })
      : await db.partnerBilling.create({
          data: billingData,
        });

    for (const lead of partnerLeads) {
      if (lead.commissionStatus !== 'PAID') {
        await updateInsuranceReferralCommissionStatus(lead.id, {
          commissionStatus: 'INVOICED',
          invoiceReference: invoiceNumber,
          actorType: 'ADMIN',
          actorId: input.adminId,
          note: `Monatliche Versicherungsabrechnung ${label} erzeugt.`,
        });
      }
    }

    await db.adminAuditLog.create({
      data: {
        adminId: input.adminId,
        action: existingBilling ? 'INSURANCE_BILLING_REGENERATED' : 'INSURANCE_BILLING_CREATED',
        entityType: 'partner_billing',
        entityId: billing.id,
        dataBefore: existingBilling ? JSON.stringify(formatBilling(existingBilling)) : null,
        dataAfter: JSON.stringify({
          ...formatBilling(billing),
          period: label,
          leadCount: partnerLeads.length,
          vatRate,
        }),
      },
    });

    generated.push({
      ...formatBilling(billing),
      partner: {
        id: partner.id,
        name: partner.name,
        contactEmail: partner.contactEmail,
      },
      lineItems,
    });
  }

  return {
    period: {
      month,
      label,
      start: start.toISOString(),
      end: end.toISOString(),
    },
    generated,
    skipped,
    sourceLeadCount: leads.length,
  };
}

export async function listInsurancePartnerBillings(input: {
  month?: string | null;
  status?: string | null;
  partnerId?: string | null;
}) {
  const db = prisma as any;
  const month = parseInsuranceBillingMonth(input.month);
  const { year, monthNumber } = getInsuranceBillingMonthWindow(month);
  const where: Record<string, unknown> = {
    type: 'INSURANCE',
    periodMonth: monthNumber,
    periodYear: year,
  };

  if (input.status && input.status !== 'all') {
    where.status = input.status;
  }

  if (input.partnerId && input.partnerId !== 'all') {
    where.partnerId = input.partnerId;
  }

  const billings = await db.partnerBilling.findMany({
    where,
    include: {
      partner: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
          commissionRate: true,
        },
      },
    },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { createdAt: 'desc' }],
  });

  const formattedBillings = billings.map(formatBillingWithPartner);

  return {
    month,
    billings: formattedBillings,
    summary: {
      totalInvoices: formattedBillings.length,
      openInvoices: formattedBillings.filter((billing) => billing.status === 'OPEN').length,
      paidInvoices: formattedBillings.filter((billing) => billing.status === 'PAID').length,
      totalOpenAmount: roundMoney(
        formattedBillings
          .filter((billing) => billing.status === 'OPEN' || billing.status === 'OVERDUE')
          .reduce((sum, billing) => sum + billing.totalEur, 0)
      ),
      totalPaidAmount: roundMoney(
        formattedBillings
          .filter((billing) => billing.status === 'PAID')
          .reduce((sum, billing) => sum + billing.totalEur, 0)
      ),
    },
  };
}

export async function updateInsurancePartnerBilling(input: UpdateInsuranceBillingInput) {
  const db = prisma as any;
  const previousBilling = await db.partnerBilling.findUnique({
    where: { id: input.billingId },
    include: { partner: true },
  });

  if (!previousBilling || previousBilling.type !== 'INSURANCE') {
    return null;
  }

  const updateData: Record<string, unknown> = {
    status: input.status,
  };

  if (input.status === 'PAID') {
    updateData.paidAt = new Date();
    updateData.paymentMethod = input.paymentMethod || previousBilling.paymentMethod || 'bank_transfer';
    updateData.paymentReference = input.paymentReference || previousBilling.paymentReference || null;
  }

  if (input.status !== 'PAID') {
    updateData.paidAt = null;
  }

  if (typeof input.invoiceUrl === 'string') {
    updateData.invoiceUrl = input.invoiceUrl.trim() || null;
  }

  const billing = await db.partnerBilling.update({
    where: { id: input.billingId },
    data: updateData,
    include: {
      partner: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
          commissionRate: true,
        },
      },
    },
  });

  const lineItems = parseLineItems(billing.lineItems);
  const leadIds = lineItems
    .map((item) => (typeof item.leadId === 'string' ? item.leadId : null))
    .filter(Boolean) as string[];

  if (input.status === 'PAID') {
    for (const leadId of leadIds) {
      await updateInsuranceReferralCommissionStatus(leadId, {
        commissionStatus: 'PAID',
        invoiceReference: billing.invoiceNumber,
        actorType: 'ADMIN',
        actorId: input.adminId,
        note: input.note || 'Partnerabrechnung als bezahlt markiert.',
      });
    }
  }

  if (input.status === 'CANCELLED') {
    for (const leadId of leadIds) {
      await updateInsuranceReferralCommissionStatus(leadId, {
        commissionStatus: 'EARNED',
        invoiceReference: billing.invoiceNumber,
        actorType: 'ADMIN',
        actorId: input.adminId,
        note: input.note || 'Partnerabrechnung storniert.',
      });
      await recordInsuranceReferralLeadEvent({
        leadId,
        partnerId: billing.partnerId,
        actorType: 'ADMIN',
        actorId: input.adminId,
        eventType: 'commission_billing_cancelled',
        oldStatus: previousBilling.status,
        newStatus: input.status,
        externalReference: billing.invoiceNumber,
        metadata: {
          billingId: billing.id,
          invoiceNumber: billing.invoiceNumber,
        },
      });
    }
  }

  await db.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: 'INSURANCE_BILLING_STATUS_UPDATED',
      entityType: 'partner_billing',
      entityId: billing.id,
      dataBefore: JSON.stringify(formatBilling(previousBilling)),
      dataAfter: JSON.stringify({
        ...formatBilling(billing),
        note: input.note || null,
      }),
    },
  });

  return formatBillingWithPartner(billing);
}

function groupLeadsByPartner(leads: BillingLead[]) {
  const grouped = new Map<string, BillingLead[]>();

  leads.forEach((lead) => {
    if (!lead.partnerId) return;
    const group = grouped.get(lead.partnerId) || [];
    group.push(lead);
    grouped.set(lead.partnerId, group);
  });

  return grouped;
}

function buildInsuranceInvoiceNumber(year: number, month: number, partnerId: string, sequence = 1) {
  const suffix = sequence > 1 ? `-${sequence}` : '';
  return `CB-INS-${year}${String(month).padStart(2, '0')}-${partnerId.slice(-6).toUpperCase()}${suffix}`;
}

function formatBilling(billing: any) {
  return {
    id: billing.id,
    partnerId: billing.partnerId,
    invoiceNumber: billing.invoiceNumber,
    type: billing.type,
    periodMonth: billing.periodMonth,
    periodYear: billing.periodYear,
    grossAmountEur: roundMoney(Number(billing.grossAmountEur || 0)),
    commissionEur: roundMoney(Number(billing.commissionEur || 0)),
    netAmountEur: roundMoney(Number(billing.netAmountEur || 0)),
    vatEur: roundMoney(Number(billing.vatEur || 0)),
    totalEur: roundMoney(Number(billing.totalEur || 0)),
    status: billing.status,
    paidAt: billing.paidAt?.toISOString?.() || null,
    paymentMethod: billing.paymentMethod,
    paymentReference: billing.paymentReference,
    invoiceUrl: billing.invoiceUrl,
    dueDate: billing.dueDate?.toISOString?.() || null,
    createdAt: billing.createdAt?.toISOString?.() || null,
    updatedAt: billing.updatedAt?.toISOString?.() || null,
  };
}

function formatBillingWithPartner(billing: any) {
  return {
    ...formatBilling(billing),
    partner: billing.partner
      ? {
          id: billing.partner.id,
          name: billing.partner.name,
          contactEmail: billing.partner.contactEmail,
          commissionRate: billing.partner.commissionRate,
        }
      : null,
    lineItems: parseLineItems(billing.lineItems),
  };
}

function parseLineItems(value?: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeVatRate(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return DEFAULT_VAT_RATE;
  }

  return value > 1 ? value / 100 : value;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
