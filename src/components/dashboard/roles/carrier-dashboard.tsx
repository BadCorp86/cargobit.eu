'use client';

import { PremiumRoleDashboard } from '@/components/dashboard/premium-role-dashboard';

interface CarrierDashboardProps {
  onLogout: () => void;
}

export function CarrierDashboard({ onLogout }: CarrierDashboardProps) {
  return (
    <PremiumRoleDashboard
      roleOverride="carrier"
      user={{
        firstName: 'Anna',
        lastName: 'Schmidt',
        email: 'carrier@cargobit.eu',
        companyName: 'Schmidt Spedition',
        role: 'CARRIER',
        accountType: 'CARRIER_COMPANY',
        organizationRole: 'OWNER',
      }}
      onLogout={onLogout}
    />
  );
}
