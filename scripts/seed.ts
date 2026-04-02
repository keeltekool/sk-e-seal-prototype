// Seeds the database with a demo tenant and multiple e-seal credentials.
// Run once after migration to set up the demo environment.
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { generateTestCertificate, encryptPrivateKey } from '../src/lib/crypto';
import crypto from 'crypto';

config({ path: '.env.local' });

const TENANT_NAME = 'Demo Corporation OÜ';
const CLIENT_ID = 'tenant-demo-corp-001';

const CREDENTIAL_CONFIGS = [
  { id: 'cred-inv-001', label: 'Invoice Sealing', status: 'active' },
  { id: 'cred-con-002', label: 'Contract Sealing', status: 'active' },
  { id: 'cred-reg-003', label: 'Regulatory Filings', status: 'suspended' },
];

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);

  const clientSecret = crypto.randomBytes(32).toString('hex');
  const pin = crypto.randomInt(100000, 999999).toString();

  console.log('=== Demo Tenant Credentials ===');
  console.log(`Organization:  ${TENANT_NAME}`);
  console.log(`Client ID:     ${CLIENT_ID}`);
  console.log(`Client Secret: ${clientSecret}`);
  console.log(`PIN:           ${pin}`);
  console.log('================================');
  console.log('Save these — the secret and PIN cannot be recovered after hashing.');
  console.log('');

  const clientSecretHash = await bcrypt.hash(clientSecret, 12);
  const pinHash = await bcrypt.hash(pin, 12);

  // Upsert tenant
  const tenantRows = await sql`
    INSERT INTO tenants (name, client_id, client_secret_hash, pin_hash)
    VALUES (${TENANT_NAME}, ${CLIENT_ID}, ${clientSecretHash}, ${pinHash})
    ON CONFLICT (client_id) DO UPDATE SET
      name = ${TENANT_NAME},
      client_secret_hash = ${clientSecretHash},
      pin_hash = ${pinHash},
      updated_at = NOW()
    RETURNING id`;
  const tenantId = tenantRows[0]!.id;
  console.log(`Tenant created: ${tenantId}`);

  // Delete existing credentials for this tenant (clean re-seed)
  await sql`DELETE FROM credentials WHERE tenant_id = ${tenantId}`;

  // Create 3 seal credentials with distinct certificates
  for (const cfg of CREDENTIAL_CONFIGS) {
    console.log(`Generating keypair + cert for "${cfg.label}"...`);
    const certLabel = `Demo Corporation - ${cfg.label}`;
    const generated = generateTestCertificate(certLabel);
    // Strip \r from Windows line endings — forge requires \n-only PEM
    const certificatePem = generated.certificatePem.replace(/\r/g, '');
    const privateKeyPem = generated.privateKeyPem.replace(/\r/g, '');
    const encryptedKey = encryptPrivateKey(privateKeyPem);

    await sql`
      INSERT INTO credentials (tenant_id, credential_id, label, certificate_pem, private_key_pem_encrypted, key_algorithm, key_length, hash_algorithm, scal, status)
      VALUES (${tenantId}, ${cfg.id}, ${cfg.label}, ${certificatePem}, ${encryptedKey}, ${'RSA'}, ${2048}, ${'SHA-256'}, ${'SCAL2'}, ${cfg.status})
      ON CONFLICT (credential_id) DO UPDATE SET
        label = ${cfg.label},
        certificate_pem = ${certificatePem},
        private_key_pem_encrypted = ${encryptedKey},
        status = ${cfg.status},
        updated_at = NOW()`;
    console.log(`  ${cfg.id} (${cfg.label}) — ${cfg.status}`);
  }

  console.log('');
  console.log('Add these to your .env.local for the landing page demo:');
  console.log(`DEMO_CLIENT_ID=${CLIENT_ID}`);
  console.log(`DEMO_CLIENT_SECRET=${clientSecret}`);
  console.log(`DEMO_PIN=${pin}`);
  console.log(`DEMO_CREDENTIAL_ID=${CREDENTIAL_CONFIGS[0].id}`);
}

seed().catch(console.error);
