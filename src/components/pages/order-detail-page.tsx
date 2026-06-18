'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { RiskBadge, RiskBar } from '@/components/cargobit/risk-badge';
import { InsuranceTier } from '@/components/cargobit/insurance-widget';
import { TransportCard } from '@/components/cargobit/transport-card';
import { BannerAd } from '@/components/ads/banner-ad';
import { LiveTrackingCard } from '@/components/tracking/live-tracking-card';
import { buildUserRequestHeaders, useAuthStore, type UserRole } from '@/lib/auth-store';
import {
  ArrowLeft,
  BriefcaseBusiness,
  MapPin,
  Calendar,
  Package,
  Truck,
  Clock,
  User,
  Shield,
  CheckCircle2,
  Circle,
  Info,
  Phone,
  ArrowRight,
  CreditCard,
  ExternalLink,
  Loader2,
  ReceiptText,
  Send,
  Star,
  Wallet,
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

type OrderViewerRole = 'shipper' | 'carrier' | 'driver' | 'dispatcher' | 'admin' | 'support' | 'marketer';

interface JobDetailView {
  id: string;
  status: string;
  dbStatus?: string;
  pickupAddress: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  deliveryAddress: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  pickupDatetime: string;
  deliveryDatetime?: string;
  description?: string;
  weightKg?: number;
  volumeM3?: number;
  transportType?: string;
  cargoDetails?: Record<string, unknown> | null;
  shipperBudget?: number;
  agreedPrice?: number;
  currency?: string;
  bids?: Array<{
    id: string;
    price: number;
    status: string;
  }>;
}

interface BidView {
  id: string;
  jobId: string;
  transporterId: string;
  transporterName?: string;
  transporterRating: number;
  vehicleId: string;
  vehicleType: string;
  price: number;
  currency: string;
  message?: string;
  estimatedDuration?: number;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  createdAt: string;
  validUntil?: string;
}

function getOrderViewerRole(role?: UserRole): OrderViewerRole {
  switch (role) {
    case 'ADMIN':
      return 'admin';
    case 'SUPPORT':
      return 'support';
    case 'MARKETER':
      return 'marketer';
    case 'CARRIER':
      return 'carrier';
    case 'DISPATCHER':
      return 'dispatcher';
    case 'DRIVER_SELF_EMPLOYED':
      return 'driver';
    case 'SHIPPER_COMPANY':
    case 'SHIPPER_PRIVATE':
    default:
      return 'shipper';
  }
}

function getOrderViewerOverride(value?: string | null): OrderViewerRole | null {
  const allowed: OrderViewerRole[] = ['shipper', 'carrier', 'driver', 'dispatcher', 'admin', 'support', 'marketer'];
  return allowed.includes(value as OrderViewerRole) ? value as OrderViewerRole : null;
}

function canUserRoleSubmitBid(role?: UserRole) {
  return role === 'CARRIER' || role === 'DISPATCHER' || role === 'DRIVER_SELF_EMPLOYED';
}

function isInternalViewer(viewer: OrderViewerRole) {
  return viewer === 'admin' || viewer === 'support';
}

function getWalletHref(viewer: OrderViewerRole) {
  return viewer === 'driver' ? '/driver/earnings' : '/carrier/wallet';
}

function authRequestHeaders(user: ReturnType<typeof useAuthStore.getState>['user']): Record<string, string> {
  return buildUserRequestHeaders(user);
}

// ========================================
// Order Header
// ========================================
interface OrderHeaderProps {
  orderId: string;
  status: string;
  risk: 'green' | 'yellow' | 'red';
  backHref: string;
  backLabel?: string;
}

function OrderHeader({ orderId, status, risk, backHref, backLabel = 'Zurück' }: OrderHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-white hover:bg-white/10 hover:text-white">
          <a href={backHref}>
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </a>
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
function OrderInfo({ job }: { job?: JobDetailView | null }) {
  const pickup = job?.pickupAddress;
  const delivery = job?.deliveryAddress;
  const cargoSummary = getCargoSummary(job);
  const transportType = formatTransportType(job?.transportType);
  const price = job?.agreedPrice || job?.shipperBudget || 850;
  const currency = job?.currency || 'EUR';

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
            <div className="text-lg font-semibold">{pickup ? `${pickup.city}, ${pickup.country}` : 'Berlin, Deutschland'}</div>
            <div className="text-sm text-muted-foreground">
              {pickup ? [pickup.street, pickup.postalCode].filter(Boolean).join(', ') : 'Musterstraße 123, 10115'}
            </div>
          </div>
          <ArrowRight className="w-6 h-6 text-muted-foreground" />
          <div className="flex-1 text-right">
            <div className="text-sm text-muted-foreground">Zielort</div>
            <div className="text-lg font-semibold">{delivery ? `${delivery.city}, ${delivery.country}` : 'München, Deutschland'}</div>
            <div className="text-sm text-muted-foreground">
              {delivery ? [delivery.street, delivery.postalCode].filter(Boolean).join(', ') : 'Beispielweg 456, 80331'}
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Abholdatum</div>
            <div className="font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {job?.pickupDatetime ? formatDate(job.pickupDatetime) : '15.04.2024'}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Lieferdatum</div>
            <div className="font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {job?.deliveryDatetime ? formatDate(job.deliveryDatetime) : '16.04.2024'}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Frachtart</div>
            <div className="font-medium flex items-center gap-2">
              <Package className="w-4 h-4" />
              {transportType}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Gewicht</div>
            <div className="font-medium flex items-center gap-2">
              <Truck className="w-4 h-4" />
              {job?.weightKg ? `${job.weightKg.toLocaleString('de-DE')} kg` : '2.500 kg'}
            </div>
          </div>
        </div>

        <Separator />

        {/* Cargo Description */}
        <div>
          <div className="text-sm text-muted-foreground mb-2">Frachtbeschreibung</div>
          <p className="text-sm">
            {job?.description || '10 Europaletten mit Elektronik-Komponenten. Empfindliche Ware, trocken lagern. Stapelbar bis max. 3 Lagen. Wert ca. 45.000 €.'}
          </p>
          {cargoSummary ? (
            <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm text-muted-foreground">
              {cargoSummary}
            </div>
          ) : null}
        </div>

        {/* Price */}
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
          <div>
            <div className="text-sm text-muted-foreground">Transportpreis</div>
            <div className="text-2xl font-bold">{formatMoney(price, currency)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Zahlungsart</div>
            <div className="font-medium flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Zahlungsschutz
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
function OrderCashFlow({
  orderId,
  viewer,
  userId,
  userRole,
}: {
  orderId: string;
  viewer: OrderViewerRole;
  userId?: string;
  userRole?: UserRole;
}) {
  const [lifecycle, setLifecycle] = React.useState<LifecycleStageView[]>([]);
  const [invoice, setInvoice] = React.useState<InvoiceDraftView | null>(null);
  const [issuedInvoice, setIssuedInvoice] = React.useState<IssuedInvoiceView | null>(null);
  const [payoutRelease, setPayoutRelease] = React.useState<PayoutReleaseView | null>(null);
  const [source, setSource] = React.useState<'database' | 'fallback' | 'blueprint'>('fallback');
  const [loading, setLoading] = React.useState(true);
  const [issuing, setIssuing] = React.useState(false);
  const [releasing, setReleasing] = React.useState(false);
  const canIssueInvoice = isInternalViewer(viewer);
  const canManualRelease = viewer === 'admin';
  const canOpenOwnWallet = viewer === 'carrier' || viewer === 'dispatcher';
  const showInternalData = isInternalViewer(viewer);
  const requestHeaders = React.useMemo<Record<string, string>>(() => {
    if (!userId) return {};

    return buildUserRequestHeaders({
      id: userId,
      email: `${userId}@local.cargobit.test`,
      role: userRole || 'SHIPPER_PRIVATE',
    });
  }, [userId, userRole]);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const [lifecycleResponse, invoiceResponse, releaseResponse] = await Promise.all([
          fetch(`/api/orders/lifecycle?orderId=${encodeURIComponent(orderId)}`),
          fetch(`/api/orders/${encodeURIComponent(orderId)}/invoice?amount=850`),
          fetch(`/api/orders/${encodeURIComponent(orderId)}/payout/release?amount=850`, {
            headers: requestHeaders,
          }),
        ]);
        const lifecyclePayload = await lifecycleResponse.json();
        const invoicePayload = await invoiceResponse.json();
        const releasePayload = releaseResponse.ok ? await releaseResponse.json() : null;

        if (cancelled) return;

        setLifecycle(lifecyclePayload.lifecycle || []);
        setInvoice(invoicePayload.invoice || null);
        if (releasePayload?.release) {
          setPayoutRelease({
            success: releasePayload.release.status !== 'blocked',
            message: releasePayload.message,
            release: releasePayload.release,
            wallet: releasePayload.wallet,
            walletTransaction: releasePayload.walletTransaction,
            notification: releasePayload.notification,
            duplicate: releasePayload.duplicate,
            source: releasePayload.source,
          });
        }
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
  }, [orderId, requestHeaders]);

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
    const reason = window.prompt('Audit-Grund für manuelle Admin-/Finance-Freigabe', 'Manuelle Admin-Freigabe nach Prüfung');
    if (!reason || reason.trim().length < 8) return;

    setReleasing(true);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/payout/release`, {
        method: 'POST',
        headers: {
          ...requestHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: invoice?.lineItems[0]?.totalNet || 850,
          reason,
        }),
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
        message: 'Zahlungsfreigabe konnte lokal nicht ausgeführt werden.',
      });
    } finally {
      setReleasing(false);
    }
  };

  return (
    <Card className="overflow-hidden border-white/10 bg-[#071927] text-white shadow-2xl shadow-black/25">
      <CardHeader className="border-b border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ReceiptText className="h-5 w-5 text-[#00D4FF]" />
              Auftrag bis Zahlungsschutz
            </CardTitle>
            <CardDescription className="mt-1 text-white/55">
              Matching, Annahme, Transportstatus, POD, Rechnung und Freigabe in einem Ablauf.
            </CardDescription>
          </div>
          <Badge className={source === 'database' ? 'bg-[#2ECC71] text-[#06121C]' : 'bg-[#00D4FF]/15 text-[#00D4FF]'}>
            {showInternalData ? (source === 'database' ? 'Live Daten' : 'Preview-Daten') : 'Zahlungsschutz aktiv'}
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
                  {isInternalViewer(viewer) ? (
                    <Button asChild className="bg-[#1C7ED6] text-white hover:bg-[#166BBB]">
                      <a href="/driver/mobile">Fahreransicht öffnen</a>
                    </Button>
                  ) : null}
                  {canIssueInvoice ? (
                    <Button
                      type="button"
                      disabled={issuing}
                      onClick={issueInvoice}
                      className="bg-[#2ECC71] text-[#06121C] hover:bg-[#27B765]"
                    >
                      {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Rechnung ausstellen & E-Mail vorbereiten
                    </Button>
                  ) : null}
                  {canManualRelease ? (
                    <Button
                      type="button"
                      disabled={releasing || !invoice}
                      onClick={releasePayout}
                      className="bg-[#00D4FF] text-[#06121C] hover:bg-[#35DFFF]"
                    >
                      {releasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                      Manuell freigeben
                    </Button>
                  ) : null}
                  {canOpenOwnWallet ? (
                    <Button asChild className="bg-white text-[#06121C] hover:bg-white/85">
                      <a href={getWalletHref(viewer)}>
                        <Wallet className="h-4 w-4" />
                        Auszahlungen öffnen
                      </a>
                    </Button>
                  ) : null}
                  {viewer === 'shipper' ? (
                    <Button asChild variant="outline" className="border-[#F39C12]/30 bg-[#F39C12]/10 text-[#F39C12] hover:bg-[#F39C12]/15 hover:text-[#F39C12]">
                      <a href={`/support/tickets?orderId=${encodeURIComponent(orderId)}`}>Schaden oder Streitfall melden</a>
                    </Button>
                  ) : null}
                  {showInternalData ? (
                    <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                      <a href={`/api/orders/${orderId}/invoice?amount=850`}>Rechnungsdaten prüfen</a>
                    </Button>
                  ) : null}
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
                  <PayoutReleasePanel payoutRelease={payoutRelease} viewer={viewer} />
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

function PayoutReleasePanel({
  payoutRelease,
  viewer,
}: {
  payoutRelease: PayoutReleaseView;
  viewer: OrderViewerRole;
}) {
  const releaseStatus = payoutRelease.release?.status;
  const isReleased = payoutRelease.success !== false && releaseStatus === 'released';
  const isBlocked = payoutRelease.success === false || releaseStatus === 'blocked';
  const currency = payoutRelease.release?.currency || payoutRelease.wallet?.currency || 'EUR';
  const showInternalData = isInternalViewer(viewer);
  const title = isReleased
    ? 'Auftragszahlung freigegeben'
    : releaseStatus === 'ready'
      ? 'Automatische Freigabe vorbereitet'
      : 'Zahlungsfreigabe blockiert';

  return (
    <div className={`mt-4 rounded-2xl border p-4 text-sm ${
      isReleased || releaseStatus === 'ready'
        ? 'border-[#00D4FF]/20 bg-[#00D4FF]/10'
        : 'border-[#E74C3C]/25 bg-[#E74C3C]/10'
    }`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className={`font-semibold ${isBlocked ? 'text-[#E74C3C]' : 'text-[#00D4FF]'}`}>
            {title}
          </p>
          <p className="mt-1 text-white/55">
            {isReleased
              ? `${formatMoney(payoutRelease.release?.settlement.carrierWalletCredit || 0, currency)} wurden zur Auszahlung freigegeben.`
              : releaseStatus === 'ready'
                ? 'Die automatische Freigabe erfolgt nach POD, Rechnung und abgelaufener 24-Werktagsstunden-Frist.'
              : payoutRelease.message || payoutRelease.release?.blockedReasons.join(' ')}
          </p>
        </div>
        {payoutRelease.wallet ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right">
            <p className="text-xs text-white/40">Freigegeben</p>
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
            {viewer === 'carrier' || viewer === 'dispatcher' || showInternalData ? (
              <PayoutMetric
                label="Transporteur-Auszahlung"
                value={formatMoney(payoutRelease.release.settlement.carrierWalletCredit, currency)}
              />
            ) : null}
            {showInternalData ? (
              <PayoutMetric
                label="CargoBit Netto-Ertrag"
                value={formatMoney(payoutRelease.release.settlement.platformRevenueNet, currency)}
              />
            ) : null}
            {viewer === 'shipper' || showInternalData ? (
              <PayoutMetric
                label="Kundenbetrag brutto"
                value={formatMoney(payoutRelease.release.settlement.shipperChargeGross, currency)}
              />
            ) : null}
          </div>

          {showInternalData ? (
            <p className="mt-3 text-xs leading-5 text-white/45">
              Referenz {payoutRelease.release.walletTransaction.reference}. {payoutRelease.release.nextStep.description}
            </p>
          ) : (
            <p className="mt-3 text-xs leading-5 text-white/45">
              Bankauszahlung ist ausschließlich im eigenen Auszahlungsbereich möglich.
            </p>
          )}
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
          Zahlungsschutz aktiv · Auszahlung nach POD · Risk Gate aktiv
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

function formatTransportType(type?: string) {
  const labels: Record<string, string> = {
    PALLET: 'Paletten',
    BULK: 'Schüttgut',
    LIQUID: 'Flüssigkeiten',
    OVERSIZE: 'Übergröße',
    LOWLOADER: 'Tieflader',
    CAR_TRANSPORT: 'Fahrzeugtransport',
    COOLING: 'Kühltransport',
    HAZMAT: 'Gefahrgut',
    CONTAINER: 'Container',
    pallet: 'Paletten',
    bulk: 'Schüttgut',
    liquid: 'Flüssigkeiten',
    oversize: 'Übergröße',
    lowloader: 'Tieflader',
    car_transport: 'Fahrzeugtransport',
    cooling: 'Kühltransport',
    hazmat: 'Gefahrgut',
    container: 'Container',
  };
  return type ? labels[type] || type : 'Paletten';
}

function formatStatus(status?: string, dbStatus?: string) {
  const value = dbStatus || status;
  const labels: Record<string, string> = {
    CREATED: 'Entwurf',
    PUBLISHED: 'Veröffentlicht',
    ASSIGNED: 'Zugewiesen',
    IN_TRANSIT: 'Unterwegs',
    PICKUP_DONE: 'Abgeholt',
    DELIVERY_DONE: 'Geliefert',
    COMPLETED: 'Abgeschlossen',
    CANCELLED: 'Storniert',
    open: 'Offen',
    matched: 'Veröffentlicht',
    booked: 'Zugewiesen',
    in_progress: 'Unterwegs',
    completed: 'Abgeschlossen',
    canceled: 'Storniert',
  };
  return value ? labels[value] || value : 'Offen';
}

function getCargoSummary(job?: JobDetailView | null) {
  if (!job) return null;
  const details = job.cargoDetails || {};
  const directSummary = typeof details.summary === 'string' ? details.summary : null;
  const normalized = details.normalized && typeof details.normalized === 'object'
    ? details.normalized as { volumeM3?: number; weightKg?: number }
    : null;
  const parts = [
    directSummary,
    job.volumeM3 ? `${job.volumeM3.toLocaleString('de-DE')} m³` : normalized?.volumeM3 ? `${normalized.volumeM3.toLocaleString('de-DE')} m³` : null,
    job.bids?.length ? `${job.bids.length} Angebot(e)` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' • ') : null;
}

function isDemoOrderId(orderId: string) {
  return orderId.startsWith('mission_demo') || orderId.startsWith('demo') || orderId.startsWith('TR-');
}

function WalletTopupNotice({
  orderId,
  job,
  user,
  onPublished,
}: {
  orderId: string;
  job?: JobDetailView | null;
  user: ReturnType<typeof useAuthStore.getState>['user'];
  onPublished?: () => void;
}) {
  const [publishing, setPublishing] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  if (!job || job.dbStatus !== 'CREATED') return null;

  const reservedAmount = job.shipperBudget || job.agreedPrice || 0;
  const walletHref = `/shipper/wallet?amount=${encodeURIComponent(String(Math.ceil(reservedAmount)))}&returnTo=${encodeURIComponent(`/orders/${orderId}`)}`;

  const publishJob = async () => {
    if (!user?.id) {
      setMessage('Bitte als Auftraggeber anmelden, um den Auftrag zu veröffentlichen.');
      return;
    }

    setPublishing(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(orderId)}/publish`, {
        method: 'POST',
        headers: authRequestHeaders(user),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Auftrag konnte nicht veröffentlicht werden.');

      setMessage('Auftrag wurde veröffentlicht und ist jetzt im Marketplace sichtbar.');
      onPublished?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Auftrag konnte nicht veröffentlicht werden.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Card className="border-[#F39C12]/25 bg-[#F39C12]/10 text-white shadow-lg shadow-[#F39C12]/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-[#F39C12]" />
          Auftrag als Entwurf gespeichert
        </CardTitle>
        <CardDescription className="text-white/65">
          Der Auftrag geht erst online, wenn die auftragsbezogene Zahlung für KI-Preis und Gebühren vorbereitet werden kann.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-white/55">Aktuell geplanter Zahlungsschutz-Betrag</p>
            <p className="text-2xl font-bold">{formatMoney(reservedAmount, job.currency || 'EUR')}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="bg-[#F39C12] text-[#06121C] hover:bg-[#d8890f]">
              <a href={walletHref}>Zahlung vorbereiten</a>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={publishJob}
              disabled={publishing}
              className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Auftrag veröffentlichen
            </Button>
          </div>
        </div>
        {message ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/65">
            {message}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OrderDataError({ message }: { message: string }) {
  return (
    <Card className="border-[#E74C3C]/25 bg-[#E74C3C]/10 text-white">
      <CardContent className="flex items-start gap-3 p-4">
        <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#E74C3C]" />
        <div>
          <p className="font-medium">Auftragsdaten konnten nicht geladen werden.</p>
          <p className="mt-1 text-sm text-white/60">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderBidsPanel({
  orderId,
  job,
  viewer,
  user,
  onJobChanged,
  panelRef,
}: {
  orderId: string;
  job?: JobDetailView | null;
  viewer: OrderViewerRole;
  user: ReturnType<typeof useAuthStore.getState>['user'];
  onJobChanged?: () => void;
  panelRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [bids, setBids] = React.useState<BidView[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [acceptingBidId, setAcceptingBidId] = React.useState<string | null>(null);
  const [price, setPrice] = React.useState(() => String(Math.round((job?.shipperBudget || 850) * 0.95)));
  const [estimatedDuration, setEstimatedDuration] = React.useState('480');
  const [validUntilHours, setValidUntilHours] = React.useState('24');
  const [message, setMessage] = React.useState('Ich kann den Transport zuverlässig übernehmen.');
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [submittedBidId, setSubmittedBidId] = React.useState<string | null>(null);
  const isDemoOrder = isDemoOrderId(orderId);
  const canSubmitBid = viewer === 'carrier' || viewer === 'dispatcher' || viewer === 'driver';
  const userCanSubmitBid = canUserRoleSubmitBid(user?.role);
  const showBidForm = canSubmitBid && (!user?.id || userCanSubmitBid);
  const canAcceptBid = viewer === 'shipper';
  const minimumPrice = job?.shipperBudget ? Math.round(job.shipperBudget * 0.8 * 100) / 100 : null;
  const jobOpenForBids = !isDemoOrder && (!job || job.dbStatus === 'PUBLISHED');
  const parsedPrice = Number(price.replace(',', '.'));
  const priceIsValid = Number.isFinite(parsedPrice) && parsedPrice > 0;
  const bidBlockedReason = isDemoOrder
    ? 'Dieser Preview-Auftrag ist nicht buchbar. Angebote können nur auf echte veröffentlichte Aufträge abgegeben werden.'
    : !jobOpenForBids
      ? 'Dieser Auftrag ist aktuell nicht für Angebote geöffnet.'
      : !user?.id
        ? 'Bitte als Transporteur, Dispatcher oder selbstständiger Fahrer anmelden.'
        : !userCanSubmitBid
          ? 'Ihr aktuelles Konto darf keine Transportangebote abgeben.'
          : !priceIsValid
            ? 'Bitte einen gültigen Angebotspreis eintragen.'
            : minimumPrice && parsedPrice < minimumPrice
              ? `Das Angebot liegt unter der Anti-Dumping-Grenze von ${formatMoney(minimumPrice, job?.currency || 'EUR')}.`
              : null;

  const loadBids = React.useCallback(async () => {
    if (!user?.id || isDemoOrderId(orderId)) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(orderId)}/bids`, {
        headers: authRequestHeaders(user),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Angebote konnten nicht geladen werden.');
      setBids(payload.bids || []);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Angebote konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [orderId, user]);

  React.useEffect(() => {
    void loadBids();
  }, [loadBids]);

  React.useEffect(() => {
    if (job?.shipperBudget) {
      setPrice(String(Math.round(job.shipperBudget * 0.95)));
    }
  }, [job?.shipperBudget]);

  const submitBid = async () => {
    if (!user?.id) {
      setFeedback('Bitte anmelden, um ein Angebot abzugeben.');
      return;
    }

    if (!userCanSubmitBid) {
      setFeedback('Bitte als Transporteur, Dispatcher oder selbstständiger Fahrer anmelden, um ein Angebot abzugeben.');
      return;
    }

    if (isDemoOrder) {
      setFeedback('Dieser Preview-Auftrag ist nicht buchbar. Öffne einen echten veröffentlichten Auftrag aus dem Marketplace.');
      return;
    }

    if (!priceIsValid) {
      setFeedback('Bitte einen gültigen Angebotspreis eintragen.');
      return;
    }

    if (minimumPrice && parsedPrice < minimumPrice) {
      setFeedback(`Das Angebot liegt unter der Anti-Dumping-Grenze von ${formatMoney(minimumPrice, job?.currency || 'EUR')}.`);
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    setSubmittedBidId(null);

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(orderId)}/bids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authRequestHeaders(user),
        },
        body: JSON.stringify({
          price: parsedPrice,
          message,
          estimatedDuration: Number(estimatedDuration) || undefined,
          validUntilHours: Number(validUntilHours) || 24,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || 'Angebot konnte nicht abgegeben werden.');

      setBids(payload.bids || []);
      setSubmittedBidId(payload.bidId || null);
      setFeedback('Angebot wurde abgegeben.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Angebot konnte nicht abgegeben werden.');
    } finally {
      setSubmitting(false);
    }
  };

  const acceptBid = async (bidId: string) => {
    if (!user?.id) return;

    setAcceptingBidId(bidId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(orderId)}/accept_bid`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authRequestHeaders(user),
        },
        body: JSON.stringify({ bid_id: bidId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || 'Angebot konnte nicht angenommen werden.');

      setFeedback('Angebot wurde angenommen. Der Auftrag ist jetzt zugewiesen.');
      await loadBids();
      onJobChanged?.();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Angebot konnte nicht angenommen werden.');
    } finally {
      setAcceptingBidId(null);
    }
  };

  return (
    <Card ref={panelRef} className="border-white/10 bg-[#071927] text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-[#00D4FF]" />
          Angebote
        </CardTitle>
        <CardDescription className="text-white/55">
          Transporteure können den KI-Preis unterbieten, solange die Untergrenze gegen unrealistische Dumping-Angebote eingehalten wird.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {minimumPrice ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
            KI-/Budgetpreis: <span className="font-semibold text-white">{formatMoney(job?.shipperBudget || 0, job?.currency || 'EUR')}</span>
            {' · '}
            Untergrenze: <span className="font-semibold text-[#F39C12]">{formatMoney(minimumPrice, job?.currency || 'EUR')}</span>
            <span className="mt-1 block text-xs text-white/40">
              Angebote darunter werden blockiert, damit keine unseriösen Preise in den Auftrag gelangen.
            </span>
          </div>
        ) : null}

        {isDemoOrder ? (
          <div className="rounded-2xl border border-[#F39C12]/25 bg-[#F39C12]/10 p-4 text-sm text-[#F8D99A]">
            Dieser Preview-Auftrag dient nur zur Ansicht des Ablaufs. Für echte Angebote muss der Auftrag aus
            `/carrier/loads` kommen und den Status „Veröffentlicht“ haben.
          </div>
        ) : null}

        {canSubmitBid && user?.id && !userCanSubmitBid ? (
          <div className="rounded-2xl border border-[#F39C12]/25 bg-[#F39C12]/10 p-4 text-sm text-[#F8D99A]">
            Sie sehen diese Seite in der Transporteur-Ansicht. Angebote abgeben können aber nur angemeldete
            Transporteure, Dispatcher oder selbstständige Fahrer.
          </div>
        ) : null}

        {showBidForm ? (
          <div className="rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/10 p-4">
            {!user?.id ? (
              <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
                Zum Abgeben eines Angebots bitte als Transporteur, Dispatcher oder selbstständiger Fahrer anmelden.
              </div>
            ) : null}
            <div className="grid gap-3 lg:grid-cols-[160px_160px_160px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="bidPrice" className="text-white/70">Angebotspreis</Label>
                <Input
                  id="bidPrice"
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  disabled={!jobOpenForBids}
                  className="border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bidDuration" className="text-white/70">Dauer in Minuten</Label>
                <Input
                  id="bidDuration"
                  inputMode="numeric"
                  value={estimatedDuration}
                  onChange={(event) => setEstimatedDuration(event.target.value)}
                  disabled={!jobOpenForBids}
                  className="border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bidValidity" className="text-white/70">Gültigkeit in Stunden</Label>
                <Input
                  id="bidValidity"
                  inputMode="numeric"
                  value={validUntilHours}
                  onChange={(event) => setValidUntilHours(event.target.value)}
                  disabled={!jobOpenForBids}
                  className="border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bidMessage" className="text-white/70">Nachricht</Label>
                <Textarea
                  id="bidMessage"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  disabled={!jobOpenForBids}
                  className="min-h-20 border-white/10 bg-black/20 text-white"
                />
              </div>
            </div>
            {bidBlockedReason ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
                {bidBlockedReason}
              </div>
            ) : null}
            <Button
              type="button"
              onClick={submitBid}
              disabled={!jobOpenForBids || submitting || Boolean(bidBlockedReason)}
              className="mt-4 bg-[#00D4FF] text-[#06121C] hover:bg-[#35DFFF]"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Angebot abgeben
            </Button>
          </div>
        ) : null}

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Angebote werden geladen
            </div>
          ) : bids.length ? (
            bids.map((bid) => (
              <div key={bid.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{bid.transporterName || 'Transporteur'}</p>
                    <Badge className={bid.status === 'accepted' ? 'bg-[#2ECC71]/15 text-[#2ECC71]' : 'bg-white/10 text-white/70'}>
                      {formatBidStatus(bid.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-white/45">
                    {bid.vehicleType} · Bewertung {bid.transporterRating.toFixed(1)} · {bid.message || 'Keine Nachricht'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xl font-bold">{formatMoney(bid.price, bid.currency)}</p>
                  {canAcceptBid && bid.status === 'pending' ? (
                    <Button
                      type="button"
                      onClick={() => acceptBid(bid.id)}
                      disabled={acceptingBidId === bid.id}
                      className="bg-[#2ECC71] text-[#06121C] hover:bg-[#27b765]"
                    >
                      {acceptingBidId === bid.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Annehmen
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
              Noch keine Angebote vorhanden.
            </div>
          )}
        </div>

        {feedback ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
            {feedback}
            {submittedBidId ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" className="bg-[#00D4FF] text-[#06121C] hover:bg-[#35DFFF]">
                  <a href="/carrier/jobs?view=offers">
                    Meine Angebote ansehen
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
                  <a href="/carrier/loads">
                    Weitere Aufträge suchen
                  </a>
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatBidStatus(status: BidView['status']) {
  const labels: Record<BidView['status'], string> = {
    pending: 'Offen',
    accepted: 'Angenommen',
    rejected: 'Abgelehnt',
    withdrawn: 'Zurückgezogen',
  };
  return labels[status];
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

function CarrierOrderSidebar({ onBidClick }: { onBidClick?: () => void }) {
  return (
    <Card className="border-white/10 bg-[#071927] text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-5 w-5 text-[#00D4FF]" />
          Transporteur-Aktion
        </CardTitle>
        <CardDescription className="text-white/55">
          Prüfe Route, Untergrenze und Zahlungsschutz. Danach kannst du direkt ein Angebot abgeben.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button type="button" className="w-full bg-[#00D4FF] text-[#06121C] hover:bg-[#35DFFF]" onClick={onBidClick}>
          <Send className="h-4 w-4" />
          Zum Angebot
        </Button>
        <Button asChild variant="outline" className="w-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
          <a href="/carrier/jobs">
            <BriefcaseBusiness className="h-4 w-4" />
            Meine Aufträge
          </a>
        </Button>
        <Button asChild variant="outline" className="w-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
          <a href="/carrier/loads">
            <ArrowLeft className="h-4 w-4" />
            Weitere Aufträge
          </a>
        </Button>
        <Button asChild variant="outline" className="w-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:text-white">
          <a href="/carrier/wallet">
            <Wallet className="h-4 w-4" />
            Wallet öffnen
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

// ========================================
// Footer Actions
// ========================================
function DriverOrderView({ orderId }: { orderId: string }) {
  return (
    <main className="dark min-h-screen bg-[#06121C] py-6 text-white" style={{ colorScheme: 'dark' }}>
      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4">
        <OrderHeader orderId={orderId} status="Tour aktiv" risk="green" backHref="/driver/mobile" backLabel="Zur Fahreransicht" />
        <Card className="border-white/10 bg-[#071927] text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#00D4FF]" />
              Fahreransicht
            </CardTitle>
            <CardDescription className="text-white/55">
              Für Fahrer bleiben nur Tour, Status, Fotos und POD/eCMR sichtbar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">Nächste Aktion</p>
              <p className="mt-2 text-lg font-semibold">POD / eCMR erfassen</p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Lieferung bestätigen, Fotos hochladen und digitale Signatur erfassen.
              </p>
            </div>
            <Button asChild className="w-full bg-[#1C7ED6] text-white hover:bg-[#166BBB]">
              <a href="/driver/mobile">Mobile Tour öffnen</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function FooterActions({
  viewer,
  onBidClick,
}: {
  viewer: OrderViewerRole;
  onBidClick?: () => void;
}) {
  const canAcceptOrder = viewer === 'carrier' || viewer === 'dispatcher';
  const canReportIssue = viewer === 'shipper';
  const canReview = isInternalViewer(viewer);

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
            {canAcceptOrder ? (
              <Button className="gap-2" onClick={onBidClick}>
                <CheckCircle2 className="w-4 h-4" />
                Angebot abgeben
              </Button>
            ) : null}
            {canReportIssue ? (
              <Button variant="outline" className="gap-2 border-[#F39C12]/40 text-[#F39C12]">
                <Shield className="w-4 h-4" />
                Streitfall melden
              </Button>
            ) : null}
            {canReview ? (
              <Button className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Admin-Prüfung
              </Button>
            ) : null}
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
  const user = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  const viewer = getOrderViewerOverride(searchParams.get('viewer')) || getOrderViewerRole(user?.role);
  const [job, setJob] = React.useState<JobDetailView | null>(null);
  const [jobLoading, setJobLoading] = React.useState(false);
  const [jobError, setJobError] = React.useState<string | null>(null);
  const [jobReloadKey, setJobReloadKey] = React.useState(0);
  const bidsPanelRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToBids = React.useCallback(() => {
    bidsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const backTarget = React.useMemo(() => {
    if (viewer === 'carrier' || viewer === 'dispatcher') {
      return { href: '/carrier/loads', label: 'Zurück zu Aufträgen' };
    }
    if (viewer === 'driver') {
      return { href: '/driver/mobile', label: 'Zur Fahreransicht' };
    }
    if (viewer === 'admin' || viewer === 'support') {
      return { href: '/admin/jobs', label: 'Zur Admin-Auftragsliste' };
    }
    return { href: '/dashboard', label: 'Zurück zum Dashboard' };
  }, [viewer]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadJob() {
      await Promise.resolve();

      if (!user?.id || isDemoOrderId(orderId)) {
        if (!cancelled) {
          setJob(null);
          setJobError(null);
          setJobLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setJobLoading(true);
        setJobError(null);
      }

      try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(orderId)}`, {
          headers: buildUserRequestHeaders(user),
        });
        const payload = await response.json();

        if (cancelled) return;

        if (!response.ok || !payload.job) {
          throw new Error(payload.error || 'Auftrag nicht gefunden oder Zugriff verweigert.');
        }

        setJob(payload.job);
      } catch (error) {
        if (!cancelled) {
          setJob(null);
          setJobError(error instanceof Error ? error.message : 'Auftrag konnte nicht geladen werden.');
        }
      } finally {
        if (!cancelled) setJobLoading(false);
      }
    }

    void loadJob();

    return () => {
      cancelled = true;
    };
  }, [jobReloadKey, orderId, user?.email, user?.id, user?.role]);

  if (viewer === 'driver') {
    return <DriverOrderView orderId={orderId} />;
  }

  return (
    <main className="dark min-h-screen bg-[#06121C] py-8 text-white" style={{ colorScheme: 'dark' }}>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4">
        {/* Header */}
        <OrderHeader
          orderId={orderId}
          status={jobLoading ? 'Wird geladen' : formatStatus(job?.status, job?.dbStatus)}
          risk="green"
          backHref={backTarget.href}
          backLabel={backTarget.label}
        />

        <OrderCashFlow orderId={orderId} viewer={viewer} userId={user?.id} userRole={user?.role} />

        {jobError ? <OrderDataError message={jobError} /> : null}
        <WalletTopupNotice
          orderId={orderId}
          job={job}
          user={user}
          onPublished={() => setJobReloadKey((value) => value + 1)}
        />

        <LiveTrackingCard
          transportId={orderId}
          userId={user?.id}
          userRole={user?.role}
          internalView={isInternalViewer(viewer)}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <OrderInfo job={job} />
            <OrderBidsPanel
              orderId={orderId}
              job={job}
              viewer={viewer}
              user={user}
              onJobChanged={() => setJobReloadKey((value) => value + 1)}
              panelRef={bidsPanelRef}
            />
            {(viewer === 'admin' || viewer === 'support' || viewer === 'shipper') ? <RiskSection /> : null}
            {(viewer === 'admin' || viewer === 'support' || viewer === 'shipper') ? <InsuranceBox /> : null}
          </div>

          {/* Right Column - Sidebar */}
          <aside className="lg:col-span-1 flex flex-col gap-4">
            <BannerAd slot="order-detail-sidebar" />
            {viewer === 'carrier' || viewer === 'dispatcher' ? (
              <CarrierOrderSidebar onBidClick={scrollToBids} />
            ) : (
              <SimilarOrders />
            )}
          </aside>
        </div>

        {/* Footer Actions */}
        <FooterActions viewer={viewer} onBidClick={scrollToBids} />
      </div>
    </main>
  );
}
