// ============================================
// CARGOBIT TRANSPORTEUR ONBOARDING API
// POST /api/onboarding/transporter
// Complete transporter registration with file uploads
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  processVerificationSubmission,
  type SubmittedVerificationDocument,
} from '@/services/verification-workflow.service';
import { extractDocumentOcrFromFile } from '@/services/verification/ocr.service';

export const runtime = 'nodejs';

// ============================================
// INTERFACES
// ============================================
interface TransporterOnboardingData {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  vehicleType: string;
  capacityKg: number;
  regionFrom: string;
  regionTo: string;
  businessDocPath?: string;
  insuranceDocPath?: string;
}

// ============================================
// FILE SAVE UTILITY
// In production: Use S3, GCS, or similar
// ============================================
async function saveFile(file: File, path: string): Promise<string> {
  // Mock implementation - in production use cloud storage
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const mockPath = `/uploads${normalizedPath}`;
  console.log(`[STORAGE] Saving file to: ${mockPath}`);
  
  // For now, return a mock URL
  return `https://storage.cargobit.de${normalizedPath}`;
}

// ============================================
// POST /api/onboarding/transporter
// ============================================
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = request.headers.get('x-user-id') || 'demo-user';

    // Extract form fields
    const companyName = formData.get('companyName') as string;
    const contactName = formData.get('contactName') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const vehicleType = formData.get('vehicleType') as string;
    const capacityKg = parseInt(formData.get('capacityKg') as string) || 0;
    const regionFrom = formData.get('regionFrom') as string;
    const regionTo = formData.get('regionTo') as string;
    const vatNumber = formData.get('vatNumber') as string | null;
    
    // File uploads
    const businessDoc = formData.get('businessDoc') as File | null;
    const insuranceDoc = formData.get('insuranceDoc') as File | null;

    // Validation
    if (!companyName || !contactName || !email || !vehicleType || !capacityKg) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Pflichtfelder fehlen',
        required: ['companyName', 'contactName', 'email', 'vehicleType', 'capacityKg'],
      }, { status: 400 });
    }

    // Get or create company for transporter
    let company = await db.company.findFirst({
      where: { name: companyName },
    });

    if (!company) {
      company = await db.company.create({
        data: {
          name: companyName,
          type: 'CARRIER',
          country: regionFrom.split('-')[0] || 'DE',
          status: 'PENDING',
        },
      });
    }

    // Create user if not exists (or link existing)
    let user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          email,
          passwordHash: 'pending_onboarding', // Will be set on first login
          firstName: contactName.split(' ')[0],
          lastName: contactName.split(' ').slice(1).join(' '),
          phone,
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

    // Create driver profile
    const driver = await db.driver.create({
      data: {
        userId: user.id,
        companyId: company.id,
        isAvailable: true,
        internationalExperience: regionTo.includes(',') || regionTo !== regionFrom,
      },
    });

    // Create vehicle
    await db.vehicle.create({
      data: {
        companyId: company.id,
        type: vehicleType.toUpperCase().replace(/[^A-Z]/g, '_') as any,
        plateNumber: `PENDING-${Date.now()}`, // To be updated
        maxPayloadKg: capacityKg,
        status: 'ACTIVE',
      },
    });

    // Handle file uploads
    let businessDocPath: string | undefined;
    let insuranceDocPath: string | undefined;
    const verificationDocuments: SubmittedVerificationDocument[] = [];

    if (businessDoc && businessDoc.size > 0) {
      businessDocPath = await saveFile(businessDoc, `transporter/${user.id}/business.pdf`);

      verificationDocuments.push({
        type: 'COMMERCIAL_REGISTER_EXTRACT',
        documentUrl: businessDocPath,
        name: businessDoc.name || 'business.pdf',
        mimeType: businessDoc.type,
        fileSize: businessDoc.size,
        ocr: await extractDocumentOcrFromFile(businessDoc, {
          documentType: 'COMMERCIAL_REGISTER_EXTRACT',
        }),
      });
    }

    if (insuranceDoc && insuranceDoc.size > 0) {
      insuranceDocPath = await saveFile(insuranceDoc, `transporter/${user.id}/insurance.pdf`);

      verificationDocuments.push({
        type: 'FLEET_INSURANCE',
        documentUrl: insuranceDocPath,
        name: insuranceDoc.name || 'insurance.pdf',
        mimeType: insuranceDoc.type,
        fileSize: insuranceDoc.size,
        ocr: await extractDocumentOcrFromFile(insuranceDoc, {
          documentType: 'FLEET_INSURANCE',
        }),
      });
    }

    // Create wallet for the user
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

    const verification = await processVerificationSubmission({
      userId: user.id,
      role: 'CARRIER',
      country: regionFrom.split('-')[0] || 'DE',
      companyId: company.id,
      companyType: 'CARRIER',
      vatNumber: vatNumber || undefined,
      documents: verificationDocuments,
      capabilities: {
        ownerDrives: true,
        international: regionTo.includes(',') || regionTo !== regionFrom,
      },
    });

    // Create notification
    await db.notification.create({
      data: {
        userId: user.id,
        type: 'ONBOARDING_SUBMITTED',
        title: 'Registrierung eingegangen',
        message: 'Ihre Transporteur-Registrierung wird geprüft. Sie erhalten innerhalb von 24-48 Stunden eine Bestätigung.',
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'transporter',
        entityId: company.id,
        dataAfter: JSON.stringify({
          companyName,
          vehicleType,
          capacityKg,
          regionFrom,
          regionTo,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      status: 'pending_review',
      transporterId: company.id,
      userId: user.id,
      verification,
      message: 'Onboarding erfolgreich eingereicht. Sie werden nach Prüfung freigeschaltet.',
      documents: {
        businessDoc: businessDocPath ? 'uploaded' : 'missing',
        insuranceDoc: insuranceDocPath ? 'uploaded' : 'missing',
      },
    });

  } catch (error) {
    console.error('[ONBOARDING] Transporter error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler beim Onboarding',
    }, { status: 500 });
  }
}
