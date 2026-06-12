import { NextResponse } from 'next/server';

const legacyPayoutDisabledResponse = () =>
  NextResponse.json(
    {
      error: 'LEGACY_PAYOUT_DISABLED',
      message:
        'Direkte Auszahlungen über /api/payout sind deaktiviert. Bankauszahlungen laufen nur noch über den eigenen Wallet-Bereich mit verifizierter Auszahlungsmethode.',
      walletEndpoints: {
        carrier: '/carrier/wallet',
        driver: '/driver/earnings',
        api: '/api/wallet/payout',
      },
    },
    { status: 410 }
  );

export async function GET() {
  return legacyPayoutDisabledResponse();
}

export async function POST() {
  return legacyPayoutDisabledResponse();
}
