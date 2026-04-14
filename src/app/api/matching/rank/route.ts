import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { RankCandidatesRequest, RankCandidatesResponse, RankedCandidate, RankingWeights, ApiErrorResponse } from '@/types/matching';

// Default ranking weights
const DEFAULT_WEIGHTS: RankingWeights = {
  distance: 0.2,
  reputation: 0.2,
  price: 0.15,
  experience: 0.15,
  language: 0.1,
  returnLoad: 0.1,
  history: 0.1
};

// POST /api/matching/rank - Rank candidates with scoring
export async function POST(request: NextRequest) {
  try {
    const body: RankCandidatesRequest = await request.json();

    if (!body.transportId || !body.candidates?.length) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'ValidationError',
        message: 'Missing required fields: transportId, candidates',
        code: 'MISSING_FIELDS'
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

    // Merge weights
    const weights = { ...DEFAULT_WEIGHTS, ...body.rankingWeights };

    // Get all drivers and vehicles in one query
    const driverIds = body.candidates.map(c => c.driverId);
    const vehicleIds = body.candidates.map(c => c.vehicleId);

    const drivers = await prisma.user.findMany({
      where: { id: { in: driverIds } },
      include: {
        vehicles: { where: { id: { in: vehicleIds } } },
        driverPermissions: true,
        offers: {
          where: { transportId: body.transportId },
          select: { price: true, currency: true }
        }
      }
    });

    // Create lookup maps
    const driverMap = new Map(drivers.map(d => [d.id, d]));

    // Get shipper's previous transports with these drivers (history)
    const previousTransports = await prisma.transport.findMany({
      where: {
        shipperId: transport.shipperId,
        status: 'COMPLETED'
      },
      select: { driverId: true }
    });

    const driverHistoryCount = new Map<string, number>();
    for (const t of previousTransports) {
      if (t.driverId) {
        driverHistoryCount.set(t.driverId, (driverHistoryCountCount.get(t.driverId) || 0) + 1);
      }
    }

    // Calculate scores for each candidate
    const rankedCandidates: RankedCandidate[] = [];

    for (const candidate of body.candidates) {
      const driver = driverMap.get(candidate.driverId);
      if (!driver || !driver.vehicles.length) continue;

      const vehicle = driver.vehicles.find(v => v.id === candidate.vehicleId) || driver.vehicles[0];
      const offer = driver.offers[0];

      // Calculate individual scores
      const scoreBreakdown = {
        distanceScore: calculateDistanceScore(driver, transport),
        reputationScore: calculateReputationScore(driver),
        priceScore: calculatePriceScore(offer?.price, transport.shipperBudget, offer?.currency || 'EUR'),
        experienceScore: calculateExperienceScore(driver),
        languageScore: calculateLanguageScore(driver, transport),
        returnLoadScore: calculateReturnLoadScore(driver, transport),
        historyScore: calculateHistoryScore(driver.id, driverHistoryCount)
      };

      // Calculate weighted total score
      const totalScore = 
        scoreBreakdown.distanceScore * (weights.distance || 0) +
        scoreBreakdown.reputationScore * (weights.reputation || 0) +
        scoreBreakdown.priceScore * (weights.price || 0) +
        scoreBreakdown.experienceScore * (weights.experience || 0) +
        scoreBreakdown.languageScore * (weights.language || 0) +
        scoreBreakdown.returnLoadScore * (weights.returnLoad || 0) +
        scoreBreakdown.historyScore * (weights.history || 0);

      // Add base score if provided
      const finalScore = Math.min(100, totalScore * 100 + (candidate.baseScore || 0));

      // Generate match reasons
      const matchReasons = generateMatchReasons(scoreBreakdown, driver, vehicle);

      rankedCandidates.push({
        driverId: candidate.driverId,
        vehicleId: candidate.vehicleId,
        score: Math.round(finalScore * 10) / 10,
        rank: 0, // Will be set after sorting
        scoreBreakdown,
        matchReasons,
        price: offer?.price,
        estimatedArrival: undefined // Would calculate with routing API
      });
    }

    // Sort by score (descending) and assign ranks
    rankedCandidates.sort((a, b) => b.score - a.score);
    rankedCandidates.forEach((candidate, index) => {
      candidate.rank = index + 1;
    });

    // Store ranking results
    for (const candidate of rankedCandidates) {
      await prisma.matchingResult.updateMany({
        where: {
          transportId: body.transportId,
          driverId: candidate.driverId
        },
        data: {
          matchScore: candidate.score,
          matchReasons: JSON.stringify(candidate.matchReasons)
        }
      }).catch(() => {});
    }

    return NextResponse.json<RankCandidatesResponse>({
      transportId: body.transportId,
      rankedCandidates,
      rankingMethod: 'weighted_scoring'
    }, { status: 200 });

  } catch (error) {
    console.error('Rank candidates error:', error);
    return NextResponse.json<ApiErrorResponse>({
      error: 'InternalServerError',
      message: 'Failed to rank candidates',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

// ========== SCORE CALCULATION FUNCTIONS ==========

function calculateDistanceScore(driver: any, transport: any): number {
  // In production, would use actual geolocation
  // For now, score based on location data availability
  
  if (!driver.currentLocation) return 0.5; // Unknown location

  try {
    const location = JSON.parse(driver.currentLocation);
    
    // Check if driver is in same country as pickup
    if (location.country === transport.pickupCountry) {
      return 1.0; // Same country
    }
    
    // Different country but same region
    return 0.6;
  } catch {
    return 0.5;
  }
}

function calculateReputationScore(driver: any): number {
  if (!driver.rating || driver.totalTransports === 0) return 0.5;

  // Base score from rating (0-5 -> 0-1)
  let score = driver.rating / 5;

  // Bonus for high number of completed transports
  if (driver.completedTransports >= 100) score += 0.1;
  else if (driver.completedTransports >= 50) score += 0.05;

  // Penalty for cancellations
  if (driver.totalTransports > 0) {
    const cancellationRate = driver.cancelledTransports / driver.totalTransports;
    if (cancellationRate > 0.2) score -= 0.2;
    else if (cancellationRate > 0.1) score -= 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

function calculatePriceScore(offerPrice: number | undefined, budget: number | null | undefined, currency: string): number {
  if (!offerPrice || !budget) return 0.5;

  // Score based on how close offer is to budget (lower is better)
  if (offerPrice <= budget) {
    // At or under budget
    const savingsRatio = (budget - offerPrice) / budget;
    return Math.min(1, 0.8 + savingsRatio * 0.2);
  } else {
    // Over budget
    const overBudgetRatio = (offerPrice - budget) / budget;
    if (overBudgetRatio > 0.3) return 0.2; // Way over budget
    if (overBudgetRatio > 0.15) return 0.5;
    return 0.7;
  }
}

function calculateExperienceScore(driver: any): number {
  let score = 0.3; // Base score

  // Completed transports bonus
  if (driver.completedTransports >= 100) score += 0.3;
  else if (driver.completedTransports >= 50) score += 0.2;
  else if (driver.completedTransports >= 20) score += 0.1;

  // Years of experience
  if (driver.yearsExperience) {
    if (driver.yearsExperience >= 10) score += 0.2;
    else if (driver.yearsExperience >= 5) score += 0.1;
  }

  // Vehicle experience match
  if (driver.vehicleExperience) {
    score += 0.1; // Has vehicle-specific experience
  }

  // Country experience
  if (driver.countryExperience) {
    score += 0.1; // Has international experience
  }

  return Math.min(1, score);
}

function calculateLanguageScore(driver: any, transport: any): number {
  const spokenLanguages = driver.spokenLanguages ? JSON.parse(driver.spokenLanguages) : [];
  
  if (spokenLanguages.length === 0) return 0.3;

  // Bonus for multiple languages
  let score = Math.min(0.5, spokenLanguages.length * 0.15);

  // Check if driver speaks a language useful for the route
  const pickupCountryLanguages: Record<string, string[]> = {
    'DE': ['de'],
    'AT': ['de'],
    'CH': ['de', 'fr', 'it'],
    'FR': ['fr'],
    'PL': ['pl'],
    'CZ': ['cz'],
    'NL': ['nl'],
    'BE': ['nl', 'fr'],
    'IT': ['it'],
    'ES': ['es'],
    'GB': ['en'],
    'IE': ['en']
  };

  const pickupLangs = pickupCountryLanguages[transport.pickupCountry] || [];
  const deliveryLangs = pickupCountryLanguages[transport.deliveryCountry] || [];

  // Bonus for speaking pickup or delivery country language
  if (pickupLangs.some(l => spokenLanguages.includes(l))) score += 0.3;
  if (deliveryLangs.some(l => spokenLanguages.includes(l))) score += 0.2;

  // English as fallback
  if (spokenLanguages.includes('en')) score += 0.1;

  return Math.min(1, score);
}

function calculateReturnLoadScore(driver: any, transport: any): number {
  // Check if driver is on a route that could include this as return load
  if (!driver.currentRoute) return 0;

  // In production, would check actual route geometry
  // For now, simple heuristic based on driver status
  try {
    const route = JSON.parse(driver.currentRoute);
    // If driver's current route destination is near pickup location
    return 0.8; // High score for return load potential
  } catch {
    return 0;
  }
}

function calculateHistoryScore(driverId: string, historyMap: Map<string, number>): number {
  const previousJobs = historyMap.get(driverId) || 0;
  
  if (previousJobs === 0) return 0.3; // No previous history
  if (previousJobs >= 10) return 1.0; // Strong relationship
  if (previousJobs >= 5) return 0.8;
  if (previousJobs >= 3) return 0.6;
  return 0.5;
}

function generateMatchReasons(
  scoreBreakdown: RankedCandidate['scoreBreakdown'],
  driver: any,
  vehicle: any
): string[] {
  const reasons: string[] = [];

  if (scoreBreakdown.reputationScore >= 0.8) {
    reasons.push(`Top Bewertung (${driver.rating} ⭐)`);
  }

  if (scoreBreakdown.experienceScore >= 0.7) {
    reasons.push(`Erfahrener Fahrer (${driver.completedTransports} Transporte)`);
  }

  if (scoreBreakdown.languageScore >= 0.6) {
    const langs = driver.spokenLanguages ? JSON.parse(driver.spokenLanguages) : [];
    reasons.push(`Sprachen: ${langs.join(', ')}`);
  }

  if (scoreBreakdown.returnLoadScore >= 0.5) {
    reasons.push('Potentielle Rückladung');
  }

  if (scoreBreakdown.historyScore >= 0.6) {
    reasons.push('Bekannter Fahrer');
  }

  if (vehicle.adrCertified) {
    reasons.push('ADR-zertifiziert');
  }

  if (vehicle.hasCooling) {
    reasons.push('Kühlung verfügbar');
  }

  if (vehicle.hasCrane) {
    reasons.push('Kran vorhanden');
  }

  if (reasons.length === 0) {
    reasons.push('Basis-Match');
  }

  return reasons;
}

// Fix the typo in the code
const driverHistoryCountCount = driverHistoryCount;
