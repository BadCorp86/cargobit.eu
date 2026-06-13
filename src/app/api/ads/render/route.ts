import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  campaignCpc,
  createAdImpressionId,
  hasCampaignBudget,
  normalizePublicAdSlot,
  publicSlotLabel,
} from '@/lib/ads/ad-serving';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const publicSlot = searchParams.get('slot');
    const slot = normalizePublicAdSlot(publicSlot);
    const now = new Date();

    if (!slot) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Gültiger Slot-Parameter erforderlich',
          code: 'INVALID_SLOT',
        },
        { status: 400 },
      );
    }

    const campaigns = await db.partnerAdCampaign.findMany({
      where: {
        slot,
        status: 'ACTIVE',
        pricingModel: 'CPC',
        partner: {
          type: 'ADS',
          status: 'ACTIVE',
        },
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } },
            ],
          },
        ],
      },
      include: {
        partner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { spentEur: 'asc' },
        { updatedAt: 'desc' },
      ],
      take: 20,
    });

    const availableCampaigns = campaigns.filter((campaign) => hasCampaignBudget(campaign) && campaignCpc(campaign) > 0);

    if (availableCampaigns.length === 0) {
      return NextResponse.json(
        {
          error: 'NotFoundError',
          message: 'Keine aktive Anzeige für diesen Slot verfügbar',
          code: 'NO_ACTIVE_ADS',
        },
        { status: 404 },
      );
    }

    const selectedAd = availableCampaigns[Math.floor(Math.random() * availableCampaigns.length)];
    const impressionId = createAdImpressionId(selectedAd.id);

    return NextResponse.json({
      adId: selectedAd.id,
      campaignId: selectedAd.id,
      partnerId: selectedAd.partnerId,
      imageUrl: selectedAd.bannerUrl,
      targetUrl: selectedAd.targetUrl,
      impressionId,
      provider: selectedAd.partner.name,
      alt: selectedAd.bannerAlt || selectedAd.name,
      callToAction: selectedAd.callToAction,
      label: publicSlotLabel(publicSlot || slot),
      pricingModel: selectedAd.pricingModel,
    });
  } catch (error) {
    console.error('Ad render error:', error);
    return NextResponse.json(
      {
        error: 'InternalServerError',
        message: 'Fehler beim Abrufen der Anzeige',
        code: 'AD_RENDER_FAILED',
      },
      { status: 500 },
    );
  }
}
