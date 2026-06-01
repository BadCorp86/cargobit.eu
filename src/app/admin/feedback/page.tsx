'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/admin-layout';
import { DataTable, Column } from '@/components/admin/data-table';
import { FilterBar } from '@/components/admin/filter-bar';
import { StatusBadge } from '@/components/admin/status-badge';

type FeedbackStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type FeedbackPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

interface FeedbackTicket {
  id: string;
  subject: string;
  description: string;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  category: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
  } | null;
  message?: {
    id: string;
    message: string;
    senderRole: string;
    createdAt: string;
  } | null;
  messages?: Array<{
    id: string;
    message: string;
    senderRole: string;
    isInternal: boolean;
    createdAt: string;
  }>;
}

interface FeedbackResponse {
  items: FeedbackTicket[];
  summary?: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    highPriority: number;
  };
}

const DEMO_FEEDBACK: FeedbackTicket[] = [
  {
    id: 'feedback_demo_1',
    subject: 'Produkt-Feedback: Bedienbarkeit',
    description: 'Kategorie: Bedienbarkeit\nRolle/Kontext: Verlader\nSeite: /#verbesserungen\n\nDer Auftragserstellungsprozess sollte nach der KI-Preisberechnung noch klarer erklären, warum Wallet-Guthaben reserviert wird.',
    priority: 'NORMAL',
    status: 'OPEN',
    category: 'PRODUCT_FEEDBACK',
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    user: { id: 'demo-user', email: 'shipper@cargobit.eu', name: 'Max Müller' },
    message: {
      id: 'message_demo_1',
      senderRole: 'USER',
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      message: 'Der Auftragserstellungsprozess sollte nach der KI-Preisberechnung noch klarer erklären, warum Wallet-Guthaben reserviert wird.',
    },
  },
  {
    id: 'feedback_demo_2',
    subject: 'Produkt-Feedback: Funktion fehlt',
    description: 'Kategorie: Funktion fehlt\nRolle/Kontext: Fahrer\n\nFahrer sollten in der mobilen Ansicht schnell eine beschädigte Ware mit Foto melden können.',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    category: 'PRODUCT_FEEDBACK',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    user: { id: 'demo-driver', email: 'driver@cargobit.eu', name: 'Thomas Weber' },
    message: {
      id: 'message_demo_2',
      senderRole: 'USER',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
      message: 'Fahrer sollten in der mobilen Ansicht schnell eine beschädigte Ware mit Foto melden können.',
    },
  },
];

function formatDateTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function priorityClass(priority: string) {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'NORMAL':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
}

function priorityLabel(priority: string) {
  const labels: Record<string, string> = {
    LOW: 'Niedrig',
    NORMAL: 'Normal',
    HIGH: 'Hoch',
    URGENT: 'Dringend',
  };
  return labels[priority] || priority;
}

function extractContext(description: string) {
  const role = description.match(/Rolle\/Kontext:\s*(.+)/)?.[1]?.trim();
  const page = description.match(/Seite:\s*(.+)/)?.[1]?.trim();
  return { role, page };
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackTicket[]>([]);
  const [summary, setSummary] = useState<FeedbackResponse['summary']>();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filters.status) params.set('status', filters.status);
      if (filters.priority) params.set('priority', filters.priority);

      const response = await fetch(`/api/admin/feedback?${params.toString()}`);
      if (!response.ok) throw new Error('Feedback API unavailable');

      const payload = await response.json() as FeedbackResponse;
      setItems(payload.items || []);
      setSummary(payload.summary);
    } catch (error) {
      console.error('Failed to load feedback:', error);
      setItems(DEMO_FEEDBACK);
      setSummary({
        total: DEMO_FEEDBACK.length,
        open: DEMO_FEEDBACK.filter((item) => item.status === 'OPEN').length,
        inProgress: DEMO_FEEDBACK.filter((item) => item.status === 'IN_PROGRESS').length,
        resolved: DEMO_FEEDBACK.filter((item) => item.status === 'RESOLVED' || item.status === 'CLOSED').length,
        highPriority: DEMO_FEEDBACK.filter((item) => ['HIGH', 'URGENT'].includes(item.priority)).length,
      });
    } finally {
      setLoading(false);
    }
  }, [filters.priority, filters.status, searchQuery]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const updateFeedback = async (ticket: FeedbackTicket, data: { status?: FeedbackStatus; priority?: FeedbackPriority; note?: string }) => {
    setActionLoading(`${ticket.id}:${data.status || data.priority || 'update'}`);

    try {
      const response = await fetch(`/api/admin/feedback/${encodeURIComponent(ticket.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Feedback konnte nicht aktualisiert werden.');
      }

      await loadFeedback();
    } catch (error) {
      console.error('Failed to update feedback:', error);
      if (ticket.id.startsWith('feedback_demo_')) {
        setItems((current) => current.map((item) => (
          item.id === ticket.id
            ? { ...item, ...data, updatedAt: new Date().toISOString() }
            : item
        )));
      } else {
        alert(error instanceof Error ? error.message : 'Feedback konnte nicht aktualisiert werden.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const columns = useMemo<Column<FeedbackTicket>[]>(() => [
    {
      key: 'subject',
      header: 'Vorschlag',
      render: (row) => {
        const context = extractContext(row.description || row.message?.message || '');
        return (
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{row.subject.replace('Produkt-Feedback: ', '')}</p>
            <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
              {row.message?.message || row.description}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
              {context.role ? <span>Kontext: {context.role}</span> : null}
              {context.page ? <span>Seite: {context.page}</span> : null}
            </div>
          </div>
        );
      },
    },
    {
      key: 'user',
      header: 'Nutzer',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{row.user?.name || 'Unbekannt'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.user?.email || '-'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status.toLowerCase()} size="sm" />,
    },
    {
      key: 'priority',
      header: 'Priorität',
      sortable: true,
      render: (row) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityClass(row.priority)}`}>
          {priorityLabel(row.priority)}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Aktualisiert',
      sortable: true,
      render: (row) => <span className="text-sm text-gray-500 dark:text-gray-400">{formatDateTime(row.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Aktionen',
      render: (row) => (
        <div className="flex min-w-[260px] flex-wrap gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              updateFeedback(row, { status: 'IN_PROGRESS', note: 'Vorschlag wird geprüft.' });
            }}
            disabled={Boolean(actionLoading) || row.status === 'IN_PROGRESS'}
            className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-900/40 dark:text-blue-200"
          >
            Prüfen
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              updateFeedback(row, { status: 'RESOLVED', note: 'Vorschlag wurde geprüft und für die Roadmap bewertet.' });
            }}
            disabled={Boolean(actionLoading) || row.status === 'RESOLVED' || row.status === 'CLOSED'}
            className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-900/40 dark:text-green-200"
          >
            Erledigt
          </button>
          <select
            value={row.priority}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => updateFeedback(row, { priority: event.target.value as FeedbackPriority, note: 'Priorität wurde angepasst.' })}
            disabled={Boolean(actionLoading)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value="LOW">Niedrig</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">Hoch</option>
            <option value="URGENT">Dringend</option>
          </select>
        </div>
      ),
    },
  ], [actionLoading, loadFeedback]);

  const filterOptions = [
    {
      name: 'status',
      label: 'Status',
      options: [
        { value: 'OPEN', label: 'Offen' },
        { value: 'IN_PROGRESS', label: 'In Bearbeitung' },
        { value: 'RESOLVED', label: 'Erledigt' },
        { value: 'CLOSED', label: 'Geschlossen' },
      ],
    },
    {
      name: 'priority',
      label: 'Priorität',
      options: [
        { value: 'LOW', label: 'Niedrig' },
        { value: 'NORMAL', label: 'Normal' },
        { value: 'HIGH', label: 'Hoch' },
        { value: 'URGENT', label: 'Dringend' },
      ],
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verbesserungen</h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Produkt-Feedback aus der Landingpage sichten, priorisieren und für die Roadmap bewerten.
            </p>
          </div>
          <button
            onClick={() => loadFeedback()}
            className="w-fit rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Aktualisieren
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Offen', summary?.open ?? 0, 'text-red-600 dark:text-red-300'],
            ['In Bearbeitung', summary?.inProgress ?? 0, 'text-blue-600 dark:text-blue-300'],
            ['Erledigt', summary?.resolved ?? 0, 'text-green-600 dark:text-green-300'],
            ['Hohe Priorität', summary?.highPriority ?? 0, 'text-orange-600 dark:text-orange-300'],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
              <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <FilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          searchPlaceholder="Feedback, Nutzer oder Seite suchen..."
          filters={filterOptions}
        />

        <DataTable
          columns={columns}
          data={items}
          keyField="id"
          loading={loading}
          emptyMessage="Noch keine Verbesserungsvorschläge vorhanden"
          pageSize={8}
        />
      </div>
    </AdminLayout>
  );
}
