import type {
  SubmittedVerificationDocument,
  VerificationCapabilities,
  VerificationRole,
} from '@/services/verification-workflow.service';

export type VerificationProviderName = 'local' | 'sumsub' | 'veriff' | 'idnow';
export type VerificationProviderStartStatus = 'ready' | 'not_configured' | 'not_implemented';

export interface VerificationProviderStartInput {
  provider?: VerificationProviderName;
  userId: string;
  role: VerificationRole;
  country?: string;
  companyId?: string;
  vatNumber?: string;
  documents?: SubmittedVerificationDocument[];
  capabilities?: VerificationCapabilities;
  returnUrl?: string;
}

export interface VerificationProviderStartResult {
  provider: VerificationProviderName;
  status: VerificationProviderStartStatus;
  costTier: 'free' | 'low' | 'paid';
  message: string;
  externalId?: string;
  redirectUrl?: string;
  sdkToken?: string;
}
