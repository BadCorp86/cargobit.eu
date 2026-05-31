import { prisma } from '@/lib/db';
import { createOrderInvoiceDraft, type OrderInvoiceDraft } from '@/lib/order-invoice';

interface IssueOrderInvoiceInput {
  orderId: string;
  amount?: number;
  actorId?: string | null;
  sendEmail?: boolean;
  allowFallback?: boolean;
  warning?: string;
}

interface InvoiceEmailInput {
  to: string;
  invoice: OrderInvoiceDraft;
  documentUrl: string;
}

export interface InvoiceEmailResult {
  success: boolean;
  provider: 'sendgrid' | 'dev-log' | 'skipped';
  messageId?: string;
  error?: string;
}

export async function issueOrderInvoice(input: IssueOrderInvoiceInput) {
  const fallbackAmount = Number(input.amount || 850);

  const transport = await prisma.transport.findUnique({
    where: { id: input.orderId },
    include: {
      shipperUser: true,
      documents: true,
      commissions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!transport && !isDemoOrderId(input.orderId)) {
    return null;
  }

  if (!transport) {
    if (input.allowFallback === false) return null;
    return issueFallbackOrderInvoice(input.orderId, fallbackAmount, input.warning);
  }

  const invoice = createOrderInvoiceDraft({
    orderId: input.orderId,
    amount: transport.agreedPrice || transport.shipperBudget || fallbackAmount,
    currency: transport.currency,
    planKey: transport.commissions[0]?.plan,
  });
  const documentUrl = buildOrderInvoiceDocumentUrl(input.orderId, invoice, fallbackAmount);
  const actorId = input.actorId || transport.shipperUserId;
  const existingDocument = transport.documents.find((document) =>
    document.type === 'rechnung' && document.name === `${invoice.invoiceNumber}.html`
  );

  const document = existingDocument || await prisma.document.create({
    data: {
      transportId: input.orderId,
      type: 'rechnung',
      name: `${invoice.invoiceNumber}.html`,
      description: 'Automatisch ausgestellte CargoBit Rechnung mit MwSt.-Ausweis',
      fileUrl: documentUrl,
      mimeType: 'text/html',
      isGenerated: true,
      createdBy: actorId,
    },
  });

  const shouldSendEmail = input.sendEmail !== false && !existingDocument;
  const emailResult = shouldSendEmail
    ? await sendOrderInvoiceEmail({
        to: transport.shipperUser.email,
        invoice,
        documentUrl,
      })
    : createSkippedEmailResult(existingDocument ? 'invoice-existing' : 'email-disabled');

  const notification = existingDocument
    ? null
    : await prisma.notification.create({
        data: {
          userId: transport.shipperUserId,
          type: 'INVOICE_ISSUED',
          title: 'Rechnung wurde erstellt',
          message: `Rechnung ${invoice.invoiceNumber} fuer Auftrag ${input.orderId} wurde vorbereitet.`,
          data: JSON.stringify({
            orderId: input.orderId,
            invoiceNumber: invoice.invoiceNumber,
            documentUrl,
            totalGross: invoice.totals.gross,
            currency: invoice.currency,
          }),
          emailSent: emailResult.success,
          emailSentAt: emailResult.success && emailResult.provider !== 'skipped' ? new Date() : undefined,
        },
      });

  return {
    invoice,
    document,
    notification,
    email: emailResult,
    source: 'database',
  };
}

export async function issueFallbackOrderInvoice(orderId: string, amount: number, warning?: string) {
  const invoice = createOrderInvoiceDraft({
    orderId,
    amount,
    currency: 'EUR',
    planKey: 'STARTER',
  });
  const documentUrl = `/api/orders/${orderId}/invoice/document?amount=${amount}`;
  const email = await sendOrderInvoiceEmail({
    to: 'shipper@cargobit.eu',
    invoice,
    documentUrl,
  });

  return {
    invoice,
    document: {
      id: `demo-document-${invoice.invoiceNumber}`,
      transportId: orderId,
      type: 'rechnung',
      name: `${invoice.invoiceNumber}.html`,
      fileUrl: documentUrl,
      isGenerated: true,
    },
    notification: {
      id: `demo-notification-${invoice.invoiceNumber}`,
      type: 'INVOICE_ISSUED',
      title: 'Rechnung wurde erstellt',
      message: `Rechnung ${invoice.invoiceNumber} wurde vorbereitet.`,
      emailSent: email.success,
    },
    email,
    source: 'fallback',
    warning,
  };
}

export async function sendOrderInvoiceEmail(input: InvoiceEmailInput): Promise<InvoiceEmailResult> {
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@cargobit.eu';
  const fromName = process.env.SENDGRID_FROM_NAME || 'CargoBit';
  const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3001';
  const documentHref = input.documentUrl.startsWith('http')
    ? input.documentUrl
    : `${publicBaseUrl.startsWith('http') ? publicBaseUrl : `https://${publicBaseUrl}`}${input.documentUrl}`;
  const subject = `CargoBit Rechnung ${input.invoice.invoiceNumber}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:auto;color:#06121C">
      <h1 style="margin-bottom:8px">Ihre CargoBit Rechnung</h1>
      <p>Die Rechnung <strong>${input.invoice.invoiceNumber}</strong> fuer Auftrag <strong>${input.invoice.orderId}</strong> wurde erstellt.</p>
      <p>Gesamtbetrag: <strong>${formatMoney(input.invoice.totals.gross, input.invoice.currency)}</strong></p>
      <p>Netto, MwSt., Plattformgebuehr und Wallet-/Zahlungsschutz sind einzeln ausgewiesen.</p>
      <p><a href="${documentHref}" style="display:inline-block;background:#1C7ED6;color:white;padding:12px 18px;border-radius:10px;text-decoration:none">Rechnung oeffnen</a></p>
      <p style="color:#667; font-size:12px">Auszahlung erfolgt nach POD/eCMR-Pruefung und Risk Gate.</p>
    </div>
  `;

  if (!process.env.SENDGRID_API_KEY) {
    console.log('[InvoiceEmail] DEV email would be sent:', {
      to: input.to,
      subject,
      documentHref,
    });
    return {
      success: true,
      provider: 'dev-log',
      messageId: `dev-invoice-${Date.now()}`,
    };
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [
        {
          type: 'text/html',
          value: html,
        },
      ],
    }),
  });

  return {
    success: response.ok,
    provider: 'sendgrid',
    messageId: response.headers.get('x-message-id') || undefined,
    error: response.ok ? undefined : await response.text(),
  };
}

export function hasIssuedOrderInvoice(documents: Array<{ type: string }>) {
  return documents.some((document) => document.type === 'rechnung');
}

export function isDemoOrderId(orderId: string) {
  return orderId.startsWith('mission_demo') || orderId.startsWith('demo') || orderId.startsWith('TR-');
}

export function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value);
}

function buildOrderInvoiceDocumentUrl(orderId: string, invoice: OrderInvoiceDraft, fallbackAmount: number) {
  return `/api/orders/${orderId}/invoice/document?amount=${invoice.lineItems[0]?.totalNet || fallbackAmount}`;
}

function createSkippedEmailResult(messageId: string): InvoiceEmailResult {
  return {
    success: true,
    provider: 'skipped',
    messageId,
  };
}
