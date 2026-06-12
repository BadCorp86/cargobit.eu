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

  const headerUserId = request.headers.get('x-user-id');
  if (headerUserId && process.env.NODE_ENV !== 'production') {
    return loadRequestUser(headerUserId);
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
