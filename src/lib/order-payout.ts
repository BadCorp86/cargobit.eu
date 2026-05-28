import { createOrderInvoiceDraft } from '@/lib/order-invoice';

export type PayoutGateStatus = 'passed' | 'waiting' | 'blocked' | 'review_required';
export type PayoutReleaseStatus = 'ready' | 'released' | 'blocked';

export interface OrderPayoutGate {
  id: 'pod' | 'invoice' | 'risk' | 'wallet';
  label: string;
  status: PayoutGateStatus;
  detail: string;
}

export interface OrderPayoutRelease {
  releaseId: string;
  orderId: string;
  status: PayoutReleaseStatus;
  currency: string;
  releasedAt?: string;
  blockedReasons: string[];
  settlement: {
    carrierWalletCredit: number;
    platformRevenueNet: number;
    shipperChargeGross: number;
    vatHandledOnInvoice: boolean;
  };
  gates: OrderPayoutGate[];
  walletTransaction: {
    type: 'PAYMENT_IN';
    amount: number;
    reference: string;
    description: string;
  };
  nextStep: {
    label: string;
    description: string;
  };
}

export function createOrderPayoutRelease(input: {
  orderId: string;
  amount: number;
  currency?: string | null;
  planKey?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  hasPod?: boolean;
  invoiceIssued?: boolean;
  walletReady?: boolean;
  riskLevel?: 'green' | 'yellow' | 'red';
  status?: PayoutReleaseStatus;
  releasedAt?: Date;
}): OrderPayoutRelease {
  const invoice = createOrderInvoiceDraft({
    orderId: input.orderId,
    amount: input.amount,
    currency: input.currency || 'EUR',
    planKey: input.planKey || 'FREE',
  });

  const transportLine = invoice.lineItems.find((item) => item.label === 'Transportleistung');
  const platformLine = invoice.lineItems.find((item) => item.label === 'CargoBit Plattformgebuehr');
  const walletLine = invoice.lineItems.find((item) => item.label === 'Wallet-/Zahlungsschutz');
  const riskLevel = input.riskLevel || 'green';

  const gates: OrderPayoutGate[] = [
    {
      id: 'pod',
      label: 'POD/eCMR',
      status: input.hasPod ? 'passed' : 'blocked',
      detail: input.hasPod
        ? 'Abliefernachweis liegt vor.'
        : 'Abliefernachweis fehlt oder wurde noch nicht geprueft.',
    },
    {
      id: 'invoice',
      label: 'Rechnung',
      status: input.invoiceIssued ? 'passed' : 'waiting',
      detail: input.invoiceIssued
        ? 'Rechnung wurde erzeugt und ist revisionsfaehig verlinkt.'
        : 'Rechnung muss vor Auszahlung erstellt werden.',
    },
    {
      id: 'risk',
      label: 'Risk Gate',
      status: riskLevel === 'red' ? 'blocked' : riskLevel === 'yellow' ? 'review_required' : 'passed',
      detail: riskLevel === 'red'
        ? 'Auszahlung ist wegen hohem Risiko blockiert.'
        : riskLevel === 'yellow'
          ? 'Manuelle Kontrolle empfohlen, Auszahlung kann mit Freigabe erfolgen.'
          : 'Keine kritischen Risikofaktoren erkannt.',
    },
    {
      id: 'wallet',
      label: 'Wallet',
      status: input.walletReady ? 'passed' : 'waiting',
      detail: input.walletReady
        ? 'Empfaenger-Wallet ist aktiv.'
        : 'Empfaenger-Wallet muss angelegt oder aktiviert werden.',
    },
  ];

  const blockedReasons = gates
    .filter((gate) => gate.status === 'blocked' || gate.status === 'waiting')
    .map((gate) => gate.detail);
  const defaultStatus: PayoutReleaseStatus = blockedReasons.length ? 'blocked' : 'ready';
  const carrierWalletCredit = round(transportLine?.totalNet || input.amount);

  return {
    releaseId: `REL-${new Date().getFullYear()}-${input.orderId.slice(-6).toUpperCase()}`,
    orderId: input.orderId,
    status: input.status || defaultStatus,
    currency: invoice.currency,
    releasedAt: input.releasedAt?.toISOString(),
    blockedReasons,
    settlement: {
      carrierWalletCredit,
      platformRevenueNet: round((platformLine?.totalNet || 0) + (walletLine?.totalNet || 0)),
      shipperChargeGross: invoice.totals.gross,
      vatHandledOnInvoice: true,
    },
    gates,
    walletTransaction: {
      type: 'PAYMENT_IN',
      amount: carrierWalletCredit,
      reference: `settlement_release_${input.orderId}`,
      description: 'Transporterloes nach POD und Rechnungsfreigabe',
    },
    nextStep: {
      label: 'Bankauszahlung',
      description: 'Der Transporteur kann das freigegebene Wallet-Guthaben anschliessend per Stripe/SEPA auszahlen lassen.',
    },
  };
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
