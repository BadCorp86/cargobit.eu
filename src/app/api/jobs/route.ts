/**
 * CargoBit Jobs API Routes
 * POST   /api/jobs          - Create new job
 * GET    /api/jobs          - List user's jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { jobsService, type CreateJobInput, type JobStatus } from '@/services/jobs.service';
import { db } from '@/lib/db';
import { getOptionalRequestUser, requireRequestUser } from '@/lib/request-user-auth';
import { createInsuranceReferralQuote } from '@/lib/insurance/referral';
import {
  assertCanCreateTransport,
  createTransportLimitResponse,
  SubscriptionLimitError,
} from '@/services/subscription-limits.service';
import { WalletTopupRequiredError } from '@/services/wallet-reservation.service';

// ============================================
// GET /api/jobs - List jobs
// ============================================

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestUser(request);
    if (auth.response) return auth.response;

    const userId = auth.user.id;
    
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') as 'shipper' | 'transporter' || 'shipper';
    const status = searchParams.get('status') as JobStatus | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const result = await jobsService.getJobsForUser(userId, role, {
      status: status ?? undefined,
      limit,
      offset,
    });
    
    return NextResponse.json({
      jobs: result.jobs,
      total: result.total,
      limit,
      offset,
    });
    
  } catch (error: any) {
    console.error('[API] GET /jobs error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/jobs - Create job
// ============================================

export async function POST(request: NextRequest) {
  try {
    const user = await resolveJobUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();

    const hasPickupAddress = Boolean(body.pickupAddressId || body.pickupAddress);
    const hasDeliveryAddress = Boolean(body.deliveryAddressId || body.deliveryAddress);
    if (!hasPickupAddress || !hasDeliveryAddress || !body.pickupDatetime || !body.transportType) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Abholadresse, Lieferadresse, Abholdatum und Frachtart sind erforderlich.',
          code: 'MISSING_REQUIRED_JOB_FIELDS',
        },
        { status: 400 },
      );
    }

    const pickupDatetime = parseDate(body.pickupDatetime);
    const deliveryDatetime = body.deliveryDatetime ? parseDate(body.deliveryDatetime) : undefined;
    if (!pickupDatetime || (body.deliveryDatetime && !deliveryDatetime)) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Ungültiges Abhol- oder Lieferdatum.',
          code: 'INVALID_JOB_DATE',
        },
        { status: 400 },
      );
    }
    
    const input: CreateJobInput = {
      shipperUserId: user.id,
      shipperCompanyId: body.shipperCompanyId,
      pickupAddressId: body.pickupAddressId,
      pickupAddress: body.pickupAddress,
      deliveryAddressId: body.deliveryAddressId,
      deliveryAddress: body.deliveryAddress,
      pickupDatetime,
      pickupTimeFrom: body.pickupTimeFrom,
      pickupTimeTo: body.pickupTimeTo,
      deliveryDatetime,
      deliveryTimeFrom: body.deliveryTimeFrom,
      deliveryTimeTo: body.deliveryTimeTo,
      description: body.description,
      weightKg: parsePositiveNumber(body.weightKg),
      volumeM3: parsePositiveNumber(body.volumeM3),
      transportType: body.transportType,
      cargoDetails: body.cargoDetails,
      shipperBudget: parsePositiveNumber(body.shipperBudget),
      currency: body.currency,
      isInternational: body.isInternational,
      transitCountries: body.transitCountries,
      vehicleRequirements: body.vehicleRequirements,
      driverRequirements: body.driverRequirements,
      specialRequirements: body.specialRequirements,
    };

    await assertCanCreateTransport({
      shipperUserId: user.id,
      shipperCompanyId: body.shipperCompanyId,
    });
    
    const result = await jobsService.createJob(input);
    const insuranceReferral = body.insuranceReferral?.requested
      ? await createInsuranceReferralQuote({
          transportId: result.jobId,
          requestedByUserId: user.id,
          requestedByRole: 'SHIPPER',
          source: 'SHIPPER_CREATE',
          cargoDescription: body.description,
          cargoValueEur: body.insuranceReferral.cargoValueEur,
          weightKg: input.weightKg,
          pickupCity: body.insuranceReferral.pickupCity,
          pickupCountry: body.insuranceReferral.pickupCountry,
          deliveryCity: body.insuranceReferral.deliveryCity,
          deliveryCountry: body.insuranceReferral.deliveryCountry,
          consentAccepted: Boolean(body.insuranceReferral.consentAccepted),
          persistLead: true,
        })
      : null;

    try {
      await jobsService.publishJob(result.jobId);
    } catch (publishError: any) {
      if (publishError instanceof WalletTopupRequiredError) {
        return NextResponse.json({
          success: true,
          jobId: result.jobId,
          status: 'CREATED',
          actionRequired: 'WALLET_TOPUP_REQUIRED',
          wallet: publishError.details,
          message: 'Auftrag wurde als Entwurf erstellt. Bitte Zahlung vorbereiten, damit er online gehen kann.',
          insuranceReferral,
        }, { status: 201 });
      }

      if (publishError?.code === 'PRICE_REQUIRED') {
        return NextResponse.json({
          success: true,
          jobId: result.jobId,
          status: 'CREATED',
          actionRequired: 'PRICE_REQUIRED',
          message: publishError.message,
          insuranceReferral,
        }, { status: 201 });
      }

      throw publishError;
    }
    
    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      status: 'PUBLISHED',
      insuranceReferral,
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('[API] POST /jobs error:', error);

    if (error instanceof SubscriptionLimitError) {
      return NextResponse.json(
        createTransportLimitResponse(error),
        { status: error.status }
      );
    }

    if (error instanceof WalletTopupRequiredError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
          wallet: error.details,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create job' },
      { status: 500 }
    );
  }
}

function parsePositiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseDate(value: unknown) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength);
}

async function resolveJobUser(request: NextRequest) {
  const requestUser = await getOptionalRequestUser(request);
  if (requestUser) {
    return db.user.findUnique({ where: { id: requestUser.id } });
  }

  const headerUserId = cleanText(request.headers.get('x-user-id'), 128);
  const headerEmail = cleanText(request.headers.get('x-user-email'), 254).toLowerCase();
  const headerRole = cleanText(request.headers.get('x-user-role'), 80);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  if (headerUserId) {
    const user = await db.user.findUnique({ where: { id: headerUserId } });
    if (user) return user;
  }

  if (headerEmail) {
    const user = await db.user.findUnique({ where: { email: headerEmail } });
    if (user) return user;

    return db.user.create({
      data: {
        ...(headerUserId ? { id: headerUserId } : {}),
        email: headerEmail,
        passwordHash: 'auth-store-demo-user',
        firstName: 'CargoBit',
        lastName: 'Nutzer',
        status: 'ACTIVE',
        roles: headerRole
          ? {
              create: {
                role: {
                  connectOrCreate: {
                    where: { name: normalizeUserRole(headerRole) },
                    create: {
                      name: normalizeUserRole(headerRole),
                      description: 'Auto-created from local CargoBit auth store',
                    },
                  },
                },
              },
            }
          : undefined,
      },
    });
  }

  return null;
}

function normalizeUserRole(role: string) {
  const allowed = new Set([
    'ADMIN',
    'SUPPORT',
    'SHIPPER_COMPANY',
    'SHIPPER_PRIVATE',
    'CARRIER',
    'DISPATCHER',
    'DRIVER_SELF_EMPLOYED',
    'MARKETER',
  ]);
  return allowed.has(role) ? role as any : 'SHIPPER_PRIVATE';
}
