import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasCampaignBudget, parseAdImpressionId, startOfUtcDay } from '@/lib/ads/ad-serving';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const impressionId = String(body.impressionId || '');
    const parsed = parseAdImpressionId(impressionId);

    if (!parsed?.campaignId) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Gültige Impression-ID erforderlich',
          code: 'INVALID_IMPRESSION_ID',
        },
        { status: 400 },
      );
    }

    const campaign = await db.partnerAdCampaign.findUnique({
      where: { id: parsed.campaignId },
      select: {
        id: true,
        partnerId: true,
        status: true,
        budgetEur: true,
        spentEur: true,
      },
    });

    if (!campaign || campaign.status !== 'ACTIVE' || !hasCampaignBudget(campaign)) {
      return NextResponse.json(
        {
          error: 'AdNotTrackable',
          message: 'Anzeige ist nicht aktiv oder Budget ist erschöpft',
          code: 'AD_NOT_TRACKABLE',
        },
        { status: 409 },
      );
    }

    const today = startOfUtcDay();

    await db.$transaction([
      db.partnerAdStat.upsert({
        where: {
          campaignId_date: {
            campaignId: campaign.id,
            date: today,
          },
        },
        update: {
          impressions: { increment: 1 },
        },
        create: {
          partnerId: campaign.partnerId,
          campaignId: campaign.id,
          date: today,
          impressions: 1,
        },
      }),
      db.partnerAdCampaign.update({
        where: { id: campaign.id },
        data: {
          totalImpressions: { increment: 1 },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      impression: {
        impressionId,
        campaignId: campaign.id,
        recorded: true,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('Impression tracking error:', error);
    return NextResponse.json(
      {
        error: 'InternalServerError',
        message: 'Fehler beim Tracking der Impression',
        code: 'IMPRESSION_TRACKING_FAILED',
      },
      { status: 500 },
    );
  }
}
