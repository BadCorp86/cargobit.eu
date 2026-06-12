import { NextRequest } from 'next/server';
import { verifyAdminToken, type AdminUser } from '@/lib/admin-rbac';

export async function getOptionalAdmin(request: NextRequest): Promise<AdminUser | null> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cookieToken = request.cookies.get('admin_session')?.value || '';
  const token = bearerToken || cookieToken;

  if (!token) return null;

  return verifyAdminToken(token);
}
