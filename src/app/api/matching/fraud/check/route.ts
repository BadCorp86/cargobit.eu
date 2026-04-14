import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { FraudCheckRequest, FraudCheckResponse, FraudCheckResult, FraudCheckType, ApiErrorResponse } from '@/types/matching';

// POST /api/matching/fraud/check - Anti-fraud checks for drivers
export async function POST(request: NextRequest) {
  try {
    const body: FraudCheckRequest = await request.json();

    if (!body.driverId) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'ValidationError',
        message: 'Missing required field: driverId',
        code: 'MISSING_DRIVER_ID'
      }, { status: 400 });
    }

    // Get driver with all relevant data
    const driver = await prisma.user.findUnique({
      where: { id: body.driverId },
      include: {
        wallet: true,
        documents: true,
        verifications: true,
        vehicles: true,
        transportsAsDriver: {
          where: {
            OR: [
              { status: 'CANCELLED' },
              { status: 'DISPUTED' }
            ]
          },
          select: {
            id: true,
            status: true,
            cancellationReason: true,
            createdAt: true
          }
        }
      }
    });

    if (!driver) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'NotFoundError',
        message: 'Driver not found',
        code: 'DRIVER_NOT_FOUND'
      }, { status: 404 });
    }

    const checks: FraudCheckResult[] = [];
    const recommendations: string[] = [];
    const blockedReasons: string[] = [];
    
    // Determine which checks to run
    const checkTypes = body.checkTypes?.includes('all') || !body.checkTypes
      ? ['kyc', 'kyb', 'iban_change', 'gps_plausibility', 'cancellation_rate', 'damage_history', 'fake_documents', 'suspicious_activity']
      : body.checkTypes;

    let totalRiskScore = 0;

    // ========== KYC CHECK ==========
    if (checkTypes.includes('kyc')) {
      const result = await performKYCCheck(driver);
      checks.push(result);
      totalRiskScore += result.riskScore * 0.2;
      if (!result.passed && result.riskScore > 0.8) {
        blockedReasons.push('KYC nicht bestanden');
      }
    }

    // ========== KYB CHECK (for companies) ==========
    if (checkTypes.includes('kyb') && driver.companyName) {
      const result = await performKYBCheck(driver);
      checks.push(result);
      totalRiskScore += result.riskScore * 0.15;
    }

    // ========== IBAN CHANGE CHECK ==========
    if (checkTypes.includes('iban_change')) {
      const result = await performIBANChangeCheck(driver);
      checks.push(result);
      totalRiskScore += result.riskScore * 0.1;
      if (result.flags?.includes('recent_iban_change')) {
        recommendations.push('IBAN kürzlich geändert - zusätzliche Verifizierung empfohlen');
      }
    }

    // ========== GPS PLAUSIBILITY CHECK ==========
    if (checkTypes.includes('gps_plausibility')) {
      const result = await performGPSCheck(driver, body.transportId);
      checks.push(result);
      totalRiskScore += result.riskScore * 0.1;
    }

    // ========== CANCELLATION RATE CHECK ==========
    if (checkTypes.includes('cancellation_rate')) {
      const result = await performCancellationCheck(driver);
      checks.push(result);
      totalRiskScore += result.riskScore * 0.15;
      if (!result.passed) {
        recommendations.push('Hohe Stornoquote - Vorauszahlung empfohlen');
      }
    }

    // ========== DAMAGE HISTORY CHECK ==========
    if (checkTypes.includes('damage_history')) {
      const result = await performDamageHistoryCheck(driver);
      checks.push(result);
      totalRiskScore += result.riskScore * 0.1;
      if (result.riskScore > 0.5) {
        recommendations.push('Schadenshistorie prüfen - höhere Kaution erwägen');
      }
    }

    // ========== FAKE DOCUMENTS CHECK ==========
    if (checkTypes.includes('fake_documents')) {
      const result = await performFakeDocumentsCheck(driver);
      checks.push(result);
      totalRiskScore += result.riskScore * 0.15;
      if (!result.passed) {
        blockedReasons.push('Verdacht auf gefälschte Dokumente');
      }
    }

    // ========== SUSPICIOUS ACTIVITY CHECK ==========
    if (checkTypes.includes('suspicious_activity')) {
      const result = await performSuspiciousActivityCheck(driver);
      checks.push(result);
      totalRiskScore += result.riskScore * 0.05;
    }

    // Determine overall risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (totalRiskScore >= 0.8) riskLevel = 'critical';
    else if (totalRiskScore >= 0.5) riskLevel = 'high';
    else if (totalRiskScore >= 0.25) riskLevel = 'medium';
    else riskLevel = 'low';

    const safe = riskLevel !== 'critical' && blockedReasons.length === 0;

    // Store fraud check result
    await prisma.auditLog.create({
      data: {
        userId: driver.id,
        action: 'FRAUD_CHECK',
        entityType: 'User',
        entityId: driver.id,
        newValue: JSON.stringify({
          riskScore: totalRiskScore,
          riskLevel,
          safe,
          checks: checks.map(c => ({ type: c.checkType, passed: c.passed, riskScore: c.riskScore }))
        })
      }
    }).catch(() => {});

    return NextResponse.json<FraudCheckResponse>({
      safe,
      riskScore: Math.round(totalRiskScore * 100) / 100,
      riskLevel,
      checks,
      recommendations,
      blockedReasons
    }, { status: 200 });

  } catch (error) {
    console.error('Fraud check error:', error);
    return NextResponse.json<ApiErrorResponse>({
      error: 'InternalServerError',
      message: 'Failed to perform fraud check',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

// ========== CHECK IMPLEMENTATIONS ==========

async function performKYCCheck(driver: any): Promise<FraudCheckResult> {
  const issues: string[] = [];
  let riskScore = 0;

  // Check identity verification
  if (driver.identityVerified !== 'VERIFIED') {
    issues.push('Identität nicht verifiziert');
    riskScore += 0.3;
  }

  // Check email verification
  if (!driver.emailVerified) {
    issues.push('E-Mail nicht verifiziert');
    riskScore += 0.1;
  }

  // Check phone presence
  if (!driver.phone) {
    issues.push('Keine Telefonnummer');
    riskScore += 0.05;
  }

  // Check verification documents
  const identityDocs = driver.verifications.filter(
    (v: any) => v.type === 'IDENTITY' && v.status === 'VERIFIED'
  );
  if (identityDocs.length === 0) {
    riskScore += 0.2;
  }

  // Check account age
  const accountAge = Date.now() - new Date(driver.createdAt).getTime();
  const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
  if (daysSinceCreation < 7) {
    issues.push('Konto sehr neu');
    riskScore += 0.15;
  }

  return {
    checkType: 'kyc',
    passed: riskScore < 0.5,
    riskScore: Math.min(1, riskScore),
    details: issues.length > 0 ? issues.join(', ') : 'KYC bestanden',
    flags: issues
  };
}

async function performKYBCheck(driver: any): Promise<FraudCheckResult> {
  const issues: string[] = [];
  let riskScore = 0;

  // Check business verification
  if (driver.businessVerified !== 'VERIFIED') {
    issues.push('Unternehmen nicht verifiziert');
    riskScore += 0.3;
  }

  // Check company data completeness
  if (!driver.companyVatId && driver.companyName) {
    issues.push('Keine USt-ID');
    riskScore += 0.2;
  }

  if (!driver.companyRegistrationNumber && driver.companyName) {
    issues.push('Keine Handelsregisternummer');
    riskScore += 0.1;
  }

  // Check business documents
  const businessDocs = driver.verifications.filter(
    (v: any) => v.type === 'BUSINESS' && v.status === 'VERIFIED'
  );
  if (businessDocs.length === 0 && driver.companyName) {
    riskScore += 0.15;
  }

  return {
    checkType: 'kyb',
    passed: riskScore < 0.5,
    riskScore: Math.min(1, riskScore),
    details: issues.length > 0 ? issues.join(', ') : 'KYB bestanden',
    flags: issues
  };
}

async function performIBANChangeCheck(driver: any): Promise<FraudCheckResult> {
  const flags: string[] = [];
  let riskScore = 0;

  if (driver.wallet) {
    // Check for recent IBAN changes (would have to track this in production)
    // For now, check IBAN verification
    if (!driver.wallet.payoutVerified) {
      flags.push('iban_not_verified');
      riskScore += 0.15;
    }

    // Check for mismatched country
    if (driver.wallet.payoutIban && driver.companyCountry) {
      const ibanCountry = driver.wallet.payoutIban.substring(0, 2);
      if (ibanCountry !== driver.companyCountry && ibanCountry !== 'DE') {
        flags.push('iban_country_mismatch');
        riskScore += 0.1;
      }
    }
  }

  return {
    checkType: 'iban_change',
    passed: riskScore < 0.3,
    riskScore: Math.min(1, riskScore),
    details: flags.length > 0 ? flags.join(', ') : 'IBAN ok',
    flags
  };
}

async function performGPSCheck(driver: any, transportId?: string): Promise<FraudCheckResult> {
  const issues: string[] = [];
  let riskScore = 0;

  if (driver.currentLocation) {
    try {
      const location = JSON.parse(driver.currentLocation);
      
      // Check if location is recent
      if (location.timestamp) {
        const locationAge = Date.now() - new Date(location.timestamp).getTime();
        const hoursOld = locationAge / (1000 * 60 * 60);
        if (hoursOld > 24) {
          issues.push('GPS-Daten veraltet');
          riskScore += 0.1;
        }
      }

      // Check for impossible locations (would compare with transport route in production)
      // Check if coordinates are valid
      if (location.lat < -90 || location.lat > 90 || 
          location.lng < -180 || location.lng > 180) {
        issues.push('Ungültige GPS-Koordinaten');
        riskScore += 0.3;
      }
    } catch {
      issues.push('GPS-Daten nicht lesbar');
      riskScore += 0.1;
    }
  }

  return {
    checkType: 'gps_plausibility',
    passed: riskScore < 0.3,
    riskScore: Math.min(1, riskScore),
    details: issues.length > 0 ? issues.join(', ') : 'GPS plausibel',
    flags: issues
  };
}

async function performCancellationCheck(driver: any): Promise<FraudCheckResult> {
  const issues: string[] = [];
  let riskScore = 0;

  if (driver.totalTransports > 0) {
    const cancellationRate = driver.cancelledTransports / driver.totalTransports;
    
    if (cancellationRate > 0.3) {
      issues.push(`Stornoquote sehr hoch: ${Math.round(cancellationRate * 100)}%`);
      riskScore += 0.5;
    } else if (cancellationRate > 0.2) {
      issues.push(`Hohe Stornoquote: ${Math.round(cancellationRate * 100)}%`);
      riskScore += 0.3;
    } else if (cancellationRate > 0.1) {
      issues.push(`Erhöhte Stornoquote: ${Math.round(cancellationRate * 100)}%`);
      riskScore += 0.15;
    }

    // Check for recent cancellations
    const recentCancellations = driver.transportsAsDriver.filter(
      (t: any) => t.status === 'CANCELLED' && 
      Date.now() - new Date(t.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000
    );
    if (recentCancellations.length >= 3) {
      issues.push('Mehrere Stornierungen im letzten Monat');
      riskScore += 0.2;
    }
  }

  return {
    checkType: 'cancellation_rate',
    passed: riskScore < 0.3,
    riskScore: Math.min(1, riskScore),
    details: issues.length > 0 ? issues.join(', ') : 'Stornoquote akzeptabel',
    flags: issues
  };
}

async function performDamageHistoryCheck(driver: any): Promise<FraudCheckResult> {
  const issues: string[] = [];
  let riskScore = 0;

  if (driver.damageCount > 0) {
    if (driver.damageCount >= 5) {
      issues.push(`Viele Schäden: ${driver.damageCount}`);
      riskScore += 0.5;
    } else if (driver.damageCount >= 3) {
      issues.push(`Mehrfache Schäden: ${driver.damageCount}`);
      riskScore += 0.3;
    } else {
      issues.push(`Schäden: ${driver.damageCount}`);
      riskScore += 0.15;
    }

    // Check for recent damages
    if (driver.lastDamageAt) {
      const daysSinceDamage = (Date.now() - new Date(driver.lastDamageAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDamage < 90) {
        issues.push('Letzer Schaden vor kurzem');
        riskScore += 0.1;
      }
    }
  }

  return {
    checkType: 'damage_history',
    passed: riskScore < 0.5,
    riskScore: Math.min(1, riskScore),
    details: issues.length > 0 ? issues.join(', ') : 'Keine Schadenshistorie',
    flags: issues
  };
}

async function performFakeDocumentsCheck(driver: any): Promise<FraudCheckResult> {
  const issues: string[] = [];
  let riskScore = 0;

  // Check for rejected verifications
  const rejectedDocs = driver.verifications.filter(
    (v: any) => v.status === 'REJECTED'
  );
  if (rejectedDocs.length > 0) {
    issues.push(`${rejectedDocs.length} abgelehnte Dokumente`);
    riskScore += 0.3 * rejectedDocs.length;
  }

  // Check for expired documents
  const now = new Date();
  const expiredDocs = driver.verifications.filter(
    (v: any) => v.status === 'VERIFIED' && v.reviewedAt && 
      (now.getTime() - new Date(v.reviewedAt).getTime()) > 365 * 24 * 60 * 60 * 1000
  );
  if (expiredDocs.length > 0) {
    issues.push('Veraltete Dokumente');
    riskScore += 0.1;
  }

  // Check document consistency
  if (driver.companyName) {
    const hasBusinessDoc = driver.documents.some(
      (d: any) => d.type === 'BUSINESS_REGISTRATION' || d.type === 'PERMIT'
    );
    if (!hasBusinessDoc) {
      issues.push('Fehlende Unternehmensdokumente');
      riskScore += 0.15;
    }
  }

  return {
    checkType: 'fake_documents',
    passed: riskScore < 0.4,
    riskScore: Math.min(1, riskScore),
    details: issues.length > 0 ? issues.join(', ') : 'Dokumente plausibel',
    flags: issues
  };
}

async function performSuspiciousActivityCheck(driver: any): Promise<FraudCheckResult> {
  const flags: string[] = [];
  let riskScore = 0;

  // Check for rapid account changes
  const accountAge = Date.now() - new Date(driver.createdAt).getTime();
  const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);

  if (daysSinceCreation < 30 && driver.completedTransports >= 10) {
    flags.push('suspicious_growth');
    riskScore += 0.2;
  }

  // Check for unusual wallet activity
  if (driver.wallet) {
    const ratio = driver.wallet.totalDeposited / Math.max(1, driver.wallet.totalWithdrawn);
    if (ratio < 0.1 && driver.wallet.totalWithdrawn > 1000) {
      flags.push('unusual_withdrawal_pattern');
      riskScore += 0.15;
    }
  }

  // Check for multiple failed logins (would track in production)

  return {
    checkType: 'suspicious_activity',
    passed: riskScore < 0.3,
    riskScore: Math.min(1, riskScore),
    details: flags.length > 0 ? flags.join(', ') : 'Keine verdächtigen Aktivitäten',
    flags
  };
}
