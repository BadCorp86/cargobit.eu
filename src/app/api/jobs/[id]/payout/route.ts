import { NextRequest, NextResponse } from 'next/server';
import { requireRequestUser } from '@/lib/request-user-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRequestUser(request);
  if (auth.response) return auth.response;

  const { id } = await params;

  return NextResponse.json(
    {
      error: 'JOB_BANK_PAYOUT_DISABLED',
      message:
        'Direkte Bankauszahlung am Auftrag ist deaktiviert. Am Auftrag wird nur die Wallet-Freigabe nach POD, 24-Werktagsstunden und Risk-Gate verwaltet. Bankauszahlung startet der Transporteur im eigenen Wallet.',
      orderReleaseEndpoint: `/api/orders/${id}/payout/release`,
      walletPayoutEndpoint: '/api/wallet/payout',
    },
    { status: 410 }
  );
}
