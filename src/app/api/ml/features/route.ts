/**
 * CargoBit ML Feature Store API
 * POST /api/ml/features - Snapshot features for completed job
 * GET /api/ml/features - Export training data
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/admin-rbac';
import { mlFeatureStore } from '@/services/ml-featurestore.service';

// ============================================
// POST /api/ml/features
// ============================================

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const body = await request.json();
    const { jobId } = body as { jobId: string };
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }
    
    // Python: snapshot_features_for_job(...)
    const result = await mlFeatureStore.snapshotFeaturesForJob(jobId);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      featureId: result.featureId,
      label: result.label,
    });
  }, ['ADMIN']);
}

// ============================================
// GET /api/ml/features
// ============================================

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10000');
    
    // Check if stats requested
    if (searchParams.get('stats') === 'true') {
      const stats = await mlFeatureStore.getFeatureStatistics();
      return NextResponse.json(stats);
    }
    
    // Python: export_training_data(...)
    const exportData = await mlFeatureStore.exportTrainingData(limit);
    
    return NextResponse.json(exportData);
  }, ['ADMIN']);
}
