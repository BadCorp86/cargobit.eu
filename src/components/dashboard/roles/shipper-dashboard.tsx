'use client';

import { PremiumRoleDashboard } from '@/components/dashboard/premium-role-dashboard';

interface ShipperDashboardProps {
  onLogout: () => void;
  onNewTransport: () => void;
}

export function ShipperDashboard({ onLogout, onNewTransport }: ShipperDashboardProps) {
  return (
    <PremiumRoleDashboard
      roleOverride="shipper"
      user={{
        firstName: 'Max',
        lastName: 'Müller',
        email: 'shipper@cargobit.eu',
        companyName: 'Müller Logistics GmbH',
        role: 'SHIPPER_COMPANY',
        accountType: 'SHIPPER',
        organizationRole: 'OWNER',
      }}
      onLogout={onLogout}
      onNewTransport={onNewTransport}
    />
  );
}
