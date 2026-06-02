/**
 * Setup 2FA
 * GET /api/admin/auth/2fa/setup
 * 
 * Returns: { secret, otpAuthUrl } - for QR code generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuthService } from '@/services/admin-auth.service';
import { withAdminAuth } from '@/lib/admin-rbac';

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (admin) => {
    if (admin.id === 'env-admin') {
      return NextResponse.json(
        {
          error: '2FA setup requires a database-backed admin user.',
          code: 'ENV_ADMIN_2FA_UNSUPPORTED',
        },
        { status: 400 },
      );
    }

    const result = await adminAuthService.setup2fa(admin.id);

    return NextResponse.json({
      success: true,
      secret: result.secret,
      otpAuthUrl: result.qrCodeUrl,
      qrCodeUrl: result.qrCodeUrl,
    });
  });
}
