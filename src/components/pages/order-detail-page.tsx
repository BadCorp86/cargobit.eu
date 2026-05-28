'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RiskBadge, RiskBar } from '@/components/cargobit/risk-badge';
import { InsuranceWidget, InsuranceTier } from '@/components/cargobit/insurance-widget';
import { TransportCard } from '@/components/cargobit/transport-card';
import { BannerAd } from '@/components/ads/banner-ad';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Package,
  Truck,
  Clock,
  User,
  Building2,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
  Phone,
  Mail,
  ArrowRight,
  CreditCard,
  ExternalLink,
  Loader2,
  ReceiptText,
  Send,
  Star,
  Wallet,
  ChevronRight,
} from 'lucide-react';

interface LifecycleStageView {
  id: string;
  label: string;
  owner: string;
  status: 'done' | 'active' | 'next' | 'blocked' | 'waiting';
  description: string;
  automation: string;
  cta: string;
  endpoint?: string;
}

interface InvoiceDraftView {
  invoiceNumber: string;
  orderId: string;
  currency: string;
  issuedAt: string;
  dueAt: string;
  lineItems: Array<{
    label: string;
    description?: string;
    totalNet: number;
    vatRate: number;
    vatAmount: number;
    totalGross: number;
  }>;
  totals: {
    net: number;
    vat: number;
    gross: number;
  };
  payment: {
    protectedByWallet: boolean;
    payoutAfterPod: boolean;
    payoutRiskGate: boolean;
  };
}

interface IssuedInvoiceView {
  document?: {
    id: string;
    name: string;
    fileUrl: string;
  };
  email?: {
    success: boolean;
    provider?: string;
    messageId?: string;
  };
  notification?: {
    id: string;
    title: string;
    emailSent?: boolean;
  };
  source?: string;
}

type PayoutGateViewStatus = 'passed' | 'waiting' | 'blocked' | 'review_required';

interface PayoutReleaseView {
  success?: boolean;
  message?: string;
  release?: {
    releaseId: string;
    status: 'ready' | 'released' | 'blocked';
    currency: string;
    releasedAt?: string;
    blockedReasons: string[];
    settlement: {
      carrierWalletCredit: number;
      platformRevenueNet: number;
      shipperChargeGross: number;
      vatHandledOnInvoice: boolean;
    };
    gates: Array<{
      id: string;
      label: string;
      status: PayoutGateViewStatus;
      detail: string;
    }>;
    walletTransaction: {
      type: 'PAYMENT_IN';
      amount: number;
      reference: string;
      description: string;
    };
    nextStep: {
      label: string;
      description: string;
    };
  };
  wallet?: {
    id: string;
    balance: number;
    currency: string;
  };
  walletTransaction?: {
    id: string;
    reference: string;
    amount: number;
  };
  notification?: {
    id: string;
    title: string;
  } | null;
  duplicate?: boolean;
  source?: string;
}

interface BankPayoutView {
  success?: boolean;
  message?: string;
  payout?: {
    id: string;
    status: string;
    amount: number;
    amountCents: number;
    currency: string;
    ibanLast4?: string | null;
    riskLevel?: string | null;
  };
  transfer?: {
    provider: string;
    transferId: string;
    stripeAccountId?: string;
    amountCents: number;
    currency: string;
    status: string;
    estimatedArrival: string;
  };
  wallet?: {
    id: string;
    balance: number;
    currency: string;
  };
  walletTransaction?: {
    id: string;
    reference: string;
    amount: number;
  };
  notification?: {
    id: string;
    title: string;
  };
  duplicate?: boolean;
  source?: string;
}

// ========================================
// Order Header
// ========================================
interface OrderHeaderProps {
  orderId: string;
  status: string;
  risk: 'green' | 'yellow' | 'red';
}

function OrderHeader({ orderId, status, risk }: OrderHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">#{orderId}</h1>
            <Badge variant="secondary">{status}</Badge>
          </div>
        </div>
      </div>
      <RiskBadge risk={risk} showLabel />
    </div>
  );
}

// ========================================
// Order Info
// ========================================
function OrderInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Transportdetails
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Route */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Abholort</div>
            <div className="text-lg font-semibold">Berlin, Deutschland</div>
            <div className="text-sm text-muted-foreground">Musterstraße 123, 10115</div>
          </div>
          <ArrowRight className="w-6 h-6 text-muted-foreground" />
          <div className="flex-1 text-right">
            <div className="text-sm text-muted-foreground">Zielort</div>
            <div className="text-lg font-semibold">München, Deutschland</div>
            <div className="text-sm text-muted-foreground">Beispielweg 456, 80331</div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Abholdatum</div>
            <div className="font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              15.04.2024
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Lieferdatum</div>
            <div className="font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              16.04.2024
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Frachtart</div>
            <div className="font-medium flex items-center gap-2">
              <Package className="w-4 h-4" />
              Paletten
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Gewicht</div>
            <div className="font-medium flex items-center gap-2">
              <Truck className="w-4 h-4" />
              2.500 kg
            </div>
          </div>
        </div>

        <Separator />

        {/* Cargo Description */}
        <div>
          <div className="text-sm text-muted-foreground mb-2">Frachtbeschreibung</div>
          <p className="text-sm">
            10 Europaletten mit Elektronik-Komponenten. Empfindliche Ware, trocken lagern.
            Stapelbar bis max. 3 Lagen. Wert ca. 45.000 €.
          </p>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
          <div>
            <div className="text-sm text-muted-foreground">Transportpreis</div>
            <div className="text-2xl font-bold">850,00 €</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Zahlungsart</div>
            <div className="font-medium flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Escrow
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ========================================
// Risk Section
// ========================================
function RiskSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Risk-Engine Analyse
        </CardTitle>
        <CardDescription>Automatische Bewertung basierend auf 15 Faktoren</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Risk */}
        <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-lg">
          <div>
            <div className="text-sm text-muted-foreground">Gesamtrisiko</div>
            <div className="text-xl font-semibold">Niedriges Risiko</div>
          </div>
          <RiskBadge risk="green" showLabel />
        </div>

        {/* Risk Factors */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Verlader-Vertrauenslevel</span>
            <div className="flex items-center gap-2">
              <RiskBar risk="green" value={90} className="w-24" />
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Route-Bewertung</span>
            <div className="flex items-center gap-2">
              <RiskBar risk="green" value={85} className="w-24" />
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Frachtart-Risiko</span>
            <div className="flex items-center gap-2">
              <RiskBar risk="green" value={75} className="w-24" />
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Wert-Risiko</span>
            <div className="flex items-center gap-2">
              <RiskBar risk="yellow" value={40} className="w-24" />
              <Info className="w-4 h-4 text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="p-3 bg-blue-500/10 rounded-lg flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong>Empfehlung:</strong> Eine Frachtversicherung wird aufgrund des Warenwerts empfohlen.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ========================================
// Insurance Box
// ========================================
function InsuranceBox() {
  const [selectedTier, setSelectedTier] = React.useState<string | null>(null);
  const [leadLoading, setLeadLoading] = React.useState(false);
  const [leadMessage, setLeadMessage] = React.useState<string | null>(null);

  const tiers = [
    {
      name: 'Basis',
      price: 9.90,
      coverage: '10.000 €',
      features: ['Grundschutz', 'Transportschäden', 'Diebstahl'],
    },
    {
      name: 'Standard',
      price: 24.90,
      coverage: '50.000 €',
      features: ['Vollschutz', 'Transportschäden', 'Diebstahl', 'Wasserschäden', 'Keine Selbstbeteiligung'],
      recommended: true,
    },
    {
      name: 'Premium',
      price: 49.90,
      coverage: '100.000 €',
      features: ['Komplettschutz', 'Alle Schäden', 'Weltweit', 'Express-Abwicklung', '24/7 Support'],
    },
  ];

  const requestExternalInsurance = async () => {
    const tier = tiers.find((item) => item.name === selectedTier);
    if (!tier) return;

    setLeadLoading(true);
    setLeadMessage(null);

    try {
      const response = await fetch('/api/insurance/referral/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedByRole: 'SHIPPER',
          source: 'SHIPPER_CREATE',
          cargoDescription: 'Transportauftrag',
          cargoValueEur: Number(tier.coverage.replace(/\D/g, '')) || 10000,
          consentAccepted: true,
          persistLead: true,
          markRedirected: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Versicherungsanfrage fehlgeschlagen');
      setLeadMessage('Externer Versicherungs-Lead wurde erstellt.');
      window.open(data.referralUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setLeadMessage(error instanceof Error ? error.message : 'Versicherungsanfrage fehlgeschlagen');
    } finally {
      setLeadLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--color-insurance-blue)]" />
          Frachtversicherung
        </CardTitle>
        <CardDescription>Externe Partneranfrage gegen Verlust und Beschädigung</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
          {tiers.map((tier) => (
            <InsuranceTier
              key={tier.name}
              name={tier.name}
              price={tier.price}
              coverage={tier.coverage}
              features={tier.features}
              recommended={tier.recommended}
              onSelect={() => setSelectedTier(tier.name)}
            />
          ))}
        </div>
      </CardContent>
      {selectedTier && (
        <CardFooter className="bg-muted/50">
          <div className="flex items-center justify-between w-full">
            <div>
              <div className="text-sm text-muted-foreground">Ausgewählt: {selectedTier}</div>
              <div className="font-semibold">
                {tiers.find((t) => t.name === selectedTier)?.price.toFixed(2)} €
              </div>
            </div>
            <Button className="gap-2" onClick={requestExternalInsurance} disabled={leadLoading}>
              {leadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Extern anfragen
            </Button>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            CargoBit agiert nur als technischer Tippgeber. Abschluss, Police und Schadenbearbeitung erfolgen beim lizenzierten Versicherer oder Makler.
          </div>
          {leadMessage ? (
            <div className="mt-2 text-xs text-muted-foreground">{leadMessage}</div>
          ) : null}
        </CardFooter>
      )}
    </Card>
  );
}

// ========================================
// Order-to-Cash Flow
// ========================================
function OrderCashFlow({ orderId }: { orderId: string }) {
  const [lifecycle, setLifecycle] = React.useState<LifecycleStageView[]>([]);
  const [invoice, setInvoice] = React.useState<InvoiceDraftView | null>(null);
  const [issuedInvoice, setIssuedInvoice] = React.useState<IssuedInvoiceView | null>(null);
  const [payoutRelease, setPayoutRelease] = React.useState<PayoutReleaseView | null>(null);
  const [bankPayout, setBankPayout] = React.useState<BankPayoutView | null>(null);
  const [source, setSource] = React.useState<'database' | 'fallback' | 'blueprint'>('fallback');
  const [loading, setLoading] = React.useState(true);
  const [issuing, setIssuing] = React.useState(false);
  const [releasing, setReleasing] = React.useState(false);
  const [startingBankPayout, setStartingBankPayout] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const [lifecycleResponse, invoiceResponse] = await Promise.all([
          fetch(`/api/orders/lifecycle?orderId=${encodeURIComponent(orderId)}`),
          fetch(`/api/orders/${encodeURIComponent(orderId)}/invoice?amount=850`),
        ]);
        const lifecyclePayload = await lifecycleResponse.json();
        const invoicePayload = await invoiceResponse.json();

        if (cancelled) return;

        setLifecycle(lifecyclePayload.lifecycle || []);
        setInvoice(invoicePayload.invoice || null);
        setSource(lifecyclePayload.source || invoicePayload.source || 'fallback');
      } catch {
        if (!cancelled) {
          setLifecycle([]);
          setInvoice(null);
          setSource('fallback');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const activeStage = lifecycle.find((stage) => stage.status === 'active') || lifecycle.find((stage) => stage.status === 'next');

  const issueInvoice = async () => {
    setIssuing(true);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/invoice/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: invoice?.lineItems[0]?.totalNet || 850 }),
      });
      const payload = await response.json();

      if (payload?.invoice) setInvoice(payload.invoice);
      setIssuedInvoice({
        document: payload?.document,
        email: payload?.email,
        notification: payload?.notification,
        source: payload?.source,
      });
    } catch {
      setIssuedInvoice({
        email: { success: false, provider: 'local-error' },
        notification: { id: 'local-error', title: 'Rechnung konnte lokal nicht ausgestellt werden' },
      });
    } finally {
      setIssuing(false);
    }
  };

  const releasePayout = async () => {
    setReleasing(true);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payout/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: invoice?.lineItems[0]?.totalNet || 850 }),
      });
      const payload = await response.json();

      setPayoutRelease({
        success: response.ok && payload?.success !== false,
        message: payload?.message,
        release: payload?.release,
        wallet: payload?.wallet,
        walletTransaction: payload?.walletTransaction,
        notification: payload?.notification,
        duplicate: payload?.duplicate,
        source: payload?.source,
      });
    } catch {
      setPayoutRelease({
        success: false,
        message: 'Wallet-Freigabe konnte lokal nicht ausgefuehrt werden.',
      });
    } finally {
      setReleasing(false);
    }
  };

  const startBankPayout = async () => {
    setStartingBankPayout(true);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payout/bank-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: invoice?.lineItems[0]?.totalNet || 850 }),
      });
      const payload = await response.json();

      setBankPayout({
        success: response.ok && payload?.success !== false,
        message: payload?.message,
        payout: payload?.payout,
        transfer: payload?.transfer,
        wallet: payload?.wallet,
        walletTransaction: payload?.walletTransaction,
        notification: payload?.notification,
        duplicate: payload?.duplicate,
        source: payload?.source,
      });
    } catch {
      setBankPayout({
        success: false,
        message: 'Bankauszahlung konnte lokal nicht gestartet werden.',
      });
    } finally {
      setStartingBankPayout(false);
    }
  };

  return (
    <Card className="overflow-hidden border-white/10 bg-[#071927] text-white shadow-2xl shadow-black/25">
      <CardHeader className="border-b border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ReceiptText className="h-5 w-5 text-[#00D4FF]" />
              Auftrag bis Rechnung
            </CardTitle>
            <CardDescription className="mt-1 text-white/55">
              Matching, Annahme, Transportstatus, POD, Rechnung und Auszahlung in einem Ablauf.
            </CardDescription>
          </div>
          <Badge className={source === 'database' ? 'bg-[#2ECC71] text-[#06121C]' : 'bg-[#F39C12]/15 text-[#F39C12]'}>
            {source === 'database' ? 'Live Daten' : 'Demo/Fallback'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        {loading ? (
          <div className="flex min-h-44 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Prozess wird geladen
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-7">
              {lifecycle.map((stage) => (
                <LifecycleStep key={stage.id} stage={stage} />
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/35">Nächste Aktion</p>
                    <h3 className="mt-1 text-lg font-semibold">{activeStage?.label || 'Auftrag prüfen'}</h3>
                  </div>
                  <Badge variant="outline" className="border-[#00D4FF]/25 bg-[#00D4FF]/10 text-[#00D4FF]">
                    {activeStage?.owner || 'CargoBit'}
                  </Badge>
                </div>
                <p className="text-sm leading-6 text-white/60">{activeStage?.description || 'Der Auftrag ist bereit für die nächste Prüfung.'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild className="bg-[#1C7ED6] text-white hover:bg-[#166BBB]">
                    <a href="/driver/mobile">Fahreransicht öffnen</a>
                  </Button>
                  <Button
                    type="button"
                    disabled={issuing}
                    onClick={issueInvoice}
                    className="bg-[#2ECC71] text-[#06121C] hover:bg-[#27B765]"
                  >
                    {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Rechnung ausstellen & E-Mail vorbereiten
                  </Button>
                  <Button
                    type="button"
                    disabled={releasing || !invoice}
                    onClick={releasePayout}
                    className="bg-[#00D4FF] text-[#06121C] hover:bg-[#35DFFF]"
                  >
                    {releasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                    Wallet-Auszahlung freigeben
                  </Button>
                  <Button
                    type="button"
                    disabled={startingBankPayout || !invoice || payoutRelease?.success === false}
                    onClick={startBankPayout}
                    className="bg-white text-[#06121C] hover:bg-white/85"
                  >
                    {startingBankPayout ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Bankauszahlung starten
                  </Button>
                  <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                    <a href={`/api/orders/${orderId}/invoice?amount=850`}>Rechnung JSON</a>
                  </Button>
                </div>
                {issuedInvoice && (
                  <div className="mt-4 rounded-2xl border border-[#2ECC71]/20 bg-[#2ECC71]/10 p-4 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[#2ECC71]">{issuedInvoice.notification?.title || 'Rechnung vorbereitet'}</p>
                        <p className="mt-1 text-white/55">
                          E-Mail: {issuedInvoice.email?.success ? `vorbereitet (${issuedInvoice.email.provider})` : 'nicht gesendet'}
                        </p>
                      </div>
                      {issuedInvoice.document?.fileUrl ? (
                        <a
                          href={issuedInvoice.document.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/80"
                        >
                          Dokument
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                )}
                {payoutRelease && (
                  <PayoutReleasePanel payoutRelease={payoutRelease} />
                )}
                {bankPayout && (
                  <BankPayoutPanel bankPayout={bankPayout} />
                )}
              </div>

              <InvoiceSummary invoice={invoice} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BankPayoutPanel({ bankPayout }: { bankPayout: BankPayoutView }) {
  const isSuccess = bankPayout.success !== false && Boolean(bankPayout.payout);
  const currency = bankPayout.payout?.currency || bankPayout.wallet?.currency || 'EUR';
  const amount = bankPayout.payout?.amount || Math.abs(bankPayout.walletTransaction?.amount || 0);

  return (
    <div className={`mt-4 rounded-2xl border p-4 text-sm ${
      isSuccess
        ? 'border-white/15 bg-white/[0.06]'
        : 'border-[#E74C3C]/25 bg-[#E74C3C]/10'
    }`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className={`font-semibold ${isSuccess ? 'text-white' : 'text-[#E74C3C]'}`}>
            {isSuccess ? 'Bankauszahlung gestartet' : 'Bankauszahlung blockiert'}
          </p>
          <p className="mt-1 text-white/55">
            {isSuccess
              ? `${formatMoney(amount, currency)} werden per ${bankPayout.transfer?.provider || 'Payout Provider'} ausgezahlt.`
              : bankPayout.message}
          </p>
        </div>
        {bankPayout.transfer ? (
          <Badge className="w-fit border border-[#00D4FF]/20 bg-[#00D4FF]/10 text-[#00D4FF]">
            {bankPayout.transfer.status}
          </Badge>
        ) : null}
      </div>

      {bankPayout.transfer ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <PayoutMetric label="Transfer-ID" value={bankPayout.transfer.transferId} />
          <PayoutMetric label="Ankunft" value={formatDate(bankPayout.transfer.estimatedArrival)} />
          <PayoutMetric
            label="Wallet danach"
            value={bankPayout.wallet ? formatMoney(bankPayout.wallet.balance, bankPayout.wallet.currency) : '-'}
          />
        </div>
      ) : null}

      {bankPayout.payout ? (
        <p className="mt-3 text-xs leading-5 text-white/45">
          Payout {bankPayout.payout.id}. IBAN endet auf {bankPayout.payout.ibanLast4 || 'Demo'}. Risiko: {bankPayout.payout.riskLevel || 'green'}.
        </p>
      ) : null}
    </div>
  );
}

function PayoutReleasePanel({ payoutRelease }: { payoutRelease: PayoutReleaseView }) {
  const isSuccess = payoutRelease.success !== false && payoutRelease.release?.status === 'released';
  const currency = payoutRelease.release?.currency || payoutRelease.wallet?.currency || 'EUR';

  return (
    <div className={`mt-4 rounded-2xl border p-4 text-sm ${
      isSuccess
        ? 'border-[#00D4FF]/20 bg-[#00D4FF]/10'
        : 'border-[#E74C3C]/25 bg-[#E74C3C]/10'
    }`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className={`font-semibold ${isSuccess ? 'text-[#00D4FF]' : 'text-[#E74C3C]'}`}>
            {isSuccess ? 'Wallet-Auszahlung freigegeben' : 'Wallet-Auszahlung blockiert'}
          </p>
          <p className="mt-1 text-white/55">
            {isSuccess
              ? `${formatMoney(payoutRelease.release?.settlement.carrierWalletCredit || 0, currency)} wurden dem Transporteur-Wallet gutgeschrieben.`
              : payoutRelease.message || payoutRelease.release?.blockedReasons.join(' ')}
          </p>
        </div>
        {payoutRelease.wallet ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right">
            <p className="text-xs text-white/40">Wallet Saldo</p>
            <p className="font-semibold text-white">{formatMoney(payoutRelease.wallet.balance, payoutRelease.wallet.currency)}</p>
          </div>
        ) : null}
      </div>

      {payoutRelease.release ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {payoutRelease.release.gates.map((gate) => (
              <div key={gate.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white/70">{gate.label}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${gateStatusClass(gate.status)}`} />
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-white/42">{gate.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <PayoutMetric
              label="Transporteur Wallet"
              value={formatMoney(payoutRelease.release.settlement.carrierWalletCredit, currency)}
            />
            <PayoutMetric
              label="CargoBit Netto-Ertrag"
              value={formatMoney(payoutRelease.release.settlement.platformRevenueNet, currency)}
            />
            <PayoutMetric
              label="Kundenbetrag brutto"
              value={formatMoney(payoutRelease.release.settlement.shipperChargeGross, currency)}
            />
          </div>

          <p className="mt-3 text-xs leading-5 text-white/45">
            Referenz {payoutRelease.release.walletTransaction.reference}. {payoutRelease.release.nextStep.description}
          </p>
        </>
      ) : null}
    </div>
  );
}

function PayoutMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function gateStatusClass(status: PayoutGateViewStatus) {
  switch (status) {
    case 'passed':
      return 'bg-[#2ECC71] shadow-[0_0_16px_rgba(46,204,113,0.5)]';
    case 'review_required':
      return 'bg-[#F39C12] shadow-[0_0_16px_rgba(243,156,18,0.5)]';
    case 'blocked':
      return 'bg-[#E74C3C] shadow-[0_0_16px_rgba(231,76,60,0.5)]';
    default:
      return 'bg-white/35';
  }
}

function LifecycleStep({ stage }: { stage: LifecycleStageView }) {
  const tone = lifecycleTone(stage.status);

  return (
    <div className={`rounded-2xl border p-3 ${tone.container}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone.iconBg}`}>
          {stage.status === 'done' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : stage.status === 'active' ? (
            <Clock className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">{stage.owner}</span>
      </div>
      <p className="text-sm font-semibold leading-5">{stage.label}</p>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/48">{stage.description}</p>
    </div>
  );
}

function InvoiceSummary({ invoice }: { invoice: InvoiceDraftView | null }) {
  if (!invoice) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">
        Rechnungsvorschau ist noch nicht verfügbar.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/35">Rechnung</p>
          <h3 className="mt-1 font-semibold">{invoice.invoiceNumber}</h3>
        </div>
        <Wallet className="h-5 w-5 text-[#2ECC71]" />
      </div>

      <div className="space-y-2">
        {invoice.lineItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="mt-1 text-xs leading-4 text-white/45">{item.description}</p>
              </div>
              <p className="whitespace-nowrap text-sm font-semibold">{formatMoney(item.totalGross, invoice.currency)}</p>
            </div>
            <p className="mt-2 text-[11px] text-white/35">
              Netto {formatMoney(item.totalNet, invoice.currency)} · MwSt. {item.vatRate}% {formatMoney(item.vatAmount, invoice.currency)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-[#2ECC71]/20 bg-[#2ECC71]/10 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Gesamt brutto</span>
          <span className="text-lg font-bold text-[#2ECC71]">{formatMoney(invoice.totals.gross, invoice.currency)}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-white/50">
          Wallet geschützt · Auszahlung nach POD · Risk Gate aktiv
        </p>
      </div>
    </div>
  );
}

function lifecycleTone(status: LifecycleStageView['status']) {
  switch (status) {
    case 'done':
      return {
        container: 'border-[#2ECC71]/20 bg-[#2ECC71]/10 text-[#2ECC71]',
        iconBg: 'bg-[#2ECC71]/15 text-[#2ECC71]',
      };
    case 'active':
      return {
        container: 'border-[#00D4FF]/25 bg-[#00D4FF]/10 text-white shadow-lg shadow-[#00D4FF]/10',
        iconBg: 'bg-[#00D4FF]/15 text-[#00D4FF]',
      };
    case 'next':
      return {
        container: 'border-[#F39C12]/25 bg-[#F39C12]/10 text-white',
        iconBg: 'bg-[#F39C12]/15 text-[#F39C12]',
      };
    case 'blocked':
      return {
        container: 'border-[#E74C3C]/25 bg-[#E74C3C]/10 text-white',
        iconBg: 'bg-[#E74C3C]/15 text-[#E74C3C]',
      };
    default:
      return {
        container: 'border-white/10 bg-white/[0.03] text-white',
        iconBg: 'bg-white/[0.06] text-white/40',
      };
  }
}

function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

// ========================================
// Similar Orders
// ========================================
function SimilarOrders() {
  const similarOrders = [
    { id: 'TR-12400', from: 'Berlin', to: 'München', price: 820, risk: 'green' as const },
    { id: 'TR-12401', from: 'Berlin', to: 'Stuttgart', price: 780, risk: 'green' as const },
    { id: 'TR-12402', from: 'Hamburg', to: 'München', price: 950, risk: 'yellow' as const },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Ähnliche Aufträge</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {similarOrders.map((order) => (
          <TransportCard
            key={order.id}
            id={order.id}
            route={{ from: order.from, to: order.to }}
            risk={order.risk}
            price={order.price}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ========================================
// Footer Actions
// ========================================
function FooterActions() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
              <div>
                <div className="font-semibold">Max Mustermann</div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  4.9 · 127 Transporte
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <Phone className="w-4 h-4" />
              Kontakt
            </Button>
            <Button className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Auftrag annehmen
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ========================================
// Order Detail Page
// ========================================
interface OrderDetailPageProps {
  orderId?: string;
}

export default function OrderDetailPage({ orderId = 'TR-12345' }: OrderDetailPageProps) {
  return (
    <main className="dark min-h-screen bg-[#06121C] py-8 text-white" style={{ colorScheme: 'dark' }}>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4">
        {/* Header */}
        <OrderHeader orderId={orderId} status="Offen" risk="green" />

        <OrderCashFlow orderId={orderId} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <OrderInfo />
            <RiskSection />
            <InsuranceBox />
          </div>

          {/* Right Column - Sidebar */}
          <aside className="lg:col-span-1 flex flex-col gap-4">
            <BannerAd slot="order-detail-sidebar" />
            <SimilarOrders />
          </aside>
        </div>

        {/* Footer Actions */}
        <FooterActions />
      </div>
    </main>
  );
}
