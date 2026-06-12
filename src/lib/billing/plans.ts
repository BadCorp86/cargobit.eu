export type BillingPlanKey = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export const BILLING_CURRENCY = 'EUR';
export const DEFAULT_VAT_PERCENT = 19;

export interface BillingPlanDefinition {
  key: BillingPlanKey;
  name: string;
  monthlyFee: number;
  yearlyFee: number;
  pricesExcludeVat: boolean;
  vatNotice: string;
  commissionPercent: number;
  walletFeePercent: number;
  maxTransportsMonthly: number;
  features: string[];
}

export interface SubscriptionPriceBreakdown {
  currency: typeof BILLING_CURRENCY;
  netAmount: number;
  vatPercent: number;
  vatAmount: number;
  grossAmount: number;
}

export type SubscriptionPlanConfig = Omit<BillingPlanDefinition, 'key'> & {
  billingCurrency: typeof BILLING_CURRENCY;
  vatPercent: number;
  monthlyVatAmount: number;
  monthlyGrossFee: number;
  monthlyPrice: SubscriptionPriceBreakdown;
  yearlyVatAmount: number;
  yearlyGrossFee: number;
  yearlyPrice: SubscriptionPriceBreakdown;
};

export const BILLING_PLANS: Record<BillingPlanKey, BillingPlanDefinition> = {
  FREE: {
    key: 'FREE',
    name: 'Start',
    monthlyFee: 0,
    yearlyFee: 0,
    pricesExcludeVat: true,
    vatNotice: 'zzgl. gesetzlicher MwSt.',
    commissionPercent: 14,
    walletFeePercent: 3.5,
    maxTransportsMonthly: 10,
    features: [
      '10 Aufträge pro Monat',
      'KI-Preisrechner',
      'Angebote von Transporteuren',
      'Zahlungsschutz pro Auftrag',
      'E-Mail Support',
    ],
  },
  STARTER: {
    key: 'STARTER',
    name: 'Business',
    monthlyFee: 89,
    yearlyFee: 0,
    pricesExcludeVat: true,
    vatNotice: 'zzgl. gesetzlicher MwSt.',
    commissionPercent: 12,
    walletFeePercent: 2.5,
    maxTransportsMonthly: 30,
    features: [
      '30 Aufträge pro Monat',
      '12% CargoBit-Provision',
      'Priorisiertes Matching',
      'Verifizierungs- und Dokumentenprüfung',
      'Versicherungspartner anfragbar',
      'Priorisierter Support',
    ],
  },
  PROFESSIONAL: {
    key: 'PROFESSIONAL',
    name: 'Business',
    monthlyFee: 0,
    yearlyFee: 0,
    pricesExcludeVat: true,
    vatNotice: 'zzgl. gesetzlicher MwSt.',
    commissionPercent: 12,
    walletFeePercent: 2.5,
    maxTransportsMonthly: 30,
    features: ['Deprecated: bitte Business nutzen'],
  },
  ENTERPRISE: {
    key: 'ENTERPRISE',
    name: 'Business',
    monthlyFee: 0,
    yearlyFee: 0,
    pricesExcludeVat: true,
    vatNotice: 'zzgl. gesetzlicher MwSt.',
    commissionPercent: 12,
    walletFeePercent: 2.5,
    maxTransportsMonthly: 30,
    features: ['Deprecated: bitte Business nutzen'],
  },
};

export function normalizeBillingPlan(plan?: string | null): BillingPlanKey {
  const normalized = String(plan || 'FREE').toUpperCase();
  if (normalized === 'STARTER' || normalized === 'PROFESSIONAL' || normalized === 'ENTERPRISE') {
    return normalized;
  }

  return 'FREE';
}

export function getBillingPlan(plan?: string | null): BillingPlanDefinition {
  return BILLING_PLANS[normalizeBillingPlan(plan)];
}

export function roundBillingAmount(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateSubscriptionPrice(
  netAmount: number,
  vatPercent = DEFAULT_VAT_PERCENT,
): SubscriptionPriceBreakdown {
  const roundedNetAmount = roundBillingAmount(netAmount);
  const vatAmount = roundBillingAmount(roundedNetAmount * (vatPercent / 100));

  return {
    currency: BILLING_CURRENCY,
    netAmount: roundedNetAmount,
    vatPercent,
    vatAmount,
    grossAmount: roundBillingAmount(roundedNetAmount + vatAmount),
  };
}

export function getSubscriptionPlanConfig() {
  return Object.fromEntries(
    Object.values(BILLING_PLANS).map((plan) => {
      const monthlyPrice = calculateSubscriptionPrice(plan.monthlyFee);
      const yearlyPrice = calculateSubscriptionPrice(plan.yearlyFee);

      return [
        plan.key.toLowerCase(),
        {
          name: plan.name,
          monthlyFee: plan.monthlyFee,
          yearlyFee: plan.yearlyFee,
          pricesExcludeVat: plan.pricesExcludeVat,
          vatNotice: plan.vatNotice,
          billingCurrency: BILLING_CURRENCY,
          vatPercent: DEFAULT_VAT_PERCENT,
          monthlyVatAmount: monthlyPrice.vatAmount,
          monthlyGrossFee: monthlyPrice.grossAmount,
          monthlyPrice,
          yearlyVatAmount: yearlyPrice.vatAmount,
          yearlyGrossFee: yearlyPrice.grossAmount,
          yearlyPrice,
          commissionPercent: plan.commissionPercent,
          walletFeePercent: plan.walletFeePercent,
          maxTransportsMonthly: plan.maxTransportsMonthly,
          features: plan.features,
        },
      ];
    }),
  ) as Record<string, SubscriptionPlanConfig>;
}
