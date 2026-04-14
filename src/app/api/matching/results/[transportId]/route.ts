import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MatchingResultsResponse, RankedCandidate, ApiErrorResponse } from '@/types/matching';

// GET /api/matching/results/[transportId] - Get matching results for a transport
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transportId: string }> }
) {
  try {
    const { transportId } = await params;

    // Get transport
    const transport = await prisma.transport.findUnique({
      where: { id: transportId },
      select: {
        id: true,
        status: true,
        createdAt: true
      }
    });

    if (!transport) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'NotFoundError',
        message: 'Transport not found',
        code: 'TRANSPORT_NOT_FOUND'
      }, { status: 404 });
    }

    // Get matching results
    const results = await prisma.matchingResult.findMany({
      where: { transportId },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            rating: true,
            completedTransports: true,
            spokenLanguages: true,
            adrCertified: true,
            phone: true
          }
        }
      },
      orderBy: { matchScore: 'desc' },
      take: 50
    });

    // Get offer prices for each candidate
    const offers = await prisma.offer.findMany({
      where: {
        transportId,
        status: 'PENDING'
      },
      select: {
        driverId: true,
        price: true,
        currency: true
      }
    });

    const offerMap = new Map(offers.map(o => [o.driverId, o]));

    // Transform to ranked candidates
    const candidates: RankedCandidate[] = results.map((result, index) => {
      const matchReasons = result.matchReasons ? JSON.parse(result.matchReasons) : [];
      const offer = offerMap.get(result.driverId);

      return {
        driverId: result.driverId,
        vehicleId: '',
        score: result.matchScore,
        rank: index + 1,
        scoreBreakdown: {
          distanceScore: result.distanceToPickup ? Math.max(0, 1 - (result.distanceToPickup / 1000)) : 0.5,
          reputationScore: result.driver.rating / 5,
          priceScore: offer ? 0.8 : 0.5,
          experienceScore: Math.min(1, result.driver.completedTransports / 100),
          languageScore: result.languageMatch ? 1 : 0.5,
          returnLoadScore: result.returnLoadBonus / 15,
          historyScore: result.experienceBonus / 10
        },
        matchReasons,
        price: offer?.price,
        estimatedArrival: undefined
      };
    });

    // Determine matching status
    let status: 'in_progress' | 'completed' | 'stopped' | 'no_candidates';
    if (candidates.length === 0) {
      status = 'no_candidates';
    } else if (results.some(r => r.status === 'ACCEPTED')) {
      status = 'completed';
    } else if (results.some(r => r.status === 'REJECTED')) {
      status = 'stopped';
    } else {
      status = 'in_progress';
    }

    const bestMatch = candidates.length > 0 ? candidates[0] : undefined;

    return NextResponse.json<MatchingResultsResponse>({
      transportId,
      matchingId: `match_${transportId}`,
      status,
      candidates,
      bestMatch,
      totalCandidates: candidates.length,
      matchingDuration: undefined,
      startedAt: transport.createdAt.toISOString(),
      completedAt: status === 'completed' ? new Date().toISOString() : undefined
    }, { status: 200 });

  } catch (error) {
    console.error('Get matching results error:', error);
    return NextResponse.json<ApiErrorResponse>({
      error: 'InternalServerError',
      message: 'Failed to get matching results',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
