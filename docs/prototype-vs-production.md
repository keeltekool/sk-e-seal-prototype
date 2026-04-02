# Prototype vs Production

> What this MVP demonstrates, what it simplifies, and what changes when SK builds the real thing.
>
> Read this if you're evaluating whether the prototype proves the technical concept. The short answer: **yes** — every piece that matters for the Go/No-Go decision is real. The simplifications are in infrastructure, not in cryptography or protocol compliance.

---

## Summary Table

| Component | Prototype | Production | What Changes |
|---|---|---|---|
| **CSC v2 API** | All 6 endpoints, spec-compliant | Same | Nothing — protocol is identical |
| **Signing algorithm** | RSA 2048, PKCS#1 v1.5, SHA-256 | Same | Algorithm is production-grade already |
| **CMS/PKCS#7 structure** | Manual ASN.1 assembly, detached mode | Same | CMS structure is bit-for-bit correct |
| **PAdES level** | B-T (with RFC 3161 timestamp) | B-T or B-LT | B-LT adds revocation data (Phase 3) |
| **Certificate** | Self-signed test cert | SK-issued qualified cert | Database row swap — [zero code changes](guides/certificate-swap.md) |
| **Private key storage** | AES-256-GCM encrypted in PostgreSQL | HSM (FIPS 140-2 Level 3+) | 2 functions to replace in `crypto.ts` |
| **Authentication** | OAuth 2.0 Client Credentials | Same | Protocol is identical |
| **SCAL level** | SCAL2 (PIN → SAD) | SCAL2 | Flow is identical |
| **Timestamp Authority** | Sectigo Qualified TSA (EU Trusted List) | SK's own TSA or trusted third-party | Config change: `tsaUrl` parameter |
| **Multi-tenancy** | Demo tenant with 3 seal credentials + Developer Portal | Full tenant provisioning | Admin API (Phase 2) |
| **Client SDK** | TypeScript, 8 modules, 23 tests | Same SDK + additional language ports | SDK is production-ready in structure |
| **Database** | Neon serverless PostgreSQL | Enterprise PostgreSQL or managed DB | Connection string swap |
| **Rate limiting** | None | Upstash Redis or similar | Phase 3 |
| **Batch signing** | One hash per signHash call | Multiple hashes per call | Server already accepts `hash[]` array |
| **Certificate lifecycle** | Static (no rotation, no revocation) | Full PKI lifecycle | Phase 2-3 |

---

## What Is Already Production-Real

These components are **not simplified**. They work exactly as they would in a production SK service.

### CSC v2 Protocol Compliance

Every endpoint follows the [CSC API v2.0.0.2 specification](https://cloudsignatureconsortium.org/wp-content/uploads/2023/04/csc-api-v2.0.0.2.pdf) — the same spec SK would implement against.

- **`/csc/v2/info`** (§11.1) — Returns real capabilities, algorithm OIDs, auth types. Not a mock.
- **`/csc/v2/credentials/list`** (§11.4) — Queries real database, returns real credential IDs.
- **`/csc/v2/credentials/info`** (§11.4) — Parses real X.509 certificates, returns real DER-encoded chains, real key metadata, real SCAL level.
- **`/csc/v2/credentials/authorize`** (§11.4) — Full SCAL2 flow: PIN verification (bcrypt), JWT-based SAD token with 5-minute TTL, single-use enforcement, hash binding.
- **`/csc/v2/signatures/signHash`** (§11.7) — Real RSA signing with proper DigestInfo ASN.1 structure (SHA-256 OID + hash). SAD validation, single-use marking, audit logging.

A CSC v2 conformance tester would not distinguish this from a production server at the API level.

### Cryptographic Operations

Nothing is faked or simulated:

- **RSA 2048 key generation** — `crypto.generateKeyPairSync()` with real entropy
- **SHA-256 hashing** — Node.js native `crypto.createHash('sha256')`
- **RSA PKCS#1 v1.5 signing** — Real RSA math via node-forge, not a mock
- **DigestInfo construction** — Correct ASN.1 structure with SHA-256 OID, required for interoperability
- **X.509 certificate generation** — Real self-signed cert with proper extensions (keyUsage: digitalSignature + nonRepudiation)
- **AES-256-GCM encryption** — Private keys encrypted at rest with authenticated encryption

The only difference from production: the private key lives in a database instead of an HSM. The *cryptographic operations themselves* are identical.

### CMS SignedData Assembly

The CMS (PKCS#7) structure is built manually using correct ASN.1 encoding:

- **ContentInfo** wrapping **SignedData** (OID `1.2.840.113549.1.7.2`)
- **Detached mode** — the signed content (PDF) is not embedded in the CMS
- **SignerInfo** with issuer/serial identification, signed attributes (contentType, signingTime, messageDigest), and the raw RSA signature
- **SignedAttributes re-tagging** — SET (0x31) for hashing, then re-tagged to [0] IMPLICIT (0xA0) for CMS encoding. This is a subtle requirement that many implementations get wrong.
- **Certificate chain embedded** — the signing certificate (and any intermediates) are included in the CMS

Adobe Acrobat, DigiDoc4, and the EU DSS validation library can all parse and validate this CMS structure. The structure is identical to what a production implementation would produce.

### PAdES B-T Signature

The PDF signature is a real PAdES Baseline-T signature:

- **/SubFilter** `/adbe.pkcs7.detached` — the standard PAdES signature type
- **ByteRange** — covers the entire PDF except the signature placeholder (standard PAdES structure)
- **CMS with RFC 3161 timestamp** — the timestamp token is a real response from a real TSA, embedded as an unsigned attribute (OID `1.2.840.113549.1.9.16.2.14`)
- **16KB signature placeholder** — sized for CMS + timestamp token (production would use the same or larger)

The sealed PDF is a valid signed document. Only the trust chain is missing (because the cert is self-signed).

### The CMS Signing Subtlety

This is the hardest part to get right, and the prototype implements it correctly:

1. Hash the PDF byte ranges → `pdfHash`
2. Build CMS SignedAttributes with `pdfHash` as `messageDigest`
3. DER-encode the SignedAttributes → hash *that* → `signedAttributesHash`
4. Send `signedAttributesHash` to signHash (not the raw PDF hash)

Many CSC implementations fail here because they send the wrong hash. This prototype handles it correctly, which is why the resulting signatures validate in Adobe.

### OAuth 2.0 + SCAL2

- **Client Credentials flow** — real JWT tokens (HS256), real expiry, real validation
- **SCAL2 PIN verification** — bcrypt with cost factor 12 (same as production)
- **SAD token** — real JWT bound to specific hash values, credential, and tenant. Single-use enforcement via database tracking.
- **Audit trail** — every token issuance, authorization, and signing operation logged with IP and user-agent

### Client SDK Structure

The SDK at `packages/client-sdk/` is structured as a real npm package:

- Own `package.json` with proper name (`@sk-eseal/client-sdk`), version, exports
- TypeScript strict mode, own `tsconfig.json`
- 8 source modules with clear separation of concerns
- 23 tests (unit + integration)
- Zero imports from the server codebase — fully standalone
- Would publish to npm as-is

---

## What Is Simplified (And Why It Doesn't Matter for Validation)

### Self-Signed Certificate

**What:** The test certificate is self-signed (generated by `node-forge`). Adobe shows "The signer's identity is unknown."

**Why it doesn't matter:** The certificate is the **only** thing that changes between prototype and production. Swapping it is a database row update — literally `UPDATE credentials SET certificate_pem = ...`. See the [Certificate Swap Guide](guides/certificate-swap.md). The cryptographic operations, CMS structure, and PDF embedding all remain identical.

**Production change:** Import a real SK-issued `.p12` file. Extract cert + key, update the database row. The code doesn't change at all.

### Software Key Store (No HSM)

**What:** Private keys are encrypted with AES-256-GCM and stored in PostgreSQL. In production, qualified e-seals require a certified HSM (FIPS 140-2 Level 3+ or equivalent).

**Why it doesn't matter:** The signing *interface* is identical — the server receives a hash, applies RSA PKCS#1 v1.5, returns a signature. Whether the private key is decrypted from a database or accessed via PKCS#11 from an HSM, the mathematical operation is the same. The signature bytes are indistinguishable.

**Production change:** Replace two functions in `src/lib/crypto.ts`:
- `decryptPrivateKey()` → HSM PKCS#11 session
- The `privateKey.sign()` call in `signHash/route.ts` → HSM signing operation

Everything else (endpoints, SDK, CMS, PDF handling) stays unchanged.

### Sectigo Qualified TSA

**What:** Timestamps come from Sectigo's Qualified TSA, which is on the EU Trusted List. The prototype already uses a qualified timestamp authority.

**Production change:** SK may choose to use their own TSA instead. One config value: `tsaUrl: 'https://tsa.sk.ee/tsa'`. No code changes. The SDK already accepts a custom `tsaUrl` parameter.

### Demo Tenant with Developer Portal

**What:** One demo tenant ("Demo Corporation OÜ") with 3 seal credentials (Invoice Sealing, Contract Sealing, Regulatory Filings). The Developer Portal provides credential management and a seal playground for testing the full API flow.

**Why it doesn't matter:** The multi-tenant architecture is already in place — `tenants` and `credentials` are separate tables with proper foreign keys. The SCAL2 flow, token scoping, and credential isolation all work correctly. Adding more tenants is an admin API (CRUD operations), not an architectural change.

**Production change:** Build a full admin API for tenant/credential CRUD with legal entity onboarding. The existing schema and Developer Portal pattern support it.

### No Rate Limiting

**What:** No request throttling or abuse prevention.

**Why it doesn't matter:** Rate limiting is infrastructure, not protocol. It doesn't affect whether the signing flow works correctly.

**Production change:** Add Upstash Redis (or similar) rate limiting middleware. Same pattern as the alkoholiks-api project.

### PAdES B-T (Not B-LT)

**What:** Signatures include a timestamp (B-T) but not revocation data (B-LT). B-LT embeds OCSP responses or CRL data for long-term validation.

**Why it doesn't matter:** B-T is the minimum viable PAdES level and is valid for most use cases. B-LT adds longevity but doesn't change the signing flow. The CMS structure already supports unsigned attributes — adding revocation data is an additive change.

**Production change:** After getting the timestamp, fetch an OCSP response for the signing certificate, embed it as another unsigned attribute in the CMS. The `addTimestampToCms()` function in `cms.ts` shows the pattern.

### No Certificate Lifecycle Management

**What:** Certificates don't expire, rotate, or get revoked in the prototype. The test cert has a 1-year validity period.

**Why it doesn't matter:** Certificate lifecycle is an operational concern, not a protocol concern. The signing flow doesn't change based on cert age — it either works or the cert is expired/revoked.

**Production change:** Admin API for cert rotation, CRL/OCSP responder integration, expiry monitoring.

---

## Dependencies and Their Production Equivalents

| Dependency | Role in Prototype | Production Equivalent | Notes |
|---|---|---|---|
| **Next.js 16** | API framework (App Router) | Any Node.js/Java/Go framework | CSC v2 is framework-agnostic. Could be Express, Fastify, Spring Boot, etc. |
| **Neon PostgreSQL** | Credential + audit storage | Enterprise PostgreSQL, AWS RDS, etc. | Schema is standard SQL, no Neon-specific features used |
| **node-forge** | X.509, ASN.1, CMS assembly | Production: same library, or OpenSSL bindings, or Java's BouncyCastle | The ASN.1 structures are standard — any crypto library produces identical output |
| **jose** | JWT creation + verification | Same, or any JWT library | Standard HS256 JWTs — interoperable across any implementation |
| **bcryptjs** | PIN/secret hashing | Same, or native bcrypt | Standard bcrypt with cost 12 |
| **pdf-lib** | PDF manipulation | Same, or iText, or Apache PDFBox | Standard PDF operations |
| **@signpdf/placeholder-pdf-lib** | Signature placeholder | Same, or manual placeholder injection | Inserts standard PAdES /Sig dictionary |
| **Sectigo QTSA.org** | RFC 3161 timestamps | SK TSA or qualified TSA provider | Same protocol, different endpoint |

**Key point:** Every dependency implements a standard (CSC v2, RFC 5652, RFC 3161, OAuth 2.0, PAdES). Swapping any dependency for a production equivalent produces identical outputs because the standards define the wire format.

---

## What the Prototype Proves

1. **The CSC v2 API flow works end-to-end.** From OAuth token to sealed PDF, every step follows the spec.

2. **Hash-only model is viable.** The PDF never leaves the client. Only 32 bytes cross the network. This validates the privacy architecture that customers care most about.

3. **A client SDK can abstract the complexity.** The 8-step sealing flow (placeholder → hash → auth → sign → CMS → timestamp → inject) is reduced to a single `client.seal(pdf)` call. This is the "abstraction layer" the market validation identified as a gap.

4. **PAdES B-T signatures are valid.** Adobe Acrobat validates the signature structure. DigiDoc4 would validate with a real SK cert. The CMS is correct.

5. **SCAL2 works for M2M sealing.** PIN-based authorization with single-use SAD tokens proves the SCAL2 flow works in an automated (no human) context — which is the primary use case for e-seals.

6. **Certificate swap is trivial.** Dropping in a real SK cert is a database update. The prototype was designed for this — not a single line of code needs to change.

7. **The architecture scales to production.** Multi-tenant schema, audit logging, credential isolation, encrypted key storage — all present. The gaps (HSM, rate limiting, admin API) are additive, not architectural.

---

## Upgrade Path to Production

```
Phase 1 (this prototype)          Phase 2                           Phase 3
─────────────────────────         ──────────────────                ─────────────────
✅ CSC v2 API (6 endpoints)       Admin API (tenant CRUD)           Rate limiting (Redis)
✅ OAuth 2.0 + SCAL2              Multi-tenant provisioning         PAdES B-LT (revocation)
✅ CMS SignedData (manual ASN.1)  Real SK certificate (.p12)        SDK → npm publish
✅ PAdES B-T (Sectigo QTSA)            HSM integration (PKCS#11)         Batch signing
✅ Client SDK (TypeScript)        Mini-PKI (Root → Intermediate)    Certificate lifecycle
✅ CLI demo + tests               SK TSA endpoint                   Additional SDK languages
✅ OpenAPI + Swagger UI            Monitoring + alerting              ETSI conformance testing
```

Each phase builds on the previous one. Nothing gets rewritten — the prototype was designed so every piece upgrades in place.
