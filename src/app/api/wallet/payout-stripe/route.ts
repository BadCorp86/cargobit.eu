import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'LEGACY_STRIPE_PAYOUT_DISABLED',
    message: 'Stripe-Auszahlungen laufen über den geprüften Wallet-Auszahlungspfad.',
    walletPayoutUrl: '/api/wallet/payout',
  }, { status: 410 });
}
