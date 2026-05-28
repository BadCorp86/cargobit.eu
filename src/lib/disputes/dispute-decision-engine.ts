export type DisputeDecisionAction =
  | 'REFUND_FULL'
  | 'REFUND_PARTIAL'
  | 'REJECT'
  | 'COMPENSATION'
  | 'RESEND'
  | 'MANUAL_REVIEW';

export type DisputeRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type DisputePriority = 'normal' | 'high' | 'urgent';

export interface DisputeDecisionMessageInput {
  message?: string | null;
  senderType?: string | null;
  senderRole?: string | null;
  createdAt?: string | Date | null;
}

export interface DisputeDecisionAttachmentInput {
  fileName?: string | null;
  fileType?: string | null;
  createdAt?: string | Date | null;
}

export interface DisputeDecisionInput {
  id: string;
  jobId?: string | null;
  status?: string | null;
  reason?: string | null;
  subject?: string | null;
  description?: string | null;
  disputedAmountCents?: number | null;
  paymentAmountCents?: number | null;
  refundableAmountCents?: number | null;
  currency?: string | null;
  createdAt?: string | Date | null;
  messages?: DisputeDecisionMessageInput[];
  attachments?: DisputeDecisionAttachmentInput[];
  evidenceUrls?: string[];
}

export interface DisputeDecisionSignal {
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}

export interface DisputeDecisionRecommendation {
  action: DisputeDecisionAction;
  actionLabel: string;
  confidence: number;
  riskLevel: DisputeRiskLevel;
  priority: DisputePriority;
  suggestedRefundAmountCents: number | null;
  maxRefundableAmountCents: number | null;
  currency: string;
  requiresAdminApproval: boolean;
  canAutoResolve: boolean;
  automationMode: 'recommendation_only' | 'eligible_for_auto_close';
  reasons: string[];
  missingEvidence: string[];
  nextSteps: string[];
  signals: DisputeDecisionSignal[];
  resolutionDraft: string;
  generatedAt: string;
}

const DAMAGE_TERMS = [
  'damage',
  'damaged',
  'broken',
  'defekt',
  'beschaedigt',
  'beschadigt',
  'schaden',
  'kaputt',
  'zerbrochen',
];

const LOST_TERMS = ['lost', 'missing', 'verloren', 'nicht angekommen', 'nicht geliefert', 'verschwunden'];
const LATE_TERMS = ['late', 'delay', 'delayed', 'verspaetet', 'verspatet', 'zu spaet', 'termin'];
const WRONG_DELIVERY_TERMS = ['wrong', 'incorrect', 'falsch', 'vertauscht', 'falsche fracht', 'falsche ware'];
const PAYMENT_TERMS = ['billing', 'payment', 'invoice', 'rechnung', 'zahlung', 'doppelt', 'abbuchung'];
const PROOF_TERMS = ['foto', 'photo', 'bild', 'beleg', 'pod', 'proof', 'nachweis', 'cmr', 'lieferschein'];
const FRAUD_TERMS = ['betrug', 'fake', 'illegal', 'polizei', 'anwalt', 'chargeback', 'stolen', 'gestohlen'];

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toCents(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function ageInHours(createdAt?: string | Date | null) {
  if (!createdAt) return 0;
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 360_000) / 10);
}

function amountLabel(amountCents: number | null, currency: string) {
  if (!amountCents) return 'keine Erstattung';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amountCents / 100);
}

function actionLabel(action: DisputeDecisionAction) {
  switch (action) {
    case 'REFUND_FULL':
      return 'Volle Erstattung empfohlen';
    case 'REFUND_PARTIAL':
      return 'Teilerstattung empfohlen';
    case 'COMPENSATION':
      return 'Kulanz / Kompensation empfohlen';
    case 'RESEND':
      return 'Nachlieferung / Ersatzprozess empfohlen';
    case 'REJECT':
      return 'Ablehnung empfohlen';
    default:
      return 'Manuelle Pruefung empfohlen';
  }
}

function buildResolutionDraft(
  action: DisputeDecisionAction,
  amountCents: number | null,
  currency: string,
  reasons: string[]
) {
  const amount = amountLabel(amountCents, currency);
  const reasonText = reasons.slice(0, 2).join(' ');

  if (action === 'REFUND_FULL') {
    return `Empfehlung: volle Erstattung (${amount}), da die vorliegenden Signale fuer einen berechtigten Anspruch sprechen. ${reasonText}`;
  }

  if (action === 'REFUND_PARTIAL' || action === 'COMPENSATION') {
    return `Empfehlung: Teilerstattung/Kompensation (${amount}) nach Admin-Freigabe. ${reasonText}`;
  }

  if (action === 'RESEND') {
    return `Empfehlung: Ersatzlieferung oder erneute Zustellung pruefen. ${reasonText}`;
  }

  if (action === 'REJECT') {
    return `Empfehlung: Streitfall ablehnen, sofern keine weiteren Nachweise eingereicht werden. ${reasonText}`;
  }

  return `Empfehlung: manuelle Pruefung durch Support/Admin fortsetzen. ${reasonText}`;
}

export function createDisputeDecisionRecommendation(
  input: DisputeDecisionInput
): DisputeDecisionRecommendation {
  const messages = input.messages || [];
  const attachments = input.attachments || [];
  const evidenceUrls = input.evidenceUrls || [];
  const currency = input.currency || 'EUR';
  const disputedAmountCents = toCents(input.disputedAmountCents || input.paymentAmountCents);
  const maxRefundableAmountCents = toCents(input.refundableAmountCents || input.paymentAmountCents || disputedAmountCents);
  const allText = [
    input.reason,
    input.subject,
    input.description,
    ...messages.map((message) => message.message),
    ...attachments.map((attachment) => `${attachment.fileName || ''} ${attachment.fileType || ''}`),
    ...evidenceUrls,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const hasAttachments = attachments.length > 0 || evidenceUrls.length > 0;
  const hasProofInText = includesAny(allText, PROOF_TERMS);
  const hasEvidence = hasAttachments || hasProofInText;
  const hasDamage = includesAny(allText, DAMAGE_TERMS);
  const hasLost = includesAny(allText, LOST_TERMS);
  const hasLate = includesAny(allText, LATE_TERMS);
  const hasWrongDelivery = includesAny(allText, WRONG_DELIVERY_TERMS);
  const hasPaymentIssue = includesAny(allText, PAYMENT_TERMS);
  const hasFraudSignal = includesAny(allText, FRAUD_TERMS);
  const messageCount = messages.length;
  const ageHours = ageInHours(input.createdAt);

  const reasons: string[] = [];
  const missingEvidence: string[] = [];
  const nextSteps: string[] = [];
  const signals: DisputeDecisionSignal[] = [];

  if (hasEvidence) {
    reasons.push('Nachweise oder Hinweise auf Nachweise sind vorhanden.');
    signals.push({ label: 'Nachweise', value: hasAttachments ? `${attachments.length} Datei(en)` : 'im Text genannt', tone: 'success' });
  } else {
    missingEvidence.push('Fotos, POD/CMR, Lieferschein oder andere belastbare Nachweise fehlen.');
    signals.push({ label: 'Nachweise', value: 'fehlen', tone: 'warning' });
  }

  if (hasDamage) reasons.push('Der Fall enthaelt Schadenssignale.');
  if (hasLost) reasons.push('Der Fall enthaelt Hinweise auf nicht gelieferte oder verlorene Ware.');
  if (hasLate) reasons.push('Der Fall enthaelt Hinweise auf Verspaetung/SLA-Verletzung.');
  if (hasWrongDelivery) reasons.push('Der Fall enthaelt Hinweise auf falsche Lieferung.');
  if (hasPaymentIssue) reasons.push('Der Fall enthaelt Zahlungs- oder Rechnungsbezug.');
  if (hasFraudSignal) reasons.push('Es gibt Hinweise auf erhoehtes Missbrauchs- oder Rechtsrisiko.');

  signals.push({
    label: 'Streitwert',
    value: amountLabel(disputedAmountCents || maxRefundableAmountCents, currency),
    tone: disputedAmountCents > 100_000 ? 'danger' : disputedAmountCents > 25_000 ? 'warning' : 'neutral',
  });
  signals.push({
    label: 'Alter',
    value: ageHours > 0 ? `${ageHours} h` : 'neu',
    tone: ageHours > 72 ? 'danger' : ageHours > 24 ? 'warning' : 'neutral',
  });
  signals.push({
    label: 'Kommunikation',
    value: `${messageCount} Nachricht(en)`,
    tone: messageCount >= 2 ? 'success' : 'warning',
  });

  let action: DisputeDecisionAction = 'MANUAL_REVIEW';
  let confidence = 58;
  let suggestedRefundAmountCents: number | null = null;

  if ((hasLost || hasWrongDelivery) && hasEvidence) {
    action = 'REFUND_FULL';
    confidence = 86;
    suggestedRefundAmountCents = maxRefundableAmountCents || disputedAmountCents || null;
  } else if ((hasDamage || hasWrongDelivery) && hasEvidence) {
    action = 'REFUND_PARTIAL';
    confidence = 78;
    const basis = maxRefundableAmountCents || disputedAmountCents;
    suggestedRefundAmountCents = basis ? Math.max(2_500, Math.round(basis * 0.5)) : null;
  } else if (hasLate && hasEvidence) {
    action = 'COMPENSATION';
    confidence = 74;
    const basis = maxRefundableAmountCents || disputedAmountCents;
    suggestedRefundAmountCents = basis ? Math.max(1_000, Math.round(basis * 0.15)) : null;
  } else if (hasPaymentIssue && hasEvidence) {
    action = 'MANUAL_REVIEW';
    confidence = 72;
    nextSteps.push('Zahlung, Rechnung, Refund-Historie und Stripe-Status gegenpruefen.');
  } else if (!hasEvidence && (hasDamage || hasLost || hasWrongDelivery)) {
    action = 'MANUAL_REVIEW';
    confidence = 61;
    nextSteps.push('Nachweise beim meldenden Nutzer anfordern, bevor Geld bewegt wird.');
  } else if (!hasEvidence && !hasFraudSignal && disputedAmountCents <= 5_000) {
    action = 'REJECT';
    confidence = 69;
    nextSteps.push('Ablehnung vorbereiten, falls keine Nachweise nachgereicht werden.');
  }

  if (suggestedRefundAmountCents && maxRefundableAmountCents) {
    suggestedRefundAmountCents = Math.min(suggestedRefundAmountCents, maxRefundableAmountCents);
  }

  let riskScore = 0;
  if (hasFraudSignal) riskScore += 40;
  if (!hasEvidence) riskScore += 22;
  if (disputedAmountCents > 100_000) riskScore += 25;
  else if (disputedAmountCents > 25_000) riskScore += 12;
  if (ageHours > 72) riskScore += 10;
  if (action.startsWith('REFUND')) riskScore += 10;
  if (messageCount < 2) riskScore += 8;

  const riskLevel: DisputeRiskLevel =
    riskScore >= 70 ? 'critical' : riskScore >= 45 ? 'high' : riskScore >= 22 ? 'medium' : 'low';

  const priority: DisputePriority =
    riskLevel === 'critical' || ageHours > 72 ? 'urgent' : riskLevel === 'high' || ageHours > 24 ? 'high' : 'normal';

  if (riskLevel === 'high' || riskLevel === 'critical') {
    nextSteps.push('Senior Admin oder Finance-Freigabe einholen.');
  }

  if (action.startsWith('REFUND') || action === 'COMPENSATION') {
    nextSteps.push('Refund erst nach Admin-Freigabe und Stripe/Wallet-Abgleich ausloesen.');
  }

  if (missingEvidence.length > 0) {
    nextSteps.push('Fehlende Nachweise automatisch beim Nutzer anfordern.');
  }

  if (reasons.length === 0) {
    reasons.push('Der Fall enthaelt noch zu wenige klare Signale fuer eine automatische Entscheidung.');
  }

  const canAutoResolve = action === 'REJECT' && riskLevel === 'low' && confidence >= 85 && disputedAmountCents <= 2_500;
  const requiresAdminApproval = !canAutoResolve;

  return {
    action,
    actionLabel: actionLabel(action),
    confidence: clamp(confidence - (riskLevel === 'critical' ? 12 : riskLevel === 'high' ? 6 : 0), 45, 92),
    riskLevel,
    priority,
    suggestedRefundAmountCents,
    maxRefundableAmountCents: maxRefundableAmountCents || null,
    currency,
    requiresAdminApproval,
    canAutoResolve,
    automationMode: canAutoResolve ? 'eligible_for_auto_close' : 'recommendation_only',
    reasons,
    missingEvidence,
    nextSteps: nextSteps.length > 0 ? [...new Set(nextSteps)] : ['Admin prueft Empfehlung und gibt die finale Entscheidung frei.'],
    signals,
    resolutionDraft: buildResolutionDraft(action, suggestedRefundAmountCents, currency, reasons),
    generatedAt: new Date().toISOString(),
  };
}
