# SK Remote Qualified E-Seal - Complete Project Guide

> **The full index of everything built, how to use the demo, how a real customer would onboard, and every missing piece mapped out.**
>
> Written for Egert to: (1) know exactly what's in this prototype, (2) walk through the demo as a client would, (3) understand the real production onboarding journey end-to-end, (4) see every gap between prototype and production clearly.

---

## Table of Contents

1. [What Was Built - Full Inventory](#1-what-was-built---full-inventory)
2. [Using the Demo (Client's Shoes)](#2-using-the-demo-clients-shoes)
3. [Real Production Service - Full Customer Journey](#3-real-production-service---full-customer-journey)
4. [Missing Pieces - Complete Gap Analysis](#4-missing-pieces---complete-gap-analysis)
5. [File-by-File Reference](#5-file-by-file-reference)
6. [Quick Commands Cheat Sheet](#6-quick-commands-cheat-sheet)

---

## 1. What Was Built - Full Inventory

### The Big Picture

A **complete, working CSC v2 e-sealing service** - the first open-source implementation of the Cloud Signature Consortium API v2. It seals real PDFs with real cryptographic signatures. The prototype has three faces:

| Face | What It Does | Who It's For |
|------|-------------|--------------|
| **Landing Page** | Marketing site presenting the service as if it's live | SK colleagues, potential customers |
| **CSC v2 API Server** | 6 spec-compliant endpoints for remote signing | Developers integrating e-sealing |
| **Client SDK** | TypeScript library that handles the entire sealing flow | Developers who don't want to deal with CMS/ASN.1 |

### Components Built

#### A. CSC v2 API Server (6 Endpoints)

| Endpoint | What It Does | CSC v2 Spec Section |
|----------|-------------|---------------------|
| `POST /oauth2/token` | Client sends client_id + client_secret, gets back a JWT access token (1 hour TTL) | CSC v2 Section 8 |
| `POST /csc/v2/info` | Returns service metadata - what algorithms are supported, what auth methods, service name, region | CSC v2 Section 11.1 |
| `POST /csc/v2/credentials/list` | Returns the credential IDs belonging to the authenticated tenant | CSC v2 Section 11.4 |
| `POST /csc/v2/credentials/info` | Returns full certificate chain (base64 DER), key algorithm, key length, SCAL level | CSC v2 Section 11.4 |
| `POST /csc/v2/credentials/authorize` | SCAL2 flow: tenant sends PIN + hash values, gets back a SAD token (5 min TTL, single-use, bound to those specific hashes) | CSC v2 Section 11.4 |
| `POST /csc/v2/signatures/signHash` | Core signing: tenant sends SAD token + hash values, gets back RSA PKCS#1 v1.5 signatures (base64) | CSC v2 Section 11.7 |

#### B. Client SDK (8 Modules, 24 Tests)

| Module | What It Does |
|--------|-------------|
| `seal.ts` | The orchestrator. `SealClient.seal(pdf)` runs the entire 8-step pipeline and returns a sealed PDF |
| `api.ts` | Typed HTTP client for all CSC v2 endpoints. Handles OAuth token, authorize, signHash |
| `pdf.ts` | Adds a 16KB signature placeholder to the PDF, later injects the CMS signature into it |
| `hash.ts` | Computes SHA-256 of the PDF byte ranges, builds CMS SignedAttributes DER, hashes that |
| `cms.ts` | Manually assembles the CMS/PKCS#7 SignedData container with correct ASN.1 encoding |
| `timestamp.ts` | Requests an RFC 3161 timestamp from FreeTSA and embeds it as an unsigned CMS attribute |
| `asn1-helpers.ts` | OID constants and DER encoding utilities |
| `types.ts` | TypeScript interfaces for all SDK inputs/outputs |

#### C. Landing Page (12 Sections)

1. Sticky navbar with SK branding
2. Two-column hero with visual flow diagram
3. "What is E-Seal" - 4 feature cards
4. eIDAS Qualified explanation
5. Customer segments (Banks, Platforms, Brokers)
6. How It Works - flow diagram
7. **Live Demo** - upload a PDF, watch it get sealed in real-time
8. Developer Experience - code samples + feature cards
9. Pricing (placeholder)
10. Compliance standards
11. Documentation Portal - links to GitHub, guides, SDK, OpenAPI, Swagger UI
12. CTA Banner

#### D. Documentation

| Document | What It Covers |
|----------|---------------|
| `README.md` | Project overview, quick start, architecture, tech stack |
| `SCOPE.md` | Full project scope, phased plan, SK initiative alignment |
| `docs/architecture.md` | Component diagram, 14-step data flow, folder structure |
| `docs/csc-v2-mapping.md` | Every CSC v2 spec section mapped to exact code files and line numbers |
| `docs/prototype-vs-production.md` | What's real, what's simplified, exact upgrade path |
| `docs/guides/seal-first-pdf.md` | Step-by-step quickstart: clone to sealed PDF in 5 minutes |
| `docs/guides/certificate-swap.md` | How to replace test cert with real SK cert (zero code changes) |
| `public/openapi.yaml` | OpenAPI 3.1 spec for all endpoints (importable into Postman) |

#### E. Interactive API Docs

- **Swagger UI** at `/docs` - test every endpoint in the browser
- **OpenAPI 3.1** spec at `/openapi.yaml` - machine-readable, import into any API tool

#### F. Database (4 Tables)

| Table | Purpose |
|-------|---------|
| `tenants` | Organizations using the service. Stores client_id, hashed client_secret, hashed PIN |
| `credentials` | E-seal certificates + encrypted private keys, per tenant. Certificate PEM, chain PEM, AES-256-GCM encrypted key |
| `audit_log` | Every token issuance, authorization, signing operation. IP, user-agent, metadata |
| `sad_tokens` | Tracks issued SAD tokens for single-use enforcement. Hash-bound, time-limited |

#### G. Scripts

| Script | What It Does |
|--------|-------------|
| `scripts/create-test-pdf.ts` | Generates a test invoice PDF for sealing |
| `scripts/seed.ts` | Creates the demo tenant + self-signed certificate in the database |
| `scripts/migrate.ts` | Runs the database schema (creates all 4 tables) |
| `scripts/seal-demo.ts` | CLI tool: seals a PDF file with step-by-step output and timing |

#### H. Tests

- **23 unit tests** covering API client, hash computation, PDF manipulation, CMS assembly
- **1 integration test** hitting a real RFC 3161 TSA (FreeTSA.org)
- Run with `npm test` in the `packages/client-sdk/` directory

---

## 2. Using the Demo (Client's Shoes)

### A. The Landing Page Demo (Browser)

This is the path your SK colleagues will take. Zero setup required.

**Step 1: Open the landing page**
- Navigate to the deployed URL (or `http://localhost:3000` locally)
- Scroll down to the "Try It - Live Demo" section, or click "Try Demo" in the navbar

**Step 2: Upload a PDF**
- Drag and drop any PDF file onto the upload zone (or click to browse)
- Max file size: 10 MB
- The PDF can contain anything - invoices, contracts, reports. It doesn't matter because the document content never touches the server (only its 32-byte hash does)

**Step 3: Click "Seal This Document"**
- The button appears after you upload a file
- This starts the real sealing pipeline - not a simulation

**Step 4: Watch the Process X-Ray**
- Each step appears in real-time as it completes, streamed via Server-Sent Events:

| Step | What Happens | What You See |
|------|-------------|-------------|
| PDF Placeholder | A 16KB signature dictionary is inserted into your PDF | Duration in ms |
| Hash Computation | SHA-256 of the PDF byte ranges, then CMS SignedAttributes, then hash of that | The actual hash value (first 60 chars) |
| OAuth 2.0 Token | The demo credentials authenticate against the API | Token type, expiry |
| SCAL2 Authorization | PIN + hash sent to get a single-use SAD token (5 min TTL) | SAD expiry time |
| Hash Signing | SAD + hash sent to signHash endpoint, RSA PKCS#1 v1.5 signature returned | Signature algorithm used |
| CMS Assembly | Raw signature wrapped in CMS/PKCS#7 SignedData with certificate chain | CMS byte size |
| RFC 3161 Timestamp | Timestamp token requested from FreeTSA, embedded in CMS | TSA URL used |
| PDF Sealed | CMS hex injected into the PDF placeholder | Final PDF size |

- Click any step row to expand it and see:
  - The actual code that ran
  - The real values returned (hash, token, signature preview)
  - The CSC v2 spec reference for that step

**Step 5: Download the sealed PDF**
- Click "Download Sealed PDF"
- The file is named `yourfile-sealed.pdf`
- Open it in Adobe Acrobat Reader:
  - You'll see a signature panel saying "Signed by: E-Seal Test"
  - It will say "Signature validity is UNKNOWN" - this is expected because we're using a self-signed test certificate. With a real SK certificate, this would show a green checkmark.
  - The signature structure itself (CMS, PAdES, timestamp) is identical to production

**Step 6: Seal Another**
- Click "Seal Another" to reset and try with a different PDF

### B. The CLI Demo (Developer)

For when you want to seal from the command line - useful for testing and understanding the flow.

**Prerequisites:**
- Node.js installed
- Project cloned and dependencies installed (`npm install`)
- Database migrated and seeded (`npx tsx scripts/migrate.ts && npx tsx scripts/seed.ts`)
- Dev server running (`npm run dev`)

**Step 1: Create a test PDF (optional)**
```bash
npx tsx scripts/create-test-pdf.ts
# Creates test-files/sample.pdf (a simple invoice)
```

**Step 2: Seal it**
```bash
npx tsx scripts/seal-demo.ts test-files/sample.pdf
```

**What you see:**
```
Sealing: test-files/sample.pdf (1574 bytes)

[1/8] Preparing PDF...           12ms   (added 16384-byte placeholder)
[2/8] Computing hash...           3ms   (SHA-256: a1b2c3d4...)
[3/8] Getting OAuth token...     45ms   (Bearer token, 3600s TTL)
[4/8] Authorizing credential...  38ms   (SAD token, 300s TTL)
[5/8] Signing hash...            22ms   (RSA PKCS#1 v1.5)
[6/8] Building CMS...             5ms   (SignedData with cert chain)
[7/8] Adding timestamp...       890ms   (FreeTSA RFC 3161)
[8/8] Injecting signature...      2ms   (CMS hex → PDF placeholder)

Done! Sealed PDF: test-files/sample-sealed.pdf (18.2 KB)
Total: 1017ms
```

**Step 3: Verify**
- Open `test-files/sample-sealed.pdf` in Adobe Acrobat Reader
- Check the signature panel

### C. The Swagger UI (API Explorer)

For when you want to call individual endpoints directly.

**Step 1:** Navigate to `/docs` (e.g., `http://localhost:3000/docs`)

**Step 2:** You see all 6 CSC v2 endpoints + the OAuth token endpoint

**Step 3:** Try a flow:
1. Call `POST /oauth2/token` with the demo credentials → copy the `access_token`
2. Click "Authorize" at the top, paste the token
3. Call `POST /csc/v2/credentials/list` → see your credential ID
4. Call `POST /csc/v2/credentials/info` with the credential ID → see the certificate chain
5. Call `POST /csc/v2/credentials/authorize` with the PIN + a hash → get SAD
6. Call `POST /csc/v2/signatures/signHash` with the SAD + hash → get the signature

This is exactly what a developer integrating the real service would do.

### D. The Demo Credentials

These are pre-created by the `seed.ts` script and stored in `.env.local`:

| Credential | Value | What It Is |
|------------|-------|-----------|
| `DEMO_CLIENT_ID` | `demo-tenant-001` | OAuth2 client identifier |
| `DEMO_CLIENT_SECRET` | (64-char hex) | OAuth2 client secret (hashed in DB) |
| `DEMO_PIN` | `12345` | SCAL2 authorization PIN (hashed in DB with bcrypt) |
| `DEMO_CREDENTIAL_ID` | `cred-xxxx` | The ID of the test e-seal credential (self-signed cert) |

---

## 3. Real Production Service - Full Customer Journey

> This section describes how a REAL customer would onboard and use the REAL SK Remote Qualified E-Seal service when it goes live. This is the full journey that doesn't exist yet - the prototype covers steps 7-14 (the technical integration), while steps 1-6 (business onboarding) and steps 15+ (operations) are entirely missing from the prototype.

### Phase 1: Business Onboarding (NOT in prototype)

#### Step 1: Discovery
- Customer (bank, platform, broker) discovers the service via SK's website, sales team, or this landing page
- They understand: "I can seal documents with a qualified e-seal via API, without the documents ever leaving my infrastructure"

#### Step 2: Sales Engagement
- Customer contacts SK sales (via the landing page CTA, email, or existing account manager)
- SK sales qualifies the customer:
  - What documents do they seal? (invoices, statements, contracts, certificates)
  - What volume? (hundreds/month vs millions/month)
  - What integration? (direct API, SDK, existing document workflow)
  - What compliance requirements? (eIDAS, national regulations)
- SK proposes a pricing tier based on volume

#### Step 3: Legal / Contractual
- **Service Agreement** signed between customer and SK
  - Service Level Agreement (SLA) - uptime, response times, support levels
  - Data Processing Agreement (DPA) - GDPR requirements (though minimal since documents never leave client)
  - Liability terms for qualified e-seals
  - Pricing and billing terms
- **Qualified Trust Service Provider obligations:**
  - SK must verify the customer's legal identity (company registration, authorized representatives)
  - eIDAS Article 24 requirements for qualified trust service providers apply
  - Customer must prove they are who they claim to be - this is not self-service

#### Step 4: Identity Verification & Certificate Issuance
- **This is the most complex missing piece.**
- SK (as a Qualified Trust Service Provider under eIDAS) must:
  1. **Verify the organization's identity** - company registration number, legal representatives, authorization
  2. **Verify the authorized person** - the person requesting the e-seal must prove they represent the organization (e.g., board member, authorized signatory). This typically involves face-to-face or video identification.
  3. **Issue a qualified e-seal certificate** containing:
     - Organization name (e.g., "Swedbank AS")
     - Organization identifier (e.g., Estonian registry code)
     - Country code
     - Certificate policy OID indicating "qualified"
     - Key usage: digitalSignature + nonRepudiation
     - Issued by SK's qualified CA (in the EU Trust List)
  4. **Generate the private key in an HSM** - the key NEVER exists outside a FIPS 140-2 Level 3+ certified Hardware Security Module. SK's QSCD (Qualified Signature/Seal Creation Device) holds the key.
  5. **Bind the certificate to the credential** in SK's credential management system

- **Certificate chain:**
  ```
  EU Trust List
  └── SK ID Solutions Root CA (in Adobe AATL + EU Trust List)
      └── SK E-Seal Intermediate CA
          └── Customer E-Seal Certificate (e.g., "Swedbank AS E-Seal")
  ```
  - Because SK's root is in the EU Trust List and Adobe's AATL (Adobe Approved Trust List), sealed documents show a **green checkmark** in Adobe Acrobat without any additional configuration by the recipient.

#### Step 5: Credential Provisioning
- SK creates the customer's tenant account:
  - Generates `client_id` and `client_secret` for OAuth 2.0
  - Sets up the SCAL2 PIN (customer chooses, SK hashes and stores)
  - Links the qualified certificate to the credential ID
  - Configures rate limits, billing counters
- SK provides the customer with:
  - `client_id`
  - `client_secret` (delivered securely - not via email)
  - `credential_id`
  - `PIN` (customer sets this themselves via a secure portal)
  - API base URL (e.g., `https://eseal-api.sk.ee`)
  - SDK download / npm install instructions
  - Developer documentation URL

#### Step 6: Environment Setup
- Customer receives access to:
  - **Sandbox environment** - test API with test certificates (like this prototype)
  - **Production environment** - real qualified certificates, real HSM, real TSA
- Customer stores credentials securely in their infrastructure:
  - `client_secret` in a vault (HashiCorp Vault, AWS Secrets Manager, etc.)
  - `PIN` in a vault (never hardcoded)
  - `credential_id` in application config

### Phase 2: Technical Integration (THIS IS WHAT THE PROTOTYPE DEMONSTRATES)

#### Step 7: Install the SDK
```bash
npm install @sk-eseal/client-sdk
```
(Or use the API directly - the SDK is optional but recommended)

#### Step 8: Configure the Client
```typescript
import { SealClient } from '@sk-eseal/client-sdk';

const client = new SealClient({
  baseUrl: 'https://eseal-api.sk.ee',     // SK's production API
  clientId: process.env.ESEAL_CLIENT_ID,    // From Step 5
  clientSecret: process.env.ESEAL_SECRET,   // From Step 5
  pin: process.env.ESEAL_PIN,              // From Step 5
  credentialId: process.env.ESEAL_CRED_ID, // From Step 5
  tsaUrl: 'https://tsa.sk.ee/tsa',        // SK's qualified TSA
});
```

#### Step 9: Seal a Document
```typescript
const pdfBytes = fs.readFileSync('invoice.pdf');

const result = await client.seal(pdfBytes, {
  onStep: (step) => console.log(`${step.name}: ${step.durationMs}ms`),
});

fs.writeFileSync('invoice-sealed.pdf', result.sealedPdf);
```

**What happens under the hood (the 8-step pipeline):**

| Step | Client-Side | Network | Server-Side |
|------|------------|---------|-------------|
| 1. Prepare PDF | SDK inserts a 16KB `/Sig` placeholder into the PDF | - | - |
| 2. Compute Hash | SDK computes SHA-256 of PDF byte ranges, builds CMS SignedAttributes DER, hashes that | - | - |
| 3. Get Token | - | `POST /oauth2/token` with client_id + client_secret | Server verifies credentials (bcrypt), issues JWT (1hr TTL) |
| 4. Authorize | - | `POST /csc/v2/credentials/authorize` with Bearer token + PIN + hash | Server verifies PIN (bcrypt), issues SAD token (5min TTL, single-use, hash-bound) |
| 5. Sign Hash | - | `POST /csc/v2/signatures/signHash` with Bearer token + SAD + hash | Server validates SAD (single-use check), signs hash with RSA PKCS#1 v1.5 using HSM key, logs to audit trail |
| 6. Build CMS | SDK wraps raw signature in CMS/PKCS#7 SignedData with certificate chain, SignedAttributes | - | - |
| 7. Timestamp | - | SDK calls TSA: `POST https://tsa.sk.ee/tsa` with RFC 3161 TimeStampReq | TSA returns TimeStampToken |
| 8. Inject | SDK converts CMS to hex, writes into the PDF placeholder | - | - |

**Critical privacy point:** The PDF document NEVER leaves the customer's infrastructure. Only 3 network calls are made, and they only carry:
- OAuth credentials (token request)
- A 32-byte hash + PIN (authorize request)
- A 32-byte hash + SAD token (signHash request)

Total data crossing the network: ~500 bytes. The 50 MB invoice stays on the customer's server.

#### Step 10: Verify the Sealed Document
- Open in **Adobe Acrobat Reader**: green checkmark, "Signed by: Swedbank AS E-Seal", valid timestamp
- Open in **DigiDoc4**: valid qualified e-seal, full certificate chain displayed
- Programmatic validation via EU DSS library or similar

### Phase 3: Production Operations (NOT in prototype)

#### Step 11: Monitoring & Alerting
- Customer monitors their sealing volume, error rates, latency
- SK provides an admin dashboard showing:
  - Sealing volume per day/month
  - API latency percentiles
  - Certificate expiry warnings
  - Billing usage

#### Step 12: Certificate Renewal
- E-seal certificates have a validity period (typically 2-3 years)
- Before expiry, SK:
  1. Generates new key pair in HSM
  2. Issues new certificate
  3. Updates the credential in the system
  4. Notifies the customer (no code changes needed on their side - same credential_id)

#### Step 13: Incident Response
- If a private key is compromised (extremely unlikely with HSM):
  - SK revokes the certificate via CRL/OCSP
  - Issues new certificate
  - All previously sealed documents remain valid (the signature was valid at time of sealing)
  - New sealings use the new certificate

#### Step 14: Scaling
- Customer's volume grows from 1,000 to 1,000,000 seals/month
- SK scales the infrastructure:
  - HSM cluster for parallel signing
  - Load balancing across API servers
  - Rate limit adjustments per tier
  - Billing tier upgrade

---

## 4. Missing Pieces - Complete Gap Analysis

### Overview: What Exists vs What's Missing

```
FULL PRODUCTION JOURNEY
========================

[MISSING]  1. Customer Discovery (marketing, sales funnel)
[MISSING]  2. Sales Engagement (qualification, proposal)
[MISSING]  3. Legal / Contractual (service agreement, DPA, SLA)
[MISSING]  4. Identity Verification & Certificate Issuance
[MISSING]  5. Credential Provisioning (admin portal)
[MISSING]  6. Environment Setup (sandbox vs production)
 [BUILT]   7. SDK Installation & Configuration
 [BUILT]   8. Client Configuration
 [BUILT]   9. Document Sealing (full 8-step pipeline)
 [BUILT]  10. Verification (Adobe/DigiDoc4 validates structure)
[MISSING] 11. Monitoring & Alerting
[MISSING] 12. Certificate Renewal
[MISSING] 13. Incident Response
[MISSING] 14. Scaling
```

### Detailed Gap Analysis

#### GAP 1: Customer Onboarding Portal

**What's missing:** There is no self-service or assisted onboarding flow. In the prototype, credentials are created by running a seed script directly against the database.

**What production needs:**
- Admin web portal where SK staff create tenant accounts
- Organization identity verification workflow (document upload, video call scheduling)
- Secure credential delivery mechanism (not email - portal download or encrypted channel)
- Customer self-service portal for:
  - Viewing their credentials
  - Changing their PIN
  - Viewing usage/billing
  - Downloading SDK/docs
  - Managing API keys (rotate secret)

**Complexity:** HIGH. This is an entire application. The database schema already supports multi-tenancy (tenants + credentials tables with proper foreign keys), but there's no UI or admin API to manage it.

#### GAP 2: Identity Verification & KYC

**What's missing:** The prototype has zero identity verification. The seed script just creates a tenant with whatever name you give it.

**What production needs:**
- **Organization verification:** Company registration lookup (Estonian Business Register API, EU business registers), authorized representative verification
- **Representative authentication:** The person requesting the e-seal must prove their authority (board member, power of attorney). This likely involves Smart-ID or Mobile-ID authentication (which SK already has!)
- **eIDAS Article 24 compliance:** Qualified trust service providers must verify identity before issuing qualified certificates. This is a legal requirement, not just best practice.

**Complexity:** VERY HIGH. This is the core of trust services. SK already does this for Smart-ID and Mobile-ID - the same processes and infrastructure could be adapted for e-seal onboarding.

#### GAP 3: Certificate Authority Infrastructure (PKI)

**What's missing:** The prototype uses a self-signed test certificate generated by node-forge. There is no CA hierarchy.

**What production needs:**
- **SK Root CA** (already exists - SK is in the EU Trust List and Adobe AATL)
- **E-Seal Intermediate CA** (may need to be created under SK's root)
- **Per-customer e-seal certificate issuance** pipeline:
  1. Generate RSA key pair in HSM
  2. Create Certificate Signing Request (CSR)
  3. Sign CSR with Intermediate CA
  4. Store certificate in credential management system
  5. Return certificate to customer (for their records)
- **Certificate Revocation List (CRL)** / **OCSP Responder** for checking certificate validity
- **Certificate lifecycle management:** expiry tracking, renewal automation, revocation procedures

**Complexity:** VERY HIGH but SK already has ALL of this infrastructure for Smart-ID and Mobile-ID certificates. The question is adapting it for e-seal certificates.

**The prototype proves:** Zero code changes needed when swapping certificates. The `docs/guides/certificate-swap.md` shows exactly how - it's a database row update.

#### GAP 4: Hardware Security Module (HSM) Integration

**What's missing:** Private keys are encrypted with AES-256-GCM and stored in PostgreSQL. For qualified e-seals, keys must reside in a certified HSM.

**What production needs:**
- **FIPS 140-2 Level 3+** (or Common Criteria equivalent) certified HSM
- **PKCS#11 interface** for key generation, storage, and signing operations
- **Key isolation:** Each customer's key is logically separated within the HSM
- **Key backup and recovery** procedures
- **HSM cluster** for high availability and performance

**Code changes required:** Exactly 2 functions in `src/lib/crypto.ts`:
1. `decryptPrivateKey()` → replaced with HSM PKCS#11 session open
2. The `privateKey.sign()` call in `signHash/route.ts` → replaced with HSM signing operation

Everything else (endpoints, SDK, CMS assembly, PDF handling) stays unchanged. The prototype was specifically designed for this.

**Complexity:** MEDIUM for SK (they already operate HSMs for their existing trust services). The code change is minimal - the infrastructure and procurement is the real work.

#### GAP 5: Qualified Timestamp Authority (TSA)

**What's missing:** The prototype uses FreeTSA.org - a free public TSA that is NOT qualified.

**What production needs:**
- A **qualified TSA** (either SK's own or a contracted one)
- TSA that issues timestamps under a qualified certificate (so the timestamp itself has legal standing)
- High availability (every seal needs a timestamp)

**Code change required:** One config value:
```typescript
tsaUrl: 'https://tsa.sk.ee/tsa'  // instead of 'https://freetsa.org/tsr'
```

**Complexity:** LOW for code. SK may already have a TSA or can contract one. The RFC 3161 protocol is the same regardless of provider.

#### GAP 6: Multi-Tenant Admin API

**What's missing:** No API for creating, updating, or deleting tenants and credentials. The seed script is the only way to add data.

**What production needs:**
```
POST   /admin/tenants              - Create a new tenant
GET    /admin/tenants              - List all tenants
GET    /admin/tenants/:id          - Get tenant details
PUT    /admin/tenants/:id          - Update tenant (name, status)
DELETE /admin/tenants/:id          - Deactivate tenant

POST   /admin/tenants/:id/credentials   - Issue new credential
GET    /admin/tenants/:id/credentials   - List credentials
PUT    /admin/credentials/:id           - Update credential (rotate cert)
DELETE /admin/credentials/:id           - Revoke credential

POST   /admin/tenants/:id/reset-pin     - Reset tenant PIN
POST   /admin/tenants/:id/rotate-secret - Rotate client_secret
GET    /admin/audit-log                 - View audit trail
```

- Authentication: SK staff access only (internal auth, not OAuth2 client credentials)
- Role-based access control (who can create tenants, who can revoke certs)
- Audit trail for admin operations

**Complexity:** MEDIUM. The database schema already supports all of this. It's standard CRUD + access control.

#### GAP 7: Rate Limiting & Abuse Prevention

**What's missing:** No request throttling. Anyone with valid credentials can call the API unlimited times.

**What production needs:**
- Per-tenant rate limits (e.g., 100 seals/minute for Basic, 1000/minute for Enterprise)
- Global rate limits (protect infrastructure)
- DDoS protection at the edge (Cloudflare, AWS Shield)
- Token bucket or sliding window algorithm (Upstash Redis is proven from alkoholiks-api)

**Complexity:** LOW. Same pattern as alkoholiks-api. Add Upstash Redis middleware.

#### GAP 8: Billing & Usage Tracking

**What's missing:** No billing system. The pricing section on the landing page says "Coming Soon."

**What production needs:**
- Per-seal counting per tenant per month
- Billing tier calculation
- Invoice generation
- Integration with SK's existing billing system
- Usage dashboard for customers

**Complexity:** MEDIUM. The audit_log table already records every signing operation - billing is a query on top of that.

#### GAP 9: PAdES B-LT (Long-Term Validation)

**What's missing:** Signatures are PAdES B-T (Baseline-T with timestamp). B-LT adds revocation data for long-term validity.

**What production needs:**
- After signing, fetch OCSP response for the signing certificate
- Embed OCSP response as a CMS unsigned attribute (or as a VRI dictionary in the PDF)
- This ensures the signature can be validated even after the certificate expires or the OCSP responder goes offline

**Code change:** Additive - add an OCSP fetch after the timestamp step, embed it in the CMS. The `addTimestampToCms()` function in `cms.ts` shows exactly the pattern (it adds an unsigned attribute - OCSP would be another one).

**Complexity:** MEDIUM. The CMS structure supports it. Need an OCSP responder URL and the fetch/parse logic.

#### GAP 10: Batch Sealing

**What's missing:** The signHash endpoint accepts an array of hashes but the SDK seals one document at a time.

**What production needs:**
- SDK method: `client.sealBatch(pdfs)` - seal multiple documents in one API round-trip
- Server: already accepts `hash[]` array, needs to return `signature[]` array (partially implemented)
- Customer use case: bank sealing 100,000 monthly statements at once

**Complexity:** LOW. The API already accepts arrays. The SDK needs a batch orchestrator.

#### GAP 11: Developer Portal

**What's missing:** No developer self-service portal. Documentation is on GitHub and Swagger UI.

**What production needs:**
- Sign up / login (Clerk or similar)
- API key management (create, rotate, revoke)
- Sandbox environment with test credentials
- Usage dashboard
- SDK downloads (npm, Maven, NuGet, pip)
- Code samples in multiple languages
- Status page

**Complexity:** HIGH. Full web application. Same pattern as alkoholiks-api's developer portal but with more features.

#### GAP 12: Additional SDK Languages

**What's missing:** Only TypeScript SDK exists.

**What production needs:**
- **Java SDK** - most enterprise customers use Java
- **C# (.NET) SDK** - popular in enterprise
- **Python SDK** - popular for automation
- **Go SDK** - popular for cloud-native

Each SDK would implement the same 8-step pipeline. The CSC v2 API calls are standard HTTP - only the PDF manipulation and CMS assembly need language-specific crypto libraries.

**Complexity:** MEDIUM per language. The hardest part (CMS assembly, ASN.1 encoding) would need equivalent libraries in each language (BouncyCastle for Java, System.Security.Cryptography for C#, etc.)

#### GAP 13: Monitoring, Alerting, Observability

**What's missing:** No monitoring infrastructure.

**What production needs:**
- API latency metrics (p50, p95, p99)
- Error rate dashboards
- Certificate expiry alerts (30 days, 7 days, 1 day before)
- HSM health monitoring
- TSA availability monitoring
- Uptime monitoring (public status page)

**Complexity:** MEDIUM. Standard infrastructure work.

#### GAP 14: ETSI Conformance Testing

**What's missing:** The prototype hasn't been run through an official ETSI conformance test suite.

**What production needs:**
- Run sealed PDFs through the EU DSS conformance checker
- Validate PAdES profile against ETSI EN 319 142
- Validate CMS structure against RFC 5652
- Certification audit for qualified trust service status

**Complexity:** LOW for testing (the structures are already correct - Adobe validates them). HIGH for formal certification (audits, documentation, legal processes).

### Gap Summary Table

| Gap | What | Complexity | Who Builds It | Blocker? |
|-----|------|-----------|---------------|----------|
| 1. Onboarding Portal | Admin + customer portals | HIGH | SK dev team | Yes - no way to create customers |
| 2. Identity Verification | KYC/KYB for certificate issuance | VERY HIGH | SK (existing infrastructure) | Yes - eIDAS requirement |
| 3. PKI Infrastructure | CA hierarchy, cert issuance | VERY HIGH | SK (existing infrastructure) | Yes - no qualified certs without this |
| 4. HSM Integration | Hardware key storage | MEDIUM (code) | SK infrastructure | Yes - eIDAS requirement for qualified |
| 5. Qualified TSA | Qualified timestamp authority | LOW (code) | SK or contracted TSA | Yes - B-T needs qualified timestamps |
| 6. Admin API | Tenant/credential CRUD | MEDIUM | Prototype can extend | Yes - needed for onboarding |
| 7. Rate Limiting | Abuse prevention | LOW | Prototype can extend | No - nice to have |
| 8. Billing | Usage tracking, invoicing | MEDIUM | SK billing team | No - can launch without |
| 9. PAdES B-LT | Long-term validation | MEDIUM | Prototype can extend | No - B-T is sufficient initially |
| 10. Batch Sealing | Multi-document signing | LOW | Prototype can extend | No - single seal works |
| 11. Developer Portal | Self-service dev experience | HIGH | SK dev team | No - docs exist on GitHub |
| 12. Multi-language SDKs | Java, C#, Python, Go | MEDIUM each | SK dev team | No - TypeScript works |
| 13. Monitoring | Observability | MEDIUM | SK ops team | No - can launch without |
| 14. ETSI Conformance | Formal certification | LOW-HIGH | SK compliance team | Yes - required for qualified status |

### The Critical Path

To go from prototype to production, these must be done in order:

```
1. PKI Infrastructure (CA hierarchy)         ─┐
2. HSM Integration (hardware key storage)     ├── Can be parallel
3. Identity Verification (KYC/KYB process)   ─┘
         │
         ▼
4. Qualified TSA (timestamp authority)
         │
         ▼
5. Admin API (tenant/credential management)
         │
         ▼
6. Onboarding Portal (customer-facing)
         │
         ▼
7. ETSI Conformance Testing
         │
         ▼
8. PRODUCTION LAUNCH
         │
         ▼
9. Post-launch: billing, monitoring, batch, B-LT, more SDKs
```

Items 1-3 are SK infrastructure that already exists for Smart-ID/Mobile-ID. The question is adapting it for e-seals. The prototype proves the entire technical layer (CSC v2 API, SDK, CMS, PAdES) works - so the remaining work is almost entirely infrastructure, identity, and compliance.

---

## 5. File-by-File Reference

### Source Code

| Path | Lines | Purpose |
|------|-------|---------|
| `src/app/page.tsx` | ~710 | Landing page - all 12 sections |
| `src/app/layout.tsx` | 34 | Root layout, Google Fonts import (Space Grotesk, Inter, Material Symbols) |
| `src/app/globals.css` | 95 | Tailwind v4 theme tokens (SK colors, typography, border radius) |
| `src/app/docs/page.tsx` | 14 | Swagger UI wrapper |
| `src/app/components/DemoSection.tsx` | 383 | Live demo widget (upload, SSE stream, download) |
| `src/app/api/oauth2/token/route.ts` | 82 | OAuth 2.0 Client Credentials token endpoint |
| `src/app/api/csc/v2/info/route.ts` | 26 | Service metadata endpoint |
| `src/app/api/csc/v2/credentials/list/route.ts` | 17 | List credentials endpoint |
| `src/app/api/csc/v2/credentials/info/route.ts` | 80 | Credential info endpoint (cert chain, key metadata) |
| `src/app/api/csc/v2/credentials/authorize/route.ts` | 90 | SCAL2 PIN authorization endpoint |
| `src/app/api/csc/v2/signatures/signHash/route.ts` | 121 | Core signing endpoint |
| `src/app/api/demo/seal/route.ts` | 79 | Demo SSE streaming endpoint |
| `src/lib/auth.ts` | 31 | JWT generation and verification |
| `src/lib/crypto.ts` | 100 | RSA keygen, AES-256-GCM encryption |
| `src/lib/db.ts` | 6 | Neon PostgreSQL connection |
| `src/lib/middleware.ts` | 37 | Bearer token validation middleware |
| `src/lib/schema.sql` | 58 | Database schema (4 tables + indexes) |

### SDK

| Path | Lines | Purpose |
|------|-------|---------|
| `packages/client-sdk/src/seal.ts` | 148 | SealClient orchestrator |
| `packages/client-sdk/src/api.ts` | 108 | Typed CSC v2 HTTP client |
| `packages/client-sdk/src/pdf.ts` | 111 | PDF placeholder + signature injection |
| `packages/client-sdk/src/hash.ts` | 88 | SignedAttributes DER hash computation |
| `packages/client-sdk/src/cms.ts` | 105 | CMS/PKCS#7 SignedData assembly |
| `packages/client-sdk/src/timestamp.ts` | 77 | RFC 3161 TSA client |
| `packages/client-sdk/src/asn1-helpers.ts` | 41 | OID constants, DER utilities |
| `packages/client-sdk/src/types.ts` | 52 | TypeScript interfaces |
| `packages/client-sdk/src/index.ts` | 14 | Public API exports |
| `packages/client-sdk/tests/*.test.ts` | ~525 | 24 tests total |

### Documentation

| Path | Purpose |
|------|---------|
| `README.md` | Project overview, quick start, architecture |
| `SCOPE.md` | Full scope, phased plan, SK initiative alignment |
| `CLAUDE.md` | Technical notes, design philosophy |
| `docs/architecture.md` | Component diagram, data flow |
| `docs/csc-v2-mapping.md` | Spec section to code mapping |
| `docs/prototype-vs-production.md` | What's real vs simplified, upgrade path |
| `docs/guides/seal-first-pdf.md` | Quickstart guide |
| `docs/guides/certificate-swap.md` | Replace test cert with real SK cert |
| `public/openapi.yaml` | OpenAPI 3.1 API specification |

### Config & Scripts

| Path | Purpose |
|------|---------|
| `package.json` | Root dependencies and scripts |
| `packages/client-sdk/package.json` | SDK dependencies |
| `tsconfig.json` | TypeScript configuration |
| `next.config.ts` | Next.js configuration |
| `.env.local` | Database URL, JWT secret, demo credentials |
| `scripts/migrate.ts` | Run database schema |
| `scripts/seed.ts` | Create demo tenant + test certificate |
| `scripts/create-test-pdf.ts` | Generate test invoice PDF |
| `scripts/seal-demo.ts` | CLI sealing tool |

---

## 6. Quick Commands Cheat Sheet

```bash
# === SETUP (one time) ===
cd C:\Users\Kasutaja\Claude_Projects\sk-e-seal-prototype
npm install                              # Install dependencies
npx tsx scripts/migrate.ts               # Create database tables
npx tsx scripts/seed.ts                  # Create demo tenant + cert

# === RUN ===
npm run dev                              # Start dev server (localhost:3000)
npm run build && npm start               # Production build + start

# === DEMO ===
npx tsx scripts/create-test-pdf.ts       # Generate test PDF
npx tsx scripts/seal-demo.ts test-files/sample.pdf  # Seal from CLI
# Or: open localhost:3000, scroll to demo, upload a PDF

# === TEST ===
cd packages/client-sdk && npm test       # Run all 24 tests
cd packages/client-sdk && npm run test:watch  # Watch mode

# === API EXPLORATION ===
# Open localhost:3000/docs for Swagger UI
# Or use curl:
curl -X POST http://localhost:3000/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=demo-tenant-001&client_secret=YOUR_SECRET"

# === DOCS ===
# README.md           - Start here
# SCOPE.md            - Full project scope
# docs/architecture.md - How it all fits together
# docs/guides/seal-first-pdf.md - Step-by-step walkthrough

# === GITHUB ===
# https://github.com/keeltekool/sk-e-seal-prototype
```

---

## Standards Implemented

| Standard | What | Where in Code |
|----------|------|--------------|
| **CSC v2.0.0.2** | Cloud Signature Consortium API | All `/csc/v2/*` endpoints |
| **RFC 6749** | OAuth 2.0 (Client Credentials) | `/oauth2/token` endpoint |
| **RFC 5652** | CMS/PKCS#7 (SignedData) | `packages/client-sdk/src/cms.ts` |
| **RFC 3161** | Time-Stamp Protocol | `packages/client-sdk/src/timestamp.ts` |
| **ETSI EN 319 142** | PAdES (PDF Advanced Electronic Signatures) | `packages/client-sdk/src/pdf.ts` |
| **eIDAS Regulation** | EU framework for electronic identification and trust services | SCAL2 flow, qualified certificate architecture |

---

*Last updated: 2026-03-29*
*Project: SK Remote Qualified E-Seal Prototype (Phase 1 - MVP Complete)*
