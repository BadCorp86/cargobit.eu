'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/admin/data-table';
import { FilterBar } from '@/components/admin/filter-bar';
import { StatusBadge } from '@/components/admin/status-badge';

type AdminTransportStatus =
  | 'CREATED'
  | 'PUBLISHED'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'PICKUP_DONE'
  | 'DELIVERY_DONE'
  | 'COMPLETED'
  | 'CANCELLED';

interface AdminTransport {
  id: string;
  status: AdminTransportStatus;
  transportType: string;
  route: {
    pickup: { city: string; country: string };
    delivery: { city: string; country: string };
  };
  schedule: {
    pickupDatetime: string;
    deliveryDatetime?: string | null;
  };
  shipper: {
    email: string;
    name: string;
  };
  driver?: {
    email: string;
    name: string;
  } | null;
  price: {
    budget?: number | null;
    agreed?: number | null;
    currency: string;
  };
  cargo: {
    weightKg?: number | null;
    volumeM3?: number | null;
    isHazmat: boolean;
    isFragile: boolean;
  };
  operational: {
    pendingOffers: number;
    matchingSessions: number;
    trackingPoints: number;
    documents: number;
    latestStatusNote?: string | null;
    latestStatusAt?: string | null;
  };
  updatedAt: string;
}

interface TransportResponse {
  transports: AdminTransport[];
  summary: {
    total: number;
    active: number;
    completed: number;
    podPending: number;
    offerPending: number;
  };
}

const DEMO_TRANSPORTS: AdminTransport[] = [
  {
    id: 'mission_demo_hh_muc',
    status: 'DELIVERY_DONE',
    transportType: 'PALLET',
    route: {
      pickup: { city: 'Hamburg', country: 'DE' },
      delivery: { city: 'München', country: 'DE' },
    },
    schedule: {
      pickupDatetime: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
      deliveryDatetime: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    shipper: { email: 'shipper@cargobit.eu', name: 'Demo Verlader' },
    driver: { email: 'driver@cargobit.eu', name: 'Demo Fahrer' },
    price: { budget: 850, agreed: 850, currency: 'EUR' },
    cargo: { weightKg: 2500, volumeM3: 12, isHazmat: false, isFragile: true },
    operational: {
      pendingOffers: 0,
      matchingSessions: 2,
      trackingPoints: 8,
      documents: 1,
      latestStatusNote: 'POD/eCMR wartet auf Prüfung.',
      latestStatusAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 'transport_demo_ber_par',
    status: 'IN_TRANSIT',
    transportType: 'COOLING',
    route: {
      pickup: { city: 'Berlin', country: 'DE' },
      delivery: { city: 'Paris', country: 'FR' },
    },
    schedule: {
      pickupDatetime: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      deliveryDatetime: new Date(Date.now() + 1000 * 60 * 60 * 14).toISOString(),
    },
    shipper: { email: 'kunde@example.com', name: 'Frischehandel GmbH' },
    driver: { email: 'carrier@example.com', name: 'Carrier Demo' },
    price: { budget: 1260, agreed: 1190, currency: 'EUR' },
    cargo: { weightKg: 1100, volumeM3: 7, isHazmat: false, isFragile: false },
    operational: {
      pendingOffers: 0,
      matchingSessions: 1,
      trackingPoints: 14,
      documents: 0,
      latestStatusNote: 'Temperaturtracking aktiv.',
      latestStatusAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    },
    updatedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: 'transport_demo_col_ams',
    status: 'PUBLISHED',
    transportType: 'OVERSIZE',
    route: {
      pickup: { city: 'Köln', country: 'DE' },
      delivery: { city: 'Amsterdam', country: 'NL' },
    },
    schedule: {
      pickupDatetime: new Date(Date.now() + 1000 * 60 * 60 * 22).toISOString(),
      deliveryDatetime: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
    },
    shipper: { email: 'industrie@example.com', name: 'Industrie Kunde' },
    driver: null,
    price: { budget: 980, agreed: null, currency: 'EUR' },
    cargo: { weightKg: 4200, volumeM3: 18, isHazmat: false, isFragile: false },
    operational: {
      pendingOffers: 4,
      matchingSessions: 1,
      trackingPoints: 0,
      documents: 0,
      latestStatusNote: 'Angebote werden gesammelt.',
      latestStatusAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
];

function formatCurrency(amount: number | null | undefined, currency: string) {
  if (amount == null) return '-';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusForBadge(status: string) {
  return status.toLowerCase();
}

function buildSummary(items: AdminTransport[]): TransportResponse['summary'] {
  return {
    total: items.length,
    active: items.filter((item) => ['PUBLISHED', 'ASSIGNED', 'IN_TRANSIT', 'PICKUP_DONE', 'DELIVERY_DONE'].includes(item.status)).length,
    completed: items.filter((item) => item.status === 'COMPLETED').length,
    podPending: items.filter((item) => item.status === 'DELIVERY_DONE' && item.operational.documents === 0).length,
    offerPending: items.reduce((sum, item) => sum + item.operational.pendingOffers, 0),
  };
}

export default function AdminTransportsPage() {
  const [items, setItems] = useState<AdminTransport[]>([]);
  const [summary, setSummary] = useState<TransportResponse['summary']>(buildSummary(DEMO_TRANSPORTS));
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const loadTransports = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filters.status) params.set('status', filters.status);
      if (filters.type) params.set('type', filters.type);

      const response = await fetch(`/api/admin/transports?${params.toString()}`);
      if (!response.ok) throw new Error('Admin transports API unavailable');

      const payload = await response.json() as TransportResponse;
      setItems(payload.transports || []);
      setSummary(payload.summary || buildSummary(payload.transports || []));
    } catch (error) {
      console.error('Failed to load admin transports:', error);
      setItems(DEMO_TRANSPORTS);
      setSummary(buildSummary(DEMO_TRANSPORTS));
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.type, searchQuery]);

  useEffect(() => {
    loadTransports();
  }, [loadTransports]);

  const columns = useMemo<Column<AdminTransport>[]>(() => [
    {
      key: 'route',
      header: 'Transport',
      render: (row) => (
        <div className="max-w-sm">
          <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{row.id}</div>
          <div className="mt-1 font-semibold text-gray-900 dark:text-white">
            {row.route.pickup.city}, {row.route.pickup.country} → {row.route.delivery.city}, {row.route.delivery.country}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {row.transportType} · {row.cargo.weightKg ? `${row.cargo.weightKg.toLocaleString('de-DE')} kg` : 'Gewicht offen'}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={statusForBadge(row.status)} size="sm" />,
    },
    {
      key: 'participants',
      header: 'Parteien',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{row.shipper.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.shipper.email}</p>
          {row.driver ? (
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">Fahrer: {row.driver.name}</p>
          ) : (
            <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-300">Noch nicht zugewiesen</p>
          )}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Preis',
      render: (row) => (
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatCurrency(row.price.agreed || row.price.budget, row.price.currency)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Budget: {formatCurrency(row.price.budget, row.price.currency)}
          </p>
        </div>
      ),
    },
    {
      key: 'operations',
      header: 'Ops',
      render: (row) => (
        <div className="flex min-w-[180px] flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
            {row.operational.pendingOffers} Angebote
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
            {row.operational.documents} Docs
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
            {row.operational.trackingPoints} Tracking
          </span>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Zeitfenster',
      render: (row) => (
        <div>
          <p className="text-sm text-gray-900 dark:text-white">{formatDate(row.schedule.pickupDatetime)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Lieferung: {formatDate(row.schedule.deliveryDatetime)}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Aktion',
      render: (row) => (
        <Link
          href={`/orders/${row.id}`}
          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-200"
        >
          Details
        </Link>
      ),
    },
  ], []);

  const filterOptions = [
    {
      name: 'status',
      label: 'Status',
      options: [
        { value: 'CREATED', label: 'Erstellt' },
        { value: 'PUBLISHED', label: 'Veröffentlicht' },
        { value: 'ASSIGNED', label: 'Zugewiesen' },
        { value: 'IN_TRANSIT', label: 'Unterwegs' },
        { value: 'DELIVERY_DONE', label: 'Geliefert/POD offen' },
        { value: 'COMPLETED', label: 'Abgeschlossen' },
        { value: 'CANCELLED', label: 'Storniert' },
      ],
    },
    {
      name: 'type',
      label: 'Frachtart',
      options: [
        { value: 'PALLET', label: 'Paletten' },
        { value: 'COOLING', label: 'Kühltransport' },
        { value: 'OVERSIZE', label: 'Übergröße' },
        { value: 'HAZMAT', label: 'Gefahrgut' },
        { value: 'CAR_TRANSPORT', label: 'Fahrzeugtransport' },
        { value: 'CONTAINER', label: 'Container' },
      ],
    },
  ];

  return (
    <DashboardLayout title="Transporte" subtitle="Live-Überwachung aktiver Transporte, Statusereignisse und operativer Risiken">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ['Gesamt', summary.total, 'text-white'],
            ['Aktiv', summary.active, 'text-[#8BC5FF]'],
            ['Abgeschlossen', summary.completed, 'text-[#9EF2BC]'],
            ['POD offen', summary.podPending, 'text-[#FFD28A]'],
            ['Offene Angebote', summary.offerPending, 'text-[#8BEFFF]'],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
              <p className="text-sm text-white/55">{label}</p>
              <p className={`mt-3 text-3xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <FilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          searchPlaceholder="Transport-ID, Route, Verlader oder Beschreibung suchen..."
          filters={filterOptions}
        />

        <DataTable
          columns={columns}
          data={items}
          keyField="id"
          loading={loading}
          emptyMessage="Keine Transporte gefunden"
          pageSize={10}
        />
      </div>
    </DashboardLayout>
  );
}
