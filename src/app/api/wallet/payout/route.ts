// ============================================
// CARGOBIT WALLET PAYOUT API
// Beispiel: Shipper will 50.000€ auszahlen lassen
// Demonstriert YELLOW-Flag Scenario mit Mitigations
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { PayoutStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { 
  performHybridSecurityCheck,
  SecurityContext,
  ActionContext,
} from '@/lib/hybrid-security';
import { logAuditEvent } from '@/lib/permissions';
import { requireRequestUser } from '@/lib/request-user-auth';

// ============================================
// INTERFACES
// ============================================

interface PayoutRequest {
  amount: number;
  currency: string;
  payoutMethodId: string;
  description?: string;
}

interface PayoutResponse {
  success: boolean;
  message: string;
  payoutId?: string;
  status?: 'PENDING' | 'DELAYED' | 'PROCESSING' | 'COMPLETED' | 'BLOCKED';
  availableAt?: Date; // For delayed payouts
  riskAnalysis?: {
    score: number;
    level: string;
    userScore: number;
    companyScore: number;
    transactionScore: number;
    factors: string[];
  };
  mitigations?: string[];
  payoutLimits?: {
    minAmount: number;
    maxAmount: number;
    processingDays: number;
    currency: string;
  };
}

// ============================================
// POST /api/wallet/payout
//
// Beispiel-Szenario aus Spec:
// Shipper akzeptiert Angebot über 50.000€
// - KYB fehlt → +20
// - Hoher Betrag → +20
// - Neue IBAN → +15
// - CombinedRiskScore = 55 → GELB → Allow mit 24h Delay + Logging
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body: PayoutRequest = await request.json();
    const payoutLimits = await getPayoutLimits();

    // Validate amount
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Ungültiger Auszahlungsbetrag',
        code: 'INVALID_AMOUNT',
      }, { status: 400 });
    }

    if (body.amount < payoutLimits.minAmount) {
      return NextResponse.json({
        error: 'ValidationError',
        message: `Mindestbetrag für Bankauszahlungen ist ${formatMoney(payoutLimits.minAmount, body.currency || payoutLimits.currency)}.`,
        code: 'PAYOUT_AMOUNT_TOO_LOW',
        minAmount: payoutLimits.minAmount,
      }, { status: 400 });
    }

    if (body.amount > payoutLimits.maxAmount) {
      return NextResponse.json({
        error: 'ValidationError',
        message: `Maximalbetrag pro Bankauszahlung ist ${formatMoney(payoutLimits.maxAmount, body.currency || payoutLimits.currency)}.`,
        code: 'PAYOUT_AMOUNT_TOO_HIGH',
        maxAmount: payoutLimits.maxAmount,
      }, { status: 400 });
    }

    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;

    const userId = auth.user.id;

    // Get user with wallet and payout method
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        companyUsers: { include: { company: true } },
        securityFlags: { where: { active: true } },
        wallet: {
          include: {
            payoutMethods: true,
            transactions: {
              where: {
                type: 'DEPOSIT',
                createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
              },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    if (!user || !user.wallet) {
      return NextResponse.json({
        error: 'NotFoundError',
        message: 'Wallet nicht gefunden',
        code: 'WALLET_NOT_FOUND',
      }, { status: 404 });
    }

    if (user.wallet.status !== 'ACTIVE') {
      return NextResponse.json({
        error: 'WalletError',
        message: 'Wallet ist nicht aktiv. Auszahlung ist aktuell nicht möglich.',
        code: 'WALLET_INACTIVE',
      }, { status: 403 });
    }

    if ((body.currency || 'EUR') !== user.wallet.currency) {
      return NextResponse.json({
        error: 'ValidationError',
        message: `Auszahlungen sind nur in ${user.wallet.currency} möglich.`,
        code: 'CURRENCY_MISMATCH',
      }, { status: 400 });
    }

    const userRoles = user.roles.map((userRole) => userRole.role.name);
    if (!hasPayoutRole(userRoles)) {
      return NextResponse.json({
        error: 'ForbiddenError',
        message: 'Bankauszahlungen sind nur für Transporteure, Dispatcher und selbstständige Fahrer verfügbar.',
        code: 'PAYOUT_ROLE_REQUIRED',
      }, { status: 403 });
    }

    // Check wallet balance. Reserved funds still belong to open orders and cannot
    // be withdrawn until the reservation is released or finalized.
    const availableBalance = user.wallet.balance - (user.wallet.reservedBalance || 0);
    if (availableBalance < body.amount) {
      return NextResponse.json({
        error: 'ValidationError',
        message: `Unzureichendes frei verfügbares Guthaben. Verfügbar: ${formatMoney(availableBalance, user.wallet.currency)}.`,
        code: 'INSUFFICIENT_BALANCE',
        available: availableBalance,
      }, { status: 400 });
    }

    // Get payout method
    const payoutMethod = user.wallet.payoutMethods.find(pm => pm.id === body.payoutMethodId);
    if (!payoutMethod) {
      return NextResponse.json({
        error: 'NotFoundError',
        message: 'Auszahlungsmethode nicht gefunden',
        code: 'PAYOUT_METHOD_NOT_FOUND',
      }, { status: 404 });
    }

    if (!payoutMethod.verified) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Auszahlungsmethode ist noch nicht verifiziert',
        code: 'PAYOUT_METHOD_NOT_VERIFIED',
      }, { status: 403 });
    }

    // ============================================
    // BUILD SECURITY CONTEXT
    // ============================================
    const securityContext: SecurityContext = {
      userId: user.id,
      email: user.email,
      roles: userRoles as any,
      companyId: user.companyUsers[0]?.companyId,
      companyRole: user.companyUsers[0]?.roleInCompany as any,
      isVerified: user.status === 'ACTIVE',
      riskScore: user.securityFlags.filter(f => f.severity === 'CRITICAL').length * 25 +
                 user.securityFlags.filter(f => f.severity === 'HIGH').length * 15,
      activeSecurityFlags: user.securityFlags.length,
    };

    // ============================================
    // BUILD ACTION CONTEXT WITH RISK FACTORS
    // ============================================
    
    // Check if IBAN is new (< 48h)
    const ibanAge = Date.now() - payoutMethod.createdAt.getTime();
    const isNewIban = ibanAge < 48 * 60 * 60 * 1000;

    // Check for recent deposit (rapid payout)
    const hasRecentDeposit = user.wallet.transactions.some(t => 
      t.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    // Check KYB status for companies
    let kybMissing = false;
    if (securityContext.companyId) {
      const kyb = await db.verification.findFirst({
        where: {
          type: 'KYB',
          status: 'APPROVED',
        },
      });
      kybMissing = !kyb;
    }

    const actionContext: ActionContext = {
      action: 'INITIATE_PAYOUT',
      resourceType: 'wallet',
      resourceId: user.wallet.id,
      transactionContext: {
        amount: body.amount,
        currency: body.currency || 'EUR',
        isNewIban,
      },
    };

    // ============================================
    // HYBRID SECURITY CHECK
    // ============================================
    const securityResult = await performHybridSecurityCheck(securityContext, actionContext);

    // Log the attempt
    console.log('[PAYOUT] Security Check Result:', {
      action: 'INITIATE_PAYOUT',
      userId: securityContext.userId,
      amount: body.amount,
      isNewIban,
      hasRecentDeposit,
      kybMissing,
      riskScore: securityResult.riskCheck?.score,
      riskLevel: securityResult.riskCheck?.level,
      factors: securityResult.riskCheck?.factors,
      allowed: securityResult.permissionCheck.allowed,
    });

    // ============================================
    // HANDLE RED BLOCK
    // ============================================
    if (!securityResult.permissionCheck.allowed) {
      return NextResponse.json<PayoutResponse>({
        success: false,
        message: 'Auszahlung vorübergehend gesperrt. Bitte kontaktieren Sie den Support.',
        status: 'BLOCKED',
        riskAnalysis: {
          score: securityResult.riskCheck?.score || 0,
          level: securityResult.riskCheck?.level || 'RED',
          userScore: securityResult.riskCheck?.userScore || 0,
          companyScore: securityResult.riskCheck?.companyScore || 0,
          transactionScore: securityResult.riskCheck?.transactionScore || 0,
          factors: securityResult.riskCheck?.factors || [],
        },
      }, { status: 403 });
    }

    // ============================================
    // HANDLE YELLOW WITH MITIGATIONS
    // ============================================
    let status: PayoutResponse['status'] = 'PROCESSING';
    let availableAt: Date | undefined;
    let mitigations: string[] = [];

    if (securityResult.riskCheck?.level === 'YELLOW' && securityResult.mitigations) {
      status = 'DELAYED';
      mitigations = securityResult.mitigations.requiredActions;
      
      // Apply 24h delay
      if (securityResult.mitigations.delayUntil) {
        availableAt = securityResult.mitigations.delayUntil;
      } else {
        availableAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      // Check if 2FA is required
      if (securityResult.mitigations.requires2FA) {
        return NextResponse.json({
          success: false,
          message: '2FA-Verifizierung erforderlich',
          code: 'REQUIRES_2FA',
          mitigations,
        }, { status: 202 });
      }
    }

    // ============================================
    // CREATE PAYOUT TRANSACTION
    // ============================================
    const payoutWrite = await db.$transaction(async (tx) => {
      const payout = await tx.payout.create({
        data: {
          userId,
          amountCents: Math.round(body.amount * 100),
          currency: body.currency || 'EUR',
          status: status === 'DELAYED' ? PayoutStatus.PENDING : PayoutStatus.PROCESSING,
          payoutMethodId: payoutMethod.id,
          ibanLast4: payoutMethod.iban.slice(-4),
          riskScore: securityResult.riskCheck?.score,
          riskLevel: securityResult.riskCheck?.level?.toLowerCase(),
          riskFactors: JSON.stringify(securityResult.riskCheck?.factors || []),
          delayedUntil: status === 'DELAYED' ? availableAt : undefined,
          delayReason: status === 'DELAYED' ? mitigations.join('; ') || 'Risk mitigation delay' : undefined,
          idempotencyKey: `wallet_payout_${user.wallet!.id}_${Date.now()}`,
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: user.wallet!.id,
          type: 'PAYOUT',
          amount: -body.amount,
          currency: body.currency || 'EUR',
          description: body.description || 'Auszahlung',
          payoutId: payout.id,
          processedAt: status === 'DELAYED' ? null : new Date(),
        },
      });

      await tx.wallet.update({
        where: { id: user.wallet!.id },
        data: {
          balance: { decrement: body.amount },
          totalWithdrawn: { increment: body.amount },
        },
      });

      return { payout };
    });

    // Log successful action
    await logAuditEvent({
      userId,
      action: 'PAYOUT',
      entityType: 'wallet',
      entityId: user.wallet.id,
      dataBefore: { balance: user.wallet.balance },
      dataAfter: {
        payoutAmount: body.amount,
        status,
        availableAt,
        riskScore: securityResult.riskCheck?.score,
        riskLevel: securityResult.riskCheck?.level,
        mitigations,
      },
    });

    // Notify user
    await db.notification.create({
      data: {
        userId,
        type: 'PAYOUT_INITIATED',
        title: status === 'DELAYED' 
          ? 'Auszahlung verzögert' 
          : 'Auszahlung eingeleitet',
        message: status === 'DELAYED'
          ? `Ihre Auszahlung von ${body.amount.toLocaleString()} ${body.currency || 'EUR'} wird am ${availableAt?.toLocaleDateString('de-DE')} bearbeitet.`
          : `Ihre Auszahlung von ${body.amount.toLocaleString()} ${body.currency || 'EUR'} wurde eingeleitet.`,
        data: JSON.stringify({
          payoutId: payoutWrite.payout.id,
          amount: body.amount,
          status,
          availableAt,
        }),
      },
    });

    // ============================================
    // BUILD RESPONSE
    // ============================================
    const response: PayoutResponse = {
      success: true,
      message: status === 'DELAYED'
        ? `Auszahlung wird am ${availableAt?.toLocaleDateString('de-DE')} bearbeitet.`
        : 'Auszahlung erfolgreich eingeleitet.',
      payoutId: payoutWrite.payout.id,
      status,
      availableAt,
      payoutLimits,
      riskAnalysis: securityResult.riskCheck ? {
        score: securityResult.riskCheck.score,
        level: securityResult.riskCheck.level,
        userScore: securityResult.riskCheck.userScore,
        companyScore: securityResult.riskCheck.companyScore,
        transactionScore: securityResult.riskCheck.transactionScore,
        factors: securityResult.riskCheck.factors,
      } : undefined,
      mitigations,
    };

    return NextResponse.json(response, { 
      status: 200,
      headers: status === 'DELAYED' ? {
        'X-Payout-Status': 'DELAYED',
        'X-Available-At': availableAt?.toISOString() || '',
        'X-Mitigations': mitigations.join('; '),
      } : undefined,
    });

  } catch (error) {
    console.error('Payout error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Fehler bei der Auszahlung',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}

function hasPayoutRole(roles: string[]) {
  return roles.some((role) => role === 'CARRIER' || role === 'DISPATCHER' || role === 'DRIVER_SELF_EMPLOYED');
}

async function getPayoutLimits() {
  const settings = await db.systemSetting.findMany({
    where: { key: { in: ['min_payout_amount', 'max_payout_amount', 'payout_processing_days'] } },
  });
  const valueFor = (key: string, fallback: number) => {
    const value = Number(settings.find((setting) => setting.key === key)?.value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  return {
    minAmount: valueFor('min_payout_amount', 50),
    maxAmount: valueFor('max_payout_amount', 25000),
    processingDays: valueFor('payout_processing_days', 3),
    currency: 'EUR',
  };
}

function formatMoney(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value);
}
