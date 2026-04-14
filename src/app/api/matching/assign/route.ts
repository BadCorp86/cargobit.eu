import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AutoAssignRequest, AutoAssignResponse, ApiErrorResponse } from '@/types/matching';

// POST /api/matching/assign - Assign driver to transport (auto or manual)
export async function POST(request: NextRequest) {
  try {
    const body: AutoAssignRequest = await request.json();

    if (!body.transportId || !body.driverId) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'ValidationError',
        message: 'Missing required fields: transportId, driverId',
        code: 'MISSING_FIELDS'
      }, { status: 400 });
    }

    // Get transport
    const transport = await prisma.transport.findUnique({
      where: { id: body.transportId },
      include: {
        shipper: { include: { wallet: true } }
      }
    });

    if (!transport) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'NotFoundError',
        message: 'Transport not found',
        code: 'TRANSPORT_NOT_FOUND'
      }, { status: 404 });
    }

    // Check if transport can be assigned
    if (!['PENDING', 'PUBLISHED', 'OFFERS_RECEIVED'].includes(transport.status)) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'ValidationError',
        message: 'Transport cannot be assigned',
        code: 'TRANSPORT_NOT_ASSIGNABLE'
      }, { status: 400 });
    }

    // Get driver
    const driver = await prisma.user.findUnique({
      where: { id: body.driverId },
      include: { wallet: true, vehicles: { where: { isActive: true }, take: 1 } }
    });

    if (!driver) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'NotFoundError',
        message: 'Driver not found',
        code: 'DRIVER_NOT_FOUND'
      }, { status: 404 });
    }

    // Run fraud check unless skipped
    if (!body.skipFraudCheck) {
      // Quick fraud check
      if (driver.status !== 'ACTIVE') {
        return NextResponse.json<AutoAssignResponse>({
          transportId: body.transportId,
          driverId: body.driverId,
          vehicleId: body.vehicleId,
          status: 'rejected',
          rejectionReason: 'Fahrer nicht aktiv'
        }, { status: 200 });
      }

      if (driver.role !== 'DRIVER_SELF_EMPLOYED' && driver.role !== 'DISPATCHER') {
        return NextResponse.json<AutoAssignResponse>({
          transportId: body.transportId,
          driverId: body.driverId,
          vehicleId: body.vehicleId,
          status: 'rejected',
          rejectionReason: 'Ungültige Rolle'
        }, { status: 200 });
      }
    }

    // Get matching result
    const matchingResult = await prisma.matchingResult.findFirst({
      where: {
        transportId: body.transportId,
        driverId: body.driverId
      }
    });

    // Get accepted offer
    const offer = await prisma.offer.findFirst({
      where: {
        transportId: body.transportId,
        driverId: body.driverId,
        status: 'PENDING'
      }
    });

    const agreedPrice = offer?.price || transport.shipperBudget || 0;

    // Create escrow if shipper has wallet
    let escrowCreated = false;
    let escrowAmount = 0;

    if (transport.shipper?.wallet && agreedPrice > 0) {
      const platformFee = agreedPrice * 0.04; // 4% shipper fee
      escrowAmount = agreedPrice + platformFee;

      if (transport.shipper.wallet.availableBalance >= escrowAmount) {
        // Create escrow transaction
        await prisma.$transaction([
          prisma.wallet.update({
            where: { userId: transport.shipperId },
            data: {
              availableBalance: { decrement: escrowAmount },
              pendingBalance: { increment: escrowAmount }
            }
          }),
          prisma.transaction.create({
            data: {
              walletId: transport.shipper.wallet.id,
              type: 'PAYMENT_OUT',
              status: 'PENDING',
              amount: escrowAmount,
              fee: platformFee,
              netAmount: agreedPrice,
              description: `Escrow für Transport ${body.transportId}`,
              transportId: body.transportId
            }
          })
        ]);
        escrowCreated = true;
      }
    }

    // Update transport
    await prisma.transport.update({
      where: { id: body.transportId },
      data: {
        driverId: body.driverId,
        agreedPrice,
        status: 'CONFIRMED',
        acceptedAt: new Date()
      }
    });

    // Update matching result
    if (matchingResult) {
      await prisma.matchingResult.update({
        where: { id: matchingResult.id },
        data: { status: 'ACCEPTED' }
      });
    }

    // Reject other offers
    await prisma.offer.updateMany({
      where: {
        transportId: body.transportId,
        id: { not: offer?.id },
        status: 'PENDING'
      },
      data: {
        status: 'REJECTED',
        rejectionReason: 'Anderer Fahrer wurde ausgewählt'
      }
    });

    // Update other matching results
    await prisma.matchingResult.updateMany({
      where: {
        transportId: body.transportId,
        driverId: { not: body.driverId },
        status: 'PENDING'
      },
      data: { status: 'REJECTED' }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: transport.shipperId,
        action: 'TRANSPORT_ASSIGNED',
        entityType: 'Transport',
        entityId: body.transportId,
        newValue: JSON.stringify({
          driverId: body.driverId,
          vehicleId: body.vehicleId,
          agreedPrice,
          escrowCreated,
          escrowAmount
        })
      }
    });

    const status = escrowCreated ? 'assigned' : 'pending_verification';

    return NextResponse.json<AutoAssignResponse>({
      transportId: body.transportId,
      driverId: body.driverId,
      vehicleId: body.vehicleId || driver.vehicles[0]?.id,
      status,
      escrowCreated,
      escrowAmount: escrowCreated ? escrowAmount : undefined
    }, { status: 200 });

  } catch (error) {
    console.error('Auto assign error:', error);
    return NextResponse.json<ApiErrorResponse>({
      error: 'InternalServerError',
      message: 'Failed to assign driver',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
