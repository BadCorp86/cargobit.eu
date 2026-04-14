import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AssignTransportRequest, AssignTransportResponse, ApiErrorResponse } from '@/types/transport';

// POST /api/transports/[id]/assign - Assign a driver to a transport
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transportId } = await params;
    const body: AssignTransportRequest = await request.json();

    // Validate
    if (!body.driverId) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'ValidationError',
        message: 'Missing required field: driverId',
        code: 'MISSING_FIELDS'
      }, { status: 400 });
    }

    // Get transport
    const transport = await prisma.transport.findUnique({
      where: { id: transportId },
      include: {
        shipper: {
          include: { wallet: true }
        }
      }
    });

    if (!transport) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'NotFoundError',
        message: 'Transport not found',
        code: 'NOT_FOUND'
      }, { status: 404 });
    }

    if (transport.status !== 'PENDING' && transport.status !== 'PUBLISHED' && transport.status !== 'OFFERS_RECEIVED') {
      return NextResponse.json<ApiErrorResponse>({
        error: 'ValidationError',
        message: 'Transport is not available for assignment',
        code: 'TRANSPORT_NOT_AVAILABLE'
      }, { status: 400 });
    }

    // Get the offer if provided
    let agreedPrice = transport.shipperBudget;
    if (body.offerId) {
      const offer = await prisma.offer.findFirst({
        where: {
          id: body.offerId,
          transportId,
          driverId: body.driverId,
          status: 'PENDING'
        }
      });

      if (offer) {
        agreedPrice = offer.price;
        // Accept the offer
        await prisma.offer.update({
          where: { id: offer.id },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date()
          }
        });
        // Reject other offers
        await prisma.offer.updateMany({
          where: {
            transportId,
            id: { not: offer.id },
            status: 'PENDING'
          },
          data: {
            status: 'REJECTED',
            rejectionReason: 'Another driver was selected'
          }
        });
      }
    }

    // Calculate escrow amount (price + fees)
    const platformFee = (agreedPrice || 0) * 0.04; // 4% shipper fee
    const escrowAmount = (agreedPrice || 0) + platformFee;

    // Check if shipper has enough balance
    let escrowCreated = false;
    if (transport.shipper?.wallet && transport.shipper.wallet.availableBalance >= escrowAmount) {
      // Create escrow transaction
      await prisma.$transaction([
        // Deduct from wallet
        prisma.wallet.update({
          where: { userId: transport.shipperId },
          data: {
            availableBalance: { decrement: escrowAmount },
            pendingBalance: { increment: escrowAmount }
          }
        }),
        // Create transaction record
        prisma.transaction.create({
          data: {
            walletId: transport.shipper.wallet.id,
            type: 'PAYMENT_OUT',
            status: 'PENDING',
            amount: escrowAmount,
            fee: platformFee,
            netAmount: agreedPrice || 0,
            description: `Escrow for transport ${transportId}`,
            transportId
          }
        })
      ]);
      escrowCreated = true;
    }

    // Update transport
    const updatedTransport = await prisma.transport.update({
      where: { id: transportId },
      data: {
        driverId: body.driverId,
        agreedPrice,
        status: 'CONFIRMED',
        acceptedAt: new Date()
      }
    });

    return NextResponse.json<AssignTransportResponse>({
      transportId,
      status: 'confirmed',
      driverId: body.driverId,
      escrowCreated,
      escrowAmount: escrowCreated ? escrowAmount : undefined
    });

  } catch (error) {
    console.error('Assign transport error:', error);
    return NextResponse.json<ApiErrorResponse>({
      error: 'InternalServerError',
      message: 'Failed to assign transport',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
