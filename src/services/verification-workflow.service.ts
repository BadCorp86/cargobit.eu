import { db } from '@/lib/db';
import {
  resolveVerificationCostPolicy,
  type VerificationCostPolicy,
} from '@/services/verification-cost-policy.service';
import {
  validateEuVatNumber,
  type ViesValidationResult,
} from '@/services/verification/vies.service';
import type { DocumentOcrExtraction } from '@/services/verification/ocr.service';

export type VerificationRole =
  | 'SHIPPER_PRIVATE'
  | 'SHIPPER_COMPANY'
  | 'CARRIER'
  | 'DISPATCHER'
  | 'DRIVER_SELF_EMPLOYED'
  | 'ADMIN'
  | 'SUPPORT'
  | 'MARKETER';

export type SubmittedDocumentType =
  | 'ID_CARD'
  | 'PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'DRIVER_CARD'
  | 'COMMERCIAL_REGISTER_EXTRACT'
  | 'BUSINESS_REGISTRATION'
  | 'VAT_CERTIFICATE'
  | 'BENEFICIAL_OWNERS_DECLARATION'
  | 'TRANSPORT_LICENSE'
  | 'FLEET_INSURANCE'
  | 'CMR_INSURANCE'
  | 'VEHICLE_REGISTRATION'
  | 'ADR_CERTIFICATE'
  | 'PROOF_OF_ADDRESS'
  | 'AUTHORIZATION_LETTER';

export type VerificationRecordType = 'KYC' | 'KYB' | 'DRIVER_LICENSE' | 'ADR' | 'VEHICLE';
export type VerificationDecision = 'auto_approved' | 'manual_review' | 'rejected';

export interface SubmittedVerificationDocument {
  type: SubmittedDocumentType | string;
  documentUrl: string;
  fileBase64?: string;
  name?: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  issuingCountry?: string;
  mimeType?: string;
  fileSize?: number;
  ocr?: DocumentOcrExtraction;
}

export interface VerificationCapabilities {
  ownerDrives?: boolean;
  international?: boolean;
  hazardousGoods?: boolean;
  requiresAdr?: boolean;
}

export interface VerificationSubmission {
  userId: string;
  role: VerificationRole;
  country?: string;
  companyId?: string;
  companyType?: 'SHIPPER' | 'CARRIER' | 'BOTH';
  vatNumber?: string;
  highRisk?: boolean;
  estimatedOrderValueCents?: number;
  documents: SubmittedVerificationDocument[];
  capabilities?: VerificationCapabilities;
  persist?: boolean;
}

export interface VerificationRequirement {
  id: string;
  label: string;
  verificationType: VerificationRecordType;
  acceptedTypes: SubmittedDocumentType[];
  required: boolean;
  manualReviewHint?: string;
}

interface DocumentAssessment {
  document: SubmittedVerificationDocument;
  score: number;
  valid: boolean;
  reasons: string[];
}

export type VerificationRegistryCheck = ViesValidationResult;

export interface VerificationWorkflowResult {
  decision: VerificationDecision;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  score: number;
  providerMode: 'metadata-rules';
  costPolicy: VerificationCostPolicy;
  registryChecks: VerificationRegistryCheck[];
  requiresManualReview: boolean;
  requirements: VerificationRequirement[];
  missingRequirements: VerificationRequirement[];
  documentAssessments: DocumentAssessment[];
  manualReviewReasons: string[];
  createdVerificationIds: string[];
  supportTicketId?: string;
}

const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR',
  'GR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO',
  'SE', 'SI', 'SK',
]);

const ID_REQUIREMENT: VerificationRequirement = {
  id: 'identity_document',
  label: 'Identitätsdokument',
  verificationType: 'KYC',
  acceptedTypes: ['ID_CARD', 'PASSPORT', 'DRIVERS_LICENSE'],
  required: true,
};

export function getVerificationRequirements(input: {
  role: VerificationRole;
  country?: string;
  companyType?: VerificationSubmission['companyType'];
  capabilities?: VerificationCapabilities;
}): VerificationRequirement[] {
  const country = (input.country || 'DE').toUpperCase();
  const vatRequired = EU_COUNTRIES.has(country);
  const capabilities = input.capabilities || {};

  const businessBase: VerificationRequirement[] = [
    ID_REQUIREMENT,
    {
      id: 'business_registration',
      label: country === 'DE' ? 'Gewerbeschein oder Handelsregisterauszug' : 'Gewerbe-/Registerauszug des Landes',
      verificationType: 'KYB',
      acceptedTypes: ['COMMERCIAL_REGISTER_EXTRACT', 'BUSINESS_REGISTRATION'],
      required: true,
      manualReviewHint: 'Unternehmensdokumente koennen je nach Land manuelle Kontrolle benoetigen.',
    },
    {
      id: 'vat_certificate',
      label: 'USt-IdNr. / Steuerregistrierung',
      verificationType: 'KYB',
      acceptedTypes: ['VAT_CERTIFICATE'],
      required: vatRequired,
    },
    {
      id: 'beneficial_owners',
      label: 'Wirtschaftlich Berechtigte',
      verificationType: 'KYB',
      acceptedTypes: ['BENEFICIAL_OWNERS_DECLARATION'],
      required: true,
      manualReviewHint: 'Eigentuemerstruktur wird bei Firmen manuell plausibilisiert, wenn sie nicht eindeutig ist.',
    },
  ];

  const carrierBase: VerificationRequirement[] = [
    ...businessBase,
    {
      id: 'transport_license',
      label: 'Transport-/Güterkraftverkehrslizenz',
      verificationType: 'KYB',
      acceptedTypes: ['TRANSPORT_LICENSE'],
      required: true,
    },
    {
      id: 'fleet_insurance',
      label: 'Betriebs-, Fracht- oder Flottenversicherung',
      verificationType: 'VEHICLE',
      acceptedTypes: ['FLEET_INSURANCE', 'CMR_INSURANCE'],
      required: true,
    },
    {
      id: 'vehicle_registration',
      label: 'Fahrzeugschein / Zulassungsbescheinigung',
      verificationType: 'VEHICLE',
      acceptedTypes: ['VEHICLE_REGISTRATION'],
      required: true,
    },
  ];

  if (capabilities.ownerDrives) {
    carrierBase.push(
      {
        id: 'driver_license',
        label: 'Führerschein passend zur Fahrzeugklasse',
        verificationType: 'DRIVER_LICENSE',
        acceptedTypes: ['DRIVERS_LICENSE'],
        required: true,
      },
      {
        id: 'driver_card',
        label: 'Fahrerkarte',
        verificationType: 'DRIVER_LICENSE',
        acceptedTypes: ['DRIVER_CARD'],
        required: Boolean(capabilities.international),
      },
    );
  }

  if (capabilities.hazardousGoods || capabilities.requiresAdr) {
    carrierBase.push({
      id: 'adr_certificate',
      label: 'ADR-Zertifikat',
      verificationType: 'ADR',
      acceptedTypes: ['ADR_CERTIFICATE'],
      required: true,
    });
  }

  switch (input.role) {
    case 'SHIPPER_PRIVATE':
      return [ID_REQUIREMENT];
    case 'SHIPPER_COMPANY':
      return businessBase;
    case 'CARRIER':
      return carrierBase;
    case 'DRIVER_SELF_EMPLOYED':
      return getVerificationRequirements({
        ...input,
        role: 'CARRIER',
        capabilities: { ...capabilities, ownerDrives: true },
        companyType: 'CARRIER',
      });
    case 'DISPATCHER':
      return [
        ID_REQUIREMENT,
        {
          id: 'company_authorization',
          label: 'Berechtigung der Spedition',
          verificationType: 'KYB',
          acceptedTypes: ['AUTHORIZATION_LETTER'],
          required: false,
        },
      ];
    case 'ADMIN':
    case 'SUPPORT':
    case 'MARKETER':
    default:
      return [ID_REQUIREMENT];
  }
}

export async function processVerificationSubmission(
  submission: VerificationSubmission,
): Promise<VerificationWorkflowResult> {
  const result = evaluateVerificationSubmission(submission);
  const registryChecks = await runLowCostRegistryChecks(submission);
  applyRegistryChecks(result, registryChecks);

  if (submission.persist === false) {
    return result;
  }

  const createdVerificationIds = await persistVerificationRecords(submission, result);
  result.createdVerificationIds = createdVerificationIds;

  if (result.requiresManualReview) {
    result.supportTicketId = await createManualReviewTicket(submission, result);
  }

  await createVerificationNotification(submission, result);
  await createVerificationAuditLog(submission, result);

  return result;
}

export function evaluateVerificationSubmission(
  submission: VerificationSubmission,
): VerificationWorkflowResult {
  const requirements = getVerificationRequirements(submission);
  const costPolicy = resolveVerificationCostPolicy({
    role: submission.role,
    country: submission.country,
    hasVatNumber: Boolean(submission.vatNumber),
    highRisk: submission.highRisk,
    estimatedOrderValueCents: submission.estimatedOrderValueCents,
  });
  const submittedDocuments = submission.documents || [];
  const documentAssessments = submittedDocuments.map(assessDocument);
  const missingRequirements = requirements.filter((requirement) => {
    if (!requirement.required) return false;
    return !submittedDocuments.some((document) =>
      requirement.acceptedTypes.includes(document.type as SubmittedDocumentType),
    );
  });

  const manualReviewReasons = [
    ...missingRequirements.map((requirement) => `Fehlend: ${requirement.label}`),
    ...documentAssessments.flatMap((assessment) => assessment.reasons),
    ...(costPolicy.shouldUsePaidProvider ? [costPolicy.paidProviderReason || 'Externe Verifizierung empfohlen.'] : []),
  ];

  const hasKyb = requirements.some((requirement) => requirement.verificationType === 'KYB' && requirement.required);
  const averageScore = documentAssessments.length
    ? Math.round(documentAssessments.reduce((sum, item) => sum + item.score, 0) / documentAssessments.length)
    : 0;

  const highConfidence = averageScore >= (hasKyb ? 92 : 86);
  const allDocumentsValid = documentAssessments.every((assessment) => assessment.valid);
  const canAutoApprove = missingRequirements.length === 0 && allDocumentsValid && highConfidence;

  const decision: VerificationDecision = canAutoApprove
    ? 'auto_approved'
    : manualReviewReasons.some((reason) => reason.includes('abgelaufen') || reason.includes('unbekannter'))
      ? 'manual_review'
      : 'manual_review';

  return {
    decision,
    status: decision === 'auto_approved' ? 'APPROVED' : decision === 'rejected' ? 'REJECTED' : 'PENDING',
    score: averageScore,
    providerMode: 'metadata-rules',
    costPolicy,
    registryChecks: [],
    requiresManualReview: decision !== 'auto_approved',
    requirements,
    missingRequirements,
    documentAssessments,
    manualReviewReasons: manualReviewReasons.length
      ? manualReviewReasons
      : canAutoApprove
        ? []
        : ['Automatische Prüfung konnte keine ausreichende Sicherheit herstellen.'],
    createdVerificationIds: [],
  };
}

async function runLowCostRegistryChecks(
  submission: VerificationSubmission,
): Promise<VerificationRegistryCheck[]> {
  const checks: VerificationRegistryCheck[] = [];

  if (
    submission.vatNumber &&
    ['SHIPPER_COMPANY', 'CARRIER', 'DRIVER_SELF_EMPLOYED'].includes(submission.role)
  ) {
    checks.push(await validateEuVatNumber({
      country: submission.country || 'DE',
      vatNumber: submission.vatNumber,
    }));
  }

  return checks;
}

function applyRegistryChecks(
  result: VerificationWorkflowResult,
  registryChecks: VerificationRegistryCheck[],
) {
  result.registryChecks = registryChecks;

  const blockingReasons = registryChecks
    .filter((check) => check.status === 'failed' || check.status === 'unavailable')
    .map((check) => `${check.provider.toUpperCase()}: ${check.message}`);

  if (blockingReasons.length === 0) {
    return;
  }

  result.manualReviewReasons = [...result.manualReviewReasons, ...blockingReasons];
  result.requiresManualReview = true;
  result.decision = 'manual_review';
  result.status = 'PENDING';
}

function assessDocument(document: SubmittedVerificationDocument): DocumentAssessment {
  const reasons: string[] = [];
  const knownType = isKnownDocumentType(document.type);
  const hasValidUrl = isValidDocumentUrl(document.documentUrl);
  let score = knownType ? 70 : 35;

  if (!knownType) {
    reasons.push(`Dokumenttyp unbekannter oder nicht unterstützter Typ: ${document.type}`);
  }

  if (!hasValidUrl) {
    reasons.push(`Dokument ${document.type} hat keine gültige Datei-URL`);
    score -= 35;
  }

  if (document.documentNumber) score += 8;
  if (document.ocr?.extractedFields.documentNumbers.length && !document.documentNumber) score += 5;
  if (document.issueDate) score += 7;
  if (document.issuingCountry) score += 5;
  if (document.mimeType?.includes('pdf') || document.mimeType?.startsWith('image/')) score += 5;

  const expiryDate = document.expiryDate || document.ocr?.extractedFields.expiryDate;
  if (expiryDate) {
    const expiry = new Date(expiryDate);
    if (!Number.isNaN(expiry.getTime()) && expiry < new Date()) {
      reasons.push(`Dokument ${document.type} ist abgelaufen`);
      score = Math.min(score, 35);
    } else {
      score += 5;
    }
  }

  if (document.ocr) {
    if (document.ocr.status === 'completed') {
      score += document.ocr.confidence && document.ocr.confidence >= 80 ? 8 : 4;
    }

    if (document.ocr.status === 'partial') {
      reasons.push(`OCR fuer ${document.type} hat nur Teilinformationen erkannt`);
    }

    if (document.ocr.status === 'failed') {
      reasons.push(`OCR fuer ${document.type} ist fehlgeschlagen: ${document.ocr.error || 'unbekannter Fehler'}`);
    }

    for (const warning of document.ocr.warnings) {
      reasons.push(`OCR-Hinweis fuer ${document.type}: ${warning}`);
    }
  }

  score = Math.max(0, Math.min(98, Math.round(score)));

  if (score < 80 && reasons.length === 0) {
    reasons.push(`Dokument ${document.type} hat zu geringe automatische Prüfsicherheit`);
  }

  return {
    document,
    score,
    valid: hasValidUrl && knownType && score >= 70,
    reasons,
  };
}

async function persistVerificationRecords(
  submission: VerificationSubmission,
  result: VerificationWorkflowResult,
): Promise<string[]> {
  const createdIds: string[] = [];
  const requirementsByType = new Map<VerificationRecordType, VerificationRequirement[]>();

  for (const requirement of result.requirements.filter((item) => item.required)) {
    const existing = requirementsByType.get(requirement.verificationType) || [];
    existing.push(requirement);
    requirementsByType.set(requirement.verificationType, existing);
  }

  for (const [verificationType, requirements] of requirementsByType.entries()) {
    const matchingDocument = submission.documents.find((document) =>
      requirements.some((requirement) => requirement.acceptedTypes.includes(document.type as SubmittedDocumentType)),
    );
    const documentType = matchingDocument?.type || requirements.map((requirement) => requirement.id).join(',');

    const verification = await db.verification.create({
      data: {
        userId: submission.userId,
        type: verificationType,
        status: result.status,
        documentUrl: matchingDocument?.documentUrl,
        documentType,
        rejectionReason: result.requiresManualReview ? result.manualReviewReasons.join('\n') : undefined,
        reviewData: JSON.stringify(buildVerificationReviewData(submission, result, matchingDocument)),
        reviewedAt: result.status === 'APPROVED' ? new Date() : undefined,
      },
    });

    createdIds.push(verification.id);
  }

  return createdIds;
}

async function createManualReviewTicket(
  submission: VerificationSubmission,
  result: VerificationWorkflowResult,
): Promise<string> {
  const openTicket = await db.supportTicket.findFirst({
    where: {
      userId: submission.userId,
      category: 'VERIFICATION',
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  const description = buildManualReviewDescription(submission, result);

  if (openTicket) {
    await db.supportMessage.create({
      data: {
        ticketId: openTicket.id,
        senderId: 'system',
        senderRole: 'SYSTEM',
        message: description,
        isInternal: true,
      },
    });

    return openTicket.id;
  }

  const ticket = await db.supportTicket.create({
    data: {
      userId: submission.userId,
      subject: `Manuelle Verifizierung erforderlich: ${roleLabel(submission.role)}`,
      description,
      priority: result.missingRequirements.length > 0 ? 'HIGH' : 'NORMAL',
      status: 'OPEN',
      category: 'VERIFICATION',
    },
  });

  await db.supportMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: 'system',
      senderRole: 'SYSTEM',
      message: description,
      isInternal: true,
    },
  });

  return ticket.id;
}

async function createVerificationNotification(
  submission: VerificationSubmission,
  result: VerificationWorkflowResult,
) {
  await db.notification.create({
    data: {
      userId: submission.userId,
      type: result.status === 'APPROVED' ? 'VERIFICATION_APPROVED' : 'VERIFICATION_MANUAL_REVIEW',
      title: result.status === 'APPROVED' ? 'Verifizierung abgeschlossen' : 'Verifizierung wird geprüft',
      message: result.status === 'APPROVED'
        ? 'Ihre Dokumente wurden automatisch geprüft und freigegeben.'
        : 'Ihre Dokumente wurden erfasst. Unser Team prüft offene Punkte manuell.',
      data: JSON.stringify({
        decision: result.decision,
        score: result.score,
        supportTicketId: result.supportTicketId,
        missing: result.missingRequirements.map((item) => item.id),
      }),
    },
  });
}

async function createVerificationAuditLog(
  submission: VerificationSubmission,
  result: VerificationWorkflowResult,
) {
  await db.auditLog.create({
    data: {
      userId: submission.userId,
      action: 'CREATE',
      entityType: 'verification_workflow',
      entityId: result.supportTicketId || result.createdVerificationIds[0] || submission.userId,
      dataAfter: JSON.stringify({
        role: submission.role,
        country: submission.country || 'DE',
        decision: result.decision,
        status: result.status,
        score: result.score,
        supportTicketId: result.supportTicketId,
      }),
    },
  });
}

function buildManualReviewDescription(
  submission: VerificationSubmission,
  result: VerificationWorkflowResult,
) {
  const missing = result.missingRequirements.map((item) => `- ${item.label} (${item.acceptedTypes.join(' oder ')})`);
  const reasons = result.manualReviewReasons.map((reason) => `- ${reason}`);

  return [
    `Rolle: ${roleLabel(submission.role)}`,
    `Land: ${(submission.country || 'DE').toUpperCase()}`,
    `Prüfmodus: ${result.providerMode}`,
    `Kostenmodus: ${result.costPolicy.recommendedMode}`,
    `Score: ${result.score}`,
    '',
    'Register-/Provider-Pruefungen:',
    result.registryChecks.length
      ? result.registryChecks.map((check) => `- ${check.provider}: ${check.status} (${check.message})`).join('\n')
      : '- keine',
    '',
    'OCR-Ergebnisse:',
    buildOcrSummary(submission),
    '',
    'Fehlende Unterlagen:',
    missing.length ? missing.join('\n') : '- keine',
    '',
    'Prüfhinweise:',
    reasons.length ? reasons.join('\n') : '- keine',
  ].join('\n');
}

function buildVerificationReviewData(
  submission: VerificationSubmission,
  result: VerificationWorkflowResult,
  matchingDocument?: SubmittedVerificationDocument,
) {
  return {
    decision: result.decision,
    status: result.status,
    score: result.score,
    providerMode: result.providerMode,
    costPolicy: {
      mode: result.costPolicy.recommendedMode,
      shouldUsePaidProvider: result.costPolicy.shouldUsePaidProvider,
      paidProviderReason: result.costPolicy.paidProviderReason,
      options: result.costPolicy.options,
    },
    registryChecks: result.registryChecks,
    manualReviewReasons: result.manualReviewReasons,
    missingRequirements: result.missingRequirements.map((requirement) => ({
      id: requirement.id,
      label: requirement.label,
      verificationType: requirement.verificationType,
    })),
    primaryDocument: matchingDocument ? sanitizeReviewDocument(matchingDocument) : null,
    documents: submission.documents.map(sanitizeReviewDocument),
  };
}

function sanitizeReviewDocument(document: SubmittedVerificationDocument) {
  return {
    type: document.type,
    documentUrl: document.documentUrl,
    name: document.name,
    documentNumber: document.documentNumber,
    issueDate: document.issueDate,
    expiryDate: document.expiryDate,
    issuingCountry: document.issuingCountry,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    ocr: document.ocr ? {
      status: document.ocr.status,
      source: document.ocr.source,
      confidence: document.ocr.confidence,
      warnings: document.ocr.warnings,
      error: document.ocr.error,
      extractedFields: document.ocr.extractedFields,
    } : undefined,
  };
}

function buildOcrSummary(submission: VerificationSubmission) {
  const lines = submission.documents
    .filter((document) => document.ocr)
    .map((document) => {
      const ocr = document.ocr!;
      const fields = [
        ocr.extractedFields.vatNumbers.length ? `USt-ID: ${ocr.extractedFields.vatNumbers.join(', ')}` : undefined,
        ocr.extractedFields.documentNumbers.length ? `Nummern: ${ocr.extractedFields.documentNumbers.join(', ')}` : undefined,
        ocr.extractedFields.expiryDate ? `Ablauf: ${ocr.extractedFields.expiryDate}` : undefined,
      ].filter(Boolean).join('; ');

      return `- ${document.type}: ${ocr.status}, ${ocr.source}, Confidence ${ocr.confidence ?? 'n/a'}${fields ? ` (${fields})` : ''}`;
    });

  return lines.length ? lines.join('\n') : '- keine';
}

function roleLabel(role: VerificationRole) {
  switch (role) {
    case 'SHIPPER_PRIVATE':
      return 'Verlader Privat';
    case 'SHIPPER_COMPANY':
      return 'Verlader Gewerbe';
    case 'CARRIER':
      return 'Spedition / Transporteur';
    case 'DRIVER_SELF_EMPLOYED':
      return 'Solo-Transporteur';
    case 'DISPATCHER':
      return 'Disposition';
    case 'SUPPORT':
      return 'Support';
    case 'MARKETER':
      return 'Marketing';
    case 'ADMIN':
    default:
      return 'Admin';
  }
}

function isKnownDocumentType(type: string): type is SubmittedDocumentType {
  return [
    'ID_CARD',
    'PASSPORT',
    'DRIVERS_LICENSE',
    'DRIVER_CARD',
    'COMMERCIAL_REGISTER_EXTRACT',
    'BUSINESS_REGISTRATION',
    'VAT_CERTIFICATE',
    'BENEFICIAL_OWNERS_DECLARATION',
    'TRANSPORT_LICENSE',
    'FLEET_INSURANCE',
    'CMR_INSURANCE',
    'VEHICLE_REGISTRATION',
    'ADR_CERTIFICATE',
    'PROOF_OF_ADDRESS',
    'AUTHORIZATION_LETTER',
  ].includes(type);
}

function isValidDocumentUrl(url?: string) {
  if (!url) return false;
  return url.startsWith('https://') || url.startsWith('http://') || url.startsWith('/uploads/');
}
