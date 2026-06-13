'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buildUserRequestHeaders } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Clock3, Loader2, MapPin, Navigation, RadioTower, RefreshCw, Satellite } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
    __cargoBitGoogleMapsLoading?: Promise<void>;
  }
}

type TrackingStatus = 'live' | 'stale' | 'offline' | 'completed';

interface TrackingPointView {
  id: string;
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  timestamp: string;
}

interface TrackingDataView {
  transportId: string;
  status: TrackingStatus;
  provider: {
    maps: string;
    browserKeyConfigured: boolean;
    serverKeyConfigured: boolean;
  };
  route: {
    distanceKm: number;
    durationMinutes: number;
    tollCost: number;
    fuelCost: number;
    polyline?: string | null;
    provider: string;
    waypoints: Array<{ lat: number; lng: number }>;
  } | null;
  lastLocation: TrackingPointView | null;
  points: TrackingPointView[];
  eta: {
    durationMinutes: number;
    arrivalEstimate: string;
    basedOnLastLocationAt: string | null;
  } | null;
  updatedAt: string | null;
}

interface LiveTrackingCardProps {
  transportId: string;
  userId?: string;
  userRole?: string;
  internalView?: boolean;
  compact?: boolean;
}

const googleMapsBrowserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
const trackingWebSocketUrl = process.env.NEXT_PUBLIC_TRACKING_WS_URL;

export function LiveTrackingCard({
  transportId,
  userId,
  userRole,
  internalView = false,
  compact = false,
}: LiveTrackingCardProps) {
  const [tracking, setTracking] = React.useState<TrackingDataView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = React.useState<'disabled' | 'connecting' | 'connected' | 'fallback'>(
    trackingWebSocketUrl ? 'connecting' : 'disabled',
  );

  const loadTracking = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/transports/${encodeURIComponent(transportId)}/tracking`, {
        headers: buildUserRequestHeaders(userId ? {
          id: userId,
          email: `${userId}@local.cargobit.test`,
          role: userRole,
        } : null),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Tracking konnte nicht geladen werden.');
      }

      setTracking(payload);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Tracking konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [transportId, userId, userRole]);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await loadTracking();
      if (cancelled) return;
    };

    run();
    const interval = window.setInterval(run, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [loadTracking]);

  React.useEffect(() => {
    if (!trackingWebSocketUrl || typeof window === 'undefined') {
      return;
    }

    let closed = false;
    const url = buildTrackingWebSocketUrl(trackingWebSocketUrl, transportId);
    const socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      if (closed) return;
      setRealtimeStatus('connected');
      socket.send(JSON.stringify({ type: 'subscribe', channel: `tracking:${transportId}` }));
    });

    socket.addEventListener('message', (event) => {
      const point = parseTrackingMessage(event.data, transportId);
      if (!point) return;

      setTracking((current) => {
        if (!current) return current;

        const points = [...current.points, point].slice(-500);

        return {
          ...current,
          status: 'live',
          lastLocation: point,
          points,
          updatedAt: point.timestamp,
        };
      });
    });

    socket.addEventListener('error', () => {
      if (!closed) setRealtimeStatus('fallback');
    });

    socket.addEventListener('close', () => {
      if (!closed) setRealtimeStatus('fallback');
    });

    return () => {
      closed = true;
      socket.close();
    };
  }, [transportId]);

  return (
    <Card className="overflow-hidden border-white/10 bg-[#071927] text-white shadow-2xl shadow-black/25">
      <CardHeader className="border-b border-white/10 bg-white/[0.03]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RadioTower className="h-5 w-5 text-[#00D4FF]" />
              Live Tracking
            </CardTitle>
            <CardDescription className="mt-1 text-white/55">
              GPS-Position, Route und ETA für diesen Auftrag.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {tracking ? <TrackingStatusBadge status={tracking.status} /> : null}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={loadTracking}
              className="h-9 w-9 border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
              aria-label="Tracking neu laden"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {error ? (
          <div className="rounded-2xl border border-[#F39C12]/25 bg-[#F39C12]/10 p-4 text-sm text-[#F39C12]">
            {error}
          </div>
        ) : null}

        <div className={cn('overflow-hidden rounded-2xl border border-white/10 bg-black/30', compact ? 'h-64' : 'h-80')}>
          {tracking ? (
            <TrackingMap tracking={tracking} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/45">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Tracking wird geladen
            </div>
          )}
        </div>

        {tracking ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <TrackingMetric
              icon={<Navigation className="h-4 w-4" />}
              label="ETA"
              value={tracking.eta ? formatEta(tracking.eta.arrivalEstimate) : 'Noch offen'}
            />
            <TrackingMetric
              icon={<MapPin className="h-4 w-4" />}
              label="Distanz"
              value={tracking.route ? `${Math.round(tracking.route.distanceKm)} km` : 'Unbekannt'}
            />
            <TrackingMetric
              icon={<Clock3 className="h-4 w-4" />}
              label="Letztes Signal"
              value={tracking.updatedAt ? formatRelativeTime(tracking.updatedAt) : 'Kein Signal'}
            />
          </div>
        ) : null}

        {internalView && tracking ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-white/50">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Provider: {tracking.provider.maps}</span>
              <span>Server-Key: {tracking.provider.serverKeyConfigured ? 'gesetzt' : 'nicht gesetzt'}</span>
              <span>Browser-Key: {tracking.provider.browserKeyConfigured ? 'gesetzt' : 'nicht gesetzt'}</span>
              <span>GPS-Punkte: {tracking.points.length}</span>
              <span>Realtime: {realtimeStatusLabel(realtimeStatus)}</span>
              <span>Fallback: Polling 15s</span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function buildTrackingWebSocketUrl(baseUrl: string, transportId: string) {
  const fallbackOrigin = typeof window !== 'undefined'
    ? window.location.origin.replace(/^http/, 'ws')
    : 'ws://localhost:3000';
  const url = new URL(baseUrl, fallbackOrigin);
  url.searchParams.set('channels', `tracking:${transportId}`);
  return url.toString();
}

function parseTrackingMessage(raw: unknown, transportId: string): TrackingPointView | null {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const payload = data?.payload && typeof data.payload === 'object' ? data.payload : data;
    const channel = typeof data?.channel === 'string' ? data.channel : undefined;
    const jobId = payload?.jobId || payload?.transportId;

    if (channel && channel !== `tracking:${transportId}`) return null;
    if (jobId && jobId !== transportId) return null;

    const lat = Number(payload?.latitude ?? payload?.lat);
    const lng = Number(payload?.longitude ?? payload?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      id: payload?.id || `ws_${transportId}_${Date.now()}`,
      lat,
      lng,
      speed: typeof payload?.speed === 'number' ? payload.speed : null,
      heading: typeof payload?.heading === 'number' ? payload.heading : null,
      accuracy: typeof payload?.accuracy === 'number' ? payload.accuracy : null,
      timestamp: payload?.timestamp || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function realtimeStatusLabel(status: 'disabled' | 'connecting' | 'connected' | 'fallback') {
  switch (status) {
    case 'connected':
      return 'WebSocket aktiv';
    case 'connecting':
      return 'verbindet';
    case 'fallback':
      return 'Polling aktiv';
    default:
      return 'nicht konfiguriert';
  }
}

function TrackingMap({ tracking }: { tracking: TrackingDataView }) {
  const mapRef = React.useRef<HTMLDivElement | null>(null);
  const googleMapRef = React.useRef<any>(null);
  const markerRef = React.useRef<any>(null);
  const routeRef = React.useRef<any>(null);
  const [scriptReady, setScriptReady] = React.useState(
    () => typeof window !== 'undefined' && Boolean(window.google?.maps),
  );

  const canUseGoogle = Boolean(googleMapsBrowserKey);
  const path = React.useMemo(() => buildTrackingPath(tracking), [tracking]);

  React.useEffect(() => {
    if (!canUseGoogle || scriptReady) return;

    loadGoogleMapsScript()
      .then(() => setScriptReady(true))
      .catch(() => setScriptReady(false));
  }, [canUseGoogle, scriptReady]);

  React.useEffect(() => {
    if (!canUseGoogle || !scriptReady || !mapRef.current || !window.google?.maps || path.length === 0) return;

    const google = window.google;
    const center = tracking.lastLocation || path[Math.floor(path.length / 2)];

    if (!googleMapRef.current) {
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom: 7,
        disableDefaultUI: true,
        zoomControl: true,
        styles: darkGoogleMapStyle,
      });
    }

    const map = googleMapRef.current;
    map.setCenter(center);

    routeRef.current?.setMap(null);
    routeRef.current = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#00D4FF',
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map,
    });

    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        position: center,
        map,
        title: 'Aktuelle Fahrerposition',
      });
    } else {
      markerRef.current.setPosition(center);
    }

    if (path.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      path.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, 48);
    }
  }, [canUseGoogle, path, scriptReady, tracking.lastLocation]);

  if (canUseGoogle && scriptReady) {
    return <div ref={mapRef} className="h-full w-full" />;
  }

  return <FallbackTrackingMap tracking={tracking} path={path} />;
}

function FallbackTrackingMap({ tracking, path }: { tracking: TrackingDataView; path: Array<{ lat: number; lng: number }> }) {
  const current = tracking.lastLocation;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_30%_25%,rgba(0,212,255,0.18),transparent_30%),linear-gradient(135deg,#06121C,#0B2433_60%,#06121C)]">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:36px_36px]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M 12 72 C 28 44, 48 63, 62 38 S 82 22, 90 28"
          fill="none"
          stroke="rgba(0,212,255,0.85)"
          strokeDasharray="4 3"
          strokeLinecap="round"
          strokeWidth="1.4"
        />
        <circle cx="12" cy="72" r="2.5" fill="#2ECC71" />
        <circle cx="90" cy="28" r="2.5" fill="#F39C12" />
        <circle cx={current ? 62 : 38} cy={current ? 38 : 56} r="3" fill="#00D4FF" className="drop-shadow-[0_0_10px_rgba(0,212,255,0.9)]" />
      </svg>
      <div className="absolute left-4 top-4 rounded-full border border-[#00D4FF]/25 bg-[#00D4FF]/10 px-3 py-1 text-xs font-semibold text-[#00D4FF]">
        {tracking.provider.browserKeyConfigured ? 'Google bereit' : 'Mock Karte'}
      </div>
      <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-white/65 backdrop-blur">
        <div className="flex items-center gap-2 font-semibold text-white">
          <Satellite className="h-4 w-4 text-[#00D4FF]" />
          {current ? `${current.lat.toFixed(4)}, ${current.lng.toFixed(4)}` : 'Noch keine GPS-Position'}
        </div>
        <p className="mt-1 text-white/45">
          {path.length} Routenpunkte · Google Maps erscheint automatisch, sobald ein Browser-Key gesetzt ist.
        </p>
      </div>
    </div>
  );
}

function TrackingStatusBadge({ status }: { status: TrackingStatus }) {
  const tone = {
    live: 'border-[#2ECC71]/25 bg-[#2ECC71]/10 text-[#2ECC71]',
    stale: 'border-[#F39C12]/25 bg-[#F39C12]/10 text-[#F39C12]',
    offline: 'border-white/10 bg-white/[0.05] text-white/55',
    completed: 'border-[#00D4FF]/25 bg-[#00D4FF]/10 text-[#00D4FF]',
  }[status];

  const label = {
    live: 'Live',
    stale: 'Veraltet',
    offline: 'Offline',
    completed: 'Abgeschlossen',
  }[status];

  return <Badge variant="outline" className={tone}>{label}</Badge>;
}

function TrackingMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 text-[#00D4FF]">{icon}</div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function buildTrackingPath(tracking: TrackingDataView) {
  const routeWaypoints = tracking.route?.waypoints || [];
  const points = tracking.points.map((point) => ({ lat: point.lat, lng: point.lng }));

  if (points.length > 0 && routeWaypoints.length > 0) {
    return [routeWaypoints[0], ...points, routeWaypoints[routeWaypoints.length - 1]];
  }

  return points.length > 0 ? points : routeWaypoints;
}

function loadGoogleMapsScript() {
  if (window.google?.maps) return Promise.resolve();
  if (window.__cargoBitGoogleMapsLoading) return window.__cargoBitGoogleMapsLoading;

  window.__cargoBitGoogleMapsLoading = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById('cargobit-google-maps');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'cargobit-google-maps';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsBrowserKey || '')}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return window.__cargoBitGoogleMapsLoading;
}

function formatEta(value: string) {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatRelativeTime(value: string) {
  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));

  if (diffMinutes === 0) return 'gerade eben';
  if (diffMinutes === 1) return 'vor 1 Min.';
  if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;

  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const darkGoogleMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#06121C' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#06121C' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8BC5FF' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#123044' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1C7ED6' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#03101A' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];
