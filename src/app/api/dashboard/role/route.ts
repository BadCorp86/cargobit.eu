import { NextRequest, NextResponse } from 'next/server';
import { getConnectedRoleDashboardData } from '@/services/role-dashboard.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const id = searchParams.get('id') || request.headers.get('x-user-id') || undefined;
    const firstName = searchParams.get('firstName') || undefined;
    const lastName = searchParams.get('lastName') || undefined;
    const companyName = searchParams.get('companyName') || undefined;
    const email = searchParams.get('email') || request.headers.get('x-user-email') || undefined;
    const userRole = searchParams.get('userRole') || role || undefined;
    const accountType = searchParams.get('accountType') || undefined;
    const organizationRole = searchParams.get('organizationRole') || undefined;

    const dashboard = await getConnectedRoleDashboardData(role, {
      id,
      firstName,
      lastName,
      companyName,
      email,
      accountType,
      organizationRole,
      role: userRole,
    });

    return NextResponse.json({
      success: true,
      data: dashboard.data,
      source: dashboard.source,
      connectedServices: dashboard.connectedServices,
      warning: dashboard.warning,
    });
  } catch (error) {
    console.error('[API] GET /api/dashboard/role error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load role dashboard data' },
      { status: 500 },
    );
  }
}
