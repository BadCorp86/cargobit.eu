// ============================================
// CARGOBIT WALLET PAYOUT METHODS API
// POST /api/wallet/payout-methods - Add IBAN payout method
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRequestUser } from '@/lib/request-user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;

    const userId = auth.user.id;

    const body = await request.json();
    const holderName = cleanText(body.holderName, 120);
    const iban = normalizeIban(body.iban);
    const bic = cleanText(body.bic, 20).toUpperCase() || undefined;

    if (holderName.length < 2) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Kontoinhaber ist erforderlich.',
        code: 'HOLDER_NAME_REQUIRED',
      }, { status: 400 });
    }

    if (!isValidIbanShape(iban)) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Bitte eine gültige IBAN eingeben.',
        code: 'INVALID_IBAN',
      }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        wallet: true,
      },
    });

    if (!user || !user.wallet) {
      return NextResponse.json({
        error: 'NotFoundError',
        message: 'Wallet nicht gefunden.',
        code: 'WALLET_NOT_FOUND',
      }, { status: 404 });
    }

    if (!hasPayoutRole(user.roles.map((userRole) => userRole.role.name))) {
      return NextResponse.json({
        error: 'ForbiddenError',
        message: 'Auszahlungsmethoden sind nur für Transporteure, Dispatcher und selbstständige Fahrer verfügbar.',
        code: 'PAYOUT_ROLE_REQUIRED',
      }, { status: 403 });
    }

    const shouldVerifyForLocalTesting = process.env.NODE_ENV !== 'production'
      && process.env.ENABLE_LOCAL_WALLET_SIMULATION === 'true'
      && body.simulateVerification === true;

    const payoutMethod = await db.$transaction(async (tx) => {
      const existingCount = await tx.payoutMethod.count({ where: { walletId: user.wallet!.id } });
      const makeDefault = existingCount === 0 || body.isDefault === true;

      if (makeDefault) {
        await tx.payoutMethod.updateMany({
          where: { walletId: user.wallet!.id },
          data: { isDefault: false },
        });
      }

      return tx.payoutMethod.create({
        data: {
          walletId: user.wallet!.id,
          iban,
          bic,
          holderName,
          verified: shouldVerifyForLocalTesting,
          isDefault: makeDefault,
        },
      });
    });

    return NextResponse.json({
      success: true,
      payoutMethod: {
        id: payoutMethod.id,
        iban: payoutMethod.iban,
        holderName: payoutMethod.holderName,
        bic: payoutMethod.bic,
        verified: payoutMethod.verified,
        isDefault: payoutMethod.isDefault,
      },
      message: payoutMethod.verified
        ? 'Auszahlungsmethode wurde lokal verifiziert.'
        : 'Auszahlungsmethode wurde gespeichert und wartet auf Verifizierung.',
    }, { status: 201 });
  } catch (error) {
    console.error('Payout method create error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Auszahlungsmethode konnte nicht gespeichert werden.',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeIban(value: unknown) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function isValidIbanShape(iban: string) {
  return /^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban);
}

function hasPayoutRole(roles: string[]) {
  return roles.some((role) => role === 'CARRIER' || role === 'DISPATCHER' || role === 'DRIVER_SELF_EMPLOYED');
}
