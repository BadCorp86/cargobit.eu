import { NextRequest, NextResponse } from 'next/server';
import { issueOrderInvoice, issueFallbackOrderInvoice } from '@/lib/order-settlement';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const fallbackAmount = Number(body.amount || 850);

  try {
    const result = await issueOrderInvoice({
      orderId: id,
      amount: fallbackAmount,
      actorId: request.headers.get('x-user-id'),
      sendEmail: true,
      allowFallback: true,
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
    return NextResponse.json(
      await issueFallbackOrderInvoice(id, fallbackAmount, 'Database unavailable, using invoice issue fallback'),
    );
  }
}
