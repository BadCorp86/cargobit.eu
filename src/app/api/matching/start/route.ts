import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { StartMatchingRequest, StartMatchingResponse, ApiErrorResponse } from '@/types/matching';

// POST /api/matching/start - Start matching for a transport
export async function POST(request: NextRequest) {
  try {
    const body: StartMatchingRequest = await request.json();
    
    // Validate
    if (!body.transportId) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'ValidationError',
        message: 'Missing required field: transportId',
        code: 'MISSING_TRANSPORT_ID'
      }, { status: 400 });
    }

    // Get transport
    const transport = await prisma.transport.findUnique({
      where: { id: body.transportId },
      include: {
        shipper: { select: { id: true, subscriptionPlan: true } }
      }
    });

    if (!transport) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'NotFoundError',
        message: 'Transport not found',
        code: 'TRANSPORT_NOT_FOUND'
      }, { status: 404 });
    }

    // Check if matching already running
    const existingMatching = await prisma.matchingResult.findFirst({
      where: {
        transportId: body.transportId,
        status: 'PENDING'
      }
    });

    if (existingMatching) {
      return NextResponse.json<StartMatchingResponse>({
        matchingId: existingMatching.id,
        status: 'started',
        estimatedCandidates: 0
      });
    }

    // Create matching ID
    const matchingId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if international
    const isInternational = transport.pickupCountry !== transport.deliveryCountry;

    // Parse requirements
    const vehicleRequirements = transport.vehicleRequirements 
      ? JSON.parse(transport.vehicleRequirements) 
      : null;
    const driverRequirements = transport.driverRequirements 
      ? JSON.parse(transport.driverRequirements) 
      : null;
    const internationalRequirements = transport.internationalRequirements 
      ? JSON.parse(transport.internationalRequirements) 
      : null;

    // ========== PHASE 1: HARD FILTER ==========
    
    // Build driver query
    const driverWhere: Record<string, unknown> = {
      role: { in: ['DRIVER_SELF_EMPLOYED', 'DISPATCHER'] },
      status: 'ACTIVE',
      isAvailable: true
    };

    // International filter
    if (isInternational) {
      driverWhere.internationalAllowed = true;
    }

    // Find candidates
    const candidates = await prisma.user.findMany({
      where: driverWhere,
      include: {
        vehicles: { where: { isActive: true } },
        driverPermissions: { where: { isAllowed: true } }
      },
      take: body.maxCandidates || 100
    });

    // ========== PHASE 2: VEHICLE MATCHING ==========
    
    const matchedCandidates: Array<{
      driverId: string;
      vehicleId: string;
      score: number;
      reasons: string[];
    }> = [];

    for (const driver of candidates) {
      for (const vehicle of driver.vehicles) {
        let score = 0;
        const reasons: string[] = [];

        // Check vehicle type
        if (vehicleRequirements?.vehicleType?.length) {
          const vehicleTypeMap: Record<string, string> = {
            'sprinter': 'SPRINTER',
            'koffer': 'KOEFFER',
            'curtainsider': 'CURTAINSIDER',
            'plane': 'PLANE'
          };
          const requiredTypes = vehicleRequirements.vehicleType.map(
            (t: string) => vehicleTypeMap[t] || t.toUpperCase()
          );
          if (!requiredTypes.includes(vehicle.vehicleType)) continue;
          score += 25;
          reasons.push('Fahrzeugtyp passt');
        }

        // Check payload
        if (vehicleRequirements?.minPayload_kg) {
          if ((vehicle.maxWeightKg || 0) < vehicleRequirements.minPayload_kg) continue;
          score += 10;
        }

        // Check volume
        if (vehicleRequirements?.minVolume_m3) {
          if ((vehicle.volumeM3 || 0) < vehicleRequirements.minVolume_m3) continue;
          score += 10;
        }

        // Check ADR
        if (vehicleRequirements?.adrRequired) {
          if (!vehicle.adrCertified) continue;
          score += 15;
          reasons.push('ADR-zertifiziert');
        }

        // Check cooling
        if (vehicleRequirements?.coolingRequired) {
          if (!vehicle.hasCooling) continue;
          score += 15;
          reasons.push('Kühlung verfügbar');
        }

        // Check international
        if (isInternational) {
          // Check country permissions
          const allowedCountries = driver.driverPermissions
            .filter(p => p.isAllowed)
            .map(p => p.countryCode);
          
          if (!allowedCountries.includes(transport.deliveryCountry)) continue;
          
          // Check transit countries
          if (internationalRequirements?.transitCountries) {
            const transitOk = internationalRequirements.transitCountries.every(
              (c: string) => allowedCountries.includes(c)
            );
            if (!transitOk) continue;
          }
          score += 20;
          reasons.push('Internationale Genehmigung');
        }

        // Add driver score bonuses
        if (driver.rating >= 4.5) {
          score += 10;
          reasons.push('Top Bewertung');
        }

        if (driver.completedTransports >= 50) {
          score += 5;
          reasons.push('Erfahrener Fahrer');
        }

        // Language match
        const spokenLanguages = driver.spokenLanguages ? JSON.parse(driver.spokenLanguages) : [];
        if (driverRequirements?.languages?.length) {
          const hasLang = driverRequirements.languages.some((l: string) => spokenLanguages.includes(l));
          if (hasLang) {
            score += 10;
            reasons.push('Sprachkenntnisse');
          }
        }

        matchedCandidates.push({
          driverId: driver.id,
          vehicleId: vehicle.id,
          score: Math.min(100, score),
          reasons
        });
      }
    }

    // Sort by score
    matchedCandidates.sort((a, b) => b.score - a.score);

    // ========== PHASE 3: STORE RESULTS ==========

    const matchingResults = matchedCandidates.slice(0, 50);

    for (const candidate of matchingResults) {
      await prisma.matchingResult.create({
        data: {
          id: `mr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          transportId: body.transportId,
          driverId: candidate.driverId,
          matchScore: candidate.score,
          matchReasons: JSON.stringify(candidate.reasons),
          matchType: isInternational ? 'INTERNATIONAL' : 'REGIONAL',
          vehicleMatch: true,
          driverMatch: true,
          routeMatch: true,
          internationalMatch: isInternational,
          countryPermissionsOk: isInternational,
          documentsOk: true,
          tunnelCodesOk: true,
          languageMatch: candidate.reasons.includes('Sprachkenntnisse'),
          experienceBonus: candidate.reasons.includes('Erfahrener Fahrer') ? 5 : 0,
          ratingBonus: candidate.reasons.includes('Top Bewertung') ? 10 : 0,
          returnLoadBonus: 0,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + (body.expireInMinutes || 60) * 60 * 1000)
        }
      }).catch(() => {});
    }

    // Update transport status
    await prisma.transport.update({
      where: { id: body.transportId },
      data: { status: 'PUBLISHED' }
    });

    // ========== PHASE 4: AUTO-ASSIGN IF ENABLED ==========
    
    let assigned = false;
    if (body.autoAssign && matchingResults.length > 0 && matchingResults[0].score >= 80) {
      const bestMatch = matchingResults[0];
      
      // Assign driver
      await prisma.transport.update({
        where: { id: body.transportId },
        data: {
          driverId: bestMatch.driverId,
          status: 'CONFIRMED',
          acceptedAt: new Date()
        }
      });

      // Update matching result
      await prisma.matchingResult.updateMany({
        where: {
          transportId: body.transportId,
          driverId: bestMatch.driverId
        },
        data: { status: 'ACCEPTED' }
      });

      assigned = true;
    }

    return NextResponse.json<StartMatchingResponse>({
      matchingId,
      status: matchedCandidates.length > 0 ? 'started' : 'no_candidates',
      estimatedCandidates: matchedCandidates.length,
      estimatedCompletion: new Date(Date.now() + 30000).toISOString()
    }, { status: 200 });

  } catch (error) {
    console.error('Start matching error:', error);
    return NextResponse.json<ApiErrorResponse>({
      error: 'InternalServerError',
      message: 'Failed to start matching',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
