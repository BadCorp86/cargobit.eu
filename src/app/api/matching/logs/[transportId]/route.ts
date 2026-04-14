import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MatchingLogsResponse, MatchingLog, ApiErrorResponse } from '@/types/matching';

// GET /api/matching/logs/[transportId] - Get matching logs for debugging
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transportId: string }> }
) {
  try {
    const { transportId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get audit logs for this transport
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: transportId },
          { newValue: { contains: transportId } }
        ],
        action: { contains: 'MATCH' }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Get matching results for this transport
    const matchingResults = await prisma.matchingResult.findMany({
      where: { transportId },
      orderBy: { createdAt: 'desc' },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Transform to matching logs
    const logs: MatchingLog[] = [];

    // Add audit logs
    for (const log of auditLogs) {
      let metadata = {};
      try {
        metadata = log.newValue ? JSON.parse(log.newValue) : {};
      } catch { /* ignore */ }
      
      logs.push({
        id: log.id,
        matchingId: `match_${transportId}`,
        transportId,
        event: log.action,
        timestamp: log.createdAt.toISOString(),
        metadata
      });
    }

    // Add matching result events
    for (const result of matchingResults) {
      logs.push({
        id: result.id,
        matchingId: `match_${transportId}`,
        transportId,
        event: `MATCH_FOUND_${result.status}`,
        timestamp: result.createdAt.toISOString(),
        score: result.matchScore,
        candidatesFound: 1,
        metadata: {
          driverId: result.driverId,
          driverName: `${result.driver.firstName || ''} ${result.driver.lastName || ''}`.trim(),
          matchType: result.matchType,
          score: result.matchScore
        }
      });

      if (result.status === 'ACCEPTED') {
        logs.push({
          id: `${result.id}_accepted`,
          matchingId: `match_${transportId}`,
          transportId,
          event: 'DRIVER_ACCEPTED',
          timestamp: result.updatedAt.toISOString(),
          score: result.matchScore,
          metadata: { driverId: result.driverId }
        });
      }

      if (result.status === 'REJECTED') {
        logs.push({
          id: `${result.id}_rejected`,
          matchingId: `match_${transportId}`,
          transportId,
          event: 'DRIVER_REJECTED',
          timestamp: result.updatedAt.toISOString(),
          metadata: { driverId: result.driverId }
        });
      }
    }

    // Sort by timestamp (most recent first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json<MatchingLogsResponse>({
      transportId,
      logs: logs.slice(0, limit),
      total: logs.length
    }, { status: 200 });

  } catch (error) {
    console.error('Get matching logs error:', error);
    return NextResponse.json<ApiErrorResponse>({
      error: 'InternalServerError',
      message: 'Failed to get matching logs',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
