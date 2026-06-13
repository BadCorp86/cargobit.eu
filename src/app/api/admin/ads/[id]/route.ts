import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-rbac';
import { AdminRole } from '@/services/admin-auth.service';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function statusForAction(action: string) {
  if (action === 'approve' || action === 'activate') return 'ACTIVE';
  if (action === 'pause' || action === 'reject') return 'PAUSED';
  if (action === 'pending') return 'PENDING';
  if (action === 'complete') return 'COMPLETED';
  return null;
}

function formatCampaign(campaign: any) {
  return {
    id: campaign.id,
    name: campaign.name,
    slot: campaign.slot,
    targetUrl: campaign.targetUrl,
    budgetEur: campaign.budgetEur,
    spentEur: campaign.spentEur,
    pricingModel: campaign.pricingModel,
    cpcEur: campaign.cpcEur,
    status: campaign.status,
    totalImpressions: campaign.totalImpressions,
    totalClicks: campaign.totalClicks,
    updatedAt: campaign.updatedAt,
    partner: campaign.partner
      ? {
          id: campaign.partner.id,
          name: campaign.partner.name,
          contactEmail: campaign.partner.contactEmail,
          status: campaign.partner.status,
        }
      : null,
  };
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAdminAuth(request, async (admin) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').toLowerCase();
    const nextStatus = statusForAction(action);

    if (!nextStatus) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Gültige Aktion erforderlich: approve, pause, reject, pending oder complete',
          code: 'INVALID_ACTION',
        },
        { status: 400 },
      );
    }

    const existing = await db.partnerAdCampaign.findUnique({
      where: { id },
      include: { partner: true },
    });

    if (!existing || existing.partner.type !== 'ADS') {
      return NextResponse.json(
        {
          error: 'NotFoundError',
          message: 'Werbekampagne nicht gefunden',
          code: 'AD_CAMPAIGN_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    if (nextStatus === 'ACTIVE') {
      if (existing.partner.status !== 'ACTIVE') {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: 'Partner muss aktiv sein, bevor die Kampagne freigegeben wird',
            code: 'PARTNER_NOT_ACTIVE',
          },
          { status: 409 },
        );
      }

      if (existing.pricingModel !== 'CPC' || !existing.cpcEur || existing.cpcEur <= 0) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: 'Für Beta-Werbung ist ein gültiger CPC erforderlich',
            code: 'CPC_REQUIRED',
          },
          { status: 409 },
        );
      }

      if (!existing.targetUrl || existing.budgetEur <= existing.spentEur) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: 'Ziel-URL und Restbudget sind für Freigabe erforderlich',
            code: 'AD_NOT_READY',
          },
          { status: 409 },
        );
      }
    }

    const campaign = await db.partnerAdCampaign.update({
      where: { id },
      data: { status: nextStatus },
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            contactEmail: true,
            status: true,
          },
        },
      },
    });

    await db.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'STATUS_CHANGE',
        entityType: 'PartnerAdCampaign',
        entityId: campaign.id,
        dataBefore: JSON.stringify({ status: existing.status }),
        dataAfter: JSON.stringify({
          status: nextStatus,
          action,
          reason: body.reason || null,
        }),
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      campaign: formatCampaign(campaign),
    });
  }, [AdminRole.ADMIN, AdminRole.FINANCE]);
}
