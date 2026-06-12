import { NextResponse } from 'next/server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
