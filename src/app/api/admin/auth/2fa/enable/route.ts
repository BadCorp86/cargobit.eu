/**
 * Enable 2FA
 * POST /api/admin/auth/2fa/enable
 * 
 * Body: { code }
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuthService } from '@/services/admin-auth.service';
import { withAdminAuth } from '@/lib/admin-rbac';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      );
    }

    const success = await adminAuthService.enable2fa(admin.id, code);

    if (!success) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '2FA has been enabled for your account',
    });
  });
}
