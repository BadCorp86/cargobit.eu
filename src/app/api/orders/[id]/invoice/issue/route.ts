import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createOrderInvoiceDraft, type OrderInvoiceDraft } from '@/lib/order-invoice';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const fallbackAmount = Number(body.amount || 850);

  try {
    const transport = await prisma.transport.findUnique({
      where: { id },
      include: {
        shipperUser: true,
        documents: true,
        commissions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!transport && !isDemoOrderId(id)) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Transport not found' },
        { status: 404 },
      );
    }

    if (!transport) {
      return NextResponse.json(await issueFallbackInvoice(id, fallbackAmount));
    }

    const invoice = createOrderInvoiceDraft({
      orderId: id,
      amount: transport.agreedPrice || transport.shipperBudget || fallbackAmount,
      currency: transport.currency,
      planKey: transport.commissions[0]?.plan,
    });
    const documentUrl = `/api/orders/${id}/invoice/document?amount=${invoice.lineItems[0]?.totalNet || fallbackAmount}`;
    const actorId = request.headers.get('x-user-id') || transport.shipperUserId;

    const result = await prisma.$transaction(async (tx) => {
      const existingDocument = transport.documents.find((document) =>
        document.type === 'rechnung' && document.name === `${invoice.invoiceNumber}.html`
      );

      const document = existingDocument || await tx.document.create({
        data: {
          transportId: id,
          type: 'rechnung',
          name: `${invoice.invoiceNumber}.html`,
          description: 'Automatisch ausgestellte CargoBit Rechnung mit MwSt.-Ausweis',
          fileUrl: documentUrl,
          mimeType: 'text/html',
          isGenerated: true,
          createdBy: actorId,
        },
      });

      const emailResult = await sendInvoiceEmail({
        to: transport.shipperUser.email,
        invoice,
        documentUrl,
      });

      const notification = await tx.notification.create({
        data: {
          userId: transport.shipperUserId,
          type: 'INVOICE_ISSUED',
          title: 'Rechnung wurde erstellt',
          message: `Rechnung ${invoice.invoiceNumber} fuer Auftrag ${id} wurde vorbereitet.`,
          data: JSON.stringify({
            orderId: id,
            invoiceNumber: invoice.invoiceNumber,
            documentUrl,
            totalGross: invoice.totals.gross,
            currency: invoice.currency,
          }),
          emailSent: emailResult.success,
          emailSentAt: emailResult.success ? new Date() : undefined,
        },
      });

      return { document, notification, emailResult };
    });

    return NextResponse.json({
      invoice,
      document: result.document,
      notification: result.notification,
      email: result.emailResult,
      source: 'database',
    });
  } catch (error) {
    console.error('[IssueInvoiceAPI] Failed:', error);
    return NextResponse.json(await issueFallbackInvoice(id, fallbackAmount, 'Database unavailable, using invoice issue fallback'));
  }
}

async function issueFallbackInvoice(orderId: string, amount: number, warning?: string) {
  const invoice = createOrderInvoiceDraft({
    orderId,
    amount,
    currency: 'EUR',
    planKey: 'STARTER',
  });
  const documentUrl = `/api/orders/${orderId}/invoice/document?amount=${amount}`;
  const email = await sendInvoiceEmail({
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

async function sendInvoiceEmail(input: {
  to: string;
  invoice: OrderInvoiceDraft;
  documentUrl: string;
}) {
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

function isDemoOrderId(orderId: string) {
  return orderId.startsWith('mission_demo') || orderId.startsWith('demo') || orderId.startsWith('TR-');
}

function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value);
}
