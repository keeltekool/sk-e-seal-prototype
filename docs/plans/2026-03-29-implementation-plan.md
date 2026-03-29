# Qualified E-Seal by SK ID — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a working CSC v2 compliant remote e-sealing service with separate client SDK, educational documentation, and SK-branded landing page with live demo.

**Architecture:** API-first, four layers built in order: (1) CSC v2 API server with OAuth2 + SCAL2, (2) Client SDK as separate package, (3) Documentation, (4) Landing page with SSE process X-ray. Same git repo, independent packages. Everything upgradeable to production via config/cert swap, not rewrite.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, Neon PostgreSQL, node-forge (X.509/CMS), pdf-lib (PDF manipulation), @signpdf (PAdES embedding), FreeTSA.org (RFC 3161 timestamps), OpenAPI 3.1 + Swagger UI.

**Design doc:** `docs/plans/2026-03-29-build-plan-design.md` — read this FIRST for full architecture rationale and design decisions.

**Critical reading before any code:**
- `SCOPE.md` — full project scope, CSC v2 spec analysis, tech decisions
- `CLAUDE.md` — project conventions, mandatory stops, design philosophy
- `docs/SESSION-2026-03-24-Research-and-Design.md` — research session with full CSC v2 analysis

**CSC v2 Spec:** https://cloudsignatureconsortium.org/wp-content/uploads/2023/04/csc-api-v2.0.0.2.pdf
Key sections: 8.5 (e-seal authorization), 11 (API definitions), 11.1 (info), 11.4 (credentials), 11.7 (signatures)

**Reference repos (study for patterns, don't copy):**
- `simionrobert/cloud-signature-consortium` — Node.js CSC v1 server (MIT)
- `vbuch/node-signpdf` — PDF signing (MIT, 875 stars)
- `Xevolab/node-signpdf-pades` — PAdES Baseline B, passes ETSI conformance

**CMS signing subtlety (CRITICAL — get this wrong and signatures are invalid):**
For PAdES, you do NOT send the raw PDF hash to signHash. The correct flow:
1. Compute PDF byte range hash -> `pdfHash`
2. Build CMS SignedAttributes containing `pdfHash` as messageDigest
3. DER-encode SignedAttributes -> hash THAT -> `attrsHash`
4. Send `attrsHash` to CSC signHash endpoint
5. Get back raw RSA signature
6. Wrap in CMS SignedData -> embed in PDF
(Documented in node-signpdf issue #46)

**Service name:** "Qualified E-Seal by SK ID"

---

## Phase A: Foundation (API Server Core)

### Task A1: Project Scaffold

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.json`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx` (placeholder)
- Create: `src/lib/db.ts` (Neon client)
- Create: `packages/client-sdk/package.json` (stub)
- Create: `packages/client-sdk/tsconfig.json`
- Create: `packages/client-sdk/src/index.ts` (stub export)
- Create: `tailwind.config.ts`

**Step 1: Create Next.js project**

```bash
cd C:\Users\Kasutaja\Claude_Projects\sk-e-seal-prototype
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Note: project directory already exists with docs/SCOPE.md/CLAUDE.md — scaffold INTO existing dir. If create-next-app refuses because dir isn't empty, manually init: install next, react, react-dom, typescript, tailwindcss, set up tsconfig.json and next.config.ts manually.

**Step 2: Configure TypeScript strict mode**

In `tsconfig.json`, ensure:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

**Step 3: Create client SDK stub package**

```
packages/client-sdk/package.json:
{
  "name": "@sk-eseal/client-sdk",
  "version": "0.1.0",
  "description": "Client SDK for Qualified E-Seal by SK ID — CSC v2 compliant remote e-sealing",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "license": "MIT"
}
```

```
packages/client-sdk/src/index.ts:
export const SDK_VERSION = '0.1.0';
```

**Step 4: Install core dependencies**

```bash
npm install @neondatabase/serverless node-forge
npm install -D @types/node-forge
```

**Step 5: Create Neon DB client**

```typescript
// src/lib/db.ts
import { neon } from '@neondatabase/serverless';

export function getDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return sql;
}
```

**Step 6: Add DATABASE_URL to .env.local**

Ask user for Neon connection string if not available. Create Neon project named `sk-e-seal-prototype`.

```
# .env.local
DATABASE_URL=postgresql://...
JWT_SECRET=<generate-random-64-char-hex>
```

**Step 7: Verify build**

```bash
npm run build
```
Expected: Build succeeds with no errors.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat(A1): project scaffold with Next.js, Tailwind, SDK stub"
```

---

### Task A2: Database Schema

**Files:**
- Create: `src/lib/schema.sql`
- Create: `scripts/migrate.ts`

**Step 1: Write schema**

```sql
-- src/lib/schema.sql

-- Tenants: organizations that use the e-seal service
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_id TEXT UNIQUE NOT NULL,
  client_secret_hash TEXT NOT NULL,        -- bcrypt hash of OAuth client_secret
  pin_hash TEXT NOT NULL,                  -- bcrypt hash of SCAL2 PIN
  status TEXT NOT NULL DEFAULT 'active',   -- active, suspended, revoked
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credentials: e-seal certificates + private keys per tenant
CREATE TABLE IF NOT EXISTS credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,      -- CSC credentialID (external identifier)
  certificate_pem TEXT NOT NULL,           -- X.509 certificate in PEM format
  certificate_chain_pem TEXT,              -- Intermediate + root certs in PEM
  private_key_pem_encrypted TEXT NOT NULL, -- RSA private key, AES-256-GCM encrypted
  key_algorithm TEXT NOT NULL DEFAULT 'RSA',
  key_length INTEGER NOT NULL DEFAULT 2048,
  hash_algorithm TEXT NOT NULL DEFAULT 'SHA-256',
  scal TEXT NOT NULL DEFAULT 'SCAL2',
  status TEXT NOT NULL DEFAULT 'active',   -- active, suspended, revoked
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log: every signing operation recorded
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  credential_id TEXT NOT NULL,
  operation TEXT NOT NULL,                 -- token_issued, credential_authorized, hash_signed
  hash_values TEXT[],                      -- the hashes that were signed (for traceability)
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SAD tokens: track issued Signature Activation Data for single-use enforcement
CREATE TABLE IF NOT EXISTS sad_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  credential_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,                -- hash of the SAD JWT for lookup
  hash_values TEXT[] NOT NULL,             -- bound hash values
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credentials_tenant ON credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sad_tokens_hash ON sad_tokens(token_hash);
```

**Step 2: Write migration script**

```typescript
// scripts/migrate.ts
import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function migrate() {
  const sql = neon(process.env.DATABASE_URL!);
  const schema = readFileSync('src/lib/schema.sql', 'utf-8');

  // Split on semicolons and execute each statement
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    await sql(statement);
    console.log('Executed:', statement.substring(0, 60) + '...');
  }

  console.log('Migration complete.');
}

migrate().catch(console.error);
```

**Step 3: Run migration**

```bash
npx tsx scripts/migrate.ts
```
Expected: All tables created, "Migration complete." printed.

**Step 4: Verify tables exist**

```bash
npx tsx -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
sql('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'').then(r => console.log(r));
"
```
Expected: tenants, credentials, audit_log, sad_tokens listed.

**Step 5: Commit**

```bash
git add src/lib/schema.sql scripts/migrate.ts
git commit -m "feat(A2): database schema — tenants, credentials, audit_log, sad_tokens"
```

---

### Task A3: OAuth2 Token Endpoint

**Files:**
- Create: `src/app/api/oauth2/token/route.ts`
- Create: `src/lib/auth.ts` (token generation + validation utilities)

**Step 1: Install bcrypt for password hashing**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

**Step 2: Create auth utilities**

```typescript
// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const TOKEN_EXPIRY = '1h';

export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, 12);
}

export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

export async function generateAccessToken(tenantId: string, clientId: string): Promise<string> {
  return new SignJWT({ tenantId, clientId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuer('qualified-eseal-by-sk-id')
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET, {
    issuer: 'qualified-eseal-by-sk-id',
  });
  return payload as { tenantId: string; clientId: string };
}
```

```bash
npm install jose
```

**Step 3: Create token endpoint**

```typescript
// src/app/api/oauth2/token/route.ts
// CSC v2 Spec: OAuth 2.0 Client Credentials (RFC 6749 §4.4)
// This endpoint issues access tokens for M2M e-seal operations.
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

  // Validate grant_type
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

  // Look up tenant
  const sql = getDb();
  const rows = await sql('SELECT id, client_secret_hash, status FROM tenants WHERE client_id = $1', [clientId]);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Unknown client_id' },
      { status: 401 }
    );
  }

  const tenant = rows[0];

  if (tenant.status !== 'active') {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Client account is not active' },
      { status: 401 }
    );
  }

  // Verify secret
  const valid = await verifySecret(clientSecret, tenant.client_secret_hash as string);
  if (!valid) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Invalid client_secret' },
      { status: 401 }
    );
  }

  // Generate token
  const accessToken = await generateAccessToken(tenant.id as string, clientId);

  // Audit log
  await sql(
    'INSERT INTO audit_log (tenant_id, credential_id, operation, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
    [tenant.id, 'N/A', 'token_issued', request.headers.get('x-forwarded-for') || 'unknown', request.headers.get('user-agent') || 'unknown']
  );

  // RFC 6749 §5.1 response format
  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
  });
}
```

**Step 4: Test with curl**

First need a test tenant. This will be handled by the seed script in A5, but for now verify the endpoint returns proper errors:

```bash
curl -X POST http://localhost:3000/api/oauth2/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials","client_id":"test","client_secret":"test"}'
```
Expected: `{"error":"invalid_client","error_description":"Unknown client_id"}` with 401 status.

**Step 5: Commit**

```bash
git add src/app/api/oauth2/token/route.ts src/lib/auth.ts
git commit -m "feat(A3): OAuth2 client_credentials token endpoint"
```

---

### Task A4: Auth Middleware

**Files:**
- Create: `src/lib/middleware.ts`

**Step 1: Create middleware for CSC v2 routes**

```typescript
// src/lib/middleware.ts
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

// Type guard to check if auth result is an error response
export function isAuthError(result: AuthenticatedRequest | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
```

**Step 2: Commit**

```bash
git add src/lib/middleware.ts
git commit -m "feat(A4): auth middleware for CSC v2 route protection"
```

---

### Task A5: Test Certificate Generation + Seed Script

**Files:**
- Create: `scripts/seed.ts`
- Create: `src/lib/crypto.ts`

**Step 1: Create crypto utilities**

```typescript
// src/lib/crypto.ts
// Certificate and key management for the e-seal service.
// Uses node-forge for X.509 certificate generation and key encryption.
// Designed so a real SK certificate (.p12) can replace the self-signed cert
// with zero code changes — just update the credential row in the database.
import forge from 'node-forge';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET!;

/**
 * Generate an RSA 2048 keypair and self-signed X.509 certificate.
 * The certificate is configured as an e-seal certificate per eIDAS:
 * - Key usage: digitalSignature, nonRepudiation
 * - Extended key usage: document signing (if supported)
 * - Subject contains organization name (the tenant)
 */
export function generateTestCertificate(orgName: string): {
  certificatePem: string;
  privateKeyPem: string;
} {
  // Generate RSA 2048 keypair
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // Create self-signed certificate
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = crypto.randomBytes(16).toString('hex');

  // Valid for 1 year
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);

  // Subject and issuer (self-signed, so they match)
  const attrs = [
    { name: 'commonName', value: `${orgName} E-Seal` },
    { name: 'organizationName', value: orgName },
    { name: 'countryName', value: 'EE' },
    { shortName: 'ST', value: 'Harjumaa' },
    { name: 'localityName', value: 'Tallinn' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs); // Self-signed

  // Extensions for e-seal usage
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    {
      name: 'keyUsage',
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: false,
      dataEncipherment: false,
    },
    {
      name: 'subjectKeyIdentifier',
    },
  ]);

  // Sign the certificate with its own private key (self-signed)
  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    certificatePem: forge.pki.certificateToPem(cert),
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
  };
}

/**
 * Encrypt a private key PEM string using AES-256-GCM.
 * Used for at-rest encryption of credential private keys in the database.
 */
export function encryptPrivateKey(privateKeyPem: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(privateKeyPem, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a private key PEM string from AES-256-GCM.
 */
export function decryptPrivateKey(encryptedData: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const [ivB64, authTagB64, ciphertext] = encryptedData.split(':');

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

**Step 2: Create seed script**

```typescript
// scripts/seed.ts
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

  // Generate client credentials
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

  // Hash secrets
  const clientSecretHash = await bcrypt.hash(clientSecret, 12);
  const pinHash = await bcrypt.hash(pin, 12);

  // Create tenant
  const tenantRows = await sql(
    `INSERT INTO tenants (name, client_id, client_secret_hash, pin_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_id) DO UPDATE SET client_secret_hash = $3, pin_hash = $4, updated_at = NOW()
     RETURNING id`,
    ['Demo Organization OUE', clientId, clientSecretHash, pinHash]
  );
  const tenantId = tenantRows[0].id;
  console.log(`Tenant created: ${tenantId}`);

  // Generate test certificate
  console.log('Generating RSA 2048 keypair + self-signed X.509 certificate...');
  const { certificatePem, privateKeyPem } = generateTestCertificate('Demo Organization OUE');

  // Encrypt private key for storage
  const encryptedKey = encryptPrivateKey(privateKeyPem);

  // Create credential
  const credentialId = `cred-${crypto.randomBytes(8).toString('hex')}`;
  await sql(
    `INSERT INTO credentials (tenant_id, credential_id, certificate_pem, private_key_pem_encrypted, key_algorithm, key_length, hash_algorithm, scal)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (credential_id) DO UPDATE SET
       certificate_pem = $3, private_key_pem_encrypted = $4, updated_at = NOW()`,
    [tenantId, credentialId, certificatePem, encryptedKey, 'RSA', 2048, 'SHA-256', 'SCAL2']
  );
  console.log(`Credential created: ${credentialId}`);

  // Write credentials to .env.local for testing convenience
  console.log('');
  console.log('Add these to your .env.local for testing:');
  console.log(`DEMO_CLIENT_ID=${clientId}`);
  console.log(`DEMO_CLIENT_SECRET=${clientSecret}`);
  console.log(`DEMO_PIN=${pin}`);
  console.log(`DEMO_CREDENTIAL_ID=${credentialId}`);
}

seed().catch(console.error);
```

**Step 3: Run seed**

```bash
npx tsx scripts/seed.ts
```
Expected: Tenant and credential created, credentials printed to console.

**Step 4: Add demo credentials to .env.local**

Copy the output values into `.env.local`.

**Step 5: Test full OAuth2 flow**

```bash
# Start dev server
npm run dev

# In another terminal:
curl -X POST http://localhost:3000/api/oauth2/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials","client_id":"demo-tenant-001","client_secret":"<from-seed-output>"}'
```
Expected: `{"access_token":"eyJ...","token_type":"Bearer","expires_in":3600}`

**Step 6: Commit**

```bash
git add src/lib/crypto.ts scripts/seed.ts
git commit -m "feat(A5): test certificate generation + seed script"
```

### CHECKPOINT A — Verification

Run ALL of these before proceeding to Phase B:

- [ ] `curl POST /oauth2/token` with valid credentials → access token
- [ ] `curl POST /oauth2/token` with wrong secret → 401 `invalid_client`
- [ ] `curl POST /oauth2/token` with wrong grant_type → 400 `unsupported_grant_type`
- [ ] DB has tenant row with hashed secret and PIN
- [ ] DB has credential row with encrypted private key and PEM certificate
- [ ] Certificate is valid X.509 (decode with node-forge or openssl)
- [ ] Private key can be decrypted back to valid PEM
- [ ] Monorepo structure: root package + `packages/client-sdk/` both exist
- [ ] `npm run build` succeeds

---

## Phase B: CSC v2 Endpoints

### Task B1: POST /csc/v2/info

**Files:**
- Create: `src/app/api/csc/v2/info/route.ts`

**Step 1: Implement info endpoint**

```typescript
// src/app/api/csc/v2/info/route.ts
// CSC v2 Spec §11.1 — info
// Returns service metadata: capabilities, supported algorithms, auth types.
// This endpoint does NOT require authentication per CSC spec.
import { NextResponse } from 'next/server';

export async function POST() {
  // CSC v2.0.0.2 §11.1 — info response
  return NextResponse.json({
    specs: '2.0.0.2',
    name: 'Qualified E-Seal by SK ID',
    logo: '/logo.png',
    region: 'EE',
    lang: 'en',
    description: 'CSC v2 compliant remote e-sealing service prototype by SK ID Solutions',
    authType: ['oauth2'],
    oauth2: 'https://qualified-eseal.sk.ee/oauth2/token', // Will be updated to real URL
    methods: ['credentials/list', 'credentials/info', 'credentials/authorize', 'signatures/signHash'],
    signAlgorithms: {
      algos: ['1.2.840.113549.1.1.11'], // sha256WithRSAEncryption OID
      algoParams: ['NULL'],
    },
    hashAlgorithms: {
      algos: ['2.16.840.1.101.3.4.2.1'], // SHA-256 OID
      algoParams: ['NULL'],
    },
  });
}
```

**Step 2: Test**

```bash
curl -X POST http://localhost:3000/api/csc/v2/info | jq .
```
Expected: JSON with specs, name, authType, methods, signAlgorithms, hashAlgorithms.

**Step 3: Commit**

```bash
git add src/app/api/csc/v2/info/route.ts
git commit -m "feat(B1): POST /csc/v2/info — service metadata endpoint"
```

---

### Task B2: POST /csc/v2/credentials/list

**Files:**
- Create: `src/app/api/csc/v2/credentials/list/route.ts`

**Step 1: Implement credentials/list**

```typescript
// src/app/api/csc/v2/credentials/list/route.ts
// CSC v2 Spec §11.4 — credentials/list
// Returns list of credential IDs available to the authenticated tenant.
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, isAuthError } from '@/lib/middleware';
import { getDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (isAuthError(auth)) return auth;

  const sql = getDb();
  const rows = await sql(
    'SELECT credential_id FROM credentials WHERE tenant_id = $1 AND status = $2',
    [auth.tenantId, 'active']
  );

  // CSC v2 §11.4 response format
  return NextResponse.json({
    credentialIDs: rows.map(r => r.credential_id),
  });
}
```

**Step 2: Test**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/oauth2/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials","client_id":"demo-tenant-001","client_secret":"<secret>"}' | jq -r .access_token)

curl -X POST http://localhost:3000/api/csc/v2/credentials/list \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .
```
Expected: `{"credentialIDs":["cred-..."]}`

**Step 3: Test without auth**

```bash
curl -X POST http://localhost:3000/api/csc/v2/credentials/list | jq .
```
Expected: 401 `access_denied`

**Step 4: Commit**

```bash
git add src/app/api/csc/v2/credentials/list/route.ts
git commit -m "feat(B2): POST /csc/v2/credentials/list — list tenant credentials"
```

---

### Task B3: POST /csc/v2/credentials/info

**Files:**
- Create: `src/app/api/csc/v2/credentials/info/route.ts`

**Step 1: Implement credentials/info**

```typescript
// src/app/api/csc/v2/credentials/info/route.ts
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
  const rows = await sql(
    'SELECT * FROM credentials WHERE credential_id = $1 AND tenant_id = $2',
    [credentialID, auth.tenantId]
  );

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Credential not found' },
      { status: 404 }
    );
  }

  const cred = rows[0];

  // Parse certificate for subject/issuer info
  const cert = forge.pki.certificateFromPem(cred.certificate_pem as string);
  const subject = cert.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(', ');
  const issuer = cert.issuer.attributes.map(a => `${a.shortName}=${a.value}`).join(', ');

  // Base64-encode the DER certificate for CSC response
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certBase64 = forge.util.encode64(certDer);

  // Build certificate chain array (just the end-entity cert for Phase 1)
  const certChain = [certBase64];
  if (cred.certificate_chain_pem) {
    // If chain exists, parse and add each cert
    const chainPem = cred.certificate_chain_pem as string;
    const chainCerts = chainPem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
    for (const pem of chainCerts) {
      const chainCert = forge.pki.certificateFromPem(pem);
      const chainDer = forge.asn1.toDer(forge.pki.certificateToAsn1(chainCert)).getBytes();
      certChain.push(forge.util.encode64(chainDer));
    }
  }

  // CSC v2 §11.4 credentials/info response
  return NextResponse.json({
    description: `E-Seal certificate for ${subject}`,
    key: {
      status: cred.status === 'active' ? 'enabled' : 'disabled',
      algo: [`1.2.840.113549.1.1.1`], // RSA OID
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
```

**Step 2: Test**

```bash
curl -X POST http://localhost:3000/api/csc/v2/credentials/info \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"credentialID":"<credential-id-from-seed>"}' | jq .
```
Expected: JSON with key, cert (base64 DER), authMode, SCAL, PIN info.

**Step 3: Commit**

```bash
git add src/app/api/csc/v2/credentials/info/route.ts
git commit -m "feat(B3): POST /csc/v2/credentials/info — credential detail with cert chain"
```

---

### Task B4: POST /csc/v2/credentials/authorize

**Files:**
- Create: `src/app/api/csc/v2/credentials/authorize/route.ts`

**Step 1: Implement SCAL2 authorization**

```typescript
// src/app/api/csc/v2/credentials/authorize/route.ts
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
  const { credentialID, PIN, hash, hashAlgo, numSignatures } = body;

  // Validate required fields
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
  const credRows = await sql(
    'SELECT id FROM credentials WHERE credential_id = $1 AND tenant_id = $2 AND status = $3',
    [credentialID, auth.tenantId, 'active']
  );
  if (credRows.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Credential not found or not active' },
      { status: 404 }
    );
  }

  // Verify PIN against tenant's stored hash
  const tenantRows = await sql('SELECT pin_hash FROM tenants WHERE id = $1', [auth.tenantId]);
  const pinValid = await verifySecret(PIN, tenantRows[0].pin_hash as string);
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
  await sql(
    'INSERT INTO sad_tokens (tenant_id, credential_id, token_hash, hash_values, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [auth.tenantId, credentialID, tokenHash, hash, expiresAt.toISOString()]
  );

  // Audit log
  await sql(
    'INSERT INTO audit_log (tenant_id, credential_id, operation, hash_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
    [auth.tenantId, credentialID, 'credential_authorized', hash, request.headers.get('x-forwarded-for') || 'unknown', request.headers.get('user-agent') || 'unknown']
  );

  // CSC v2 §11.4 credentials/authorize response
  return NextResponse.json({
    SAD: sad,
    expiresIn: SAD_EXPIRY_MINUTES * 60,
  });
}
```

**Step 2: Test**

```bash
# Create a test hash (SHA-256 of "hello world")
TEST_HASH=$(echo -n "hello world" | openssl dgst -sha256 -binary | base64)

curl -X POST http://localhost:3000/api/csc/v2/credentials/authorize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"credentialID\":\"<cred-id>\",\"PIN\":\"12345\",\"hash\":[\"$TEST_HASH\"],\"hashAlgo\":\"SHA-256\"}" | jq .
```
Expected: `{"SAD":"eyJ...","expiresIn":300}`

**Step 3: Test wrong PIN**

```bash
curl -X POST http://localhost:3000/api/csc/v2/credentials/authorize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"credentialID":"<cred-id>","PIN":"wrong","hash":["dGVzdA=="]}' | jq .
```
Expected: 401 `invalid_pin`

**Step 4: Commit**

```bash
git add src/app/api/csc/v2/credentials/authorize/route.ts
git commit -m "feat(B4): POST /csc/v2/credentials/authorize — SCAL2 PIN to SAD flow"
```

---

### Task B5: POST /csc/v2/signatures/signHash

**Files:**
- Create: `src/app/api/csc/v2/signatures/signHash/route.ts`

**Step 1: Implement signHash**

```typescript
// src/app/api/csc/v2/signatures/signHash/route.ts
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
  const { credentialID, SAD, hash, hashAlgo, signAlgo } = body;

  // Validate required fields
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
  const sadRows = await sql(
    'SELECT id, used FROM sad_tokens WHERE token_hash = $1',
    [tokenHash]
  );

  if (sadRows.length === 0) {
    return NextResponse.json(
      { error: 'invalid_sad', error_description: 'SAD token not found' },
      { status: 400 }
    );
  }

  if (sadRows[0].used) {
    return NextResponse.json(
      { error: 'invalid_sad', error_description: 'SAD token has already been used' },
      { status: 400 }
    );
  }

  // Mark SAD as used (single-use enforcement)
  await sql('UPDATE sad_tokens SET used = TRUE WHERE id = $1', [sadRows[0].id]);

  // Load credential and decrypt private key
  const credRows = await sql(
    'SELECT private_key_pem_encrypted, certificate_pem FROM credentials WHERE credential_id = $1 AND tenant_id = $2',
    [credentialID, auth.tenantId]
  );

  if (credRows.length === 0) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Credential not found' },
      { status: 404 }
    );
  }

  const privateKeyPem = decryptPrivateKey(credRows[0].private_key_pem_encrypted as string);
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

  // Sign each hash
  const signatures: string[] = [];
  for (const hashB64 of hash) {
    const hashBytes = forge.util.decode64(hashB64);

    // Create PKCS#1 v1.5 signature with SHA-256 DigestInfo
    // This wraps the hash in the ASN.1 DigestInfo structure before signing
    const md = forge.md.sha256.create();
    md.start();
    // We need to set the digest directly since the hash is already computed
    (md as any).digestLength = 32;
    (md.digest as any) = () => forge.util.createBuffer(hashBytes);

    // Use raw RSA signing with PKCS#1 v1.5 padding
    const scheme = forge.pki.rsa.signWithPrivateKey;

    // Build DigestInfo ASN.1 structure manually
    // SHA-256 OID: 2.16.840.1.101.3.4.2.1
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
  await sql(
    'INSERT INTO audit_log (tenant_id, credential_id, operation, hash_values, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
    [auth.tenantId, credentialID, 'hash_signed', hash, request.headers.get('x-forwarded-for') || 'unknown', request.headers.get('user-agent') || 'unknown']
  );

  // CSC v2 §11.7 signatures/signHash response
  return NextResponse.json({
    signatures,
  });
}
```

**Step 2: Test full signing flow**

```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/oauth2/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials","client_id":"demo-tenant-001","client_secret":"<secret>"}' | jq -r .access_token)

# Create test hash
TEST_HASH=$(echo -n "test document content" | openssl dgst -sha256 -binary | base64)

# Authorize (get SAD)
SAD=$(curl -s -X POST http://localhost:3000/api/csc/v2/credentials/authorize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"credentialID\":\"<cred-id>\",\"PIN\":\"12345\",\"hash\":[\"$TEST_HASH\"]}" | jq -r .SAD)

# Sign
curl -X POST http://localhost:3000/api/csc/v2/signatures/signHash \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"credentialID\":\"<cred-id>\",\"SAD\":\"$SAD\",\"hash\":[\"$TEST_HASH\"],\"hashAlgo\":\"SHA-256\"}" | jq .
```
Expected: `{"signatures":["<base64-encoded-RSA-signature>"]}`

**Step 3: Test SAD reuse (must fail)**

```bash
# Try to use the same SAD again
curl -X POST http://localhost:3000/api/csc/v2/signatures/signHash \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"credentialID\":\"<cred-id>\",\"SAD\":\"$SAD\",\"hash\":[\"$TEST_HASH\"]}" | jq .
```
Expected: 400 `SAD token has already been used`

**Step 4: Commit**

```bash
git add src/app/api/csc/v2/signatures/signHash/route.ts
git commit -m "feat(B5): POST /csc/v2/signatures/signHash — core signing with SCAL2 SAD validation"
```

---

### Task B6: OpenAPI Spec + Swagger UI

**Files:**
- Create: `public/openapi.yaml`
- Create: `src/app/docs/page.tsx`

**Step 1: Write OpenAPI 3.1 spec**

Create `public/openapi.yaml` with all 6 endpoints fully documented. Use CSC v2 spec field names. Include request/response schemas, error codes, auth requirements.

This file will be large (~300 lines). Key structure:
- `openapi: 3.1.0`
- `info.title: Qualified E-Seal by SK ID`
- `servers` with localhost for dev
- All 6 paths with request bodies, responses, and security schemes
- `securitySchemes` with OAuth2 client_credentials

**Step 2: Add Swagger UI page**

```bash
npm install swagger-ui-react
npm install -D @types/swagger-ui-react
```

Create a simple page at `/docs` that loads swagger-ui-react with the OpenAPI spec.

**Step 3: Test**

Navigate to `http://localhost:3000/docs` — Swagger UI should load with all endpoints.

**Step 4: Commit**

```bash
git add public/openapi.yaml src/app/docs/
git commit -m "feat(B6): OpenAPI 3.1 spec + Swagger UI at /docs"
```

### CHECKPOINT B — Verification

Run the FULL flow end-to-end before proceeding:

- [ ] Complete curl flow: token → list → info → authorize → signHash → signature returned
- [ ] SAD is JWT, single-use (second attempt fails), expires after 5 minutes
- [ ] Invalid PIN → 401
- [ ] Expired/reused SAD → 400
- [ ] Wrong credential for tenant → 403/404
- [ ] Missing auth header → 401 on all /csc/v2/* endpoints
- [ ] /csc/v2/info works WITHOUT auth (per spec)
- [ ] Swagger UI loads at /docs with all 6 endpoints documented
- [ ] Response field names match CSC v2.0.0.2 spec exactly
- [ ] Audit log has entries for token_issued, credential_authorized, hash_signed

---

## Phase C: Client SDK

### Task C1: SDK Package Scaffold

**Files:**
- Update: `packages/client-sdk/package.json`
- Create: `packages/client-sdk/tsconfig.json`
- Create: `packages/client-sdk/src/index.ts`
- Create: `packages/client-sdk/src/types.ts`
- Create: `packages/client-sdk/vitest.config.ts`

**Step 1: Set up package with all dependencies**

```json
// packages/client-sdk/package.json
{
  "name": "@sk-eseal/client-sdk",
  "version": "0.1.0",
  "description": "Client SDK for Qualified E-Seal by SK ID — CSC v2 compliant remote e-sealing",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "node-forge": "^1.3.1",
    "pdf-lib": "^1.17.1"
  },
  "devDependencies": {
    "@types/node-forge": "^1.3.11",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  },
  "license": "MIT"
}
```

**Step 2: Define core types**

```typescript
// packages/client-sdk/src/types.ts

/** Configuration for connecting to the CSC v2 API server */
export interface SealClientConfig {
  /** Base URL of the CSC v2 API (e.g., "http://localhost:3000") */
  baseUrl: string;
  /** OAuth2 client_id */
  clientId: string;
  /** OAuth2 client_secret */
  clientSecret: string;
  /** SCAL2 PIN for credential authorization */
  pin: string;
  /** Credential ID to use for sealing */
  credentialId: string;
  /** Optional: TSA URL for RFC 3161 timestamps. Defaults to FreeTSA. */
  tsaUrl?: string;
}

/** A step in the sealing process, emitted via onStep callback */
export interface SealStep {
  /** Step identifier */
  name: 'pdf_loaded' | 'placeholder_created' | 'hash_computed' | 'token_obtained' | 'credential_authorized' | 'hash_signed' | 'cms_built' | 'timestamp_added' | 'pdf_sealed';
  /** Human-readable description */
  description: string;
  /** Duration of this step in milliseconds */
  durationMs: number;
  /** Step-specific data for display/debugging */
  data: Record<string, unknown>;
}

/** Options for the seal operation */
export interface SealOptions {
  /** Callback fired after each step completes */
  onStep?: (step: SealStep) => void;
}

/** Result of a successful seal operation */
export interface SealResult {
  /** The sealed PDF as a Uint8Array */
  sealedPdf: Uint8Array;
  /** All steps that were executed */
  steps: SealStep[];
  /** Total duration in milliseconds */
  totalDurationMs: number;
}
```

**Step 3: Create stub index**

```typescript
// packages/client-sdk/src/index.ts
export { type SealClientConfig, type SealStep, type SealOptions, type SealResult } from './types';
export const SDK_VERSION = '0.1.0';
```

**Step 4: Install dependencies and verify build**

```bash
cd packages/client-sdk
npm install
npm run build
```
Expected: Build succeeds, `dist/` created with `.js` and `.d.ts` files.

**Step 5: Commit**

```bash
git add packages/client-sdk/
git commit -m "feat(C1): SDK package scaffold with types, build, test config"
```

---

### Task C2: PDF Preparation

**Files:**
- Create: `packages/client-sdk/src/pdf.ts`
- Create: `packages/client-sdk/tests/pdf.test.ts`

**Step 1: Implement PDF preparation**

The PDF module needs to:
1. Load a PDF from a Uint8Array
2. Add a signature placeholder (empty signature dictionary with ByteRange)
3. Return the prepared PDF bytes and the byte range info needed for hashing

Use `pdf-lib` to add the signature placeholder. Study `@signpdf/placeholder-pdf-lib` source for the correct approach.

Key considerations:
- The placeholder must reserve enough space for the CMS SignedData (~8KB for PAdES B-T with timestamp)
- ByteRange must be set correctly — two ranges: before and after the signature hex string
- The placeholder content is `/Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached`

**Step 2: Write test**

```typescript
// packages/client-sdk/tests/pdf.test.ts
import { describe, it, expect } from 'vitest';
import { preparePdf } from '../src/pdf';
import { PDFDocument } from 'pdf-lib';

describe('PDF preparation', () => {
  it('should add a signature placeholder to a PDF', async () => {
    // Create a simple test PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595, 842]); // A4
    const pdfBytes = await pdfDoc.save();

    const result = await preparePdf(new Uint8Array(pdfBytes));

    expect(result.preparedPdf).toBeInstanceOf(Uint8Array);
    expect(result.preparedPdf.length).toBeGreaterThan(pdfBytes.byteLength);
    expect(result.byteRange).toHaveLength(4);
    expect(result.signaturePlaceholderOffset).toBeGreaterThan(0);
    expect(result.signaturePlaceholderLength).toBeGreaterThan(0);
  });
});
```

**Step 3: Implement and iterate until test passes**

**Step 4: Commit**

```bash
git add packages/client-sdk/src/pdf.ts packages/client-sdk/tests/pdf.test.ts
git commit -m "feat(C2): SDK PDF preparation — placeholder insertion with pdf-lib"
```

---

### Task C3: Hash Computation

**Files:**
- Create: `packages/client-sdk/src/hash.ts`
- Create: `packages/client-sdk/tests/hash.test.ts`

**Step 1: Implement hash computation**

This is the CRITICAL module. Must implement the CMS signing subtlety correctly:
1. Compute SHA-256 of the PDF byte ranges (the parts NOT including the signature placeholder)
2. Build CMS SignedAttributes containing the PDF hash as `messageDigest`
3. DER-encode the SignedAttributes
4. Hash the DER-encoded SignedAttributes → this is what goes to signHash

The SignedAttributes MUST include (per CMS/PKCS#7 and PAdES):
- `contentType` (OID 1.2.840.113549.1.9.3) = `id-data` (OID 1.2.840.113549.1.7.1)
- `messageDigest` (OID 1.2.840.113549.1.9.4) = the PDF byte range hash
- `signingTime` (OID 1.2.840.113549.1.9.5) = current UTC time

Use `node-forge` for ASN.1/DER encoding.

**Step 2: Write test with known hash values**

**Step 3: Implement and iterate**

**Step 4: Commit**

```bash
git add packages/client-sdk/src/hash.ts packages/client-sdk/tests/hash.test.ts
git commit -m "feat(C3): SDK hash computation — SignedAttributes + DER encoding"
```

---

### Task C4: API Integration

**Files:**
- Create: `packages/client-sdk/src/api.ts`
- Create: `packages/client-sdk/tests/api.test.ts`

**Step 1: Implement typed CSC v2 API client**

Simple HTTP client that calls:
1. `POST /oauth2/token` → access token
2. `POST /csc/v2/credentials/authorize` → SAD
3. `POST /csc/v2/signatures/signHash` → raw signature(s)

Use native `fetch` (no external HTTP library needed).

**Step 2: Write tests (can mock fetch or test against running server)**

**Step 3: Commit**

```bash
git add packages/client-sdk/src/api.ts packages/client-sdk/tests/api.test.ts
git commit -m "feat(C4): SDK API client — typed CSC v2 endpoint calls"
```

---

### Task C5: CMS SignedData Assembly

**Files:**
- Create: `packages/client-sdk/src/cms.ts`
- Create: `packages/client-sdk/tests/cms.test.ts`

**Step 1: Implement CMS SignedData builder**

Build a CMS SignedData (PKCS#7) container in detached mode:
- Version 1
- DigestAlgorithms: SHA-256
- EncapContentInfo: id-data (detached — no content included)
- Certificates: include the signing certificate (and chain if available)
- SignerInfo: contains the signature from signHash + the SignedAttributes

Use `node-forge` PKCS#7 utilities. Study `@signpdf/signer-p12` and `Xevolab/node-signpdf-pades` for reference.

Key: The signature value from signHash goes into `SignerInfo.signature`. The SignedAttributes computed in C3 go into `SignerInfo.authenticatedAttributes`.

**Step 2: Test that output is valid DER-encoded CMS**

**Step 3: Commit**

```bash
git add packages/client-sdk/src/cms.ts packages/client-sdk/tests/cms.test.ts
git commit -m "feat(C5): SDK CMS SignedData assembly — PKCS#7 detached signature"
```

---

### Task C6: RFC 3161 Timestamp

**Files:**
- Create: `packages/client-sdk/src/timestamp.ts`
- Create: `packages/client-sdk/tests/timestamp.test.ts`

**Step 1: Implement RFC 3161 TSA client**

1. Compute SHA-256 of the signature value from SignerInfo
2. Build a TimeStampReq (ASN.1/DER) per RFC 3161
3. POST to FreeTSA (`https://freetsa.org/tsr`) with `Content-Type: application/timestamp-query`
4. Parse TimeStampResp
5. Extract TimeStampToken (a CMS SignedData containing the timestamp)
6. Embed as an unsigned attribute in the SignerInfo (OID 1.2.840.113549.1.9.16.2.14)

This elevates the signature from PAdES Baseline B to PAdES Baseline B-T.

**Step 2: Test against FreeTSA (integration test)**

**Step 3: Commit**

```bash
git add packages/client-sdk/src/timestamp.ts packages/client-sdk/tests/timestamp.test.ts
git commit -m "feat(C6): SDK RFC 3161 timestamp — FreeTSA integration for PAdES B-T"
```

---

### Task C7: PDF Finalization

**Files:**
- Create: `packages/client-sdk/src/seal.ts` (main orchestrator)
- Create: `packages/client-sdk/tests/seal.test.ts`

**Step 1: Implement the seal orchestrator**

This is the main entry point. It orchestrates the full flow:
1. `preparePdf()` → placeholder + byte ranges
2. `computeHash()` → SignedAttributes hash
3. `apiClient.getToken()` → access token
4. `apiClient.authorize()` → SAD
5. `apiClient.signHash()` → raw signature
6. `buildCmsSignedData()` → CMS container
7. `addTimestamp()` → RFC 3161 timestamp in CMS
8. Inject CMS hex into PDF placeholder at the correct byte offset
9. Return sealed PDF

Each step emits via `onStep` callback with timing and data.

**Step 2: Test end-to-end (requires running API server)**

```bash
# Start the API server in one terminal
npm run dev

# In another terminal, run the SDK integration test
cd packages/client-sdk
npm test
```

**Step 3: Commit**

```bash
git add packages/client-sdk/src/seal.ts packages/client-sdk/tests/seal.test.ts
git commit -m "feat(C7): SDK seal orchestrator — full PDF sealing pipeline"
```

---

### Task C8: onStep Callback + CLI Demo

**Files:**
- Update: `packages/client-sdk/src/seal.ts` (add onStep throughout)
- Update: `packages/client-sdk/src/index.ts` (export all public API)
- Create: `scripts/seal-demo.ts`
- Create: `test-files/sample.pdf` (small test PDF)

**Step 1: Ensure onStep fires for every step**

Each step emits:
```typescript
{
  name: 'hash_computed',
  description: 'SHA-256 hash of PDF byte ranges computed, SignedAttributes built',
  durationMs: 3,
  data: {
    pdfHash: 'a4f0a83a...',           // hex
    signedAttributesHash: 'b2c1e4...',  // hex (this is what goes to signHash)
    byteRangeSize: 45231,
  }
}
```

**Step 2: Create CLI demo script**

```typescript
// scripts/seal-demo.ts
import { readFileSync, writeFileSync } from 'fs';
import { SealClient } from '../packages/client-sdk/src';

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: npx tsx scripts/seal-demo.ts <input.pdf>');
    process.exit(1);
  }

  const client = new SealClient({
    baseUrl: process.env.API_URL || 'http://localhost:3000',
    clientId: process.env.DEMO_CLIENT_ID!,
    clientSecret: process.env.DEMO_CLIENT_SECRET!,
    pin: process.env.DEMO_PIN!,
    credentialId: process.env.DEMO_CREDENTIAL_ID!,
  });

  const pdfBytes = readFileSync(inputPath);

  console.log(`Sealing: ${inputPath}`);
  console.log('');

  const result = await client.seal(new Uint8Array(pdfBytes), {
    onStep: (step) => {
      console.log(`  [${step.durationMs}ms] ${step.name}: ${step.description}`);
    },
  });

  const outputPath = inputPath.replace('.pdf', '-sealed.pdf');
  writeFileSync(outputPath, result.sealedPdf);

  console.log('');
  console.log(`Sealed PDF written to: ${outputPath}`);
  console.log(`Total time: ${result.totalDurationMs}ms`);
  console.log(`Steps: ${result.steps.length}`);
}

main().catch(console.error);
```

**Step 3: Create a sample test PDF**

```typescript
// Generate a small test PDF
import { PDFDocument } from 'pdf-lib';
import { writeFileSync } from 'fs';

async function createSample() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawText('Qualified E-Seal by SK ID — Test Document', { x: 50, y: 750, size: 16 });
  page.drawText('This document will be sealed with a CSC v2 compliant e-seal.', { x: 50, y: 720, size: 12 });
  page.drawText(`Generated: ${new Date().toISOString()}`, { x: 50, y: 690, size: 10 });
  writeFileSync('test-files/sample.pdf', await doc.save());
}
createSample();
```

**Step 4: Run the full demo**

```bash
mkdir -p test-files
npx tsx scripts/create-sample-pdf.ts
npx tsx scripts/seal-demo.ts test-files/sample.pdf
```
Expected: Sealed PDF created, all steps logged with timing.

**Step 5: Commit**

```bash
git add packages/client-sdk/src/ scripts/ test-files/
git commit -m "feat(C8): onStep callback + CLI seal demo"
```

---

### Task C9: SDK README

**Files:**
- Update: `packages/client-sdk/README.md`

**Step 1: Write comprehensive SDK documentation**

Cover:
- What is this (CSC v2 client SDK for remote e-sealing)
- Installation
- Quick start (5-line code example)
- Configuration options
- Full API reference (SealClient, SealClientConfig, SealResult, SealStep)
- How the sealing flow works (with diagram)
- How to use onStep for observability
- Error handling
- How to swap in a real certificate (link to guide)

**Step 2: Commit**

```bash
git add packages/client-sdk/README.md
git commit -m "docs(C9): SDK README — installation, usage, API reference"
```

### CHECKPOINT C — Verification

This is the most critical checkpoint. The full loop must work:

- [ ] `npx tsx scripts/seal-demo.ts test-files/sample.pdf` → `sample-sealed.pdf` created
- [ ] Open `sample-sealed.pdf` in Adobe Acrobat → signature panel shows signature with test cert
- [ ] Adobe shows "unknown signer" (expected — self-signed) but signature structure is valid
- [ ] Signature includes RFC 3161 timestamp (check in Adobe signature details)
- [ ] `onStep` callback fires 9 times (pdf_loaded through pdf_sealed) with correct data
- [ ] `cd packages/client-sdk && npm test` passes independently
- [ ] SDK has zero imports from `src/` (Next.js app) — fully standalone
- [ ] SDK README is complete and accurate

---

## Phase D: Documentation

### Task D1-D6: Documentation Suite

**Files:**
- Create: `docs/architecture.md`
- Create: `docs/csc-v2-mapping.md`
- Create: `docs/guides/seal-first-pdf.md`
- Create: `docs/guides/certificate-swap.md`
- Update: `README.md` (project root)
- Update: inline code comments throughout

**These tasks are documentation — no code logic changes.** Write each document, verify accuracy against actual code, commit individually.

**D1:** Architecture doc with component diagram (text-based), data flow, and design decision rationale.

**D2:** CSC v2 mapping table — every spec section (8.5, 11.1, 11.4, 11.7) mapped to exact file and function.

**D3:** "Seal your first PDF" step-by-step guide — from `npm install` to holding a sealed PDF.

**D4:** Certificate swap guide — exact steps to import a real SK .p12 certificate.

**D5:** Project README — overview, architecture diagram, quick start, links to all docs.

**D6:** Walk through every endpoint handler and SDK module, add inline comments linking to CSC spec sections (e.g., `// CSC v2 Spec §11.7 — signatures/signHash`). Comments should explain WHY, not WHAT.

### CHECKPOINT D — Verification

- [ ] Clone the repo fresh into a temp dir, read README, follow "seal first PDF" guide — works in under 5 minutes
- [ ] csc-v2-mapping.md has entries for ALL 6 endpoints + SDK modules
- [ ] architecture.md diagram matches actual folder structure
- [ ] certificate-swap.md steps are accurate (test with a dummy .p12 if possible)

---

## Phase E: Landing Page + Live Demo (LAST)

### ⚠️ MANDATORY STOP: Task E0

**Before ANY work on Phase E, STOP and ask the user:**

> "Phase E: Landing page. I need your SK branding/styling guidance before proceeding. What colors, fonts, logo, and visual style should I use?"

**Do NOT proceed until user provides branding direction.**

### Task E1: Landing Page Content

After receiving branding guidance, build the marketing landing page:
- Hero section with service name "Qualified E-Seal by SK ID"
- Value proposition
- "How it works" section with hash-only flow diagram
- Use cases (invoicing, contracts, mass document sealing)
- Pricing tiers (from BRD v3)
- Compliance section (eIDAS, GDPR, CSC v2)
- Developer experience section (API-first, SDK, OpenAPI)

### Task E2: Upload Demo UI

- Drag-and-drop PDF upload component
- File validation (PDF only, max size)
- Upload progress indicator

### Task E3: SSE Process X-Ray

- `POST /api/demo/seal` API route that:
  1. Receives uploaded PDF
  2. Uses the Client SDK with `onStep` callback
  3. Streams each step as SSE events to the browser
- Frontend `EventSource` that renders steps in real-time
- Each step row: checkmark animation, step name, duration, expandable icon

### Task E4: Expandable Step Details

- Click `[</>]` on any step → expand to show:
  - Code snippet (the SDK call that performed this step)
  - Actual values (hash, token preview, cert subject, etc.)
  - CSC v2 spec section reference with link
- Collapse on second click

### Task E5: Sealed PDF Download

- After all steps complete, download button activates
- Clicking downloads the sealed PDF
- Show file size delta (original vs sealed)

### Task E6: Responsive Design + Polish

- Mobile responsive (test at 375px, 768px, 1024px, 1440px)
- Loading states, error states
- Smooth animations (step rows sliding in)
- Visual consistency with SK branding throughout

### CHECKPOINT E — Verification

- [ ] Landing page loads — looks like a professional SK-branded product page
- [ ] Upload a PDF → steps appear one-by-one in real-time via SSE
- [ ] Each step expandable → shows code, actual values, spec reference
- [ ] Download sealed PDF → identical result to CLI demo
- [ ] Mobile responsive at 375px, 768px, 1024px
- [ ] No console errors, no layout breaks
- [ ] Process X-ray shows real timing (not fake/simulated)
- [ ] Total time displayed after completion

---

## Final Verification

After all phases complete:

- [ ] Full E2E flow via CLI: `seal-demo.ts` produces valid sealed PDF
- [ ] Full E2E flow via landing page: upload → watch → download
- [ ] All documentation accurate and up-to-date
- [ ] OpenAPI spec at `/docs` matches all implemented endpoints
- [ ] `npm run build` succeeds with zero warnings
- [ ] `cd packages/client-sdk && npm test` passes
- [ ] Git history is clean with descriptive commits per task
- [ ] No secrets in git (check .env.local is gitignored)
- [ ] SCOPE.md and CLAUDE.md are up-to-date
