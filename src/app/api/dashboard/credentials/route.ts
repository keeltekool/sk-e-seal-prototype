import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

export const runtime = 'nodejs';

const DEMO_CLIENT_ID = 'tenant-demo-corp-001';

function parseCertBasicInfo(pem: string) {
  // Extract base64 content from PEM
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\s/g, '');
  const der = Buffer.from(b64, 'base64');
  const fingerprint = crypto.createHash('sha256').update(der).digest('hex');
  return { fingerprint };
}

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);

  const tenant = await sql`SELECT id FROM tenants WHERE client_id = ${DEMO_CLIENT_ID} LIMIT 1`;
  if (tenant.length === 0 || !tenant[0]) {
    return Response.json({ error: 'Demo tenant not found' }, { status: 404 });
  }
  const tenantId = tenant[0].id;

  const credentials = await sql`
    SELECT credential_id, label, certificate_pem, key_algorithm, key_length,
           hash_algorithm, scal, status, created_at
    FROM credentials
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at`;

  const enriched = credentials.map(cred => {
    const { fingerprint } = parseCertBasicInfo(cred.certificate_pem as string);

    // Extract subject info from the PEM using node-forge at build time would be ideal,
    // but Neon HTTP driver can mangle PEM line endings. Use the label + known org instead.
    return {
      credentialId: cred.credential_id,
      label: cred.label,
      keyAlgorithm: cred.key_algorithm,
      keyLength: cred.key_length,
      hashAlgorithm: cred.hash_algorithm,
      scal: cred.scal,
      status: cred.status,
      createdAt: cred.created_at,
      certificate: {
        subject: `Demo Corporation OÜ — ${cred.label} E-Seal`,
        issuer: `Demo Corporation OÜ — ${cred.label} E-Seal`,
        organization: 'Demo Corporation OÜ',
        country: 'EE',
        fingerprint,
      },
    };
  });

  return Response.json({ credentials: enriched });
}
