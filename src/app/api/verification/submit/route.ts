import { NextRequest, NextResponse } from 'next/server';
import {
  getVerificationRequirements,
  processVerificationSubmission,
  type SubmittedVerificationDocument,
  type VerificationCapabilities,
  type VerificationRole,
} from '@/services/verification-workflow.service';
import { extractDocumentOcr } from '@/services/verification/ocr.service';

export const runtime = 'nodejs';

function normalizeRole(role?: string | null): VerificationRole | null {
  switch (role) {
    case 'SHIPPER_PRIVATE':
    case 'SHIPPER_COMPANY':
    case 'CARRIER':
    case 'DISPATCHER':
    case 'DRIVER_SELF_EMPLOYED':
    case 'ADMIN':
    case 'SUPPORT':
    case 'MARKETER':
      return role;
    case 'shipper_private':
      return 'SHIPPER_PRIVATE';
    case 'shipper':
    case 'shipper_company':
      return 'SHIPPER_COMPANY';
    case 'carrier':
      return 'CARRIER';
    case 'driver':
      return 'DRIVER_SELF_EMPLOYED';
    case 'dispatcher':
      return 'DISPATCHER';
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = normalizeRole(searchParams.get('role'));

  if (!role) {
    return NextResponse.json(
      {
        success: false,
        error: 'INVALID_ROLE',
        message: 'role is required',
      },
      { status: 400 },
    );
  }

  const requirements = getVerificationRequirements({
    role,
    country: searchParams.get('country') || 'DE',
    companyType: (searchParams.get('companyType') || undefined) as 'SHIPPER' | 'CARRIER' | 'BOTH' | undefined,
    capabilities: {
      ownerDrives: searchParams.get('ownerDrives') === 'true',
      international: searchParams.get('international') === 'true',
      hazardousGoods: searchParams.get('hazardousGoods') === 'true',
      requiresAdr: searchParams.get('requiresAdr') === 'true',
    },
  });

  return NextResponse.json({
    success: true,
    role,
    requirements,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const role = normalizeRole(body.role);
    const userId = body.userId || request.headers.get('x-user-id');

    if (!role || !userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_REQUEST',
          message: 'userId and role are required',
        },
        { status: 400 },
      );
    }

    const documents = await enrichDocumentsWithOcr(
      (body.documents || []) as SubmittedVerificationDocument[],
      body.autoOcr !== false,
      body.autoOcr === true,
    );

    const result = await processVerificationSubmission({
      userId,
      role,
      country: body.country || 'DE',
      companyId: body.companyId,
      companyType: body.companyType,
      vatNumber: body.vatNumber,
      highRisk: body.highRisk,
      estimatedOrderValueCents: body.estimatedOrderValueCents,
      capabilities: (body.capabilities || {}) as VerificationCapabilities,
      documents,
      persist: body.persist !== false,
    });

    return NextResponse.json(
      {
        success: true,
        verification: result,
        message: result.requiresManualReview
          ? 'Dokumente erfasst. Manuelle Prüfung wurde automatisch ans Ticketsystem übergeben.'
          : 'Dokumente automatisch geprüft und freigegeben.',
      },
      { status: result.requiresManualReview ? 202 : 200 },
    );
  } catch (error) {
    console.error('[VerificationSubmitAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'VERIFICATION_SUBMIT_FAILED',
        message: error instanceof Error ? error.message : 'Verification submit failed',
      },
      { status: 500 },
    );
  }
}

async function enrichDocumentsWithOcr(
  documents: SubmittedVerificationDocument[],
  enabled: boolean,
  allowUrlOcr: boolean,
): Promise<SubmittedVerificationDocument[]> {
  if (!enabled) {
    return documents.map(stripInlineFile);
  }

  const enriched: SubmittedVerificationDocument[] = [];

  for (const document of documents) {
    if (document.ocr) {
      enriched.push(stripInlineFile(document));
      continue;
    }

    const canExtract = Boolean(document.fileBase64 || (allowUrlOcr && document.documentUrl));

    if (!canExtract) {
      enriched.push(stripInlineFile(document));
      continue;
    }

    const ocr = await extractDocumentOcr({
      fileBase64: document.fileBase64,
      documentUrl: allowUrlOcr ? document.documentUrl : undefined,
      mimeType: document.mimeType,
      fileName: document.name,
      documentType: document.type,
    });

    enriched.push(stripInlineFile({
      ...document,
      ocr,
    }));
  }

  return enriched;
}

function stripInlineFile(document: SubmittedVerificationDocument): SubmittedVerificationDocument {
  const { fileBase64, ...safeDocument } = document;
  return safeDocument;
}
