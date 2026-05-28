import {
  resolveVerificationCostPolicy,
  type VerificationCostPolicy,
} from '@/services/verification-cost-policy.service';
import type {
  VerificationProviderName,
  VerificationProviderStartInput,
  VerificationProviderStartResult,
} from '@/services/verification/providers/types';

const PAID_PROVIDER_ENV: Record<Exclude<VerificationProviderName, 'local'>, string[]> = {
  sumsub: ['SUMSUB_APP_TOKEN', 'SUMSUB_SECRET_KEY'],
  veriff: ['VERIFF_API_KEY'],
  idnow: ['IDNOW_COMPANY_ID', 'IDNOW_API_KEY'],
};

export function getVerificationProviderOverview(input: {
  role: VerificationProviderStartInput['role'];
  country?: string;
  vatNumber?: string;
  highRisk?: boolean;
  estimatedOrderValueCents?: number;
}): VerificationCostPolicy {
  return resolveVerificationCostPolicy({
    ...input,
    hasVatNumber: Boolean(input.vatNumber),
  });
}

export async function startVerificationProvider(
  input: VerificationProviderStartInput,
): Promise<VerificationProviderStartResult> {
  const provider = input.provider || providerFromEnv();

  if (provider === 'local') {
    return {
      provider: 'local',
      status: 'ready',
      costTier: 'free',
      externalId: `local_${input.userId}_${Date.now()}`,
      message: 'Kostenarme lokale Pruefung ist aktiv: Dokument-Metadaten, VIES wenn USt-ID vorhanden, Ticket-Fallback.',
    };
  }

  const missingEnv = PAID_PROVIDER_ENV[provider].filter((key) => !process.env[key]);

  if (missingEnv.length > 0) {
    return {
      provider,
      status: 'not_configured',
      costTier: 'paid',
      message: `Provider ${provider} ist nicht konfiguriert. Fehlende Variablen: ${missingEnv.join(', ')}.`,
    };
  }

  return {
    provider,
    status: 'not_implemented',
    costTier: 'paid',
    message: `${provider} Zugangsdaten sind vorhanden, der Live-Startadapter ist aber noch nicht aktiviert.`,
  };
}

function providerFromEnv(): VerificationProviderName {
  const provider = (process.env.VERIFICATION_PROVIDER || 'local').toLowerCase();

  if (provider === 'sumsub' || provider === 'veriff' || provider === 'idnow') {
    return provider;
  }

  return 'local';
}
