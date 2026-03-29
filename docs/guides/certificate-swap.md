# Certificate Swap Guide

> How to replace the self-signed test certificate with a real SK-issued e-seal certificate.

## What changes (and what doesn't)

| Component | Changes? | Details |
|---|---|---|
| API server code | **No** | Zero code changes needed |
| Client SDK code | **No** | SDK is certificate-agnostic |
| Database schema | **No** | Same columns, different values |
| `credentials` row | **Yes** | New `certificate_pem`, `certificate_chain_pem`, `private_key_pem_encrypted` |
| `.env.local` | **Maybe** | `DEMO_CREDENTIAL_ID` if you create a new credential |
| Signature validation | **Yes** | Adobe/DigiDoc4 show green checkmark instead of "unknown signer" |

The architecture was designed for this moment — swapping certificates is a data operation, not a code change.

## Prerequisites

- A `.p12` (PKCS#12) file containing:
  - The e-seal certificate issued by SK
  - The private key
  - The certificate chain (intermediate CA + root CA)
- The `.p12` export password
- The project running with database access

## Step 1: Extract certificate and key from .p12

Using OpenSSL:

```bash
# Extract the end-entity certificate (PEM)
openssl pkcs12 -in seal-cert.p12 -clcerts -nokeys -out cert.pem

# Extract the private key (PEM, unencrypted)
openssl pkcs12 -in seal-cert.p12 -nocerts -nodes -out key.pem

# Extract the certificate chain (intermediate + root CAs)
openssl pkcs12 -in seal-cert.p12 -cacerts -nokeys -out chain.pem
```

You'll be prompted for the .p12 password for each command.

**Verify the extraction:**

```bash
# Check certificate subject
openssl x509 -in cert.pem -noout -subject
# Should show: CN=Your Organization E-Seal, O=Your Organization, C=EE

# Check key matches certificate
openssl x509 -in cert.pem -noout -modulus | openssl md5
openssl rsa -in key.pem -noout -modulus | openssl md5
# Both MD5 values must match
```

## Step 2: Update the database

You can either update the existing credential or create a new one.

### Option A: Update existing credential

Create a script `scripts/swap-cert.ts`:

```typescript
import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { encryptPrivateKey } from '../src/lib/crypto';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

const certPem = readFileSync('cert.pem', 'utf-8');
const keyPem = readFileSync('key.pem', 'utf-8');
const chainPem = readFileSync('chain.pem', 'utf-8');

const encryptedKey = encryptPrivateKey(keyPem);
const credentialId = process.env.DEMO_CREDENTIAL_ID!;

await sql`
  UPDATE credentials
  SET certificate_pem = ${certPem},
      certificate_chain_pem = ${chainPem},
      private_key_pem_encrypted = ${encryptedKey},
      updated_at = NOW()
  WHERE credential_id = ${credentialId}
`;

console.log(`Updated credential ${credentialId} with real certificate.`);
```

Run it:

```bash
npx tsx scripts/swap-cert.ts
```

### Option B: Create a new credential

Modify `scripts/seed.ts` to read from files instead of generating a test cert, or insert directly:

```typescript
import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { encryptPrivateKey } from '../src/lib/crypto';
import crypto from 'crypto';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

const certPem = readFileSync('cert.pem', 'utf-8');
const keyPem = readFileSync('key.pem', 'utf-8');
const chainPem = readFileSync('chain.pem', 'utf-8');

const credentialId = `cred-${crypto.randomBytes(8).toString('hex')}`;
const tenantId = '<your-tenant-uuid>'; // from tenants table

await sql`
  INSERT INTO credentials (tenant_id, credential_id, certificate_pem, certificate_chain_pem, private_key_pem_encrypted)
  VALUES (${tenantId}, ${credentialId}, ${certPem}, ${chainPem}, ${encryptPrivateKey(keyPem)})
`;

console.log(`Created credential: ${credentialId}`);
console.log(`Update .env.local: DEMO_CREDENTIAL_ID=${credentialId}`);
```

## Step 3: Verify

Run the seal demo with the new credential:

```bash
npx tsx scripts/seal-demo.ts test-files/sample.pdf
```

Open the sealed PDF in Adobe Acrobat Reader:
- The signature panel should show the real certificate subject (your organization name)
- If the SK root CA is in Adobe's trust store, you'll see a **green checkmark**
- The timestamp (from FreeTSA) remains valid regardless of certificate change

Open in DigiDoc4:
- Should validate as a proper e-seal
- Certificate chain displayed: end-entity → intermediate CA → SK root

## Step 4: Clean up

```bash
# Delete the unencrypted private key from disk
rm key.pem

# The private key is now safely encrypted (AES-256-GCM) in the database.
# The .p12 file should be stored securely (HSM, vault, etc.)
```

## Key algorithm considerations

| Algorithm | Current Prototype | Production |
|---|---|---|
| RSA key size | 2048 | 2048+ (check SK cert) |
| Hash algorithm | SHA-256 | SHA-256 (standard for qualified) |
| Signing scheme | PKCS#1 v1.5 | PKCS#1 v1.5 (CSC v2 standard) |
| PAdES level | B-T (with FreeTSA) | B-T (with SK TSA) |

If the real certificate uses RSA 4096 instead of 2048, no code changes are needed — the signing operation handles any RSA key size. The `key_length` column in the database is informational only.

## TSA swap (optional)

To use SK's own TSA instead of FreeTSA:

```typescript
const client = new SealClient({
  // ... other config
  tsaUrl: 'https://tsa.sk.ee/tsa',  // SK's production TSA URL
});
```

Or set via environment variable in the SDK consumer code. The timestamp module accepts any RFC 3161 compliant TSA URL.

## What about HSM?

For qualified e-seals, the private key must reside in a certified HSM (Hardware Security Module), not in a database. This prototype stores keys in PostgreSQL with AES-256-GCM encryption as a stand-in.

To integrate a real HSM:
1. Replace `decryptPrivateKey()` in `src/lib/crypto.ts` with an HSM PKCS#11 call
2. Replace the `privateKey.sign()` call in `signHash/route.ts` with an HSM signing operation
3. The rest of the architecture (endpoints, SDK, CMS assembly) remains unchanged

The HSM integration is scoped as a Phase 3 concern.
