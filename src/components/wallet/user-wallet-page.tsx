'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildUserRequestHeaders, useAuthStore, type User } from '@/lib/auth-store';
import { ArrowLeft, CreditCard, Loader2, ShieldCheck, Wallet } from 'lucide-react';

type WalletPurpose = 'shipper' | 'carrier' | 'driver';

interface WalletTransactionView {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description?: string | null;
  reference?: string | null;
  createdAt: string;
}

interface PayoutMethodView {
  id: string;
  iban: string;
  holderName: string;
  verified: boolean;
  isDefault: boolean;
}

interface WalletView {
  id: string;
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  currency: string;
  status: string;
  recentTransactions: WalletTransactionView[];
  payoutMethods: PayoutMethodView[];
  payoutLimits?: {
    minAmount: number;
    maxAmount: number;
    processingDays: number;
    currency: string;
  };
}

function pageCopy(purpose: WalletPurpose) {
  if (purpose === 'shipper') {
    return {
      badge: 'Zahlungsschutz',
      backHref: '/dashboard?role=shipper',
      loading: 'Zahlungsschutzdaten werden geladen',
      primaryMetric: 'Für neue Aufträge verfügbar',
      reservedMetric: 'Für Aufträge reserviert',
      totalMetric: 'Gesamt vorbereitet',
      movementsTitle: 'Zahlungsschutz-Bewegungen',
      movementsDescription: 'Aufladungen, Reservierungen, Gebühren und Freigaben bleiben hier nachvollziehbar.',
      empty: 'Noch keine Zahlungsschutz-Bewegungen.',
      sideTitle: 'Zahlung vorbereiten',
      sideDescription: 'Der Betrag wird für neue Aufträge reserviert, bevor Speditionen Angebote abgeben können.',
    };
  }

  if (purpose === 'driver') {
    return {
      badge: 'Fahrer-Verdienst',
      backHref: '/dashboard?role=driver',
      loading: 'Verdienstdaten werden geladen',
      primaryMetric: 'Auszahlbar',
      reservedMetric: 'Noch nicht freigegeben',
      totalMetric: 'Freigegeben gesamt',
      movementsTitle: 'Tour-Zahlungen',
      movementsDescription: 'Freigegebene Tour-Zahlungen und Bankauszahlungen bleiben hier nachvollziehbar.',
      empty: 'Noch keine freigegebenen Tour-Zahlungen.',
      sideTitle: 'Bankauszahlung',
      sideDescription: 'Auszahlung nur aus deinen freigegebenen, frei verfügbaren Tour-Zahlungen.',
    };
  }

  return {
    badge: 'Eigener Auszahlungsbereich',
    backHref: '/dashboard?role=carrier',
    loading: 'Auszahlungsdaten werden geladen',
    primaryMetric: 'Auszahlbar',
    reservedMetric: 'Noch nicht freigegeben',
    totalMetric: 'Freigegeben gesamt',
    movementsTitle: 'Auszahlungsbewegungen',
    movementsDescription: 'Auftragszahlungen, Freigaben und Bankauszahlungen bleiben hier nachvollziehbar.',
    empty: 'Noch keine Auszahlungsbewegungen.',
    sideTitle: 'Bankauszahlung',
    sideDescription: 'Auszahlung nur aus deinen freigegebenen, frei verfügbaren Auftragszahlungen.',
  };
}

export function UserWalletPage({
  title,
  subtitle,
  walletPurpose = 'carrier',
  initialTopupAmount,
  returnTo,
}: {
  title: string;
  subtitle: string;
  walletPurpose?: WalletPurpose;
  initialTopupAmount?: string | null;
  returnTo?: string | null;
}) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const safeReturnTo = returnTo?.startsWith('/') ? returnTo : null;
  const copy = React.useMemo(() => pageCopy(walletPurpose), [walletPurpose]);
  const hasWalletAccess = React.useMemo(() => canAccessWalletPurpose(user?.role, walletPurpose), [user?.role, walletPurpose]);
  const [wallet, setWallet] = React.useState<WalletView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [walletError, setWalletError] = React.useState<string | null>(null);
  const [payoutAmount, setPayoutAmount] = React.useState('850');
  const [topupAmount, setTopupAmount] = React.useState(() => {
    const parsed = Number(initialTopupAmount);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '1200';
  });
  const [topupMessage, setTopupMessage] = React.useState<string | null>(null);
  const [topupLoading, setTopupLoading] = React.useState(false);
  const [payoutMessage, setPayoutMessage] = React.useState<string | null>(null);
  const [payoutLoading, setPayoutLoading] = React.useState(false);
  const payoutIdempotencyKeyRef = React.useRef(createPayoutIdempotencyKey());
  const [payoutMethodForm, setPayoutMethodForm] = React.useState({
    holderName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '',
    iban: '',
    bic: '',
  });
  const [payoutMethodMessage, setPayoutMethodMessage] = React.useState<string | null>(null);
  const [payoutMethodLoading, setPayoutMethodLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function loadWallet() {
      setLoading(true);
      setWalletError(null);

      if (!user?.id || !isAuthenticated) {
        setWallet(null);
        setWalletError('Bitte anmelden, um deine echten Zahlungs- und Auszahlungsdaten zu sehen.');
        setLoading(false);
        return;
      }

      if (!hasWalletAccess) {
        setWallet(null);
        setWalletError('Deine aktuelle Rolle hat keinen Zugriff auf diesen Wallet-Bereich.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/wallet', {
          headers: buildUserRequestHeaders(user),
        });
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok || !payload.wallet) {
          throw new Error(payload.message || 'Wallet konnte nicht geladen werden.');
        }
        setWallet(payload.wallet);
      } catch (error) {
        if (!cancelled) {
          setWallet(null);
          setWalletError(error instanceof Error ? error.message : 'Wallet konnte nicht geladen werden.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWallet();

    return () => {
      cancelled = true;
    };
  }, [hasWalletAccess, isAuthenticated, user?.id]);

  const verifiedPayoutMethod = wallet?.payoutMethods.find((method) => method.verified && method.isDefault)
    || wallet?.payoutMethods.find((method) => method.verified);
  const requestedPayoutAmount = Number(payoutAmount.replace(',', '.')) || 0;
  const requestedTopupAmount = Number(topupAmount.replace(',', '.')) || 0;
  const payoutLimits = wallet?.payoutLimits || { minAmount: 50, maxAmount: 25000, processingDays: 3, currency: 'EUR' };
  const isLocalPreview = process.env.NODE_ENV !== 'production';
  const payoutBlockReason = getPayoutBlockReason({
    walletPurpose,
    wallet,
    hasWalletAccess,
    verifiedPayoutMethod: Boolean(verifiedPayoutMethod),
    amount: requestedPayoutAmount,
    limits: payoutLimits,
  });
  const canPayout = walletPurpose !== 'shipper'
    && !payoutBlockReason;
  const canTopup = Boolean(user?.id && isAuthenticated && hasWalletAccess) && requestedTopupAmount >= 1 && requestedTopupAmount <= 100000;

  const refreshWallet = async () => {
    if (!user?.id || !isAuthenticated || !hasWalletAccess) return;

    const response = await fetch('/api/wallet', {
      headers: buildUserRequestHeaders(user),
    });
    const payload = await response.json();
    if (response.ok && payload.wallet) {
      setWallet(payload.wallet);
    }
  };

  const startTopup = async () => {
    if (!canTopup || !user?.id || !isAuthenticated || !hasWalletAccess) {
      setTopupMessage('Bitte anmelden, bevor du eine Zahlung vorbereitest.');
      return;
    }

    setTopupLoading(true);
    setTopupMessage(null);

    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildUserRequestHeaders(user),
        },
        body: JSON.stringify({
          amountCents: Math.round(requestedTopupAmount * 100),
          simulateCredit: true,
          returnTo: safeReturnTo,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Aufladung konnte nicht gestartet werden.');

      if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
        return;
      }

      await refreshWallet();
      setTopupMessage(payload.simulatedCredit
        ? `Lokale Demo-Zahlung gebucht: ${formatMoney(payload.amount, payload.currency)}`
        : 'Zahlung vorbereitet. Der Betrag wird nach erfolgreichem Zahlungs-Webhook für Aufträge verfügbar.');
    } catch (error) {
      setTopupMessage(error instanceof Error ? error.message : 'Aufladung konnte nicht gestartet werden.');
    } finally {
      setTopupLoading(false);
    }
  };

  const startPayout = async () => {
    if (!wallet || !verifiedPayoutMethod || !user?.id || !isAuthenticated || !hasWalletAccess) return;

    setPayoutLoading(true);
    setPayoutMessage(null);

    try {
      const response = await fetch('/api/wallet/payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': payoutIdempotencyKeyRef.current,
          ...buildUserRequestHeaders(user),
        },
        body: JSON.stringify({
          amount: requestedPayoutAmount,
          currency: wallet.currency,
          payoutMethodId: verifiedPayoutMethod.id,
          description: walletPurpose === 'driver' ? 'Fahrer-Auszahlung' : 'Transporteur-Auszahlung',
          idempotencyKey: payoutIdempotencyKeyRef.current,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setPayoutMessage(payload.message || 'Auszahlung konnte nicht gestartet werden.');
        return;
      }

      await refreshWallet();
      if (!payload.duplicate) {
        payoutIdempotencyKeyRef.current = createPayoutIdempotencyKey();
      }
      setPayoutMessage(payload.status === 'DELAYED'
        ? `Auszahlung vorgemerkt und verzögert: ${payload.message}`
        : payload.duplicate
          ? `Auszahlung bereits angelegt: ${payload.payoutId || payload.status || 'processing'}`
          : `Auszahlung gestartet: ${payload.payoutId || payload.status || 'processing'}`);
    } catch {
      setPayoutMessage('Auszahlung konnte lokal nicht gestartet werden.');
    } finally {
      setPayoutLoading(false);
    }
  };

  const savePayoutMethod = async () => {
    if (walletPurpose === 'shipper') return;
    if (!user?.id || !isAuthenticated || !hasWalletAccess) {
      setPayoutMethodMessage('Bitte anmelden, bevor du eine Auszahlungsmethode hinterlegst.');
      return;
    }

    setPayoutMethodLoading(true);
    setPayoutMethodMessage(null);

    try {
      const response = await fetch('/api/wallet/payout-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildUserRequestHeaders(user),
        },
        body: JSON.stringify({
          holderName: payoutMethodForm.holderName,
          iban: payoutMethodForm.iban,
          bic: payoutMethodForm.bic,
          isDefault: true,
          simulateVerification: isLocalPreview,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Auszahlungsmethode konnte nicht gespeichert werden.');

      await refreshWallet();
      setPayoutMethodMessage(payload.message || 'Auszahlungsmethode wurde gespeichert.');
      setPayoutMethodForm((current) => ({ ...current, iban: '', bic: '' }));
    } catch (error) {
      setPayoutMethodMessage(error instanceof Error ? error.message : 'Auszahlungsmethode konnte nicht gespeichert werden.');
    } finally {
      setPayoutMethodLoading(false);
    }
  };

  return (
    <main className="dark min-h-screen bg-[#06121C] py-8 text-white" style={{ colorScheme: 'dark' }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button asChild variant="ghost" className="mb-3 w-fit text-white/70 hover:bg-white/10 hover:text-white">
              <a href={copy.backHref}>
                <ArrowLeft className="h-4 w-4" />
                Zurück
              </a>
            </Button>
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="mt-2 text-white/55">{subtitle}</p>
          </div>
          <Badge className="w-fit bg-[#00D4FF]/15 text-[#00D4FF]">
            {copy.badge}
          </Badge>
        </div>

        {loading ? (
          <Card className="border-white/10 bg-[#071927] text-white">
            <CardContent className="flex min-h-48 items-center justify-center text-white/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {copy.loading}
            </CardContent>
          </Card>
        ) : wallet ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <WalletMetric label={copy.primaryMetric} value={formatMoney(wallet.availableBalance, wallet.currency)} icon={<Wallet className="h-5 w-5" />} highlight />
              <WalletMetric label={copy.reservedMetric} value={formatMoney(wallet.reservedBalance, wallet.currency)} icon={<ShieldCheck className="h-5 w-5" />} />
              <WalletMetric label={copy.totalMetric} value={formatMoney(wallet.balance, wallet.currency)} icon={<CreditCard className="h-5 w-5" />} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <Card className="border-white/10 bg-[#071927] text-white">
                <CardHeader>
                  <CardTitle>{copy.movementsTitle}</CardTitle>
                  <CardDescription className="text-white/55">
                    {copy.movementsDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {wallet.recentTransactions.length ? wallet.recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div>
                        <p className="font-medium">{transaction.description || transaction.type}</p>
                        <p className="mt-1 text-xs text-white/40">{transaction.reference || transaction.id}</p>
                      </div>
                      <p className={transaction.amount >= 0 ? 'font-semibold text-[#2ECC71]' : 'font-semibold text-[#E74C3C]'}>
                        {formatMoney(transaction.amount, transaction.currency)}
                      </p>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
                      {copy.empty}
                    </div>
                  )}
                </CardContent>
              </Card>

              {walletPurpose === 'shipper' ? (
                <Card className="border-white/10 bg-[#071927] text-white">
                  <CardHeader>
                    <CardTitle>{copy.sideTitle}</CardTitle>
                    <CardDescription className="text-white/55">
                      {copy.sideDescription}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-[#F39C12]/20 bg-[#F39C12]/10 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/35">Testbetrieb</p>
                      <p className="mt-2 text-sm text-white/65">
                        Lokal wird die Zahlung direkt gebucht. Im Livebetrieb erfolgt die Freigabe erst über Stripe/Webhook.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="topupAmount" className="text-white/70">Betrag</Label>
                      <Input
                        id="topupAmount"
                        inputMode="decimal"
                        value={topupAmount}
                        onChange={(event) => setTopupAmount(event.target.value)}
                        className="border-white/10 bg-black/20 text-white"
                      />
                    </div>
                    <Button
                      type="button"
                      disabled={!canTopup || topupLoading}
                      onClick={startTopup}
                      className="w-full bg-[#F39C12] text-[#06121C] hover:bg-[#d8890f]"
                    >
                      {topupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      Zahlung vorbereiten
                    </Button>
                    {topupMessage ? (
                      <div className="space-y-3">
                        <p className="text-sm text-white/55">{topupMessage}</p>
                        {safeReturnTo ? (
                          <Button asChild variant="outline" className="w-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10">
                            <a href={safeReturnTo}>Zurück zum Auftrag</a>
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-white/10 bg-[#071927] text-white">
                  <CardHeader>
                    <CardTitle>{copy.sideTitle}</CardTitle>
                    <CardDescription className="text-white/55">
                      {copy.sideDescription}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/35">Auszahlungsmethode</p>
                      <p className="mt-2 font-semibold">
                        {verifiedPayoutMethod ? `${verifiedPayoutMethod.holderName} · IBAN endet ${verifiedPayoutMethod.iban.slice(-4)}` : 'Keine verifizierte Methode'}
                      </p>
                      <p className="mt-2 text-xs text-white/45">
                        Mindestbetrag {formatMoney(payoutLimits.minAmount, wallet.currency)} · Maximalbetrag {formatMoney(payoutLimits.maxAmount, wallet.currency)} · übliche Bearbeitung {payoutLimits.processingDays} Werktage
                      </p>
                      {wallet.payoutMethods.length ? (
                        <div className="mt-3 space-y-2">
                          {wallet.payoutMethods.map((method) => (
                            <div key={method.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
                              <span>{method.holderName} · IBAN endet {method.iban.slice(-4)}</span>
                              <Badge className={method.verified ? 'bg-[#2ECC71]/15 text-[#8ff0b9]' : 'bg-[#F39C12]/15 text-[#ffd79a]'}>
                                {method.verified ? 'verifiziert' : 'in Prüfung'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {!verifiedPayoutMethod ? (
                      <div className="rounded-2xl border border-[#F39C12]/20 bg-[#F39C12]/10 p-4 text-sm text-white/65">
                        Hinterlege zuerst eine Auszahlungsmethode. In der lokalen Preview kann sie automatisch verifiziert werden; im Livebetrieb bleibt sie bis zur Prüfung gesperrt.
                      </div>
                    ) : null}
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-sm font-semibold text-white/80">Auszahlungsmethode hinterlegen</p>
                      <div className="space-y-2">
                        <Label htmlFor="holderName" className="text-white/70">Kontoinhaber</Label>
                        <Input
                          id="holderName"
                          value={payoutMethodForm.holderName}
                          onChange={(event) => setPayoutMethodForm((current) => ({ ...current, holderName: event.target.value }))}
                          className="border-white/10 bg-black/20 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="iban" className="text-white/70">IBAN</Label>
                        <Input
                          id="iban"
                          value={payoutMethodForm.iban}
                          onChange={(event) => setPayoutMethodForm((current) => ({ ...current, iban: event.target.value }))}
                          placeholder="DE89 3704 0044 0532 0130 00"
                          className="border-white/10 bg-black/20 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bic" className="text-white/70">BIC optional</Label>
                        <Input
                          id="bic"
                          value={payoutMethodForm.bic}
                          onChange={(event) => setPayoutMethodForm((current) => ({ ...current, bic: event.target.value }))}
                          placeholder="COBADEFFXXX"
                          className="border-white/10 bg-black/20 text-white"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={payoutMethodLoading || payoutMethodForm.holderName.trim().length < 2 || payoutMethodForm.iban.trim().length < 8}
                        onClick={savePayoutMethod}
                        className="w-full border-white/15 bg-white/[0.04] text-white hover:bg-white/10"
                      >
                        {payoutMethodLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Auszahlungsmethode speichern
                      </Button>
                      {payoutMethodMessage ? (
                        <p className="text-sm text-white/55">{payoutMethodMessage}</p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payoutAmount" className="text-white/70">Betrag</Label>
                      <Input
                        id="payoutAmount"
                        inputMode="decimal"
                        value={payoutAmount}
                        onChange={(event) => setPayoutAmount(event.target.value)}
                        className="border-white/10 bg-black/20 text-white"
                      />
                      <p className="text-xs text-white/40">
                        Verfügbar zur Auszahlung: {formatMoney(wallet.availableBalance, wallet.currency)}
                      </p>
                    </div>
                    {payoutBlockReason ? (
                      <div className="rounded-2xl border border-[#F39C12]/20 bg-[#F39C12]/10 p-4 text-sm text-white/65">
                        {payoutBlockReason}
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      disabled={!canPayout || payoutLoading}
                      onClick={startPayout}
                      className="w-full bg-[#00D4FF] text-[#06121C] hover:bg-[#35DFFF]"
                    >
                      {payoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      Auszahlung starten
                    </Button>
                    {payoutMessage ? (
                      <p className="text-sm text-white/55">{payoutMessage}</p>
                    ) : null}
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        ) : (
          <Card className="border-white/10 bg-[#071927] text-white">
            <CardHeader>
              <CardTitle>Zugriff erforderlich</CardTitle>
              <CardDescription className="text-white/55">
                {walletError || 'Deine Zahlungsdaten konnten nicht geladen werden.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="bg-[#00D4FF] text-[#06121C] hover:bg-[#35DFFF]">
                <a href="/">Anmelden oder registrieren</a>
              </Button>
              <Button asChild variant="outline" className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10">
                <a href={copy.backHref}>Zurück zum Dashboard</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function WalletMetric({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={`border-white/10 bg-[#071927] text-white ${highlight ? 'shadow-2xl shadow-[#00D4FF]/10' : ''}`}>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-white/45">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00D4FF]/10 text-[#00D4FF]">
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value);
}

function getPayoutBlockReason({
  walletPurpose,
  wallet,
  hasWalletAccess,
  verifiedPayoutMethod,
  amount,
  limits,
}: {
  walletPurpose: WalletPurpose;
  wallet: WalletView | null;
  hasWalletAccess: boolean;
  verifiedPayoutMethod: boolean;
  amount: number;
  limits: NonNullable<WalletView['payoutLimits']>;
}) {
  if (walletPurpose === 'shipper') return null;
  if (!wallet) return 'Wallet konnte nicht geladen werden.';
  if (!hasWalletAccess) return 'Deine Rolle darf aus diesem Wallet keine Bankauszahlung starten.';
  if (wallet.status !== 'ACTIVE') return 'Wallet ist nicht aktiv. Auszahlung ist aktuell nicht möglich.';
  if (!verifiedPayoutMethod) return 'Hinterlege zuerst eine verifizierte Auszahlungsmethode.';
  if (!Number.isFinite(amount) || amount <= 0) return 'Bitte einen gültigen Auszahlungsbetrag eintragen.';
  if (amount < limits.minAmount) return `Mindestbetrag für Bankauszahlungen ist ${formatMoney(limits.minAmount, wallet.currency)}.`;
  if (amount > limits.maxAmount) return `Maximalbetrag pro Bankauszahlung ist ${formatMoney(limits.maxAmount, wallet.currency)}.`;
  if (amount > wallet.availableBalance) {
    return `Nicht genug frei verfügbares Guthaben. Verfügbar: ${formatMoney(wallet.availableBalance, wallet.currency)}.`;
  }

  return null;
}

function canAccessWalletPurpose(role: User['role'] | undefined, purpose: WalletPurpose) {
  if (!role) return false;

  if (purpose === 'shipper') {
    return role === 'SHIPPER_COMPANY' || role === 'SHIPPER_PRIVATE';
  }

  if (purpose === 'driver') {
    return role === 'DRIVER_SELF_EMPLOYED';
  }

  return role === 'CARRIER' || role === 'DISPATCHER' || role === 'DRIVER_SELF_EMPLOYED';
}

function createPayoutIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `client:${crypto.randomUUID()}`;
  }

  return `client:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}
