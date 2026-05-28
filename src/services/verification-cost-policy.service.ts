import type { VerificationRole } from '@/services/verification-workflow.service';

export type VerificationCostMode =
  | 'local_rules'
  | 'local_rules_vies'
  | 'local_rules_manual_review'
  | 'external_provider_recommended';

export interface VerificationCostOption {
  id: string;
  label: string;
  cost: string;
  useFor: string;
  enabledByDefault: boolean;
}

export interface VerificationCostPolicy {
  recommendedMode: VerificationCostMode;
  shouldUsePaidProvider: boolean;
  paidProviderReason?: string;
  options: VerificationCostOption[];
}

export function resolveVerificationCostPolicy(input: {
  role: VerificationRole;
  country?: string;
  hasVatNumber?: boolean;
  highRisk?: boolean;
  estimatedOrderValueCents?: number;
}): VerificationCostPolicy {
  const highValueOrder = (input.estimatedOrderValueCents || 0) >= 500000;
  const shouldUsePaidProvider = Boolean(input.highRisk || highValueOrder);
  const isBusinessRole = ['SHIPPER_COMPANY', 'CARRIER', 'DRIVER_SELF_EMPLOYED'].includes(input.role);

  let recommendedMode: VerificationCostMode = 'local_rules';

  if (shouldUsePaidProvider) {
    recommendedMode = 'external_provider_recommended';
  } else if (input.hasVatNumber && isBusinessRole) {
    recommendedMode = 'local_rules_vies';
  } else if (input.role === 'CARRIER' || input.role === 'DRIVER_SELF_EMPLOYED') {
    recommendedMode = 'local_rules_manual_review';
  }

  return {
    recommendedMode,
    shouldUsePaidProvider,
    paidProviderReason: shouldUsePaidProvider
      ? 'Empfohlen bei hohen Auftragswerten, auffaelligen Risikosignalen oder regulatorisch sensiblen Faellen.'
      : undefined,
    options: [
      {
        id: 'local_ocr_rules',
        label: 'Lokale OCR/Metadaten-Regeln',
        cost: '0 EUR Providerkosten',
        useFor: 'MVP, private Verlader, Dokumentvollstaendigkeit, Ablaufdaten, Plausibilitaet',
        enabledByDefault: true,
      },
      {
        id: 'vies',
        label: 'EU VIES USt-ID Pruefung',
        cost: '0 EUR Providerkosten',
        useFor: 'Gewerbekunden in der EU mit USt-ID',
        enabledByDefault: true,
      },
      {
        id: 'manual_review',
        label: 'Support/Admin Ticket-Fallback',
        cost: 'interner Aufwand',
        useFor: 'Unklare OCR-Ergebnisse, Versicherungen, Transportlizenzen, Laender-Sonderfaelle',
        enabledByDefault: true,
      },
      {
        id: 'openregister',
        label: 'OpenRegister / Handelsregister API',
        cost: 'Free-Tier moeglich, danach kostenpflichtig',
        useFor: 'Automatisierte Handelsregister- und Firmenpruefung',
        enabledByDefault: false,
      },
      {
        id: 'paid_kyc_provider',
        label: 'Sumsub / Veriff / IDnow',
        cost: 'Kosten pro Verifizierung oder Mindestumsatz',
        useFor: 'Hohe Risiken, grosse Volumen, starke KYC/KYB Compliance',
        enabledByDefault: false,
      },
    ],
  };
}
