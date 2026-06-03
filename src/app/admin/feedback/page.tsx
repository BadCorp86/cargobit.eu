'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
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

const EMPTY_SUMMARY = {
  total: 0,
  open: 0,
  inProgress: 0,
  resolved: 0,
  highPriority: 0,
};

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

function priorityLabel(priority: string) {
  const labels: Record<string, string> = {
    LOW: 'Niedrig',
    NORMAL: 'Normal',
    HIGH: 'Hoch',
    URGENT: 'Dringend',
  };
  return labels[priority] || priority;
}

function priorityClasses(priority: string) {
  switch (priority) {
    case 'URGENT':
      return 'border-[#E74C3C]/25 bg-[#E74C3C]/10 text-[#FF8D8D]';
    case 'HIGH':
      return 'border-[#F39C12]/25 bg-[#F39C12]/10 text-[#FFD28A]';
    case 'NORMAL':
      return 'border-[#1C7ED6]/25 bg-[#1C7ED6]/10 text-[#8BC5FF]';
    default:
      return 'border-white/[0.08] bg-white/[0.05] text-white/65';
  }
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

function publicMessage(ticket: FeedbackTicket) {
  return ticket.message?.message || ticket.description || '';
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackTicket[]>([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackTicket | null>(null);
  const [detailStatus, setDetailStatus] = useState<FeedbackStatus>('OPEN');
  const [detailPriority, setDetailPriority] = useState<FeedbackPriority>('NORMAL');
  const [adminNote, setAdminNote] = useState('');

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filters.status) params.set('status', filters.status);
      if (filters.priority) params.set('priority', filters.priority);

      const response = await fetch(`/api/admin/feedback?${params.toString()}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Feedback API unavailable');
      }

      const nextPayload = payload as FeedbackResponse;
      setItems(nextPayload.items || []);
      setSummary(nextPayload.summary || EMPTY_SUMMARY);
      setSelectedFeedback((current) => {
        if (!current) return null;
        return nextPayload.items.find((item) => item.id === current.id) || null;
      });
    } catch (error) {
      console.error('Failed to load feedback:', error);
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      setSelectedFeedback(null);
      setErrorMessage(error instanceof Error ? error.message : 'Verbesserungsvorschläge konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [filters.priority, filters.status, searchQuery]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const updateFeedback = useCallback(async (
    ticket: FeedbackTicket,
    data: { status?: FeedbackStatus; priority?: FeedbackPriority; note?: string },
  ) => {
    setActionLoading(`${ticket.id}:${data.status || data.priority || 'update'}`);

    try {
      const response = await fetch(`/api/admin/feedback/${encodeURIComponent(ticket.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => null) as { ticket?: FeedbackTicket; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || 'Feedback konnte nicht aktualisiert werden.');
      }

      if (payload?.ticket) {
        setItems((current) => current.map((item) => (item.id === ticket.id ? payload.ticket! : item)));
        setSelectedFeedback((current) => (current?.id === ticket.id ? payload.ticket! : current));
        setDetailStatus(payload.ticket.status);
        setDetailPriority(payload.ticket.priority);
      }

      await loadFeedback();
    } catch (error) {
      console.error('Failed to update feedback:', error);
      alert(error instanceof Error ? error.message : 'Feedback konnte nicht aktualisiert werden.');
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
        const context = extractContext(row.description || publicMessage(row));
        return (
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{row.subject.replace('Produkt-Feedback: ', '')}</p>
            <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
              {publicMessage(row)}
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
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses(row.priority)}`}>
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
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openFeedback(row);
            }}
            className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/[0.08]"
          >
            Details
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              updateFeedback(row, { status: 'IN_PROGRESS', note: 'Vorschlag wird geprüft.' });
            }}
            disabled={Boolean(actionLoading) || row.status === 'IN_PROGRESS'}
            className="rounded-lg border border-[#1C7ED6]/25 bg-[#1C7ED6]/10 px-3 py-1.5 text-xs font-semibold text-[#8BC5FF] hover:bg-[#1C7ED6]/18 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prüfen
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              updateFeedback(row, { status: 'RESOLVED', note: 'Vorschlag wurde geprüft und für die Roadmap bewertet.' });
            }}
            disabled={Boolean(actionLoading) || row.status === 'RESOLVED' || row.status === 'CLOSED'}
            className="rounded-lg border border-[#2ECC71]/25 bg-[#2ECC71]/10 px-3 py-1.5 text-xs font-semibold text-[#9EF2BC] hover:bg-[#2ECC71]/18 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Erledigt
          </button>
          <select
            value={row.priority}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => updateFeedback(row, { priority: event.target.value as FeedbackPriority, note: 'Priorität wurde angepasst.' })}
            disabled={Boolean(actionLoading)}
            className="rounded-lg border border-white/[0.08] bg-[#06121C] px-2 py-1.5 text-xs text-white disabled:opacity-50"
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
    <DashboardLayout title="Verbesserungen" subtitle="Produkt-Feedback sichten, priorisieren und für die Roadmap bewerten">
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => loadFeedback()}
            className="rounded-xl border border-[#00D4FF]/25 bg-[#00D4FF]/10 px-4 py-2 text-sm font-semibold text-[#00D4FF] transition hover:bg-[#00D4FF]/15"
          >
            Aktualisieren
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Offen', summary.open, 'text-[#FF8D8D]'],
            ['In Bearbeitung', summary.inProgress, 'text-[#8BC5FF]'],
            ['Erledigt', summary.resolved, 'text-[#9EF2BC]'],
            ['Hohe Priorität', summary.highPriority, 'text-[#FFD28A]'],
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
          searchPlaceholder="Feedback, Nutzer oder Seite suchen..."
          filters={filterOptions}
        />

        {errorMessage ? (
          <div className="rounded-[18px] border border-[#E74C3C]/20 bg-[#E74C3C]/10 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
            <p className="text-sm font-semibold text-[#FF8D8D]">Verbesserungsvorschläge konnten nicht geladen werden.</p>
            <p className="mt-2 text-sm text-white/55">{errorMessage}</p>
            <button
              type="button"
              onClick={loadFeedback}
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
            onRowClick={openFeedback}
            loading={loading}
            emptyMessage="Noch keine Verbesserungsvorschläge vorhanden"
            pageSize={8}
          />
        )}

        {selectedFeedback ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-[#06121C]/70 backdrop-blur-sm">
            <button
              type="button"
              aria-label="Detailansicht schließen"
              className="hidden flex-1 cursor-default lg:block"
              onClick={() => setSelectedFeedback(null)}
            />
            <aside className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-white/[0.08] bg-[#06121C] shadow-2xl">
              <div className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#06121C]/95 p-6 backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#00D4FF]">
                      Produktvorschlag
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-white">
                      {selectedFeedback.subject.replace('Produkt-Feedback: ', '')}
                    </h2>
                    <p className="mt-1 text-sm text-white/45">
                      Erstellt am {formatDateTime(selectedFeedback.createdAt)} · Aktualisiert am {formatDateTime(selectedFeedback.updatedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFeedback(null)}
                    className="rounded-xl border border-white/[0.08] px-3 py-1.5 text-sm text-white/75 hover:bg-white/[0.06]"
                  >
                    Schließen
                  </button>
                </div>
              </div>

              <div className="space-y-6 p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailBox label="Nutzer">
                    <p className="mt-2 text-sm font-semibold text-white">{selectedFeedback.user?.name || 'Unbekannt'}</p>
                    <p className="text-sm text-white/45">{selectedFeedback.user?.email || '-'}</p>
                  </DetailBox>
                  <DetailBox label="Status">
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={selectedFeedback.status.toLowerCase()} size="sm" />
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses(selectedFeedback.priority)}`}>
                        {priorityLabel(selectedFeedback.priority)}
                      </span>
                    </div>
                  </DetailBox>
                </div>

                <DetailBox label="Vorschlag">
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/72">
                    {publicMessage(selectedFeedback)}
                  </p>
                  {(() => {
                    const context = extractContext(selectedFeedback.description || '');
                    return context.role || context.page ? (
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/50">
                        {context.role ? <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1">Kontext: {context.role}</span> : null}
                        {context.page ? <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1">Seite: {context.page}</span> : null}
                      </div>
                    ) : null;
                  })()}
                </DetailBox>

                <DetailBox label="Bearbeitung">
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium text-white/75">
                      Status
                      <select
                        value={detailStatus}
                        onChange={(event) => setDetailStatus(event.target.value as FeedbackStatus)}
                        className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#071927] px-3 py-2 text-sm text-white outline-none"
                      >
                        <option value="OPEN">{statusLabel('OPEN')}</option>
                        <option value="IN_PROGRESS">{statusLabel('IN_PROGRESS')}</option>
                        <option value="RESOLVED">{statusLabel('RESOLVED')}</option>
                        <option value="CLOSED">{statusLabel('CLOSED')}</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium text-white/75">
                      Priorität
                      <select
                        value={detailPriority}
                        onChange={(event) => setDetailPriority(event.target.value as FeedbackPriority)}
                        className="mt-2 w-full rounded-xl border border-white/[0.08] bg-[#071927] px-3 py-2 text-sm text-white outline-none"
                      >
                        <option value="LOW">{priorityLabel('LOW')}</option>
                        <option value="NORMAL">{priorityLabel('NORMAL')}</option>
                        <option value="HIGH">{priorityLabel('HIGH')}</option>
                        <option value="URGENT">{priorityLabel('URGENT')}</option>
                      </select>
                    </label>
                  </div>
                  <label className="mt-4 block text-sm font-medium text-white/75">
                    Interne Notiz
                    <textarea
                      value={adminNote}
                      onChange={(event) => setAdminNote(event.target.value)}
                      rows={4}
                      placeholder="Bewertung, Entscheidung oder Rückfrage für Support/Product festhalten..."
                      className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-[#071927] px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
                    />
                  </label>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={saveDetailUpdate}
                      disabled={Boolean(actionLoading)}
                      className="rounded-xl bg-[#1C7ED6] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Aktualisierung speichern
                    </button>
                  </div>
                </DetailBox>

                <DetailBox label="Verlauf">
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
                        className={`rounded-xl border p-3 ${
                          message.isInternal
                            ? 'border-[#1C7ED6]/25 bg-[#1C7ED6]/10'
                            : 'border-white/[0.08] bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-white/75">
                            {senderLabel(message.senderRole, message.isInternal)}
                          </span>
                          <span className="text-xs text-white/40">{formatDateTime(message.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/72">
                          {message.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </DetailBox>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function DetailBox({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/40">{label}</p>
      {children}
    </div>
  );
}
