import { prisma } from '@/lib/db';
import {
  BillingPlanDefinition,
  BillingPlanKey,
  getBillingPlan,
  normalizeBillingPlan,
} from '@/lib/billing/plans';

export const PLATFORM_WALLET_OWNER_ID = 'PLATFORM';

export interface BookingFeeQuote {
  plan: BillingPlanKey;
  currency: string;
  grossAmount: number;
  grossAmountCents: number;
  commissionPercent: number;
  commissionAmount: number;
  commissionAmountCents: number;
  walletFeePercent: number;
  walletFeeAmount: number;
  walletFeeAmountCents: number;
  shipperDebitAmount: number;
  shipperDebitAmountCents: number;
  transporterCreditAmount: number;
  transporterCreditAmountCents: number;
  platformCreditAmount: number;
  platformCreditAmountCents: number;
}

export interface BookingFeeInput {
  amount: number;
  currency?: string | null;
  shipperUserId: string;
  shipperCompanyId?: string | null;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function eurosToCents(value: number): number {
  return Math.round(roundMoney(value) * 100);
}

export function centsToEuros(value: number): number {
  return roundMoney(value / 100);
}

export async function quoteBookingFees(input: BookingFeeInput): Promise<BookingFeeQuote> {
  const plan = await resolveBillingPlan(input.shipperUserId, input.shipperCompanyId);
  return calculateBookingFees(input.amount, plan, input.currency || 'EUR');
}

export function calculateBookingFees(
  amount: number,
  plan: BillingPlanDefinition,
  currency = 'EUR',
): BookingFeeQuote {
  const grossAmount = roundMoney(amount);
  const commissionAmount = roundMoney(grossAmount * (plan.commissionPercent / 100));
  const walletFeeAmount = roundMoney(grossAmount * (plan.walletFeePercent / 100));
  const shipperDebitAmount = roundMoney(grossAmount + walletFeeAmount);
  const transporterCreditAmount = roundMoney(grossAmount - commissionAmount);
  const platformCreditAmount = roundMoney(commissionAmount + walletFeeAmount);

  return {
    plan: plan.key,
    currency,
    grossAmount,
    grossAmountCents: eurosToCents(grossAmount),
    commissionPercent: plan.commissionPercent,
    commissionAmount,
    commissionAmountCents: eurosToCents(commissionAmount),
    walletFeePercent: plan.walletFeePercent,
    walletFeeAmount,
    walletFeeAmountCents: eurosToCents(walletFeeAmount),
    shipperDebitAmount,
    shipperDebitAmountCents: eurosToCents(shipperDebitAmount),
    transporterCreditAmount,
    transporterCreditAmountCents: eurosToCents(transporterCreditAmount),
    platformCreditAmount,
    platformCreditAmountCents: eurosToCents(platformCreditAmount),
  };
}

export async function resolveBillingPlan(
  shipperUserId: string,
  shipperCompanyId?: string | null,
): Promise<BillingPlanDefinition> {
  try {
    const companyId = shipperCompanyId || await resolveUserCompanyId(shipperUserId);

    if (!companyId) {
      return getBillingPlan('FREE');
    }

    const companyPlan = await prisma.companyPlan.findFirst({
      where: {
        companyId,
        OR: [
          { validTo: null },
          { validTo: { gte: new Date() } },
        ],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!companyPlan?.plan) {
      return getBillingPlan('FREE');
    }

    const planKey = normalizeBillingPlan(companyPlan.plan.name);
    const fallbackPlan = getBillingPlan(planKey);

    return {
      key: planKey,
      name: fallbackPlan.name,
      monthlyFee: fallbackPlan.monthlyFee,
      yearlyFee: fallbackPlan.yearlyFee,
      pricesExcludeVat: true,
      vatNotice: 'zzgl. gesetzlicher MwSt.',
      commissionPercent: fallbackPlan.commissionPercent,
      walletFeePercent: fallbackPlan.walletFeePercent,
      maxTransportsMonthly: fallbackPlan.maxTransportsMonthly,
      features: fallbackPlan.features,
    };
  } catch (error) {
    console.error('[Fees] Failed to resolve billing plan, using FREE fallback:', error);
    return getBillingPlan('FREE');
  }
}

export async function getOrCreateWallet(ownerUserId: string, client: any = prisma) {
  let wallet = await client.wallet.findFirst({
    where: { ownerUserId },
  });

  if (!wallet) {
    wallet = await client.wallet.create({
      data: {
        ownerUserId,
        balance: 0,
        reservedBalance: 0,
        currency: 'EUR',
        status: 'ACTIVE',
      },
    });
  }

  return wallet;
}

export async function getOrCreatePlatformWallet(client: any = prisma) {
  await client.user.upsert({
    where: { id: PLATFORM_WALLET_OWNER_ID },
    update: {},
    create: {
      id: PLATFORM_WALLET_OWNER_ID,
      email: 'platform@cargobit.internal',
      passwordHash: 'system-wallet',
      firstName: 'CargoBit',
      lastName: 'Platform',
      language: 'de',
      status: 'ACTIVE',
    },
  });

  return getOrCreateWallet(PLATFORM_WALLET_OWNER_ID, client);
}

async function resolveUserCompanyId(userId: string): Promise<string | null> {
  const companyUser = await prisma.companyUser.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return companyUser?.companyId || null;
}
