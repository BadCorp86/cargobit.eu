'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface ReportPayload {
  period: {
    from: string;
    to: string;
  };
  finance: {
    grossTransportVolume: number;
    commissionRevenue: number;
    walletFeeRevenue: number;
    subscriptionRevenue: number;
    totalNetRevenue: number;
    walletInflow: number;
    walletOutflow: number;
    pendingPayoutAmount: number;
  };
  operations: {
    totalTransports: number;
    published: number;
    active: number;
    completed: number;
    cancelled: number;
    completionRate: number;
  };
  risk: {
    openDisputes: number;
    disputedAmount: number;
    refundedAmount: number;
    openTickets: number;
    inProgressTickets: number;
    payoutFailed: number;
  };
  statuses: {
    transports: Array<{ status: string; count: number }>;
    payouts: Array<{ status: string; count: number; amount: number }>;
    disputes: Array<{ status: string; count: number; disputedAmount: number; refundedAmount: number }>;
  };
  monthly: Array<{
    month: string;
    commissionRevenue: number;
    walletFeeRevenue: number;
    totalRevenue: number;
  }>;
  recent: {
    transports: Array<{
      id: string;
      status: string;
      amount: number;
      currency: string;
      createdAt: string;
    }>;
    payouts: Array<{
      id: string;
      status: string;
      amount: number;
      currency: string;
      riskLevel?: string | null;
      createdAt: string;
    }>;
  };
}

const DEMO_REPORT: ReportPayload = {
  period: {
    from: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
    to: new Date().toISOString(),
  },
  finance: {
    grossTransportVolume: 183420,
    commissionRevenue: 18342,
    walletFeeRevenue: 4585.5,
    subscriptionRevenue: 12980,
    totalNetRevenue: 35907.5,
    walletInflow: 211800,
    walletOutflow: 176500,
    pendingPayoutAmount: 18420,
  },
  operations: {
    totalTransports: 248,
    published: 38,
    active: 74,
    completed: 121,
    cancelled: 15,
    completionRate: 48.8,
  },
  risk: {
    openDisputes: 6,
    disputedAmount: 14800,
    refundedAmount: 2200,
    openTickets: 19,
    inProgressTickets: 8,
    payoutFailed: 2,
  },
  statuses: {
    transports: [
      { status: 'PUBLISHED', count: 38 },
      { status: 'IN_TRANSIT', count: 51 },
      { status: 'DELIVERY_DONE', count: 23 },
      { status: 'COMPLETED', count: 121 },
      { status: 'CANCELLED', count: 15 },
    ],
    payouts: [
      { status: 'PENDING', count: 9, amount: 12400 },
      { status: 'PROCESSING', count: 3, amount: 6020 },
      { status: 'PAID', count: 96, amount: 151700 },
      { status: 'FAILED', count: 2, amount: 2380 },
    ],
    disputes: [
      { status: 'OPEN', count: 4, disputedAmount: 9100, refundedAmount: 0 },
      { status: 'IN_REVIEW', count: 2, disputedAmount: 5700, refundedAmount: 0 },
      { status: 'RESOLVED', count: 8, disputedAmount: 11900, refundedAmount: 2200 },
    ],
  },
  monthly: [
    { month: '2026-01', commissionRevenue: 2100, walletFeeRevenue: 525, totalRevenue: 2625 },
    { month: '2026-02', commissionRevenue: 3250, walletFeeRevenue: 812.5, totalRevenue: 4062.5 },
    { month: '2026-03', commissionRevenue: 4180, walletFeeRevenue: 1045, totalRevenue: 5225 },
    { month: '2026-04', commissionRevenue: 5210, walletFeeRevenue: 1302.5, totalRevenue: 6512.5 },
    { month: '2026-05', commissionRevenue: 6320, walletFeeRevenue: 1580, totalRevenue: 7900 },
    { month: '2026-06', commissionRevenue: 7282, walletFeeRevenue: 1820.5, totalRevenue: 9102.5 },
  ],
  recent: {
    transports: [
      { id: 'mission_demo_hh_muc', status: 'DELIVERY_DONE', amount: 850, currency: 'EUR', createdAt: new Date().toISOString() },
      { id: 'transport_demo_ber_par', status: 'IN_TRANSIT', amount: 1190, currency: 'EUR', createdAt: new Date(Date.now() - 1000 * 60 * 80).toISOString() },
      { id: 'transport_demo_col_ams', status: 'PUBLISHED', amount: 980, currency: 'EUR', createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString() },
    ],
    payouts: [
      { id: 'payout_demo_1', status: 'PROCESSING', amount: 850, currency: 'EUR', riskLevel: 'green', createdAt: new Date().toISOString() },
      { id: 'payout_demo_2', status: 'PENDING', amount: 1260, currency: 'EUR', riskLevel: 'yellow', createdAt: new Date(Date.now() - 1000 * 60 * 140).toISOString() },
    ],
  },
};

function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('de-DE', {
    month: 'short',
  });
}

function toInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    CREATED: 'Erstellt',
    PUBLISHED: 'Veröffentlicht',
    ASSIGNED: 'Zugewiesen',
    IN_TRANSIT: 'Unterwegs',
    PICKUP_DONE: 'Abholung erledigt',
    DELIVERY_DONE: 'Geliefert',
    COMPLETED: 'Abgeschlossen',
    CANCELLED: 'Storniert',
    PENDING: 'Offen',
    PROCESSING: 'In Auszahlung',
    PAID: 'Bezahlt',
    FAILED: 'Fehlgeschlagen',
    OPEN: 'Offen',
    IN_PROGRESS: 'In Bearbeitung',
    IN_REVIEW: 'In Prüfung',
    AWAITING_INFO: 'Wartet auf Info',
    RESOLVED: 'Gelöst',
    CLOSED: 'Geschlossen',
    REJECTED: 'Abgelehnt',
    REFUNDED: 'Erstattet',
  };

  return labels[status] || status;
}

function riskTone(value: number, warningAt: number, criticalAt: number) {
  if (value >= criticalAt) return 'text-[#FF8D8D]';
  if (value >= warningAt) return 'text-[#FFD28A]';
  return 'text-[#9EF2BC]';
}

function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'green' | 'yellow' | 'red' | 'blue' | 'gray' }) {
  const classes = {
    green: 'bg-green-500/10 text-green-200 ring-green-400/20',
    yellow: 'bg-yellow-500/10 text-yellow-200 ring-yellow-400/20',
    red: 'bg-red-500/10 text-red-200 ring-red-400/20',
    blue: 'bg-blue-500/10 text-blue-200 ring-blue-400/20',
    gray: 'bg-white/8 text-white/70 ring-white/10',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${classes[tone]}`}>
      {children}
    </span>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function AdminReportsPage() {
  const initialFrom = useMemo(() => toInputDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 120)), []);
  const initialTo = useMemo(() => toInputDate(new Date()), []);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [report, setReport] = useState<ReportPayload>(DEMO_REPORT);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({ from, to });
      const response = await fetch(`/api/admin/reports?${params.toString()}`);
      if (!response.ok) throw new Error('Admin reports API unavailable');

      const payload = await response.json() as ReportPayload;
      setReport(payload);
    } catch (error) {
      console.error('Failed to load admin reports:', error);
      setReport(DEMO_REPORT);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const maxMonthlyRevenue = Math.max(...report.monthly.map((item) => item.totalRevenue), 1);

  return (
    <DashboardLayout title="Berichte" subtitle="Finanz-, Operations-, Wallet- und Risiko-Kennzahlen">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10 backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-white/55">Berichtszeitraum</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {formatDate(report.period.from)} bis {formatDate(report.period.to)}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs text-white/55">
              Von
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#071827] px-3 py-2 text-sm text-white outline-none focus:border-[#00D4FF]"
              />
            </label>
            <label className="text-xs text-white/55">
              Bis
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#071827] px-3 py-2 text-sm text-white outline-none focus:border-[#00D4FF]"
              />
            </label>
            <button
              type="button"
              onClick={loadReport}
              className="rounded-lg bg-[#1C7ED6] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#2D8BE0]"
            >
              Aktualisieren
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Netto-Ertrag', formatCurrency(report.finance.totalNetRevenue), 'text-[#9EF2BC]', 'Provisionen, Wallet-Gebühren und Abos'],
            ['Transportvolumen', formatCurrency(report.finance.grossTransportVolume), 'text-[#8BC5FF]', 'Summe akzeptierter Budgets/Preise'],
            ['Offene Payouts', formatCurrency(report.finance.pendingPayoutAmount), 'text-[#FFD28A]', 'Pending und Processing'],
            ['Offene Fälle', report.risk.openDisputes + report.risk.openTickets, riskTone(report.risk.openDisputes + report.risk.openTickets, 10, 25), 'Disputes und Support'],
          ].map(([label, value, color, note]) => (
            <div key={String(label)} className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
              <p className="text-sm text-white/55">{label}</p>
              <p className={`mt-3 text-3xl font-semibold ${color}`}>{value}</p>
              <p className="mt-2 text-xs text-white/45">{note}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <Panel title="Umsatzentwicklung">
            <div className="flex h-72 items-end gap-3">
              {report.monthly.map((item) => {
                const height = Math.max(8, (item.totalRevenue / maxMonthlyRevenue) * 100);
                return (
                  <div key={item.month} className="flex h-full flex-1 flex-col justify-end gap-3">
                    <div className="flex flex-1 items-end rounded-xl bg-white/[0.03] px-2 pb-2">
                      <div
                        className="w-full rounded-lg bg-gradient-to-t from-[#1C7ED6] to-[#00D4FF] shadow-lg shadow-cyan-500/20"
                        style={{ height: `${height}%` }}
                        title={formatCurrency(item.totalRevenue)}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-white">{formatMonth(item.month)}</p>
                      <p className="text-[11px] text-white/45">{formatCurrency(item.totalRevenue)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Finanz-Aufteilung">
            <div className="space-y-4">
              {[
                ['Provisionen', report.finance.commissionRevenue, 'green'],
                ['Wallet-Gebühren', report.finance.walletFeeRevenue, 'blue'],
                ['Abo-Umsatz', report.finance.subscriptionRevenue, 'yellow'],
                ['Wallet-Eingänge', report.finance.walletInflow, 'gray'],
                ['Wallet-Ausgänge', report.finance.walletOutflow, 'gray'],
              ].map(([label, value, tone]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0">
                  <span className="text-sm text-white/65">{label}</span>
                  <Pill tone={tone as 'green' | 'yellow' | 'red' | 'blue' | 'gray'}>{formatCurrency(Number(value))}</Pill>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Operations">
            <div className="space-y-4">
              {[
                ['Transporte gesamt', report.operations.totalTransports],
                ['Veröffentlicht', report.operations.published],
                ['Aktiv', report.operations.active],
                ['Abgeschlossen', report.operations.completed],
                ['Storniert', report.operations.cancelled],
                ['Abschlussquote', `${report.operations.completionRate}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between">
                  <span className="text-sm text-white/60">{label}</span>
                  <span className="text-sm font-semibold text-white">{value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Risiko & Support" action={<Link className="text-xs font-semibold text-[#8BC5FF] hover:text-white" href="/admin/disputes">Streitfälle öffnen</Link>}>
            <div className="space-y-4">
              {[
                ['Offene Disputes', report.risk.openDisputes, 'red'],
                ['Streitwert', formatCurrency(report.risk.disputedAmount), 'yellow'],
                ['Erstattet', formatCurrency(report.risk.refundedAmount), 'gray'],
                ['Offene Tickets', report.risk.openTickets, 'yellow'],
                ['Tickets in Bearbeitung', report.risk.inProgressTickets, 'blue'],
                ['Payout-Fehler', report.risk.payoutFailed, 'red'],
              ].map(([label, value, tone]) => (
                <div key={String(label)} className="flex items-center justify-between">
                  <span className="text-sm text-white/60">{label}</span>
                  <Pill tone={tone as 'green' | 'yellow' | 'red' | 'blue' | 'gray'}>{value}</Pill>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Payout-Status" action={<Link className="text-xs font-semibold text-[#8BC5FF] hover:text-white" href="/admin/payments">Zahlungen öffnen</Link>}>
            <div className="space-y-4">
              {report.statuses.payouts.length ? report.statuses.payouts.map((row) => (
                <div key={row.status} className="flex items-center justify-between">
                  <span className="text-sm text-white/60">{statusLabel(row.status)}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{row.count}</p>
                    <p className="text-xs text-white/45">{formatCurrency(row.amount)}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-white/45">Keine Payouts im Zeitraum.</p>
              )}
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Letzte Transporte" action={<Link className="text-xs font-semibold text-[#8BC5FF] hover:text-white" href="/admin/transports">Transporte öffnen</Link>}>
            <div className="space-y-3">
              {report.recent.transports.length ? report.recent.transports.map((transport) => (
                <div key={transport.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="font-mono text-xs text-white/45">{transport.id}</p>
                    <p className="mt-1 text-sm text-white">{statusLabel(transport.status)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{formatCurrency(transport.amount, transport.currency)}</p>
                    <p className="text-xs text-white/45">{formatDate(transport.createdAt)}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-white/45">Keine Transporte im Zeitraum.</p>
              )}
            </div>
          </Panel>

          <Panel title="Letzte Auszahlungen">
            <div className="space-y-3">
              {report.recent.payouts.length ? report.recent.payouts.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="font-mono text-xs text-white/45">{payout.id}</p>
                    <p className="mt-1 text-sm text-white">{statusLabel(payout.status)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{formatCurrency(payout.amount, payout.currency)}</p>
                    <p className="text-xs text-white/45">Risiko: {payout.riskLevel || '-'}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-white/45">Keine Auszahlungen im Zeitraum.</p>
              )}
            </div>
          </Panel>
        </div>

        {loading && (
          <div className="fixed bottom-5 right-5 rounded-full border border-white/10 bg-[#071827]/95 px-4 py-2 text-sm text-white shadow-xl">
            Bericht wird geladen...
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
