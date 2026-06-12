import { NextRequest, NextResponse } from 'next/server';
import { getConnectedRoleDashboardData } from '@/services/role-dashboard.service';
import { getOptionalRequestUser } from '@/lib/request-user-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const requestUser = await getOptionalRequestUser(request);
    const requestedId = searchParams.get('id') || undefined;
    if (requestedId && (!requestUser || requestUser.id !== requestedId)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: requestUser ? 403 : 401 },
      );
    }

    const id = requestedId || requestUser?.id || undefined;
    const firstName = searchParams.get('firstName') || undefined;
    const lastName = searchParams.get('lastName') || undefined;
    const companyName = searchParams.get('companyName') || undefined;
    const email = searchParams.get('email') || requestUser?.email || undefined;
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
