// ============================================
// CARGOBIT MATCHING SERVICE
// GET /api/matching/jobs/:jobId/matches
// Heuristic matching: Region + Capacity + Rating
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================
// MATCHING ALGORITHM
// ============================================
interface JobRequirements {
  weightKg: number;
  volumeM3?: number;
  originRegion: string;
  destinationRegion: string;
  vehicleType?: string;
  hasCooling?: boolean;
  isInternational?: boolean;
}

interface MatchedTransporter {
  id: string;
  userId: string;
  companyName: string;
  vehicleType: string;
  capacityKg: number;
  regionFrom: string;
  regionTo: string[];
  rating: number;
  completedTransports: number;
  score: number;
  scoreBreakdown: {
    regionMatch: number;
    capacityFit: number;
    rating: number;
    experience: number;
  };
}

async function matchTransportersForJob(
  job: JobRequirements
): Promise<MatchedTransporter[]> {
  // Step 1: Hard filters
  const candidates = await db.driver.findMany({
    where: {
      isAvailable: true,
      company: {
        status: 'ACTIVE',
      },
      user: {
        status: 'ACTIVE',
      },
    },
    include: {
      company: true,
      user: true,
      driverVehicles: {
        include: {
          vehicle: true,
        },
      },
    },
  });

  // Step 2: Filter by capacity
  const filteredByCapacity = candidates.filter(driver => {
    const vehicles = driver.driverVehicles.map(dv => dv.vehicle);
    return vehicles.some(v => 
      (v.maxPayloadKg || 0) >= job.weightKg &&
      v.status === 'ACTIVE'
    );
  });

  // Step 3: Score and rank
  const scored: MatchedTransporter[] = [];

  for (const driver of filteredByCapacity) {
    const vehicle = driver.driverVehicles[0]?.vehicle;
    if (!vehicle) continue;

    let score = 0;
    const scoreBreakdown = {
      regionMatch: 0,
      capacityFit: 0,
      rating: 0,
      experience: 0,
    };

    // Region match (50 points max)
    const driverRegionFrom = driver.company?.addresses?.[0]?.state || '';
    const driverRegionTo = driver.countryExperience 
      ? JSON.parse(driver.countryExperience) 
      : [];
    
    if (driverRegionFrom === job.originRegion) {
      scoreBreakdown.regionMatch += 25;
    }
    
    if (job.destinationRegion && 
        (driverRegionTo.includes(job.destinationRegion) || 
         driverRegionTo.includes('ALL'))) {
      scoreBreakdown.regionMatch += 25;
    }

    // Capacity fit (30 points max)
    const capacityRatio = job.weightKg / (vehicle.maxPayloadKg || 1);
    scoreBreakdown.capacityFit = Math.min(capacityRatio, 1) * 30;

    // Rating (15 points max)
    scoreBreakdown.rating = (driver.ratingAvg || 3) * 3;

    // Experience (15 points max)
    const expRatio = Math.min(driver.completedTransports / 100, 1);
    scoreBreakdown.experience = expRatio * 15;

    score = scoreBreakdown.regionMatch + 
            scoreBreakdown.capacityFit + 
            scoreBreakdown.rating + 
            scoreBreakdown.experience;

    // International bonus
    if (job.isInternational && driver.internationalExperience) {
      score += 10;
    }

    // Cooling bonus
    if (job.hasCooling && vehicle.coolingAvailable) {
      score += 10;
    }

    scored.push({
      id: driver.id,
      userId: driver.userId,
      companyName: driver.company?.name || 'Unbekannt',
      vehicleType: vehicle.type,
      capacityKg: vehicle.maxPayloadKg || 0,
      regionFrom: driverRegionFrom,
      regionTo: driverRegionTo,
      rating: driver.ratingAvg || 0,
      completedTransports: driver.completedTransports,
      score,
      scoreBreakdown,
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return top 10
  return scored.slice(0, 10);
}

// ============================================
// GET /api/matching/jobs/:jobId/matches
// ============================================
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    // Get job details
    const transport = await db.transport.findUnique({
      where: { id: jobId },
      include: {
        pickupAddress: true,
        deliveryAddress: true,
        transportDetail: true,
      },
    });

    if (!transport) {
      return NextResponse.json({
        error: 'NotFound',
        message: 'Transport/Auftrag nicht gefunden',
      }, { status: 404 });
    }

    // Build job requirements
    const job: JobRequirements = {
      weightKg: transport.transportDetail?.weightKg || 0,
      volumeM3: transport.transportDetail?.volumeM3 || 0,
      originRegion: transport.pickupAddress?.state || '',
      destinationRegion: transport.deliveryAddress?.state || '',
      hasCooling: transport.transportDetail?.detailsJson?.includes('cooling'),
      isInternational: transport.isInternational,
    };

    // Get matches
    const matches = await matchTransportersForJob(job);

    return NextResponse.json({
      success: true,
      jobId,
      jobRequirements: {
        weight: `${job.weightKg} kg`,
        volume: job.volumeM3 ? `${job.volumeM3} m³` : 'N/A',
        route: `${job.originRegion} → ${job.destinationRegion}`,
        cooling: job.hasCooling ? 'Required' : 'Not required',
        international: job.isInternational ? 'Yes' : 'No',
      },
      matches,
      totalCandidates: matches.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[MATCHING] Error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler beim Matching',
    }, { status: 500 });
  }
}
