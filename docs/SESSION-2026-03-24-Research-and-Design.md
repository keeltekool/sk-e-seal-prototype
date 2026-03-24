# SK E-Seal Prototype — Research & Design Session

> **Date:** 2026-03-24
> **Participants:** Egert (SK ID Solutions, Business Lead / Initiative Owner) + Claude (AI pair programmer)
> **Duration:** Full session (~3 hours)
> **Outcome:** Feasibility confirmed, project created, scope documented, ready to build

---

## Table of Contents

1. [Starting Point — Why This Project Exists](#1-starting-point)
2. [Onboarding — Reading the SK Initiative Materials](#2-onboarding)
3. [The Big Question — Can We Actually Build This?](#3-the-big-question)
4. [Research Phase — Investigating the CSC v2 Standard](#4-research-phase)
5. [Feasibility Assessment — The Verdict](#5-feasibility-assessment)
6. [Cross-Check Against Market Validation](#6-cross-check)
7. [The Client-Side Problem — Closing the Full Circle](#7-client-side-problem)
8. [Certificate Management — The Bread and Butter](#8-certificate-management)
9. [The Real SK Certificate Question](#9-real-sk-certificate)
10. [Project Setup — Sealing the Session](#10-project-setup)

---

## 1. Starting Point — Why This Project Exists <a name="1-starting-point"></a>

### Context

Egert works at SK ID Solutions and leads the business requirements and validation for a **Remote Qualified E-Seal Service** — a cloud-based API that would let organizations seal documents with qualified electronic seals without needing their own HSM infrastructure.

Before tackling the production service, Egert built the **Alkoholiks API** — an educational project that taught API product patterns (OAuth 2.0 Client Credentials, OpenAPI 3.1, developer portal, TypeScript SDK, rate limiting) on simple data (Estonian drink prices). The craftsmanship was the point, not the data.

### The Ask

Now it's time to apply those learned patterns to the actual domain. Egert asked:

> "Would it be possible for us to build something that follows the business requirements of this remote e-sealing solution and also follows the CSC standard? A functionally working prototype where we can emulate a customer sending document hashes, getting them signed, and attaching those signed hashes to documents with a seal applied."

The session started with two tasks:
1. Get onboarded on the full SK initiative materials
2. Research whether a working prototype is technically feasible

---

## 2. Onboarding — Reading the SK Initiative Materials <a name="2-onboarding"></a>

### Documents Reviewed

The following documents were read and analyzed from the SK initiative folder (`G:\My Drive\SK_RE\Remote_e_seal\Kickoff\`):

| Document | Key Content |
|---|---|
| **Business Requirements v3** | 10 core requirements, pricing tiers (€0.01-€0.15/seal), success criteria, open questions |
| **Technical Requirements v3** | CSC v2 endpoints, SCAL levels, architecture concept, competitive landscape |
| **Initiative Integration Document** | 12 departmental deliverables across SO/ET/RC, dependency graph, Go/No-Go criteria, €772K-€1.035M total cost |
| **Raul's Feedback Synthesis** | **The big shift:** SCAL2 confirmed required (not SCAL1). Certified SAM non-negotiable. CSC v2 full conformance now mandatory. |
| **Open Questions Investigation Guide** | 21 open questions, 3 critical: CAB selection, SAM buy-vs-build, onboarding process |
| **Meeting Memo (Raul/Sole Control)** | Regulatory path confirmed viable. "The question is HOW, not IF." |
| **BS Review & Gap Analysis** | Section-by-section review of Erko's SO technical PoC |
| **Sole Control Position Paper** | 7 arguments for M2M feasibility, eIDAS Art. 26 vs Art. 36 analysis |
| **Status Tracker** | Everything at "Not started" for formal validation workplan |
| **ET/RC/SO Deliverables** | All 12 departmental deliverable drafts reviewed |

### Key Findings from Onboarding

**The SCAL2 shift** was the most consequential finding. The initiative's original position was SCAL1 (simpler, implicit authorization). Raul (ET/regulatory expert) confirmed SCAL2 is required for qualified level. This means:

- `credentials/authorize` endpoint is now required (returns SAD token)
- Certified SAM is non-negotiable
- Two-factor auth needed: mTLS (possession) + static PIN (knowledge)
- **But it's still fully M2M** — the PIN is stored in the client's system, not human-entered

**CSC v2 full conformance became mandatory** — not "CSC-style" as Erko's initial design proposed. SCAL2 requires the `credentials/authorize` endpoint, which IS a CSC v2 endpoint. Without it, the SCAL2 flow can't work.

**Overall alignment confirmed** — Raul stated the architecture "follows Egert's vision" and the initiative is viable. The question is execution, not feasibility.

---

## 3. The Big Question — Can We Actually Build This? <a name="3-the-big-question"></a>

With the initiative context understood, the core question became:

> Can we build a working CSC v2 e-sealing prototype in Node.js/TypeScript that actually signs document hashes, produces real cryptographic signatures, and embeds them into PDFs?

This required investigating:
1. The CSC v2 API specification in detail (it's a niche standard, not in mainstream dev docs)
2. Whether the crypto primitives are available in Node.js
3. Whether PDF signing libraries exist for the client-side operations
4. Whether free timestamp authorities exist for prototyping

---

## 4. Research Phase — Investigating the CSC v2 Standard <a name="4-research-phase"></a>

### Approach

Context7 (the usual library documentation tool) was unlikely to have CSC v2 — it's a niche European trust services standard, not a mainstream npm package. Multiple research methods were used in parallel:

1. **Cloudflare /crawl API** — crawled the Cloud Signature Consortium website (50 pages)
2. **Direct PDF extraction** — downloaded and extracted the 100-page CSC v2.0.0.2 specification using PyMuPDF
3. **Three background research agents** — parallel investigation of:
   - CSC v2 endpoint schemas, authentication flows, data models
   - Node.js crypto capabilities, PDF signing libraries, free TSA servers
   - GitHub open-source implementations of the CSC standard

### CSC v2 Specification — Full Extraction

The CSC API v2.0.0.2 specification (published April 2023, 100 pages) was downloaded from the official source and text-extracted page by page. Key sections analyzed:

**Section 8.5 — Authentication and Authorization for Electronic Seals:**
- Explicitly covers e-seal use case (organizational, automated, high-volume)
- Three service authorization methods for e-seals: HTTP Basic, OAuth 2.0 Client Credentials, Mutual TLS
- Credential authorization via PIN (automatable), no-auth (if access token sufficient), or SAD for limited batch
- Confirms M2M is fully supported — no human interaction required

**Section 11 — The Remote Service APIs (all endpoint definitions):**

| Endpoint | Purpose | Extracted |
|---|---|---|
| `POST /csc/v2/info` | Service discovery | Full request/response schema |
| `POST /oauth2/token` | Token exchange (Client Credentials, Auth Code, Refresh) | Full schema + sample requests |
| `POST /csc/v2/credentials/list` | List credentials for user/tenant | Full schema including credentialInfo object |
| `POST /csc/v2/credentials/info` | Credential details (cert chain, key info, auth mode, SCAL) | Full schema + sample responses |
| `POST /csc/v2/credentials/authorize` | PIN → SAD token (SCAL2 flow) | Full schema + error codes |
| `POST /csc/v2/signatures/signHash` | Hash(es) → signature(s) | Full schema, sync + async modes |
| `POST /csc/v2/signatures/signDoc` | Full document signing (server-side) | Schema (not needed for hash-only model) |
| `POST /csc/v2/signatures/timestamp` | Timestamp operations | Schema |

**Signature qualifiers found in the spec:**
- `eu_eidas_qeseal` — Qualified Electronic Seal under eIDAS
- `eu_eidas_aeseal` — Advanced Electronic Seal under eIDAS

**Algorithm OIDs confirmed:**
- SHA256withRSA: `1.2.840.113549.1.1.11`
- RSA PKCS#1: `1.2.840.113549.1.1.1`
- SHA-256: `2.16.840.1.101.3.4.2.1`

### Research Agent Results

**Agent 1 — CSC v2 Spec & Implementations:**
- Found CSC versions: v2.2 (Nov 2025), v2.1.0.1 (Jan 2025), v2.0.0.2 (Apr 2023)
- Reconstructed complete endpoint schemas from production implementations (ZealiD, itsme, SSL.com)
- Found EUDI Wallet CSC v2 Kotlin client library (official EU project)
- **SSL.com eSigner has a public sandbox** at `cs-try.ssl.com` — potential for testing our client SDK against a real provider

**Agent 2 — Prototype Feasibility:**
- **Node.js `crypto` module** — full RSA support (key generation, PKCS1-v1_5, RSA-PSS, SHA-256). Zero external dependencies needed.
- **PDF signing chain confirmed:**
  - `pdf-lib` (MIT) — PDF manipulation, signature placeholder insertion
  - `@signpdf/signpdf` + `@signpdf/placeholder-pdf-lib` (MIT) — signature embedding
  - `node-signpdf-pades` (MIT) — PAdES Baseline B, passes ETSI conformance checker
- **Free TSA servers:** FreeTSA.org, DigiCert, Sectigo, rfc3161.ai.moda (load-balanced, millions of requests/month)
- **Certificate generation:** `node-forge` (BSD) and `@peculiar/x509` (MIT) both handle full X.509 cert creation with custom extensions
- **CMS/PKCS#7 containers:** `node-forge` for detached CMS SignedData creation
- **Existing CSC Node.js implementation found:** `simionrobert/cloud-signature-consortium` (MIT) — CSC v1 server with SoftHSMv2

**Agent 3 — GitHub Open-Source Landscape:**

| Project | Language | Type | Stars |
|---|---|---|---|
| `simionrobert/cloud-signature-consortium` | **Node.js** | CSC v1 Server | 26 |
| `esig/dss` (EU DSS) | Java | EU Commission's signature library | 971 |
| `vbuch/node-signpdf` | Node.js | PDF signing | 875 |
| `bntan/signature-csc-service` | Java | Full PDF-in → sealed-PDF-out | 14 |
| `MatthiasValvekens/certomancer-csc-dummy` | Python | CSC test server | 2 |
| `methics/laverca-csc-client` | Java | CSC v1 client | 8 |
| `Xevolab/node-signpdf-pades` | Node.js | PAdES Baseline B | — |

**Critical finding: No open-source CSC v2 server exists in any language.** All v2 implementations are commercial. Our prototype would be the first.

### CMS Signing Subtlety Discovered

A critical technical gotcha was identified from `node-signpdf` issue #46:

> When using an external signer (like CSC `signHash`), you do NOT send the raw PDF hash to the CSC API.

The actual flow is:
1. Compute SHA-256 of the PDF's signed byte range → `pdfHash`
2. Build CMS `SignedAttributes` containing `pdfHash` as the `messageDigest` attribute
3. DER-encode the `SignedAttributes` → hash THAT → `attrsHash`
4. Send `attrsHash` to CSC `signatures/signHash`
5. Get back the raw RSA signature
6. Inject into the CMS `SignedData` structure → embed into PDF

This is a known pitfall that would have caused debugging time if not caught upfront.

---

## 5. Feasibility Assessment — The Verdict <a name="5-feasibility-assessment"></a>

### Answer: Yes, absolutely buildable.

Every component of the full e-sealing flow has working, MIT-licensed Node.js libraries:

| Component | Solution | Status |
|---|---|---|
| RSA key generation (2048/4096-bit) | Node.js native `crypto` | Zero dependencies |
| RSA signing (PKCS#1 v1.5) | Node.js native `crypto.sign()` | One-liner |
| SHA-256 hashing | Node.js native `crypto.createHash()` | One-liner |
| X.509 certificate generation | `node-forge` or `@peculiar/x509` | npm packages, MIT/BSD |
| CMS/PKCS#7 container creation | `node-forge` (detached mode) | npm package, BSD |
| PDF signature placeholder | `pdf-lib` + `@signpdf/placeholder-pdf-lib` | npm packages, MIT |
| PDF signature embedding | `@signpdf/signpdf` | npm package, MIT |
| PAdES Baseline B compliance | `node-signpdf-pades` patterns | Passes ETSI checker |
| RFC 3161 timestamps | FreeTSA.org / DigiCert / rfc3161.ai.moda | Free, public |
| OAuth 2.0 Client Credentials | Already built in Alkoholiks API | Direct reuse |

### What's Real vs Simulated in the Prototype

| Aspect | Real | Simulated |
|---|---|---|
| CSC v2 API endpoints | Full conformance | — |
| OAuth 2.0 Client Credentials | Real | — |
| RSA signing of hashes | Real cryptographic operations | — |
| SCAL2 flow (PIN → SAD → signHash) | Real flow | — |
| RFC 3161 timestamps | Real (FreeTSA) | — |
| PAdES PDF embedding | Real — opens in Adobe/viewers | — |
| Batch sealing (multiple hashes) | Real | — |
| HSM/QSCD | — | Software keys (encrypted in DB) |
| Qualified certificates | — | Self-signed CA chain |
| EU Trusted List | — | Not applicable to prototype |

---

## 6. Cross-Check Against Market Validation <a name="6-cross-check"></a>

The full market validation documents were read from `G:\My Drive\SK_RE\Remote_e_seal\Confu_full_Exctracts\`:

- **SK_Remote_E-Seal_MASTER_Formatted.txt** — ~6000 lines, covers market analysis, competitor mapping, Swisscom/iText case study, pricing, SWOT, GTM strategy
- **Initiative_Remote_Qualified_E-Seal_Service_Development_Validation_FULL.txt** — full initiative validation

### Alignment Check

Every major technical decision in our prototype plan aligns with the validated market requirements:

| Validation Requirement | Our Plan | Status |
|---|---|---|
| CSC v2 API standard ("47% of remote signature services use CSC-API") | Full CSC v2 endpoint implementation | Aligned |
| Hash-only model ("document never leaves customer infrastructure") | `signatures/signHash` accepts only hashes | Aligned |
| OAuth 2.0 Client Credentials for M2M | Same pattern as Alkoholiks API | Aligned |
| Qualified timestamp bundled (RFC 3161) | FreeTSA for prototype, real TSA for production | Aligned |
| Batch sealing ("single auth for multiple hashes") | CSC `numSignatures` param + hash arrays | Aligned |
| PAdES-B-LT minimum for sealed PDFs | `node-signpdf-pades` (ETSI conformance tested) | Aligned |
| RSA 2048+ / SHA-256+ | Node.js native crypto | Aligned |
| SCAL2 with PIN (per Raul's feedback) | `credentials/authorize` with PIN → SAD | Aligned |

### The Swisscom/iText Case Study — Architectural Validation

The market validation contained a detailed analysis of the Swisscom Trust Services + iText partnership, which **directly validates our planned architecture:**

> "Swisscom's All-in Signing Service (AIS) uses hash-based remote signing — the exact model SK ID Solutions plans to implement. Customers generate a SHA-256 hash locally, transmit only the Base64-encoded hash value to Swisscom's cloud service, receive the signed hash, then embed it back into the PDF."

The division of responsibilities matches our prototype design exactly:
- **QTSP (server) handles:** HSM key management, certificate issuance, cryptographic signing, authentication, timestamping
- **Customer (client) handles:** PDF preparation, hash generation, API integration, CMS construction, signature embedding

---

## 7. The Client-Side Problem — Closing the Full Circle <a name="7-client-side-problem"></a>

### The Gap Egert Identified

Egert raised a critical point:

> "Our full solution also has to cover this client-side pain where they prepare those hashes for sending us. Without that part, the loop will not be closed."

The CSC API is hash-in / signature-out. But someone needs to:
1. Take a PDF → add a signature placeholder
2. Compute the correct byte range hash
3. Send hash to the API
4. Get signature back → wrap in CMS container
5. Embed the CMS back into the PDF

In the current market, **iText** (Java, commercial/AGPL) is the standard tool for this. The market validation noted:

> "Hash-based signing requires customers to implement PDF handling themselves. Unlike InfoCert (GoSign SDK handles PDF preparation, hash extraction, signature embedding, PAdES compliance), SK has no SDK or abstraction layer."

### The Open-Source Alternatives

The validation documents already identified the alternatives, and our research confirmed their viability:

| Library | Language | License | PAdES Support |
|---|---|---|---|
| **iText 7** | Java/.NET | AGPL / Commercial | Full |
| **Apache PDFBox + EU DSS** | Java | Apache / LGPL | Full (EU Commission maintained) |
| **PyHanko** | Python | MIT | Full + native CSC support |
| **node-signpdf + pdf-lib** | **Node.js** | **MIT** | PAdES Baseline B |

For our prototype, the Node.js stack (`pdf-lib` + `@signpdf/signpdf` + `node-forge`) provides everything we need — no iText license required.

### Decision: Client SDK Is a Core Deliverable

The market validation recommended the SDK as a post-launch enhancement ("Option B: Abstraction Layer"). We build it from day one because:
1. Without it, the prototype can't demonstrate the full circle
2. It directly addresses the biggest customer integration pain point
3. Swisscom's client libraries were archived in July 2025 — we fill that gap
4. It becomes both a demo tool AND a market differentiator

---

## 8. Certificate Management — The Bread and Butter <a name="8-certificate-management"></a>

### The Core Concept

Egert raised the fundamental question:

> "One of the main bread-and-butter things is that company-specific e-seals are hosted inside the HSM and invoked from outside. The customer who asked for sealing — it cannot be some random seal; the point is that it's that customer-specific seal."

In production at SK:
- Each customer (SEB, Swedbank, a hospital) has their **own RSA keypair** generated inside the HSM
- Their **own qualified e-seal certificate** issued by SK's CA, with their org name and registry code
- A **credentialID** mapping to that specific key+cert combination
- When they call the API, **their specific key** signs the hash

### Prototype Solution: Software Key Store + Mini-PKI

For the prototype, we emulate this with:

**A self-contained certificate authority:**
```
Self-signed Root CA ("SK E-Seal Prototype Root CA")
  └── Intermediate CA ("SK E-Seal Prototype Issuing CA")
       ├── SEB Pank AS certificate (O=SEB Pank AS, C=EE)
       ├── Hospital certificate
       └── Demo Corp certificate
```

**A credential store (database table):**
- Each row = one customer's credential (credentialID, encrypted private key, certificate, chain, PIN hash)
- Private keys encrypted at rest with AES-256-GCM
- Tenant isolation: SEB can only use SEB's credential

**Automated provisioning** (what's a weeks-long key ceremony in production):
- Admin creates tenant → system generates keypair + certificate → stores credential → returns API keys

### Phased Approach to Complexity

The key insight to manage scope:

**Phase 1 (MVP):** One hardcoded test certificate + keypair. No dynamic CA. Just prove the signing works.

**Phase 2:** Multi-tenant credential store, mini-PKI, dynamic cert issuance per customer.

**Phase 3:** Import real SK certificates, admin portal, lifecycle management.

---

## 9. The Real SK Certificate Question <a name="9-real-sk-certificate"></a>

### The Question

Egert asked whether a real SK-issued certificate could be plugged into the prototype to achieve validation in Adobe Acrobat and DigiDoc4.

### The Answer — With an Important Nuance

**The certificate and the private key are a married pair.** The public key inside the certificate must match the private key used for signing.

| Scenario | Adobe Green Check | DigiDoc4 Validates | SK Chain Visible |
|---|---|---|---|
| **Self-signed cert** (Phase 1) | No — unknown CA | No — not on Trusted List | No |
| **Real SK advanced e-seal** (.p12 import) | **Yes** — SK is on Adobe AATL | **Yes** — SK is on EU Trusted List | **Yes** |
| **Real SK qualified e-seal** (QSCD) | Impossible — key stuck in HSM | Impossible | Impossible |

**Why qualified won't work:** Qualified certificates have their private keys generated inside a certified HSM, and the keys are **non-extractable by design**. That's the whole point of QSCD — the key never leaves the hardware.

**Why advanced WILL work:** SK currently issues advanced e-seal certificates as `.p12` files or on crypto sticks. The private key is exportable. In fact, this is what 94.6% of SK's 993 current e-seal certificates are — advanced, not qualified. When these certificates are used in third-party services like Dokobit, the keys are NOT in SK's QSCD HSMs — they're in Dokobit's infrastructure. Same situation as our prototype.

**The practical path:** Get an advanced-level SK e-seal certificate as a `.p12` file. Import it into the credential store. The prototype signs with that real key. Open the sealed PDF in Adobe → green checkmark with SK's full certificate chain. Open in DigiDoc4 → valid advanced e-seal.

**The only difference between this and production qualified** is where the key physically lives (our DB vs HSM). The API flow, the signatures, the PDF embedding — all identical.

### SK's Current Reality Validates This

SK currently issues certificates that customers use in Dokobit and other services. Once those keys leave the QSCD/crypto stick environment and enter third-party infrastructure, they operate at advanced level regardless of what the certificate originally claimed. Our prototype replicates exactly this setup.

---

## 10. Project Setup — Sealing the Session <a name="10-project-setup"></a>

### What Was Created

| Asset | Location |
|---|---|
| **Project directory** | `C:\Users\Kasutaja\Claude_Projects\sk-e-seal-prototype\` |
| **SCOPE.md** | Comprehensive scope document (11 sections, covers everything from this session) |
| **CLAUDE.md** | Project conventions, technical notes, reference repos |
| **.gitignore** | Standard + crypto file exclusions (.p12, .pfx, .pem, .key) |
| **GitHub repo** | `keeltekool/sk-e-seal-prototype` (private) |
| **Memory entry** | `project_sk_e_seal_prototype.md` in Claude's persistent memory |
| **MEMORY.md updated** | Cross-linked to Alkoholiks API and SK initiative |

### The Build Plan (Phases)

**Phase 1 — Prove the Loop (MVP):**
- 6 CSC v2 endpoints (info, token, credentials/list, credentials/info, credentials/authorize, signatures/signHash)
- One test credential with self-signed certificate
- TypeScript client SDK (pdf-lib + @signpdf + node-forge)
- Demo CLI: `node seal-demo.js invoice.pdf` → `invoice-sealed.pdf`
- **Done when:** Open sealed PDF in Adobe, see valid signature

**Phase 2 — Make It Real:**
- Multi-tenant credential store with per-customer keypairs + certificates
- Mini-PKI (self-signed Root CA → Intermediate CA → customer certs)
- Admin API for tenant/credential management
- Import real SK advanced e-seal certificate (.p12)
- Batch sealing support
- OpenAPI spec + Swagger UI

**Phase 3 — Polish:**
- Developer portal (reuse Alkoholiks API patterns)
- Rate limiting (Upstash Redis)
- Audit logging
- PAdES-B-T/LT (timestamp embedding, validation data)

### Next Session

1. Write PRD (per project conventions — PRD must be approved before any code)
2. Get Egert's approval
3. Build Phase 1

---

## Summary of Key Decisions

| Decision | Rationale |
|---|---|
| **CSC v2 full conformance** | Regulatory requirement (SCAL2 needs CSC v2 endpoints). Not "CSC-style." |
| **SCAL2 implementation** | Raul confirmed. PIN → SAD → signHash. Still fully M2M. |
| **Hash-only model** | CSC spec mandates it. GDPR/privacy requirement. Documents never touch the server. |
| **Client SDK as core deliverable** | Without it, can't demonstrate full circle. Addresses the biggest integration pain point. |
| **node-forge as primary crypto library** | Handles X.509, CMS/PKCS#7, RSA — the Swiss Army knife for this project. |
| **Certificate swappability** | Self-signed for dev, real SK .p12 for production validation. Same credential store. |
| **Next.js + Neon + Upstash** | Proven stack from Alkoholiks API. Direct pattern reuse. |
| **Phase 1 = minimum viable loop** | One credential, six endpoints, client SDK, demo CLI. No over-engineering. |

---

*This document captures the full research and design session of 2026-03-24. The project is ready to build.*
