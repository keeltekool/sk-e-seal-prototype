# Seal Your First PDF

> From `git clone` to holding a sealed PDF in under 5 minutes.

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **PostgreSQL** — a Neon account (free tier works), or any PostgreSQL 15+ instance
- **Git**

## 1. Clone and install

```bash
git clone https://github.com/keeltekool/sk-e-seal-prototype.git
cd sk-e-seal-prototype
npm install
cd packages/client-sdk && npm install && cd ../..
```

## 2. Set up the database

Create a Neon project (or local PostgreSQL database). Copy your connection string.

Create `.env.local` in the project root:

```env
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
JWT_SECRET=any-random-string-at-least-32-chars
CREDENTIAL_ENCRYPTION_KEY=another-random-string-at-least-32-chars
```

Run the migration to create tables:

```bash
npx tsx scripts/migrate.ts
```

## 3. Seed demo data

This creates a test tenant with an RSA 2048 keypair and self-signed X.509 certificate:

```bash
npx tsx scripts/seed.ts
```

The script prints credentials — **copy them** and add to `.env.local`:

```env
DEMO_CLIENT_ID=demo-tenant-001
DEMO_CLIENT_SECRET=<printed by seed script>
DEMO_PIN=12345
DEMO_CREDENTIAL_ID=<printed by seed script>
```

## 4. Start the API server

```bash
npm run dev
```

Verify the server is running:

```bash
curl -X POST http://localhost:3000/csc/v2/info
```

You should see JSON with `"specs": "2.0.0.2"` and `"name": "Qualified E-Seal by SK ID"`.

Visit http://localhost:3000/docs for the interactive Swagger UI.

## 5. Generate a test PDF

```bash
npx tsx scripts/create-test-pdf.ts
```

This creates `test-files/sample.pdf` — a minimal A4 PDF with test text.

## 6. Seal it

```bash
npx tsx scripts/seal-demo.ts test-files/sample.pdf
```

You'll see each step logged in real-time:

```
  Sealing: test-files/sample.pdf
  Size: 1574 bytes

  [   12ms] placeholder_created: Signature placeholder added to PDF (1574 → 19116 bytes)
  [    2ms] hash_computed: PDF byte range hashed, SignedAttributes built and hashed
  [  145ms] token_obtained: OAuth2 access token obtained
  [  203ms] credential_authorized: Credential authorized via SCAL2 PIN → SAD token
  [  189ms] hash_signed: Hash signed via CSC v2 signHash (256 bytes)
  [    1ms] cms_built: CMS SignedData assembled (1842 bytes)
  [  892ms] timestamp_added: RFC 3161 timestamp added (4521 bytes from TSA)
  [    0ms] pdf_sealed: PDF sealed (19116 bytes)

  Output: test-files/sample-sealed.pdf
  Total:  1447ms
  Steps:  8
```

## 7. Verify the signature

Open `test-files/sample-sealed.pdf` in **Adobe Acrobat Reader**:

1. Click the signature panel (left sidebar, pen icon)
2. You'll see a signature from the self-signed test certificate
3. Adobe shows "The signer's identity is unknown" — this is expected with a self-signed cert
4. Click "Signature Details" to see:
   - **Signing time** with RFC 3161 timestamp
   - **Certificate chain** (self-signed test cert)
   - **Hash algorithm**: SHA-256
   - The signature **structure is valid** — only the CA trust is missing

With a real SK-issued certificate, this would show a green checkmark. See the [Certificate Swap Guide](certificate-swap.md) for how to upgrade.

## Using the SDK programmatically

```typescript
import { SealClient } from '@sk-eseal/client-sdk';
import { readFileSync, writeFileSync } from 'fs';

const client = new SealClient({
  baseUrl: 'http://localhost:3000',
  clientId: 'demo-tenant-001',
  clientSecret: 'your-secret',
  pin: '12345',
  credentialId: 'your-credential-id',
});

const pdf = readFileSync('invoice.pdf');
const result = await client.seal(new Uint8Array(pdf), {
  onStep: (step) => console.log(`${step.name}: ${step.durationMs}ms`),
});

writeFileSync('invoice-sealed.pdf', result.sealedPdf);
```

## Using individual SDK modules

For more control, use the modules directly:

```typescript
import { preparePdf, computeHash, CscApiClient, buildCmsSignedData, addTimestampToCms, injectSignature, getTimestamp } from '@sk-eseal/client-sdk';

// 1. Add signature placeholder
const prepared = await preparePdf(pdfBytes, 16384);

// 2. Compute hash (SignedAttributes DER → SHA-256)
const hashResult = computeHash(prepared.preparedPdf, prepared.byteRange);

// 3. Get token, authorize, sign via CSC API
const api = new CscApiClient({ baseUrl, clientId, clientSecret, pin, credentialId });
const token = await api.getToken();
const auth = await api.authorize(token.access_token, hashResult.signedAttributesHash.toString('base64'));
const signed = await api.signHash(token.access_token, auth.SAD, hashResult.signedAttributesHash.toString('base64'));

// 4. Build CMS + timestamp + inject
const rawSig = Buffer.from(signed.signatures[0], 'base64');
let cms = buildCmsSignedData(rawSig, hashResult.signedAttributesDer, signingCert, certDerBuffers);
const tst = await getTimestamp(rawSig);
cms = addTimestampToCms(cms, tst);
const sealedPdf = injectSignature(prepared, cms.toString('hex'));
```

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `Missing required environment variables` | `.env.local` not found or incomplete | Check all 6 vars are set (DATABASE_URL, JWT_SECRET, CREDENTIAL_ENCRYPTION_KEY, DEMO_CLIENT_ID, DEMO_CLIENT_SECRET, DEMO_PIN, DEMO_CREDENTIAL_ID) |
| `Credential not found` | Seed script not run, or wrong credential ID | Re-run `npx tsx scripts/seed.ts` and update `.env.local` |
| `Invalid client_secret` | Secret mismatch | Re-run seed to regenerate; copy the new secret |
| `timestamp_added` step slow (~1-2s) | FreeTSA.org network latency | Normal — TSA is external. Production would use SK's own TSA |
| Adobe shows "unknown signer" | Self-signed test certificate | Expected. Use a real CA-issued cert for green checkmark |
