import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';

export const dynamic = 'force-dynamic';

type InsuranceCommissionLead = {
  id: string;
  partnerId?: string | null;
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
  partner?: {
    id: string;
    name: string;
    contactEmail: string;
    commissionRate: number;
  } | null;
};

type PartnerSummary = {
  partnerId: string;
  partnerName: string;
  contactEmail?: string | null;
  commissionRate?: number | null;
  leadCount: number;
  convertedCount: number;
  invoicedCount: number;
  paidCount: number;
  grossPremiumEur: number;
  commissionEur: number;
  openCommissionEur: number;
  paidCommissionEur: number;
};

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const month = parseReportMonth(searchParams.get('month'));
    const partnerId = searchParams.get('partnerId') || 'all';
    const format = searchParams.get('format') || 'json';
    const { start, end, label } = getMonthWindow(month);
    const db = prisma as any;

    const where: Record<string, unknown> = {
      commissionStatus: {
        in: ['EARNED', 'INVOICED', 'PAID'],
      },
      OR: [
        {
          convertedAt: {
            gte: start,
            lt: end,
          },
        },
        {
          commissionSettledAt: {
            gte: start,
            lt: end,
          },
        },
      ],
    };

    if (partnerId !== 'all') {
      where.partnerId = partnerId;
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
      orderBy: [
        { convertedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const normalizedLeads = leads.map(normalizeLead);
    const partnerSummaries = buildPartnerSummaries(normalizedLeads);
    const totals = partnerSummaries.reduce(
      (sum, partner) => ({
        leadCount: sum.leadCount + partner.leadCount,
        convertedCount: sum.convertedCount + partner.convertedCount,
        invoicedCount: sum.invoicedCount + partner.invoicedCount,
        paidCount: sum.paidCount + partner.paidCount,
        grossPremiumEur: roundMoney(sum.grossPremiumEur + partner.grossPremiumEur),
        commissionEur: roundMoney(sum.commissionEur + partner.commissionEur),
        openCommissionEur: roundMoney(sum.openCommissionEur + partner.openCommissionEur),
        paidCommissionEur: roundMoney(sum.paidCommissionEur + partner.paidCommissionEur),
      }),
      {
        leadCount: 0,
        convertedCount: 0,
        invoicedCount: 0,
        paidCount: 0,
        grossPremiumEur: 0,
        commissionEur: 0,
        openCommissionEur: 0,
        paidCommissionEur: 0,
      }
    );

    const payload = {
      period: {
        month,
        label,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totals,
      partners: partnerSummaries,
      leads: normalizedLeads.map((lead) => ({
        id: lead.id,
        partnerId: lead.partnerId,
        partnerName: lead.partner?.name || lead.providerName,
        providerName: lead.providerName,
        productName: lead.productName,
        status: lead.status,
        commissionStatus: lead.commissionStatus,
        premiumEstimateEur: lead.premiumEstimateEur,
        coverageEstimateEur: lead.coverageEstimateEur,
        commissionEstimateEur: lead.commissionEstimateEur,
        commissionInvoiceReference: lead.commissionInvoiceReference,
        externalReference: lead.externalReference,
        createdAt: lead.createdAt.toISOString(),
        convertedAt: lead.convertedAt?.toISOString() || null,
        commissionSettledAt: lead.commissionSettledAt?.toISOString() || null,
      })),
    };

    if (format === 'csv') {
      const csv = buildCsv(normalizedLeads, label);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="cargobit-insurance-commission-${month}.csv"`,
        },
      });
    }

    return NextResponse.json(payload);
  }, [AdminRole.ADMIN, AdminRole.FINANCE]);
}

function parseReportMonth(value?: string | null) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  return new Date().toISOString().slice(0, 7);
}

function getMonthWindow(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0));
  const label = new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(start);

  return { start, end, label };
}

function normalizeLead(lead: InsuranceCommissionLead): InsuranceCommissionLead {
  return {
    ...lead,
    premiumEstimateEur: roundMoney(Number(lead.premiumEstimateEur || 0)),
    coverageEstimateEur: roundMoney(Number(lead.coverageEstimateEur || 0)),
    commissionEstimateEur: roundMoney(Number(lead.commissionEstimateEur || 0)),
  };
}

function buildPartnerSummaries(leads: InsuranceCommissionLead[]) {
  const summaries = new Map<string, PartnerSummary>();

  leads.forEach((lead) => {
    const partnerKey = lead.partnerId || `provider:${lead.providerName}`;
    const current = summaries.get(partnerKey) || {
      partnerId: lead.partnerId || 'external',
      partnerName: lead.partner?.name || lead.providerName,
      contactEmail: lead.partner?.contactEmail || null,
      commissionRate: lead.partner?.commissionRate || null,
      leadCount: 0,
      convertedCount: 0,
      invoicedCount: 0,
      paidCount: 0,
      grossPremiumEur: 0,
      commissionEur: 0,
      openCommissionEur: 0,
      paidCommissionEur: 0,
    };

    current.leadCount += 1;
    current.convertedCount += lead.status === 'CONVERTED' ? 1 : 0;
    current.invoicedCount += lead.commissionStatus === 'INVOICED' ? 1 : 0;
    current.paidCount += lead.commissionStatus === 'PAID' ? 1 : 0;
    current.grossPremiumEur = roundMoney(current.grossPremiumEur + lead.premiumEstimateEur);
    current.commissionEur = roundMoney(current.commissionEur + lead.commissionEstimateEur);

    if (lead.commissionStatus === 'PAID') {
      current.paidCommissionEur = roundMoney(current.paidCommissionEur + lead.commissionEstimateEur);
    } else {
      current.openCommissionEur = roundMoney(current.openCommissionEur + lead.commissionEstimateEur);
    }

    summaries.set(partnerKey, current);
  });

  return Array.from(summaries.values()).sort((left, right) => right.commissionEur - left.commissionEur);
}

function buildCsv(leads: ReturnType<typeof normalizeLead>[], periodLabel: string) {
  const columns = [
    'period',
    'partnerName',
    'leadId',
    'status',
    'commissionStatus',
    'createdAt',
    'convertedAt',
    'commissionSettledAt',
    'premiumEstimateEur',
    'commissionEstimateEur',
    'externalReference',
    'invoiceReference',
  ];

  const rows = leads.map((lead) => [
    periodLabel,
    lead.partner?.name || lead.providerName,
    lead.id,
    lead.status,
    lead.commissionStatus,
    lead.createdAt.toISOString(),
    lead.convertedAt?.toISOString() || '',
    lead.commissionSettledAt?.toISOString() || '',
    lead.premiumEstimateEur.toFixed(2),
    lead.commissionEstimateEur.toFixed(2),
    lead.externalReference || '',
    lead.commissionInvoiceReference || '',
  ]);

  return [
    columns.join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');
}

function escapeCsv(value: string | number) {
  const text = String(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
