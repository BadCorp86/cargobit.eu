import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { campaignCpc, hasCampaignBudget, parseAdImpressionId, startOfUtcDay } from '@/lib/ads/ad-serving';

export const dynamic = 'force-dynamic';

const clickedImpressions = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const impressionId = String(body.impressionId || '');
    const adId = String(body.adId || body.campaignId || '');
    const parsed = parseAdImpressionId(impressionId);

    if (!parsed?.campaignId || !adId) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Impression-ID und Ad-ID erforderlich',
          code: 'MISSING_REQUIRED_FIELDS',
        },
        { status: 400 },
      );
    }

    if (parsed.campaignId !== adId) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Impression passt nicht zur Anzeige',
          code: 'IMPRESSION_AD_MISMATCH',
        },
        { status: 400 },
      );
    }

    if (clickedImpressions.has(impressionId)) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        click: {
          impressionId,
          adId,
          recorded: false,
          costEur: 0,
        },
      });
    }

    const campaign = await db.partnerAdCampaign.findUnique({
      where: { id: adId },
      select: {
        id: true,
        partnerId: true,
        status: true,
        budgetEur: true,
        spentEur: true,
        pricingModel: true,
        cpcEur: true,
      },
    });

    if (!campaign || campaign.status !== 'ACTIVE' || campaign.pricingModel !== 'CPC' || !hasCampaignBudget(campaign)) {
      return NextResponse.json(
        {
          error: 'AdNotBillable',
          message: 'Anzeige ist nicht aktiv, nicht CPC-basiert oder Budget ist erschöpft',
          code: 'AD_NOT_BILLABLE',
        },
        { status: 409 },
      );
    }

    const cpc = campaignCpc(campaign);
    if (cpc <= 0) {
      return NextResponse.json(
        {
          error: 'AdNotBillable',
          message: 'Für diese Kampagne ist kein gültiger CPC hinterlegt',
          code: 'MISSING_CPC',
        },
        { status: 409 },
      );
    }

    const remainingBudget = Math.max(0, campaign.budgetEur - campaign.spentEur);
    const costEur = Math.min(cpc, remainingBudget);
    if (costEur <= 0) {
      return NextResponse.json(
        {
          error: 'BudgetExhausted',
          message: 'Kampagnenbudget ist erschöpft',
          code: 'BUDGET_EXHAUSTED',
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
          clicks: { increment: 1 },
          costEur: { increment: costEur },
        },
        create: {
          partnerId: campaign.partnerId,
          campaignId: campaign.id,
          date: today,
          clicks: 1,
          costEur,
        },
      }),
      db.partnerAdCampaign.update({
        where: { id: campaign.id },
        data: {
          totalClicks: { increment: 1 },
          spentEur: { increment: costEur },
        },
      }),
    ]);

    clickedImpressions.add(impressionId);

    return NextResponse.json({
      success: true,
      click: {
        clickId: `clk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        impressionId,
        adId,
        recorded: true,
        costEur,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error('Click tracking error:', error);
    return NextResponse.json(
      {
        error: 'InternalServerError',
        message: 'Fehler beim Tracking des Klicks',
        code: 'CLICK_TRACKING_FAILED',
      },
      { status: 500 },
    );
  }
}
