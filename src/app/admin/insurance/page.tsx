'use client';

import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/admin-layout';
import { StatusBadge } from '@/components/admin/status-badge';

interface InsuranceAdminData {
  mode: string;
  complianceNotice: string;
  stats: {
    partners: number;
    activeProducts: number;
    leads: number;
    openLeads?: number;
    redirectedLeads: number;
    convertedLeads?: number;
    estimatedCommissionEur: number;
    earnedCommissionEur?: number;
    pendingCommissionEur?: number;
    paidCommissionEur?: number;
    policies: number;
  };
  partners: Array<{
    id: string;
    name: string;
    status: string;
    website?: string;
    contactEmail?: string;
    contactPerson?: string | null;
    contactPhone?: string | null;
    country?: string | null;
    webhookUrl?: string | null;
    testMode?: boolean;
    commissionRate: number;
    liveModeEnabled: boolean;
    contractUrl?: string | null;
    complianceDocs?: string[];
    approvedAt?: string | null;
    apiKeys?: Array<{
      id: string;
      name: string;
      apiKeyPrefix: string;
      scopes: string[];
      status: string;
      isTestKey: boolean;
      lastUsedAt?: string | null;
      expiresAt?: string | null;
      createdAt: string;
    }>;
    products: Array<{
      id: string;
      name: string;
      coverageEur: number;
      deductibleEur?: number;
      basePremiumEur: number;
      premiumType?: string;
      coversDamage?: boolean;
      coversTheft?: boolean;
      coversDelay?: boolean;
      coversHazmat?: boolean;
      isActive: boolean;
    }>;
  }>;
  leads: Array<{
    id: string;
    providerName: string;
    productName: string;
    requestedByRole: string;
    source: string;
    status: string;
    transportId?: string | null;
    premiumEstimateEur: number;
    coverageEstimateEur: number;
    commissionEstimateEur: number;
    commissionStatus?: string;
    commissionInvoiceReference?: string | null;
    commissionSettledAt?: string | null;
    referralUrl?: string;
    externalReference?: string | null;
    cargoValueEur?: number | null;
    validUntil?: string;
    redirectedAt?: string | null;
    convertedAt?: string | null;
    events?: Array<{
      id: string;
      actorType: string;
      actorId?: string | null;
      eventType: string;
      oldStatus?: string | null;
      newStatus?: string | null;
      externalReference?: string | null;
      premiumEur?: number | null;
      commissionEur?: number | null;
      metadata?: Record<string, unknown> | null;
      createdAt: string;
    }>;
    createdAt: string;
  }>;
}

interface InsuranceCommissionReport {
  period: {
    month: string;
    label: string;
    start: string;
    end: string;
  };
  totals: {
    leadCount: number;
    convertedCount: number;
    invoicedCount: number;
    paidCount: number;
    grossPremiumEur: number;
    commissionEur: number;
    openCommissionEur: number;
    paidCommissionEur: number;
  };
  partners: Array<{
    partnerId: string;
    partnerName: string;
    contactEmail?: string | null;
    commissionRate?: number | null;
    leadCount: number;
    convertedCount: number;
    invoicedCount: number;
    paidCount: number;
    grossPremiumEur: number;
    commissionEur: number;
    openCommissionEur: number;
    paidCommissionEur: number;
  }>;
  leads: Array<{
    id: string;
    partnerId?: string | null;
    partnerName: string;
    providerName: string;
    productName: string;
    status: string;
    commissionStatus: string;
    premiumEstimateEur: number;
    coverageEstimateEur: number;
    commissionEstimateEur: number;
    commissionInvoiceReference?: string | null;
    externalReference?: string | null;
    createdAt: string;
    convertedAt?: string | null;
    commissionSettledAt?: string | null;
  }>;
}

interface InsuranceBillingData {
  month: string;
  summary: {
    totalInvoices: number;
    openInvoices: number;
    paidInvoices: number;
    totalOpenAmount: number;
    totalPaidAmount: number;
  };
  billings: Array<{
    id: string;
    invoiceNumber: string;
    periodMonth: number;
    periodYear: number;
    grossAmountEur: number;
    commissionEur: number;
    netAmountEur: number;
    vatEur: number;
    totalEur: number;
    status: string;
    paidAt?: string | null;
    paymentMethod?: string | null;
    paymentReference?: string | null;
    invoiceUrl?: string | null;
    dueDate?: string | null;
    createdAt?: string | null;
    partner?: {
      id: string;
      name: string;
      contactEmail: string;
      commissionRate: number;
    } | null;
    lineItems: Array<{
      leadId?: string;
      productName?: string;
      premiumEstimateEur?: number;
      commissionEstimateEur?: number;
      externalReference?: string | null;
    }>;
  }>;
}

const initialForm = {
  providerName: 'Allianz Partner Lead',
  contactEmail: 'partner@allianz.example',
  website: 'https://www.allianz.de/business/transportversicherung/',
  webhookUrl: '',
  contractUrl: '',
  complianceDocs: '',
  productName: 'Cargo Damage Protection',
  coverageEur: '100000',
  deductibleEur: '0',
  basePremiumEur: '24.90',
  commissionRate: '12',
};

interface PartnerDraft {
  providerName: string;
  contactEmail: string;
  website: string;
  webhookUrl: string;
  contractUrl: string;
  complianceDocs: string;
  status: string;
  commissionRate: string;
  liveModeEnabled: boolean;
  productName: string;
  coverageEur: string;
  deductibleEur: string;
  basePremiumEur: string;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value || 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    lead_created: 'Lead erstellt',
    lead_redirected: 'Partner-Link geöffnet',
    lead_converted: 'Konvertiert',
    lead_declined: 'Abgelehnt',
    lead_expired: 'Abgelaufen',
    commission_earned: 'Provision verdient',
    commission_invoiced: 'Provision fakturiert',
    commission_paid: 'Provision bezahlt',
    commission_void: 'Provision storniert',
  };

  return labels[eventType] || eventType.replace(/_/g, ' ');
}

function buildPartnerDraft(partner: InsuranceAdminData['partners'][number]): PartnerDraft {
  const firstProduct = partner.products[0];

  return {
    providerName: partner.name || '',
    contactEmail: partner.contactEmail || '',
    website: partner.website || '',
    webhookUrl: partner.webhookUrl || '',
    contractUrl: partner.contractUrl || '',
    complianceDocs: (partner.complianceDocs || []).join(', '),
    status: partner.status || 'PENDING',
    commissionRate: String(partner.commissionRate ?? 12),
    liveModeEnabled: Boolean(partner.liveModeEnabled),
    productName: firstProduct?.name || 'Cargo Damage Protection',
    coverageEur: String(firstProduct?.coverageEur ?? 100000),
    deductibleEur: String(firstProduct?.deductibleEur ?? 0),
    basePremiumEur: String(firstProduct?.basePremiumEur ?? 24.9),
  };
}

export default function AdminInsurancePage() {
  const [data, setData] = useState<InsuranceAdminData | null>(null);
  const [commissionReport, setCommissionReport] = useState<InsuranceCommissionReport | null>(null);
  const [billingData, setBillingData] = useState<InsuranceBillingData | null>(null);
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingBilling, setGeneratingBilling] = useState(false);
  const [updatingLead, setUpdatingLead] = useState<string | null>(null);
  const [updatingCommission, setUpdatingCommission] = useState<string | null>(null);
  const [updatingBilling, setUpdatingBilling] = useState<string | null>(null);
  const [updatingPartner, setUpdatingPartner] = useState<string | null>(null);
  const [partnerDrafts, setPartnerDrafts] = useState<Record<string, PartnerDraft>>({});
  const [generatedKey, setGeneratedKey] = useState<{
    partnerId: string;
    apiKey: string;
    apiKeyPrefix: string;
    name: string;
    isTestKey: boolean;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);

  const loadInsurance = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/insurance');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Insurance setup unavailable');
      setData(payload);
      setPartnerDrafts(Object.fromEntries(
        (payload.partners || []).map((partner: InsuranceAdminData['partners'][number]) => [
          partner.id,
          buildPartnerDraft(partner),
        ])
      ));
    } catch (error) {
      console.error('[AdminInsurance] load error:', error);
      setMessage(error instanceof Error ? error.message : 'Versicherungsdaten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const loadCommissionReport = async () => {
    setLoadingReport(true);

    try {
      const response = await fetch(`/api/admin/insurance/commission-report?month=${encodeURIComponent(reportMonth)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Provisionsabrechnung konnte nicht geladen werden.');
      setCommissionReport(payload);
    } catch (error) {
      console.error('[AdminInsurance] commission report load error:', error);
      setMessage(error instanceof Error ? error.message : 'Provisionsabrechnung konnte nicht geladen werden.');
    } finally {
      setLoadingReport(false);
    }
  };

  const loadBilling = async () => {
    setLoadingBilling(true);

    try {
      const response = await fetch(`/api/admin/insurance/billing?month=${encodeURIComponent(reportMonth)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Versicherungsabrechnungen konnten nicht geladen werden.');
      setBillingData(payload);
    } catch (error) {
      console.error('[AdminInsurance] billing load error:', error);
      setMessage(error instanceof Error ? error.message : 'Versicherungsabrechnungen konnten nicht geladen werden.');
    } finally {
      setLoadingBilling(false);
    }
  };

  useEffect(() => {
    loadInsurance();
  }, []);

  useEffect(() => {
    loadCommissionReport();
    loadBilling();
  }, [reportMonth]);

  const saveProvider = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          coverageEur: Number(form.coverageEur),
          deductibleEur: Number(form.deductibleEur),
          basePremiumEur: Number(form.basePremiumEur),
          commissionRate: Number(form.commissionRate),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Provider konnte nicht gespeichert werden.');
      setMessage('Versicherungspartner wurde als technischer Lead-Partner angelegt.');
      await Promise.all([loadInsurance(), loadCommissionReport(), loadBilling()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Provider konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const updatePartnerDraft = (partnerId: string, key: keyof PartnerDraft, value: string | boolean) => {
    setPartnerDrafts((current) => ({
      ...current,
      [partnerId]: {
        ...(current[partnerId] || {}),
        [key]: value,
      } as PartnerDraft,
    }));
  };

  const savePartnerConfig = async (partnerId: string) => {
    const draft = partnerDrafts[partnerId];
    if (!draft) return;

    setUpdatingPartner(partnerId);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/insurance/partners/${partnerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: draft.providerName,
          contactEmail: draft.contactEmail,
          website: draft.website,
          webhookUrl: draft.webhookUrl,
          contractUrl: draft.contractUrl,
          complianceDocs: draft.complianceDocs,
          status: draft.status,
          commissionRate: Number(draft.commissionRate),
          liveModeEnabled: draft.liveModeEnabled,
          product: {
            name: draft.productName,
            coverageEur: Number(draft.coverageEur),
            deductibleEur: Number(draft.deductibleEur),
            basePremiumEur: Number(draft.basePremiumEur),
            premiumType: 'percentage',
            isActive: true,
          },
          note: 'Insurance partner configuration updated from admin dashboard.',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Partner-Konfiguration konnte nicht gespeichert werden.');
      setMessage('Versicherungspartner-Konfiguration wurde gespeichert.');
      await Promise.all([loadInsurance(), loadCommissionReport(), loadBilling()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Partner-Konfiguration konnte nicht gespeichert werden.');
    } finally {
      setUpdatingPartner(null);
    }
  };

  const createPartnerApiKey = async (partnerId: string, isTestKey = true) => {
    setUpdatingPartner(`${partnerId}:api-key`);
    setGeneratedKey(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/insurance/partners/${partnerId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isTestKey,
          name: isTestKey ? 'Insurance Test API Key' : 'Insurance Live API Key',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'API-Key konnte nicht erzeugt werden.');
      setGeneratedKey({
        partnerId,
        apiKey: payload.apiKey,
        apiKeyPrefix: payload.apiKeyPrefix,
        name: payload.name,
        isTestKey: payload.isTestKey,
      });
      setMessage('Partner API-Key wurde erzeugt. Der Klartext-Key wird nur einmal angezeigt.');
      await loadInsurance();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'API-Key konnte nicht erzeugt werden.');
    } finally {
      setUpdatingPartner(null);
    }
  };

  const updateLeadStatus = async (
    lead: InsuranceAdminData['leads'][number],
    status: 'REDIRECTED' | 'CONVERTED' | 'DECLINED' | 'EXPIRED'
  ) => {
    setUpdatingLead(`${lead.id}:${status}`);
    setMessage(null);

    try {
      const externalReference = status === 'CONVERTED'
        ? window.prompt('Externe Policen-/Partnerreferenz eintragen (optional):') || undefined
        : undefined;
      const response = await fetch(`/api/admin/insurance/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          externalReference,
          note: 'Status im Admin Insurance Dashboard aktualisiert.',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Lead konnte nicht aktualisiert werden.');
      setMessage(`Lead ${lead.id} wurde auf ${status} gesetzt.`);
      await Promise.all([loadInsurance(), loadCommissionReport(), loadBilling()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Lead konnte nicht aktualisiert werden.');
    } finally {
      setUpdatingLead(null);
    }
  };

  const updateLeadCommission = async (
    lead: InsuranceAdminData['leads'][number],
    commissionStatus: 'INVOICED' | 'PAID' | 'VOID'
  ) => {
    setUpdatingCommission(`${lead.id}:${commissionStatus}`);
    setMessage(null);

    try {
      const invoiceReference = commissionStatus === 'INVOICED'
        ? window.prompt('Rechnungs-/Abrechnungsreferenz eintragen (optional):') || undefined
        : undefined;
      const response = await fetch(`/api/admin/insurance/leads/${lead.id}/commission`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commissionStatus,
          invoiceReference,
          note: 'Provision im Admin Insurance Dashboard aktualisiert.',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Provision konnte nicht aktualisiert werden.');
      setMessage(`Provision für Lead ${lead.id} wurde auf ${commissionStatus} gesetzt.`);
      await Promise.all([loadInsurance(), loadCommissionReport(), loadBilling()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Provision konnte nicht aktualisiert werden.');
    } finally {
      setUpdatingCommission(null);
    }
  };

  const generateMonthlyBilling = async () => {
    setGeneratingBilling(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/insurance/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: reportMonth,
          vatRate: 0.19,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Partnerabrechnung konnte nicht erzeugt werden.');
      setMessage(
        payload.generated?.length
          ? `${payload.generated.length} Versicherungsabrechnung(en) wurden erzeugt.`
          : 'Keine neuen abrechenbaren Versicherungsprovisionen gefunden.'
      );
      await Promise.all([loadInsurance(), loadCommissionReport(), loadBilling()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Partnerabrechnung konnte nicht erzeugt werden.');
    } finally {
      setGeneratingBilling(false);
    }
  };

  const updateBillingStatus = async (
    billing: InsuranceBillingData['billings'][number],
    status: 'OPEN' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  ) => {
    setUpdatingBilling(`${billing.id}:${status}`);
    setMessage(null);

    try {
      const paymentReference = status === 'PAID'
        ? window.prompt('Zahlungsreferenz eintragen (optional):') || undefined
        : undefined;
      const response = await fetch(`/api/admin/insurance/billing/${billing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          paymentMethod: status === 'PAID' ? 'bank_transfer' : undefined,
          paymentReference,
          note: 'Versicherungsabrechnung im Admin Dashboard aktualisiert.',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Abrechnung konnte nicht aktualisiert werden.');
      setMessage(`Abrechnung ${billing.invoiceNumber} wurde auf ${status} gesetzt.`);
      await Promise.all([loadInsurance(), loadCommissionReport(), loadBilling()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Abrechnung konnte nicht aktualisiert werden.');
    } finally {
      setUpdatingBilling(null);
    }
  };

  const openReferral = async (lead: InsuranceAdminData['leads'][number]) => {
    if (lead.referralUrl) {
      window.open(lead.referralUrl, '_blank', 'noopener,noreferrer');
    }

    if (lead.status === 'LEAD_CREATED') {
      await updateLeadStatus(lead, 'REDIRECTED');
    }
  };

  const commissionCsvUrl = `/api/admin/insurance/commission-report?month=${encodeURIComponent(reportMonth)}&format=csv`;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Versicherungen
            </h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Partner-Leads, Provisionen und externe Transportversicherungen
            </p>
          </div>
          <StatusBadge status={data?.mode === 'partner_lead' ? 'active' : 'pending'} size="lg" />
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-500/20 dark:bg-blue-950/30 dark:text-blue-100">
          {data?.complianceNotice || 'CargoBit agiert derzeit nur als technischer Tippgeber/Partner-Lead. Der Abschluss erfolgt extern beim lizenzierten Versicherer oder Makler.'}
        </div>

        {message && (
          <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-3 text-sm text-cyan-900 dark:border-cyan-500/20 dark:bg-cyan-950/30 dark:text-cyan-100">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            ['Partner', data?.stats.partners || 0],
            ['Produkte', data?.stats.activeProducts || 0],
            ['Leads', data?.stats.leads || 0],
            ['Offen', data?.stats.openLeads || 0],
            ['Weiterleitungen', data?.stats.redirectedLeads || 0],
            ['Konvertiert', data?.stats.convertedLeads || 0],
            ['Provision offen', formatMoney(data?.stats.pendingCommissionEur || 0)],
            ['Provision bezahlt', formatMoney(data?.stats.paidCommissionEur || 0)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow dark:border-gray-700 dark:bg-gray-800">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Partner einbinden
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Erstellt einen Versicherungsanbieter als externen Lead-Partner.
            </p>

            <div className="mt-5 space-y-3">
              {[
                ['providerName', 'Anbieter'],
                ['contactEmail', 'Kontakt E-Mail'],
                ['website', 'Externe Abschluss-URL'],
                ['webhookUrl', 'Partner Webhook URL'],
                ['contractUrl', 'Vertrags-/Maklervertrag URL'],
                ['complianceDocs', 'Compliance Docs URLs'],
                ['productName', 'Produktname'],
                ['coverageEur', 'Deckung EUR'],
                ['deductibleEur', 'Selbstbehalt EUR'],
                ['basePremiumEur', 'Mindestprämie EUR'],
                ['commissionRate', 'CargoBit Provision %'],
              ].map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  />
                </label>
              ))}

              <button
                onClick={saveProvider}
                disabled={saving}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Speichern...' : 'Partner speichern'}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-5 shadow dark:border-cyan-500/20 dark:bg-cyan-950/20">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Partner API Integration
              </h2>
              <p className="mt-1 text-sm text-cyan-900 dark:text-cyan-100">
                Versicherer/Makler können Leads mit dem Partner API-Key abrufen und Statusupdates zurückmelden.
              </p>
              <div className="mt-4 space-y-2 text-xs text-cyan-950 dark:text-cyan-50">
                <code className="block rounded-lg bg-white px-3 py-2 dark:bg-gray-950">
                  GET /api/partner/insurance/leads
                </code>
                <code className="block rounded-lg bg-white px-3 py-2 dark:bg-gray-950">
                  GET /api/partner/insurance/leads/{'{leadId}'}
                </code>
                <code className="block rounded-lg bg-white px-3 py-2 dark:bg-gray-950">
                  PATCH /api/partner/insurance/leads/{'{leadId}'}
                </code>
                <code className="block rounded-lg bg-white px-3 py-2 dark:bg-gray-950">
                  POST /api/webhook/insurance/lead
                </code>
              </div>
              <p className="mt-3 text-xs text-cyan-800 dark:text-cyan-200">
                Header: <span className="font-mono">x-api-key</span>. Scope: <span className="font-mono">insurance:read</span> / <span className="font-mono">insurance:write</span>.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Monatliche Provisionsabrechnung
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Abrechnung von verdienten, fakturierten und bezahlten Versicherungs-Provisionen.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(event) => setReportMonth(event.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  />
                  <a
                    href={commissionCsvUrl}
                    className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                  >
                    CSV exportieren
                  </a>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Leads', commissionReport?.totals.leadCount || 0],
                  ['Provision gesamt', formatMoney(commissionReport?.totals.commissionEur || 0)],
                  ['Offen', formatMoney(commissionReport?.totals.openCommissionEur || 0)],
                  ['Bezahlt', formatMoney(commissionReport?.totals.paidCommissionEur || 0)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {loadingReport ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Lade Provisionsabrechnung...</p>
                ) : commissionReport?.partners.length ? (
                  commissionReport.partners.map((partner) => (
                    <div key={partner.partnerId} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{partner.partnerName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {partner.contactEmail || 'Kein Kontakt'} · {partner.commissionRate ?? '-'}% Provision
                          </p>
                        </div>
                        <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200">
                          {commissionReport.period.label}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-4">
                        <span>{partner.leadCount} Leads</span>
                        <span>{partner.convertedCount} konvertiert</span>
                        <span>Offen: {formatMoney(partner.openCommissionEur)}</span>
                        <span>Bezahlt: {formatMoney(partner.paidCommissionEur)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Für diesen Monat gibt es noch keine abrechenbaren Versicherungs-Provisionen.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Partner-Rechnungen
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Erzeugt offene Monatsabrechnungen und markiert eingegangene Provisionen als bezahlt.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={generateMonthlyBilling}
                  disabled={generatingBilling}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {generatingBilling ? 'Erzeuge...' : 'Abrechnung erzeugen'}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Rechnungen', billingData?.summary.totalInvoices || 0],
                  ['Offen', billingData?.summary.openInvoices || 0],
                  ['Offener Betrag', formatMoney(billingData?.summary.totalOpenAmount || 0)],
                  ['Bezahlt', formatMoney(billingData?.summary.totalPaidAmount || 0)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {loadingBilling ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Lade Partner-Rechnungen...</p>
                ) : billingData?.billings.length ? (
                  billingData.billings.map((billing) => (
                    <div key={billing.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {billing.invoiceNumber}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {billing.partner?.name || 'Versicherungspartner'} · Fällig: {formatDateTime(billing.dueDate)}
                          </p>
                        </div>
                        <StatusBadge status={billing.status.toLowerCase()} size="sm" />
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-4">
                        <span>Netto Provision: {formatMoney(billing.commissionEur)}</span>
                        <span>MwSt: {formatMoney(billing.vatEur)}</span>
                        <span>Gesamt: {formatMoney(billing.totalEur)}</span>
                        <span>{billing.lineItems.length} Lead-Positionen</span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <a
                          href={`/api/admin/insurance/billing/${billing.id}/invoice`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-950/30"
                        >
                          Rechnung öffnen
                        </a>
                        <button
                          type="button"
                          onClick={() => updateBillingStatus(billing, 'PAID')}
                          disabled={Boolean(updatingBilling) || billing.status === 'PAID'}
                          className="rounded-lg border border-green-500/30 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-50 dark:text-green-200 dark:hover:bg-green-950/30"
                        >
                          {updatingBilling === `${billing.id}:PAID` ? 'Speichert...' : 'Als bezahlt markieren'}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBillingStatus(billing, 'OVERDUE')}
                          disabled={Boolean(updatingBilling) || billing.status === 'PAID' || billing.status === 'OVERDUE'}
                          className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50 dark:text-amber-200 dark:hover:bg-amber-950/30"
                        >
                          Überfällig
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBillingStatus(billing, 'CANCELLED')}
                          disabled={Boolean(updatingBilling) || billing.status === 'PAID' || billing.status === 'CANCELLED'}
                          className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-200 dark:hover:bg-red-950/30"
                        >
                          Stornieren
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Für diesen Monat wurde noch keine Partner-Rechnung erzeugt.
                  </p>
                )}
              </div>
            </div>

            {generatedKey && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-semibold">
                  Neuer {generatedKey.isTestKey ? 'Test' : 'Live'} API-Key für Partner
                </p>
                <p className="mt-1 text-xs">
                  Nur einmal sichtbar. Danach wird nur noch der Prefix gespeichert.
                </p>
                <code className="mt-3 block overflow-x-auto rounded-lg bg-white p-3 text-xs text-gray-900 dark:bg-gray-950 dark:text-amber-100">
                  {generatedKey.apiKey}
                </code>
              </div>
            )}

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Aktive Versicherungs-Partner
              </h2>
              <div className="mt-4 space-y-3">
                {loading ? (
                  <p className="text-sm text-gray-500">Lade Versicherungsdaten...</p>
                ) : data?.partners.length ? (
                  data.partners.map((partner) => (
                    <div key={partner.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{partner.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{partner.contactEmail}</p>
                        </div>
                        <StatusBadge status={partner.status.toLowerCase()} size="sm" />
                      </div>
                      {partnerDrafts[partner.id] && (
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            {[
                              ['providerName', 'Anbieter'],
                              ['contactEmail', 'Kontakt E-Mail'],
                              ['website', 'Abschluss-URL'],
                              ['webhookUrl', 'Webhook URL'],
                              ['contractUrl', 'Vertrags-URL'],
                              ['complianceDocs', 'Compliance Docs'],
                              ['productName', 'Produkt'],
                              ['coverageEur', 'Deckung EUR'],
                              ['deductibleEur', 'Selbstbehalt EUR'],
                              ['basePremiumEur', 'Mindestprämie EUR'],
                              ['commissionRate', 'Provision %'],
                            ].map(([key, label]) => (
                              <label key={key} className="block">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                                <input
                                  value={String(partnerDrafts[partner.id][key as keyof PartnerDraft] ?? '')}
                                  onChange={(event) => updatePartnerDraft(partner.id, key as keyof PartnerDraft, event.target.value)}
                                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                                />
                              </label>
                            ))}
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <label className="block">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</span>
                              <select
                                value={partnerDrafts[partner.id].status}
                                onChange={(event) => updatePartnerDraft(partner.id, 'status', event.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                              >
                                <option value="PENDING">PENDING</option>
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="SUSPENDED">SUSPENDED</option>
                                <option value="REJECTED">REJECTED</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-3 text-sm dark:border-gray-700">
                              <input
                                type="checkbox"
                                checked={partnerDrafts[partner.id].liveModeEnabled}
                                onChange={(event) => updatePartnerDraft(partner.id, 'liveModeEnabled', event.target.checked)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <span className="font-medium text-gray-700 dark:text-gray-200">Live-Modus</span>
                            </label>
                            <div className="rounded-lg border border-gray-200 px-3 py-3 text-sm dark:border-gray-700">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Vertrag</p>
                              <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                                {partner.contractUrl ? 'Hinterlegt' : 'Offen'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-3">
                        <span>Provision: {partner.commissionRate}%</span>
                        <span>Produkte: {partner.products.length}</span>
                        <span>{partner.liveModeEnabled ? 'Live aktiv' : 'Testmodus'}</span>
                      </div>
                      <div className="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          API Keys
                        </p>
                        {partner.apiKeys?.length ? (
                          <div className="mt-2 space-y-2">
                            {partner.apiKeys.map((apiKey) => (
                              <div key={apiKey.id} className="flex items-center justify-between gap-3 text-xs">
                                <code className="rounded bg-white px-2 py-1 dark:bg-gray-800">
                                  {apiKey.apiKeyPrefix}
                                </code>
                                <span className="text-gray-500 dark:text-gray-400">
                                  {apiKey.isTestKey ? 'Test' : 'Live'} · {apiKey.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Noch kein Partner-API-Key erzeugt.
                          </p>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => savePartnerConfig(partner.id)}
                          disabled={Boolean(updatingPartner)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                        >
                          {updatingPartner === partner.id ? 'Speichert...' : 'Konfiguration speichern'}
                        </button>
                        <button
                          type="button"
                          onClick={() => createPartnerApiKey(partner.id, true)}
                          disabled={Boolean(updatingPartner)}
                          className="rounded-lg border border-cyan-500/30 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50 dark:text-cyan-200 dark:hover:bg-cyan-950/30"
                        >
                          Test API-Key erzeugen
                        </button>
                        <button
                          type="button"
                          onClick={() => createPartnerApiKey(partner.id, false)}
                          disabled={Boolean(updatingPartner) || !partner.liveModeEnabled}
                          className="rounded-lg border border-green-500/30 px-3 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-50 dark:text-green-200 dark:hover:bg-green-950/30"
                        >
                          Live API-Key erzeugen
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Noch keine Partner angelegt.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Neueste Leads
              </h2>
              <div className="mt-4 space-y-3">
                {data?.leads.length ? (
                  data.leads.slice(0, 8).map((lead) => (
                    <div key={lead.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{lead.providerName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {lead.requestedByRole} · {lead.source} · {new Date(lead.createdAt).toLocaleString('de-DE')}
                          </p>
                          {lead.externalReference && (
                            <p className="mt-1 font-mono text-xs text-cyan-600 dark:text-cyan-300">
                              Ref: {lead.externalReference}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={lead.status.toLowerCase()} size="sm" />
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-3">
                        <span>Prämie: {formatMoney(lead.premiumEstimateEur)}</span>
                        <span>Deckung: {formatMoney(lead.coverageEstimateEur)}</span>
                        <span>Provision: {formatMoney(lead.commissionEstimateEur)}</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-3">
                        <span>Provision Status: {lead.commissionStatus || 'PENDING'}</span>
                        <span>Abrechnung: {lead.commissionInvoiceReference || '-'}</span>
                        <span>Bezahlt: {formatDateTime(lead.commissionSettledAt)}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openReferral(lead)}
                          disabled={!lead.referralUrl || Boolean(updatingLead)}
                          className="rounded-lg border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-200 dark:hover:bg-blue-950/40"
                        >
                          Extern öffnen
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLeadStatus(lead, 'CONVERTED')}
                          disabled={Boolean(updatingLead) || lead.status === 'CONVERTED'}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                        >
                          {updatingLead === `${lead.id}:CONVERTED` ? 'Speichert...' : 'Konvertiert'}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLeadStatus(lead, 'DECLINED')}
                          disabled={Boolean(updatingLead) || lead.status === 'DECLINED'}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                        >
                          Ablehnen
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLeadStatus(lead, 'EXPIRED')}
                          disabled={Boolean(updatingLead) || lead.status === 'EXPIRED'}
                          className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-600 disabled:opacity-50"
                        >
                          Abgelaufen
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLeadCommission(lead, 'INVOICED')}
                          disabled={Boolean(updatingCommission) || lead.commissionStatus === 'INVOICED' || lead.commissionStatus === 'PAID'}
                          className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50 dark:text-amber-200 dark:hover:bg-amber-950/30"
                        >
                          {updatingCommission === `${lead.id}:INVOICED` ? 'Speichert...' : 'Provision fakturieren'}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateLeadCommission(lead, 'PAID')}
                          disabled={Boolean(updatingCommission) || lead.commissionStatus === 'PAID'}
                          className="rounded-lg border border-green-500/30 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-50 dark:text-green-200 dark:hover:bg-green-950/30"
                        >
                          {updatingCommission === `${lead.id}:PAID` ? 'Speichert...' : 'Provision bezahlt'}
                        </button>
                      </div>
                      {lead.events?.length ? (
                        <div className="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Lead Timeline
                          </p>
                          <div className="mt-3 space-y-3">
                            {lead.events.slice(0, 5).map((event) => (
                              <div key={event.id} className="border-l-2 border-cyan-500/40 pl-3">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {getEventLabel(event.eventType)}
                                  </p>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatDateTime(event.createdAt)}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {event.actorType} · {event.oldStatus || '-'} → {event.newStatus || '-'}
                                </p>
                                {(event.externalReference || event.commissionEur) && (
                                  <p className="mt-1 text-xs text-cyan-700 dark:text-cyan-300">
                                    {event.externalReference ? `Ref: ${event.externalReference}` : ''}
                                    {event.commissionEur ? ` Provision: ${formatMoney(event.commissionEur)}` : ''}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Noch keine Versicherungs-Leads vorhanden.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
