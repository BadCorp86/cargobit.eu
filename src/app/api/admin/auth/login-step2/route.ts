/**
 * CargoBit Admin Login Step 2
 * 
 * POST /api/admin/auth/login-step2
 * 
 * Verify 2FA code and return JWT token.
 * 
 * Python equivalent:
 * ```python
 * class AdminLoginStep2Request(BaseModel):
 *     email: str
 *     code: str
 * 
 * class AdminLoginTokenResponse(BaseModel):
 *     access_token: str
 *     token_type: str = "bearer"
 * 
 * @router.post("/admin/login_step2", response_model=AdminLoginTokenResponse)
 * def admin_login_step2(req: AdminLoginStep2Request, db: Session = Depends(get_db)):
 *     user = get_admin_by_email(db, req.email)
 *     if not user or not user.is_2fa_enabled:
 *         raise HTTPException(401, "Invalid")
 *     
 *     if not verify_totp(user.totp_secret, req.code):
 *         raise HTTPException(401, "Invalid 2FA code")
 *     
 *     token = create_admin_jwt({"sub": str(user.id), "role": user.role})
 *     return AdminLoginTokenResponse(access_token=token)
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuthService } from '@/services/admin-auth.service';
import * as jwt from 'jsonwebtoken';

// ============================================
// TYPES
// ============================================

interface LoginStep2Request {
  email: string;
  code: string;
}

// ============================================
// CONFIGURATION
// ============================================

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'cargobit-admin-secret-change-in-production';

// ============================================
// POST: LOGIN STEP 2
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: LoginStep2Request = await request.json();
    const { email, code } = body;
    
    // Validate input
    if (!email || !code) {
      return NextResponse.json(
        { error: 'E-Mail und 2FA-Code erforderlich' },
        { status: 400 }
      );
    }
    
    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;
    
    // Process login step 2
    const result = await adminAuthService.loginStep2(email, code, ipAddress, userAgent);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }
    
    // Set HTTP-only cookie for session
    const response = NextResponse.json({
      accessToken: result.data.accessToken,
      tokenType: result.data.tokenType,
      expiresIn: result.data.expiresIn,
      admin: result.data.admin,
    });
    
    // Set secure cookie
    response.cookies.set('admin_session', result.data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: result.data.expiresIn,
      path: '/',
    });
    
    return response;
    
  } catch (error) {
    console.error('[AdminLogin] Step 2 error:', error);
    return NextResponse.json(
      { error: 'Interner Server-Fehler' },
      { status: 500 }
    );
  }
}
