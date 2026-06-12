/**
 * CargoBit Bid Detail API Routes
 * GET    /api/bids/[id] - Get bid details
 * PATCH  /api/bids/[id] - Accept or reject bid (shipper) / Withdraw (transporter)
 */

import { NextRequest, NextResponse } from 'next/server';
import { bidsService } from '@/services/bids.service';
import { requireRequestUser } from '@/lib/request-user-auth';

// ============================================
// GET /api/bids/[id] - Get bid details
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user!.id;
    
    const { id } = await params;
    
    const { prisma } = await import('@/lib/db');
    
    const offer = await prisma.offer.findUnique({
      where: { id },
      include: {
        transport: {
          include: {
            pickupAddress: true,
            deliveryAddress: true,
          },
        },
        driver: {
          include: {
            user: {
              include: {
                companyUsers: {
                  include: { company: true },
                },
              },
            },
          },
        },
        vehicle: true,
      },
    });
    
    if (!offer) {
      return NextResponse.json(
        { error: 'Bid not found' },
        { status: 404 }
      );
    }
    
    // Verify access (shipper or transporter)
    const isShipper = offer.transport.shipperUserId === userId;
    const isTransporter = offer.driver.userId === userId;
    
    if (!isShipper && !isTransporter) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    const company = offer.driver.user.companyUsers[0]?.company;
    
    return NextResponse.json({
      id: offer.id,
      jobId: offer.transportId,
      job: {
        pickup: {
          street: offer.transport.pickupAddress.street,
          city: offer.transport.pickupAddress.city,
          country: offer.transport.pickupAddress.country,
        },
        delivery: {
          street: offer.transport.deliveryAddress.street,
          city: offer.transport.deliveryAddress.city,
          country: offer.transport.deliveryAddress.country,
        },
        pickupDatetime: offer.transport.pickupDatetime,
        description: offer.transport.description,
      },
      transporter: isShipper ? {
        id: offer.driverId,
        companyName: company?.name,
        driverName: `${offer.driver.user.firstName} ${offer.driver.user.lastName}`,
        rating: offer.driver.ratingAvg,
        completedJobs: offer.driver.completedTransports,
        vehicleType: offer.vehicle?.type,
      } : undefined,
      price: offer.price,
      currency: offer.currency,
      message: offer.message,
      estimatedDuration: offer.estimatedDuration,
      status: offer.status.toLowerCase(),
      createdAt: offer.createdAt,
      validUntil: offer.validUntil,
      acceptedAt: offer.acceptedAt,
      rejectedAt: offer.rejectedAt,
    });
    
  } catch (error: any) {
    console.error('[API] GET /bids/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bid' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/bids/[id] - Accept, reject, or withdraw
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;
    const userId = auth.user!.id;
    
    const { id } = await params;
    const body = await request.json();
    const action = body.action; // 'accept', 'reject', 'withdraw', 'update'
    
    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action (accept, reject, withdraw, update)' },
        { status: 400 }
      );
    }
    
    switch (action) {
      case 'accept': {
        const result = await bidsService.acceptBid(id, userId);
        return NextResponse.json({
          success: result.success,
          jobId: result.jobId,
          agreedPrice: result.agreedPrice,
        });
      }
      
      case 'reject': {
        const result = await bidsService.rejectBid(id, userId, body.reason);
        return NextResponse.json(result);
      }
      
      case 'withdraw': {
        const result = await bidsService.withdrawBid(id, userId);
        return NextResponse.json(result);
      }

      case 'update': {
        const price = Number(body.price);
        const result = await bidsService.updateBid({
          bidId: id,
          userId,
          price,
          message: body.message,
          estimatedDuration: body.estimatedDuration ? Number(body.estimatedDuration) : undefined,
          validUntilHours: body.validUntilHours ? Number(body.validUntilHours) : undefined,
        });
        return NextResponse.json(result);
      }
      
      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}. Valid: accept, reject, withdraw, update` },
          { status: 400 }
        );
    }
    
  } catch (error: any) {
    console.error('[API] PATCH /bids/[id] error:', error);

    if (error?.message === 'Not authorized') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Sie haben keinen Zugriff auf dieses Angebot.' },
        { status: 403 },
      );
    }

    if (error?.message === 'Bid not found') {
      return NextResponse.json(
        { error: 'NotFound', message: 'Angebot nicht gefunden.' },
        { status: 404 },
      );
    }

    if (typeof error?.message === 'string' && error.message.startsWith('Bid is already')) {
      return NextResponse.json(
        { error: 'BidNotPending', message: 'Dieses Angebot ist nicht mehr offen und kann nicht geändert werden.' },
        { status: 409 },
      );
    }

    if (error?.message === 'Invalid bid price') {
      return NextResponse.json(
        { error: 'ValidationError', message: 'Ein gültiger Angebotspreis ist erforderlich.' },
        { status: 400 },
      );
    }

    if (typeof error?.message === 'string' && error.message.startsWith('Bid below minimum:')) {
      const [, minimumPrice, currency] = error.message.split(':');
      return NextResponse.json(
        {
          error: 'BID_BELOW_MINIMUM',
          message: `Das Angebot liegt unter der Anti-Dumping-Grenze von ${Number(minimumPrice).toFixed(2)} ${currency}.`,
          minimumPrice: Number(minimumPrice),
          currency,
        },
        { status: 400 },
      );
    }

    if (error?.message === 'Job is not open for bids') {
      return NextResponse.json(
        { error: 'JobNotOpen', message: 'Dieser Auftrag ist aktuell nicht für Angebote geöffnet.' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update bid' },
      { status: 500 }
    );
  }
}
