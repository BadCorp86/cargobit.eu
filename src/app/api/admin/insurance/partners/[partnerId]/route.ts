import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import { INSURANCE_REFERRAL_COMPLIANCE_NOTICE } from '@/lib/insurance/referral';

export const dynamic = 'force-dynamic';

const PARTNER_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> | { partnerId: string } }
) {
  return withAdminAuth(request, async (admin) => {
    const { partnerId } = await params;
    const body = await readBody(request);
    const db = prisma as any;

    const existingPartner = await db.partner.findFirst({
      where: {
        id: partnerId,
        type: 'INSURANCE',
      },
      include: {
        insuranceProducts: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!existingPartner) {
      return NextResponse.json({ error: 'Insurance partner not found' }, { status: 404 });
    }

    const nextStatus = normalizeStatus(body.status) || existingPartner.status;
    const liveModeEnabled = typeof body.liveModeEnabled === 'boolean'
      ? body.liveModeEnabled
      : existingPartner.liveModeEnabled;
    const commissionRate = toOptionalPositiveNumber(body.commissionRate) ?? existingPartner.commissionRate;
    const complianceDocs = body.complianceDocs === undefined
      ? existingPartner.complianceDocs
      : JSON.stringify(toStringArray(body.complianceDocs));

    const updated = await db.$transaction(async (tx: any) => {
      const partner = await tx.partner.update({
        where: { id: partnerId },
        data: {
          name: stringOrFallback(body.providerName || body.name, existingPartner.name),
          contactEmail: stringOrFallback(body.contactEmail, existingPartner.contactEmail),
          contactPerson: stringOrNull(body.contactPerson),
          contactPhone: stringOrNull(body.contactPhone),
          website: stringOrNull(body.website),
          webhookUrl: stringOrNull(body.webhookUrl),
          contractUrl: stringOrNull(body.contractUrl),
          complianceDocs,
          country: stringOrFallback(body.country, existingPartner.country || 'DE'),
          status: nextStatus,
          statusReason: stringOrNull(body.statusReason),
          commissionRate,
          liveModeEnabled,
          testMode: !liveModeEnabled,
          approvedAt: nextStatus === 'ACTIVE' ? existingPartner.approvedAt || new Date() : existingPartner.approvedAt,
          approvedBy: nextStatus === 'ACTIVE' ? existingPartner.approvedBy || admin.id : existingPartner.approvedBy,
        },
      });

      const firstProduct = existingPartner.insuranceProducts[0];
      const productInput = body.product || {};
      const productPayload = {
        name: stringOrFallback(productInput.name || body.productName, firstProduct?.name || 'Cargo Damage Protection'),
        description: stringOrNull(productInput.description || body.description) || 'Transportversicherung als externer Partner-Lead.',
        productCode: stringOrNull(productInput.productCode || body.productCode) || 'CARGO-LEAD',
        coverageEur: toOptionalPositiveNumber(productInput.coverageEur ?? body.coverageEur) ?? firstProduct?.coverageEur ?? 100000,
        deductibleEur: toOptionalNonNegativeNumber(productInput.deductibleEur ?? body.deductibleEur) ?? firstProduct?.deductibleEur ?? 0,
        basePremiumEur: toOptionalPositiveNumber(productInput.basePremiumEur ?? body.basePremiumEur) ?? firstProduct?.basePremiumEur ?? 24.9,
        premiumType: stringOrFallback(productInput.premiumType || body.premiumType, firstProduct?.premiumType || 'percentage'),
        coversDamage: toOptionalBoolean(productInput.coversDamage ?? body.coversDamage) ?? firstProduct?.coversDamage ?? true,
        coversTheft: toOptionalBoolean(productInput.coversTheft ?? body.coversTheft) ?? firstProduct?.coversTheft ?? true,
        coversDelay: toOptionalBoolean(productInput.coversDelay ?? body.coversDelay) ?? firstProduct?.coversDelay ?? false,
        coversHazmat: toOptionalBoolean(productInput.coversHazmat ?? body.coversHazmat) ?? firstProduct?.coversHazmat ?? false,
        isActive: toOptionalBoolean(productInput.isActive ?? body.productActive) ?? firstProduct?.isActive ?? true,
        additionalOptions: JSON.stringify({
          referralOnly: true,
          complianceNotice: INSURANCE_REFERRAL_COMPLIANCE_NOTICE,
        }),
      };

      const product = firstProduct
        ? await tx.insuranceProduct.update({
            where: { id: firstProduct.id },
            data: productPayload,
          })
        : await tx.insuranceProduct.create({
            data: {
              partnerId,
              ...productPayload,
            },
          });

      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'INSURANCE_PARTNER_UPDATED',
          entityType: 'insurance_partner',
          entityId: partnerId,
          dataBefore: JSON.stringify({
            partner: existingPartner,
            product: firstProduct || null,
          }),
          dataAfter: JSON.stringify({
            partner,
            product,
            note: stringOrNull(body.note),
          }),
        },
      });

      return { partner, product };
    });

    return NextResponse.json({ ok: true, ...updated });
  }, [AdminRole.ADMIN]);
}

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function normalizeStatus(value: unknown) {
  const status = String(value || '').trim().toUpperCase();
  return PARTNER_STATUSES.includes(status as any) ? status : null;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function toOptionalBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return null;
}

function toOptionalPositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toOptionalNonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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
