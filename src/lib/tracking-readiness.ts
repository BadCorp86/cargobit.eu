export type TrackingReadinessStatus = 'ready' | 'missing' | 'warning';

export interface TrackingReadinessCheck {
  id: string;
  label: string;
  description: string;
  required: boolean;
  status: TrackingReadinessStatus;
  detail?: string;
  maskedValue?: string;
}

export interface TrackingReadinessReport {
  ready: boolean;
  score: number;
  missing: string[];
  warnings: string[];
  checks: TrackingReadinessCheck[];
  provider: 'google' | 'mock';
  checkedAt: string;
}

export function getTrackingReadiness(): TrackingReadinessReport {
  const provider = (process.env.MAP_PROVIDER === 'google' ? 'google' : 'mock') as 'google' | 'mock';
  const googleRequired = provider === 'google';

  const checks: TrackingReadinessCheck[] = [
    {
      id: 'map_provider',
      label: 'Map Provider',
      description: 'Steuert, ob CargoBit Google Maps oder den lokalen Mock-Provider nutzt.',
      required: true,
      status: provider === 'google' ? 'ready' : 'warning',
      detail: provider === 'google'
        ? undefined
        : 'Aktuell ist MAP_PROVIDER=mock aktiv. Das ist korrekt für lokale Tests und CI.',
      maskedValue: provider,
    },
    createKeyCheck(
      'NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY',
      'Google Browser Key',
      'Wird im Browser für die Google Maps JavaScript API verwendet. Muss per Referrer/Domain eingeschränkt werden.',
      googleRequired,
      'AIza',
    ),
    createKeyCheck(
      'GOOGLE_MAPS_SERVER_KEY',
      'Google Server Key',
      'Wird serverseitig für Routes API und Geocoding verwendet. Muss per Server-IP/API eingeschränkt werden.',
      googleRequired,
      'AIza',
    ),
    createUrlCheck(
      'REDIS_URL',
      'Redis Pub/Sub',
      'Optional für WebSocket-Broadcasts auf eigenem Server. Ohne Redis bleibt Polling aktiv.',
      false,
      'redis',
    ),
    createUrlCheck(
      'NEXT_PUBLIC_TRACKING_WS_URL',
      'Tracking WebSocket URL',
      'Optionaler Browser-Endpunkt für Live-Events, z. B. wss://api.cargobit.eu/ws.',
      false,
      'ws',
    ),
  ];

  const requiredChecks = checks.filter((check) => check.required);
  const readyRequired = requiredChecks.filter((check) => check.status === 'ready').length;
  const missing = requiredChecks
    .filter((check) => check.status === 'missing')
    .map((check) => check.id);
  const warnings = checks
    .filter((check) => check.status === 'warning' || check.detail)
    .map((check) => `${check.label}: ${check.detail || 'Prüfung hat einen Hinweis ergeben.'}`);

  return {
    ready: missing.length === 0,
    score: requiredChecks.length === 0 ? 100 : Math.round((readyRequired / requiredChecks.length) * 100),
    missing,
    warnings,
    checks,
    provider,
    checkedAt: new Date().toISOString(),
  };
}

export function withoutMaskedTrackingValues(report: TrackingReadinessReport): TrackingReadinessReport {
  return {
    ...report,
    checks: report.checks.map((check) => ({
      ...check,
      maskedValue: undefined,
    })),
  };
}

function createKeyCheck(
  key: string,
  label: string,
  description: string,
  required: boolean,
  expectedPrefix: string,
): TrackingReadinessCheck {
  const value = process.env[key] || '';
  const configured = isMeaningfulValue(value) && value.startsWith(expectedPrefix);

  return {
    id: key.toLowerCase(),
    label,
    description,
    required,
    status: configured ? 'ready' : required ? 'missing' : 'warning',
    maskedValue: configured ? maskValue(value) : undefined,
    detail: configured ? undefined : `${key} ist ${required ? 'für Google Maps erforderlich' : 'optional'}.`,
  };
}

function createUrlCheck(
  key: string,
  label: string,
  description: string,
  required: boolean,
  expectedPrefix: string,
): TrackingReadinessCheck {
  const value = process.env[key] || '';
  const configured = isMeaningfulValue(value) && value.startsWith(expectedPrefix);

  return {
    id: key.toLowerCase(),
    label,
    description,
    required,
    status: configured ? 'ready' : required ? 'missing' : 'warning',
    maskedValue: configured ? maskValue(value) : undefined,
    detail: configured ? undefined : `${key} ist nicht gesetzt. Polling/Mock-Betrieb bleibt möglich.`,
  };
}

function isMeaningfulValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return !['replace', 'placeholder', 'changeme'].some((placeholder) => normalized.includes(placeholder));
}

function maskValue(value: string) {
  if (value.length <= 12) return 'konfiguriert';
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
