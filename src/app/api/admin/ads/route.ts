import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAdminAuth } from '@/lib/admin-rbac';
import { AdminRole } from '@/services/admin-auth.service';

export const dynamic = 'force-dynamic';

function parseLimit(value: string | null) {
  const limit = Number(value || 50);
  return Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
}

function formatCampaign(campaign: any) {
  const impressions = Number(campaign.totalImpressions || 0);
  const clicks = Number(campaign.totalClicks || 0);
  const spentEur = Number(campaign.spentEur || 0);
  const budgetEur = Number(campaign.budgetEur || 0);

  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    slot: campaign.slot,
    bannerUrl: campaign.bannerUrl,
    bannerAlt: campaign.bannerAlt,
    targetUrl: campaign.targetUrl,
    callToAction: campaign.callToAction,
    budgetEur,
    spentEur,
    remainingBudgetEur: Math.max(0, budgetEur - spentEur),
    pricingModel: campaign.pricingModel,
    cpcEur: campaign.cpcEur,
    cpmEur: campaign.cpmEur,
    cpaEur: campaign.cpaEur,
    status: campaign.status,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    totalImpressions: impressions,
    totalClicks: clicks,
    totalConversions: campaign.totalConversions,
    ctr: impressions > 0 ? clicks / impressions * 100 : 0,
    createdAt: campaign.createdAt,
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

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const slot = searchParams.get('slot');
    const search = searchParams.get('search')?.trim();
    const limit = parseLimit(searchParams.get('limit'));
    const offset = Number(searchParams.get('offset') || 0);

    const where: any = {
      partner: { type: 'ADS' },
    };

    if (status) where.status = status.toUpperCase();
    if (slot) where.slot = slot.toUpperCase();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { targetUrl: { contains: search, mode: 'insensitive' } },
        { partner: { name: { contains: search, mode: 'insensitive' } } },
        { partner: { contactEmail: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [campaigns, total, pending, active, paused, spentAggregate] = await Promise.all([
      db.partnerAdCampaign.findMany({
        where,
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
        orderBy: [
          { status: 'asc' },
          { updatedAt: 'desc' },
        ],
        take: limit,
        skip: Number.isFinite(offset) && offset > 0 ? offset : 0,
      }),
      db.partnerAdCampaign.count({ where }),
      db.partnerAdCampaign.count({ where: { partner: { type: 'ADS' }, status: { in: ['DRAFT', 'PENDING'] as any } } }),
      db.partnerAdCampaign.count({ where: { partner: { type: 'ADS' }, status: 'ACTIVE' } }),
      db.partnerAdCampaign.count({ where: { partner: { type: 'ADS' }, status: 'PAUSED' } }),
      db.partnerAdCampaign.aggregate({
        where: { partner: { type: 'ADS' } },
        _sum: {
          spentEur: true,
          totalClicks: true,
          totalImpressions: true,
        },
      }),
    ]);

    return NextResponse.json({
      items: campaigns.map(formatCampaign),
      summary: {
        total,
        pending,
        active,
        paused,
        spentEur: spentAggregate._sum.spentEur || 0,
        clicks: spentAggregate._sum.totalClicks || 0,
        impressions: spentAggregate._sum.totalImpressions || 0,
      },
      total,
      limit,
      offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    });
  }, [AdminRole.ADMIN, AdminRole.FINANCE]);
}

