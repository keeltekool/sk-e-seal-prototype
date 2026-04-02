// CSC v2 Spec §11.4 — credentials/info
// Returns detailed information about a specific credential:
// certificate chain, key algorithm, SCAL level, authorization mode.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, isAuthError } from '@/lib/middleware';
import { getDb } from '@/lib/db';
import forge from 'node-forge';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const body = await request.json();
  const { credentialID } = body;

  if (!credentialID) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'credentialID is required' },
      { status: 400 }
    );
  }

  const sql = getDb();
  const rows = await sql`SELECT * FROM credentials WHERE credential_id = ${credentialID} AND tenant_id = ${auth.tenantId}`;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Credential not found' },
      { status: 404 }
    );
  }

  const cred = rows[0]!;

  // Parse certificate for subject/issuer info
  // Strip \r from Windows-style line endings — forge requires \n-only PEM
  const cert = forge.pki.certificateFromPem((cred.certificate_pem as string).replace(/\r/g, ''));
  const subject = cert.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(', ');
  const issuer = cert.issuer.attributes.map(a => `${a.shortName}=${a.value}`).join(', ');

  // Base64-encode the DER certificate for CSC response
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certBase64 = forge.util.encode64(certDer);

  // Build certificate chain array (just the end-entity cert for Phase 1)
  const certChain = [certBase64];
  if (cred.certificate_chain_pem) {
    const chainPem = cred.certificate_chain_pem as string;
    const chainCerts = chainPem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
    for (const pem of chainCerts) {
      const chainCert = forge.pki.certificateFromPem(pem.replace(/\r/g, ''));
      const chainDer = forge.asn1.toDer(forge.pki.certificateToAsn1(chainCert)).getBytes();
      certChain.push(forge.util.encode64(chainDer));
    }
  }

  return NextResponse.json({
    description: `E-Seal certificate for ${subject}`,
    key: {
      status: cred.status === 'active' ? 'enabled' : 'disabled',
      algo: ['1.2.840.113549.1.1.1'], // RSA OID
      len: cred.key_length,
    },
    cert: {
      status: 'valid',
      certificates: certChain,
      issuerDN: issuer,
      subjectDN: subject,
      serialNumber: cert.serialNumber,
      validFrom: cert.validity.notBefore.toISOString(),
      validTo: cert.validity.notAfter.toISOString(),
    },
    authMode: 'explicit', // SCAL2 requires explicit authorization
    SCAL: cred.scal,
    PIN: {
      presence: 'true',
      label: 'E-Seal PIN',
      description: 'PIN for e-seal credential authorization',
    },
  });
}
