/**
 * CargoBit Admin Login Step 1
 * 
 * POST /api/admin/auth/login-step1
 * 
 * Verify email and password, return if 2FA is required.
 * 
 * Python equivalent:
 * ```python
 * class AdminLoginRequest(BaseModel):
 *     email: str
 *     password: str
 * 
 * class AdminLoginStep1Response(BaseModel):
 *     requires_2fa: bool
 * 
 * @router.post("/admin/login_step1", response_model=AdminLoginStep1Response)
 * def admin_login_step1(req: AdminLoginRequest, db: Session = Depends(get_db)):
 *     user = get_admin_by_email(db, req.email)
 *     if not user or not verify_password(req.password, user.password_hash):
 *         raise HTTPException(401, "Invalid credentials")
 *     return {"requires_2fa": user.is_2fa_enabled}
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuthService } from '@/services/admin-auth.service';

// ============================================
// TYPES
// ============================================

interface LoginStep1Request {
  email: string;
  password: string;
}

// ============================================
// POST: LOGIN STEP 1
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: LoginStep1Request = await request.json();
    const { email, password } = body;
    
    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-Mail und Passwort erforderlich' },
        { status: 400 }
      );
    }
    
    // Get client IP
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || 'unknown';
    
    // Process login step 1
    const result = await adminAuthService.loginStep1(email, password, ipAddress);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }
    
    // Return response
    return NextResponse.json({
      requires2fa: result.data.requires2fa,
      email: result.data.email,
    });
    
  } catch (error) {
    console.error('[AdminLogin] Step 1 error:', error);
    return NextResponse.json(
      { error: 'Interner Server-Fehler' },
      { status: 500 }
    );
  }
}
