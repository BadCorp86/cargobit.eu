'use client';

import { PremiumRoleDashboard } from '@/components/dashboard/premium-role-dashboard';

interface DispatcherDashboardProps {
  dispatcherId?: string;
  tenantId?: string;
  onSuggestionAccept?: (suggestionId: string) => void;
  onSuggestionReject?: (suggestionId: string) => void;
}

export default function DispatcherDashboard(_props: DispatcherDashboardProps) {
  return (
    <PremiumRoleDashboard
      roleOverride="dispatcher"
      user={{
        firstName: 'Anna',
        lastName: 'Schmidt',
        email: 'dispatcher@cargobit.eu',
        companyName: 'Schmidt Spedition',
        role: 'DISPATCHER',
        accountType: 'CARRIER_COMPANY',
        organizationRole: 'DISPATCHER',
      }}
    />
  );
}
