'use client';

/**
 * CargoBit Modern Admin Dashboard
 * Modular Component Architecture
 * 
 * Premium SaaS Design - Stripe/Uber/Linear Style
 * Dark Mode Only with Neon Glow Effects
 */

import React, { useEffect, useState } from 'react';
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
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      color: 'blue' as const,
    },
    {
      title: 'Aktive Transporte',
      value: stats?.jobs.active.toLocaleString() || '0',
      change: 8.2,
      changeLabel: '1,842 derzeit unterwegs',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      color: 'green' as const,
    },
    {
      title: 'Umsatz (Monat)',
      value: formatCurrency(stats?.payments.totalAmountCents || 0),
      change: 23.6,
      changeLabel: 'vs. letzter Monat',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      color: 'purple' as const,
    },
    {
      title: 'Ausstehende Verifizierungen',
      value: '47',
      change: -5.2,
      changeLabel: '5 heute bearbeitet',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
      color: 'yellow' as const,
    },
    {
      title: 'Offene Streitfälle',
      value: stats?.disputes.open || '0',
      change: -15,
      changeLabel: '2 heute gelöst',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      color: 'red' as const,
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
            <KpiCard key={i} {...kpi} />
          ))}
        </KpiGrid>

        {/* Main Grid - Map & Analytics */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Map */}
          <div className="xl:col-span-2">
            <EuropeMap />
          </div>
          
          {/* Revenue Chart */}
          <div className="xl:col-span-1">
            <RevenueChart />
          </div>
        </div>

        {/* Bottom Grid - Activity, Status, Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed */}
          <ActivityFeed />

          {/* Transport Status */}
          <TransportStatusChart />

          {/* User Distribution */}
          <UserDistributionChart />
        </div>

        {/* Quick Actions & System Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QuickActions />
          <SystemStatus />
        </div>
      </div>
    </DashboardLayout>
  );
}
