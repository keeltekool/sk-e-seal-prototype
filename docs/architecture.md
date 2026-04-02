# Architecture

> Qualified E-Seal by SK ID — CSC v2 compliant remote e-sealing prototype

## Component Diagram

```
                         CLIENT (SDK / Browser)
    ┌──────────────────────────────────────────────────────┐
    │                                                      │
    │  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
    │  │ pdf-lib   │  │ hash.ts  │  │ cms.ts             │  │
    │  │ pdf.ts    │→ │          │  │ buildCmsSignedData  │  │
    │  │           │  │ compute  │  │ addTimestampToCms   │  │
    │  │ prepare   │  │ Hash()   │  └────────┬───────────┘  │
    │  │ Pdf()     │  └────┬─────┘           │              │
    │  └──────────┘       │              inject             │
    │                      │           Signature()          │
    │                      ▼                ▲               │
    │              ┌───────────────┐        │               │
    │              │  api.ts       │        │               │
    │              │  CscApiClient │        │               │
    │              └───────┬───────┘        │               │
    │                      │          ┌─────┴──────┐        │
    │                      │          │timestamp.ts│        │
    │                      │          │ Sectigo QTSA│        │
    │                      │          └────────────┘        │
    │              ┌───────┴───────┐                        │
    │              │  seal.ts      │  ← orchestrator        │
    │              │  SealClient   │                        │
    │              └───────────────┘                        │
    └──────────────────────┬───────────────────────────────┘
                           │ HTTPS (only 32-byte hash crosses this boundary)
                           ▼
                      CSC v2 API SERVER
    ┌──────────────────────────────────────────────────────┐
    │                                                      │
    │  ┌────────────────┐   ┌────────────────────────────┐ │
    │  │ /oauth2/token  │   │ /csc/v2/info               │ │
    │  │ (auth.ts)      │   │ (public, no auth)          │ │
    │  └───────┬────────┘   └────────────────────────────┘ │
    │          │ JWT                                        │
    │          ▼                                            │
    │  ┌────────────────┐  ┌─────────────────────────────┐ │
    │  │ middleware.ts   │  │ /csc/v2/credentials/*       │ │
    │  │ Bearer token    │→ │   /list     — enum creds   │ │
    │  │ validation      │  │   /info     — cert + key   │ │
    │  └────────────────┘  │   /authorize — PIN → SAD    │ │
    │                       └─────────────────────────────┘ │
    │                                                      │
    │  ┌─────────────────────────────────────────────────┐ │
    │  │ /csc/v2/signatures/signHash                     │ │
    │  │ Validates SAD → decrypts private key → RSA sign │ │
    │  └─────────────────────────────────────────────────┘ │
    │                                                      │
    │  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
    │  │ crypto.ts │  │ db.ts    │  │ schema.sql       │  │
    │  │ RSA, AES  │  │ Neon PG  │  │ 4 tables         │  │
    │  └───────────┘  └──────────┘  └──────────────────┘  │
    └──────────────────────────────────────────────────────┘
```

## Data Flow

The sealing flow follows CSC v2's hash-only model. The PDF document **never leaves the client** — only a 32-byte SHA-256 hash crosses the network boundary.

### Step-by-step flow

```
 Step   Who         Action                                             CSC v2 Spec
 ────   ───         ──────                                             ───────────
  1     Client      Load PDF, add signature placeholder (pdf-lib)      —
  2     Client      SHA-256 of PDF byte ranges → pdfHash               —
  3     Client      Build CMS SignedAttributes (pdfHash as             RFC 5652 §11
                    messageDigest) → DER encode → SHA-256 →
                    signedAttributesHash
  4     Client      POST /oauth2/token (client_credentials)            §8
  5     Client      POST /csc/v2/credentials/authorize                 §11.4
                    (PIN + signedAttributesHash → SAD token)
  6     Server      Verify PIN (bcrypt) → issue JWT SAD                §11.4
                    (5 min TTL, single-use, bound to hash)
  7     Client      POST /csc/v2/signatures/signHash                   §11.7
                    (SAD + signedAttributesHash)
  8     Server      Validate SAD → decrypt private key →               §11.7
                    DigestInfo(SHA-256, hash) → RSA PKCS#1 v1.5
  9     Client      Receive raw RSA signature                          §11.7
 10     Client      Wrap signature in CMS SignedData container         RFC 5652
 11     Client      POST to Sectigo QTSA → RFC 3161 timestamp          RFC 3161
 12     Client      Add timestamp as CMS unsigned attribute            RFC 5652 §11.4
 13     Client      Inject CMS hex into PDF placeholder                PAdES (ETSI 319 142)
 14     Client      Output: sealed PDF with PAdES B-T signature        —
```

### The CMS signing subtlety

This is the single most important technical detail in the project. For PAdES signatures, you do **not** send the raw PDF hash to signHash. Instead:

1. Compute SHA-256 of the PDF byte ranges → `pdfHash`
2. Build CMS SignedAttributes containing `pdfHash` as the `messageDigest` attribute
3. DER-encode the SignedAttributes → SHA-256 of that DER → `signedAttributesHash`
4. Send `signedAttributesHash` to `/csc/v2/signatures/signHash`

The server signs `signedAttributesHash`. The client then places the raw signature into the CMS SignedData container alongside the SignedAttributes. A verifier (Adobe, DigiDoc4) re-hashes the SignedAttributes and verifies the RSA signature over that hash.

This is documented in `node-signpdf` issue #46 and is the reason the SDK builds CMS SignedData manually (node-forge's `createSignedData()` expects to do the signing itself).

## Folder Structure

```
sk-e-seal-prototype/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── oauth2/token/route.ts          OAuth2 Client Credentials
│   │   │   └── csc/v2/
│   │   │       ├── info/route.ts              Service metadata
│   │   │       ├── credentials/
│   │   │       │   ├── list/route.ts          Enumerate credentials
│   │   │       │   ├── info/route.ts          Certificate chain + key info
│   │   │       │   └── authorize/route.ts     SCAL2 PIN → SAD
│   │   │       └── signatures/
│   │   │           └── signHash/route.ts      Core signing
│   │   ├── docs/page.tsx                      Swagger UI
│   │   ├── layout.tsx                         Root layout
│   │   └── page.tsx                           Home page
│   └── lib/
│       ├── auth.ts                            JWT generation + verification
│       ├── crypto.ts                          RSA keygen, AES-256-GCM encrypt/decrypt
│       ├── db.ts                              Neon PostgreSQL connection
│       ├── middleware.ts                       Bearer token validation
│       └── schema.sql                         Database schema (4 tables)
├── packages/client-sdk/
│   ├── src/
│   │   ├── seal.ts                            SealClient orchestrator
│   │   ├── pdf.ts                             PDF placeholder + injection
│   │   ├── hash.ts                            SignedAttributes hash computation
│   │   ├── api.ts                             Typed CSC v2 HTTP client
│   │   ├── cms.ts                             CMS SignedData assembly + timestamp
│   │   ├── timestamp.ts                       RFC 3161 TSA client
│   │   ├── asn1-helpers.ts                    OID constants, DER utilities
│   │   ├── types.ts                           Public interfaces
│   │   └── index.ts                           Public API exports
│   └── tests/                                 23 unit/integration tests
├── scripts/
│   ├── seal-demo.ts                           CLI sealing demo
│   ├── create-test-pdf.ts                     Generate test PDF
│   ├── migrate.ts                             Run database migrations
│   └── seed.ts                                Seed demo tenant + credential
├── public/
│   └── openapi.yaml                           OpenAPI 3.1 specification
└── docs/
    └── plans/                                 Implementation plans
```

## Database Schema

Four tables in Neon PostgreSQL:

| Table | Purpose | Key fields |
|---|---|---|
| `tenants` | Organizations using the service | `client_id`, `client_secret_hash`, `pin_hash`, `status` |
| `credentials` | E-seal certificates + encrypted private keys | `tenant_id` (FK), `credential_id`, `certificate_pem`, `private_key_pem_encrypted`, `scal` |
| `audit_log` | Every signing operation recorded | `tenant_id`, `operation`, `hash_values[]`, `ip_address` |
| `sad_tokens` | Single-use enforcement for SAD tokens | `token_hash`, `hash_values[]`, `used`, `expires_at` |

**Private key encryption:** AES-256-GCM with key derived from `SHA-256(CREDENTIAL_ENCRYPTION_KEY)`. Stored as `base64(iv):base64(authTag):base64(ciphertext)`.

**Indexes:** `credentials(tenant_id)`, `audit_log(tenant_id)`, `sad_tokens(token_hash)`.

## Design Decisions

### Hash-only model
Documents never touch the server. The client computes SHA-256 locally and sends only the 32-byte hash. This is mandated by CSC v2 and critical for GDPR/data privacy — the server has no access to document content.

### SCAL2 (not SCAL1)
The SCAL1 vs SCAL2 debate is settled: SCAL2 is required for qualified level per Raul's regulatory feedback. The `credentials/authorize` endpoint requires a PIN, returning a short-lived (5 min), single-use SAD token bound to specific hash values.

### Manual CMS assembly
Node-forge's `pkcs7.createSignedData()` expects to perform the signing itself. Since we receive a pre-computed raw signature from the CSC API, we build the ASN.1 CMS structure manually using `forge.asn1.create()`. This gives full control over the PKCS#7 ContentInfo → SignedData → SignerInfo tree.

### DER certificate buffers (no PEM round-trips)
The CSC API returns certificates as base64-encoded DER. The SDK keeps them as DER buffers throughout — no PEM conversion at any stage. This avoids unnecessary encoding overhead and matches the ASN.1 structures that CMS expects.

### PAdES B-T from day one
Every signature includes an RFC 3161 timestamp (from Sectigo QTSA). This elevates the signature from PAdES Baseline B to Baseline-T, proving when the signature was created. The 16KB signature placeholder accommodates both the CMS container and the timestamp token.

### Certificate swappability
The credential store is designed so any certificate + key pair can be plugged in:
- **Self-signed** (current) — works but Adobe shows "unknown CA"
- **Real SK advanced e-seal** (.p12 import) — Adobe green checkmark, DigiDoc4 validates
- **Qualified** — would require HSM integration (out of scope for prototype)

Swapping is a database row update, not a code change. See [Certificate Swap Guide](guides/certificate-swap.md).

### SDK parallelization
The `SealClient.seal()` method parallelizes the credential info fetch with the authorize → signHash chain using `Promise.all()`. Since `getCredentialInfo()` only needs the access token (not the signing result), this saves one network round-trip.

## Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Proven pattern from alkoholiks-api |
| Database | Neon (serverless PostgreSQL) | Credentials, tenants, audit log |
| Crypto (server) | Node.js native `crypto` | RSA, AES-256-GCM, SHA-256 — zero deps |
| Certificates | `node-forge` | X.509 cert generation, ASN.1/CMS assembly |
| PDF | `pdf-lib` + `@signpdf/*` | Signature placeholders and injection |
| JWT | `jose` | Access tokens + SAD tokens |
| Auth | `bcryptjs` | Password/PIN hashing |
| Timestamps | Sectigo QTSA | Free RFC 3161 TSA for prototype |
| API docs | OpenAPI 3.1 + Swagger UI | At `/docs` |

## Security Model

1. **OAuth 2.0 Client Credentials** — M2M authentication (no human in the loop for auth)
2. **SCAL2 PIN** — Per-tenant PIN required for credential authorization (hashed with bcrypt, cost 12)
3. **SAD tokens** — JWT-based, 5-minute TTL, single-use, bound to specific hash values
4. **Private key encryption at rest** — AES-256-GCM with authenticated encryption
5. **Audit trail** — Every token issuance, authorization, and signing operation logged with IP and user-agent
6. **No document access** — Server never sees document content, only 32-byte hashes
