import { prisma } from '@/lib/db';
import {
  getOrCreateWallet,
  quoteBookingFees,
  type BookingFeeQuote,
} from '@/services/fee.service';

export class WalletTopupRequiredError extends Error {
  code = 'WALLET_TOPUP_REQUIRED';
  status = 402;

  constructor(
    public details: {
      requiredAmount: number;
      availableAmount: number;
      topupAmount: number;
      currency: string;
      transportId?: string;
    },
  ) {
    super('Wallet top-up required before publishing or accepting this transport.');
  }
}

export class WalletReservationError extends Error {
  code = 'WALLET_RESERVATION_ERROR';
  status = 400;

  constructor(message: string) {
    super(message);
  }
}

export interface ReservationResult {
  wallet: any;
  feeQuote: BookingFeeQuote;
  reservedAmount: number;
  availableAmount: number;
  reservationReference: string;
  duplicate?: boolean;
}

export interface FinalizedReservationResult {
  wallet: any;
  feeQuote: BookingFeeQuote;
  reservedAmount: number;
  finalDebitAmount: number;
  releasedAmount: number;
  duplicate?: boolean;
}

export function getWalletAvailableBalance(wallet: { balance: number; reservedBalance?: number | null }) {
  return roundMoney(wallet.balance - (wallet.reservedBalance || 0));
}

export async function reserveTransportBudget(input: {
  transportId: string;
  shipperUserId: string;
  shipperCompanyId?: string | null;
  amount: number;
  currency?: string | null;
  client?: any;
}): Promise<ReservationResult> {
  const client = input.client || prisma;
  const feeQuote = await quoteBookingFees({
    amount: input.amount,
    currency: input.currency,
    shipperUserId: input.shipperUserId,
    shipperCompanyId: input.shipperCompanyId,
  });
  const wallet = await getOrCreateWallet(input.shipperUserId, client);

  if (wallet.status !== 'ACTIVE') {
    throw new WalletReservationError('Wallet ist nicht aktiv.');
  }

  const reservationReference = getReservationReference(input.transportId);
  const existingReservation = await client.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      reference: reservationReference,
      type: 'RESERVE',
    },
  });

  if (existingReservation) {
    return {
      wallet,
      feeQuote,
      reservedAmount: existingReservation.amount,
      availableAmount: getWalletAvailableBalance(wallet),
      reservationReference,
      duplicate: true,
    };
  }

  const availableAmount = getWalletAvailableBalance(wallet);

  if (availableAmount < feeQuote.shipperDebitAmount) {
    throw new WalletTopupRequiredError({
      requiredAmount: feeQuote.shipperDebitAmount,
      availableAmount,
      topupAmount: roundMoney(feeQuote.shipperDebitAmount - availableAmount),
      currency: feeQuote.currency,
      transportId: input.transportId,
    });
  }

  const updatedWallet = await client.wallet.update({
    where: { id: wallet.id },
    data: {
      reservedBalance: { increment: feeQuote.shipperDebitAmount },
    },
  });

  await client.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'RESERVE',
      amount: feeQuote.shipperDebitAmount,
      currency: feeQuote.currency,
      relatedTransportId: input.transportId,
      reference: reservationReference,
      description: `Reservierung fuer Transport ${input.transportId} auf Basis KI-Preis inkl. Wallet-Gebuehr`,
      processedAt: new Date(),
    },
  });

  return {
    wallet: updatedWallet,
    feeQuote,
    reservedAmount: feeQuote.shipperDebitAmount,
    availableAmount: getWalletAvailableBalance(updatedWallet),
    reservationReference,
  };
}

export async function finalizeTransportReservation(input: {
  transportId: string;
  shipperUserId: string;
  shipperCompanyId?: string | null;
  amount: number;
  currency?: string | null;
  bookingReference: string;
  description?: string;
  client?: any;
}): Promise<FinalizedReservationResult> {
  const client = input.client || prisma;
  const feeQuote = await quoteBookingFees({
    amount: input.amount,
    currency: input.currency,
    shipperUserId: input.shipperUserId,
    shipperCompanyId: input.shipperCompanyId,
  });
  const wallet = await getOrCreateWallet(input.shipperUserId, client);
  const existingPayment = await client.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      reference: input.bookingReference,
      type: 'PAYMENT_OUT',
    },
  });

  if (existingPayment) {
    return {
      wallet,
      feeQuote,
      reservedAmount: 0,
      finalDebitAmount: feeQuote.shipperDebitAmount,
      releasedAmount: 0,
      duplicate: true,
    };
  }

  const reservationReference = getReservationReference(input.transportId);
  const reservation = await client.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      reference: reservationReference,
      type: 'RESERVE',
    },
    orderBy: { createdAt: 'desc' },
  });
  const reservedAmount = reservation?.amount || 0;
  const extraRequired = Math.max(0, roundMoney(feeQuote.shipperDebitAmount - reservedAmount));
  const availableAmount = getWalletAvailableBalance(wallet);

  if (extraRequired > 0 && availableAmount < extraRequired) {
    throw new WalletTopupRequiredError({
      requiredAmount: feeQuote.shipperDebitAmount,
      availableAmount: roundMoney(availableAmount + reservedAmount),
      topupAmount: roundMoney(extraRequired - availableAmount),
      currency: feeQuote.currency,
      transportId: input.transportId,
    });
  }

  const reservedToRelease = Math.min(reservedAmount, wallet.reservedBalance || 0);
  const releasedAmount = Math.max(0, roundMoney(reservedAmount - feeQuote.shipperDebitAmount));

  const updatedWallet = await client.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: { decrement: feeQuote.shipperDebitAmount },
      reservedBalance: reservedToRelease
        ? { decrement: reservedToRelease }
        : undefined,
    },
  });

  await client.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'PAYMENT_OUT',
      amount: -feeQuote.shipperDebitAmount,
      currency: feeQuote.currency,
      relatedTransportId: input.transportId,
      reference: input.bookingReference,
      description: input.description || `Booking for job ${input.transportId} incl. ${feeQuote.walletFeePercent}% wallet fee`,
      processedAt: new Date(),
    },
  });

  if (reservation) {
    await client.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'RESERVE_RELEASE',
        amount: -reservedAmount,
        currency: feeQuote.currency,
        relatedTransportId: input.transportId,
        reference: `release_${reservationReference}`,
        description: releasedAmount > 0
          ? `Reservierung finalisiert, ${releasedAmount} ${feeQuote.currency} wieder verfuegbar`
          : 'Reservierung finalisiert',
        processedAt: new Date(),
      },
    });
  }

  return {
    wallet: updatedWallet,
    feeQuote,
    reservedAmount,
    finalDebitAmount: feeQuote.shipperDebitAmount,
    releasedAmount,
  };
}

export async function releaseTransportReservation(input: {
  transportId: string;
  shipperUserId: string;
  reason: string;
  client?: any;
}) {
  const client = input.client || prisma;
  const wallet = await getOrCreateWallet(input.shipperUserId, client);
  const reservationReference = getReservationReference(input.transportId);
  const reservation = await client.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      reference: reservationReference,
      type: 'RESERVE',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!reservation) return { wallet, releasedAmount: 0 };

  const alreadyReleased = await client.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      reference: `release_${reservationReference}`,
      type: 'RESERVE_RELEASE',
    },
  });

  if (alreadyReleased) return { wallet, releasedAmount: 0, duplicate: true };

  const reservedToRelease = Math.min(reservation.amount, wallet.reservedBalance || 0);
  const updatedWallet = reservedToRelease
    ? await client.wallet.update({
        where: { id: wallet.id },
        data: { reservedBalance: { decrement: reservedToRelease } },
      })
    : wallet;

  await client.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'RESERVE_RELEASE',
      amount: -reservation.amount,
      currency: reservation.currency,
      relatedTransportId: input.transportId,
      reference: `release_${reservationReference}`,
      description: input.reason,
      processedAt: new Date(),
    },
  });

  return { wallet: updatedWallet, releasedAmount: reservation.amount };
}

export function getReservationReference(transportId: string) {
  return `reservation_${transportId}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
