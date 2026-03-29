# Qualified E-Seal by SK ID — Project Scope

> **Status:** Pre-build (research complete, design validated)
> **Created:** 2026-03-24
> **Project dir:** `C:\Users\Kasutaja\Claude_Projects\sk-e-seal-prototype`
> **Related:** Alkoholiks API (learning vehicle), SK Remote E-Seal Initiative (production initiative)

---

## 1. What This Is

A **working prototype** of a CSC v2 compliant remote e-sealing service. It demonstrates the full circle: a client sends a PDF document hash, gets it sealed via a standards-compliant API, and receives back a sealed PDF with a valid digital signature embedded.

This is NOT the production SK service. This is a prototype that:
- Proves the CSC v2 API flow works end-to-end
- Demonstrates the hash-only privacy model (documents never leave the client)
- Produces cryptographically valid sealed PDFs
- Can be upgraded with real SK certificates for production-level validation

## 2. Why This Exists

**Direct learning vehicle** for the SK ID Solutions Remote E-Seal Initiative, where Egert leads business requirements and validation. The Alkoholiks API project taught API product patterns (OAuth 2.0, OpenAPI, developer portal, SDK). This project applies those patterns to the actual domain — CSC v2 e-sealing.

**Connection to SK initiative:** The business requirements (v3), technical requirements (v3), and market validation are documented in `G:\My Drive\SK_RE\Remote_e_seal\Kickoff\`. Raul (ET/regulatory) confirmed SCAL2 is required. The initiative targets Go/No-Go by end Q1 2026 with first pilot seal Q4 2026 / Q1 2027.

## 3. The Full Circle (End-to-End Flow)

```
CLIENT SIDE (SDK)                          SERVER SIDE (CSC v2 API)
─────────────────                          ────────────────────────
1. Load PDF document
2. Add signature placeholder (pdf-lib)
3. Compute SHA-256 of byte ranges
4. Build CMS SignedAttributes
5. Hash the SignedAttributes
                                    ──→    6. POST /oauth2/token (client_credentials)
                                    ──→    7. POST /csc/v2/credentials/authorize (PIN → SAD)
                                    ──→    8. POST /csc/v2/signatures/signHash (hash → sig)
                                    ←──    9. Return raw RSA signature
10. Wrap in CMS SignedData container
11. Add RFC 3161 timestamp (FreeTSA)
12. Inject CMS into PDF placeholder
13. Output: sealed PDF

VERIFICATION:
  Open in Adobe Acrobat → green checkmark (with real SK cert)
  Open in DigiDoc4 → valid e-seal
```

## 4. Phased Build Plan

### Phase 1: Prove the Loop (MVP)

**Goal:** Working CSC v2 e-sealing service with separate client SDK, landing page, and live demo.

| Component | What | Tech |
|---|---|---|
| CSC v2 API Server | 6 core endpoints (info, oauth2/token, credentials/list, credentials/info, credentials/authorize, signatures/signHash) | Next.js API routes |
| Software Key Store | One self-signed test certificate, generated at first startup. Designed so a real SK cert (.p12) can be dropped in later with zero code changes. | Neon DB |
| OAuth 2.0 | Client Credentials flow (reuse Alkoholiks API pattern) | Same as alkoholiks-api |
| SCAL2 Flow | credentials/authorize with per-tenant configurable PIN (hashed) → SAD token → signHash with SAD | JWT-based SAD |
| Client SDK | **Separate package** (`/packages/client-sdk/`) with own package.json, tests, README. Structured as if shipping to npm. | pdf-lib + @signpdf + node-forge |
| PAdES Level | B-T from the start — includes RFC 3161 timestamp. No signature without time proof. | FreeTSA.org |
| Landing Page | SK-style marketing site presenting the service as the real initiative envisions it. Value prop, how it works, use cases, pricing, compliance, developer experience. **⚠️ STOP and ask user for SK branding/styling guidance before building.** | Next.js + Tailwind |
| Live Demo | Embedded in landing page — upload PDF, get sealed PDF back. The marketing site and working demo are one integrated experience. | Connected to real API |
| CLI Demo | Developer-facing CLI for testing: `node seal-demo.js invoice.pdf` → sealed PDF | Node.js CLI |
| Documentation | Inline comments linking to CSC spec sections. `docs/architecture.md`, `docs/csc-v2-mapping.md`, developer guides. OpenAPI spec with Swagger UI at `/docs`. Educational reference quality throughout. | Markdown + OpenAPI 3.1 |

**Phase 1 Definition of Done:**
1. Run `node seal-demo.js invoice.pdf` → get `invoice-sealed.pdf` → open in Adobe → see valid signature with test certificate
2. Visit landing page → understand the service as a customer would → upload a PDF → download sealed PDF
3. Every CSC v2 endpoint documented with spec section references
4. Client SDK installable and usable independently

### Phase 2: Make It Real

| Component | What |
|---|---|
| Multi-tenant credential store | Per-customer keypairs + certificates in DB |
| Mini-PKI | Self-signed Root CA → Intermediate CA → per-customer seal certs |
| Admin API | Create tenants, provision credentials, manage lifecycle |
| Real SK certificate | Import actual SK-issued e-seal cert (.p12) for production-level validation |
| OpenAPI spec | Full Swagger UI documentation |
| Batch sealing | Multiple hashes per signHash call |

### Phase 3: Scale & Harden

| Component | What |
|---|---|
| Rate limiting | Upstash Redis (same as alkoholiks-api) |
| Audit logging | Per-seal audit trail with full traceability |
| PAdES-B-LT | Long-term validation data embedded in signatures |
| SDK distribution | Publish client SDK to npm |

## 5. CSC v2 API Endpoints (MVP Scope)

| Endpoint | Method | Purpose |
|---|---|---|
| `/csc/v2/info` | POST | Service discovery — capabilities, auth types, supported algorithms |
| `/oauth2/token` | POST | Client Credentials → access token |
| `/csc/v2/credentials/list` | POST | List credentials for authenticated tenant |
| `/csc/v2/credentials/info` | POST | Certificate chain, key algo, SCAL level, auth mode |
| `/csc/v2/credentials/authorize` | POST | PIN → SAD token (SCAL2 flow) |
| `/csc/v2/signatures/signHash` | POST | Hash(es) in → signature(s) out |

**Spec source:** CSC API v2.0.0.2 (100-page PDF extracted and analyzed).
Full spec: `https://cloudsignatureconsortium.org/wp-content/uploads/2023/04/csc-api-v2.0.0.2.pdf`

## 6. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js (App Router) | Same as alkoholiks-api, proven pattern |
| Database | Neon (PostgreSQL) | Credentials, tenants, audit log |
| Cache | Upstash Redis | Tokens, rate limits (Phase 3) |
| Crypto | Node.js native `crypto` | RSA key gen, signing, SHA-256 — zero deps |
| Certificates | `node-forge` | X.509 cert generation, CMS/PKCS#7 containers |
| PDF manipulation | `pdf-lib` | Add signature placeholders, manipulate PDFs |
| PDF signing | `@signpdf/signpdf` + `@signpdf/placeholder-pdf-lib` | PAdES signature embedding |
| PAdES compliance | `node-signpdf-pades` patterns | ESSCertIDv2 for Baseline B |
| Timestamps | FreeTSA.org (`https://freetsa.org/tsr`) | Free RFC 3161 TSA |
| OpenAPI | OpenAPI 3.1 + Swagger UI | API documentation |
| Auth | Clerk (developer portal, Phase 3) | Same as alkoholiks-api |

## 7. Key Technical Decisions

### Hash-only model
Documents never touch our server. Client computes SHA-256 locally, sends only the 32-byte hash. This is mandated by CSC spec and critical for GDPR/data privacy.

### CMS signing subtlety
When signing for PAdES, you don't send the raw PDF hash to signHash. The flow is:
1. Compute PDF byte range hash → `pdfHash`
2. Build CMS SignedAttributes containing `pdfHash` as messageDigest
3. DER-encode SignedAttributes → hash THAT → `attrsHash`
4. Send `attrsHash` to CSC signHash
5. Get back raw RSA signature
6. Inject into CMS SignedData → embed in PDF

(Documented in node-signpdf issue #46)

### SCAL2 (per Raul's regulatory feedback)
The SCAL1 vs SCAL2 debate is settled: SCAL2 is required for qualified level. The prototype implements `credentials/authorize` with a per-tenant configurable PIN (stored hashed in DB) that returns a SAD token. The PIN is stored in the client's system — no human enters it. Full M2M remains possible.

### Certificate swappability
The credential store is designed so any certificate + key pair can be plugged in:
- Self-signed (Phase 1) — works but Adobe shows "unknown CA"
- Real SK advanced e-seal (.p12 import) — Adobe green checkmark, DigiDoc4 validates
- Qualified would require HSM — out of scope for prototype

## 8. Reference Implementations Found

| Project | Language | What | Relevance |
|---|---|---|---|
| `simionrobert/cloud-signature-consortium` | Node.js | CSC v1 server with SoftHSMv2 | Primary reference — only Node.js CSC server |
| `bntan/signature-csc-service` | Java | Full PDF-in → sealed-PDF-out | Best architectural reference |
| `esig/dss` (EU DSS) | Java | EU Commission's signature library | Gold standard for PAdES compliance |
| `MatthiasValvekens/certomancer-csc-dummy` | Python | CSC test server | Minimal server surface reference |
| `Xevolab/node-signpdf-pades` | Node.js | PAdES Baseline B | Passes ETSI conformance checker |
| `vbuch/node-signpdf` | Node.js | PDF signature embedding | 875 stars, MIT, actively maintained |

**Key finding:** No open-source CSC v2 server exists in any language. Our prototype would be the first.

## 9. Patterns Transferring from Alkoholiks API

| Pattern | Alkoholiks API | This Project |
|---|---|---|
| OAuth 2.0 Client Credentials | `POST /oauth/token` | `POST /oauth2/token` |
| Consumer management | Neon (consumers table) | Neon (tenants + credentials tables) |
| Rate limiting | Upstash Redis | Same |
| OpenAPI/Swagger | OpenAPI 3.1 + Swagger UI | Same |
| SDK | Hand-written TypeScript | Same approach (+ PDF operations) |
| Developer portal | Clerk + Next.js | Same (Phase 3) |

## 10. SK Initiative Alignment

Cross-checked against the full market validation documents (`G:\My Drive\SK_RE\Remote_e_seal\Confu_full_Exctracts\`):

| Validation Requirement | Prototype Status |
|---|---|
| CSC v2 API standard | Full conformance planned |
| Hash-only (document never leaves client) | Core design principle |
| OAuth 2.0 Client Credentials for M2M | Implemented (from alkoholiks-api) |
| Qualified timestamp bundled (RFC 3161) | FreeTSA for prototype |
| Batch sealing | Phase 2 |
| PAdES compliance | node-signpdf-pades (ETSI conformance tested) |
| RSA 2048+ / SHA-256+ | Node.js native crypto |
| SCAL2 with PIN | credentials/authorize flow |
| Client SDK (the "abstraction layer" gap) | TypeScript SDK is a core deliverable |
| Multi-language SDK coverage | Node.js/TypeScript first, others post-MVP |

**Gap identified in validation:** "Hash-based signing requires customers to implement PDF handling themselves." Our client SDK directly addresses this gap — it's the "Option B: Abstraction Layer" that the validation recommends as post-launch enhancement, but we build it from day one because without it the prototype can't demonstrate the full circle.

## 11. Source Documents

| Document | Location | Content |
|---|---|---|
| Business Requirements v3 | `G:\My Drive\SK_RE\Remote_e_seal\Kickoff\Remote_E-Seal_Business_Requirements_v3.md` | 10 requirements, pricing tiers, success criteria |
| Technical Requirements v3 | `G:\My Drive\SK_RE\Remote_e_seal\Kickoff\Remote_E-Seal_Technical_Requirements_v3.md` | CSC v2 endpoints, SCAL levels, architecture |
| Initiative Integration Doc | `G:\My Drive\SK_RE\Remote_e_seal\Kickoff\Initiative_Integration_Document.md` | 12 deliverables, dependency graph, Go/No-Go criteria |
| Raul's Feedback Synthesis | `G:\My Drive\SK_RE\Remote_e_seal\Kickoff\SO_Output\Raul_Feedback_Synthesis.md` | SCAL2 confirmed, certified SAM required, CSC v2 mandatory |
| Open Questions Guide | `G:\My Drive\SK_RE\Remote_e_seal\Kickoff\SO_Output\Open_Questions_Investigation_Guide.md` | 21 open questions, priority order |
| Market Validation Master | `G:\My Drive\SK_RE\Remote_e_seal\Confu_full_Exctracts\SK_Remote_E-Seal_MASTER_Formatted.txt` | Full market analysis, Swisscom/iText validation, competitor mapping |
| CSC v2.0 Spec (PDF) | `https://cloudsignatureconsortium.org/wp-content/uploads/2023/04/csc-api-v2.0.0.2.pdf` | 100-page spec, all endpoints, e-seal auth (Section 8.5) |
| Alkoholiks API Design | `C:\Users\Kasutaja\Claude_Projects\alkoholiks-api\docs\plans\2026-03-21-alkoholiks-api-design.md` | OAuth, OpenAPI, SDK patterns to reuse |

## 12. Design Philosophy

**No corners cut.** Every architectural decision is made so the prototype can evolve toward the real SK production service through incremental upgrades — not rewrites. Swapping in a real SK certificate, connecting to a real HSM, adding real CA infrastructure — each should be a config/integration change, not a rebuild.

This is both a **learning vehicle** and a **reference implementation**. Code quality, documentation, and structure must be at a level where SK colleagues can study it as a blueprint for the real service.

## 13. Landing Page — SK Branding Gate

The landing page presents the Remote Qualified E-Seal Service as SK would market it to customers. It must use SK-appropriate branding and styling.

**⚠️ MANDATORY STOP:** Before building the landing page, STOP and ask the user for SK branding/styling guidance. Do NOT proceed with generic styling or guessed SK brand colors. Wait for explicit direction.

---

*Next step: Write PRD, get approval, then build Phase 1.*
