/**
 * CargoBit Admin - Disputes List Page
 * 
 * Displays all disputes with resolution capability.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/admin-layout';
import { DataTable, Column } from '@/components/admin/data-table';
import { FilterBar } from '@/components/admin/filter-bar';
import { StatusBadge } from '@/components/admin/status-badge';

// ============================================
// TYPES
// ============================================

interface Dispute {
  id: string;
  jobId: string;
  shipperEmail: string;
  transporterEmail: string;
  reason: string;
  status: 'open' | 'in_progress' | 'in_review' | 'awaiting_info' | 'resolved' | 'closed' | 'rejected' | 'refunded';
  resolution?: string;
  refundAmountCents?: number;
  supportTicket?: {
    id: string;
    subject?: string;
    priority?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  evidenceRequest?: {
    requestedAt?: string;
    dueAt?: string;
    isOverdue?: boolean;
    missingEvidence?: string[];
  } | null;
  createdAt: string;
  updatedAt: string;
}

function normalizeDisputeStatus(status?: string): Dispute['status'] {
  const normalized = (status || 'open').toLowerCase();
  if (normalized === 'awaiting_info') return 'awaiting_info';
  if (normalized === 'in_review') return 'in_review';
  if (normalized === 'refunded') return 'refunded';
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'closed') return 'closed';
  return normalized === 'resolved' || normalized === 'in_progress' ? normalized : 'open';
}

function normalizeDisputeList(payload: any): Dispute[] {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : payload?.disputes || [];

  return rows.map((row: any) => ({
    id: row.id,
    jobId: row.jobId || row.transportId || row.job_id || 'job_preview',
    shipperEmail: row.shipperEmail || row.createdByEmail || row.createdBy?.email || row.createdBy || 'shipper@example.com',
    transporterEmail: row.transporterEmail || row.against?.email || row.againstEmail || 'transporter@example.com',
    reason: row.reason || row.subject || 'Streitfall',
    status: normalizeDisputeStatus(row.status),
    resolution: row.resolution,
    refundAmountCents: row.refundAmountCents,
    supportTicket: row.supportTicket ? {
      id: row.supportTicket.id,
      subject: row.supportTicket.subject,
      priority: row.supportTicket.priority,
      status: row.supportTicket.status,
      createdAt: typeof row.supportTicket.createdAt === 'string' ? row.supportTicket.createdAt : new Date(row.supportTicket.createdAt || Date.now()).toISOString(),
      updatedAt: typeof row.supportTicket.updatedAt === 'string' ? row.supportTicket.updatedAt : new Date(row.supportTicket.updatedAt || Date.now()).toISOString(),
    } : null,
    evidenceRequest: row.evidenceRequest ? {
      requestedAt: typeof row.evidenceRequest.requestedAt === 'string' ? row.evidenceRequest.requestedAt : new Date(row.evidenceRequest.requestedAt || Date.now()).toISOString(),
      dueAt: typeof row.evidenceRequest.dueAt === 'string' ? row.evidenceRequest.dueAt : new Date(row.evidenceRequest.dueAt || Date.now()).toISOString(),
      isOverdue: Boolean(row.evidenceRequest.isOverdue),
      missingEvidence: Array.isArray(row.evidenceRequest.missingEvidence) ? row.evidenceRequest.missingEvidence : [],
    } : null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(row.createdAt || Date.now()).toISOString(),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date(row.updatedAt || row.createdAt || Date.now()).toISOString(),
  }));
}

function formatDateTime(value?: string) {
  if (!value) return '';

  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// DISPUTES LIST PAGE
// ============================================

export default function DisputesListPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchDisputes = async () => {
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (filters.status) params.set('status', filters.status);

        const res = await fetch(`/api/admin/disputes?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch disputes');
        const data = await res.json();
        setDisputes(normalizeDisputeList(data));
      } catch (err) {
        console.error('Failed to fetch disputes:', err);
        // Mock data for demo
        setDisputes([
          {
            id: 'dispute_1',
            jobId: 'job_abc123',
            shipperEmail: 'shipper@example.com',
            transporterEmail: 'transporter@example.com',
            reason: 'Waren beschädigt angekommen',
            status: 'open',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'dispute_2',
            jobId: 'job_def456',
            shipperEmail: 'customer@example.com',
            transporterEmail: 'driver@example.com',
            reason: 'Verspätete Lieferung',
            status: 'awaiting_info',
            supportTicket: {
              id: 'ticket_preview',
              priority: 'HIGH',
              status: 'OPEN',
            },
            evidenceRequest: {
              requestedAt: new Date(Date.now() - 3600000).toISOString(),
              dueAt: new Date(Date.now() + 71 * 3600000).toISOString(),
              isOverdue: false,
              missingEvidence: ['POD Foto', 'Lieferschein'],
            },
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            updatedAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: 'dispute_3',
            jobId: 'job_ghi789',
            shipperEmail: 'user@example.com',
            transporterEmail: 'carrier@example.com',
            reason: 'Falsche Fracht geliefert',
            status: 'resolved',
            resolution: 'refund_full',
            refundAmountCents: 12500,
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            updatedAt: new Date(Date.now() - 86400000).toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchDisputes();
  }, [searchQuery, filters]);

  const columns: Column<Dispute>[] = [
    {
      key: 'id',
      header: 'Dispute ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-sm">{row.id.slice(0, 12)}...</span>
      ),
    },
    {
      key: 'jobId',
      header: 'Job ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-sm">{row.jobId}</span>
      ),
    },
    {
      key: 'participants',
      header: 'Beteiligte',
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.shipperEmail}</p>
          <p className="text-xs text-gray-500">vs. {row.transporterEmail}</p>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Grund',
      render: (row) => (
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
          {row.reason}
        </p>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'evidence',
      header: 'Nachweise',
      render: (row) => {
        if (!row.evidenceRequest && !row.supportTicket) {
          return <span className="text-xs text-gray-400">Keine Anfrage</span>;
        }

        return (
          <div className="space-y-1">
            {row.evidenceRequest?.dueAt && (
              <div className={`text-xs font-medium ${row.evidenceRequest.isOverdue ? 'text-red-500' : 'text-yellow-600 dark:text-yellow-300'}`}>
                Frist: {formatDateTime(row.evidenceRequest.dueAt)}
              </div>
            )}
            {row.supportTicket?.id && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Ticket {row.supportTicket.id.slice(0, 10)} · {row.supportTicket.priority || 'NORMAL'}
              </div>
            )}
            {row.evidenceRequest?.missingEvidence?.length ? (
              <div className="text-xs text-gray-400">
                {row.evidenceRequest.missingEvidence.length} offene Nachweise
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Erstellt',
      sortable: true,
      render: (row) => new Date(row.createdAt).toLocaleDateString('de-DE'),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/admin/disputes/${row.id}`);
          }}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Bearbeiten
        </button>
      ),
    },
  ];

  const filterOptions = [
    {
      name: 'status',
      label: 'Status',
      options: [
        { value: 'open', label: 'Offen' },
        { value: 'in_progress', label: 'In Bearbeitung' },
        { value: 'awaiting_info', label: 'Nachweise fehlen' },
        { value: 'in_review', label: 'In Prüfung' },
        { value: 'resolved', label: 'Gelöst' },
        { value: 'closed', label: 'Geschlossen' },
      ],
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Disputes
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Verwalten Sie Konflikte zwischen Shippern und Transportern
            </p>
          </div>
        </div>

        {/* Filters */}
        <FilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          searchPlaceholder="Dispute ID, Job ID, Email suchen..."
          filters={filterOptions}
          dateRange
        />

        {/* Disputes Table */}
        <DataTable
          columns={columns}
          data={disputes}
          keyField="id"
          loading={loading}
          onRowClick={(row) => router.push(`/admin/disputes/${row.id}`)}
          emptyMessage="Keine Disputes gefunden"
        />
      </div>
    </AdminLayout>
  );
}
