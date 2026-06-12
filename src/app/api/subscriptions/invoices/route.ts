import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRequestUser } from '@/lib/request-user-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRequestUser(request);
  if (auth.response) return auth.response;
  const userId = auth.user!.id;

  try {
    const companyUser = await db.companyUser.findFirst({
      where: { userId },
      select: { companyId: true },
    });

    if (!companyUser) {
      return NextResponse.json({
        success: true,
        invoices: [],
        source: 'database',
      });
    }

    const invoices = await db.subscriptionInvoice.findMany({
      where: { companyId: companyUser.companyId },
      orderBy: [
        { issuedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 24,
    });

    return NextResponse.json({
      success: true,
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        stripeInvoiceId: invoice.stripeInvoiceId,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        currency: invoice.currency,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        amountDue: invoice.amountDue,
        hostedInvoiceUrl: invoice.hostedInvoiceUrl,
        invoicePdfUrl: invoice.invoicePdfUrl,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        issuedAt: invoice.issuedAt,
        dueAt: invoice.dueAt,
        paidAt: invoice.paidAt,
        emailRecipient: invoice.emailRecipient,
        emailSent: invoice.emailSent,
        emailSentAt: invoice.emailSentAt,
        emailProvider: invoice.emailProvider,
        emailError: invoice.emailError,
      })),
      source: 'database',
    });
  } catch (error) {
    console.error('[SubscriptionInvoices] Failed to fetch invoices:', error);

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        success: true,
        invoices: createDemoInvoices(),
        source: 'development_fallback',
      });
    }

    return NextResponse.json(
      {
        error: 'InternalServerError',
        message: 'Business-Rechnungen konnten nicht geladen werden.',
        code: 'SUBSCRIPTION_INVOICES_FAILED',
      },
      { status: 500 },
    );
  }
}

function createDemoInvoices() {
  const now = new Date();
  const previous = new Date(now);
  previous.setMonth(previous.getMonth() - 1);

  return [
    {
      id: 'demo-sub-invoice-current',
      stripeInvoiceId: 'in_demo_current',
      invoiceNumber: `CB-SUB-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      status: 'paid',
      currency: 'EUR',
      subtotal: 89,
      tax: 16.91,
      total: 105.91,
      amountPaid: 105.91,
      amountDue: 0,
      hostedInvoiceUrl: null,
      invoicePdfUrl: null,
      periodStart: previous.toISOString(),
      periodEnd: now.toISOString(),
      issuedAt: now.toISOString(),
      dueAt: now.toISOString(),
      paidAt: now.toISOString(),
      emailRecipient: 'billing@demo-company.eu',
      emailSent: true,
      emailSentAt: now.toISOString(),
      emailProvider: 'dev-log',
      emailError: null,
    },
    {
      id: 'demo-sub-invoice-previous',
      stripeInvoiceId: 'in_demo_previous',
      invoiceNumber: `CB-SUB-${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`,
      status: 'paid',
      currency: 'EUR',
      subtotal: 89,
      tax: 16.91,
      total: 105.91,
      amountPaid: 105.91,
      amountDue: 0,
      hostedInvoiceUrl: null,
      invoicePdfUrl: null,
      periodStart: new Date(previous.getFullYear(), previous.getMonth() - 1, previous.getDate()).toISOString(),
      periodEnd: previous.toISOString(),
      issuedAt: previous.toISOString(),
      dueAt: previous.toISOString(),
      paidAt: previous.toISOString(),
      emailRecipient: 'billing@demo-company.eu',
      emailSent: true,
      emailSentAt: previous.toISOString(),
      emailProvider: 'dev-log',
      emailError: null,
    },
  ];
}
