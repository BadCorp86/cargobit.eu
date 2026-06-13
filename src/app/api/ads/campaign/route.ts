import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      error: 'DeprecatedEndpoint',
      message: 'Werbekampagnen werden über das Partner-Portal oder die Admin-Werbeverwaltung gelesen.',
      code: 'ADS_CAMPAIGN_ENDPOINT_DEPRECATED',
    },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'DeprecatedEndpoint',
      message: 'Werbekampagnen können nicht öffentlich erstellt werden. Bitte Partner-API /api/partner/ads/campaigns verwenden.',
      code: 'ADS_CAMPAIGN_ENDPOINT_DEPRECATED',
    },
    { status: 410 },
  );
}
