import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import { INSURANCE_REFERRAL_COMPLIANCE_NOTICE } from '@/lib/insurance/referral';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const db = prisma as any;

    try {
      const [partners, products, leads, policies] = await Promise.all([
        db.partner.findMany({
          where: { type: 'INSURANCE' },
          include: {
            insuranceProducts: true,
            apiKeys: {
              orderBy: { createdAt: 'desc' },
              take: 5,
              select: {
                id: true,
                name: true,
                apiKeyPrefix: true,
                scopes: true,
                status: true,
                isTestKey: true,
                lastUsedAt: true,
                expiresAt: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        db.insuranceProduct.findMany({
          where: { isActive: true },
          include: { partner: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        db.insuranceReferralLead.findMany({
          include: {
            events: {
              orderBy: { createdAt: 'desc' },
              take: 8,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        db.insurancePolicy.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

      const estimatedCommission = leads.reduce(
        (sum: number, lead: any) => sum + Number(lead.commissionEstimateEur || 0),
        0
      );
      const redirectedLeads = leads.filter((lead: any) => lead.status === 'REDIRECTED' || lead.redirectedAt).length;
      const convertedLeads = leads.filter((lead: any) => lead.status === 'CONVERTED' || lead.convertedAt).length;
      const openLeads = leads.filter((lead: any) => ['LEAD_CREATED', 'REDIRECTED'].includes(lead.status)).length;
      const earnedCommission = leads
        .filter((lead: any) => ['EARNED', 'INVOICED', 'PAID'].includes(lead.commissionStatus))
        .reduce((sum: number, lead: any) => sum + Number(lead.commissionEstimateEur || 0), 0);
      const pendingCommission = leads
        .filter((lead: any) => ['PENDING', 'EARNED'].includes(lead.commissionStatus))
        .reduce((sum: number, lead: any) => sum + Number(lead.commissionEstimateEur || 0), 0);
      const paidCommission = leads
        .filter((lead: any) => lead.commissionStatus === 'PAID')
        .reduce((sum: number, lead: any) => sum + Number(lead.commissionEstimateEur || 0), 0);

      return NextResponse.json({
        mode: 'partner_lead',
        complianceNotice: INSURANCE_REFERRAL_COMPLIANCE_NOTICE,
        stats: {
          partners: partners.length,
          activeProducts: products.length,
          leads: leads.length,
          openLeads,
          redirectedLeads,
          convertedLeads,
          estimatedCommissionEur: Math.round(estimatedCommission * 100) / 100,
          earnedCommissionEur: Math.round(earnedCommission * 100) / 100,
          pendingCommissionEur: Math.round(pendingCommission * 100) / 100,
          paidCommissionEur: Math.round(paidCommission * 100) / 100,
          policies: policies.length,
        },
        partners: partners.map((partner: any) => ({
          id: partner.id,
          name: partner.name,
          status: partner.status,
          website: partner.website,
          contactEmail: partner.contactEmail,
          contactPerson: partner.contactPerson,
          contactPhone: partner.contactPhone,
          country: partner.country,
          webhookUrl: partner.webhookUrl,
          testMode: partner.testMode,
          commissionRate: partner.commissionRate,
          liveModeEnabled: partner.liveModeEnabled,
          contractUrl: partner.contractUrl,
          complianceDocs: parseJsonArray(partner.complianceDocs),
          approvedAt: partner.approvedAt,
          apiKeys: partner.apiKeys.map((apiKey: any) => ({
            id: apiKey.id,
            name: apiKey.name,
            apiKeyPrefix: apiKey.apiKeyPrefix,
            scopes: parseJsonArray(apiKey.scopes),
            status: apiKey.status,
            isTestKey: apiKey.isTestKey,
            lastUsedAt: apiKey.lastUsedAt,
            expiresAt: apiKey.expiresAt,
            createdAt: apiKey.createdAt,
          })),
          products: partner.insuranceProducts.map((product: any) => ({
            id: product.id,
            name: product.name,
            coverageEur: product.coverageEur,
            deductibleEur: product.deductibleEur,
            basePremiumEur: product.basePremiumEur,
            premiumType: product.premiumType,
            coversDamage: product.coversDamage,
            coversTheft: product.coversTheft,
            coversDelay: product.coversDelay,
            coversHazmat: product.coversHazmat,
            isActive: product.isActive,
          })),
        })),
        products: products.map((product: any) => ({
          id: product.id,
          partnerId: product.partnerId,
          partnerName: product.partner?.name,
          name: product.name,
          description: product.description,
          coverageEur: product.coverageEur,
          deductibleEur: product.deductibleEur,
          basePremiumEur: product.basePremiumEur,
          premiumType: product.premiumType,
          coversDamage: product.coversDamage,
          coversTheft: product.coversTheft,
          coversDelay: product.coversDelay,
          coversHazmat: product.coversHazmat,
        })),
        leads: leads.map((lead: any) => ({
          id: lead.id,
          providerName: lead.providerName,
          productName: lead.productName,
          requestedByRole: lead.requestedByRole,
          source: lead.source,
          status: lead.status,
          transportId: lead.transportId,
          premiumEstimateEur: lead.premiumEstimateEur,
          coverageEstimateEur: lead.coverageEstimateEur,
          commissionEstimateEur: lead.commissionEstimateEur,
          commissionStatus: lead.commissionStatus,
          commissionInvoiceReference: lead.commissionInvoiceReference,
          commissionSettledAt: lead.commissionSettledAt,
          referralUrl: lead.referralUrl,
          externalReference: lead.externalReference,
          cargoValueEur: lead.cargoValueEur,
          validUntil: lead.validUntil,
          redirectedAt: lead.redirectedAt,
          convertedAt: lead.convertedAt,
          events: lead.events.map((event: any) => ({
            id: event.id,
            actorType: event.actorType,
            actorId: event.actorId,
            eventType: event.eventType,
            oldStatus: event.oldStatus,
            newStatus: event.newStatus,
            externalReference: event.externalReference,
            premiumEur: event.premiumEur,
            commissionEur: event.commissionEur,
            metadata: parseJsonObject(event.metadata),
            createdAt: event.createdAt,
          })),
          createdAt: lead.createdAt,
        })),
        policies,
      });
    } catch (error) {
      console.error('[AdminInsurance] GET error:', error);
      return NextResponse.json({
        mode: 'partner_lead',
        complianceNotice: INSURANCE_REFERRAL_COMPLIANCE_NOTICE,
        stats: {
          partners: 1,
          activeProducts: 1,
          leads: 0,
          openLeads: 0,
          redirectedLeads: 0,
          convertedLeads: 0,
          estimatedCommissionEur: 0,
          earnedCommissionEur: 0,
          pendingCommissionEur: 0,
          paidCommissionEur: 0,
          policies: 0,
        },
        partners: [
          {
            id: 'fallback_allianz',
            name: 'Allianz Partner Lead',
            status: 'ACTIVE',
            website: 'https://www.allianz.de/business/transportversicherung/',
            contactEmail: 'partner@example.com',
            contactPerson: null,
            contactPhone: null,
            country: 'DE',
            webhookUrl: null,
            testMode: true,
            commissionRate: 12,
            liveModeEnabled: false,
            contractUrl: null,
            complianceDocs: [],
            approvedAt: null,
            apiKeys: [],
            products: [
              {
                id: 'fallback_cargo',
                name: 'Cargo Damage Protection',
                coverageEur: 100000,
                deductibleEur: 0,
                basePremiumEur: 24.9,
                premiumType: 'percentage',
                coversDamage: true,
                coversTheft: true,
                coversDelay: false,
                coversHazmat: false,
                isActive: true,
              },
            ],
          },
        ],
        products: [],
        leads: [],
        policies: [],
      });
    }
  }, [AdminRole.ADMIN, AdminRole.FINANCE]);
}

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (admin) => {
    const db = prisma as any;
    const body = await request.json();

    if (!body.providerName || !body.contactEmail || !body.productName) {
      return NextResponse.json(
        { error: 'providerName, contactEmail and productName are required' },
        { status: 400 }
      );
    }

    const partner = await db.partner.create({
      data: {
        name: String(body.providerName),
        type: 'INSURANCE',
        contactEmail: String(body.contactEmail),
        contactPerson: body.contactPerson ? String(body.contactPerson) : null,
        website: body.website ? String(body.website) : null,
        webhookUrl: body.webhookUrl ? String(body.webhookUrl) : null,
        contractUrl: body.contractUrl ? String(body.contractUrl) : null,
        complianceDocs: body.complianceDocs ? JSON.stringify(toStringArray(body.complianceDocs)) : null,
        country: body.country || 'DE',
        status: 'ACTIVE',
        approvedAt: new Date(),
        approvedBy: admin.id,
        commissionRate: Number(body.commissionRate || 12),
        testMode: true,
        liveModeEnabled: Boolean(body.liveModeEnabled),
      },
    });

    const product = await db.insuranceProduct.create({
      data: {
        partnerId: partner.id,
        name: String(body.productName),
        description: body.description || 'Transportversicherung als externer Partner-Lead.',
        productCode: body.productCode || 'CARGO-LEAD',
        coverageEur: Number(body.coverageEur || 100000),
        deductibleEur: Number(body.deductibleEur || 0),
        basePremiumEur: Number(body.basePremiumEur || 24.9),
        premiumType: body.premiumType || 'percentage',
        coversTheft: body.coversTheft ?? true,
        coversDamage: body.coversDamage ?? true,
        coversDelay: body.coversDelay ?? false,
        coversHazmat: body.coversHazmat ?? false,
        additionalOptions: JSON.stringify({
          referralOnly: true,
          complianceNotice: INSURANCE_REFERRAL_COMPLIANCE_NOTICE,
        }),
      },
    });

    return NextResponse.json({ partner, product }, { status: 201 });
  }, [AdminRole.ADMIN]);
}

function parseJsonArray(value?: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value?: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}
