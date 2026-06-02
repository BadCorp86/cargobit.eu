'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/admin/data-table';
import { FilterBar } from '@/components/admin/filter-bar';

type LicenseState = 'missing' | 'expired' | 'expiring' | 'valid' | 'not_required';

interface AdminDriver {
  id: string;
  userId: string;
  email: string;
  name: string;
  userStatus: string;
  company?: {
    id: string;
    name: string;
    status: string;
    country: string;
  } | null;
  availability: {
    isAvailable: boolean;
    currentLocation?: string | null;
    activeAssignments: number;
    pendingOffers: number;
  };
  license: {
    numberPresent: boolean;
    class?: string | null;
    expiry?: string | null;
    state: LicenseState;
    driverCardExpiry?: string | null;
    driverCardState: LicenseState;
    adrLicense: boolean;
    adrExpiry?: string | null;
    adrState: LicenseState;
    adrClasses: string[];
  };
  stats: {
    ratingAvg: number;
    ratingCount: number;
    completedTransports: number;
    cancelledTransports: number;
    damageCount: number;
    lastDamageAt?: string | null;
  };
  capabilities: {
    internationalExperience: boolean;
    yearsExperience?: number | null;
    spokenLanguages: string[];
    vehicleExperience: string[];
    countryExperience: string[];
    permissions: Array<{
      countryCode: string;
      countryName: string;
      isAllowed: boolean;
      expiresAt?: string | null;
    }>;
  };
  vehicles: Array<{
    id: string;
    type: string;
    plateNumber: string;
    status: string;
    maxPayloadKg?: number | null;
    coolingAvailable: boolean;
    adrApproved: boolean;
  }>;
  verifications: {
    total: number;
    approved: number;
    pending: number;
    driverLicenseApproved: boolean;
    adrApproved: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface DriversResponse {
  drivers: AdminDriver[];
  summary: {
    total: number;
    available: number;
    unavailable: number;
    licenseMissing: number;
    licenseAttention: number;
    damageOpen: number;
  };
}

const DEMO_DRIVERS: AdminDriver[] = [
  {
    id: 'drv_demo_alina',
    userId: 'user_driver_alina',
    email: 'alina.driver@cargobit.eu',
    name: 'Alina Weber',
    userStatus: 'ACTIVE',
    company: {
      id: 'company_demo_speed',
      name: 'SpeedLine Transport GmbH',
      status: 'ACTIVE',
      country: 'DE',
    },
    availability: {
      isAvailable: true,
      currentLocation: 'Hamburg, DE',
      activeAssignments: 1,
      pendingOffers: 2,
    },
    license: {
      numberPresent: true,
      class: 'CE',
      expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 260).toISOString(),
      state: 'valid',
      driverCardExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
      driverCardState: 'valid',
      adrLicense: true,
      adrExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString(),
      adrState: 'valid',
      adrClasses: ['2', '3'],
    },
    stats: {
      ratingAvg: 4.9,
      ratingCount: 84,
      completedTransports: 312,
      cancelledTransports: 3,
      damageCount: 0,
      lastDamageAt: null,
    },
    capabilities: {
      internationalExperience: true,
      yearsExperience: 8,
      spokenLanguages: ['de', 'en', 'pl'],
      vehicleExperience: ['CURTAINSIDER', 'REEFER'],
      countryExperience: ['DE', 'NL', 'BE', 'FR'],
      permissions: [
        { countryCode: 'DE', countryName: 'Deutschland', isAllowed: true },
        { countryCode: 'FR', countryName: 'Frankreich', isAllowed: true },
      ],
    },
    vehicles: [
      {
        id: 'veh_demo_hh_01',
        type: 'CURTAINSIDER',
        plateNumber: 'HH-CB 2401',
        status: 'ACTIVE',
        maxPayloadKg: 24000,
        coolingAvailable: false,
        adrApproved: true,
      },
    ],
    verifications: {
      total: 4,
      approved: 4,
      pending: 0,
      driverLicenseApproved: true,
      adrApproved: true,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 140).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'drv_demo_milan',
    userId: 'user_driver_milan',
    email: 'milan.driver@cargobit.eu',
    name: 'Milan Kovac',
    userStatus: 'ACTIVE',
    company: {
      id: 'company_demo_solo',
      name: 'Kovac Express',
      status: 'ACTIVE',
      country: 'DE',
    },
    availability: {
      isAvailable: false,
      currentLocation: 'Köln, DE',
      activeAssignments: 0,
      pendingOffers: 0,
    },
    license: {
      numberPresent: true,
      class: 'C1E',
      expiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString(),
      state: 'expiring',
      driverCardExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      driverCardState: 'expiring',
      adrLicense: false,
      adrExpiry: null,
      adrState: 'not_required',
      adrClasses: [],
    },
    stats: {
      ratingAvg: 4.6,
      ratingCount: 27,
      completedTransports: 89,
      cancelledTransports: 2,
      damageCount: 1,
      lastDamageAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 42).toISOString(),
    },
    capabilities: {
      internationalExperience: true,
      yearsExperience: 4,
      spokenLanguages: ['de', 'hr'],
      vehicleExperience: ['SPRINTER', 'KOEFFER'],
      countryExperience: ['DE', 'AT'],
      permissions: [
        { countryCode: 'DE', countryName: 'Deutschland', isAllowed: true },
        { countryCode: 'AT', countryName: 'Österreich', isAllowed: true },
      ],
    },
    vehicles: [
      {
        id: 'veh_demo_k_01',
        type: 'SPRINTER',
        plateNumber: 'K-CB 118',
        status: 'ACTIVE',
        maxPayloadKg: 1200,
        coolingAvailable: false,
        adrApproved: false,
      },
    ],
    verifications: {
      total: 3,
      approved: 2,
      pending: 1,
      driverLicenseApproved: true,
      adrApproved: false,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 80).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'drv_demo_nora',
    userId: 'user_driver_nora',
    email: 'nora.driver@cargobit.eu',
    name: 'Nora Schneider',
    userStatus: 'PENDING',
    company: null,
    availability: {
      isAvailable: false,
      currentLocation: null,
      activeAssignments: 0,
      pendingOffers: 0,
    },
    license: {
      numberPresent: false,
      class: null,
      expiry: null,
      state: 'missing',
      driverCardExpiry: null,
      driverCardState: 'missing',
      adrLicense: false,
      adrExpiry: null,
      adrState: 'not_required',
      adrClasses: [],
    },
    stats: {
      ratingAvg: 0,
      ratingCount: 0,
      completedTransports: 0,
      cancelledTransports: 0,
      damageCount: 0,
      lastDamageAt: null,
    },
    capabilities: {
      internationalExperience: false,
      yearsExperience: null,
      spokenLanguages: ['de'],
      vehicleExperience: [],
      countryExperience: ['DE'],
      permissions: [],
    },
    vehicles: [],
    verifications: {
      total: 1,
      approved: 0,
      pending: 1,
      driverLicenseApproved: false,
      adrApproved: false,
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
];

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function buildSummary(items: AdminDriver[]): DriversResponse['summary'] {
  return {
    total: items.length,
    available: items.filter((item) => item.availability.isAvailable).length,
    unavailable: items.filter((item) => !item.availability.isAvailable).length,
    licenseMissing: items.filter((item) => item.license.state === 'missing').length,
    licenseAttention: items.filter((item) => ['expired', 'expiring'].includes(item.license.state)).length,
    damageOpen: items.filter((item) => item.stats.damageCount > 0).length,
  };
}

function licenseLabel(state: LicenseState) {
  const labels: Record<LicenseState, string> = {
    missing: 'Fehlt',
    expired: 'Abgelaufen',
    expiring: 'Läuft bald ab',
    valid: 'Gültig',
    not_required: 'Nicht nötig',
  };

  return labels[state] || state;
}

function badgeClasses(tone: 'green' | 'yellow' | 'red' | 'gray' | 'blue') {
  const classes = {
    green: 'bg-green-50 text-green-700 dark:bg-green-900/35 dark:text-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/35 dark:text-yellow-200',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/35 dark:text-red-200',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/35 dark:text-blue-200',
  };

  return `inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes[tone]}`;
}

function licenseTone(state: LicenseState) {
  if (state === 'valid') return 'green';
  if (state === 'expiring') return 'yellow';
  if (state === 'expired' || state === 'missing') return 'red';
  return 'gray';
}

export default function AdminDriversPage() {
  const [items, setItems] = useState<AdminDriver[]>([]);
  const [summary, setSummary] = useState<DriversResponse['summary']>(buildSummary(DEMO_DRIVERS));
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const loadDrivers = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filters.available) params.set('available', filters.available);
      if (filters.license) params.set('license', filters.license);

      const response = await fetch(`/api/admin/drivers?${params.toString()}`);
      if (!response.ok) throw new Error('Admin drivers API unavailable');

      const payload = await response.json() as DriversResponse;
      setItems(payload.drivers || []);
      setSummary(payload.summary || buildSummary(payload.drivers || []));
    } catch (error) {
      console.error('Failed to load admin drivers:', error);
      setItems(DEMO_DRIVERS);
      setSummary(buildSummary(DEMO_DRIVERS));
    } finally {
      setLoading(false);
    }
  }, [filters.available, filters.license, searchQuery]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const columns = useMemo<Column<AdminDriver>[]>(() => [
    {
      key: 'driver',
      header: 'Fahrer',
      render: (row) => (
        <div className="max-w-xs">
          <div className="font-semibold text-gray-900 dark:text-white">{row.name}</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{row.email}</div>
          <div className="mt-1 font-mono text-xs text-gray-400">{row.id}</div>
          {row.company ? (
            <div className="mt-2 text-xs text-blue-600 dark:text-blue-300">{row.company.name} · {row.company.country}</div>
          ) : (
            <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-300">Keine Spedition verknüpft</div>
          )}
        </div>
      ),
    },
    {
      key: 'availability',
      header: 'Verfügbarkeit',
      render: (row) => (
        <div className="space-y-2">
          <span className={badgeClasses(row.availability.isAvailable ? 'green' : 'gray')}>
            {row.availability.isAvailable ? 'Verfügbar' : 'Nicht verfügbar'}
          </span>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {row.availability.activeAssignments} aktive Touren · {row.availability.pendingOffers} Angebote
          </div>
          {row.availability.currentLocation && (
            <div className="text-xs text-gray-500 dark:text-gray-400">{row.availability.currentLocation}</div>
          )}
        </div>
      ),
    },
    {
      key: 'license',
      header: 'Dokumente',
      render: (row) => (
        <div className="min-w-[170px] space-y-2">
          <div>
            <span className={badgeClasses(licenseTone(row.license.state))}>
              FS {licenseLabel(row.license.state)}
            </span>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Klasse {row.license.class || '-'} · bis {formatDate(row.license.expiry)}
            </p>
          </div>
          <div>
            <span className={badgeClasses(licenseTone(row.license.driverCardState))}>
              Fahrerkarte {licenseLabel(row.license.driverCardState)}
            </span>
          </div>
          {row.license.adrLicense && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              ADR {row.license.adrClasses.join(', ') || 'aktiv'} · bis {formatDate(row.license.adrExpiry)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'vehicles',
      header: 'Fahrzeuge',
      render: (row) => (
        <div className="min-w-[160px]">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{row.vehicles.length} Fahrzeuge</p>
          {row.vehicles[0] ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {row.vehicles[0].plateNumber} · {row.vehicles[0].type}
            </p>
          ) : (
            <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-300">Kein Fahrzeug hinterlegt</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {row.vehicles.some((vehicle) => vehicle.coolingAvailable) && (
              <span className={badgeClasses('blue')}>Kühlung</span>
            )}
            {row.vehicles.some((vehicle) => vehicle.adrApproved) && (
              <span className={badgeClasses('yellow')}>ADR</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'performance',
      header: 'Performance',
      render: (row) => (
        <div className="min-w-[160px]">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {row.stats.ratingAvg ? row.stats.ratingAvg.toFixed(1) : '-'} / 5
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {row.stats.ratingCount} Bewertungen · {row.stats.completedTransports} erledigt
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {row.stats.cancelledTransports} Stornos · {row.stats.damageCount} Schäden
          </p>
        </div>
      ),
    },
    {
      key: 'verification',
      header: 'Verifizierung',
      render: (row) => (
        <div className="min-w-[150px]">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {row.verifications.approved}/{row.verifications.total} bestätigt
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.verifications.pending} offen</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className={badgeClasses(row.verifications.driverLicenseApproved ? 'green' : 'red')}>
              Führerschein
            </span>
            {row.license.adrLicense && (
              <span className={badgeClasses(row.verifications.adrApproved ? 'green' : 'yellow')}>
                ADR
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Aktion',
      render: (row) => (
        <Link
          href={`/admin/users?search=${encodeURIComponent(row.email)}`}
          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-200"
        >
          Benutzer öffnen
        </Link>
      ),
    },
  ], []);

  const filterOptions = [
    {
      name: 'available',
      label: 'Verfügbarkeit',
      options: [
        { value: 'true', label: 'Verfügbar' },
        { value: 'false', label: 'Nicht verfügbar' },
      ],
    },
    {
      name: 'license',
      label: 'Dokumentstatus',
      options: [
        { value: 'missing', label: 'Führerschein fehlt' },
        { value: 'expired', label: 'Führerschein abgelaufen' },
        { value: 'expiring', label: 'Läuft in 30 Tagen ab' },
      ],
    },
  ];

  return (
    <DashboardLayout title="Fahrer" subtitle="Fahrerprofile, Verfügbarkeit, Dokumente, Fahrzeuge und mobile Einsatzqualität">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {[
            ['Gesamt', summary.total, 'text-white'],
            ['Verfügbar', summary.available, 'text-[#9EF2BC]'],
            ['Nicht verfügbar', summary.unavailable, 'text-[#A8B3C7]'],
            ['Führerschein fehlt', summary.licenseMissing, 'text-[#FF8D8D]'],
            ['Dokumente prüfen', summary.licenseAttention, 'text-[#FFD28A]'],
            ['Schadenhistorie', summary.damageOpen, 'text-[#8BEFFF]'],
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
          searchPlaceholder="Fahrer, E-Mail, Firma, Führerschein oder Klasse suchen..."
          filters={filterOptions}
        />

        <DataTable
          columns={columns}
          data={items}
          keyField="id"
          loading={loading}
          emptyMessage="Keine Fahrer gefunden"
          pageSize={10}
        />
      </div>
    </DashboardLayout>
  );
}
