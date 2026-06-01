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
    messages: [
      {
        id: 'message_demo_1',
        senderRole: 'USER',
        isInternal: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        message: 'Der Auftragserstellungsprozess sollte nach der KI-Preisberechnung noch klarer erklären, warum Wallet-Guthaben reserviert wird.',
      },
    ],
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
    messages: [
      {
        id: 'message_demo_2',
        senderRole: 'USER',
        isInternal: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
        message: 'Fahrer sollten in der mobilen Ansicht schnell eine beschädigte Ware mit Foto melden können.',
      },
      {
        id: 'message_demo_2_internal',
        senderRole: 'ADMIN',
        isInternal: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        message: 'Produkt-Feedback aktualisiert.\nStatus: OPEN -> IN_PROGRESS\nNotiz: Vorschlag wird geprüft.',
      },
    ],
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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: 'Offen',
    IN_PROGRESS: 'In Bearbeitung',
    RESOLVED: 'Erledigt',
    CLOSED: 'Geschlossen',
  };
  return labels[status] || status;
}

function senderLabel(senderRole: string, isInternal?: boolean) {
  if (isInternal) return 'Interne Notiz';
  if (senderRole === 'ADMIN') return 'Admin';
  if (senderRole === 'SUPPORT') return 'Support';
  return 'Nutzer';
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
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackTicket | null>(null);
  const [detailStatus, setDetailStatus] = useState<FeedbackStatus>('OPEN');
  const [detailPriority, setDetailPriority] = useState<FeedbackPriority>('NORMAL');
  const [adminNote, setAdminNote] = useState('');

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

  const updateFeedback = useCallback(async (ticket: FeedbackTicket, data: { status?: FeedbackStatus; priority?: FeedbackPriority; note?: string }) => {
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

      const payload = await response.json().catch(() => null) as { ticket?: FeedbackTicket } | null;
      if (payload?.ticket) {
        setItems((current) => current.map((item) => (item.id === ticket.id ? payload.ticket! : item)));
        setSelectedFeedback((current) => (current?.id === ticket.id ? payload.ticket! : current));
      }

      await loadFeedback();
    } catch (error) {
      console.error('Failed to update feedback:', error);
      if (ticket.id.startsWith('feedback_demo_')) {
        const now = new Date().toISOString();
        const internalMessage = data.note
          ? {
              id: `demo_note_${Date.now()}`,
              senderRole: 'ADMIN',
              isInternal: true,
              createdAt: now,
              message: [
                'Produkt-Feedback aktualisiert.',
                data.status && data.status !== ticket.status ? `Status: ${ticket.status} -> ${data.status}` : null,
                data.priority && data.priority !== ticket.priority ? `Priorität: ${ticket.priority} -> ${data.priority}` : null,
                `Notiz: ${data.note}`,
              ].filter(Boolean).join('\n'),
            }
          : null;

        const applyDemoUpdate = (item: FeedbackTicket) => (
          item.id === ticket.id
            ? {
                ...item,
                ...data,
                updatedAt: now,
                messages: internalMessage ? [...(item.messages || []), internalMessage] : item.messages,
              }
            : item
        );

        setItems((current) => current.map((item) => (
          applyDemoUpdate(item)
        )));
        setSelectedFeedback((current) => (current?.id === ticket.id ? applyDemoUpdate(current) : current));
      } else {
        alert(error instanceof Error ? error.message : 'Feedback konnte nicht aktualisiert werden.');
      }
    } finally {
      setActionLoading(null);
    }
  }, [loadFeedback]);

  const openFeedback = useCallback((ticket: FeedbackTicket) => {
    setSelectedFeedback(ticket);
    setDetailStatus(ticket.status);
    setDetailPriority(ticket.priority);
    setAdminNote('');
  }, []);

  const saveDetailUpdate = async () => {
    if (!selectedFeedback) return;

    await updateFeedback(selectedFeedback, {
      status: detailStatus,
      priority: detailPriority,
      note: adminNote.trim() || undefined,
    });

    setAdminNote('');
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
              openFeedback(row);
            }}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            Details
          </button>
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
  ], [actionLoading, openFeedback, updateFeedback]);

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
          onRowClick={openFeedback}
          loading={loading}
          emptyMessage="Noch keine Verbesserungsvorschläge vorhanden"
          pageSize={8}
        />

        {selectedFeedback ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/40 backdrop-blur-sm">
            <button
              aria-label="Detailansicht schließen"
              className="hidden flex-1 cursor-default lg:block"
              onClick={() => setSelectedFeedback(null)}
            />
            <aside className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-2xl dark:bg-gray-900">
              <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 p-6 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                      Produktvorschlag
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
                      {selectedFeedback.subject.replace('Produkt-Feedback: ', '')}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Erstellt am {formatDateTime(selectedFeedback.createdAt)} · Aktualisiert am {formatDateTime(selectedFeedback.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFeedback(null)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Schließen
                  </button>
                </div>
              </div>

              <div className="space-y-6 p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Nutzer</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                      {selectedFeedback.user?.name || 'Unbekannt'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedFeedback.user?.email || '-'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Status</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={selectedFeedback.status.toLowerCase()} size="sm" />
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityClass(selectedFeedback.priority)}`}>
                        {priorityLabel(selectedFeedback.priority)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Vorschlag</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-200">
                    {selectedFeedback.message?.message || selectedFeedback.description}
                  </p>
                  {(() => {
                    const context = extractContext(selectedFeedback.description || '');
                    return context.role || context.page ? (
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {context.role ? <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">Kontext: {context.role}</span> : null}
                        {context.page ? <span className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">Seite: {context.page}</span> : null}
                      </div>
                    ) : null;
                  })()}
                </div>

                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Bearbeitung</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Status
                      <select
                        value={detailStatus}
                        onChange={(event) => setDetailStatus(event.target.value as FeedbackStatus)}
                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="OPEN">{statusLabel('OPEN')}</option>
                        <option value="IN_PROGRESS">{statusLabel('IN_PROGRESS')}</option>
                        <option value="RESOLVED">{statusLabel('RESOLVED')}</option>
                        <option value="CLOSED">{statusLabel('CLOSED')}</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Priorität
                      <select
                        value={detailPriority}
                        onChange={(event) => setDetailPriority(event.target.value as FeedbackPriority)}
                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="LOW">{priorityLabel('LOW')}</option>
                        <option value="NORMAL">{priorityLabel('NORMAL')}</option>
                        <option value="HIGH">{priorityLabel('HIGH')}</option>
                        <option value="URGENT">{priorityLabel('URGENT')}</option>
                      </select>
                    </label>
                  </div>
                  <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Interne Notiz
                    <textarea
                      value={adminNote}
                      onChange={(event) => setAdminNote(event.target.value)}
                      rows={4}
                      placeholder="Bewertung, Entscheidung oder Rückfrage für Support/Product festhalten..."
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </label>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={saveDetailUpdate}
                      disabled={Boolean(actionLoading)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Aktualisierung speichern
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Verlauf</h3>
                  <div className="mt-4 space-y-3">
                    {(selectedFeedback.messages?.length ? selectedFeedback.messages : selectedFeedback.message ? [{
                      id: selectedFeedback.message.id,
                      message: selectedFeedback.message.message,
                      senderRole: selectedFeedback.message.senderRole,
                      isInternal: false,
                      createdAt: selectedFeedback.message.createdAt,
                    }] : []).map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-lg border p-3 ${
                          message.isInternal
                            ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40'
                            : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                            {senderLabel(message.senderRole, message.isInternal)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(message.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-200">
                          {message.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
