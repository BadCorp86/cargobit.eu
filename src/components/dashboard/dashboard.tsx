'use client';

import { PremiumRoleDashboard } from '@/components/dashboard/premium-role-dashboard';
import { useAuthStore } from '@/lib/auth-store';

interface DashboardProps {
  onLogout: () => void;
  onNewTransport: () => void;
}

export function Dashboard({ onLogout, onNewTransport }: DashboardProps) {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <PremiumRoleDashboard
      user={user}
      onLogout={onLogout}
      onNewTransport={onNewTransport}
    />
  );
}
