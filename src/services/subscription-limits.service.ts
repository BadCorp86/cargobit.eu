import { prisma } from '@/lib/db';
import type { BillingPlanDefinition } from '@/lib/billing/plans';
import { resolveBillingPlan } from '@/services/fee.service';

export interface TransportLimitCheck {
  allowed: boolean;
  plan: BillingPlanDefinition;
  usedThisMonth: number;
  maxTransportsMonthly: number;
  remainingThisMonth: number;
}

export class SubscriptionLimitError extends Error {
  code = 'PLAN_TRANSPORT_LIMIT_REACHED';
  status = 403;
  check: TransportLimitCheck;

  constructor(check: TransportLimitCheck) {
    super(
      `Der ${check.plan.name} Plan ist auf ${check.maxTransportsMonthly} Transporte pro Monat begrenzt.`
    );
    this.name = 'SubscriptionLimitError';
    this.check = check;
  }
}

export async function assertCanCreateTransport(input: {
  shipperUserId: string;
  shipperCompanyId?: string | null;
}): Promise<TransportLimitCheck> {
  const plan = await resolveBillingPlan(input.shipperUserId, input.shipperCompanyId);
  const maxTransportsMonthly = plan.maxTransportsMonthly;

  if (maxTransportsMonthly < 0) {
    return {
      allowed: true,
      plan,
      usedThisMonth: 0,
      maxTransportsMonthly,
      remainingThisMonth: -1,
    };
  }

  const { start, end } = getCurrentMonthWindow();
  const companyId = input.shipperCompanyId || null;
  const usedThisMonth = await prisma.transport.count({
    where: {
      ...(companyId
        ? { shipperCompanyId: companyId }
        : { shipperUserId: input.shipperUserId }),
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  });

  const check = {
    allowed: usedThisMonth < maxTransportsMonthly,
    plan,
    usedThisMonth,
    maxTransportsMonthly,
    remainingThisMonth: Math.max(0, maxTransportsMonthly - usedThisMonth),
  };

  if (!check.allowed) {
    throw new SubscriptionLimitError(check);
  }

  return check;
}

export function createTransportLimitResponse(error: SubscriptionLimitError) {
  return {
    error: 'PlanLimitError',
    code: error.code,
    message: error.message,
    plan: error.check.plan.key,
    usedThisMonth: error.check.usedThisMonth,
    maxTransportsMonthly: error.check.maxTransportsMonthly,
    remainingThisMonth: error.check.remainingThisMonth,
    upgradePath: '/billing',
  };
}

function getCurrentMonthWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return { start, end };
}
