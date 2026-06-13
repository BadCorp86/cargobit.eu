import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createOrderInvoiceDraft } from '@/lib/order-invoice';
import { getOptionalAdmin } from '@/lib/request-admin-auth';
import { getOptionalRequestUser } from '@/lib/request-user-auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const fallbackAmount = Number(searchParams.get('amount') || 850);

  try {
    const admin = await getOptionalAdmin(request);
    const requestUser = await getOptionalRequestUser(request);
    const transport = await prisma.transport.findUnique({
      where: { id },
      include: {
        assignment: {
          include: { driver: true },
        },
        commissions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!transport) {
      if (canUseDemoFallback(id)) {
        return NextResponse.json({
          invoice: createOrderInvoiceDraft({
            orderId: id,
            amount: fallbackAmount,
            currency: 'EUR',
            planKey: 'STARTER',
          }),
          source: 'fallback',
          warning: 'Demo order invoice fallback',
        });
      }

      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Transport not found' },
        { status: 404 },
      );
    }

    if (!canReadOrder(transport, requestUser?.id, admin?.role)) {
      return NextResponse.json(
        { error: requestUser || admin ? 'FORBIDDEN' : 'AUTH_REQUIRED', message: 'Keine Berechtigung für die Rechnung dieses Auftrags' },
        { status: requestUser || admin ? 403 : 401 },
      );
    }

    const invoice = createOrderInvoiceDraft({
      orderId: id,
      amount: transport.agreedPrice || transport.shipperBudget || fallbackAmount,
      currency: transport.currency,
      planKey: transport.commissions[0]?.plan,
    });

    return NextResponse.json({
      invoice,
      source: 'database',
    });
  } catch (error) {
    console.error('[OrderInvoiceAPI] Failed:', error);

    if (canUseDemoFallback(id)) {
      return NextResponse.json({
        invoice: createOrderInvoiceDraft({
          orderId: id,
          amount: fallbackAmount,
          currency: 'EUR',
          planKey: 'STARTER',
        }),
        source: 'fallback',
        warning: 'Database unavailable, using invoice fallback',
      });
    }

    return NextResponse.json(
      { error: 'INVOICE_UNAVAILABLE', message: 'Rechnung konnte nicht geladen werden.' },
      { status: 503 },
    );
  }
}

function isDemoOrderId(orderId: string) {
  return orderId.startsWith('mission_demo') || orderId.startsWith('demo') || orderId.startsWith('TR-');
}

function canUseDemoFallback(orderId: string) {
  return process.env.NODE_ENV !== 'production' && isDemoOrderId(orderId);
}

function canReadOrder(
  transport: { shipperUserId: string; assignment?: { driver?: { userId: string } | null } | null },
  userId?: string,
  adminRole?: string,
) {
  if (adminRole && ['ADMIN', 'SUPPORT', 'FINANCE'].includes(adminRole)) return true;
  if (!userId) return false;
  return transport.shipperUserId === userId || transport.assignment?.driver?.userId === userId;
}
