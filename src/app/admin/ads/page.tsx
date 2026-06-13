'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DataTable, type Column } from '@/components/admin/data-table';
import { FilterBar } from '@/components/admin/filter-bar';
import { StatusBadge } from '@/components/admin/status-badge';

type CampaignStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

interface AdminAdCampaign {
  id: string;
  name: string;
  description?: string | null;
  slot: string;
  bannerUrl?: string | null;
  bannerAlt?: string | null;
  targetUrl: string;
  callToAction?: string | null;
  budgetEur: number;
  spentEur: number;
  remainingBudgetEur: number;
  pricingModel: string;
  cpcEur?: number | null;
  cpmEur?: number | null;
  status: CampaignStatus;
  startDate?: string | null;
  endDate?: string | null;
  totalImpressions: number;
  totalClicks: number;
  ctr: number;
  updatedAt: string;
  partner?: {
    id: string;
    name: string;
    contactEmail: string;
    status: string;
  } | null;
}

interface AdsResponse {
  items: AdminAdCampaign[];
  summary?: {
    total: number;
    pending: number;
    active: number;
    paused: number;
    spentEur: number;
    clicks: number;
    impressions: number;
  };
}

const EMPTY_SUMMARY = {
  total: 0,
  pending: 0,
  active: 0,
  paused: 0,
  spentEur: 0,
  clicks: 0,
  impressions: 0,
};

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

function formatPercent(value?: number | null) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function slotLabel(slot: string) {
  const labels: Record<string, string> = {
    MARKETPLACE_BANNER: 'Homepage Banner',
    MARKETPLACE_SIDEBAR: 'Sidebar',
    LISTING_HIGHLIGHT: 'Gesponserter Auftrag',
    CHECKOUT_UPSELL: 'Checkout Upsell',
    EMAIL_SPONSOR: 'E-Mail Sponsor',
  };
  return labels[slot] || slot;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: 'Entwurf',
    PENDING: 'Prüfung',
    ACTIVE: 'Aktiv',
    PAUSED: 'Pausiert',
    COMPLETED: 'Abgeschlossen',
  };
  return labels[status] || status;
}

export default function AdminAdsPage() {
  const [items, setItems] = useState<AdminAdCampaign[]>([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filters.status) params.set('status', filters.status);
      if (filters.slot) params.set('slot', filters.slot);

      const response = await fetch(`/api/admin/ads?${params.toString()}`);
      const payload = await response.json().catch(() => null) as AdsResponse | { error?: string } | null;

      if (!response.ok || !payload || !('items' in payload)) {
        throw new Error(payload && 'error' in payload ? payload.error : 'Werbe-API nicht verfügbar');
      }

      setItems(payload.items || []);
      setSummary(payload.summary || EMPTY_SUMMARY);
    } catch (error) {
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      setErrorMessage(error instanceof Error ? error.message : 'Werbekampagnen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [filters.slot, filters.status, searchQuery]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const updateCampaign = useCallback(async (campaign: AdminAdCampaign, action: 'approve' | 'pause' | 'reject') => {
    setActionLoading(`${campaign.id}:${action}`);

    try {
      const response = await fetch(`/api/admin/ads/${encodeURIComponent(campaign.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: action === 'reject' ? 'Kampagne im Admin Review abgelehnt.' : undefined,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Kampagne konnte nicht aktualisiert werden.');
      }

      await loadCampaigns();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Kampagne konnte nicht aktualisiert werden.');
    } finally {
      setActionLoading(null);
    }
  }, [loadCampaigns]);

  const columns = useMemo<Column<AdminAdCampaign>[]>(() => [
    {
      key: 'name',
      header: 'Kampagne',
      render: (row) => (
        <div className="max-w-md">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{row.name}</p>
          <p className="mt-1 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{row.targetUrl}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{slotLabel(row.slot)}</span>
            <span>{row.pricingModel}</span>
            <span>CPC {formatMoney(row.cpcEur)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'partner',
      header: 'Partner',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{row.partner?.name || '-'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.partner?.contactEmail || '-'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status.toLowerCase()} size="sm" className="capitalize" />,
    },
    {
      key: 'budget',
      header: 'Budget',
      render: (row) => (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <p>{formatMoney(row.spentEur)} / {formatMoney(row.budgetEur)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Rest {formatMoney(row.remainingBudgetEur)}</p>
        </div>
      ),
    },
    {
      key: 'performance',
      header: 'Performance',
      render: (row) => (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <p>{row.totalClicks.toLocaleString('de-DE')} Klicks</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {row.totalImpressions.toLocaleString('de-DE')} Views · CTR {formatPercent(row.ctr)}
          </p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Aktionen',
      render: (row) => (
        <div className="flex min-w-[250px] flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateCampaign(row, 'approve')}
            disabled={Boolean(actionLoading) || row.status === 'ACTIVE'}
            className="rounded-lg border border-[#2ECC71]/25 bg-[#2ECC71]/10 px-3 py-1.5 text-xs font-semibold text-[#9EF2BC] hover:bg-[#2ECC71]/18 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Freigeben
          </button>
          <button
            type="button"
            onClick={() => updateCampaign(row, 'pause')}
            disabled={Boolean(actionLoading) || row.status === 'PAUSED'}
            className="rounded-lg border border-[#F39C12]/25 bg-[#F39C12]/10 px-3 py-1.5 text-xs font-semibold text-[#FFD28A] hover:bg-[#F39C12]/18 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Pausieren
          </button>
          <button
            type="button"
            onClick={() => updateCampaign(row, 'reject')}
            disabled={Boolean(actionLoading) || row.status === 'PAUSED'}
            className="rounded-lg border border-[#E74C3C]/25 bg-[#E74C3C]/10 px-3 py-1.5 text-xs font-semibold text-[#FF8D8D] hover:bg-[#E74C3C]/18 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ablehnen
          </button>
        </div>
      ),
    },
  ], [actionLoading, updateCampaign]);

  const filterOptions = [
    {
      name: 'status',
      label: 'Status',
      options: [
        { value: 'DRAFT', label: statusLabel('DRAFT') },
        { value: 'PENDING', label: statusLabel('PENDING') },
        { value: 'ACTIVE', label: statusLabel('ACTIVE') },
        { value: 'PAUSED', label: statusLabel('PAUSED') },
        { value: 'COMPLETED', label: statusLabel('COMPLETED') },
      ],
    },
    {
      name: 'slot',
      label: 'Platzierung',
      options: [
        { value: 'MARKETPLACE_BANNER', label: slotLabel('MARKETPLACE_BANNER') },
        { value: 'MARKETPLACE_SIDEBAR', label: slotLabel('MARKETPLACE_SIDEBAR') },
        { value: 'LISTING_HIGHLIGHT', label: slotLabel('LISTING_HIGHLIGHT') },
        { value: 'CHECKOUT_UPSELL', label: slotLabel('CHECKOUT_UPSELL') },
        { value: 'EMAIL_SPONSOR', label: slotLabel('EMAIL_SPONSOR') },
      ],
    },
  ];

  return (
    <DashboardLayout title="Werbung" subtitle="Partner-Kampagnen prüfen, freigeben und CPC-Ausgaben kontrollieren">
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={loadCampaigns}
            className="rounded-xl border border-[#00D4FF]/25 bg-[#00D4FF]/10 px-4 py-2 text-sm font-semibold text-[#00D4FF] transition hover:bg-[#00D4FF]/15"
          >
            Aktualisieren
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Prüfung', summary.pending, 'text-[#FFD28A]'],
            ['Aktiv', summary.active, 'text-[#9EF2BC]'],
            ['Pausiert', summary.paused, 'text-[#FF8D8D]'],
            ['Spend', formatMoney(summary.spentEur), 'text-[#8BC5FF]'],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
              <p className="text-sm text-white/55">{label}</p>
              <p className={`mt-3 text-3xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
            <p className="text-sm text-white/55">Impressionen</p>
            <p className="mt-3 text-2xl font-semibold text-white">{summary.impressions.toLocaleString('de-DE')}</p>
          </div>
          <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
            <p className="text-sm text-white/55">Klicks</p>
            <p className="mt-3 text-2xl font-semibold text-white">{summary.clicks.toLocaleString('de-DE')}</p>
          </div>
          <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
            <p className="text-sm text-white/55">Beta-Regel</p>
            <p className="mt-3 text-sm font-semibold text-white">CPC · Admin-Freigabe erforderlich · Anzeige-Kennzeichnung aktiv</p>
          </div>
        </div>

        <FilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          searchPlaceholder="Kampagne, Partner oder Ziel-URL suchen..."
          filters={filterOptions}
        />

        {errorMessage ? (
          <div className="rounded-[18px] border border-[#E74C3C]/20 bg-[#E74C3C]/10 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
            <p className="text-sm font-semibold text-[#FF8D8D]">Werbekampagnen konnten nicht geladen werden.</p>
            <p className="mt-2 text-sm text-white/55">{errorMessage}</p>
            <button
              type="button"
              onClick={loadCampaigns}
              className="mt-5 rounded-xl border border-[#00D4FF]/25 bg-[#00D4FF]/10 px-4 py-2 text-sm font-semibold text-[#00D4FF] transition hover:bg-[#00D4FF]/15"
            >
              Erneut laden
            </button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={items}
            keyField="id"
            loading={loading}
            emptyMessage="Noch keine Werbekampagnen vorhanden"
            pageSize={8}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

