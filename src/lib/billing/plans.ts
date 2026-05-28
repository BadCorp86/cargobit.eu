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
    name: 'Free',
    monthlyFee: 0,
    yearlyFee: 0,
    pricesExcludeVat: true,
    vatNotice: 'zzgl. gesetzlicher MwSt.',
    commissionPercent: 14,
    walletFeePercent: 3.5,
    features: ['10 Transporte/Monat', 'Basis-Matching', 'E-Mail Support'],
  },
  STARTER: {
    key: 'STARTER',
    name: 'Starter',
    monthlyFee: 89,
    yearlyFee: 890,
    pricesExcludeVat: true,
    vatNotice: 'zzgl. gesetzlicher MwSt.',
    commissionPercent: 10,
    walletFeePercent: 2.5,
    features: ['50 Transporte/Monat', 'Erweitertes Matching', 'E-Mail Support', 'Versicherung verfügbar'],
  },
  PROFESSIONAL: {
    key: 'PROFESSIONAL',
    name: 'Professional',
    monthlyFee: 149,
    yearlyFee: 1490,
    pricesExcludeVat: true,
    vatNotice: 'zzgl. gesetzlicher MwSt.',
    commissionPercent: 7,
    walletFeePercent: 2,
    features: ['200 Transporte/Monat', 'Smart Matching Premium', 'Telefon-Support', 'Ads und Reports'],
  },
  ENTERPRISE: {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    monthlyFee: 490,
    yearlyFee: 4900,
    pricesExcludeVat: true,
    vatNotice: 'zzgl. gesetzlicher MwSt.',
    commissionPercent: 5,
    walletFeePercent: 1.5,
    features: ['Unbegrenzte Transporte', 'Dedizierter Account Manager', 'Individuelle Integration', 'SLA Garantie'],
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
          features: plan.features,
        },
      ];
    }),
  ) as Record<string, SubscriptionPlanConfig>;
}
