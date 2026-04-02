# Qualified E-Seal

The first open-source CSC v2 compliant remote e-sealing service. Full working prototype: 6 API endpoints, TypeScript client SDK (8 modules, 24 tests), live demo with SSE Process X-Ray, Developer Portal with credential management and seal playground, PAdES B-T signatures with RFC 3161 qualified timestamps. Hash-only privacy model — documents never leave client infrastructure.

**[Live Demo](https://sk-e-seal-prototype.vercel.app)** | **[Developer Portal](https://sk-e-seal-prototype.vercel.app/dashboard)** | **[API Docs](https://sk-e-seal-prototype.vercel.app/docs)**

## Architecture

```
CLIENT (SDK)                                SERVER (CSC v2 API)
─────────────                               ───────────────────
1. Load PDF
2. Add signature placeholder
3. SHA-256 of byte ranges → pdfHash
4. Build SignedAttributes (pdfHash
   as messageDigest) → DER → SHA-256
                                     ──→    5. POST /oauth2/token
                                     ──→    6. POST /csc/v2/credentials/authorize (PIN → SAD)
                                     ──→    7. POST /csc/v2/signatures/signHash (hash → sig)
                                     ←──    8. Raw RSA signature returned
9. Wrap in CMS SignedData
10. Add RFC 3161 timestamp (Sectigo Qualified TSA)
11. Inject CMS into PDF placeholder
12. Output: sealed PDF (PAdES B-T)
```

**The PDF document never leaves the client.** Only a 32-byte SHA-256 hash crosses the network boundary (CSC v2 hash-only model).

## Quick Start

```bash
git clone https://github.com/keeltekool/sk-e-seal-prototype.git
cd sk-e-seal-prototype
npm install && cd packages/client-sdk && npm install && cd ../..

# Set up .env.local with DATABASE_URL, JWT_SECRET, CREDENTIAL_ENCRYPTION_KEY
npx tsx scripts/migrate.ts
npx tsx scripts/seed.ts       # Creates demo tenant + 3 seal credentials

npm run dev                    # Start API server on :3000
npx tsx scripts/create-test-pdf.ts
npx tsx scripts/seal-demo.ts test-files/sample.pdf
```

Output: `test-files/sample-sealed.pdf` — open in Adobe Acrobat to see the signature.

See [Seal Your First PDF](docs/guides/seal-first-pdf.md) for the full walkthrough.

## CSC v2 API Endpoints

All endpoints follow the [Cloud Signature Consortium API v2.0.0.2](https://cloudsignatureconsortium.org/wp-content/uploads/2023/04/csc-api-v2.0.0.2.pdf) specification.

| Endpoint | Purpose | Auth |
|---|---|---|
| `POST /oauth2/token` | Client Credentials → access token | None (issues tokens) |
| `POST /csc/v2/info` | Service metadata and capabilities | None (public) |
| `POST /csc/v2/credentials/list` | List credentials for tenant | Bearer |
| `POST /csc/v2/credentials/info` | Certificate chain, key info, SCAL level | Bearer |
| `POST /csc/v2/credentials/authorize` | SCAL2: PIN + hash → SAD token | Bearer |
| `POST /csc/v2/signatures/signHash` | SAD + hash → RSA signature | Bearer |

Interactive API documentation at http://localhost:3000/docs (Swagger UI).

## Client SDK

The SDK is a standalone package at `packages/client-sdk/` — structured for npm publishing.

### High-level API

```typescript
import { SealClient } from '@sk-eseal/client-sdk';

const client = new SealClient({
  baseUrl: 'https://sk-e-seal-prototype.vercel.app/api',
  clientId: 'tenant-demo-corp-001',
  clientSecret: 'your-secret',    // Generate in Developer Portal
  pin: 'your-pin',                // Generate in Developer Portal
  credentialId: 'cred-inv-001',   // Choose from portal's Seal Credentials
});

const result = await client.seal(pdfBytes, {
  onStep: (step) => console.log(`${step.name}: ${step.durationMs}ms`),
});

// result.sealedPdf — Uint8Array of the sealed PDF
// result.steps — array of SealStep objects with timing data
// result.totalDurationMs — total elapsed time
```

### SDK Modules

| Module | Purpose |
|---|---|
| `seal.ts` | `SealClient` — orchestrates the 8-step sealing pipeline |
| `pdf.ts` | `preparePdf()` / `injectSignature()` — PDF placeholder and CMS injection |
| `hash.ts` | `computeHash()` — SignedAttributes DER → SHA-256 (the CMS subtlety) |
| `api.ts` | `CscApiClient` — typed HTTP client for all CSC v2 endpoints |
| `cms.ts` | `buildCmsSignedData()` / `addTimestampToCms()` — PKCS#7 assembly |
| `timestamp.ts` | `getTimestamp()` — RFC 3161 TSA client (Sectigo Qualified TSA default) |
| `asn1-helpers.ts` | OID constants, DER conversion utilities |
| `types.ts` | `SealClientConfig`, `SealStep`, `SealOptions`, `SealResult` |

### Tests

```bash
cd packages/client-sdk
npm test   # 23 tests across 5 test files
```

## Project Structure

```
sk-e-seal-prototype/
├── src/app/api/                    CSC v2 API route handlers
│   ├── oauth2/token/               OAuth 2.0 Client Credentials
│   └── csc/v2/
│       ├── info/                   Service metadata (§11.1)
│       ├── credentials/
│       │   ├── list/               Enumerate credentials (§11.4)
│       │   ├── info/               Certificate + key details (§11.4)
│       │   └── authorize/          SCAL2 PIN → SAD token (§11.4)
│       └── signatures/signHash/    Core signing endpoint (§11.7)
├── src/lib/                        Shared server utilities
│   ├── auth.ts                     JWT generation + verification
│   ├── crypto.ts                   RSA keygen, AES-256-GCM encryption
│   ├── db.ts                       Neon PostgreSQL connection
│   ├── middleware.ts               Bearer token validation
│   └── schema.sql                  Database schema (4 tables)
├── packages/client-sdk/            Standalone SDK package
│   ├── src/                        8 source modules
│   └── tests/                      23 unit/integration tests
├── scripts/                        CLI tools
│   ├── seal-demo.ts                End-to-end sealing demo
│   ├── create-test-pdf.ts          Generate test PDF
│   ├── migrate.ts                  Database migration
│   └── seed.ts                     Seed demo tenant + 3 seal credentials
├── public/openapi.yaml             OpenAPI 3.1 specification
└── docs/
    ├── architecture.md             Component diagram, data flow, design decisions
    ├── csc-v2-mapping.md           Spec section → code mapping table
    └── guides/
        ├── seal-first-pdf.md       Step-by-step quickstart
        └── certificate-swap.md     Replace test cert with real SK cert
```

## Key Design Decisions

- **Hash-only model** — Documents never touch the server. GDPR/data privacy by design.
- **SCAL2** — Qualified e-seals require explicit authorization (PIN → SAD). Confirmed by regulatory review.
- **PAdES B-T** — Every signature includes an RFC 3161 timestamp from day one.
- **Manual CMS assembly** — Node-forge's `createSignedData()` expects to sign itself. Since we receive a pre-computed signature from the CSC API, we build the ASN.1 structure manually.
- **Certificate swappable** — Drop in a real SK .p12 certificate via database update. Zero code changes. See [Certificate Swap Guide](docs/guides/certificate-swap.md).
- **No corners cut** — Every architectural decision is made so the prototype can evolve toward production through incremental upgrades, not rewrites.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | Neon (serverless PostgreSQL) |
| Crypto (server) | Node.js native `crypto` (RSA, AES-256-GCM, SHA-256) |
| Certificates | `node-forge` (X.509, ASN.1, CMS) |
| PDF | `pdf-lib` + `@signpdf/*` |
| JWT | `jose` |
| Timestamps | Sectigo Qualified TSA (RFC 3161, EU Trusted List) |
| API docs | OpenAPI 3.1 + Swagger UI |

## Documentation

- [Architecture](docs/architecture.md) — component diagram, data flow, design decisions
- [CSC v2 Mapping](docs/csc-v2-mapping.md) — every spec section mapped to code
- [Certificate Swap](docs/guides/certificate-swap.md) — replace test cert with real SK cert
- [Developer Portal](https://sk-e-seal-prototype.vercel.app/dashboard) — get credentials, test the API flow
- [Swagger UI](https://sk-e-seal-prototype.vercel.app/docs) — interactive API explorer
- [OpenAPI Spec](public/openapi.yaml) — machine-readable API definition

## Standards

- [CSC API v2.0.0.2](https://cloudsignatureconsortium.org/wp-content/uploads/2023/04/csc-api-v2.0.0.2.pdf) — Cloud Signature Consortium
- [RFC 5652](https://tools.ietf.org/html/rfc5652) — Cryptographic Message Syntax (CMS)
- [RFC 3161](https://tools.ietf.org/html/rfc3161) — Time-Stamp Protocol
- [RFC 6749](https://tools.ietf.org/html/rfc6749) — OAuth 2.0 (Client Credentials)
- [ETSI EN 319 142](https://www.etsi.org/deliver/etsi_en/319100_319199/31914201/) — PAdES
- [eIDAS Regulation](https://digital-strategy.ec.europa.eu/en/policies/eidas-regulation) — EU electronic identification

## License

MIT
