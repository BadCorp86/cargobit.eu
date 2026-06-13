import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/request-user-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRequestUser(request);
  if (auth.response) return auth.response;

  const { id } = await params;

  return NextResponse.json({
    success: false,
    error: 'ORDER_BANK_PAYOUT_DISABLED',
    message: 'Bankauszahlung ist ausschließlich im eigenen Wallet-Bereich möglich.',
    orderId: id,
    carrierWalletUrl: '/carrier/wallet',
    driverEarningsUrl: '/driver/earnings',
  }, { status: 410 });
}
