import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/request-user-auth';

export async function POST(request: NextRequest) {
  const auth = await requireRequestUser(request);
  if (auth.response) return auth.response;

  return NextResponse.json({
    success: false,
    error: 'LEGACY_STRIPE_PAYOUT_DISABLED',
    message: 'Stripe-Auszahlungen laufen über den geprüften Wallet-Auszahlungspfad.',
    walletPayoutUrl: '/api/wallet/payout',
  }, { status: 410 });
}
