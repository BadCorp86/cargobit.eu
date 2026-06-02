'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/admin/data-table';
import { FilterBar } from '@/components/admin/filter-bar';

type VehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';

interface AdminVehicle {
  id: string;
  type: string;
  plateNumber: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  status: VehicleStatus;
  currentLocation?: string | null;
  company: {
    id: string;
    name: string;
    status: string;
    country: string;
  };
  capacity: {
    lengthM?: number | null;
    widthM?: number | null;
    heightM?: number | null;
    maxPayloadKg?: number | null;
    volumeM3?: number | null;
    palletSpaces?: number | null;
  };
  features: {
    adrApproved: boolean;
    adrClasses: string[];
    coolingAvailable: boolean;
    coolingMinTemp?: number | null;
    coolingMaxTemp?: number | null;
    hasLift: boolean;
    hasCrane: boolean;
    hasTank: boolean;
    tankCapacityL?: number | null;
    tunnelCodes: string[];
  };
  operations: {
    assignedDrivers: Array<{
      id: string;
      name: string;
      email: string;
      isPrimary: boolean;
      isAvailable: boolean;
    }>;
    activeAssignments: number;
    pendingOffers: number;
    totalOffers: number;
    matchingCandidates: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface VehiclesResponse {
  vehicles: AdminVehicle[];
  summary: {
    total: number;
    active: number;
    maintenance: number;
    inactive: number;
    adr: number;
    cooling: number;
    special: number;
  };
}

const DEMO_VEHICLES: AdminVehicle[] = [
  {
    id: 'veh_demo_hh_01',
    type: 'CURTAINSIDER',
    plateNumber: 'HH-CB 2401',
    brand: 'Mercedes-Benz',
    model: 'Actros',
    year: 2023,
    status: 'ACTIVE',
    currentLocation: 'Hamburg, DE',
    company: {
      id: 'company_demo_speed',
      name: 'SpeedLine Transport GmbH',
      status: 'ACTIVE',
      country: 'DE',
    },
    capacity: {
      lengthM: 13.6,
      widthM: 2.45,
      heightM: 2.75,
      maxPayloadKg: 24000,
      volumeM3: 90,
      palletSpaces: 33,
    },
    features: {
      adrApproved: true,
      adrClasses: ['2', '3'],
      coolingAvailable: false,
      coolingMinTemp: null,
      coolingMaxTemp: null,
      hasLift: true,
      hasCrane: false,
      hasTank: false,
      tankCapacityL: null,
      tunnelCodes: ['B', 'C'],
    },
    operations: {
      assignedDrivers: [
        {
          id: 'drv_demo_alina',
          name: 'Alina Weber',
          email: 'alina.driver@cargobit.eu',
          isPrimary: true,
          isAvailable: true,
        },
      ],
      activeAssignments: 1,
      pendingOffers: 2,
      totalOffers: 18,
      matchingCandidates: 6,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: 'veh_demo_reefer_01',
    type: 'REEFER',
    plateNumber: 'B-CB 8802',
    brand: 'Schmitz Cargobull',
    model: 'S.KO Cool',
    year: 2022,
    status: 'ACTIVE',
    currentLocation: 'Berlin, DE',
    company: {
      id: 'company_demo_cool',
      name: 'FrischeLogistik Berlin',
      status: 'ACTIVE',
      country: 'DE',
    },
    capacity: {
      lengthM: 13.4,
      widthM: 2.46,
      heightM: 2.65,
      maxPayloadKg: 22000,
      volumeM3: 86,
      palletSpaces: 33,
    },
    features: {
      adrApproved: false,
      adrClasses: [],
      coolingAvailable: true,
      coolingMinTemp: -22,
      coolingMaxTemp: 12,
      hasLift: false,
      hasCrane: false,
      hasTank: false,
      tankCapacityL: null,
      tunnelCodes: [],
    },
    operations: {
      assignedDrivers: [
        {
          id: 'drv_demo_milan',
          name: 'Milan Kovac',
          email: 'milan.driver@cargobit.eu',
          isPrimary: true,
          isAvailable: false,
        },
      ],
      activeAssignments: 0,
      pendingOffers: 1,
      totalOffers: 11,
      matchingCandidates: 4,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 95).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'veh_demo_lowloader_01',
    type: 'TIEFLADER',
    plateNumber: 'E-CB 5100',
    brand: 'Goldhofer',
    model: 'STZ',
    year: 2020,
    status: 'MAINTENANCE',
    currentLocation: 'Essen, DE',
    company: {
      id: 'company_demo_heavy',
      name: 'Ruhr Heavy Cargo',
      status: 'ACTIVE',
      country: 'DE',
    },
    capacity: {
      lengthM: 16.5,
      widthM: 2.75,
      heightM: 0.9,
      maxPayloadKg: 48000,
      volumeM3: null,
      palletSpaces: null,
    },
    features: {
      adrApproved: false,
      adrClasses: [],
      coolingAvailable: false,
      coolingMinTemp: null,
      coolingMaxTemp: null,
      hasLift: false,
      hasCrane: true,
      hasTank: false,
      tankCapacityL: null,
      tunnelCodes: [],
    },
    operations: {
      assignedDrivers: [],
      activeAssignments: 0,
      pendingOffers: 0,
      totalOffers: 3,
      matchingCandidates: 2,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
];

function buildSummary(items: AdminVehicle[]): VehiclesResponse['summary'] {
  return {
    total: items.length,
    active: items.filter((item) => item.status === 'ACTIVE').length,
    maintenance: items.filter((item) => item.status === 'MAINTENANCE').length,
    inactive: items.filter((item) => item.status === 'INACTIVE').length,
    adr: items.filter((item) => item.features.adrApproved).length,
    cooling: items.filter((item) => item.features.coolingAvailable).length,
    special: items.filter((item) => item.features.hasCrane || item.features.hasTank || ['TIEFLADER', 'TIEFBETT', 'AUTOTRANSPORTER', 'CONTAINERCHASSIS', 'REEFER'].includes(item.type)).length,
  };
}

function formatNumber(value?: number | null, suffix = '') {
  if (value == null) return '-';
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

function vehicleLabel(type: string) {
  const labels: Record<string, string> = {
    SPRINTER: 'Sprinter',
    KOEFFER: 'Koffer',
    PLANE: 'Plane',
    CURTAINSIDER: 'Curtainsider',
    KIPPER: 'Kipper',
    SILO: 'Silo',
    MULDE: 'Mulde',
    TANKAUFLIEGER: 'Tankauflieger',
    AUTOTRANSPORTER: 'Autotransporter',
    TIEFLADER: 'Tieflader',
    TIEFBETT: 'Tiefbett',
    CONTAINERCHASSIS: 'Containerchassis',
    REEFER: 'Kühlauflieger',
    IBC_TRANSPORTER: 'IBC-Transporter',
    LANGAUFLIEGER: 'Langauflieger',
    JUMBO: 'Jumbo',
  };

  return labels[type] || type;
}

function statusLabel(status: VehicleStatus) {
  const labels: Record<VehicleStatus, string> = {
    ACTIVE: 'Aktiv',
    MAINTENANCE: 'Wartung',
    INACTIVE: 'Inaktiv',
  };

  return labels[status] || status;
}

function badgeClasses(tone: 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'cyan') {
  const classes = {
    green: 'bg-green-50 text-green-700 dark:bg-green-900/35 dark:text-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/35 dark:text-yellow-200',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/35 dark:text-red-200',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/35 dark:text-blue-200',
    cyan: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/35 dark:text-cyan-200',
  };

  return `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes[tone]}`;
}

function statusTone(status: VehicleStatus) {
  if (status === 'ACTIVE') return 'green';
  if (status === 'MAINTENANCE') return 'yellow';
  return 'gray';
}

export default function AdminVehiclesPage() {
  const [items, setItems] = useState<AdminVehicle[]>([]);
  const [summary, setSummary] = useState<VehiclesResponse['summary']>(buildSummary(DEMO_VEHICLES));
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const loadVehicles = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filters.status) params.set('status', filters.status);
      if (filters.type) params.set('type', filters.type);
      if (filters.feature) params.set('feature', filters.feature);

      const response = await fetch(`/api/admin/vehicles?${params.toString()}`);
      if (!response.ok) throw new Error('Admin vehicles API unavailable');

      const payload = await response.json() as VehiclesResponse;
      setItems(payload.vehicles || []);
      setSummary(payload.summary || buildSummary(payload.vehicles || []));
    } catch (error) {
      console.error('Failed to load admin vehicles:', error);
      setItems(DEMO_VEHICLES);
      setSummary(buildSummary(DEMO_VEHICLES));
    } finally {
      setLoading(false);
    }
  }, [filters.feature, filters.status, filters.type, searchQuery]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const columns = useMemo<Column<AdminVehicle>[]>(() => [
    {
      key: 'vehicle',
      header: 'Fahrzeug',
      render: (row) => (
        <div className="max-w-xs">
          <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{row.plateNumber}</div>
          <div className="mt-1 font-semibold text-gray-900 dark:text-white">
            {vehicleLabel(row.type)}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {[row.brand, row.model, row.year].filter(Boolean).join(' · ') || row.id}
          </div>
          <div className="mt-2 text-xs text-blue-600 dark:text-blue-300">
            {row.company.name} · {row.company.country}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <div className="space-y-2">
          <span className={badgeClasses(statusTone(row.status))}>
            {statusLabel(row.status)}
          </span>
          {row.currentLocation && (
            <div className="text-xs text-gray-500 dark:text-gray-400">{row.currentLocation}</div>
          )}
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Kapazität',
      render: (row) => (
        <div className="min-w-[170px]">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatNumber(row.capacity.maxPayloadKg, ' kg')}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {formatNumber(row.capacity.lengthM, ' m')} × {formatNumber(row.capacity.widthM, ' m')} × {formatNumber(row.capacity.heightM, ' m')}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {formatNumber(row.capacity.volumeM3, ' m³')} · {row.capacity.palletSpaces ?? '-'} Stellplätze
          </p>
        </div>
      ),
    },
    {
      key: 'features',
      header: 'Ausstattung',
      render: (row) => (
        <div className="flex min-w-[190px] flex-wrap gap-2">
          {row.features.adrApproved && (
            <span className={badgeClasses('yellow')}>ADR {row.features.adrClasses.join(', ')}</span>
          )}
          {row.features.coolingAvailable && (
            <span className={badgeClasses('cyan')}>
              Kühlung {formatNumber(row.features.coolingMinTemp, '°')} bis {formatNumber(row.features.coolingMaxTemp, '°')}
            </span>
          )}
          {row.features.hasLift && <span className={badgeClasses('blue')}>Hebebühne</span>}
          {row.features.hasCrane && <span className={badgeClasses('blue')}>Kran</span>}
          {row.features.hasTank && <span className={badgeClasses('blue')}>Tank {formatNumber(row.features.tankCapacityL, ' l')}</span>}
          {!row.features.adrApproved && !row.features.coolingAvailable && !row.features.hasLift && !row.features.hasCrane && !row.features.hasTank && (
            <span className={badgeClasses('gray')}>Standard</span>
          )}
        </div>
      ),
    },
    {
      key: 'drivers',
      header: 'Fahrer',
      render: (row) => (
        <div className="min-w-[170px]">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {row.operations.assignedDrivers.length} zugewiesen
          </p>
          {row.operations.assignedDrivers[0] ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {row.operations.assignedDrivers[0].name}
              {row.operations.assignedDrivers[0].isPrimary ? ' · Primär' : ''}
            </p>
          ) : (
            <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-300">Kein Fahrer zugewiesen</p>
          )}
        </div>
      ),
    },
    {
      key: 'operations',
      header: 'Ops',
      render: (row) => (
        <div className="flex min-w-[180px] flex-wrap gap-2 text-xs">
          <span className={badgeClasses(row.operations.activeAssignments > 0 ? 'green' : 'gray')}>
            {row.operations.activeAssignments} Touren
          </span>
          <span className={badgeClasses(row.operations.pendingOffers > 0 ? 'blue' : 'gray')}>
            {row.operations.pendingOffers} Angebote
          </span>
          <span className={badgeClasses(row.operations.matchingCandidates > 0 ? 'cyan' : 'gray')}>
            {row.operations.matchingCandidates} Matches
          </span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Aktion',
      render: (row) => (
        <Link
          href={`/admin/drivers?search=${encodeURIComponent(row.plateNumber)}`}
          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-200"
        >
          Fahrer prüfen
        </Link>
      ),
    },
  ], []);

  const filterOptions = [
    {
      name: 'status',
      label: 'Status',
      options: [
        { value: 'ACTIVE', label: 'Aktiv' },
        { value: 'MAINTENANCE', label: 'Wartung' },
        { value: 'INACTIVE', label: 'Inaktiv' },
      ],
    },
    {
      name: 'type',
      label: 'Fahrzeugtyp',
      options: [
        { value: 'SPRINTER', label: 'Sprinter' },
        { value: 'KOEFFER', label: 'Koffer' },
        { value: 'CURTAINSIDER', label: 'Curtainsider' },
        { value: 'REEFER', label: 'Kühlauflieger' },
        { value: 'TIEFLADER', label: 'Tieflader' },
        { value: 'AUTOTRANSPORTER', label: 'Autotransporter' },
        { value: 'CONTAINERCHASSIS', label: 'Containerchassis' },
        { value: 'TANKAUFLIEGER', label: 'Tankauflieger' },
      ],
    },
    {
      name: 'feature',
      label: 'Ausstattung',
      options: [
        { value: 'adr', label: 'ADR' },
        { value: 'cooling', label: 'Kühlung' },
        { value: 'lift', label: 'Hebebühne' },
        { value: 'crane', label: 'Kran' },
        { value: 'tank', label: 'Tank' },
      ],
    },
  ];

  return (
    <DashboardLayout title="Fahrzeuge" subtitle="Flotte, Kapazitäten, Sonderausstattung und Einsatzfähigkeit">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          {[
            ['Gesamt', summary.total, 'text-white'],
            ['Aktiv', summary.active, 'text-[#9EF2BC]'],
            ['Wartung', summary.maintenance, 'text-[#FFD28A]'],
            ['Inaktiv', summary.inactive, 'text-[#A8B3C7]'],
            ['ADR', summary.adr, 'text-[#FFDF8B]'],
            ['Kühlung', summary.cooling, 'text-[#8BEFFF]'],
            ['Sonderfahrzeuge', summary.special, 'text-[#8BC5FF]'],
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
          searchPlaceholder="Kennzeichen, Firma, Marke oder Modell suchen..."
          filters={filterOptions}
        />

        <DataTable
          columns={columns}
          data={items}
          keyField="id"
          loading={loading}
          emptyMessage="Keine Fahrzeuge gefunden"
          pageSize={10}
        />
      </div>
    </DashboardLayout>
  );
}
