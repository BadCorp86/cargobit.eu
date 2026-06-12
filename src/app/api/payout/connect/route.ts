import { NextResponse } from 'next/server';

const connectPayoutDisabledResponse = () =>
  NextResponse.json(
    {
      error: 'CONNECT_PAYOUT_ONBOARDING_DISABLED',
      message:
        'Stripe-Connect-Auszahlungen sind im vereinfachten CargoBit-MVP deaktiviert. Transporteure hinterlegen ihre Auszahlungsmethode im eigenen Wallet-Bereich.',
      walletEndpoints: {
        payoutMethods: '/api/wallet/payout-methods',
        payout: '/api/wallet/payout',
      },
    },
    { status: 410 }
  );

export async function GET() {
  return connectPayoutDisabledResponse();
}

export async function POST() {
  return connectPayoutDisabledResponse();
}
