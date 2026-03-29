// Seeds the database with a test tenant and e-seal credential.
// Run once after migration to set up the demo environment.
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { generateTestCertificate, encryptPrivateKey } from '../src/lib/crypto';
import crypto from 'crypto';

config({ path: '.env.local' });

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);

  const clientId = 'demo-tenant-001';
  const clientSecret = crypto.randomBytes(32).toString('hex');
  const pin = '12345'; // Demo PIN — would be customer-configured in production

  console.log('=== Demo Tenant Credentials ===');
  console.log(`Client ID:     ${clientId}`);
  console.log(`Client Secret: ${clientSecret}`);
  console.log(`PIN:           ${pin}`);
  console.log('================================');
  console.log('Save these — the secret and PIN cannot be recovered after hashing.');
  console.log('');

  const clientSecretHash = await bcrypt.hash(clientSecret, 12);
  const pinHash = await bcrypt.hash(pin, 12);

  const tenantRows = await sql`
    INSERT INTO tenants (name, client_id, client_secret_hash, pin_hash)
    VALUES (${'Demo Organization OUE'}, ${clientId}, ${clientSecretHash}, ${pinHash})
    ON CONFLICT (client_id) DO UPDATE SET client_secret_hash = ${clientSecretHash}, pin_hash = ${pinHash}, updated_at = NOW()
    RETURNING id`;
  const tenantId = tenantRows[0]!.id;
  console.log(`Tenant created: ${tenantId}`);

  console.log('Generating RSA 2048 keypair + self-signed X.509 certificate...');
  const { certificatePem, privateKeyPem } = generateTestCertificate('Demo Organization OUE');

  const encryptedKey = encryptPrivateKey(privateKeyPem);

  const credentialId = `cred-${crypto.randomBytes(8).toString('hex')}`;
  await sql`
    INSERT INTO credentials (tenant_id, credential_id, certificate_pem, private_key_pem_encrypted, key_algorithm, key_length, hash_algorithm, scal)
    VALUES (${tenantId}, ${credentialId}, ${certificatePem}, ${encryptedKey}, ${'RSA'}, ${2048}, ${'SHA-256'}, ${'SCAL2'})
    ON CONFLICT (credential_id) DO UPDATE SET
      certificate_pem = ${certificatePem}, private_key_pem_encrypted = ${encryptedKey}, updated_at = NOW()`;
  console.log(`Credential created: ${credentialId}`);

  console.log('');
  console.log('Add these to your .env.local for testing:');
  console.log(`DEMO_CLIENT_ID=${clientId}`);
  console.log(`DEMO_CLIENT_SECRET=${clientSecret}`);
  console.log(`DEMO_PIN=${pin}`);
  console.log(`DEMO_CREDENTIAL_ID=${credentialId}`);
}

seed().catch(console.error);
