'use client';

import { useState } from 'react';
import { Activity, Play, RefreshCw, ShieldCheck } from 'lucide-react';

type OperationAction = 'payout-health' | 'payout-processing' | 'payment-reconciliation';

type OperationResult = {
  success?: boolean;
  action?: OperationAction;
  actor?: string;
  result?: unknown;
  error?: string;
  code?: string;
};

const ACTIONS: Array<{
  action: OperationAction;
  title: string;
  description: string;
  button: string;
  tone: 'cyan' | 'green' | 'orange';
  icon: typeof Activity;
}> = [
  {
    action: 'payout-health',
    title: 'Payout Health prüfen',
    description: 'Prüft Warteschlange, Locks und letzte Scheduler-Läufe ohne Auszahlungen auszulösen.',
    button: 'Prüfen',
    tone: 'cyan',
    icon: Activity,
  },
  {
    action: 'payment-reconciliation',
    title: 'Reconciliation testen',
    description: 'Startet einen manuellen Abgleich der offenen Zahlungs- und Payout-Differenzen.',
    button: 'Starten',
    tone: 'green',
    icon: RefreshCw,
  },
  {
    action: 'payout-processing',
    title: 'Payout Scheduler ausführen',
    description: 'Verarbeitet fällige Auszahlungen und schreibt Reconciliation-Ergebnisse. Nur bewusst auslösen.',
    button: 'Ausführen',
    tone: 'orange',
    icon: Play,
  },
];

export function OperationsCronActions() {
  const [runningAction, setRunningAction] = useState<OperationAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<OperationAction | null>(null);
  const [result, setResult] = useState<OperationResult | null>(null);

  async function runAction(action: OperationAction, confirmed = false) {
    if (action === 'payout-processing' && !confirmed) {
      setConfirmAction(action);
      setResult(null);
      return;
    }

    setRunningAction(action);
    setConfirmAction(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/operations/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          confirmation: confirmed ? 'RUN_PAYOUTS' : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      setResult({
        success: response.ok && payload.success !== false,
        ...payload,
      });
    } catch (error) {
      setResult({
        success: false,
        action,
        error: error instanceof Error ? error.message : 'Operation konnte nicht ausgeführt werden.',
      });
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <section className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/10 p-3 text-[#00D4FF]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Manuelle Operations-Aktionen</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/45">
            Für Smoke Tests nach Deployments und kontrollierte Admin-Auslösung. Produktive Aktionen bleiben durch Admin-Auth geschützt.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {ACTIONS.map((item) => {
          const Icon = item.icon;
          const isRunning = runningAction === item.action;

          return (
            <article key={item.action} className="rounded-2xl border border-white/[0.08] bg-[#06121C]/45 p-4">
              <div className="flex items-start gap-3">
                <div className={iconClass(item.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">{item.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-white/45">{item.description}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => runAction(item.action)}
                disabled={runningAction !== null}
                className={buttonClass(item.tone)}
              >
                {isRunning ? 'Läuft...' : item.button}
              </button>

              {confirmAction === item.action && (
                <div className="mt-4 rounded-xl border border-[#F39C12]/25 bg-[#F39C12]/10 p-3">
                  <p className="text-sm font-semibold text-[#ffd79a]">Payout Scheduler wirklich ausführen?</p>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    Diese Aktion kann fällige Auszahlungen verarbeiten und Reconciliation-Einträge schreiben.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => runAction(item.action, true)}
                      className="rounded-lg border border-[#F39C12]/30 bg-[#F39C12]/15 px-3 py-2 text-xs font-semibold text-[#ffd79a] transition hover:bg-[#F39C12]/20"
                    >
                      Bestätigen
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/55 transition hover:text-white"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {result && (
        <div className={`mt-5 rounded-2xl border p-4 ${result.success ? 'border-[#2ECC71]/20 bg-[#2ECC71]/10' : 'border-[#E74C3C]/20 bg-[#E74C3C]/10'}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className={`font-semibold ${result.success ? 'text-[#8ff0b9]' : 'text-[#ffb5ab]'}`}>
              {result.success ? 'Aktion erfolgreich' : 'Aktion fehlgeschlagen'}
            </p>
            {result.action && <p className="font-mono text-xs text-white/40">{result.action}</p>}
          </div>
          {result.error && <p className="mt-2 text-sm leading-6 text-[#ffb5ab]">{result.error}</p>}
          <AutoReleaseSummary result={result.result} />
          <pre className="mt-4 max-h-72 overflow-auto rounded-xl border border-white/[0.08] bg-black/20 p-3 text-xs leading-5 text-white/60">
            {JSON.stringify(result.result || result, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}

function AutoReleaseSummary({ result }: { result: unknown }) {
  const queue = extractAutoReleaseQueue(result);
  if (!queue) return null;

  return (
    <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/20 p-4">
      <p className="text-sm font-semibold text-white">Automatische Wallet-Freigaben</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <SummaryMetric label="Gesamt" value={queue.total} />
        <SummaryMetric label="Bereit" value={queue.ready} tone="green" />
        <SummaryMetric label="Blockiert" value={queue.blocked} tone="orange" />
        <SummaryMetric label="Freigegeben" value={queue.released} tone="cyan" />
      </div>
      {queue.rows?.length ? (
        <div className="mt-4 space-y-2">
          {queue.rows.slice(0, 5).map((row) => (
            <div key={row.orderId} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-white/55">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-mono text-white/70">{row.orderId}</span>
                <span className={row.status === 'ready' ? 'text-[#8ff0b9]' : row.status === 'released' ? 'text-[#b9f4ff]' : 'text-[#ffd79a]'}>
                  {row.status}
                </span>
              </div>
              {row.releaseEligibleAt ? <p className="mt-1">Freigabe ab: {new Date(row.releaseEligibleAt).toLocaleString('de-DE')}</p> : null}
              {row.blockers?.[0] ? <p className="mt-1 text-white/40">{row.blockers[0]}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SummaryMetric({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'green' | 'orange' | 'cyan' }) {
  const color = tone === 'green'
    ? 'text-[#8ff0b9]'
    : tone === 'orange'
      ? 'text-[#ffd79a]'
      : tone === 'cyan'
        ? 'text-[#b9f4ff]'
        : 'text-white';

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function extractAutoReleaseQueue(result: unknown): null | {
  total: number;
  ready: number;
  blocked: number;
  released: number;
  rows?: Array<{
    orderId: string;
    status: string;
    releaseEligibleAt?: string | null;
    blockers?: string[];
  }>;
} {
  if (!result || typeof result !== 'object') return null;
  const value = result as Record<string, unknown>;
  const queue = (value.autoReleaseQueue || (value.health as Record<string, unknown> | undefined)?.autoReleaseQueue) as Record<string, unknown> | undefined;
  if (!queue || typeof queue !== 'object') return null;

  return {
    total: Number(queue.total || 0),
    ready: Number(queue.ready || 0),
    blocked: Number(queue.blocked || 0),
    released: Number(queue.released || 0),
    rows: Array.isArray(queue.rows) ? queue.rows as Array<{
      orderId: string;
      status: string;
      releaseEligibleAt?: string | null;
      blockers?: string[];
    }> : undefined,
  };
}

function iconClass(tone: 'cyan' | 'green' | 'orange') {
  const tones = {
    cyan: 'border-[#00D4FF]/20 bg-[#00D4FF]/10 text-[#00D4FF]',
    green: 'border-[#2ECC71]/20 bg-[#2ECC71]/10 text-[#8ff0b9]',
    orange: 'border-[#F39C12]/20 bg-[#F39C12]/10 text-[#ffd79a]',
  };

  return `rounded-2xl border p-3 ${tones[tone]}`;
}

function buttonClass(tone: 'cyan' | 'green' | 'orange') {
  const tones = {
    cyan: 'border-[#00D4FF]/30 bg-[#00D4FF]/10 text-[#b9f4ff] hover:bg-[#00D4FF]/15',
    green: 'border-[#2ECC71]/30 bg-[#2ECC71]/10 text-[#8ff0b9] hover:bg-[#2ECC71]/15',
    orange: 'border-[#F39C12]/30 bg-[#F39C12]/10 text-[#ffd79a] hover:bg-[#F39C12]/15',
  };

  return `mt-5 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${tones[tone]}`;
}
