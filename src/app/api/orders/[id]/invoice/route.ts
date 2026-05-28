import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createOrderInvoiceDraft } from '@/lib/order-invoice';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const fallbackAmount = Number(searchParams.get('amount') || 850);

  try {
    const transport = await prisma.transport.findUnique({
      where: { id },
      include: {
        commissions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!transport) {
      if (isDemoOrderId(id)) {
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
}

function isDemoOrderId(orderId: string) {
  return orderId.startsWith('mission_demo') || orderId.startsWith('demo') || orderId.startsWith('TR-');
}
