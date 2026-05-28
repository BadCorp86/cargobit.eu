import { NextRequest, NextResponse } from 'next/server';

export function verifyCronRequest(request: NextRequest): NextResponse | null {
  const expectedSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get('authorization') || '';
  const bearerSecret = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const headerSecret = request.headers.get('x-cron-secret')?.trim();
  const providedSecret = bearerSecret || headerSecret || '';

  if (!expectedSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error: 'ConfigurationError',
        message: 'CRON_SECRET is required in production',
        code: 'CRON_SECRET_MISSING',
      },
      { status: 500 },
    );
  }

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json(
      {
        error: 'UnauthorizedError',
        message: 'Invalid cron secret',
        code: 'UNAUTHORIZED',
      },
      { status: 401 },
    );
  }

  return null;
}
