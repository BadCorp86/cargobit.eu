/**
 * Stripe Key Management
 * GET /api/admin/stripe-key - Get key status
 * POST /api/admin/stripe-key - Save active key
 */

import { NextRequest, NextResponse } from 'next/server';
import { secretsService } from '@/services/secrets.service';
import { AdminRole, withAdminAuth } from '@/lib/admin-rbac';

/**
 * Get Stripe key status
 */
export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const status = await secretsService.getStripeKeyStatus();

    return NextResponse.json({
      success: true,
      ...status,
    });
  }, [AdminRole.ADMIN]);
}

/**
 * Save Stripe key directly to active slot
 * Used for initial setup
 */
export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (admin) => {
    const body = await request.json();
    const { key } = body;

    if (!key || !key.startsWith('sk_')) {
      return NextResponse.json(
        { error: 'Invalid Stripe key format. Key should start with "sk_"' },
        { status: 400 }
      );
    }

    // Store as active key
    await secretsService.storeSecret(
      'stripe_secret_key_active',
      key,
      admin.id
    );

    return NextResponse.json({
      success: true,
      message: 'Stripe key saved successfully',
    });
  }, [AdminRole.ADMIN]);
}
