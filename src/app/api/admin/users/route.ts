/**
 * CargoBit Admin Users API
 * 
 * GET /api/admin/users - List all platform users
 * POST /api/admin/users - Create new admin user
 * 
 * RBAC: ADMIN role only
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import { adminAuthService } from '@/services/admin-auth.service';
import { AdminRole as PrismaAdminRole } from '@prisma/client';

// ============================================
// GET: LIST PLATFORM USERS
// ============================================

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const status = parseUserStatus(searchParams.get('status'));
    const role = parseUserRole(searchParams.get('role'));
    const limit = parseLimit(searchParams.get('limit'));
    const offset = Number(searchParams.get('offset') || 0);

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (role) {
      where.roles = {
        some: {
          role: { name: role },
        },
      };
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { companyUsers: { some: { company: { name: { contains: search, mode: 'insensitive' } } } } },
      ];
    }

    const [users, total, active, pending, blocked, suspended, verificationPending, securityFlags] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: Number.isFinite(offset) && offset > 0 ? offset : 0,
        include: {
          roles: {
            include: {
              role: true,
            },
          },
          companyUsers: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  status: true,
                  country: true,
                },
              },
            },
          },
          verifications: {
            select: {
              id: true,
              type: true,
              status: true,
            },
          },
          securityFlags: {
            where: { active: true },
            select: {
              id: true,
              type: true,
              severity: true,
            },
          },
          wallet: {
            select: {
              id: true,
              balance: true,
              reservedBalance: true,
              currency: true,
              status: true,
            },
          },
          driver: {
            select: {
              id: true,
              isAvailable: true,
              ratingAvg: true,
              completedTransports: true,
              damageCount: true,
            },
          },
          transportsAsShipper: {
            select: {
              id: true,
              status: true,
            },
          },
          paymentsAsShipper: {
            select: { id: true },
          },
          paymentsAsTransporter: {
            select: { id: true },
          },
          supportTickets: {
            select: {
              id: true,
              status: true,
              priority: true,
            },
          },
          payouts: {
            select: {
              id: true,
              status: true,
              amountCents: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'PENDING' } }),
      prisma.user.count({ where: { status: 'BLOCKED' } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
      prisma.verification.count({ where: { status: 'PENDING' } }),
      prisma.securityFlag.count({ where: { active: true } }),
    ]);

    return NextResponse.json({
      users: users.map(formatPlatformUser),
      summary: {
        total,
        active,
        pending,
        blocked,
        suspended,
        verificationPending,
        securityFlags,
      },
      total,
      limit,
      offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    });
  }, [AdminRole.ADMIN]);
}

function parseLimit(value: string | null) {
  const limit = Number(value || 50);
  return Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
}

function parseUserStatus(value: string | null) {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return Object.values(UserStatus).includes(normalized as UserStatus)
    ? normalized as UserStatus
    : null;
}

function parseUserRole(value: string | null) {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return Object.values(UserRole).includes(normalized as UserRole)
    ? normalized as UserRole
    : null;
}

function formatPlatformUser(user: any) {
  const companies = user.companyUsers?.map((relation: any) => relation.company).filter(Boolean) || [];
  const roles = user.roles?.map((relation: any) => relation.role?.name).filter(Boolean) || [];
  const verifications = user.verifications || [];
  const supportTickets = user.supportTickets || [];
  const openTickets = supportTickets.filter((ticket: any) => ['OPEN', 'IN_PROGRESS'].includes(ticket.status));
  const transports = user.transportsAsShipper || [];
  const completedTransports = transports.filter((transport: any) => transport.status === 'COMPLETED');
  const activeTransports = transports.filter((transport: any) => ['PUBLISHED', 'ASSIGNED', 'IN_TRANSIT', 'PICKUP_DONE', 'DELIVERY_DONE'].includes(transport.status));

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
    phone: user.phone,
    language: user.language,
    status: user.status,
    roles,
    primaryRole: roles[0] || 'SHIPPER_PRIVATE',
    companies: companies.map((company: any) => ({
      id: company.id,
      name: company.name,
      type: company.type,
      status: company.status,
      country: company.country,
    })),
    primaryCompany: companies[0]
      ? {
          id: companies[0].id,
          name: companies[0].name,
          type: companies[0].type,
          status: companies[0].status,
          country: companies[0].country,
        }
      : null,
    verification: {
      total: verifications.length,
      approved: verifications.filter((verification: any) => verification.status === 'APPROVED').length,
      pending: verifications.filter((verification: any) => verification.status === 'PENDING').length,
      rejected: verifications.filter((verification: any) => verification.status === 'REJECTED').length,
    },
    risk: {
      activeFlags: user.securityFlags?.length || 0,
      highestSeverity: highestSeverity(user.securityFlags || []),
      openTickets: openTickets.length,
      urgentTickets: supportTickets.filter((ticket: any) => ticket.priority === 'URGENT').length,
    },
    wallet: user.wallet
      ? {
          id: user.wallet.id,
          balance: user.wallet.balance,
          reservedBalance: user.wallet.reservedBalance,
          availableBalance: user.wallet.balance - user.wallet.reservedBalance,
          currency: user.wallet.currency,
          status: user.wallet.status,
        }
      : null,
    activity: {
      transportsTotal: transports.length,
      transportsActive: activeTransports.length,
      transportsCompleted: completedTransports.length,
      payments: (user.paymentsAsShipper?.length || 0) + (user.paymentsAsTransporter?.length || 0),
      payouts: user.payouts?.length || 0,
    },
    driver: user.driver
      ? {
          id: user.driver.id,
          isAvailable: user.driver.isAvailable,
          ratingAvg: user.driver.ratingAvg,
          completedTransports: user.driver.completedTransports,
          damageCount: user.driver.damageCount,
        }
      : null,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function highestSeverity(flags: Array<{ severity?: string }>) {
  const order = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  return flags.reduce((highest, flag) => {
    const currentIndex = order.indexOf(flag.severity || '');
    const highestIndex = order.indexOf(highest);
    return currentIndex > highestIndex ? flag.severity || highest : highest;
  }, 'LOW');
}

// ============================================
// POST: CREATE ADMIN USER
// ============================================

export async function POST(request: NextRequest) {
  return withAdminAuth(request, async (admin) => {
    // Parse request
    let body: {
      email: string;
      password: string;
      role: string;
    };
    
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    const { email, password, role } = body;
    
    // Validate input
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, role' },
        { status: 400 }
      );
    }
    
    if (!['ADMIN', 'FINANCE', 'SUPPORT'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be: ADMIN, FINANCE, or SUPPORT' },
        { status: 400 }
      );
    }
    
    // Validate password
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }
    
    // Check if email exists
    const existing = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }
    
    // Create admin user
    try {
      const newAdmin = await adminAuthService.createAdminUser(
        email,
        password,
        role as PrismaAdminRole,
        admin.id
      );
      
      return NextResponse.json({
        id: newAdmin.id,
        email: newAdmin.email,
        role: newAdmin.role,
        is_active: true,
        is_2fa_enabled: false,
        created_at: new Date().toISOString(),
      }, { status: 201 });
      
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to create admin user' },
        { status: 500 }
      );
    }
  }, [AdminRole.ADMIN]); // ADMIN only
}
