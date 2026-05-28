export type ViesValidationStatus = 'passed' | 'failed' | 'unavailable' | 'skipped';

export interface ViesValidationResult {
  provider: 'vies';
  status: ViesValidationStatus;
  countryCode?: string;
  vatNumber?: string;
  valid?: boolean;
  name?: string;
  address?: string;
  requestDate?: string;
  requestIdentifier?: string;
  message: string;
  raw?: unknown;
}

const VIES_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR',
  'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI',
  'SK',
]);

export function normalizeVatNumber(input: {
  country?: string;
  vatNumber?: string;
}): { countryCode?: string; vatNumber?: string } {
  const compact = (input.vatNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const explicitCountry = normalizeCountryCode(input.country);

  if (!compact) {
    return { countryCode: explicitCountry };
  }

  const prefixedCountry = normalizeCountryCode(compact.slice(0, 2));
  if (prefixedCountry && VIES_COUNTRIES.has(prefixedCountry)) {
    return {
      countryCode: prefixedCountry,
      vatNumber: compact.slice(2),
    };
  }

  return {
    countryCode: explicitCountry,
    vatNumber: compact,
  };
}

export async function validateEuVatNumber(input: {
  country?: string;
  vatNumber?: string;
  timeoutMs?: number;
}): Promise<ViesValidationResult> {
  if (process.env.VIES_ENABLED === 'false') {
    return {
      provider: 'vies',
      status: 'skipped',
      message: 'VIES ist per Environment Variable deaktiviert.',
    };
  }

  const normalized = normalizeVatNumber(input);
  const countryCode = normalized.countryCode;
  const vatNumber = normalized.vatNumber;

  if (!countryCode || !vatNumber) {
    return {
      provider: 'vies',
      status: 'skipped',
      countryCode,
      vatNumber,
      message: 'Keine vollstaendige USt-ID fuer VIES uebergeben.',
    };
  }

  if (!VIES_COUNTRIES.has(countryCode)) {
    return {
      provider: 'vies',
      status: 'skipped',
      countryCode,
      vatNumber,
      message: `Land ${countryCode} wird von VIES nicht unterstuetzt.`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs || 6000);

  try {
    const response = await fetch(
      `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNumber}`,
      {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      },
    );

    const raw = await response.json().catch(() => null) as any;

    if (!response.ok) {
      return {
        provider: 'vies',
        status: 'unavailable',
        countryCode,
        vatNumber,
        message: raw?.userError || `VIES antwortete mit HTTP ${response.status}.`,
        raw,
      };
    }

    if (raw?.userError && raw.userError !== 'VALID' && raw.userError !== 'INVALID') {
      return {
        provider: 'vies',
        status: 'unavailable',
        countryCode,
        vatNumber,
        valid: false,
        requestDate: raw?.requestDate,
        requestIdentifier: raw?.requestIdentifier,
        message: `VIES konnte aktuell nicht eindeutig pruefen: ${raw.userError}`,
        raw,
      };
    }

    const isValid = Boolean(raw?.isValid);

    return {
      provider: 'vies',
      status: isValid ? 'passed' : 'failed',
      countryCode,
      vatNumber,
      valid: isValid,
      name: raw?.name && raw.name !== '---' ? raw.name : undefined,
      address: raw?.address && raw.address !== '---' ? raw.address : undefined,
      requestDate: raw?.requestDate,
      requestIdentifier: raw?.requestIdentifier,
      message: isValid
        ? 'USt-ID wurde ueber VIES bestaetigt.'
        : 'USt-ID wurde von VIES nicht als gueltig bestaetigt.',
      raw,
    };
  } catch (error) {
    return {
      provider: 'vies',
      status: 'unavailable',
      countryCode,
      vatNumber,
      message: error instanceof Error ? error.message : 'VIES Pruefung fehlgeschlagen.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeCountryCode(country?: string) {
  const value = (country || '').toUpperCase().trim();
  if (!value) return undefined;
  return value === 'GR' ? 'EL' : value;
}
