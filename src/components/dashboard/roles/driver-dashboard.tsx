'use client';

import { PremiumRoleDashboard } from '@/components/dashboard/premium-role-dashboard';

interface DriverDashboardProps {
  onLogout: () => void;
}

export function DriverDashboard({ onLogout }: DriverDashboardProps) {
  return (
    <PremiumRoleDashboard
      roleOverride="driver"
      user={{
        firstName: 'Thomas',
        lastName: 'Weber',
        email: 'driver@cargobit.eu',
        role: 'DRIVER_SELF_EMPLOYED',
        accountType: 'TRANSPORT_SOLO',
        organizationRole: 'OWNER_DRIVER',
      }}
      onLogout={onLogout}
    />
  );
}
