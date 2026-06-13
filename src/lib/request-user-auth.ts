import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export interface RequestUser {
  id: string;
  email: string;
  roles: string[];
}

export async function getOptionalRequestUser(request: NextRequest): Promise<RequestUser | null> {
  const token = getUserToken(request);
  if (token) {
    const session = await validateUserSession(token);
    if (session?.userId) {
      return loadRequestUser(session.userId);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    return resolveDevRequestUser(request);
  }

  return null;
}

export async function requireRequestUser(request: NextRequest) {
  const user = await getOptionalRequestUser(request);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({
        error: 'UnauthorizedError',
        message: 'Authentifizierung erforderlich',
        code: 'AUTH_REQUIRED',
      }, { status: 401 }),
    };
  }

  return { user, response: null };
}

export function requestUserHasAnyRole(user: RequestUser, roles: string[]) {
  return user.roles.some((role) => roles.includes(role));
}

function getUserToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return request.cookies.get('user_session')?.value
    || request.cookies.get('cargobit_session')?.value
    || request.cookies.get('session_token')?.value
    || request.cookies.get('session')?.value
    || '';
}

async function loadRequestUser(userId: string): Promise<RequestUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: { role: true },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    roles: user.roles.map((userRole) => userRole.role.name),
  };
}

async function resolveDevRequestUser(request: NextRequest): Promise<RequestUser | null> {
  const headerUserId = cleanHeader(request.headers.get('x-user-id'), 128);
  const headerEmail = cleanHeader(request.headers.get('x-user-email'), 254).toLowerCase();
  const headerRole = cleanHeader(
    request.headers.get('x-user-role') || request.headers.get('x-user-roles'),
    80,
  );

  if (headerUserId) {
    const user = await loadRequestUser(headerUserId);
    if (user) return user;
  }

  if (!headerEmail) return null;

  const existingUser = await db.user.findUnique({
    where: { email: headerEmail },
    include: { roles: { include: { role: true } } },
  });

  if (existingUser) {
    return {
      id: existingUser.id,
      email: existingUser.email,
      roles: existingUser.roles.map((userRole) => userRole.role.name),
    };
  }

  const roleName = normalizeDevUserRole(headerRole);
  const createdUser = await db.user.create({
    data: {
      ...(headerUserId ? { id: headerUserId } : {}),
      email: headerEmail,
      passwordHash: 'auth-store-demo-user',
      firstName: 'CargoBit',
      lastName: 'Nutzer',
      status: 'ACTIVE',
      roles: {
        create: {
          role: {
            connectOrCreate: {
              where: { name: roleName },
              create: {
                name: roleName,
                description: 'Auto-created from local CargoBit auth store',
              },
            },
          },
        },
      },
    },
    include: { roles: { include: { role: true } } },
  });

  return {
    id: createdUser.id,
    email: createdUser.email,
    roles: createdUser.roles.map((userRole) => userRole.role.name),
  };
}

function cleanHeader(value: string | null, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeDevUserRole(role: string) {
  const firstRole = role.split(',')[0]?.trim() || '';
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
  return allowed.has(firstRole) ? firstRole as any : 'SHIPPER_PRIVATE';
}

async function validateUserSession(token: string): Promise<{ userId: string; sessionId: string } | null> {
  const result = await db.$queryRaw<Array<{ id: string; user_id: string }>>`
    SELECT id, user_id FROM sessions
    WHERE token = ${token} AND expires_at > ${new Date()}
    LIMIT 1
  `.catch(() => []);

  if (!result.length) return null;

  await db.$executeRaw`
    UPDATE sessions SET last_activity = ${new Date()} WHERE id = ${result[0].id}
  `.catch(() => undefined);

  return {
    userId: result[0].user_id,
    sessionId: result[0].id,
  };
}
