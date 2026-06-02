import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const envAdminConfigured = Boolean(process.env.ADMIN_EMAIL?.trim() && process.env.ADMIN_PASSWORD);
  const jwtSecretConfigured = Boolean(process.env.ADMIN_JWT_SECRET?.trim());

  return NextResponse.json({
    success: true,
    configured: envAdminConfigured && jwtSecretConfigured,
    envAdminConfigured,
    jwtSecretConfigured,
  });
}
