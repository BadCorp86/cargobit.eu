import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createOrderInvoiceDraft, type OrderInvoiceDraft } from '@/lib/order-invoice';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const fallbackAmount = Number(searchParams.get('amount') || 850);

  try {
    const transport = await prisma.transport.findUnique({
      where: { id },
      include: {
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

    const invoice = createOrderInvoiceDraft({
      orderId: id,
      amount: transport?.agreedPrice || transport?.shipperBudget || fallbackAmount,
      currency: transport?.currency || 'EUR',
      planKey: transport?.commissions[0]?.plan,
    });

    return htmlResponse(renderInvoiceDocument(invoice));
  } catch (error) {
    console.error('[OrderInvoiceDocumentAPI] Failed:', error);

    const invoice = createOrderInvoiceDraft({
      orderId: id,
      amount: fallbackAmount,
      currency: 'EUR',
      planKey: 'STARTER',
    });

    return htmlResponse(renderInvoiceDocument(invoice, 'Demo/Fallback Rechnung'));
  }
}

function htmlResponse(html: string) {
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function renderInvoiceDocument(invoice: OrderInvoiceDraft, label = 'CargoBit Rechnung') {
  const rows = invoice.lineItems.map((item) => `
    <tr>
      <td>
        <strong>${escapeHtml(item.label)}</strong><br />
        <span>${escapeHtml(item.description || '')}</span>
      </td>
      <td>${formatMoney(item.totalNet, invoice.currency)}</td>
      <td>${item.vatRate}%</td>
      <td>${formatMoney(item.vatAmount, invoice.currency)}</td>
      <td>${formatMoney(item.totalGross, invoice.currency)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(invoice.invoiceNumber)}</title>
    <style>
      body { margin: 0; background: #f3f6f8; color: #0b1720; font-family: Inter, Arial, sans-serif; }
      main { max-width: 860px; margin: 40px auto; background: white; padding: 48px; border-radius: 18px; box-shadow: 0 24px 80px rgba(6, 18, 28, 0.12); }
      header { display: flex; justify-content: space-between; gap: 32px; border-bottom: 1px solid #e5edf3; padding-bottom: 28px; }
      h1 { margin: 0; font-size: 34px; letter-spacing: -0.02em; }
      h2 { margin: 32px 0 12px; font-size: 18px; }
      .muted { color: #607080; }
      .badge { display: inline-flex; margin-top: 12px; padding: 8px 12px; border-radius: 999px; background: #e8f7ff; color: #0b78b6; font-weight: 700; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 22px; }
      th { text-align: left; font-size: 12px; color: #607080; border-bottom: 1px solid #e5edf3; padding: 12px 10px; }
      td { vertical-align: top; border-bottom: 1px solid #edf2f6; padding: 16px 10px; font-size: 14px; }
      td span { color: #607080; font-size: 12px; line-height: 1.5; }
      td:not(:first-child), th:not(:first-child) { text-align: right; white-space: nowrap; }
      .totals { margin-left: auto; width: 320px; margin-top: 24px; }
      .totals div { display: flex; justify-content: space-between; padding: 8px 0; }
      .totals .gross { margin-top: 8px; border-top: 1px solid #d8e3eb; padding-top: 16px; font-size: 20px; font-weight: 800; }
      .notice { margin-top: 28px; padding: 16px; border-radius: 14px; background: #effcf4; color: #21623f; font-size: 13px; line-height: 1.6; }
      footer { margin-top: 40px; color: #8795a1; font-size: 12px; }
      @media print { body { background: white; } main { margin: 0; box-shadow: none; border-radius: 0; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>CargoBit</h1>
          <p class="muted">${escapeHtml(label)}</p>
          <span class="badge">Wallet geschützt · POD Gate aktiv</span>
        </div>
        <div>
          <strong>${escapeHtml(invoice.invoiceNumber)}</strong><br />
          <span class="muted">Auftrag ${escapeHtml(invoice.orderId)}</span><br />
          <span class="muted">Datum ${formatDate(invoice.issuedAt)}</span><br />
          <span class="muted">Fällig ${formatDate(invoice.dueAt)}</span>
        </div>
      </header>

      <h2>Positionen</h2>
      <table>
        <thead>
          <tr>
            <th>Leistung</th>
            <th>Netto</th>
            <th>MwSt.</th>
            <th>MwSt. Betrag</th>
            <th>Brutto</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <section class="totals">
        <div><span>Netto</span><strong>${formatMoney(invoice.totals.net, invoice.currency)}</strong></div>
        <div><span>MwSt.</span><strong>${formatMoney(invoice.totals.vat, invoice.currency)}</strong></div>
        <div class="gross"><span>Gesamt</span><strong>${formatMoney(invoice.totals.gross, invoice.currency)}</strong></div>
      </section>

      <section class="notice">
        Auszahlung wird erst nach POD/eCMR-Prüfung und Risk Gate freigegeben. Plattformgebühr und Wallet-/Zahlungsschutz sind separat ausgewiesen.
      </section>

      <footer>
        CargoBit Europe · Automatisch erstellter Rechnungsentwurf · Bitte steuerliche Pflichtangaben vor Live-Betrieb finalisieren.
      </footer>
    </main>
  </body>
</html>`;
}

function isDemoOrderId(orderId: string) {
  return orderId.startsWith('mission_demo') || orderId.startsWith('demo') || orderId.startsWith('TR-');
}

function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date(value));
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
