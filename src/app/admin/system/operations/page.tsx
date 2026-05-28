import { AlertTriangle, CheckCircle2, CircleDot, Clock3, ShieldCheck, XCircle } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { OperationsCronActions } from '@/components/admin/operations-cron-actions';
import { db } from '@/lib/db';
import { getOperationsReadiness, OperationsReadinessCheck } from '@/lib/operations-readiness';

export const dynamic = 'force-dynamic';

type OperationAuditEntry = {
  id: string;
  action: string;
  success?: boolean;
  adminEmail?: string;
  createdAt: Date;
  detail?: string;
};

export default async function AdminOperationsPage() {
  const report = getOperationsReadiness();
  const recentAuditLogs = await getRecentOperationAuditLogs();

  return (
    <DashboardLayout title="Operations Center" subtitle="Cron Jobs, Reconciliation und produktive Automatisierung">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-6 shadow-2xl shadow-black/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,212,255,0.16),transparent_34%),linear-gradient(135deg,rgba(46,204,113,0.12),transparent_42%)]" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/70">
                <span className={`h-2 w-2 rounded-full ${report.ready ? 'bg-[#2ECC71]' : 'bg-[#F39C12]'}`} />
                {report.ready ? 'Operations bereit' : 'Operations offen'}
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-white">Produktions-Automatisierung</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
                Überwache und teste geplante Jobs für Zahlungsabgleich, Payout-Verarbeitung und sichere Cron-Ausführung.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border border-white/[0.08] bg-[#06121C]/60 p-5 text-center shadow-xl shadow-[#1C7ED6]/10">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/35">Readiness</p>
                <p className="mt-2 text-5xl font-semibold text-white">{report.score}%</p>
                <p className={`mt-2 text-sm ${report.ready ? 'text-[#8ff0b9]' : 'text-white/45'}`}>
                  {report.ready ? 'Bereit' : `${report.missing.length} offen`}
                </p>
              </div>
              <div className="rounded-[18px] border border-white/[0.08] bg-[#06121C]/60 p-5 text-center shadow-xl shadow-[#00D4FF]/10">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/35">Cron Jobs</p>
                <p className="mt-2 text-5xl font-semibold text-white">{report.cronJobs.length}</p>
                <p className="mt-2 text-sm text-white/45">Vercel geplant</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {report.checks.map((check) => (
            <OperationsCheckCard key={check.id} check={check} />
          ))}
        </section>

        <section className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/10 p-3 text-[#00D4FF]">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Geplante Jobs</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-white/45">
                Diese Jobs werden über Vercel Cron geplant und benötigen in Production ein gesetztes `CRON_SECRET`.
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {report.cronJobs.map((job) => (
              <article key={job.path} className="rounded-2xl border border-white/[0.08] bg-[#06121C]/45 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">{job.label}</p>
                    <p className="mt-2 text-sm leading-6 text-white/45">{job.description}</p>
                    <p className="mt-3 font-mono text-xs text-[#00D4FF]">{job.path}</p>
                  </div>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1 font-mono text-xs text-white/60">
                    {job.schedule}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <OperationsCronActions />

        <OperationsAuditPanel entries={recentAuditLogs} />
      </div>
    </DashboardLayout>
  );
}

function OperationsCheckCard({ check }: { check: OperationsReadinessCheck }) {
  const isReady = check.status === 'ready';
  const isMissing = check.status === 'missing';

  return (
    <article className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {isReady ? (
              <CheckCircle2 className="h-4 w-4 text-[#2ECC71]" />
            ) : isMissing ? (
              <XCircle className="h-4 w-4 text-[#E74C3C]" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-[#F39C12]" />
            )}
            <h3 className="font-semibold text-white">{check.label}</h3>
            {check.required && (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                Pflicht
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-white/45">{check.description}</p>
          {check.detail && <p className="mt-2 text-xs leading-5 text-[#ffd79a]">{check.detail}</p>}
          {check.maskedValue && <p className="mt-2 font-mono text-xs text-white/35">{check.maskedValue}</p>}
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#06121C]/45 p-3">
          {isReady ? (
            <ShieldCheck className="h-5 w-5 text-[#2ECC71]" />
          ) : (
            <CircleDot className="h-5 w-5 text-[#F39C12]" />
          )}
        </div>
      </div>
    </article>
  );
}

function OperationsAuditPanel({ entries }: { entries: OperationAuditEntry[] }) {
  return (
    <section className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-2xl border border-[#1C7ED6]/20 bg-[#1C7ED6]/10 p-3 text-[#00D4FF]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Letzte Admin-Operationen</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/45">
            Audit-Spur für manuelle Reconciliation- und Payout-Aktionen.
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#06121C]/45 p-4 text-sm text-white/45">
          Noch keine manuellen Operations-Aktionen protokolliert.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-white/[0.08] bg-[#06121C]/45 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.success === false ? (
                      <XCircle className="h-4 w-4 text-[#E74C3C]" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-[#2ECC71]" />
                    )}
                    <p className="font-semibold text-white">{entry.action}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      entry.success === false
                        ? 'bg-[#E74C3C]/10 text-[#ffb5ab]'
                        : 'bg-[#2ECC71]/10 text-[#8ff0b9]'
                    }`}>
                      {entry.success === false ? 'Fehler' : 'Erfolgreich'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/45">
                    {entry.adminEmail || 'Admin'} · {entry.createdAt.toLocaleString('de-DE')}
                  </p>
                  {entry.detail && <p className="mt-2 text-xs leading-5 text-white/35">{entry.detail}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

async function getRecentOperationAuditLogs(): Promise<OperationAuditEntry[]> {
  try {
    const logs = await db.auditLog.findMany({
      where: { entityType: 'admin_operation' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        entityId: true,
        dataAfter: true,
        createdAt: true,
      },
    });

    return logs.map((log) => {
      const data = parseAuditData(log.dataAfter);
      const result = data.result && typeof data.result === 'object' ? data.result as Record<string, unknown> : {};
      const detailParts = [
        typeof result.duration === 'number' ? `Dauer: ${result.duration}ms` : undefined,
        typeof result.pendingProcessed === 'number' ? `Payouts: ${result.pendingProcessed}` : undefined,
        typeof result.processed === 'number' ? `Verarbeitet: ${result.processed}` : undefined,
        typeof result.warnings === 'number' ? `Hinweise: ${result.warnings}` : undefined,
        typeof result.errors === 'number' ? `Fehler: ${result.errors}` : undefined,
      ].filter(Boolean);

      return {
        id: log.id,
        action: typeof data.action === 'string' ? data.action : log.entityId || 'admin_operation',
        success: typeof data.success === 'boolean' ? data.success : undefined,
        adminEmail: typeof data.adminEmail === 'string' ? data.adminEmail : undefined,
        createdAt: log.createdAt,
        detail: detailParts.join(' · ') || undefined,
      };
    });
  } catch (error) {
    console.error('[AdminOperationsPage] Failed to load operation audit logs:', error);
    return [];
  }
}

function parseAuditData(value: string | null) {
  if (!value) return {} as Record<string, unknown>;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}
