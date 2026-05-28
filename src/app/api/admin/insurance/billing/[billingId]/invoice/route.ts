import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ billingId: string }> | { billingId: string } }
) {
  return withAdminAuth(request, async () => {
    const { billingId } = await params;
    const db = prisma as any;
    const billing = await db.partnerBilling.findUnique({
      where: { id: billingId },
      include: {
        partner: true,
      },
    });

    if (!billing || billing.type !== 'INSURANCE') {
      return NextResponse.json({ error: 'Insurance billing not found' }, { status: 404 });
    }

    return new NextResponse(renderInsuranceBillingInvoice(billing), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }, [AdminRole.ADMIN, AdminRole.FINANCE]);
}

function renderInsuranceBillingInvoice(billing: any) {
  const lineItems = parseLineItems(billing.lineItems);
  const rows = lineItems.map((item, index) => `
    <tr>
      <td>
        <strong>${index + 1}. ${escapeHtml(item.productName || 'Versicherungs-Lead')}</strong><br />
        <span>Lead ${escapeHtml(item.leadId || '-')} · Ref ${escapeHtml(item.externalReference || '-')}</span>
      </td>
      <td>${formatMoney(Number(item.premiumEstimateEur || 0))}</td>
      <td>${formatMoney(Number(item.commissionEstimateEur || 0))}</td>
    </tr>
  `).join('');

  const period = `${String(billing.periodMonth).padStart(2, '0')}/${billing.periodYear}`;

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(billing.invoiceNumber)}</title>
    <style>
      body { margin: 0; background: #eef3f7; color: #06121c; font-family: Inter, Arial, sans-serif; }
      main { max-width: 900px; margin: 40px auto; background: white; padding: 48px; border-radius: 18px; box-shadow: 0 28px 90px rgba(6, 18, 28, 0.14); }
      header { display: flex; justify-content: space-between; gap: 40px; border-bottom: 1px solid #dfe8ef; padding-bottom: 28px; }
      h1 { margin: 0; font-size: 34px; letter-spacing: -0.02em; }
      h2 { margin: 32px 0 12px; font-size: 18px; }
      .muted { color: #607080; }
      .badge { display: inline-flex; margin-top: 12px; padding: 8px 12px; border-radius: 999px; background: #e8f7ff; color: #0b78b6; font-weight: 700; font-size: 12px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 26px; }
      .box { border: 1px solid #e5edf3; border-radius: 14px; padding: 18px; }
      table { width: 100%; border-collapse: collapse; margin-top: 22px; }
      th { text-align: left; font-size: 12px; color: #607080; border-bottom: 1px solid #e5edf3; padding: 12px 10px; }
      td { vertical-align: top; border-bottom: 1px solid #edf2f6; padding: 16px 10px; font-size: 14px; }
      td span { color: #607080; font-size: 12px; line-height: 1.5; }
      td:not(:first-child), th:not(:first-child) { text-align: right; white-space: nowrap; }
      .totals { margin-left: auto; width: 340px; margin-top: 24px; }
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
          <p class="muted">Versicherungs-Provisionsrechnung</p>
          <span class="badge">Technischer Partner-Lead · externer Versicherungsabschluss</span>
        </div>
        <div>
          <strong>${escapeHtml(billing.invoiceNumber)}</strong><br />
          <span class="muted">Zeitraum ${escapeHtml(period)}</span><br />
          <span class="muted">Erstellt ${formatDate(billing.createdAt)}</span><br />
          <span class="muted">Fällig ${formatDate(billing.dueDate)}</span><br />
          <span class="muted">Status ${escapeHtml(billing.status)}</span>
        </div>
      </header>

      <section class="grid">
        <div class="box">
          <strong>Leistungserbringer</strong><br />
          CargoBit Europe<br />
          <span class="muted">Technische Plattform und Lead-Vermittlung</span>
        </div>
        <div class="box">
          <strong>Rechnungsempfänger</strong><br />
          ${escapeHtml(billing.partner?.name || 'Versicherungspartner')}<br />
          <span class="muted">${escapeHtml(billing.partner?.contactEmail || '')}</span>
        </div>
      </section>

      <h2>Positionen</h2>
      <table>
        <thead>
          <tr>
            <th>Lead / Produkt</th>
            <th>Prämie</th>
            <th>CargoBit Provision netto</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="3">Keine Positionen vorhanden.</td></tr>'}</tbody>
      </table>

      <section class="totals">
        <div><span>Provision netto</span><strong>${formatMoney(Number(billing.commissionEur || 0))}</strong></div>
        <div><span>MwSt.</span><strong>${formatMoney(Number(billing.vatEur || 0))}</strong></div>
        <div class="gross"><span>Gesamt</span><strong>${formatMoney(Number(billing.totalEur || 0))}</strong></div>
      </section>

      <section class="notice">
        CargoBit agiert hier als technischer Tippgeber/Partner-Lead. Beratung, Risikoannahme, Police und Schadenbearbeitung erfolgen beim lizenzierten Versicherer oder Makler. Diese Rechnung betrifft ausschliesslich die vereinbarte CargoBit-Provision.
      </section>

      <footer>
        Automatisch erzeugter Beleg. Vor Live-Betrieb bitte rechtliche Pflichtangaben, Steuernummer/USt-IdNr., Adresse und Zahlungsziel finalisieren.
      </footer>
    </main>
  </body>
</html>`;
}

function parseLineItems(value?: string | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function formatDate(value?: string | Date | null) {
  if (!value) return '-';
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
