/**
 * CargoBit Bids Service
 * Offer Management for Jobs
 * 
 * BID STATUS FLOW:
 * pending → accepted | rejected | withdrawn
 * 
 * Python equivalent for Redis broadcasting:
 * ```python
 * def notify_user(user_id, message):
 *     publish_event(
 *         f"user:{user_id}",
 *         {"userId": str(user_id), "message": message}
 *     )
 * ```
 */

import { prisma } from '@/lib/db';
import { broadcastNewBid, notifyUser, broadcastJobStatus } from './redis-publisher.service';
import {
  getOrCreatePlatformWallet,
  getOrCreateWallet,
  quoteBookingFees,
} from './fee.service';
import { finalizeTransportReservation } from './wallet-reservation.service';

// ============================================
// TYPES
// ============================================

export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface CreateBidInput {
  jobId: string;
  transporterId: string;
  vehicleId: string;
  price: number;
  currency?: string;
  message?: string;
  estimatedDuration?: number;  // minutes
  validUntilHours?: number;    // hours from now
}

export interface BidWithDetails {
  id: string;
  jobId: string;
  transporterId: string;
  transporterName?: string;
  transporterRating: number;
  vehicleId: string;
  vehicleType: string;
  price: number;
  currency: string;
  message?: string;
  estimatedDuration?: number;
  status: BidStatus;
  createdAt: Date;
  validUntil?: Date;
}

// ============================================
// CREATE BID
// ============================================

export async function createBid(input: CreateBidInput): Promise<{ bidId: string; status: string }> {
  console.log(`[Bids] Creating bid for job ${input.jobId} by transporter ${input.transporterId}`);
  
  // Verify job is open for bids
  const transport = await prisma.transport.findUnique({
    where: { id: input.jobId },
  });
  
  if (!transport) {
    throw new Error('Job not found');
  }
  
  if (transport.status !== 'PUBLISHED') {
    throw new Error('Job is not open for bids');
  }
  
  // Check if transporter already bid
  const existingBid = await prisma.offer.findFirst({
    where: {
      transportId: input.jobId,
      driverId: input.transporterId,
      status: { in: ['PENDING', 'ACCEPTED'] },
    },
  });
  
  if (existingBid) {
    throw new Error('You already have an active bid for this job');
  }
  
  // Verify transporter has access to this job (was matched)
  const matchingCandidate = await prisma.matchingCandidate.findFirst({
    where: {
      matchingSession: { transportId: input.jobId },
      driverId: input.transporterId,
      status: 'PENDING',
    },
  });
  
  // If not in matching, they can still bid but with lower priority
  const isMatched = !!matchingCandidate;
  
  // Create bid
  const validUntil = input.validUntilHours
    ? new Date(Date.now() + input.validUntilHours * 60 * 60 * 1000)
    : new Date(Date.now() + 24 * 60 * 60 * 1000); // Default 24 hours
  
  const offer = await prisma.offer.create({
    data: {
      transportId: input.jobId,
      driverId: input.transporterId,
      vehicleId: input.vehicleId,
      price: input.price,
      currency: input.currency ?? 'EUR',
      message: input.message,
      estimatedDuration: input.estimatedDuration,
      status: 'PENDING',
      validUntil,
    },
  });
  
  // Update matching candidate status if exists
  if (matchingCandidate) {
    await prisma.matchingCandidate.update({
      where: { id: matchingCandidate.id },
      data: { status: 'NOTIFIED' }, // They've been notified (via bid)
    });
  }
  
  // Notify shipper
  await notifyShipperOfBid(input.jobId, offer.id, input.price);
  
  return {
    bidId: offer.id,
    status: 'pending',
  };
}

// ============================================
// GET BIDS FOR JOB
// ============================================

export async function getBidsForJob(
  jobId: string,
  userId: string
): Promise<BidWithDetails[]> {
  // Verify user is the shipper
  const transport = await prisma.transport.findUnique({
    where: { id: jobId },
  });
  
  if (!transport) {
    throw new Error('Job not found');
  }
  
  if (transport.shipperUserId !== userId) {
    // Check if user is the transporter with a bid
    const transporterBid = await prisma.offer.findFirst({
      where: { transportId: jobId, driverId: userId },
    });
    
    if (!transporterBid) {
      throw new Error('Not authorized');
    }
    
    // Return only their bid
    return [await mapBidToDetails(transporterBid)];
  }
  
  // Get all bids for shipper
  const offers = await prisma.offer.findMany({
    where: { transportId: jobId },
    orderBy: [
      { status: 'asc' }, // Pending first
      { createdAt: 'asc' },
    ],
    include: {
      driver: {
        include: {
          user: {
            include: {
              companyUsers: {
                include: { company: true },
              },
            },
          },
        },
      },
      vehicle: true,
    },
  });
  
  return offers.map(offer => ({
    id: offer.id,
    jobId: offer.transportId,
    transporterId: offer.driverId,
    transporterName: offer.driver.user.companyUsers[0]?.company.name 
      || `${offer.driver.user.firstName} ${offer.driver.user.lastName}`,
    transporterRating: offer.driver.ratingAvg,
    vehicleId: offer.vehicleId,
    vehicleType: offer.vehicle.type,
    price: offer.price,
    currency: offer.currency,
    message: offer.message ?? undefined,
    estimatedDuration: offer.estimatedDuration ?? undefined,
    status: mapBidStatus(offer.status),
    createdAt: offer.createdAt,
    validUntil: offer.validUntil ?? undefined,
  }));
}

// ============================================
// ACCEPT BID
// ============================================

export async function acceptBid(
  bidId: string,
  userId: string
): Promise<{ success: boolean; jobId: string; agreedPrice: number }> {
  console.log(`[Bids] Accepting bid ${bidId}`);
  
  // Get bid with transport details
  const offer = await prisma.offer.findUnique({
    where: { id: bidId },
    include: {
      transport: true,
      driver: true,
    },
  });
  
  if (!offer) {
    throw new Error('Bid not found');
  }
  
  // Verify user is the shipper
  if (offer.transport.shipperUserId !== userId) {
    throw new Error('Not authorized');
  }
  
  // Verify bid is still pending
  if (offer.status !== 'PENDING') {
    throw new Error(`Bid is already ${offer.status.toLowerCase()}`);
  }
  
  // Verify job is not already assigned
  if (offer.transport.status !== 'PUBLISHED') {
    throw new Error('Job is not bookable');
  }
  
  // Process booking (wallet transactions)
  const bookingResult = await processBooking(offer);
  
  if (!bookingResult.success) {
    throw new Error('Booking failed: ' + bookingResult.error);
  }
  
  // Update bid status
  await prisma.offer.update({
    where: { id: bidId },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    },
  });
  
  // Create assignment
  await prisma.assignment.create({
    data: {
      transportId: offer.transportId,
      driverId: offer.driverId,
      vehicleId: offer.vehicleId,
      assignedBy: userId,
    },
  });
  
  // Update transport
  await prisma.transport.update({
    where: { id: offer.transportId },
    data: {
      status: 'ASSIGNED',
      agreedPrice: offer.price,
      assignedAt: new Date(),
    },
  });
  
  // Reject other pending bids
  await prisma.offer.updateMany({
    where: {
      transportId: offer.transportId,
      status: 'PENDING',
      id: { not: bidId },
    },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionReason: 'Another bid was accepted',
    },
  });
  
  // Notify transporter
  await notifyTransporterOfAcceptance(offer);
  
  return {
    success: true,
    jobId: offer.transportId,
    agreedPrice: offer.price,
  };
}

// ============================================
// REJECT BID
// ============================================

export async function rejectBid(
  bidId: string,
  userId: string,
  reason?: string
): Promise<{ success: boolean }> {
  const offer = await prisma.offer.findUnique({
    where: { id: bidId },
    include: { transport: true },
  });
  
  if (!offer) {
    throw new Error('Bid not found');
  }
  
  // Verify user is the shipper
  if (offer.transport.shipperUserId !== userId) {
    throw new Error('Not authorized');
  }
  
  if (offer.status !== 'PENDING') {
    throw new Error(`Bid is already ${offer.status.toLowerCase()}`);
  }
  
  await prisma.offer.update({
    where: { id: bidId },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionReason: reason,
    },
  });
  
  // Update matching candidate if exists
  await prisma.matchingCandidate.updateMany({
    where: {
      matchingSession: { transportId: offer.transportId },
      driverId: offer.driverId,
    },
    data: { status: 'REJECTED' },
  });
  
  return { success: true };
}

// ============================================
// WITHDRAW BID
// ============================================

export async function withdrawBid(
  bidId: string,
  userId: string
): Promise<{ success: boolean }> {
  const offer = await prisma.offer.findUnique({
    where: { id: bidId },
  });
  
  if (!offer) {
    throw new Error('Bid not found');
  }
  
  // Verify user is the transporter
  if (offer.driverId !== userId) {
    throw new Error('Not authorized');
  }
  
  if (offer.status !== 'PENDING') {
    throw new Error(`Bid is already ${offer.status.toLowerCase()}`);
  }
  
  await prisma.offer.update({
    where: { id: bidId },
    data: { status: 'WITHDRAWN' },
  });
  
  return { success: true };
}

// ============================================
// PROCESS BOOKING (Wallet Operations)
// ============================================

async function processBooking(offer: any): Promise<{ success: boolean; error?: string }> {
  try {
    const transport = offer.transport;
    const amount = offer.price;
    const transporterUserId = offer.driver.userId;
    const feeQuote = await quoteBookingFees({
      amount,
      currency: offer.currency,
      shipperUserId: transport.shipperUserId,
      shipperCompanyId: transport.shipperCompanyId,
    });
    
    // Get transporter's wallet
    const transporterWallet = await getOrCreateWallet(transporterUserId);
    
    // Get platform wallet (for fees)
    const platformWallet = await getOrCreatePlatformWallet();
    
    // Run transaction
    await prisma.$transaction(async (tx) => {
      const finalizedBooking = await finalizeTransportReservation({
        transportId: transport.id,
        shipperUserId: transport.shipperUserId,
        shipperCompanyId: transport.shipperCompanyId,
        amount,
        currency: offer.currency,
        bookingReference: offer.id,
        description: `Payment for job ${transport.id} incl. ${feeQuote.walletFeePercent}% wallet fee`,
        client: tx,
      });
      
      // 2. Credit platform fee
      await tx.wallet.update({
        where: { id: platformWallet.id },
        data: { balance: { increment: finalizedBooking.feeQuote.platformCreditAmount } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: platformWallet.id,
          type: 'COMMISSION',
          amount: finalizedBooking.feeQuote.platformCreditAmount,
          currency: finalizedBooking.feeQuote.currency,
          relatedTransportId: transport.id,
          description: `CargoBit fees for job ${transport.id}: ${finalizedBooking.feeQuote.commissionPercent}% commission + ${finalizedBooking.feeQuote.walletFeePercent}% wallet fee`,
          processedAt: new Date(),
        },
      });
      
      // 3. Mark transporter settlement as pending. The actual wallet credit is released
      // after POD/eCMR and invoice gates have passed.
      await tx.walletTransaction.create({
        data: {
          walletId: transporterWallet.id,
          type: 'PAYMENT_IN',
          amount: 0,
          currency: finalizedBooking.feeQuote.currency,
          relatedTransportId: transport.id,
          reference: `pending_${offer.id}`,
          description: `Settlement pending for job ${transport.id}: ${finalizedBooking.feeQuote.transporterCreditAmount} ${finalizedBooking.feeQuote.currency} after POD and invoice`,
        },
      });
      
      // 4. Record commission
      await tx.commission.create({
        data: {
          transportId: transport.id,
          plan: finalizedBooking.feeQuote.plan,
          commissionPercent: finalizedBooking.feeQuote.commissionPercent,
          commissionAmount: finalizedBooking.feeQuote.commissionAmount,
          walletFeePercent: finalizedBooking.feeQuote.walletFeePercent,
          walletFeeAmount: finalizedBooking.feeQuote.walletFeeAmount,
        },
      });
    });
    
    console.log(`[Bids] Booking processed: ${amount} EUR (commission: ${feeQuote.commissionAmount}, wallet fee: ${feeQuote.walletFeeAmount}, payout: ${feeQuote.transporterCreditAmount})`);
    
    return { success: true };
  } catch (error) {
    console.error('[Bids] Booking failed:', error);
    return { success: false, error: 'Transaction failed' };
  }
}

// ============================================
// HELPERS
// ============================================

function mapBidStatus(status: string): BidStatus {
  const map: Record<string, BidStatus> = {
    'PENDING': 'pending',
    'ACCEPTED': 'accepted',
    'REJECTED': 'rejected',
    'WITHDRAWN': 'withdrawn',
  };
  return map[status] ?? 'pending';
}

async function mapBidToDetails(offer: any): Promise<BidWithDetails> {
  const offerWithIncludes = await prisma.offer.findUnique({
    where: { id: offer.id },
    include: {
      driver: {
        include: {
          user: {
            include: {
              companyUsers: {
                include: { company: true },
              },
            },
          },
        },
      },
      vehicle: true,
    },
  });
  
  return {
    id: offer.id,
    jobId: offer.transportId,
    transporterId: offer.driverId,
    transporterName: offerWithIncludes?.driver.user.companyUsers[0]?.company.name
      || `${offerWithIncludes?.driver.user.firstName} ${offerWithIncludes?.driver.user.lastName}`,
    transporterRating: offerWithIncludes?.driver.ratingAvg ?? 0,
    vehicleId: offer.vehicleId,
    vehicleType: offerWithIncludes?.vehicle.type ?? 'UNKNOWN',
    price: offer.price,
    currency: offer.currency,
    message: offer.message ?? undefined,
    estimatedDuration: offer.estimatedDuration ?? undefined,
    status: mapBidStatus(offer.status),
    createdAt: offer.createdAt,
    validUntil: offer.validUntil ?? undefined,
  };
}

async function notifyShipperOfBid(jobId: string, bidId: string, price: number): Promise<void> {
  const transport = await prisma.transport.findUnique({
    where: { id: jobId },
  });
  
  if (!transport) return;
  
  // Create database notification
  await prisma.notification.create({
    data: {
      userId: transport.shipperUserId,
      type: 'NEW_OFFER',
      title: 'Neues Angebot erhalten',
      message: `Ein Transporteur hat ein Angebot über ${price} EUR abgegeben.`,
      data: JSON.stringify({ jobId, bidId }),
    },
  });
  
  // Broadcast via Redis for real-time notification
  // Python equivalent: notify_user(user_id, message)
  await notifyUser(
    transport.shipperUserId,
    `New bid received: €${price}`,
    'info',
    { jobId, bidId, price, type: 'NEW_BID' }
  );
  
  // Also broadcast to job channel
  await broadcastNewBid({
    bidId,
    jobId,
    transporterId: '', // Will be filled by caller
    amount: price,
  });
}

async function notifyTransporterOfAcceptance(offer: any): Promise<void> {
  const transporterUserId = offer.driver?.userId || offer.driverId;

  // Create database notification
  await prisma.notification.create({
    data: {
      userId: transporterUserId,
      type: 'OFFER_ACCEPTED',
      title: 'Angebot angenommen!',
      message: `Dein Angebot für den Auftrag wurde angenommen. Der Preis beträgt ${offer.price} EUR.`,
      data: JSON.stringify({ jobId: offer.transportId, bidId: offer.id }),
    },
  });
  
  // Broadcast via Redis for real-time notification
  await notifyUser(
    transporterUserId,
    `Your bid was accepted! Price: €${offer.price}`,
    'success',
    { jobId: offer.transportId, bidId: offer.id, type: 'BID_ACCEPTED' }
  );
  
  // Update job status
  await broadcastJobStatus({ id: offer.transportId, status: 'booked' });
}

// ============================================
// EXPORTS
// ============================================

export const bidsService = {
  createBid,
  getBidsForJob,
  acceptBid,
  rejectBid,
  withdrawBid,
};
