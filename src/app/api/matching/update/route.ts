import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { UpdateMatchingRequest, UpdateMatchingResponse, ApiErrorResponse } from '@/types/matching';

// POST /api/matching/update - Update matching (new driver, location change, etc.)
export async function POST(request: NextRequest) {
  try {
    const body: UpdateMatchingRequest = await request.json();

    if (!body.transportId || !body.event) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'ValidationError',
        message: 'Missing required fields: transportId, event',
        code: 'MISSING_FIELDS'
      }, { status: 400 });
    }

    // Get transport and existing matches
    const transport = await prisma.transport.findUnique({
      where: { id: body.transportId }
    });

    if (!transport) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'NotFoundError',
        message: 'Transport not found',
        code: 'TRANSPORT_NOT_FOUND'
      }, { status: 404 });
    }

    const matchingId = `match_${body.transportId}`;

    switch (body.event) {
      case 'new_driver_available': {
        // Check if new driver should be added to matching
        const newDriverId = (body.data?.driverId as string) || null;
        
        if (newDriverId) {
          const driver = await prisma.user.findUnique({
            where: { id: newDriverId },
            include: { vehicles: { where: { isActive: true } } }
          });

          if (driver && driver.vehicles.length > 0) {
            // Quick score check
            let score = 30;
            const reasons: string[] = ['Neu verfügbar'];

            if (driver.rating >= 4.5) {
              score += 10;
              reasons.push('Top Bewertung');
            }

            // Add to matching results
            await prisma.matchingResult.create({
              data: {
                id: `mr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                transportId: body.transportId,
                driverId: newDriverId,
                matchScore: score,
                matchReasons: JSON.stringify(reasons),
                matchType: 'REGIONAL',
                vehicleMatch: true,
                driverMatch: true,
                routeMatch: true,
                internationalMatch: false,
                countryPermissionsOk: true,
                documentsOk: true,
                tunnelCodesOk: true,
                languageMatch: false,
                experienceBonus: 0,
                ratingBonus: driver.rating >= 4.5 ? 10 : 0,
                returnLoadBonus: 0,
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 60 * 60 * 1000)
              }
            }).catch(() => {});
          }
        }
        break;
      }

      case 'driver_location_changed': {
        // Recalculate distances for all pending matches
        const driverId = body.data?.driverId as string;
        const newLocation = body.data?.location as { lat: number; lng: number } | undefined;

        if (driverId && newLocation) {
          // Update driver's current location
          await prisma.user.update({
            where: { id: driverId },
            data: {
              currentLocation: JSON.stringify({
                ...newLocation,
                timestamp: new Date().toISOString()
              })
            }
          });

          // Recalculate distance scores (would use geolocation API in production)
          // For now, we just log the update
        }
        break;
      }

      case 'requirements_updated': {
        // Re-run matching with updated requirements
        // This would trigger a full re-match
        break;
      }

      case 'price_changed': {
        // Update price and recalculate scores
        const newPrice = body.data?.price as number | undefined;
        
        if (newPrice) {
          await prisma.transport.update({
            where: { id: body.transportId },
            data: { shipperBudget: newPrice }
          });
        }
        break;
      }
    }

    // Count current candidates
    const candidateCount = await prisma.matchingResult.count({
      where: {
        transportId: body.transportId,
        status: 'PENDING'
      }
    });

    return NextResponse.json<UpdateMatchingResponse>({
      matchingId,
      status: candidateCount > 0 ? 'updated' : 'recalculating'
    }, { status: 200 });

  } catch (error) {
    console.error('Update matching error:', error);
    return NextResponse.json<ApiErrorResponse>({
      error: 'InternalServerError',
      message: 'Failed to update matching',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
