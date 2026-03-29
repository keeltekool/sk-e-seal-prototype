// CSC v2 Spec: OAuth 2.0 Client Credentials (RFC 6749 §4.4)
// Issues access tokens for M2M e-seal operations.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifySecret, generateAccessToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';

  let clientId: string | null = null;
  let clientSecret: string | null = null;
  let grantType: string | null = null;

  // Support both form-urlencoded (RFC 6749) and JSON
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    clientId = formData.get('client_id') as string;
    clientSecret = formData.get('client_secret') as string;
    grantType = formData.get('grant_type') as string;
  } else {
    const body = await request.json();
    clientId = body.client_id;
    clientSecret = body.client_secret;
    grantType = body.grant_type;
  }

  if (grantType !== 'client_credentials') {
    return NextResponse.json(
      { error: 'unsupported_grant_type', error_description: 'Only client_credentials is supported' },
      { status: 400 }
    );
  }

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'client_id and client_secret are required' },
      { status: 400 }
    );
  }

  const sql = getDb();
  const rows = await sql`SELECT id, client_secret_hash, status FROM tenants WHERE client_id = ${clientId}`;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Unknown client_id' },
      { status: 401 }
    );
  }

  const tenant = rows[0]!;

  if (tenant.status !== 'active') {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Client account is not active' },
      { status: 401 }
    );
  }

  const valid = await verifySecret(clientSecret, tenant.client_secret_hash as string);
  if (!valid) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Invalid client_secret' },
      { status: 401 }
    );
  }

  const accessToken = await generateAccessToken(tenant.id as string, clientId);

  // Audit log
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  await sql`INSERT INTO audit_log (tenant_id, credential_id, operation, ip_address, user_agent) VALUES (${tenant.id}, ${'N/A'}, ${'token_issued'}, ${ip}, ${ua})`;

  // RFC 6749 §5.1 response format
  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
  });
}
