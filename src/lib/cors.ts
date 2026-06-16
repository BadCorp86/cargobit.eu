import type { NextRequest } from 'next/server';

interface CorsOptions {
  methods?: string;
  headers?: string;
}

export function buildCorsHeaders(
  request: NextRequest,
  options: CorsOptions = {},
): Record<string, string> {
  const allowedOrigin = getAllowedCorsOrigin(request);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': options.methods || 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': options.headers || getAllowedCorsHeaders(),
    'Access-Control-Max-Age': '86400',
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers.Vary = 'Origin';
  }

  return headers;
}

function getAllowedCorsHeaders() {
  const baseHeaders = [
    'Content-Type',
    'Authorization',
    'X-Session-Token',
  ];

  if (process.env.NODE_ENV !== 'production') {
    baseHeaders.push('X-User-Id', 'X-User-Role', 'X-User-Roles', 'X-Driver-Id');
  }

  return baseHeaders.join(', ');
}

function getAllowedCorsOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => process.env.NODE_ENV !== 'production' || entry !== '*')
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    if (origin && configuredOrigins.includes(origin)) return origin;
    return configuredOrigins[0];
  }

  if (process.env.NODE_ENV !== 'production') {
    return origin || '*';
  }

  return process.env.NEXT_PUBLIC_APP_URL || null;
}
