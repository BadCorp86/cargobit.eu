import { NextRequest, NextResponse } from 'next/server';
import { issueOrderInvoice, issueFallbackOrderInvoice } from '@/lib/order-settlement';
import { prisma } from '@/lib/db';
import { getOptionalAdmin } from '@/lib/request-admin-auth';
import { getOptionalRequestUser } from '@/lib/request-user-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const fallbackAmount = Number(body.amount || 850);
  const admin = await getOptionalAdmin(request);
  const requestUser = await getOptionalRequestUser(request);

  if (!admin && !requestUser) {
    return NextResponse.json(
      { error: 'AUTH_REQUIRED', message: 'Authentifizierung erforderlich' },
      { status: 401 },
    );
  }

  try {
    if (!admin) {
      const transport = await prisma.transport.findUnique({
        where: { id },
        include: { assignment: { include: { driver: true } } },
      });

      if (!transport && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'NOT_FOUND', message: 'Transport not found' },
          { status: 404 },
        );
      }

      const isParticipant = transport
        ? transport.shipperUserId === requestUser!.id || transport.assignment?.driver.userId === requestUser!.id
        : false;

      if (transport && !isParticipant) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Keine Berechtigung für die Rechnung dieses Auftrags' },
          { status: 403 },
        );
      }
    }

    const result = await issueOrderInvoice({
      orderId: id,
      amount: fallbackAmount,
      actorId: admin?.id || requestUser?.id || null,
      sendEmail: true,
      allowFallback: process.env.NODE_ENV !== 'production',
    });

    if (!result) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Transport not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[IssueInvoiceAPI] Failed:', error);
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'INVOICE_ISSUE_FAILED', message: 'Rechnung konnte nicht erstellt werden.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      await issueFallbackOrderInvoice(id, fallbackAmount, 'Database unavailable, using invoice issue fallback'),
    );
  }
}
