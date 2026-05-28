import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Copy,
  CreditCard,
  Database,
  ExternalLink,
  ReceiptText,
  Webhook,
  XCircle,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { getStripeReadiness, StripeReadinessItem } from '@/lib/stripe-readiness';
import { DatabaseReadinessCheck, DatabaseReadinessReport, getDatabaseReadiness } from '@/lib/database-readiness';
import { getOperationsReadiness, OperationsReadinessReport } from '@/lib/operations-readiness';

const ICONS = {
  core: CreditCard,
  webhooks: Webhook,
  prices: ReceiptText,
  tax: CircleDot,
};

export default async function AdminStripeReadinessPage() {
  const report = getStripeReadiness();
  const databaseReport = await getDatabaseReadiness();
  const operationsReport = getOperationsReadiness();
  const productionReady = report.ready && databaseReport.ready && operationsReport.ready;

  return (
    <DashboardLayout title="Stripe Setup" subtitle="Checkout, Abo-Preise, Webhooks, Automatisierung und Rechnungsbereitschaft">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-6 shadow-2xl shadow-black/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,212,255,0.18),transparent_34%),linear-gradient(135deg,rgba(28,126,214,0.14),transparent_42%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/70">
                <span className={`h-2 w-2 rounded-full ${productionReady ? 'bg-[#2ECC71]' : 'bg-[#F39C12]'}`} />
                {productionReady ? 'Production ready' : 'Setup unvollständig'}
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-white">Stripe Zahlungszentrale</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
                Hier sieht der Admin, ob Stripe Checkout, Abo-Preise, Webhook-Secrets, Datenbank-Schema, Cron-Jobs und Rechnungsversand richtig vorbereitet sind.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <ReadinessScoreCard
                label="Stripe"
                score={report.score}
                ready={report.ready}
                detail={report.missing.length === 0 ? 'Pflichtwerte gesetzt' : `${report.missing.length} Pflichtwerte fehlen`}
              />
              <ReadinessScoreCard
                label="Datenbank"
                score={databaseReport.score}
                ready={databaseReport.ready}
                detail={databaseReport.ready ? 'Schema bereit' : `${databaseReport.missing.length} Prüfungen offen`}
              />
              <ReadinessScoreCard
                label="Betrieb"
                score={operationsReport.score}
                ready={operationsReport.ready}
                detail={operationsReport.ready ? 'Cron bereit' : `${operationsReport.missing.length} Prüfungen offen`}
              />
            </div>
          </div>
        </section>

        {(report.missing.length > 0 || report.warnings.length > 0) && (
          <section className="grid gap-4 lg:grid-cols-2">
            {report.missing.length > 0 && (
              <div className="rounded-[18px] border border-[#E74C3C]/20 bg-[#E74C3C]/10 p-5">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-[#E74C3C]" />
                  <h3 className="font-semibold text-white">Fehlende Pflichtwerte</h3>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {report.missing.map((key) => (
                    <span key={key} className="rounded-full border border-[#E74C3C]/25 bg-[#06121C]/50 px-3 py-1 text-xs font-medium text-[#ffb5ab]">
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {report.warnings.length > 0 && (
              <div className="rounded-[18px] border border-[#F39C12]/20 bg-[#F39C12]/10 p-5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-[#F39C12]" />
                  <h3 className="font-semibold text-white">Hinweise</h3>
                </div>
                <div className="mt-4 space-y-2">
                  {report.warnings.map((warning) => (
                    <p key={warning} className="text-sm leading-6 text-[#ffd79a]">
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <DatabaseReadinessPanel report={databaseReport} />
        <OperationsReadinessPanel report={operationsReport} />

        <section className="grid gap-5 xl:grid-cols-2">
          {report.sections.map((section) => {
            const Icon = ICONS[section.id as keyof typeof ICONS] || CircleDot;

            return (
              <div key={section.id} className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10">
                <div className="mb-5 flex items-start gap-3">
                  <div className="rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/10 p-3 text-[#00D4FF]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{section.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-white/45">{section.description}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {section.items.map((item) => (
                    <ReadinessRow key={item.key} item={item} />
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white">Webhook Endpoints</h3>
              <p className="mt-1 text-sm text-white/45">Diese URLs müssen in Stripe als Event-Ziele angelegt werden.</p>
            </div>
            <a
              href="https://dashboard.stripe.com/webhooks"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/70 transition hover:border-[#00D4FF]/40 hover:text-white"
            >
              Stripe öffnen
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {report.webhookEndpoints.map((endpoint) => (
              <div key={endpoint.path} className="rounded-2xl border border-white/[0.08] bg-[#06121C]/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{endpoint.label}</p>
                    <p className="mt-1 font-mono text-xs text-[#00D4FF]">{endpoint.path}</p>
                    <p className="mt-2 text-xs text-white/40">Secret Env: {endpoint.secretEnv}</p>
                  </div>
                  <Copy className="h-4 w-4 text-white/35" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {endpoint.events.map((event) => (
                    <span key={event} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-white/55">
                      {event}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function ReadinessScoreCard({
  label,
  score,
  ready,
  detail,
}: {
  label: string;
  score: number;
  ready: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-[#06121C]/60 p-5 text-center shadow-xl shadow-[#1C7ED6]/10">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/35">{label}</p>
      <p className="mt-2 text-5xl font-semibold text-white">{score}%</p>
      <p className={`mt-2 text-sm ${ready ? 'text-[#8ff0b9]' : 'text-white/45'}`}>{detail}</p>
    </div>
  );
}

function DatabaseReadinessPanel({ report }: { report: DatabaseReadinessReport }) {
  return (
    <section className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/10 p-3 text-[#00D4FF]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Produktions-Datenbank</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/45">
              Diese Prüfung erkennt, ob Prisma die Tabellen und Felder für Stripe-Abos, Rechnungen, E-Mail-Versand und Webhook-Idempotenz wirklich nutzen kann.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#06121C]/50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-white/30">Deployment Befehl</p>
          <p className="mt-2 font-mono text-xs text-[#00D4FF]">{report.migrationCommand}</p>
        </div>
      </div>

      {report.warnings.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[#F39C12]/20 bg-[#F39C12]/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#ffd79a]">
            <AlertTriangle className="h-4 w-4" />
            Datenbank-Hinweise
          </div>
          <div className="mt-2 space-y-1">
            {report.warnings.map((warning) => (
              <p key={warning} className="text-sm leading-6 text-[#ffd79a]">{warning}</p>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {report.checks.map((check) => (
          <DatabaseReadinessRow key={check.id} check={check} />
        ))}
      </div>
    </section>
  );
}

function DatabaseReadinessRow({ check }: { check: DatabaseReadinessCheck }) {
  const isReady = check.status === 'ready';
  const isMissing = check.status === 'missing';

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#06121C]/45 p-4 transition hover:border-[#00D4FF]/25 hover:bg-[#06121C]/65">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {isReady ? (
              <CheckCircle2 className="h-4 w-4 text-[#2ECC71]" />
            ) : isMissing ? (
              <XCircle className="h-4 w-4 text-[#E74C3C]" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-[#F39C12]" />
            )}
            <p className="font-medium text-white">{check.label}</p>
            {check.required && (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                Pflicht
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-white/45">{check.description}</p>
          {check.detail && <p className="mt-2 text-xs leading-5 text-[#ffd79a]">{check.detail}</p>}
          {check.maskedValue && <p className="mt-2 break-all font-mono text-xs text-white/35">{check.maskedValue}</p>}
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            isReady
              ? 'bg-[#2ECC71]/10 text-[#8ff0b9]'
              : isMissing
                ? 'bg-[#E74C3C]/10 text-[#ffb5ab]'
                : 'bg-[#F39C12]/10 text-[#ffd79a]'
          }`}
        >
          {isReady ? 'Bereit' : isMissing ? 'Offen' : 'Hinweis'}
        </span>
      </div>
    </div>
  );
}

function OperationsReadinessPanel({ report }: { report: OperationsReadinessReport }) {
  return (
    <section className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-[#1C7ED6]/20 bg-[#1C7ED6]/10 p-3 text-[#00D4FF]">
            <CircleDot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Operations und Cron Jobs</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/45">
              Diese Prüfung zeigt, ob automatische Reconciliation- und Payout-Jobs geplant und durch ein Cron Secret abgesichert sind.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#06121C]/50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.16em] text-white/30">Cron Jobs</p>
          <p className="mt-2 text-2xl font-semibold text-white">{report.cronJobs.length}</p>
        </div>
      </div>

      {report.warnings.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[#F39C12]/20 bg-[#F39C12]/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#ffd79a]">
            <AlertTriangle className="h-4 w-4" />
            Operations-Hinweise
          </div>
          <div className="mt-2 space-y-1">
            {report.warnings.map((warning) => (
              <p key={warning} className="text-sm leading-6 text-[#ffd79a]">{warning}</p>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {report.checks.map((check) => (
          <DatabaseReadinessRow key={check.id} check={check} />
        ))}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {report.cronJobs.map((job) => (
          <div key={job.path} className="rounded-2xl border border-white/[0.08] bg-[#06121C]/45 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium text-white">{job.label}</p>
                <p className="mt-2 text-sm leading-6 text-white/45">{job.description}</p>
                <p className="mt-2 font-mono text-xs text-[#00D4FF]">{job.path}</p>
              </div>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1 font-mono text-xs text-white/60">
                {job.schedule}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReadinessRow({ item }: { item: StripeReadinessItem }) {
  const isReady = item.status === 'ready';
  const isMissing = item.status === 'missing';

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#06121C]/45 p-4 transition hover:border-[#00D4FF]/25 hover:bg-[#06121C]/65">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isReady ? (
              <CheckCircle2 className="h-4 w-4 text-[#2ECC71]" />
            ) : isMissing ? (
              <XCircle className="h-4 w-4 text-[#E74C3C]" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-[#F39C12]" />
            )}
            <p className="font-medium text-white">{item.label}</p>
            {item.required && (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                Pflicht
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-white/45">{item.description}</p>
          <p className="mt-2 break-all font-mono text-xs text-white/35">{item.key}</p>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              isReady
                ? 'bg-[#2ECC71]/10 text-[#8ff0b9]'
                : isMissing
                  ? 'bg-[#E74C3C]/10 text-[#ffb5ab]'
                  : 'bg-[#F39C12]/10 text-[#ffd79a]'
            }`}
          >
            {isReady ? 'Bereit' : isMissing ? 'Fehlt' : 'Hinweis'}
          </span>
          {item.maskedValue && <p className="mt-2 font-mono text-xs text-white/40">{item.maskedValue}</p>}
        </div>
      </div>
    </div>
  );
}
