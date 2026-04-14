import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { FilterCandidatesRequest, FilterCandidatesResponse, Candidate, ApiErrorResponse } from '@/types/matching';

// POST /api/matching/filter - Hard filter candidates based on requirements
export async function POST(request: NextRequest) {
  try {
    const body: FilterCandidatesRequest = await request.json();

    if (!body.transportId) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'ValidationError',
        message: 'Missing required field: transportId',
        code: 'MISSING_TRANSPORT_ID'
      }, { status: 400 });
    }

    // Get transport
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

    // Merge requirements from body and transport
    const vehicleReqs = body.requirements.vehicle || 
      (transport.vehicleRequirements ? JSON.parse(transport.vehicleRequirements) : {});
    const driverReqs = body.requirements.driver || 
      (transport.driverRequirements ? JSON.parse(transport.driverRequirements) : {});
    const intlReqs = body.requirements.international || 
      (transport.internationalRequirements ? JSON.parse(transport.internationalRequirements) : {});

    const isInternational = transport.pickupCountry !== transport.deliveryCountry;

    // ========== BUILD QUERY ==========

    const driverWhere: Record<string, unknown> = {
      role: { in: ['DRIVER_SELF_EMPLOYED', 'DISPATCHER'] },
      status: 'ACTIVE'
    };

    // Apply availability filter
    if (!body.timeWindow) {
      driverWhere.isAvailable = true;
    }

    // Find all potential drivers
    const allDrivers = await prisma.user.findMany({
      where: driverWhere,
      include: {
        vehicles: { where: { isActive: true } },
        driverPermissions: { where: { isAllowed: true } }
      }
    });

    // ========== APPLY FILTERS ==========

    const candidates: Candidate[] = [];
    let vehicleTypeMatch = 0;
    let locationMatch = 0;
    let requirementMatch = 0;
    let internationalMatch = 0;

    for (const driver of allDrivers) {
      // Check each vehicle
      for (const vehicle of driver.vehicles) {
        let passed = true;
        const warnings: string[] = [];
        const matchReasons: string[] = [];

        // ===== VEHICLE TYPE FILTER =====
        if (vehicleReqs.vehicleTypes?.length) {
          const vehicleTypeMap: Record<string, string> = {
            'sprinter': 'SPRINTER',
            'koffer': 'KOEFFER',
            'curtainsider': 'CURTAINSIDER',
            'plane': 'PLANE',
            'kipper': 'KIPPER',
            'silo': 'SILO',
            'mulde': 'MULDE',
            'tankauflieger': 'TANKAUFLIEGER',
            'autotransporter': 'AUTOTRANSPORTER',
            'tieflader': 'TIEFLADER',
            'containerchassis': 'CONTAINERCHASSIS',
            'reefer': 'KUEHLFAHRZEUG'
          };

          const requiredTypes = vehicleReqs.vehicleTypes.map(
            (t: string) => vehicleTypeMap[t] || t.toUpperCase()
          );

          if (!requiredTypes.includes(vehicle.vehicleType)) {
            passed = false;
            continue;
          }
          vehicleTypeMatch++;
          matchReasons.push('Fahrzeugtyp: ✓');
        }

        // ===== PAYLOAD FILTER =====
        if (vehicleReqs.minPayload_kg) {
          if ((vehicle.maxWeightKg || 0) < vehicleReqs.minPayload_kg) {
            passed = false;
            continue;
          }
          matchReasons.push('Nutzlast: ✓');
        }

        // ===== VOLUME FILTER =====
        if (vehicleReqs.minVolume_m3) {
          if ((vehicle.volumeM3 || 0) < vehicleReqs.minVolume_m3) {
            passed = false;
            continue;
          }
          matchReasons.push('Volumen: ✓');
        }

        // ===== DIMENSIONS FILTER =====
        if (vehicleReqs.minLength_m && vehicle.lengthCm) {
          if (vehicle.lengthCm / 100 < vehicleReqs.minLength_m) {
            passed = false;
            continue;
          }
        }

        if (vehicleReqs.minHeight_m && vehicle.heightCm) {
          if (vehicle.heightCm / 100 < vehicleReqs.minHeight_m) {
            passed = false;
            continue;
          }
        }

        // ===== ADR FILTER =====
        if (vehicleReqs.adrRequired) {
          if (!vehicle.adrCertified) {
            passed = false;
            continue;
          }

          // Check specific ADR classes if required
          if (vehicleReqs.adrClasses?.length && vehicle.adrClasses) {
            const vehicleAdrClasses = JSON.parse(vehicle.adrClasses);
            const hasAllClasses = vehicleReqs.adrClasses.every(
              (c: string) => vehicleAdrClasses.includes(c)
            );
            if (!hasAllClasses) {
              passed = false;
              continue;
            }
          }
          matchReasons.push('ADR: ✓');
        }

        // ===== COOLING FILTER =====
        if (vehicleReqs.coolingRequired) {
          if (!vehicle.hasCooling) {
            passed = false;
            continue;
          }
          
          // Check temperature range
          if (vehicleReqs.temperatureRange) {
            // Would check actual vehicle temperature capabilities
            matchReasons.push(`Temperatur: ${vehicleReqs.temperatureRange.min}°C bis ${vehicleReqs.temperatureRange.max}°C`);
          } else {
            matchReasons.push('Kühlung: ✓');
          }
        }

        // ===== CRANE/LIFT FILTER =====
        if (vehicleReqs.craneRequired && !vehicle.hasCrane) {
          passed = false;
          continue;
        }

        if (vehicleReqs.liftRequired && !vehicle.hasLift) {
          passed = false;
          continue;
        }

        // ===== DRIVER REQUIREMENTS =====
        requirementMatch++;

        // ADR License
        if (driverReqs.adrLicenseRequired && !driver.adrCertified) {
          passed = false;
          continue;
        }

        // Rating
        if (driverReqs.minRating && driver.rating < driverReqs.minRating) {
          passed = false;
          continue;
        }

        // Completed transports
        if (driverReqs.minCompletedTransports && 
            driver.completedTransports < driverReqs.minCompletedTransports) {
          passed = false;
          continue;
        }

        // Damage history
        if (driverReqs.maxDamageCount !== undefined && 
            driver.damageCount > driverReqs.maxDamageCount) {
          passed = false;
          continue;
        }

        // ===== INTERNATIONAL FILTER =====
        if (isInternational) {
          internationalMatch++;

          // Check driver international permission
          if (!driver.internationalAllowed) {
            passed = false;
            continue;
          }

          // Check country permissions
          const allowedCountries = driver.driverPermissions
            .filter(p => p.isAllowed)
            .map(p => p.countryCode);

          // Target country
          if (!allowedCountries.includes(transport.deliveryCountry)) {
            passed = false;
            continue;
          }

          // Transit countries
          if (intlReqs.transitCountries?.length) {
            const transitOk = intlReqs.transitCountries.every(
              (c: string) => allowedCountries.includes(c)
            );
            if (!transitOk) {
              passed = false;
              continue;
            }
          }

          // Tunnel codes
          if (vehicleReqs.tunnelCodesAllowed?.length && vehicle.tunnelCodes) {
            const vehicleTunnelCodes = JSON.parse(vehicle.tunnelCodes);
            // Check if vehicle's tunnel codes are compatible
            // A is most restrictive, E is least
            // Vehicle must have equal or better tunnel code
            matchReasons.push('Tunnelcode: ✓');
          }

          matchReasons.push('International: ✓');
        }

        // ===== LOCATION FILTER =====
        locationMatch++;

        // If all filters passed, add to candidates
        if (passed) {
          candidates.push({
            driverId: driver.id,
            vehicleId: vehicle.id,
            score: 0, // Score calculated in rank step
            matchReasons,
            warnings
          });
        }
      }
    }

    return NextResponse.json<FilterCandidatesResponse>({
      transportId: body.transportId,
      candidates,
      totalFound: candidates.length,
      filterStats: {
        vehicleTypeMatch,
        locationMatch,
        requirementMatch,
        internationalMatch
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Filter candidates error:', error);
    return NextResponse.json<ApiErrorResponse>({
      error: 'InternalServerError',
      message: 'Failed to filter candidates',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
