'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { getSubscriptionPlanConfig, type SubscriptionPlanConfig } from '@/lib/billing/plans';
import { useAuthStore } from '@/lib/auth-store';

type BillingCycle = 'monthly' | 'yearly';

interface SubscriptionState extends Partial<SubscriptionPlanConfig> {
  plan: string;
  status: string;
  currentPeriodEnd?: string | null;
  companyId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  billingCycle?: string | null;
  cancelAtPeriodEnd?: boolean;
  stripeStatus?: string | null;
}

interface SubscriptionPayload {
  success: boolean;
  subscription: SubscriptionState;
  plans: Record<string, SubscriptionPlanConfig>;
  source?: string;
}

interface SubscriptionInvoice {
  id: string;
  stripeInvoiceId: string;
  invoiceNumber?: string | null;
  status?: string | null;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  hostedInvoiceUrl?: string | null;
  invoicePdfUrl?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  issuedAt?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  emailRecipient?: string | null;
  emailSent?: boolean;
  emailSentAt?: string | null;
  emailProvider?: string | null;
  emailError?: string | null;
}

const FALLBACK_PLANS = getSubscriptionPlanConfig();
const PLAN_ORDER = ['free', 'starter', 'professional', 'enterprise'];

export default function BillingPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [payload, setPayload] = useState<SubscriptionPayload | null>(null);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const userId = isAuthenticated && user?.id ? user.id : 'demo-user';

  useEffect(() => {
    let cancelled = false;

    const loadSubscription = async () => {
      setLoading(true);
      try {
        const headers = { 'x-user-id': userId };
        const [response, invoicesResponse] = await Promise.all([
          fetch('/api/subscriptions', { headers }),
          fetch('/api/subscriptions/invoices', { headers }),
        ]);
        const data = await response.json();
        const invoiceData = await invoicesResponse.json().catch(() => ({ invoices: [] }));

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Subscription API failed');
        }

        if (!cancelled) {
          setPayload(data);
          setInvoices(Array.isArray(invoiceData.invoices) ? invoiceData.invoices : []);
        }
      } catch {
        if (!cancelled) {
          setPayload({
            success: true,
            subscription: {
              plan: 'free',
              status: 'active',
              ...FALLBACK_PLANS.free,
            },
            plans: FALLBACK_PLANS,
            source: 'client_fallback',
          });
          setInvoices([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSubscription();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const plans = payload?.plans || FALLBACK_PLANS;
  const currentPlan = String(payload?.subscription?.plan || 'free').toLowerCase();
  const currentPlanLabel = plans[currentPlan]?.name || 'Free';
  const nextInvoiceDate = payload?.subscription?.currentPeriodEnd
    ? new Date(payload.subscription.currentPeriodEnd).toLocaleDateString('de-DE')
    : 'Keine aktive Abo-Periode';
  const hasStripeCustomer = Boolean(payload?.subscription?.stripeCustomerId);

  const yearlySavingText = useMemo(() => {
    const starter = plans.starter;
    if (!starter) return 'Jahresrabatt aktiv';
    const saving = starter.monthlyFee * 12 - starter.yearlyFee;
    return saving > 0 ? `Jährlich bis zu ${formatCurrency(saving)} sparen` : 'Jahresabrechnung verfügbar';
  }, [plans]);

  const startCheckout = async (plan: string) => {
    setMessage(null);
    setCheckoutPlan(plan);

    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ plan, billingCycle }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Checkout konnte nicht erstellt werden');
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      setMessage(data.message || 'Checkout wurde vorbereitet.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Checkout konnte nicht erstellt werden.');
    } finally {
      setCheckoutPlan(null);
    }
  };

  const openCustomerPortal = async () => {
    setMessage(null);
    setPortalLoading(true);

    try {
      const response = await fetch('/api/subscriptions/portal', {
        method: 'POST',
        headers: { 'x-user-id': userId },
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Abo-Verwaltung konnte nicht geöffnet werden');
      }

      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Abo-Verwaltung konnte nicht geöffnet werden.');
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-[#06121C] text-white" style={{ colorScheme: 'dark' }}>
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(180deg,#06121C_0%,#071927_48%,#06121C_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(28,126,214,0.22),transparent_42%),radial-gradient(ellipse_at_top_right,rgba(0,212,255,0.16),transparent_40%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Zurück zum Dashboard
          </Link>

          <div className="inline-flex w-fit rounded-2xl border border-white/[0.08] bg-white/[0.05] p-1">
            {(['monthly', 'yearly'] as BillingCycle[]).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  billingCycle === cycle
                    ? 'bg-[#1C7ED6] text-white shadow-lg shadow-[#1C7ED6]/25'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                {cycle === 'monthly' ? 'Monatlich' : 'Jährlich'}
              </button>
            ))}
          </div>
        </div>

        <section className="relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-6 shadow-2xl shadow-black/20 lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,212,255,0.18),transparent_34%),linear-gradient(135deg,rgba(28,126,214,0.14),transparent_42%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#2ECC71]/20 bg-[#2ECC71]/10 px-3 py-1 text-xs font-semibold text-[#8ff0b9]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Netto-Preise, MwSt-Ausweis, Stripe Checkout
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-white sm:text-5xl">
                Abo und Gebührenzentrale
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">
                Verwalte den CargoBit Plan, sieh die MwSt-Bestandteile vor dem Abschluss und starte den passenden Checkout für dein Unternehmen.
              </p>
            </div>

            <div className="rounded-[18px] border border-white/[0.08] bg-[#06121C]/72 p-5 shadow-xl shadow-[#1C7ED6]/10">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-2xl bg-[#00D4FF]/10 p-3 text-[#00D4FF]">
                  <CreditCard className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-[#2ECC71]/20 bg-[#2ECC71]/10 px-3 py-1 text-xs font-semibold text-[#8ff0b9]">
                  {payload?.subscription?.status || 'active'}
                </span>
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Aktueller Plan</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">{loading ? 'Lädt...' : currentPlanLabel}</h2>
              <p className="mt-2 text-sm text-white/45">Nächste Periode: {loading ? 'Wird geprüft' : nextInvoiceDate}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatusPill icon={<ReceiptText className="h-4 w-4" />} label="MwSt" value="19%" />
                <StatusPill icon={<Wallet className="h-4 w-4" />} label="Stripe" value={hasStripeCustomer ? 'Verbunden' : 'Ausstehend'} />
              </div>
              <button
                type="button"
                onClick={openCustomerPortal}
                disabled={portalLoading || currentPlan === 'free'}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white/75 transition hover:border-[#00D4FF]/35 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Abo verwalten
              </button>
            </div>
          </div>
        </section>

        {message && (
          <div className="rounded-[18px] border border-[#F39C12]/20 bg-[#F39C12]/10 p-4 text-sm text-[#ffd79a]">
            {message}
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {PLAN_ORDER.map((planKey) => {
            const plan = plans[planKey];
            if (!plan) return null;

            const isCurrent = currentPlan === planKey;
            const selectedPrice = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
            const isFree = planKey === 'free';
            const isEnterprise = planKey === 'enterprise';

            return (
              <article
                key={planKey}
                className={`relative flex min-h-[520px] flex-col rounded-[18px] border p-5 transition hover:-translate-y-1 ${
                  isCurrent
                    ? 'border-[#00D4FF]/40 bg-[#00D4FF]/10 shadow-2xl shadow-[#00D4FF]/10'
                    : 'border-white/[0.08] bg-white/[0.05] shadow-xl shadow-black/10 hover:border-white/[0.16]'
                }`}
              >
                {planKey === 'professional' && (
                  <div className="absolute -top-3 left-5 rounded-full bg-gradient-to-r from-[#1C7ED6] to-[#00D4FF] px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-[#1C7ED6]/25">
                    Empfohlen
                  </div>
                )}

                <div className="mb-5 flex items-center justify-between">
                  <div className="rounded-2xl bg-white/[0.06] p-3 text-[#00D4FF]">
                    {planKey === 'free' ? <FileText className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                  </div>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#2ECC71]/20 bg-[#2ECC71]/10 px-3 py-1 text-xs font-semibold text-[#8ff0b9]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aktiv
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-white/45">
                  {planKey === 'free'
                    ? 'Für erste Tests und private Einzelaufträge.'
                    : planKey === 'starter'
                      ? 'Für kleine Gewerbe und erste regelmäßige Transporte.'
                      : planKey === 'professional'
                        ? 'Für aktive Speditionen, Dispatcher und wachsende Teams.'
                        : 'Für größere Teams mit individuellem Setup und SLA.'}
                </p>

                <div className="mt-6">
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-semibold tracking-normal text-white">
                      {formatCurrency(selectedPrice.netAmount)}
                    </span>
                    <span className="pb-1 text-sm text-white/40">
                      / {billingCycle === 'monthly' ? 'Monat' : 'Jahr'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-white/40">{plan.vatNotice}</p>
                </div>

                <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#06121C]/45 p-4">
                  <PriceRow label="Netto" value={formatCurrency(selectedPrice.netAmount)} />
                  <PriceRow label={`MwSt ${selectedPrice.vatPercent}%`} value={formatCurrency(selectedPrice.vatAmount)} />
                  <div className="my-3 h-px bg-white/[0.08]" />
                  <PriceRow label="Brutto Rechnung" value={formatCurrency(selectedPrice.grossAmount)} strong />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                  <StatusPill icon={<ReceiptText className="h-4 w-4" />} label="Provision" value={`${plan.commissionPercent}%`} />
                  <StatusPill icon={<Wallet className="h-4 w-4" />} label="Wallet" value={`${plan.walletFeePercent}%`} />
                </div>

                <ul className="mt-5 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm leading-5 text-white/60">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2ECC71]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={isCurrent || isFree || checkoutPlan === planKey}
                  onClick={() => isEnterprise ? setMessage('Enterprise wird über Sales vorbereitet: sales@cargobit.de') : startCheckout(planKey)}
                  className={`mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    isCurrent
                      ? 'cursor-default border border-[#2ECC71]/20 bg-[#2ECC71]/10 text-[#8ff0b9]'
                      : isFree
                        ? 'cursor-default border border-white/[0.08] bg-white/[0.04] text-white/35'
                        : 'bg-gradient-to-r from-[#1C7ED6] to-[#00D4FF] text-white shadow-lg shadow-[#1C7ED6]/25 hover:scale-[1.02] disabled:opacity-60'
                  }`}
                >
                  {checkoutPlan === planKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {isCurrent ? 'Aktueller Plan' : isFree ? 'Kostenlos' : isEnterprise ? 'Sales kontaktieren' : 'Checkout starten'}
                </button>
              </article>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <InfoCard title="Rechnung" detail="Beim Abo-Abschluss wird der Netto-Preis im Vordergrund angezeigt. Die Rechnung listet Netto, MwSt und Brutto getrennt." />
          <InfoCard title="Zahlung" detail="Stripe Checkout unterstützt Karten und SEPA-Lastschrift. Der Webhook aktiviert den Plan erst nach erfolgreicher Bestätigung." />
          <InfoCard title="Sicherheit" detail="Nur Firmeneigner dürfen produktiv ein Abo abschließen. Lokale Tests nutzen einen Demo-Fallback." />
        </section>

        <section className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5 shadow-xl shadow-black/10">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Abo-Rechnungen</h2>
              <p className="mt-1 text-sm text-white/45">Stripe-Rechnungen mit Netto, MwSt, Brutto und Zahlungsstatus.</p>
            </div>
            <span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/50">
              {invoices.length} Einträge
            </span>
          </div>

          {invoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.12] bg-[#06121C]/35 p-6 text-sm text-white/45">
              Noch keine Abo-Rechnungen vorhanden. Nach dem ersten erfolgreichen Stripe-Abo erscheinen sie hier automatisch.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
              <div className="hidden grid-cols-[1.25fr_0.7fr_0.65fr_0.65fr_0.75fr_0.7fr_0.8fr] gap-4 border-b border-white/[0.08] bg-[#06121C]/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/35 md:grid">
                <span>Rechnung</span>
                <span>Status</span>
                <span>Netto</span>
                <span>MwSt</span>
                <span>Brutto</span>
                <span>E-Mail</span>
                <span>Dokument</span>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="grid gap-3 bg-[#06121C]/42 px-4 py-4 md:grid-cols-[1.25fr_0.7fr_0.65fr_0.65fr_0.75fr_0.7fr_0.8fr] md:items-center md:gap-4">
                    <div>
                      <p className="font-medium text-white">{invoice.invoiceNumber || invoice.stripeInvoiceId}</p>
                      <p className="mt-1 text-xs text-white/40">
                        {invoice.issuedAt ? formatDate(invoice.issuedAt) : 'Datum offen'}
                        {invoice.periodStart && invoice.periodEnd ? ` · ${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}` : ''}
                      </p>
                    </div>
                    <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${invoiceStatusTone(invoice.status)}`}>
                      {invoice.status || 'offen'}
                    </span>
                    <MobilePrice label="Netto" value={formatCurrency(invoice.subtotal)} />
                    <MobilePrice label="MwSt" value={formatCurrency(invoice.tax)} />
                    <MobilePrice label="Brutto" value={formatCurrency(invoice.total)} strong />
                    <div>
                      <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${emailStatusTone(invoice)}`}>
                        {invoice.emailSent ? 'Gesendet' : invoice.emailError ? 'Fehler' : 'Offen'}
                      </span>
                      {invoice.emailSentAt && (
                        <p className="mt-1 text-xs text-white/35">{formatDate(invoice.emailSentAt)}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {invoice.hostedInvoiceUrl && (
                        <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white">
                          Anzeigen
                        </a>
                      )}
                      {invoice.invoicePdfUrl && (
                        <a href={invoice.invoicePdfUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-[#00D4FF]/20 bg-[#00D4FF]/10 px-3 py-1.5 text-xs font-medium text-[#9aefff]">
                          PDF
                        </a>
                      )}
                      {!invoice.hostedInvoiceUrl && !invoice.invoicePdfUrl && (
                        <span className="text-xs text-white/35">Stripe Link folgt</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function PriceRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 text-sm ${strong ? 'font-semibold text-white' : 'text-white/55'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatusPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
      <div className="mb-2 text-[#00D4FF]">{icon}</div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/30">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-5">
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/50">{detail}</p>
    </div>
  );
}

function MobilePrice({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 md:block">
      <span className="text-xs uppercase tracking-[0.14em] text-white/30 md:hidden">{label}</span>
      <span className={`text-sm ${strong ? 'font-semibold text-white' : 'text-white/60'}`}>{value}</span>
    </div>
  );
}

function invoiceStatusTone(status?: string | null) {
  switch (String(status || '').toLowerCase()) {
    case 'paid':
      return 'border-[#2ECC71]/25 bg-[#2ECC71]/10 text-[#8ff0b9]';
    case 'open':
    case 'draft':
      return 'border-[#F39C12]/25 bg-[#F39C12]/10 text-[#ffd79a]';
    case 'void':
    case 'uncollectible':
      return 'border-[#E74C3C]/25 bg-[#E74C3C]/10 text-[#ffb5ab]';
    default:
      return 'border-white/[0.08] bg-white/[0.05] text-white/55';
  }
}

function emailStatusTone(invoice: SubscriptionInvoice) {
  if (invoice.emailSent) {
    return 'border-[#2ECC71]/25 bg-[#2ECC71]/10 text-[#8ff0b9]';
  }

  if (invoice.emailError) {
    return 'border-[#E74C3C]/25 bg-[#E74C3C]/10 text-[#ffb5ab]';
  }

  return 'border-white/[0.08] bg-white/[0.05] text-white/55';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}
