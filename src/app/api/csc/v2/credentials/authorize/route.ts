// CSC v2 Spec §11.4 — credentials/authorize
// SCAL2 flow: tenant provides PIN + hash values → service returns SAD token.
// The SAD (Signature Activation Data) is a JWT bound to the specific hashes.
// It is single-use and expires after 5 minutes.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, isAuthError } from '@/lib/middleware';
import { getDb } from '@/lib/db';
import { verifySecret } from '@/lib/auth';
import { SignJWT } from 'jose';
import crypto from 'crypto';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const SAD_EXPIRY_MINUTES = 5;

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const { credentialID, PIN, hash, numSignatures } = body;

  if (!credentialID) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'credentialID is required' },
      { status: 400 }
    );
  }
  if (!PIN) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'PIN is required for SCAL2' },
      { status: 400 }
    );
  }
  if (!hash || !Array.isArray(hash) || hash.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'hash array is required (base64-encoded hash values)' },
      { status: 400 }
    );
  }

  const sql = getDb();

  // Verify credential belongs to tenant
  const credRows = await sql`SELECT id FROM credentials WHERE credential_id = ${credentialID} AND tenant_id = ${auth.tenantId} AND status = ${'active'}`;
  if (credRows.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Credential not found or not active' },
      { status: 404 }
    );
  }

  // Verify PIN against tenant's stored hash
  const tenantRows = await sql`SELECT pin_hash FROM tenants WHERE id = ${auth.tenantId}`;
  const pinValid = await verifySecret(PIN, tenantRows[0]!.pin_hash as string);
  if (!pinValid) {
    return NextResponse.json(
      { error: 'invalid_pin', error_description: 'Invalid PIN' },
      { status: 401 }
    );
  }

  // Generate SAD token — JWT bound to the specific hash values
  const expiresAt = new Date(Date.now() + SAD_EXPIRY_MINUTES * 60 * 1000);
  const sad = await new SignJWT({
    credentialID,
    tenantId: auth.tenantId,
    hashValues: hash,
    numSignatures: numSignatures || hash.length,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setIssuer('qualified-eseal-by-sk-id')
    .setSubject('sad')
    .sign(JWT_SECRET);

  // Track SAD for single-use enforcement
  const tokenHash = crypto.createHash('sha256').update(sad).digest('hex');
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';

  await sql`INSERT INTO sad_tokens (tenant_id, credential_id, token_hash, hash_values, expires_at) VALUES (${auth.tenantId}, ${credentialID}, ${tokenHash}, ${hash}, ${expiresAt.toISOString()})`;

  await sql`INSERT INTO audit_log (tenant_id, credential_id, operation, hash_values, ip_address, user_agent) VALUES (${auth.tenantId}, ${credentialID}, ${'credential_authorized'}, ${hash}, ${ip}, ${ua})`;

  return NextResponse.json({
    SAD: sad,
    expiresIn: SAD_EXPIRY_MINUTES * 60,
  });
}
