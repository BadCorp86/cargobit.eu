'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/admin/data-table';
import { FilterBar } from '@/components/admin/filter-bar';
import { StatusBadge } from '@/components/admin/status-badge';
import { ConfirmModal } from '@/components/admin/modal';

type UserStatus = 'ACTIVE' | 'PENDING' | 'BLOCKED' | 'SUSPENDED';

interface AdminPlatformUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  name: string;
  phone?: string | null;
  language: string;
  status: UserStatus;
  roles: string[];
  primaryRole: string;
  companies: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    country: string;
  }>;
  primaryCompany?: {
    id: string;
    name: string;
    type: string;
    status: string;
    country: string;
  } | null;
  verification: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
  };
  risk: {
    activeFlags: number;
    highestSeverity: string;
    openTickets: number;
    urgentTickets: number;
  };
  wallet?: {
    id: string;
    balance: number;
    reservedBalance: number;
    availableBalance: number;
    currency: string;
    status: string;
  } | null;
  activity: {
    transportsTotal: number;
    transportsActive: number;
    transportsCompleted: number;
    payments: number;
    payouts: number;
  };
  driver?: {
    id: string;
    isAvailable: boolean;
    ratingAvg: number;
    completedTransports: number;
    damageCount: number;
  } | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UsersResponse {
  users: AdminPlatformUser[];
  summary: {
    total: number;
    active: number;
    pending: number;
    blocked: number;
    suspended: number;
    verificationPending: number;
    securityFlags: number;
  };
}

const DEMO_USERS: AdminPlatformUser[] = [
  {
    id: 'user_demo_shipper',
    email: 'shipper@cargobit.eu',
    firstName: 'Max',
    lastName: 'Müller',
    name: 'Max Müller',
    phone: '+49 170 000000',
    language: 'de',
    status: 'ACTIVE',
    roles: ['SHIPPER_COMPANY'],
    primaryRole: 'SHIPPER_COMPANY',
    companies: [{ id: 'company_demo_1', name: 'Müller Handel GmbH', type: 'SHIPPER', status: 'ACTIVE', country: 'DE' }],
    primaryCompany: { id: 'company_demo_1', name: 'Müller Handel GmbH', type: 'SHIPPER', status: 'ACTIVE', country: 'DE' },
    verification: { total: 3, approved: 3, pending: 0, rejected: 0 },
    risk: { activeFlags: 0, highestSeverity: 'LOW', openTickets: 1, urgentTickets: 0 },
    wallet: { id: 'wallet_demo_1', balance: 3400, reservedBalance: 980, availableBalance: 2420, currency: 'EUR', status: 'ACTIVE' },
    activity: { transportsTotal: 18, transportsActive: 2, transportsCompleted: 14, payments: 12, payouts: 0 },
    driver: null,
    lastLoginAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'user_demo_driver',
    email: 'driver@cargobit.eu',
    firstName: 'Alina',
    lastName: 'Weber',
    name: 'Alina Weber',
    phone: '+49 171 000000',
    language: 'de',
    status: 'ACTIVE',
    roles: ['DRIVER_SELF_EMPLOYED', 'CARRIER'],
    primaryRole: 'DRIVER_SELF_EMPLOYED',
    companies: [{ id: 'company_demo_2', name: 'Weber Express', type: 'CARRIER', status: 'ACTIVE', country: 'DE' }],
    primaryCompany: { id: 'company_demo_2', name: 'Weber Express', type: 'CARRIER', status: 'ACTIVE', country: 'DE' },
    verification: { total: 4, approved: 4, pending: 0, rejected: 0 },
    risk: { activeFlags: 0, highestSeverity: 'LOW', openTickets: 0, urgentTickets: 0 },
    wallet: { id: 'wallet_demo_2', balance: 850, reservedBalance: 0, availableBalance: 850, currency: 'EUR', status: 'ACTIVE' },
    activity: { transportsTotal: 0, transportsActive: 0, transportsCompleted: 0, payments: 6, payouts: 2 },
    driver: { id: 'driver_demo', isAvailable: true, ratingAvg: 4.9, completedTransports: 312, damageCount: 0 },
    lastLoginAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 80).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: 'user_demo_pending',
    email: 'pending@example.com',
    firstName: 'Neue',
    lastName: 'Firma',
    name: 'Neue Firma',
    phone: null,
    language: 'de',
    status: 'PENDING',
    roles: ['CARRIER'],
    primaryRole: 'CARRIER',
    companies: [{ id: 'company_demo_3', name: 'Pending Carrier GmbH', type: 'CARRIER', status: 'PENDING', country: 'DE' }],
    primaryCompany: { id: 'company_demo_3', name: 'Pending Carrier GmbH', type: 'CARRIER', status: 'PENDING', country: 'DE' },
    verification: { total: 2, approved: 0, pending: 2, rejected: 0 },
    risk: { activeFlags: 1, highestSeverity: 'MEDIUM', openTickets: 2, urgentTickets: 0 },
    wallet: null,
    activity: { transportsTotal: 0, transportsActive: 0, transportsCompleted: 0, payments: 0, payouts: 0 },
    driver: null,
    lastLoginAt: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'user_demo_blocked',
    email: 'blocked@example.com',
    firstName: null,
    lastName: null,
    name: 'blocked@example.com',
    phone: null,
    language: 'de',
    status: 'BLOCKED',
    roles: ['SHIPPER_PRIVATE'],
    primaryRole: 'SHIPPER_PRIVATE',
    companies: [],
    primaryCompany: null,
    verification: { total: 1, approved: 0, pending: 0, rejected: 1 },
    risk: { activeFlags: 2, highestSeverity: 'HIGH', openTickets: 1, urgentTickets: 1 },
    wallet: { id: 'wallet_demo_4', balance: 0, reservedBalance: 0, availableBalance: 0, currency: 'EUR', status: 'FROZEN' },
    activity: { transportsTotal: 1, transportsActive: 0, transportsCompleted: 0, payments: 1, payouts: 0 },
    driver: null,
    lastLoginAt: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
];

function buildSummary(items: AdminPlatformUser[]): UsersResponse['summary'] {
  return {
    total: items.length,
    active: items.filter((item) => item.status === 'ACTIVE').length,
    pending: items.filter((item) => item.status === 'PENDING').length,
    blocked: items.filter((item) => item.status === 'BLOCKED').length,
    suspended: items.filter((item) => item.status === 'SUSPENDED').length,
    verificationPending: items.reduce((sum, item) => sum + item.verification.pending, 0),
    securityFlags: items.reduce((sum, item) => sum + item.risk.activeFlags, 0),
  };
}

function formatCurrency(amount: number | null | undefined, currency = 'EUR') {
  if (amount == null) return '-';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    SHIPPER_COMPANY: 'Verlader Firma',
    SHIPPER_PRIVATE: 'Verlader Privat',
    CARRIER: 'Spedition',
    DRIVER_SELF_EMPLOYED: 'Solo-Transporteur',
    DISPATCHER: 'Dispatcher',
    MARKETER: 'Marketing',
    ADMIN: 'Admin',
    SUPPORT: 'Support',
  };

  return labels[role] || role;
}

function statusForBadge(status: string) {
  return status.toLowerCase();
}

function riskTone(severity: string, flags: number) {
  if (severity === 'CRITICAL' || severity === 'HIGH' || flags > 1) return 'red';
  if (severity === 'MEDIUM' || flags === 1) return 'yellow';
  return 'green';
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

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminPlatformUser[]>([]);
  const [summary, setSummary] = useState<UsersResponse['summary']>(buildSummary(DEMO_USERS));
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedUser, setSelectedUser] = useState<AdminPlatformUser | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filters.status) params.set('status', filters.status);
      if (filters.role) params.set('role', filters.role);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) throw new Error('Admin users API unavailable');

      const payload = await response.json() as UsersResponse;
      setItems(payload.users || []);
      setSummary(payload.summary || buildSummary(payload.users || []));
    } catch (error) {
      console.error('Failed to load admin users:', error);
      setItems(DEMO_USERS);
      setSummary(buildSummary(DEMO_USERS));
    } finally {
      setLoading(false);
    }
  }, [filters.role, filters.status, searchQuery]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleStatusChange = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    const nextStatus = selectedUser.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          reason: blockReason,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Benutzerstatus konnte nicht geändert werden');
      }

      const nextItems = items.map((item) => (
        item.id === selectedUser.id ? { ...item, status: nextStatus as UserStatus } : item
      ));
      setItems(nextItems);
      setSummary(buildSummary(nextItems));
      setShowBlockModal(false);
      setSelectedUser(null);
      setBlockReason('');
    } catch (error: any) {
      console.error('Failed to update user:', error);
      alert(error.message || 'Fehler beim Aktualisieren des Benutzers');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<Column<AdminPlatformUser>[]>(() => [
    {
      key: 'user',
      header: 'Benutzer',
      render: (row) => (
        <div className="max-w-xs">
          <div className="font-semibold text-gray-900 dark:text-white">{row.name}</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{row.email}</div>
          <div className="mt-1 font-mono text-xs text-gray-400">{row.id}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {row.roles.map((role) => (
              <span key={role} className={badgeClasses('blue')}>{roleLabel(role)}</span>
            ))}
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
          <StatusBadge status={statusForBadge(row.status)} size="sm" />
          <p className="text-xs text-gray-500 dark:text-gray-400">Seit {formatDate(row.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Firma',
      render: (row) => (
        <div className="min-w-[170px]">
          {row.primaryCompany ? (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{row.primaryCompany.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{row.primaryCompany.type} · {row.primaryCompany.country}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{row.companies.length} Firmenzuordnung(en)</p>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Keine Firma</p>
          )}
        </div>
      ),
    },
    {
      key: 'verification',
      header: 'Verifizierung',
      render: (row) => (
        <div className="min-w-[150px]">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {row.verification.approved}/{row.verification.total} bestätigt
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {row.verification.pending} offen · {row.verification.rejected} abgelehnt
          </p>
          <div className="mt-2">
            <span className={badgeClasses(row.verification.pending > 0 ? 'yellow' : row.verification.rejected > 0 ? 'red' : 'green')}>
              {row.verification.pending > 0 ? 'Prüfung offen' : row.verification.rejected > 0 ? 'Nacharbeit' : 'OK'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'wallet',
      header: 'Wallet',
      render: (row) => (
        <div className="min-w-[150px]">
          {row.wallet ? (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {formatCurrency(row.wallet.availableBalance, row.wallet.currency)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Reserviert: {formatCurrency(row.wallet.reservedBalance, row.wallet.currency)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{row.wallet.status}</p>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Kein Wallet</p>
          )}
        </div>
      ),
    },
    {
      key: 'activity',
      header: 'Aktivität',
      render: (row) => (
        <div className="flex min-w-[190px] flex-wrap gap-2">
          <span className={badgeClasses(row.activity.transportsActive > 0 ? 'blue' : 'gray')}>
            {row.activity.transportsActive}/{row.activity.transportsTotal} Aufträge
          </span>
          <span className={badgeClasses(row.driver?.isAvailable ? 'green' : row.driver ? 'gray' : 'yellow')}>
            {row.driver ? `${row.driver.completedTransports} Fahrer-Touren` : 'Kein Fahrerprofil'}
          </span>
          <span className={badgeClasses('gray')}>{row.activity.payments} Zahlungen</span>
        </div>
      ),
    },
    {
      key: 'risk',
      header: 'Risiko',
      render: (row) => (
        <div className="min-w-[150px] space-y-2">
          <span className={badgeClasses(riskTone(row.risk.highestSeverity, row.risk.activeFlags))}>
            {row.risk.activeFlags} Flags · {row.risk.highestSeverity}
          </span>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {row.risk.openTickets} Tickets · {row.risk.urgentTickets} dringend
          </p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Aktion',
      render: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedUser(row);
            setShowBlockModal(true);
          }}
          className={row.status === 'BLOCKED'
            ? 'rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-200'
            : 'rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-200'}
        >
          {row.status === 'BLOCKED' ? 'Entsperren' : 'Sperren'}
        </button>
      ),
    },
  ], []);

  const filterOptions = [
    {
      name: 'status',
      label: 'Status',
      options: [
        { value: 'ACTIVE', label: 'Aktiv' },
        { value: 'PENDING', label: 'Ausstehend' },
        { value: 'BLOCKED', label: 'Gesperrt' },
        { value: 'SUSPENDED', label: 'Suspendiert' },
      ],
    },
    {
      name: 'role',
      label: 'Rolle',
      options: [
        { value: 'SHIPPER_COMPANY', label: 'Verlader Firma' },
        { value: 'SHIPPER_PRIVATE', label: 'Verlader Privat' },
        { value: 'CARRIER', label: 'Spedition' },
        { value: 'DRIVER_SELF_EMPLOYED', label: 'Solo-Transporteur' },
        { value: 'DISPATCHER', label: 'Dispatcher' },
        { value: 'MARKETER', label: 'Marketing' },
      ],
    },
  ];

  return (
    <DashboardLayout title="Benutzer" subtitle="Plattform-Nutzer, Rollen, Firmen, Wallets, Verifizierungen und Risiko">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          {[
            ['Gesamt', summary.total, 'text-white'],
            ['Aktiv', summary.active, 'text-[#9EF2BC]'],
            ['Ausstehend', summary.pending, 'text-[#FFD28A]'],
            ['Gesperrt', summary.blocked, 'text-[#FF8D8D]'],
            ['Suspendiert', summary.suspended, 'text-[#A8B3C7]'],
            ['Verifizierung offen', summary.verificationPending, 'text-[#8BC5FF]'],
            ['Security Flags', summary.securityFlags, 'text-[#FFDF8B]'],
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
          searchPlaceholder="Name, E-Mail, Firma oder Nutzer-ID suchen..."
          filters={filterOptions}
        />

        <DataTable
          columns={columns}
          data={items}
          keyField="id"
          loading={loading}
          emptyMessage="Keine Benutzer gefunden"
          pageSize={10}
        />
      </div>

      <ConfirmModal
        isOpen={showBlockModal}
        onClose={() => {
          setShowBlockModal(false);
          setSelectedUser(null);
          setBlockReason('');
        }}
        onConfirm={handleStatusChange}
        title={selectedUser?.status === 'BLOCKED' ? 'Benutzer entsperren' : 'Benutzer sperren'}
        message={
          selectedUser?.status === 'BLOCKED'
            ? `Soll ${selectedUser.email} wieder aktiviert werden? Aktive Security Flags werden geschlossen.`
            : `Soll ${selectedUser?.email} gesperrt werden? Der Nutzer kann dann nicht weiter normal arbeiten.`
        }
        confirmLabel={selectedUser?.status === 'BLOCKED' ? 'Entsperren' : 'Sperren'}
        variant={selectedUser?.status === 'BLOCKED' ? 'info' : 'danger'}
        loading={submitting}
      />
    </DashboardLayout>
  );
}
