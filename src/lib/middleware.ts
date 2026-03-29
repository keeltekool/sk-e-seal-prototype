// Validates Bearer token on all /csc/v2/* routes.
// CSC v2 Spec §8: All CSC API calls require a valid access token.
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

export interface AuthenticatedRequest {
  tenantId: string;
  clientId: string;
}

export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedRequest | NextResponse> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'access_denied', error_description: 'Missing or invalid Authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verifyAccessToken(token);
    return { tenantId: payload.tenantId, clientId: payload.clientId };
  } catch {
    return NextResponse.json(
      { error: 'access_denied', error_description: 'Invalid or expired access token' },
      { status: 401 }
    );
  }
}

export function isAuthError(result: AuthenticatedRequest | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
