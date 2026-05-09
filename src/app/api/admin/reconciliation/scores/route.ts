/**
 * CargoBit Reconciliation Score API
 * Initiative 1: Data Product MVP - Reconciliation Score
 * 
 * GET /api/admin/reconciliation/scores - List scores with filtering
 * GET /api/admin/reconciliation/scores/statistics - Get score statistics
 * GET /api/admin/reconciliation/scores/[id] - Get specific score
 * POST /api/admin/reconciliation/scores/calculate - Calculate score for payout
 * POST /api/admin/reconciliation/scores/[id]/override - Override score
 */

import { NextRequest, NextResponse } from 'next/server';
import { reconciliationScoreService, ScoreLevel } from '@/services/reconciliation-score.service';
import { adminAuthGuard } from '@/lib/admin-auth';

// =============================================================================
// GET /api/admin/reconciliation/scores - List scores
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authResult = await adminAuthGuard(request);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '';

    // Route to specific endpoints
    if (path === 'statistics') {
      return handleGetStatistics(searchParams);
    }

    // Parse filters
    const minScore = searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!) : undefined;
    const maxScore = searchParams.get('maxScore') ? parseInt(searchParams.get('maxScore')!) : undefined;
    const scoreLevel = searchParams.get('scoreLevel') as ScoreLevel | null;
    const payoutId = searchParams.get('payoutId');
    const reconciliationRunId = searchParams.get('reconciliationRunId');
    const fromDate = searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')!) : undefined;
    const toDate = searchParams.get('toDate') ? new Date(searchParams.get('toDate')!) : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const withScore = searchParams.get('withScore') === 'true';

    // If specific payout ID requested
    if (payoutId && !searchParams.get('page')) {
      const score = await reconciliationScoreService.getScoreByPayoutId(payoutId);
      
      if (!score) {
        return NextResponse.json(
          { error: 'Score not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: score,
      });
    }

    // List scores with filters
    const filter = {
      minScore,
      maxScore,
      scoreLevel: scoreLevel || undefined,
      payoutId: payoutId || undefined,
      reconciliationRunId: reconciliationRunId || undefined,
      fromDate,
      toDate,
    };

    const result = await reconciliationScoreService.getScores(filter, page, limit);

    return NextResponse.json({
      success: true,
      data: result.scores,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
      withScore,
    });
  } catch (error) {
    console.error('Error fetching reconciliation scores:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/admin/reconciliation/scores - Calculate score
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await adminAuthGuard(request);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, payoutId, reconciliationRunId, batch, override, reason } = body;

    // Batch calculation for reconciliation run
    if (action === 'batch' && reconciliationRunId) {
      const result = await reconciliationScoreService.batchCalculateScores(reconciliationRunId);
      
      return NextResponse.json({
        success: true,
        message: `Processed ${result.processed} payouts`,
        data: {
          processed: result.processed,
          successCount: result.scores.length,
          errorCount: result.errors.length,
          errors: result.errors.slice(0, 10), // First 10 errors
        },
      });
    }

    // Single payout score calculation
    if (payoutId) {
      const score = await reconciliationScoreService.calculateScore({
        payoutId,
        reconciliationRunId,
        expectedAmountCents: body.expectedAmountCents ? BigInt(body.expectedAmountCents) : undefined,
        actualAmountCents: body.actualAmountCents ? BigInt(body.actualAmountCents) : undefined,
        expectedStatus: body.expectedStatus,
        actualStatus: body.actualStatus,
        reference: body.reference,
      });

      return NextResponse.json({
        success: true,
        data: score,
      }, { status: 201 });
    }

    // Override score
    if (action === 'override' && body.payoutId && body.newScore !== undefined) {
      const score = await reconciliationScoreService.overrideScore(
        body.payoutId,
        body.newScore,
        reason || 'Manual override',
        authResult.user?.id || 'unknown'
      );

      return NextResponse.json({
        success: true,
        data: score,
      });
    }

    return NextResponse.json(
      { error: 'Invalid request. Provide payoutId or reconciliationRunId.', code: 'INVALID_REQUEST' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error calculating reconciliation score:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// =============================================================================
// Helper: Get Statistics
// =============================================================================

async function handleGetStatistics(searchParams: URLSearchParams) {
  const filter = {
    fromDate: searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')!) : undefined,
    toDate: searchParams.get('toDate') ? new Date(searchParams.get('toDate')!) : undefined,
    reconciliationRunId: searchParams.get('reconciliationRunId') || undefined,
  };

  const statistics = await reconciliationScoreService.getStatistics(filter);

  return NextResponse.json({
    success: true,
    data: statistics,
  });
}
