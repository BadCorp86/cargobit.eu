'use client';

/**
 * CargoBit Modern Admin Dashboard
 * Modular Component Architecture
 * 
 * Premium SaaS Design - Stripe/Uber/Linear Style
 * Dark Mode Only with Neon Glow Effects
 */

import React, { useEffect, useState } from 'react';
import { Euro, Route, ShieldCheck, TriangleAlert, UsersRound } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { KpiCard, KpiGrid } from '@/components/kpi/KpiCard';
import EuropeMap from '@/components/map/EuropeMap';
import RevenueChart from '@/components/analytics/RevenueChart';
import TransportStatusChart from '@/components/analytics/TransportStatusChart';
import ActivityFeed from '@/components/activity/ActivityFeed';
import SystemStatus from '@/components/system/SystemStatus';
import QuickActions from '@/components/system/QuickActions';
import UserDistributionChart from '@/components/users/UserDistributionChart';

// ============================================
// TYPES
// ============================================

interface DashboardStats {
  payments: {
    total: number;
    succeeded: number;
    pending: number;
    failed: number;
    totalAmountCents: number;
    refundedAmountCents: number;
  };
  disputes: {
    open: number;
    inProgress: number;
    resolved: number;
    totalRefunded: number;
  };
  users: {
    total: number;
    active: number;
    pending: number;
    blocked: number;
    newToday: number;
  };
  jobs: {
    total: number;
    active: number;
    completed: number;
    cancelled: number;
  };
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_STATS: DashboardStats = {
  payments: {
    total: 1247,
    succeeded: 1189,
    pending: 42,
    failed: 16,
    totalAmountCents: 18975000,
    refundedAmountCents: 450000,
  },
  disputes: {
    open: 8,
    inProgress: 12,
    resolved: 156,
    totalRefunded: 23000,
  },
  users: {
    total: 12458,
    active: 8934,
    pending: 412,
    blocked: 153,
    newToday: 23,
  },
  jobs: {
    total: 3842,
    active: 1842,
    completed: 1256,
    cancelled: 216,
  },
};

// ============================================
// MAIN DASHBOARD PAGE
// ============================================

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        } else {
          setStats(MOCK_STATS);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
        setStats(MOCK_STATS);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  // KPI Card Data
  const kpiCards = [
    {
      title: 'Benutzer gesamt',
      value: stats?.users.total.toLocaleString() || '0',
      change: 12.5,
      changeLabel: '+23 heute',
      icon: <UsersRound className="h-6 w-6" />,
      color: 'blue' as const,
      miniChartData: [36, 44, 48, 52, 58, 63, 61, 68, 72, 78, 83, 88],
    },
    {
      title: 'Aktive Transporte',
      value: stats?.jobs.active.toLocaleString() || '0',
      change: 8.2,
      changeLabel: '1,842 derzeit unterwegs',
      icon: <Route className="h-6 w-6" />,
      color: 'green' as const,
      miniChartData: [54, 49, 57, 62, 56, 70, 75, 68, 80, 84, 77, 89],
    },
    {
      title: 'Umsatz (Monat)',
      value: formatCurrency(stats?.payments.totalAmountCents || 0),
      change: 23.6,
      changeLabel: 'vs. letzter Monat',
      icon: <Euro className="h-6 w-6" />,
      color: 'cyan' as const,
      miniChartData: [40, 46, 44, 57, 52, 64, 68, 72, 69, 82, 87, 92],
    },
    {
      title: 'Ausstehende Verifizierungen',
      value: '47',
      change: -5.2,
      changeLabel: '5 heute bearbeitet',
      icon: <ShieldCheck className="h-6 w-6" />,
      color: 'yellow' as const,
      miniChartData: [82, 76, 73, 68, 62, 58, 51, 48, 43, 39, 34, 30],
    },
    {
      title: 'Offene Streitfälle',
      value: stats?.disputes.open || '0',
      change: -15,
      changeLabel: '2 heute gelöst',
      icon: <TriangleAlert className="h-6 w-6" />,
      color: 'red' as const,
      miniChartData: [78, 68, 72, 60, 54, 48, 42, 40, 36, 30, 25, 20],
    },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-32">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#1C7ED6] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-3 h-3 rounded-full bg-[#00D4FF] animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-3 h-3 rounded-full bg-[#1C7ED6] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Admin Dashboard" subtitle="Übersicht aller Systeme und Aktivitäten">
      <div className="space-y-6">
        {/* KPI Cards */}
        <KpiGrid columns={5}>
          {kpiCards.map((kpi, i) => (
            <KpiCard key={i} delay={i * 0.06} {...kpi} />
          ))}
        </KpiGrid>

        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0 space-y-6">
            <EuropeMap />
            <RevenueChart />
            <ActivityFeed />
          </div>

          <aside className="min-w-0 space-y-6">
            <QuickActions />
            <SystemStatus />
            <TransportStatusChart />
            <UserDistributionChart />
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
