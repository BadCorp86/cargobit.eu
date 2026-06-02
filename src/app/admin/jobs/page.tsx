'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/admin/data-table';
import { FilterBar } from '@/components/admin/filter-bar';
import { StatusBadge } from '@/components/admin/status-badge';

type AdminJobStatus =
  | 'CREATED'
  | 'PUBLISHED'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'PICKUP_DONE'
  | 'DELIVERY_DONE'
  | 'COMPLETED'
  | 'CANCELLED';

interface AdminJob {
  id: string;
  status: AdminJobStatus;
  transportType: string;
  description?: string | null;
  route: {
    pickup: { city: string; country: string; label: string };
    delivery: { city: string; country: string; label: string };
    distanceKm?: number | null;
    isInternational: boolean;
    customsRequired: boolean;
  };
  schedule: {
    pickupDatetime: string;
    deliveryDatetime?: string | null;
    publishedAt?: string | null;
    assignedAt?: string | null;
    completedAt?: string | null;
    cancelledAt?: string | null;
  };
  shipper?: {
    id: string;
    email: string;
    name: string;
  } | null;
  transporter?: {
    driver?: {
      id: string;
      email: string;
      name: string;
    } | null;
    vehicle?: {
      id: string;
      plateNumber: string;
      type: string;
    } | null;
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
    specialRequirements?: string | null;
  };
  operational: {
    offersTotal: number;
    pendingOffers: number;
    acceptedOfferId?: string | null;
    matchingSessions: number;
    documents: number;
    podDocuments: number;
    invoiceDocuments: number;
    latestStatusNote?: string | null;
    latestStatusAt?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface JobsResponse {
  jobs: AdminJob[];
  summary: {
    total: number;
    drafts: number;
    published: number;
    active: number;
    podOpen: number;
    invoiceOpen: number;
    completed: number;
  };
}

const DEMO_JOBS: AdminJob[] = [
  {
    id: 'mission_demo_hh_muc',
    status: 'DELIVERY_DONE',
    transportType: 'PALLET',
    description: '10 Europaletten mit Elektronik-Komponenten',
    route: {
      pickup: { city: 'Hamburg', country: 'DE', label: 'Hamburg, DE' },
      delivery: { city: 'München', country: 'DE', label: 'München, DE' },
      distanceKm: 790,
      isInternational: false,
      customsRequired: false,
    },
    schedule: {
      pickupDatetime: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
      deliveryDatetime: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString(),
      assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    },
    shipper: { id: 'shipper_demo', email: 'shipper@cargobit.eu', name: 'Demo Verlader' },
    transporter: {
      driver: { id: 'driver_demo', email: 'driver@cargobit.eu', name: 'Demo Fahrer' },
      vehicle: { id: 'vehicle_demo', plateNumber: 'HH-CB 2401', type: 'CURTAINSIDER' },
    },
    price: { budget: 850, agreed: 850, currency: 'EUR' },
    cargo: { weightKg: 2500, volumeM3: 12, isHazmat: false, isFragile: true, specialRequirements: 'Trocken lagern' },
    operational: {
      offersTotal: 3,
      pendingOffers: 0,
      acceptedOfferId: 'offer_demo_1',
      matchingSessions: 2,
      documents: 1,
      podDocuments: 1,
      invoiceDocuments: 0,
      latestStatusNote: 'POD/eCMR liegt vor, Rechnung offen.',
      latestStatusAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: 'job_demo_ber_par',
    status: 'IN_TRANSIT',
    transportType: 'COOLING',
    description: 'Temperaturgeführte Ware',
    route: {
      pickup: { city: 'Berlin', country: 'DE', label: 'Berlin, DE' },
      delivery: { city: 'Paris', country: 'FR', label: 'Paris, FR' },
      distanceKm: 1050,
      isInternational: true,
      customsRequired: false,
    },
    schedule: {
      pickupDatetime: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      deliveryDatetime: new Date(Date.now() + 1000 * 60 * 60 * 14).toISOString(),
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
      assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    },
    shipper: { id: 'shipper_fresh', email: 'frische@example.com', name: 'Frischehandel GmbH' },
    transporter: {
      driver: { id: 'driver_alina', email: 'alina.driver@cargobit.eu', name: 'Alina Weber' },
      vehicle: { id: 'veh_reefer', plateNumber: 'B-CB 8802', type: 'REEFER' },
    },
    price: { budget: 1260, agreed: 1190, currency: 'EUR' },
    cargo: { weightKg: 1100, volumeM3: 7, isHazmat: false, isFragile: false, specialRequirements: 'Kühlkette dokumentieren' },
    operational: {
      offersTotal: 4,
      pendingOffers: 0,
      acceptedOfferId: 'offer_demo_2',
      matchingSessions: 1,
      documents: 0,
      podDocuments: 0,
      invoiceDocuments: 0,
      latestStatusNote: 'Unterwegs, Temperaturtracking aktiv.',
      latestStatusAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 32).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: 'job_demo_col_ams',
    status: 'PUBLISHED',
    transportType: 'OVERSIZE',
    description: 'Maschinenteil mit Übergröße',
    route: {
      pickup: { city: 'Köln', country: 'DE', label: 'Köln, DE' },
      delivery: { city: 'Amsterdam', country: 'NL', label: 'Amsterdam, NL' },
      distanceKm: 265,
      isInternational: true,
      customsRequired: false,
    },
    schedule: {
      pickupDatetime: new Date(Date.now() + 1000 * 60 * 60 * 22).toISOString(),
      deliveryDatetime: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
      publishedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    shipper: { id: 'shipper_industry', email: 'industrie@example.com', name: 'Industrie Kunde' },
    transporter: null,
    price: { budget: 980, agreed: null, currency: 'EUR' },
    cargo: { weightKg: 4200, volumeM3: 18, isHazmat: false, isFragile: false, specialRequirements: 'Tieflader bevorzugt' },
    operational: {
      offersTotal: 4,
      pendingOffers: 4,
      acceptedOfferId: null,
      matchingSessions: 1,
      documents: 0,
      podDocuments: 0,
      invoiceDocuments: 0,
      latestStatusNote: 'Angebote werden gesammelt.',
      latestStatusAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'job_demo_draft_1',
    status: 'CREATED',
    transportType: 'PALLET',
    description: 'Wallet-Aufladung erforderlich',
    route: {
      pickup: { city: 'Frankfurt', country: 'DE', label: 'Frankfurt, DE' },
      delivery: { city: 'Wien', country: 'AT', label: 'Wien, AT' },
      distanceKm: 720,
      isInternational: true,
      customsRequired: false,
    },
    schedule: {
      pickupDatetime: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      deliveryDatetime: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
    },
    shipper: { id: 'shipper_pending', email: 'pending@example.com', name: 'Wallet Pending GmbH' },
    transporter: null,
    price: { budget: 740, agreed: null, currency: 'EUR' },
    cargo: { weightKg: 1800, volumeM3: 9, isHazmat: false, isFragile: false, specialRequirements: null },
    operational: {
      offersTotal: 0,
      pendingOffers: 0,
      acceptedOfferId: null,
      matchingSessions: 0,
      documents: 0,
      podDocuments: 0,
      invoiceDocuments: 0,
      latestStatusNote: 'Entwurf wartet auf Wallet-Reservierung.',
      latestStatusAt: null,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
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

function formatNumber(value?: number | null, suffix = '') {
  if (value == null) return '-';
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

function statusForBadge(status: string) {
  return status.toLowerCase();
}

function transportTypeLabel(type: string) {
  const labels: Record<string, string> = {
    PALLET: 'Paletten',
    BULK: 'Schüttgut',
    LIQUID: 'Flüssig',
    OVERSIZE: 'Übergröße',
    LOWLOADER: 'Tieflader',
    CAR_TRANSPORT: 'Fahrzeugtransport',
    COOLING: 'Kühltransport',
    HAZMAT: 'Gefahrgut',
    CONTAINER: 'Container',
  };

  return labels[type] || type;
}

function buildSummary(items: AdminJob[]): JobsResponse['summary'] {
  return {
    total: items.length,
    drafts: items.filter((item) => item.status === 'CREATED').length,
    published: items.filter((item) => item.status === 'PUBLISHED').length,
    active: items.filter((item) => ['ASSIGNED', 'IN_TRANSIT', 'PICKUP_DONE', 'DELIVERY_DONE'].includes(item.status)).length,
    podOpen: items.filter((item) => item.status === 'DELIVERY_DONE' && item.operational.podDocuments === 0).length,
    invoiceOpen: items.filter((item) => ['DELIVERY_DONE', 'COMPLETED'].includes(item.status) && item.operational.invoiceDocuments === 0).length,
    completed: items.filter((item) => item.status === 'COMPLETED').length,
  };
}

function SmallPill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'blue' | 'green' | 'yellow' | 'red' | 'gray' }) {
  const classes = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-200',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  };

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes[tone]}`}>
      {children}
    </span>
  );
}

export default function AdminJobsPage() {
  const [items, setItems] = useState<AdminJob[]>([]);
  const [summary, setSummary] = useState<JobsResponse['summary']>(buildSummary(DEMO_JOBS));
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const loadJobs = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filters.status) params.set('status', filters.status);
      if (filters.type) params.set('type', filters.type);

      const response = await fetch(`/api/admin/jobs?${params.toString()}`);
      if (!response.ok) throw new Error('Admin jobs API unavailable');

      const payload = await response.json() as JobsResponse;
      setItems(payload.jobs || []);
      setSummary(payload.summary || buildSummary(payload.jobs || []));
    } catch (error) {
      console.error('Failed to load admin jobs:', error);
      setItems(DEMO_JOBS);
      setSummary(buildSummary(DEMO_JOBS));
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.type, searchQuery]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const columns = useMemo<Column<AdminJob>[]>(() => [
    {
      key: 'job',
      header: 'Auftrag',
      render: (row) => (
        <div className="max-w-sm">
          <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{row.id}</div>
          <div className="mt-1 font-semibold text-gray-900 dark:text-white">
            {transportTypeLabel(row.transportType)}
          </div>
          <div className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
            {row.description || 'Keine Beschreibung hinterlegt'}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {row.route.isInternational && <SmallPill tone="blue">International</SmallPill>}
            {row.route.customsRequired && <SmallPill tone="yellow">Zoll</SmallPill>}
            {row.cargo.isHazmat && <SmallPill tone="red">Gefahrgut</SmallPill>}
            {row.cargo.isFragile && <SmallPill tone="yellow">Fragil</SmallPill>}
          </div>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (row) => (
        <div className="min-w-[180px]">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{row.route.pickup.label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">→ {row.route.delivery.label}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {formatNumber(row.route.distanceKm, ' km')} · {formatNumber(row.cargo.weightKg, ' kg')}
          </p>
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
        <div className="min-w-[190px]">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{row.shipper?.name || '-'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.shipper?.email || '-'}</p>
          {row.transporter?.driver ? (
            <p className="mt-2 text-xs text-blue-600 dark:text-blue-300">
              Fahrer: {row.transporter.driver.name}
            </p>
          ) : (
            <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-300">Noch nicht angenommen</p>
          )}
          {row.transporter?.vehicle && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {row.transporter.vehicle.plateNumber} · {row.transporter.vehicle.type}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Preis',
      sortable: true,
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
      header: 'Abwicklung',
      render: (row) => (
        <div className="flex min-w-[200px] flex-wrap gap-2">
          <SmallPill tone={row.operational.pendingOffers > 0 ? 'blue' : 'gray'}>
            {row.operational.pendingOffers}/{row.operational.offersTotal} Angebote
          </SmallPill>
          <SmallPill tone={row.operational.podDocuments > 0 ? 'green' : row.status === 'DELIVERY_DONE' ? 'yellow' : 'gray'}>
            POD {row.operational.podDocuments}
          </SmallPill>
          <SmallPill tone={row.operational.invoiceDocuments > 0 ? 'green' : ['DELIVERY_DONE', 'COMPLETED'].includes(row.status) ? 'yellow' : 'gray'}>
            Rechnung {row.operational.invoiceDocuments}
          </SmallPill>
          <SmallPill tone={row.operational.matchingSessions > 0 ? 'blue' : 'gray'}>
            {row.operational.matchingSessions} Matching
          </SmallPill>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Zeitfenster',
      render: (row) => (
        <div className="min-w-[180px]">
          <p className="text-sm text-gray-900 dark:text-white">{formatDate(row.schedule.pickupDatetime)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Lieferung: {formatDate(row.schedule.deliveryDatetime)}</p>
          {row.operational.latestStatusNote && (
            <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{row.operational.latestStatusNote}</p>
          )}
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
          Ablauf öffnen
        </Link>
      ),
    },
  ], []);

  const filterOptions = [
    {
      name: 'status',
      label: 'Status',
      options: [
        { value: 'CREATED', label: 'Entwurf' },
        { value: 'PUBLISHED', label: 'Veröffentlicht' },
        { value: 'ASSIGNED', label: 'Zugewiesen' },
        { value: 'IN_TRANSIT', label: 'Unterwegs' },
        { value: 'PICKUP_DONE', label: 'Abgeholt' },
        { value: 'DELIVERY_DONE', label: 'Geliefert/POD' },
        { value: 'COMPLETED', label: 'Abgeschlossen' },
        { value: 'CANCELLED', label: 'Storniert' },
      ],
    },
    {
      name: 'type',
      label: 'Frachtart',
      options: [
        { value: 'PALLET', label: 'Paletten' },
        { value: 'BULK', label: 'Schüttgut' },
        { value: 'LIQUID', label: 'Flüssig' },
        { value: 'OVERSIZE', label: 'Übergröße' },
        { value: 'LOWLOADER', label: 'Tieflader' },
        { value: 'CAR_TRANSPORT', label: 'Fahrzeugtransport' },
        { value: 'COOLING', label: 'Kühltransport' },
        { value: 'HAZMAT', label: 'Gefahrgut' },
        { value: 'CONTAINER', label: 'Container' },
      ],
    },
  ];

  return (
    <DashboardLayout title="Aufträge" subtitle="Kaufmännische Übersicht über Auftrag, Angebote, Annahme, POD und Rechnung">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          {[
            ['Gesamt', summary.total, 'text-white'],
            ['Entwürfe', summary.drafts, 'text-[#A8B3C7]'],
            ['Veröffentlicht', summary.published, 'text-[#8BC5FF]'],
            ['Aktiv', summary.active, 'text-[#8BEFFF]'],
            ['POD offen', summary.podOpen, 'text-[#FFD28A]'],
            ['Rechnung offen', summary.invoiceOpen, 'text-[#FFDF8B]'],
            ['Abgeschlossen', summary.completed, 'text-[#9EF2BC]'],
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
          searchPlaceholder="Auftrags-ID, Route, Verlader oder Beschreibung suchen..."
          filters={filterOptions}
        />

        <DataTable
          columns={columns}
          data={items}
          keyField="id"
          loading={loading}
          emptyMessage="Keine Aufträge gefunden"
          pageSize={10}
        />
      </div>
    </DashboardLayout>
  );
}
