'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  Calendar,
  CheckCircle2,
  Clock,
  Package,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/lib/auth-store';

type CarrierJob = {
  id: string;
  status: string;
  statusLabel: string;
  relation: 'assigned' | 'bid' | 'visible';
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
    ownBid?: number | null;
    currency?: string | null;
  };
  offer?: {
    id: string;
    status: string;
    statusLabel: string | null;
    price: number;
    message?: string | null;
    validUntil?: string | null;
  } | null;
  cargo: {
    type: string;
    weightKg?: number | null;
    volumeM3?: number | null;
  };
  payout?: {
    status: 'blocked' | 'ready' | 'released';
    statusLabel?: string | null;
    amount: number;
    currency: string;
    releaseEligibleAt?: string | null;
    deliveredAt?: string | null;
    blockers?: string[];
    openDisputes?: number;
    openTickets?: number;
    releasedAt?: string | null;
    walletTransactionId?: string | null;
  } | null;
  description?: string | null;
};

type CarrierJobsView = 'active' | 'offers' | 'completed' | 'all';
type CarrierPayoutStatus = NonNullable<CarrierJob['payout']>['status'];

function normalizeView(value: string | null): CarrierJobsView {
  return value === 'offers' || value === 'completed' || value === 'all' ? value : 'active';
}

function authHeaders(user: ReturnType<typeof useAuthStore.getState>['user']) {
  return user?.id
    ? {
        'x-user-id': user.id,
        'x-user-email': user.email,
        'x-user-role': user.role,
        'x-user-roles': user.role,
      }
    : {};
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

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

function relationLabel(job: CarrierJob) {
  if (job.relation === 'assigned') return 'Angenommen';
  if (job.offer?.statusLabel) return job.offer.statusLabel;
  return job.statusLabel;
}

function relationClass(job: CarrierJob) {
  if (job.relation === 'assigned') return 'bg-green-500/10 text-green-700 dark:text-green-300';
  if (job.offer?.status === 'PENDING') return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
  if (job.offer?.status === 'REJECTED') return 'bg-red-500/10 text-red-700 dark:text-red-300';
  return 'bg-muted text-muted-foreground';
}

function nextStatusAction(job: CarrierJob) {
  if (job.relation !== 'assigned') return null;

  const actions: Record<string, { status: string; label: string; note: string }> = {
    ASSIGNED: {
      status: 'PICKUP_DONE',
      label: 'Abholung bestätigen',
      note: 'Abholung durch Fahrer bestätigt',
    },
    PICKUP_DONE: {
      status: 'IN_TRANSIT',
      label: 'Unterwegs melden',
      note: 'Transport ist unterwegs',
    },
    IN_TRANSIT: {
      status: 'DELIVERY_DONE',
      label: 'Lieferung bestätigen',
      note: 'Lieferung am Zielort bestätigt',
    },
  };

  return actions[job.status] || null;
}

function payoutClass(status: CarrierPayoutStatus) {
  if (status === 'released') return 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-200';
  if (status === 'ready') return 'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-200';
  return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:text-yellow-200';
}

function payoutIcon(status: CarrierPayoutStatus) {
  if (status === 'released') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'ready') return <Wallet className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
}

export function CarrierJobsPage({ initialView = 'active' }: { initialView?: CarrierJobsView }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [view, setView] = React.useState<CarrierJobsView>(() => normalizeView(initialView));
  const [jobs, setJobs] = React.useState<CarrierJob[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [withdrawingOfferId, setWithdrawingOfferId] = React.useState<string | null>(null);
  const [updatingOfferId, setUpdatingOfferId] = React.useState<string | null>(null);
  const [editingOfferId, setEditingOfferId] = React.useState<string | null>(null);
  const [editPrice, setEditPrice] = React.useState('');
  const [editMessage, setEditMessage] = React.useState('');
  const [updatingStatusJobId, setUpdatingStatusJobId] = React.useState<string | null>(null);
  const [submittingPodJobId, setSubmittingPodJobId] = React.useState<string | null>(null);

  const loadJobs = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/carrier/jobs?view=${encodeURIComponent(view)}`, {
        headers: authHeaders(user),
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Eigene Aufträge konnten nicht geladen werden.');
      setJobs(payload.jobs || []);
      setTotal(payload.total || 0);
      if (payload.message) setError(payload.message);
    } catch (loadError) {
      setJobs([]);
      setTotal(0);
      setError(loadError instanceof Error ? loadError.message : 'Eigene Aufträge konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [user, view]);

  React.useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const withdrawOffer = async (offerId: string) => {
    if (!user?.id) return;

    setWithdrawingOfferId(offerId);
    setError(null);
    try {
      const response = await fetch(`/api/bids/${encodeURIComponent(offerId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(user),
        },
        body: JSON.stringify({ action: 'withdraw' }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Angebot konnte nicht zurückgezogen werden.');
      }
      await loadJobs();
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : 'Angebot konnte nicht zurückgezogen werden.');
    } finally {
      setWithdrawingOfferId(null);
    }
  };

  const startEditingOffer = (job: CarrierJob) => {
    if (!job.offer) return;
    setEditingOfferId(job.offer.id);
    setEditPrice(String(job.offer.price));
    setEditMessage(job.offer.message || '');
    setError(null);
  };

  const cancelEditingOffer = () => {
    setEditingOfferId(null);
    setEditPrice('');
    setEditMessage('');
  };

  const updateOffer = async (offerId: string) => {
    if (!user?.id) return;

    const parsedPrice = Number(editPrice.replace(',', '.'));
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Bitte einen gültigen Angebotspreis eintragen.');
      return;
    }

    setUpdatingOfferId(offerId);
    setError(null);
    try {
      const response = await fetch(`/api/bids/${encodeURIComponent(offerId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(user),
        },
        body: JSON.stringify({
          action: 'update',
          price: parsedPrice,
          message: editMessage,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Angebot konnte nicht aktualisiert werden.');
      }
      cancelEditingOffer();
      await loadJobs();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Angebot konnte nicht aktualisiert werden.');
    } finally {
      setUpdatingOfferId(null);
    }
  };

  const updateJobStatus = async (job: CarrierJob) => {
    if (!user?.id) return;

    const action = nextStatusAction(job);
    if (!action) return;

    setUpdatingStatusJobId(job.id);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(job.id)}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(user),
        },
        body: JSON.stringify({
          status: action.status,
          description: action.note,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Status konnte nicht aktualisiert werden.');
      }
      await loadJobs();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Status konnte nicht aktualisiert werden.');
    } finally {
      setUpdatingStatusJobId(null);
    }
  };

  const submitPod = async (job: CarrierJob) => {
    if (!user?.id) return;

    setSubmittingPodJobId(job.id);
    setError(null);
    try {
      const response = await fetch('/api/driver/mobile/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(user),
        },
        body: JSON.stringify({
          action: 'submit_pod',
          missionId: job.id,
          userId: user.id,
          note: 'POD/eCMR aus Transporteur-Auftragsliste erfasst',
          podUrl: `/uploads/mobile/${job.id}/pod-confirmation.jpg`,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'POD konnte nicht gespeichert werden.');
      }
      await loadJobs();
    } catch (podError) {
      setError(podError instanceof Error ? podError.message : 'POD konnte nicht gespeichert werden.');
    } finally {
      setSubmittingPodJobId(null);
    }
  };

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard?role=carrier">
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Meine Aufträge</h1>
              <p className="text-sm text-muted-foreground">
                Angenommene Transporte, offene Angebote und abgeschlossene Touren.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/carrier/loads">
                <Package className="h-4 w-4" />
                Verfügbare Aufträge
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/carrier/wallet">
                <Wallet className="h-4 w-4" />
                Wallet
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <BriefcaseBusiness className="h-5 w-5" />
              Transporteur-Aufträge
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
              <TabsList className="grid w-full grid-cols-4 md:w-[520px]">
                <TabsTrigger value="active">Aktiv</TabsTrigger>
                <TabsTrigger value="offers">Angebote</TabsTrigger>
                <TabsTrigger value="completed">Erledigt</TabsTrigger>
                <TabsTrigger value="all">Alle</TabsTrigger>
              </TabsList>
            </Tabs>

            {!isAuthenticated || !user ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Bitte als Transporteur, Dispatcher oder Fahrer anmelden, um eigene Aufträge zu sehen.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-200">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
                Eigene Aufträge werden geladen...
              </div>
            ) : null}

            {!loading && jobs.length ? (
              <div className="grid gap-3">
                {jobs.map((job) => (
                  <article key={job.id} className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={relationClass(job)}>{relationLabel(job)}</Badge>
                          <Badge variant="outline">{transportTypeLabel(job.cargo.type)}</Badge>
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
                      </div>
                      <div className="flex flex-col gap-3 lg:items-end">
                        <div className="text-left lg:text-right">
                          <p className="text-xs text-muted-foreground">
                            {job.relation === 'assigned' ? 'Vereinbarter Preis' : 'Eigenes Angebot'}
                          </p>
                          <p className="text-xl font-bold">
                            {formatMoney(job.price.agreedPrice || job.price.ownBid || job.price.budget, job.price.currency || 'EUR')}
                          </p>
                        </div>
                        <Button asChild>
                          <Link href={`/orders/${encodeURIComponent(job.id)}?viewer=carrier`}>
                            Details öffnen
                          </Link>
                        </Button>
                        {nextStatusAction(job) ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => updateJobStatus(job)}
                            disabled={updatingStatusJobId === job.id}
                          >
                            {updatingStatusJobId === job.id ? 'Aktualisiert...' : nextStatusAction(job)!.label}
                          </Button>
                        ) : null}
                        {job.relation === 'assigned' && job.status === 'DELIVERY_DONE' ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => submitPod(job)}
                            disabled={submittingPodJobId === job.id}
                          >
                            {submittingPodJobId === job.id ? 'POD wird gespeichert...' : 'POD/eCMR erfassen'}
                          </Button>
                        ) : null}
                        {job.offer?.id && job.offer.status === 'PENDING' ? (
                          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => startEditingOffer(job)}
                              disabled={editingOfferId === job.offer.id}
                            >
                              Angebot bearbeiten
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => withdrawOffer(job.offer!.id)}
                              disabled={withdrawingOfferId === job.offer.id || updatingOfferId === job.offer.id}
                            >
                              {withdrawingOfferId === job.offer.id ? 'Wird zurückgezogen...' : 'Angebot zurückziehen'}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {job.offer?.id && editingOfferId === job.offer.id ? (
                      <div className="mt-4 rounded-lg border bg-muted/30 p-4">
                        <div className="grid gap-3 md:grid-cols-[160px_1fr_auto] md:items-end">
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Angebotspreis</p>
                            <Input
                              inputMode="decimal"
                              value={editPrice}
                              onChange={(event) => setEditPrice(event.target.value)}
                              disabled={updatingOfferId === job.offer?.id}
                            />
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Nachricht</p>
                            <Textarea
                              value={editMessage}
                              onChange={(event) => setEditMessage(event.target.value)}
                              disabled={updatingOfferId === job.offer?.id}
                              className="min-h-10"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => updateOffer(job.offer!.id)}
                              disabled={updatingOfferId === job.offer.id}
                            >
                              {updatingOfferId === job.offer.id ? 'Speichert...' : 'Speichern'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={cancelEditingOffer}
                              disabled={updatingOfferId === job.offer.id}
                            >
                              Abbrechen
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {job.payout ? (
                      <div className={`mt-4 rounded-lg border p-4 ${payoutClass(job.payout.status)}`}>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              {payoutIcon(job.payout.status)}
                              Zahlungsschutz / Wallet-Freigabe
                            </div>
                            <p className="text-sm">
                              {job.payout.status === 'released'
                                ? `${formatMoney(job.payout.amount, job.payout.currency)} wurden deinem Wallet gutgeschrieben.`
                                : job.payout.status === 'ready'
                                  ? `${formatMoney(job.payout.amount, job.payout.currency)} sind für die Wallet-Freigabe bereit.`
                                  : `${formatMoney(job.payout.amount, job.payout.currency)} werden nach POD-Prüfung und 24-Werktagsstunden-Frist freigegeben.`}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-80">
                              {job.payout.deliveredAt ? <span>Geliefert: {formatDateTime(job.payout.deliveredAt)}</span> : null}
                              {job.payout.releaseEligibleAt && job.payout.status !== 'released' ? (
                                <span>Früheste Freigabe: {formatDateTime(job.payout.releaseEligibleAt)}</span>
                              ) : null}
                              {job.payout.releasedAt ? <span>Freigegeben: {formatDateTime(job.payout.releasedAt)}</span> : null}
                            </div>
                            {job.payout.status === 'blocked' && job.payout.blockers?.length ? (
                              <div className="mt-2 flex items-start gap-2 text-xs">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{job.payout.blockers[0]}</span>
                              </div>
                            ) : null}
                          </div>
                          <Button asChild variant="outline" className="bg-background/60">
                            <Link href="/carrier/wallet">
                              Wallet öffnen
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}

            {!loading && !jobs.length ? (
              <div className="rounded-lg border bg-card p-8 text-center">
                <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium">Keine eigenen Aufträge in dieser Ansicht.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Offene Marktaufträge findest du unter „Verfügbare Aufträge“.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/carrier/loads">Verfügbare Aufträge öffnen</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
