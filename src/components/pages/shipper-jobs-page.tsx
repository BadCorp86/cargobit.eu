'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, Package, RefreshCw, Route, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildUserRequestHeaders, useAuthStore } from '@/lib/auth-store';

type ShipperJobsView = 'active' | 'offers' | 'drafts' | 'completed' | 'all';

type ShipperJob = {
  id: string;
  status: string;
  statusLabel: string;
  route: {
    from: string;
    to: string;
    pickupCountry: string;
    deliveryCountry: string;
  };
  schedule: {
    pickupDatetime?: string | null;
    deliveryDatetime?: string | null;
  };
  price: {
    budget?: number | null;
    agreedPrice?: number | null;
    lowestOffer?: number | null;
    currency?: string | null;
  };
  offers: {
    total: number;
    pending: number;
    accepted?: {
      id: string;
      price: number;
      transporterName: string;
    } | null;
    lowest?: {
      id: string;
      price: number;
      transporterName: string;
    } | null;
  };
  cargo: {
    type: string;
    weightKg?: number | null;
    volumeM3?: number | null;
  };
  description?: string | null;
};

function normalizeView(value?: string | null): ShipperJobsView {
  return value === 'offers' || value === 'drafts' || value === 'completed' || value === 'all' ? value : 'active';
}

function formatMoney(value?: number | null, currency = 'EUR') {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function transportTypeLabel(type: string) {
  const labels: Record<string, string> = {
    PALLET: 'Paletten',
    BULK: 'Schüttgut',
    LIQUID: 'Flüssigkeiten',
    HAZMAT: 'Gefahrgut',
    COOLING: 'Kühltransport',
    CAR_TRANSPORT: 'Fahrzeug',
    CONTAINER: 'Container',
    OVERSIZE: 'Übergröße',
    LOWLOADER: 'Tieflader',
  };
  return labels[type] || type;
}

function statusClass(status: string) {
  if (status === 'PUBLISHED') return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
  if (status === 'ASSIGNED' || status === 'IN_TRANSIT' || status === 'PICKUP_DONE' || status === 'DELIVERY_DONE') {
    return 'bg-green-500/10 text-green-700 dark:text-green-300';
  }
  if (status === 'CREATED') return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300';
  if (status === 'CANCELLED') return 'bg-red-500/10 text-red-700 dark:text-red-300';
  return 'bg-muted text-muted-foreground';
}

export function ShipperJobsPage({ initialView = 'active' }: { initialView?: ShipperJobsView }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [view, setView] = React.useState<ShipperJobsView>(() => normalizeView(initialView));
  const [jobs, setJobs] = React.useState<ShipperJob[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [acceptingOfferId, setAcceptingOfferId] = React.useState<string | null>(null);

  const loadJobs = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/shipper/jobs?view=${encodeURIComponent(view)}`, {
        headers: buildUserRequestHeaders(user),
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Aufträge konnten nicht geladen werden.');
      setJobs(payload.jobs || []);
      setTotal(payload.total || 0);
    } catch (loadError) {
      setJobs([]);
      setTotal(0);
      setError(loadError instanceof Error ? loadError.message : 'Aufträge konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [user, view]);

  React.useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const acceptOffer = async (job: ShipperJob) => {
    const offerId = job.offers.lowest?.id;
    if (!user?.id || !offerId) return;

    setAcceptingOfferId(offerId);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(job.id)}/accept_bid`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...buildUserRequestHeaders(user),
        },
        body: JSON.stringify({ bid_id: offerId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.error === 'WALLET_TOPUP_REQUIRED' && payload.wallet?.topupAmount) {
          const amount = encodeURIComponent(String(payload.wallet.topupAmount));
          const returnTo = encodeURIComponent(`/orders/${job.id}?viewer=shipper`);
          window.location.assign(`/shipper/wallet?amount=${amount}&returnTo=${returnTo}`);
          return;
        }
        throw new Error(payload.message || payload.error || 'Angebot konnte nicht angenommen werden.');
      }
      await loadJobs();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Angebot konnte nicht angenommen werden.');
    } finally {
      setAcceptingOfferId(null);
    }
  };

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard?role=shipper">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Meine Transportaufträge</h1>
              <p className="text-sm text-muted-foreground">
                Aufträge, eingegangene Angebote, Vergabe und Zahlungsschutz im Überblick.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/#auftrag">
                <Package className="h-4 w-4" />
                Auftrag erstellen
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/shipper/wallet">
                <Wallet className="h-4 w-4" />
                Zahlungsschutz
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Verlader-Aufträge
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Badge variant="secondary">{total} Auftrag(e)</Badge>
              <Button type="button" variant="outline" size="sm" onClick={loadJobs} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
                Aktualisieren
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={view} onValueChange={(value) => setView(normalizeView(value))}>
              <TabsList className="grid w-full grid-cols-5 md:w-[640px]">
                <TabsTrigger value="active">Aktiv</TabsTrigger>
                <TabsTrigger value="offers">Angebote</TabsTrigger>
                <TabsTrigger value="drafts">Entwürfe</TabsTrigger>
                <TabsTrigger value="completed">Erledigt</TabsTrigger>
                <TabsTrigger value="all">Alle</TabsTrigger>
              </TabsList>
            </Tabs>

            {!isAuthenticated || !user ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Bitte als Verlader anmelden, um eigene Aufträge und Angebote zu sehen.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-200">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
                Aufträge werden geladen...
              </div>
            ) : null}

            {!loading && jobs.length ? (
              <div className="grid gap-3">
                {jobs.map((job) => (
                  <article key={job.id} className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={statusClass(job.status)}>{job.statusLabel}</Badge>
                          <Badge variant="outline">{transportTypeLabel(job.cargo.type)}</Badge>
                          {job.offers.pending ? <Badge variant="secondary">{job.offers.pending} offene Angebote</Badge> : null}
                          <span className="text-xs text-muted-foreground">#{job.id}</span>
                        </div>
                        <h2 className="text-lg font-semibold">
                          {job.route.from} → {job.route.to}
                        </h2>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                          {job.description || 'Keine Beschreibung hinterlegt.'}
                        </p>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Abholung {formatDate(job.schedule.pickupDatetime)}
                          </span>
                          {job.cargo.weightKg ? <span>{job.cargo.weightKg.toLocaleString('de-DE')} kg</span> : null}
                          {job.cargo.volumeM3 ? <span>{job.cargo.volumeM3.toLocaleString('de-DE')} m³</span> : null}
                        </div>
                        {job.offers.lowest ? (
                          <div className="rounded-lg bg-muted/40 p-3 text-sm">
                            Günstigstes offenes Angebot: <span className="font-semibold">{formatMoney(job.offers.lowest.price, job.price.currency || 'EUR')}</span>
                            {' '}von {job.offers.lowest.transporterName}
                          </div>
                        ) : null}
                        {job.offers.accepted ? (
                          <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-300">
                            Angenommenes Angebot: <span className="font-semibold">{formatMoney(job.offers.accepted.price, job.price.currency || 'EUR')}</span>
                            {' '}von {job.offers.accepted.transporterName}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-3 lg:items-end">
                        <div className="text-left lg:text-right">
                          <p className="text-xs text-muted-foreground">
                            {job.price.agreedPrice ? 'Vereinbarter Preis' : job.price.lowestOffer ? 'Bestes Angebot' : 'KI-/Budgetpreis'}
                          </p>
                          <p className="text-xl font-bold">
                            {formatMoney(job.price.agreedPrice || job.price.lowestOffer || job.price.budget, job.price.currency || 'EUR')}
                          </p>
                        </div>
                        <Button asChild>
                          <Link href={`/orders/${encodeURIComponent(job.id)}?viewer=shipper`}>
                            Details & Angebote
                          </Link>
                        </Button>
                        {job.status === 'PUBLISHED' && job.offers.lowest ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => acceptOffer(job)}
                            disabled={acceptingOfferId === job.offers.lowest?.id}
                          >
                            {acceptingOfferId === job.offers.lowest.id ? 'Wird angenommen...' : 'Bestes Angebot annehmen'}
                          </Button>
                        ) : null}
                        {job.status === 'CREATED' ? (
                          <Button asChild variant="outline">
                            <Link href={`/shipper/wallet?returnTo=/orders/${encodeURIComponent(job.id)}`}>
                              Zahlung vorbereiten
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {!loading && !jobs.length ? (
              <div className="rounded-lg border bg-card p-8 text-center">
                <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium">Keine Aufträge in dieser Ansicht.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Erstellen Sie einen Auftrag über den KI-Preisrechner und veröffentlichen Sie ihn nach vorbereitetem Zahlungsschutz.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/#auftrag">Auftrag erstellen</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
