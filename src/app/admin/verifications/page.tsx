'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface VerificationReviewDocument {
  type?: string;
  ocr?: {
    status?: string;
    source?: string;
    confidence?: number;
    error?: string;
    warnings?: string[];
    extractedFields?: {
      vatNumbers?: string[];
      documentNumbers?: string[];
      dates?: string[];
      expiryDate?: string;
    };
  };
}

interface VerificationReviewData {
  decision?: string;
  score?: number;
  providerMode?: string;
  costPolicy?: {
    mode?: string;
    shouldUsePaidProvider?: boolean;
    paidProviderReason?: string;
  };
  registryChecks?: Array<{
    provider?: string;
    status?: string;
    message?: string;
  }>;
  manualReviewReasons?: string[];
  missingRequirements?: Array<{
    label?: string;
    verificationType?: string;
  }>;
  primaryDocument?: VerificationReviewDocument | null;
  documents?: VerificationReviewDocument[];
}

interface AdminVerificationItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userStatus: string;
  role: string;
  companyName?: string;
  companyCountry?: string;
  companyVatNumber?: string;
  type: string;
  status: VerificationStatus;
  documentType?: string;
  documentUrl?: string;
  reviewData?: VerificationReviewData | null;
  reviewReason?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
  supportTicket?: {
    id: string;
    subject: string;
    priority: string;
    status: string;
    description: string;
    lastMessage?: string;
  } | null;
}

interface VerificationQueueResponse {
  items: AdminVerificationItem[];
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

const mockQueue: VerificationQueueResponse = {
  summary: {
    total: 4,
    pending: 2,
    approved: 1,
    rejected: 1,
  },
  items: [
    {
      id: 'mock_verification_1',
      userId: 'demo-carrier',
      userName: 'Anna Schmidt',
      userEmail: 'carrier@cargobit.eu',
      userStatus: 'PENDING',
      role: 'CARRIER',
      companyName: 'Schmidt Spedition',
      companyCountry: 'DE',
      companyVatNumber: 'DE123456789',
      type: 'KYB',
      status: 'PENDING',
      documentType: 'COMMERCIAL_REGISTER_EXTRACT',
      documentUrl: '/uploads/demo-business.pdf',
      reviewData: {
        decision: 'manual_review',
        score: 72,
        providerMode: 'metadata-rules',
        costPolicy: { mode: 'local_rules_vies', shouldUsePaidProvider: false },
        registryChecks: [
          {
            provider: 'vies',
            status: 'failed',
            message: 'USt-ID wurde von VIES nicht als gueltig bestaetigt.',
          },
        ],
        documents: [
          {
            type: 'COMMERCIAL_REGISTER_EXTRACT',
            ocr: {
              status: 'completed',
              source: 'image_ocr',
              confidence: 93,
              extractedFields: {
                vatNumbers: ['DE123456789'],
                documentNumbers: ['HRB12345'],
                expiryDate: '2030-12-31',
              },
            },
          },
        ],
        manualReviewReasons: ['VIES: USt-ID wurde von VIES nicht als gueltig bestaetigt.'],
      },
      reviewReason: 'VIES: USt-ID wurde von VIES nicht als gueltig bestaetigt.',
      createdAt: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      supportTicket: {
        id: 'ticket_demo_1',
        subject: 'Manuelle Verifizierung erforderlich: Spedition / Transporteur',
        priority: 'HIGH',
        status: 'OPEN',
        description: [
          'Prüfmodus: metadata-rules',
          'Kostenmodus: local_rules_vies',
          'Register-/Provider-Pruefungen:',
          '- vies: failed (USt-ID wurde von VIES nicht als gueltig bestaetigt.)',
          'OCR-Ergebnisse:',
          '- COMMERCIAL_REGISTER_EXTRACT: completed, image_ocr, Confidence 93 (USt-ID: DE123456789; Nummern: HRB12345; Ablauf: 2030-12-31)',
        ].join('\n'),
      },
    },
    {
      id: 'mock_verification_2',
      userId: 'demo-driver',
      userName: 'Thomas Weber',
      userEmail: 'driver@cargobit.eu',
      userStatus: 'ACTIVE',
      role: 'DRIVER_SELF_EMPLOYED',
      type: 'DRIVER_LICENSE',
      status: 'PENDING',
      documentType: 'DRIVERS_LICENSE',
      documentUrl: '/uploads/demo-license.pdf',
      reviewData: {
        decision: 'manual_review',
        score: 64,
        providerMode: 'metadata-rules',
        costPolicy: { mode: 'local_rules_manual_review', shouldUsePaidProvider: false },
        documents: [
          {
            type: 'DRIVERS_LICENSE',
            ocr: {
              status: 'partial',
              source: 'pdf_page_ocr',
              confidence: 61,
              warnings: ['Rueckseite fehlt oder ist unscharf.'],
              extractedFields: {
                documentNumbers: ['D1234567'],
              },
            },
          },
        ],
        manualReviewReasons: ['OCR fuer DRIVERS_LICENSE hat nur Teilinformationen erkannt'],
      },
      reviewReason: 'OCR fuer DRIVERS_LICENSE hat nur Teilinformationen erkannt',
      createdAt: new Date(Date.now() - 1000 * 60 * 115).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 78).toISOString(),
      supportTicket: {
        id: 'ticket_demo_2',
        subject: 'Führerscheinprüfung braucht Nachsicht',
        priority: 'NORMAL',
        status: 'IN_PROGRESS',
        description: 'OCR-Hinweis: Vorderseite erkannt, Rueckseite fehlt. Bitte neues Dokument anfordern.',
      },
    },
    {
      id: 'mock_verification_3',
      userId: 'demo-shipper',
      userName: 'Max Müller',
      userEmail: 'shipper@cargobit.eu',
      userStatus: 'ACTIVE',
      role: 'SHIPPER_COMPANY',
      companyName: 'Müller Logistics GmbH',
      type: 'KYB',
      status: 'APPROVED',
      documentType: 'BUSINESS_REGISTRATION',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      reviewedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      id: 'mock_verification_4',
      userId: 'demo-private',
      userName: 'Laura Becker',
      userEmail: 'shipper.private@cargobit.eu',
      userStatus: 'ACTIVE',
      role: 'SHIPPER_PRIVATE',
      type: 'KYC',
      status: 'REJECTED',
      documentType: 'ID_CARD',
      reviewReason: 'Dokument ist abgelaufen.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
      reviewedAt: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    },
  ],
};

const statusLabels: Record<VerificationStatus, string> = {
  PENDING: 'Ausstehend',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
};

export default function AdminVerificationsPage() {
  const [queue, setQueue] = useState<VerificationQueueResponse>(mockQueue);
  const [selected, setSelected] = useState<AdminVerificationItem | null>(mockQueue.items[0]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [typeFilter, setTypeFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('status', statusFilter);
        params.set('type', typeFilter);
        if (query) params.set('query', query);

        const response = await fetch(`/api/admin/verifications?${params.toString()}`);
        if (!response.ok) throw new Error('Verification queue unavailable');
        const payload = await response.json();
        setQueue(payload);
        setSelected(payload.items[0] || null);
      } catch (error) {
        console.warn('[AdminVerifications] using demo queue:', error);
        const filtered = filterMockQueue(statusFilter, typeFilter, query);
        setQueue(filtered);
        setSelected(filtered.items[0] || null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [statusFilter, typeFilter, query]);

  const visibleItems = queue.items;
  const selectedDetails = useMemo(() => parseReviewDetails(selected), [selected]);

  const review = async (item: AdminVerificationItem, action: 'approve' | 'reject' | 'manual_review') => {
    if ((action === 'reject' || action === 'manual_review') && !reviewReason.trim()) {
      alert('Bitte einen Prüfhinweis eintragen.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/verifications/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: reviewReason.trim(),
        }),
      });

      if (!response.ok) throw new Error('Review action failed');
      applyLocalReview(item.id, action, reviewReason.trim());
    } catch (error) {
      console.warn('[AdminVerifications] local review fallback:', error);
      applyLocalReview(item.id, action, reviewReason.trim());
    } finally {
      setReviewReason('');
      setSubmitting(false);
    }
  };

  const applyLocalReview = (id: string, action: 'approve' | 'reject' | 'manual_review', reason?: string) => {
    const nextStatus: VerificationStatus = action === 'approve'
      ? 'APPROVED'
      : action === 'reject'
        ? 'REJECTED'
        : 'PENDING';
    const now = new Date().toISOString();

    setQueue((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: nextStatus,
              reviewReason: action === 'approve' ? item.reviewReason : reason || item.reviewReason,
              reviewedAt: action === 'manual_review' ? item.reviewedAt : now,
              updatedAt: now,
            }
          : item,
      ),
    }));
    setSelected((current) =>
      current?.id === id
        ? {
            ...current,
            status: nextStatus,
            reviewReason: action === 'approve' ? current.reviewReason : reason || current.reviewReason,
            reviewedAt: action === 'manual_review' ? current.reviewedAt : now,
            updatedAt: now,
          }
        : current,
    );
  };

  return (
    <DashboardLayout title="Verifizierungen" subtitle="OCR, VIES und manuelle Prüfungen zentral bearbeiten">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Gesamt" value={queue.summary.total} icon={<FileText className="h-5 w-5" />} tone="blue" />
          <SummaryCard label="Ausstehend" value={queue.summary.pending} icon={<Clock3 className="h-5 w-5" />} tone="yellow" />
          <SummaryCard label="Freigegeben" value={queue.summary.approved} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
          <SummaryCard label="Abgelehnt" value={queue.summary.rejected} icon={<XCircle className="h-5 w-5" />} tone="red" />
        </div>

        <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nutzer, E-Mail oder Firma suchen..."
                className="w-full rounded-xl border border-white/[0.08] bg-[#06121C]/60 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-[#00D4FF]/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-white/[0.08] bg-[#06121C]/60 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="PENDING">Ausstehend</option>
              <option value="APPROVED">Freigegeben</option>
              <option value="REJECTED">Abgelehnt</option>
              <option value="all">Alle Status</option>
            </select>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-xl border border-white/[0.08] bg-[#06121C]/60 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="all">Alle Typen</option>
              <option value="KYC">KYC</option>
              <option value="KYB">KYB</option>
              <option value="DRIVER_LICENSE">Führerschein</option>
              <option value="ADR">ADR</option>
              <option value="VEHICLE">Fahrzeug</option>
            </select>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] p-5">
              <div>
                <h2 className="text-base font-semibold text-white">Review Queue</h2>
                <p className="mt-1 text-sm text-white/45">{visibleItems.length} Fälle im aktuellen Filter</p>
              </div>
              {loading && <span className="text-sm text-white/45">Lädt...</span>}
            </div>

            <div className="divide-y divide-white/[0.06]">
              {visibleItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-white/50">Keine Verifizierungen gefunden.</div>
              ) : (
                visibleItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className={`flex w-full flex-col gap-4 p-5 text-left transition hover:bg-white/[0.04] lg:flex-row lg:items-center ${
                      selected?.id === item.id ? 'bg-[#1C7ED6]/10' : ''
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <div className={`mt-1 rounded-xl p-2.5 ${statusTone(item.status)}`}>
                        {item.status === 'APPROVED'
                          ? <CheckCircle2 className="h-5 w-5" />
                          : item.status === 'REJECTED'
                            ? <XCircle className="h-5 w-5" />
                            : <ShieldCheck className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{item.userName}</p>
                          <StatusPill status={item.status} />
                        </div>
                        <p className="mt-1 truncate text-sm text-white/45">{item.userEmail}</p>
                        <p className="mt-2 text-sm text-white/65">
                          {roleLabel(item.role)} · {item.type} · {documentLabel(item.documentType)}
                        </p>
                        {item.companyName && (
                          <p className="mt-1 text-xs text-white/40">{item.companyName} · {item.companyCountry || 'EU'}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      {item.supportTicket && (
                        <span className="rounded-full border border-[#F39C12]/25 bg-[#F39C12]/10 px-3 py-1 text-xs font-medium text-[#F39C12]">
                          Ticket {item.supportTicket.priority}
                        </span>
                      )}
                      <span className="text-xs text-white/40">{relativeTime(item.createdAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <aside className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            {selected ? (
              <div className="space-y-5">
                <div>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{selected.userName}</h2>
                      <p className="text-sm text-white/45">{selected.userEmail}</p>
                    </div>
                    <StatusPill status={selected.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailStat label="Rolle" value={roleLabel(selected.role)} />
                    <DetailStat label="Typ" value={selected.type} />
                    <DetailStat label="Dokument" value={documentLabel(selected.documentType)} />
                    <DetailStat label="Erstellt" value={new Date(selected.createdAt).toLocaleDateString('de-DE')} />
                  </div>
                </div>

                {selected.documentUrl && (
                  <a
                    href={selected.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/10 p-3 text-sm text-[#00D4FF] transition hover:bg-[#00D4FF]/15"
                  >
                    <span className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4" />
                      Dokument öffnen
                    </span>
                    <span>↗</span>
                  </a>
                )}

                <div className="rounded-xl border border-white/[0.08] bg-[#06121C]/55 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <Sparkles className="h-4 w-4 text-[#00D4FF]" />
                    OCR / VIES / Regelhinweise
                  </div>
                  <div className="space-y-2 text-sm leading-6 text-white/65">
                    {selectedDetails.length ? selectedDetails.map((line) => (
                      <p key={line}>{line}</p>
                    )) : (
                      <p>Keine zusätzlichen Prüfhints vorhanden.</p>
                    )}
                  </div>
                </div>

                {selected.supportTicket && (
                  <div className="rounded-xl border border-[#F39C12]/20 bg-[#F39C12]/10 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#F39C12]">
                      <AlertTriangle className="h-4 w-4" />
                      {selected.supportTicket.subject}
                    </div>
                    <p className="whitespace-pre-line text-sm leading-6 text-white/65">
                      {selected.supportTicket.description}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <textarea
                    value={reviewReason}
                    onChange={(event) => setReviewReason(event.target.value)}
                    rows={4}
                    placeholder="Prüfhinweis für Ablehnung oder weitere manuelle Kontrolle..."
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#06121C]/70 p-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#00D4FF]/50"
                  />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => review(selected, 'approve')}
                      className="rounded-xl bg-[#2ECC71] px-3 py-3 text-sm font-semibold text-[#06121C] transition hover:brightness-110 disabled:opacity-60"
                    >
                      Freigeben
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => review(selected, 'manual_review')}
                      className="rounded-xl border border-[#F39C12]/30 bg-[#F39C12]/10 px-3 py-3 text-sm font-semibold text-[#F39C12] transition hover:bg-[#F39C12]/18 disabled:opacity-60"
                    >
                      Weiter prüfen
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => review(selected, 'reject')}
                      className="rounded-xl border border-[#E74C3C]/30 bg-[#E74C3C]/10 px-3 py-3 text-sm font-semibold text-[#E74C3C] transition hover:bg-[#E74C3C]/18 disabled:opacity-60"
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-sm text-white/45">Wähle einen Fall aus der Queue.</div>
            )}
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: 'blue' | 'yellow' | 'green' | 'red';
}) {
  const colors = {
    blue: 'text-[#00D4FF] bg-[#00D4FF]/10 border-[#00D4FF]/20',
    yellow: 'text-[#F39C12] bg-[#F39C12]/10 border-[#F39C12]/20',
    green: 'text-[#2ECC71] bg-[#2ECC71]/10 border-[#2ECC71]/20',
    red: 'text-[#E74C3C] bg-[#E74C3C]/10 border-[#E74C3C]/20',
  };

  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-5 shadow-xl shadow-black/15 backdrop-blur-xl">
      <div className={`mb-4 inline-flex rounded-xl border p-2.5 ${colors[tone]}`}>{icon}</div>
      <p className="text-3xl font-semibold tracking-normal text-white">{value}</p>
      <p className="mt-1 text-sm text-white/45">{label}</p>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-white">{value || '-'}</p>
    </div>
  );
}

function StatusPill({ status }: { status: VerificationStatus }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(status)}`}>
      {statusLabels[status]}
    </span>
  );
}

function statusTone(status: VerificationStatus) {
  switch (status) {
    case 'APPROVED':
      return 'border border-[#2ECC71]/25 bg-[#2ECC71]/10 text-[#2ECC71]';
    case 'REJECTED':
      return 'border border-[#E74C3C]/25 bg-[#E74C3C]/10 text-[#E74C3C]';
    case 'PENDING':
    default:
      return 'border border-[#F39C12]/25 bg-[#F39C12]/10 text-[#F39C12]';
  }
}

function roleLabel(role?: string) {
  const labels: Record<string, string> = {
    SHIPPER_PRIVATE: 'Verlader Privat',
    SHIPPER_COMPANY: 'Verlader Gewerbe',
    CARRIER: 'Spedition / Transporteur',
    DRIVER_SELF_EMPLOYED: 'Solo-Transporteur',
    DISPATCHER: 'Disposition',
    ADMIN: 'Admin',
    SUPPORT: 'Support',
    MARKETER: 'Marketing',
  };
  return labels[role || ''] || role || '-';
}

function documentLabel(documentType?: string) {
  const labels: Record<string, string> = {
    ID_CARD: 'Personalausweis',
    PASSPORT: 'Reisepass',
    DRIVERS_LICENSE: 'Führerschein',
    DRIVER_CARD: 'Fahrerkarte',
    COMMERCIAL_REGISTER_EXTRACT: 'Handelsregister',
    BUSINESS_REGISTRATION: 'Gewerbeschein',
    VAT_CERTIFICATE: 'USt-ID / Steuer',
    BENEFICIAL_OWNERS_DECLARATION: 'Wirtschaftlich Berechtigte',
    TRANSPORT_LICENSE: 'Transportlizenz',
    FLEET_INSURANCE: 'Flottenversicherung',
    CMR_INSURANCE: 'CMR Versicherung',
    VEHICLE_REGISTRATION: 'Fahrzeugschein',
    ADR_CERTIFICATE: 'ADR-Zertifikat',
  };
  return labels[documentType || ''] || documentType || '-';
}

function parseReviewDetails(item: AdminVerificationItem | null) {
  if (!item) return [];

  const structured = buildStructuredReviewLines(item.reviewData);
  const raw = [
    item.reviewReason,
    item.supportTicket?.description,
    item.supportTicket?.lastMessage,
  ].filter(Boolean).join('\n');

  const rawLines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);

  return Array.from(new Set([...structured, ...rawLines])).slice(0, 14);
}

function buildStructuredReviewLines(reviewData?: VerificationReviewData | null) {
  if (!reviewData) return [];

  const lines: string[] = [];

  if (typeof reviewData.score === 'number') {
    lines.push(`Score: ${reviewData.score}`);
  }

  if (reviewData.providerMode) {
    lines.push(`Prüfmodus: ${reviewData.providerMode}`);
  }

  if (reviewData.costPolicy?.mode) {
    lines.push(`Kostenmodus: ${reviewData.costPolicy.mode}`);
  }

  if (reviewData.costPolicy?.paidProviderReason) {
    lines.push(`Provider-Hinweis: ${reviewData.costPolicy.paidProviderReason}`);
  }

  for (const check of reviewData.registryChecks || []) {
    lines.push(`${(check.provider || 'Register').toUpperCase()}: ${check.status || '-'}${check.message ? ` (${check.message})` : ''}`);
  }

  for (const document of reviewData.documents || []) {
    if (!document.ocr) continue;
    const fields = [
      document.ocr.extractedFields?.vatNumbers?.length ? `USt-ID: ${document.ocr.extractedFields.vatNumbers.join(', ')}` : undefined,
      document.ocr.extractedFields?.documentNumbers?.length ? `Nummern: ${document.ocr.extractedFields.documentNumbers.join(', ')}` : undefined,
      document.ocr.extractedFields?.expiryDate ? `Ablauf: ${document.ocr.extractedFields.expiryDate}` : undefined,
    ].filter(Boolean).join('; ');

    lines.push(
      `${document.type || 'Dokument'} OCR: ${document.ocr.status || '-'} / ${document.ocr.source || '-'} / ${document.ocr.confidence ?? 'n/a'}%${fields ? ` (${fields})` : ''}`,
    );

    for (const warning of document.ocr.warnings || []) {
      lines.push(`OCR-Warnung: ${warning}`);
    }
  }

  for (const missing of reviewData.missingRequirements || []) {
    lines.push(`Fehlt: ${missing.label || missing.verificationType || 'Unterlage'}`);
  }

  for (const reason of reviewData.manualReviewReasons || []) {
    lines.push(`Hinweis: ${reason}`);
  }

  return lines;
}

function relativeTime(value: string) {
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return new Date(value).toLocaleDateString('de-DE');
}

function filterMockQueue(status: string, type: string, query: string): VerificationQueueResponse {
  const normalizedQuery = query.toLowerCase().trim();
  const items = mockQueue.items.filter((item) => {
    const statusMatch = status === 'all' || item.status === status;
    const typeMatch = type === 'all' || item.type === type;
    const queryMatch = !normalizedQuery || [
      item.userName,
      item.userEmail,
      item.companyName,
      item.role,
    ].filter(Boolean).some((value) => value!.toLowerCase().includes(normalizedQuery));

    return statusMatch && typeMatch && queryMatch;
  });

  return {
    items,
    summary: {
      total: mockQueue.items.length,
      pending: mockQueue.items.filter((item) => item.status === 'PENDING').length,
      approved: mockQueue.items.filter((item) => item.status === 'APPROVED').length,
      rejected: mockQueue.items.filter((item) => item.status === 'REJECTED').length,
    },
  };
}
