// ============================================
// CARGOBIT VERLADER (SHIPPER) ONBOARDING API
// POST /api/onboarding/shipper
// Simple shipper registration
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  processVerificationSubmission,
  type SubmittedVerificationDocument,
} from '@/services/verification-workflow.service';
import { extractDocumentOcr } from '@/services/verification/ocr.service';

export const runtime = 'nodejs';

// ============================================
// POST /api/onboarding/shipper
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyName,
      contactName,
      email,
      phone,
      isBusiness,
      country = 'DE',
      vatNumber,
      verificationDocuments = [],
    } = body;
    const userId = request.headers.get('x-user-id');
    let company: Awaited<ReturnType<typeof db.company.findFirst>> = null;

    // Validation
    if (!contactName || !email) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Kontakt-Name und E-Mail sind Pflichtfelder',
      }, { status: 400 });
    }

    // Check if user already exists
    let user = await db.user.findUnique({
      where: { email },
    });

    if (user) {
      // Update existing user
      user = await db.user.update({
        where: { id: user.id },
        data: {
          firstName: contactName.split(' ')[0],
          lastName: contactName.split(' ').slice(1).join(' ') || '',
          phone: phone || user.phone,
          status: 'ACTIVE',
        },
      });
    } else {
      // Create new user
      user = await db.user.create({
        data: {
          email,
          passwordHash: 'pending_onboarding',
          firstName: contactName.split(' ')[0],
          lastName: contactName.split(' ').slice(1).join(' ') || '',
          phone,
          status: 'PENDING',
        },
      });
    }

    // If business user, create/link company
    if (isBusiness && companyName) {
      company = await db.company.findFirst({
        where: { name: companyName },
      });

      if (!company) {
        company = await db.company.create({
          data: {
            name: companyName,
            type: 'SHIPPER',
            country: 'DE',
            status: 'PENDING',
          },
        });
      }

      // Link user to company
      await db.companyUser.upsert({
        where: {
          companyId_userId: {
            companyId: company.id,
            userId: user.id,
          },
        },
        create: {
          companyId: company.id,
          userId: user.id,
          roleInCompany: 'owner',
        },
        update: {},
      });
    }

    // Create wallet for user
    await db.wallet.upsert({
      where: { ownerUserId: user.id },
      create: {
        ownerUserId: user.id,
        balance: 0,
        currency: 'EUR',
        status: 'ACTIVE',
      },
      update: {},
    });

    // Assign default role
    const shipperRole = await db.role.findFirst({
      where: { name: isBusiness ? 'SHIPPER_COMPANY' : 'SHIPPER_PRIVATE' },
    });

    if (shipperRole) {
      await db.userRoleRelation.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: shipperRole.id,
          },
        },
        create: {
          userId: user.id,
          roleId: shipperRole.id,
        },
        update: {},
      });
    }

    // Create notification
    await db.notification.create({
      data: {
        userId: user.id,
        type: 'ONBOARDING_SUBMITTED',
        title: 'Willkommen bei CargoBit!',
        message: isBusiness 
          ? 'Ihr Unternehmenskonto wurde erstellt. Laden Sie Ihr Wallet-Guthaben auf, um Transporte zu beauftragen.'
          : 'Ihr Konto wurde erstellt. Sie können jetzt Transporte beauftragen.',
      },
    });

    const verification = await processVerificationSubmission({
      userId: user.id,
      role: isBusiness ? 'SHIPPER_COMPANY' : 'SHIPPER_PRIVATE',
      country,
      companyId: company?.id,
      companyType: isBusiness ? 'SHIPPER' : undefined,
      vatNumber,
      documents: await enrichDocumentsWithOcr(verificationDocuments as SubmittedVerificationDocument[]),
    });

    return NextResponse.json({
      success: true,
      userId: user.id,
      isBusiness: isBusiness || false,
      companyId: isBusiness ? (await db.companyUser.findFirst({ where: { userId: user.id } }))?.companyId : null,
      verification,
      message: isBusiness 
        ? 'Unternehmenskonto erfolgreich erstellt' 
        : 'Privatkonto erfolgreich erstellt',
    });

  } catch (error) {
    console.error('[ONBOARDING] Shipper error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler beim Onboarding',
    }, { status: 500 });
  }
}

async function enrichDocumentsWithOcr(
  documents: SubmittedVerificationDocument[],
): Promise<SubmittedVerificationDocument[]> {
  const enriched: SubmittedVerificationDocument[] = [];

  for (const document of documents) {
    if (document.ocr || !document.fileBase64) {
      enriched.push(stripInlineFile(document));
      continue;
    }

    const ocr = await extractDocumentOcr({
      fileBase64: document.fileBase64,
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
