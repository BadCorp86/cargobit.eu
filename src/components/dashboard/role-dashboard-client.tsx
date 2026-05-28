'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PremiumRoleDashboard } from '@/components/dashboard/premium-role-dashboard';
import { useAuthStore, type User } from '@/lib/auth-store';
import type { DashboardRole, RoleDashboardUser } from '@/lib/role-dashboard-data';

interface RoleDashboardClientProps {
  roleOverride: DashboardRole;
  fallbackUser: RoleDashboardUser;
}

export function RoleDashboardClient({
  roleOverride,
  fallbackUser,
}: RoleDashboardClientProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const dashboardUser = useMemo(
    () => (isAuthenticated && user ? toRoleDashboardUser(user) : fallbackUser),
    [fallbackUser, isAuthenticated, user],
  );

  const handleLogout = () => {
    logout();
    router.replace('/preview');
  };

  return (
    <PremiumRoleDashboard
      roleOverride={roleOverride}
      user={dashboardUser}
      onLogout={handleLogout}
    />
  );
}

function toRoleDashboardUser(user: User): RoleDashboardUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    companyName: user.companyName,
    role: user.role,
    accountType: user.accountType,
    organizationRole: user.organizationRole,
  };
}
