// CSC v2 Spec §11.7 — signatures/signHash
// Core signing endpoint: validates SAD, decrypts private key, signs hash(es).
// Returns raw RSA signature(s) in base64.
// CRITICAL: This signs whatever hash is provided. For PAdES, the client SDK
// must send the hash of DER-encoded SignedAttributes, NOT the raw PDF hash.
// See SCOPE.md §7 "CMS signing subtlety" and node-signpdf issue #46.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, isAuthError } from '@/lib/middleware';
import { getDb } from '@/lib/db';
import { decryptPrivateKey } from '@/lib/crypto';
import { jwtVerify } from 'jose';
import forge from 'node-forge';
import crypto from 'crypto';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const { credentialID, SAD, hash } = body;

  if (!credentialID || !SAD || !hash || !Array.isArray(hash) || hash.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'credentialID, SAD, and hash[] are required' },
      { status: 400 }
    );
  }

  // Verify and decode SAD
  let sadPayload;
  try {
    const { payload } = await jwtVerify(SAD, JWT_SECRET, {
      issuer: 'qualified-eseal-by-sk-id',
      subject: 'sad',
    });
    sadPayload = payload;
  } catch {
    return NextResponse.json(
      { error: 'invalid_sad', error_description: 'SAD token is invalid or expired' },
      { status: 400 }
    );
  }

  // Verify SAD is bound to this credential and tenant
  if (sadPayload.credentialID !== credentialID || sadPayload.tenantId !== auth.tenantId) {
    return NextResponse.json(
      { error: 'invalid_sad', error_description: 'SAD is not bound to this credential' },
      { status: 403 }
    );
  }

  // Verify SAD is single-use
  const sql = getDb();
  const tokenHash = crypto.createHash('sha256').update(SAD).digest('hex');
  const sadRows = await sql`SELECT id, used FROM sad_tokens WHERE token_hash = ${tokenHash}`;

  if (sadRows.length === 0) {
    return NextResponse.json(
      { error: 'invalid_sad', error_description: 'SAD token not found' },
      { status: 400 }
    );
  }

  if (sadRows[0]!.used) {
    return NextResponse.json(
      { error: 'invalid_sad', error_description: 'SAD token has already been used' },
      { status: 400 }
    );
  }

  // Mark SAD as used (single-use enforcement)
  await sql`UPDATE sad_tokens SET used = TRUE WHERE id = ${sadRows[0]!.id}`;

  // Load credential and decrypt private key
  const credRows = await sql`SELECT private_key_pem_encrypted, certificate_pem FROM credentials WHERE credential_id = ${credentialID} AND tenant_id = ${auth.tenantId}`;

  if (credRows.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Credential not found' },
      { status: 404 }
    );
  }

  const privateKeyPem = decryptPrivateKey(credRows[0]!.private_key_pem_encrypted as string);
  // Strip \r from Windows-style line endings — forge requires \n-only PEM
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem.replace(/\r/g, ''));

  // Sign each hash with PKCS#1 v1.5 + SHA-256 DigestInfo
  const signatures: string[] = [];
  for (const hashB64 of hash) {
    const hashBytes = forge.util.decode64(hashB64);

    // Build DigestInfo ASN.1 structure for SHA-256
    // OID: 2.16.840.1.101.3.4.2.1
    const digestInfoDer = forge.asn1.toDer(
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
            forge.asn1.oidToDer('2.16.840.1.101.3.4.2.1').getBytes()),
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, ''),
        ]),
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, hashBytes),
      ])
    ).getBytes();

    // PKCS#1 v1.5 sign the DigestInfo
    const signature = privateKey.sign(digestInfoDer, 'NONE');
    signatures.push(forge.util.encode64(signature));
  }

  // Audit log
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  await sql`INSERT INTO audit_log (tenant_id, credential_id, operation, hash_values, ip_address, user_agent) VALUES (${auth.tenantId}, ${credentialID}, ${'hash_signed'}, ${hash}, ${ip}, ${ua})`;

  return NextResponse.json({
    signatures,
  });
}
