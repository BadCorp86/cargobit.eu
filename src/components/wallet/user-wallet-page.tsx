'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/auth-store';
import { ArrowLeft, CreditCard, Loader2, ShieldCheck, Wallet } from 'lucide-react';

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
}

const fallbackWallet: WalletView = {
  id: 'wallet_preview',
  balance: 850,
  reservedBalance: 0,
  availableBalance: 850,
  currency: 'EUR',
  status: 'ACTIVE',
  payoutMethods: [
    {
      id: 'pm_preview',
      iban: 'DE02120300000000202051',
      holderName: 'Demo Transporteur',
      verified: true,
      isDefault: true,
    },
  ],
  recentTransactions: [
    {
      id: 'tx_preview_release',
      type: 'PAYMENT_IN',
      amount: 850,
      currency: 'EUR',
      description: 'Freigegebenes Transporteur-Guthaben nach POD',
      reference: 'settlement_release_preview',
      createdAt: new Date().toISOString(),
    },
  ],
};

export function UserWalletPage({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const user = useAuthStore((state) => state.user);
  const [wallet, setWallet] = React.useState<WalletView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [payoutAmount, setPayoutAmount] = React.useState('850');
  const [payoutMessage, setPayoutMessage] = React.useState<string | null>(null);
  const [payoutLoading, setPayoutLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function loadWallet() {
      setLoading(true);
      try {
        const response = await fetch('/api/wallet', {
          headers: user?.id ? { 'x-user-id': user.id } : {},
        });
        const payload = await response.json();
        if (cancelled) return;
        setWallet(response.ok && payload.wallet ? payload.wallet : fallbackWallet);
      } catch {
        if (!cancelled) setWallet(fallbackWallet);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWallet();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const verifiedPayoutMethod = wallet?.payoutMethods.find((method) => method.verified && method.isDefault)
    || wallet?.payoutMethods.find((method) => method.verified);
  const requestedAmount = Number(payoutAmount.replace(',', '.')) || 0;
  const canPayout = Boolean(wallet && verifiedPayoutMethod && requestedAmount > 0 && requestedAmount <= wallet.availableBalance);

  const startPayout = async () => {
    if (!wallet || !verifiedPayoutMethod) return;

    setPayoutLoading(true);
    setPayoutMessage(null);

    try {
      const response = await fetch('/api/wallet/payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { 'x-user-id': user.id } : {}),
        },
        body: JSON.stringify({
          amount: requestedAmount,
          currency: wallet.currency,
          payoutMethodId: verifiedPayoutMethod.id,
          description: 'Transporteur-Wallet Auszahlung',
        }),
      });
      const payload = await response.json();
      setPayoutMessage(response.ok
        ? `Auszahlung gestartet: ${payload.payoutId || payload.status || 'processing'}`
        : payload.message || 'Auszahlung konnte nicht gestartet werden.');
    } catch {
      setPayoutMessage('Auszahlung konnte lokal nicht gestartet werden.');
    } finally {
      setPayoutLoading(false);
    }
  };

  return (
    <main className="dark min-h-screen bg-[#06121C] py-8 text-white" style={{ colorScheme: 'dark' }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button asChild variant="ghost" className="mb-3 w-fit text-white/70 hover:bg-white/10 hover:text-white">
              <a href="/preview">
                <ArrowLeft className="h-4 w-4" />
                Zurück
              </a>
            </Button>
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="mt-2 text-white/55">{subtitle}</p>
          </div>
          <Badge className="w-fit bg-[#00D4FF]/15 text-[#00D4FF]">
            Eigener Wallet-Bereich
          </Badge>
        </div>

        {loading ? (
          <Card className="border-white/10 bg-[#071927] text-white">
            <CardContent className="flex min-h-48 items-center justify-center text-white/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Wallet wird geladen
            </CardContent>
          </Card>
        ) : wallet ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <WalletMetric label="Wallet Saldo" value={formatMoney(wallet.balance, wallet.currency)} icon={<Wallet className="h-5 w-5" />} />
              <WalletMetric label="Reserviert" value={formatMoney(wallet.reservedBalance, wallet.currency)} icon={<ShieldCheck className="h-5 w-5" />} />
              <WalletMetric label="Verfügbar" value={formatMoney(wallet.availableBalance, wallet.currency)} icon={<CreditCard className="h-5 w-5" />} highlight />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <Card className="border-white/10 bg-[#071927] text-white">
                <CardHeader>
                  <CardTitle>Wallet-Bewegungen</CardTitle>
                  <CardDescription className="text-white/55">
                    Freigaben, Reservierungen, Gebühren und Auszahlungen bleiben hier nachvollziehbar.
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
                      Noch keine Wallet-Bewegungen.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-[#071927] text-white">
                <CardHeader>
                  <CardTitle>Bankauszahlung</CardTitle>
                  <CardDescription className="text-white/55">
                    Auszahlung nur aus deinem eigenen, frei verfügbaren Wallet-Guthaben.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/35">Auszahlungsmethode</p>
                    <p className="mt-2 font-semibold">
                      {verifiedPayoutMethod ? `${verifiedPayoutMethod.holderName} · IBAN endet ${verifiedPayoutMethod.iban.slice(-4)}` : 'Keine verifizierte Methode'}
                    </p>
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
                  </div>
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
            </div>
          </>
        ) : null}
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
