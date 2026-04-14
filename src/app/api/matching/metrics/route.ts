import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MatchingMetrics, ApiErrorResponse } from '@/types/matching';

// GET /api/matching/metrics - Get matching system metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get matching results in period
    const matchingResults = await prisma.matchingResult.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      select: {
        id: true,
        transportId: true,
        matchScore: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Get unique transports
    const transportIds = [...new Set(matchingResults.map(r => r.transportId))];
    
    // Get transports
    const transports = await prisma.transport.findMany({
      where: {
        id: { in: transportIds },
        createdAt: { gte: startDate }
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        completedAt: true,
        driverId: true
      }
    });

    // Get audit logs for fraud blocks
    const fraudBlocks = await prisma.auditLog.count({
      where: {
        action: 'FRAUD_BLOCK',
        createdAt: { gte: startDate }
      }
    });

    // Calculate metrics
    const totalMatchings = transportIds.length;
    
    const successfulMatchings = transports.filter(
      t => ['CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'].includes(t.status)
    ).length;

    // Calculate average matching time
    const matchingTimes: number[] = [];
    for (const transport of transports) {
      if (transport.driverId && transport.createdAt) {
        const acceptedResult = matchingResults.find(
          r => r.transportId === transport.id && r.status === 'ACCEPTED'
        );
        if (acceptedResult) {
          const time = new Date(acceptedResult.updatedAt).getTime() - 
                       new Date(transport.createdAt).getTime();
          matchingTimes.push(time / 1000); // seconds
        }
      }
    }
    const avgMatchingTime = matchingTimes.length > 0 
      ? matchingTimes.reduce((a, b) => a + b, 0) / matchingTimes.length 
      : 0;

    // Calculate average candidates per matching
    const candidatesPerTransport = new Map<string, number>();
    for (const result of matchingResults) {
      candidatesPerTransport.set(
        result.transportId, 
        (candidatesPerTransport.get(result.transportId) || 0) + 1
      );
    }
    const avgCandidatesPerMatching = candidatesPerTransport.size > 0
      ? [...candidatesPerTransport.values()].reduce((a, b) => a + b, 0) / candidatesPerTransport.size
      : 0;

    // Calculate average match score
    const scores = matchingResults.map(r => r.matchScore).filter(s => s > 0);
    const avgMatchScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    // International rejections
    const internationalRejections = matchingResults.filter(
      r => r.status === 'REJECTED' && r.matchType === 'INTERNATIONAL'
    ).length;

    // Auto assignments (from audit logs)
    const autoAssignments = await prisma.auditLog.count({
      where: {
        action: 'TRANSPORT_ASSIGNED',
        createdAt: { gte: startDate }
      }
    });

    // Calculate success rate
    const autoAssignmentSuccessRate = autoAssignments > 0
      ? successfulMatchings / autoAssignments
      : 0;

    // Get top rejection reasons
    const rejectionReasons = await prisma.offer.groupBy({
      by: ['rejectionReason'],
      where: {
        status: 'REJECTED',
        rejectionReason: { not: null },
        createdAt: { gte: startDate }
      },
      _count: true,
      orderBy: { _count: { rejectionReason: 'desc' } },
      take: 5
    });

    const topRejectionReasons = rejectionReasons
      .filter(r => r.rejectionReason)
      .map(r => ({
        reason: r.rejectionReason || 'Unknown',
        count: r._count
      }));

    return NextResponse.json<MatchingMetrics>({
      period,
      totalMatchings,
      successfulMatchings,
      avgMatchingTime: Math.round(avgMatchingTime),
      avgCandidatesPerMatching: Math.round(avgCandidatesPerMatching * 10) / 10,
      avgMatchScore: Math.round(avgMatchScore * 10) / 10,
      fraudBlocks,
      internationalRejections,
      autoAssignments,
      autoAssignmentSuccessRate: Math.round(autoAssignmentSuccessRate * 100) / 100,
      topRejectionReasons
    }, { status: 200 });

  } catch (error) {
    console.error('Get matching metrics error:', error);
    return NextResponse.json<ApiErrorResponse>({
      error: 'InternalServerError',
      message: 'Failed to get matching metrics',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
