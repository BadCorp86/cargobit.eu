'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TransportCard } from '@/components/cargobit/transport-card';
import { BannerAd, SponsoredListing } from '@/components/ads/banner-ad';
import {
  ArrowLeft,
  AlertTriangle,
  Search,
  Filter,
  MapPin,
  Calendar,
  Package,
  X,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';

// ========================================
// Filters Component
// ========================================
interface FiltersProps {
  className?: string;
  filters: MarketplaceFilters;
  onFiltersChange: (filters: MarketplaceFilters) => void;
}

type MarketplaceFilters = {
  search: string;
  pickupCountry: string;
  deliveryCountry: string;
  pickupFrom: string;
  pickupTo: string;
  priceRange: [number, number];
  riskLevels: string[];
  cargoTypes: string[];
  sort: string;
};

const defaultFilters: MarketplaceFilters = {
  search: '',
  pickupCountry: 'all',
  deliveryCountry: 'all',
  pickupFrom: '',
  pickupTo: '',
  priceRange: [0, 10000],
  riskLevels: ['green', 'yellow', 'red'],
  cargoTypes: [],
  sort: 'newest',
};

const countryOptions = [
  { value: 'DE', label: 'Deutschland' },
  { value: 'AT', label: 'Österreich' },
  { value: 'CH', label: 'Schweiz' },
  { value: 'PL', label: 'Polen' },
  { value: 'CZ', label: 'Tschechien' },
  { value: 'NL', label: 'Niederlande' },
  { value: 'BE', label: 'Belgien' },
  { value: 'FR', label: 'Frankreich' },
  { value: 'IT', label: 'Italien' },
];

const cargoTypeOptions = [
  { id: 'PALLET', label: 'Paletten' },
  { id: 'BULK', label: 'Schüttgut' },
  { id: 'LIQUID', label: 'Flüssigkeiten' },
  { id: 'HAZMAT', label: 'Gefahrgut' },
  { id: 'COOLING', label: 'Kühltransport' },
  { id: 'CAR_TRANSPORT', label: 'Fahrzeuge' },
  { id: 'CONTAINER', label: 'Container' },
  { id: 'OVERSIZE', label: 'Übergröße' },
  { id: 'LOWLOADER', label: 'Tieflader' },
];

function getCountryLabel(value: string) {
  return countryOptions.find((country) => country.value === value)?.label || value;
}

function getCargoTypeLabel(value: string) {
  return cargoTypeOptions.find((type) => type.id === value)?.label || value;
}

function hasActiveFilters(filters: MarketplaceFilters) {
  return (
    Boolean(filters.search.trim()) ||
    filters.pickupCountry !== defaultFilters.pickupCountry ||
    filters.deliveryCountry !== defaultFilters.deliveryCountry ||
    Boolean(filters.pickupFrom) ||
    Boolean(filters.pickupTo) ||
    filters.priceRange[0] !== defaultFilters.priceRange[0] ||
    filters.priceRange[1] !== defaultFilters.priceRange[1] ||
    filters.riskLevels.length !== defaultFilters.riskLevels.length ||
    filters.cargoTypes.length > 0
  );
}

function buildActiveFilterLabels(filters: MarketplaceFilters) {
  const labels: string[] = [];
  if (filters.search.trim()) labels.push(`Suche: ${filters.search.trim()}`);
  if (filters.pickupCountry !== 'all') labels.push(`Abholung: ${getCountryLabel(filters.pickupCountry)}`);
  if (filters.deliveryCountry !== 'all') labels.push(`Ziel: ${getCountryLabel(filters.deliveryCountry)}`);
  if (filters.pickupFrom) labels.push(`Von: ${filters.pickupFrom}`);
  if (filters.pickupTo) labels.push(`Bis: ${filters.pickupTo}`);
  if (filters.priceRange[0] > 0 || filters.priceRange[1] < 10000) {
    labels.push(`${filters.priceRange[0].toLocaleString('de-DE')} - ${filters.priceRange[1].toLocaleString('de-DE')} €`);
  }
  if (filters.riskLevels.length !== defaultFilters.riskLevels.length) {
    labels.push(`Risiko: ${filters.riskLevels.join(', ')}`);
  }
  if (filters.cargoTypes.length) {
    labels.push(`Fracht: ${filters.cargoTypes.map(getCargoTypeLabel).join(', ')}`);
  }
  return labels;
}

function Filters({ className, filters, onFiltersChange }: FiltersProps) {
  const updateFilters = (patch: Partial<MarketplaceFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const riskLevels = [
    { id: 'green', label: 'Niedriges Risiko', color: 'bg-green-500' },
    { id: 'yellow', label: 'Mittleres Risiko', color: 'bg-yellow-500' },
    { id: 'red', label: 'Hohes Risiko', color: 'bg-red-500' },
  ];

  return (
    <div className={cn('space-y-6', className)}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) => updateFilters({ search: event.target.value })}
          placeholder="Route, ID, Fracht..."
          className="pl-10"
        />
      </div>

      {/* Origin/Destination */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Route
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={filters.pickupCountry}
            onValueChange={(pickupCountry) => updateFilters({ pickupCountry })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Abholort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Abholländer</SelectItem>
              {countryOptions.map((country) => (
                <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.deliveryCountry}
            onValueChange={(deliveryCountry) => updateFilters({ deliveryCountry })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Zielort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Zielländer</SelectItem>
              {countryOptions.map((country) => (
                <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Date Range */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Zeitraum
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="date"
            value={filters.pickupFrom}
            onChange={(event) => updateFilters({ pickupFrom: event.target.value })}
            aria-label="Abholung von"
          />
          <Input
            type="date"
            value={filters.pickupTo}
            onChange={(event) => updateFilters({ pickupTo: event.target.value })}
            aria-label="Abholung bis"
          />
        </CardContent>
      </Card>

      {/* Risk Level */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Risk-Level
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {riskLevels.map((risk) => (
            <div key={risk.id} className="flex items-center space-x-2">
              <Checkbox
                id={risk.id}
                checked={filters.riskLevels.includes(risk.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    updateFilters({ riskLevels: Array.from(new Set([...filters.riskLevels, risk.id])) });
                  } else {
                    updateFilters({ riskLevels: filters.riskLevels.filter((r) => r !== risk.id) });
                  }
                }}
              />
              <Label htmlFor={risk.id} className="flex items-center gap-2 cursor-pointer">
                <span className={cn('w-3 h-3 rounded-full', risk.color)} />
                {risk.label}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Price Range */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Preisbereich</CardTitle>
        </CardHeader>
        <CardContent>
          <Slider
            value={filters.priceRange}
            onValueChange={(value) => updateFilters({ priceRange: [value[0] || 0, value[1] || 10000] })}
            max={10000}
            step={100}
            className="mb-2"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{filters.priceRange[0].toLocaleString('de-DE')} €</span>
            <span>{filters.priceRange[1].toLocaleString('de-DE')} €</span>
          </div>
        </CardContent>
      </Card>

      {/* Cargo Type */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="w-4 h-4" />
            Frachtart
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {cargoTypeOptions.map((type) => (
            <div key={type.id} className="flex items-center space-x-2">
              <Checkbox
                id={type.id}
                checked={filters.cargoTypes.includes(type.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    updateFilters({ cargoTypes: Array.from(new Set([...filters.cargoTypes, type.id])) });
                  } else {
                    updateFilters({ cargoTypes: filters.cargoTypes.filter((item) => item !== type.id) });
                  }
                }}
              />
              <Label htmlFor={type.id} className="cursor-pointer">{type.label}</Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reset Filters */}
      <Button variant="outline" className="w-full gap-2" onClick={() => onFiltersChange(defaultFilters)}>
        <X className="w-4 h-4" />
        Filter zurücksetzen
      </Button>
    </div>
  );
}

// ========================================
// Order List Component
// ========================================
interface OrderListProps {
  className?: string;
  filters: MarketplaceFilters;
  onFiltersChange: (filters: MarketplaceFilters) => void;
}

type MarketplaceJob = {
  id: string;
  status: string;
  transportType: string;
  description?: string | null;
  route: {
    from: string;
    to: string;
    pickupCountry?: string;
    deliveryCountry?: string;
  };
  schedule: {
    pickupDatetime?: string | null;
    deliveryDatetime?: string | null;
  };
  price: {
    budget?: number | null;
    minimumBid?: number | null;
    currency?: string | null;
    paymentProtection?: boolean;
  };
  cargo: {
    weightKg?: number | null;
    volumeM3?: number | null;
    isHazmat?: boolean;
  };
  offersCount: number;
  risk: 'green' | 'yellow' | 'red';
  createdAt?: string;
};

type MarketplaceLoadError = {
  message: string;
  code?: string;
  localSetup?: {
    databaseUrl?: string;
    commands?: string[];
  };
};

function transportTypeLabel(type: string) {
  const labels: Record<string, string> = {
    PALLET: 'Paletten',
    GENERAL_CARGO: 'Stückgut',
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

function formatDate(value?: string | null) {
  if (!value) return undefined;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatWeight(value?: number | null) {
  if (!value) return undefined;
  if (value >= 1000) return `${(value / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} t`;
  return `${value.toLocaleString('de-DE')} kg`;
}

function formatCurrency(value?: number | null, currency = 'EUR') {
  if (value === undefined || value === null) return '-';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value);
}

function applyRiskFilter(jobs: MarketplaceJob[], riskLevels: string[]) {
  if (!riskLevels.length) return [];
  return jobs.filter((job) => riskLevels.includes(job.risk));
}

function sortMarketplaceJobs(jobs: MarketplaceJob[], sort: string) {
  const riskOrder: Record<MarketplaceJob['risk'], number> = { green: 1, yellow: 2, red: 3 };
  return [...jobs].sort((a, b) => {
    if (sort === 'price-asc') return (a.price.budget || 0) - (b.price.budget || 0);
    if (sort === 'price-desc') return (b.price.budget || 0) - (a.price.budget || 0);
    if (sort === 'risk-asc') return riskOrder[a.risk] - riskOrder[b.risk];
    if (sort === 'risk-desc') return riskOrder[b.risk] - riskOrder[a.risk];
    return new Date(b.createdAt || b.schedule.pickupDatetime || 0).getTime() - new Date(a.createdAt || a.schedule.pickupDatetime || 0).getTime();
  });
}

function OrderList({ className, filters, onFiltersChange }: OrderListProps) {
  const [orders, setOrders] = React.useState<MarketplaceJob[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<MarketplaceLoadError | null>(null);
  const pageSize = 24;
  const activeFilterLabels = buildActiveFilterLabels(filters);
  const filtersAreActive = hasActiveFilters(filters);

  const loadJobs = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.cargoTypes.length) params.set('types', filters.cargoTypes.join(','));
      if (filters.pickupCountry !== 'all') params.set('pickupCountry', filters.pickupCountry);
      if (filters.deliveryCountry !== 'all') params.set('deliveryCountry', filters.deliveryCountry);
      if (filters.pickupFrom) params.set('pickupFrom', filters.pickupFrom);
      if (filters.pickupTo) params.set('pickupTo', filters.pickupTo);
      if (filters.priceRange[0] > 0) params.set('minPrice', String(filters.priceRange[0]));
      if (filters.priceRange[1] < 10000) params.set('maxPrice', String(filters.priceRange[1]));
      if (filters.sort) params.set('sort', filters.sort);

      const response = await fetch(`/api/marketplace/jobs?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) {
        setOrders([]);
        setTotal(0);
        setError({
          message: payload.message || 'Aufträge konnten nicht geladen werden.',
          code: payload.code,
          localSetup: payload.localSetup,
        });
        return;
      }

      const nextOrders = payload.jobs || [];
      const filteredOrders = sortMarketplaceJobs(applyRiskFilter(nextOrders, filters.riskLevels), filters.sort);
      setOrders(filteredOrders);
      setTotal(typeof payload.total === 'number' ? payload.total : filteredOrders.length);
    } catch (loadError) {
      setOrders([]);
      setTotal(0);
      setError(normalizeMarketplaceError(loadError));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  React.useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  React.useEffect(() => {
    setPage(0);
  }, [
    filters.search,
    filters.pickupCountry,
    filters.deliveryCountry,
    filters.pickupFrom,
    filters.pickupTo,
    filters.priceRange,
    filters.riskLevels,
    filters.cargoTypes,
    filters.sort,
  ]);

  const hasPreviousPage = page > 0;
  const hasNextPage = total > (page + 1) * pageSize;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Sort & View Options */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {orders.length} sichtbare Aufträge{total > orders.length ? ` von ${total}` : ''}
          </Badge>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') loadJobs();
              }}
              placeholder="Stadt, Route, Auftrags-ID..."
              className="pl-10 sm:w-64"
            />
          </div>
          <Button type="button" variant="outline" onClick={loadJobs}>
            Suchen
          </Button>
          <Select value={filters.sort} onValueChange={(sort) => onFiltersChange({ ...filters, sort })}>
            <SelectTrigger className="w-[180px]">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Neueste zuerst</SelectItem>
              <SelectItem value="price-asc">Preis aufsteigend</SelectItem>
              <SelectItem value="price-desc">Preis absteigend</SelectItem>
              <SelectItem value="risk-asc">Risiko niedrig</SelectItem>
              <SelectItem value="risk-desc">Risiko hoch</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Verfügbare Aufträge konnten nicht geladen werden.</p>
              <p className="mt-1 opacity-80">{error.message}</p>
              {error.code === 'DATABASE_UNAVAILABLE' ? (
                <div className="mt-3 rounded-md border border-red-500/20 bg-background/50 p-3 text-xs text-red-700/90 dark:text-red-100/90">
                  <p className="font-medium">Lokaler Test-Hinweis</p>
                  <p className="mt-1">
                    Postgres läuft nicht auf `localhost:5432`. Starte zuerst die lokale Datenbank, führe danach Migration und Testaufträge aus.
                  </p>
                  {error.localSetup?.commands?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {error.localSetup.commands.map((command) => (
                        <code key={command} className="rounded bg-black/20 px-2 py-1">
                          {command}
                        </code>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <Button type="button" variant="outline" onClick={loadJobs} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Neu laden
          </Button>
        </div>
      ) : null}

      {activeFilterLabels.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
          <span className="text-xs font-medium text-muted-foreground">Aktive Filter</span>
          {activeFilterLabels.map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => onFiltersChange(defaultFilters)}
          >
            <X className="h-4 w-4" />
            Löschen
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Verfügbare Aufträge werden geladen...
        </div>
      ) : null}

      {/* Order Cards */}
      {!loading && orders.length ? <div className="grid gap-4">
        {orders.map((order) => (
          <TransportCard
            key={order.id}
            id={order.id}
            route={{ from: order.route.from, to: order.route.to }}
            risk={order.risk}
            price={order.price.budget || undefined}
            currency={order.price.currency || 'EUR'}
            date={formatDate(order.schedule.pickupDatetime)}
            cargoType={transportTypeLabel(order.transportType)}
            weight={formatWeight(order.cargo.weightKg)}
            onClick={() => {
              window.location.href = `/orders/${encodeURIComponent(order.id)}?viewer=carrier`;
            }}
          >
            <div className="mt-4 grid gap-3 border-t pt-3 text-xs text-muted-foreground md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{order.offersCount} Angebot(e)</Badge>
                {order.price.minimumBid ? (
                  <Badge variant="outline">
                    Untergrenze {formatCurrency(order.price.minimumBid, order.price.currency || 'EUR')}
                  </Badge>
                ) : null}
                {order.price.paymentProtection ? (
                  <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/10 dark:text-green-300">
                    Zahlungsschutz aktiv
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                <span className="max-w-md truncate">{order.description || 'Details prüfen und eigenes Angebot abgeben'}</span>
                <Button
                  type="button"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    window.location.href = `/orders/${encodeURIComponent(order.id)}?viewer=carrier`;
                  }}
                >
                  Details ansehen
                </Button>
              </div>
            </div>
          </TransportCard>
        ))}
      </div> : null}

      {!loading && !orders.length ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="font-medium">Keine passenden Aufträge gefunden.</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            {error
              ? 'Der Marktplatz zeigt nur echte veröffentlichte Aufträge. Prüfe die Verbindung und lade die Liste erneut.'
              : filtersAreActive
                ? 'Für die aktuellen Filter gibt es noch keine veröffentlichten Aufträge. Entferne einzelne Filter oder lade die Liste später erneut.'
                : 'Aktuell sind keine veröffentlichten Aufträge im Marktplatz verfügbar. Sobald Verlader neue Aufträge veröffentlichen, erscheinen sie hier.'}
          </p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button type="button" onClick={loadJobs}>
              <RefreshCw className="h-4 w-4" />
              Neu laden
            </Button>
            {filtersAreActive ? (
              <Button type="button" variant="outline" onClick={() => onFiltersChange(defaultFilters)}>
                <X className="h-4 w-4" />
                Filter zurücksetzen
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/dashboard?role=carrier">
                <ArrowLeft className="h-4 w-4" />
                Zurück zum Dashboard
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {(hasPreviousPage || hasNextPage) ? (
        <div className="mt-8 flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPreviousPage || loading}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Vorherige Seite
          </Button>
          <Badge variant="secondary" className="px-3 py-1.5">
            Seite {page + 1}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNextPage || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Nächste Seite
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function normalizeMarketplaceError(error: unknown): MarketplaceLoadError {
  if (error && typeof error === 'object' && 'message' in error) {
    const payload = error as MarketplaceLoadError;
    return {
      message: payload.message || 'Aufträge konnten nicht geladen werden.',
      code: payload.code,
      localSetup: payload.localSetup,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: 'Aufträge konnten nicht geladen werden.' };
}

// ========================================
// Marketplace Page
// ========================================
export default function MarketplacePage() {
  const [filters, setFilters] = React.useState<MarketplaceFilters>(defaultFilters);

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="mx-auto mb-6 flex max-w-7xl flex-col gap-4 px-4 lg:flex-row lg:items-end lg:justify-between">
        <Link
          href="/dashboard?role=carrier"
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zum Dashboard
        </Link>
        <div className="max-w-3xl lg:text-right">
          <h1 className="text-2xl font-bold tracking-tight">Verfügbare Transportaufträge</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hier sehen Transporteure und Speditionen echte veröffentlichte Aufträge. Die Untergrenze schützt vor unrealistischen Dumping-Angeboten; dein Angebot gibst du in der Detailansicht ab.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-6 max-w-7xl mx-auto px-4">
        {/* Sidebar - Filters */}
        <aside className="col-span-12 lg:col-span-3">
          <Filters filters={filters} onFiltersChange={setFilters} />
          <div className="mt-6">
            <BannerAd slot="marketplace-sidebar" />
          </div>
        </aside>

        {/* Main Content */}
        <section className="col-span-12 lg:col-span-9 flex flex-col gap-4">
          {/* Sponsored Listings */}
          <SponsoredListing />
          
          {/* Order List */}
          <OrderList filters={filters} onFiltersChange={setFilters} />
        </section>
      </div>
    </main>
  );
}
