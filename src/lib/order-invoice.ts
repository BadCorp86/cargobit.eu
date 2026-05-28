import { calculateBookingFees } from '@/services/fee.service';
import { getBillingPlan } from '@/lib/billing/plans';

export interface InvoiceLineItem {
  label: string;
  description?: string;
  quantity: number;
  unitNet: number;
  totalNet: number;
  vatRate: number;
  vatAmount: number;
  totalGross: number;
}

export interface OrderInvoiceDraft {
  invoiceNumber: string;
  orderId: string;
  currency: string;
  issuedAt: string;
  dueAt: string;
  lineItems: InvoiceLineItem[];
  totals: {
    net: number;
    vat: number;
    gross: number;
  };
  payment: {
    protectedByWallet: boolean;
    payoutAfterPod: boolean;
    payoutRiskGate: boolean;
  };
}

export function createOrderInvoiceDraft(input: {
  orderId: string;
  amount: number;
  currency?: string | null;
  planKey?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  vatRate?: number;
  issuedAt?: Date;
}): OrderInvoiceDraft {
  const issuedAt = input.issuedAt || new Date();
  const dueAt = new Date(issuedAt);
  dueAt.setDate(dueAt.getDate() + 14);

  const plan = getBillingPlan(input.planKey || 'FREE');
  const quote = calculateBookingFees(input.amount, plan, input.currency || 'EUR');
  const vatRate = input.vatRate ?? 19;

  const lineItems = [
    createLineItem({
      label: 'Transportleistung',
      description: 'Netto Transportpreis laut angenommenem Angebot',
      amount: quote.grossAmount,
      vatRate,
    }),
    createLineItem({
      label: 'CargoBit Plattformgebuehr',
      description: `${quote.commissionPercent}% Provision fuer Matching, Trust und Abwicklung`,
      amount: quote.commissionAmount,
      vatRate,
    }),
    createLineItem({
      label: 'Wallet-/Zahlungsschutz',
      description: `${quote.walletFeePercent}% fuer Zahlungsabsicherung und Settlement`,
      amount: quote.walletFeeAmount,
      vatRate,
    }),
  ];

  const totals = lineItems.reduce(
    (sum, item) => ({
      net: round(sum.net + item.totalNet),
      vat: round(sum.vat + item.vatAmount),
      gross: round(sum.gross + item.totalGross),
    }),
    { net: 0, vat: 0, gross: 0 },
  );

  return {
    invoiceNumber: `CB-${issuedAt.getFullYear()}-${input.orderId.slice(-6).toUpperCase()}`,
    orderId: input.orderId,
    currency: quote.currency,
    issuedAt: issuedAt.toISOString(),
    dueAt: dueAt.toISOString(),
    lineItems,
    totals,
    payment: {
      protectedByWallet: true,
      payoutAfterPod: true,
      payoutRiskGate: true,
    },
  };
}

function createLineItem(input: {
  label: string;
  description: string;
  amount: number;
  vatRate: number;
}): InvoiceLineItem {
  const totalNet = round(input.amount);
  const vatAmount = round(totalNet * (input.vatRate / 100));
  return {
    label: input.label,
    description: input.description,
    quantity: 1,
    unitNet: totalNet,
    totalNet,
    vatRate: input.vatRate,
    vatAmount,
    totalGross: round(totalNet + vatAmount),
  };
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
