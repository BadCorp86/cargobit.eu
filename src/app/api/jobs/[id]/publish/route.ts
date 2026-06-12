import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRequestUser } from '@/lib/request-user-auth';
import { jobsService } from '@/services/jobs.service';
import { WalletTopupRequiredError } from '@/services/wallet-reservation.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRequestUser(request);
  if (auth.response) return auth.response;

  const userId = auth.user.id;
  const { id } = await params;
  const transport = await prisma.transport.findUnique({ where: { id } });

  if (!transport) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Transport not found' },
      { status: 404 },
    );
  }

  if (transport.shipperUserId !== userId) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Only the shipper can publish this transport.' },
      { status: 403 },
    );
  }

  try {
    await jobsService.publishJob(id);

    return NextResponse.json({
      success: true,
      jobId: id,
      status: 'PUBLISHED',
    });
  } catch (error: any) {
    if (error instanceof WalletTopupRequiredError) {
      return NextResponse.json(
        {
          error: error.code,
          message: 'Zahlungsschutz erforderlich, bevor der Auftrag online gehen kann.',
          wallet: error.details,
        },
        { status: error.status },
      );
    }

    if (error?.code === 'PRICE_REQUIRED') {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
        },
        { status: error.status || 400 },
      );
    }

    console.error('[JobsPublishAPI] Failed:', error);
    return NextResponse.json(
      { error: 'PUBLISH_FAILED', message: error.message || 'Failed to publish transport' },
      { status: 500 },
    );
  }
}
