import { NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
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
