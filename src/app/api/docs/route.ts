/**
 * CargoBit Admin API - OpenAPI Documentation
 * 
 * GET /api/docs - Returns OpenAPI 3.0 specification as JSON
 * 
 * This endpoint serves the complete OpenAPI specification for the CargoBit Admin API,
 * including all endpoints, schemas, and Bearer Authentication configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildCorsHeaders } from '@/lib/cors';
import { generateOpenAPISpec } from '@/lib/openapi';

export async function GET(request: NextRequest) {
  const spec = generateOpenAPISpec();
  
  return NextResponse.json(spec, {
    headers: {
      'Content-Type': 'application/json',
      ...buildCorsHeaders(request, { methods: 'GET, OPTIONS' }),
    },
  });
}

// Also support OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(request, { methods: 'GET, OPTIONS', headers: 'Content-Type' }),
  });
}
