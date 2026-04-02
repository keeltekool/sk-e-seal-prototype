# Demo vs Product Alignment Analysis

> Comparing the prototype demo against Erko's technical architecture document ("Designing Qualified Remote E-S"), Raul's compliance feedback, and the 31 Mar brainstorming agreements.
>
> Date: 2026-04-02

---

## Executive Summary

The demo **correctly implements the core architecture** of the envisioned product. The fundamental flow — hash-only, OAuth 2.0, CSC-style endpoints, raw signature + timestamp, audit trail — is faithful to the technical document. There are **5 deliberate simplifications** (expected for a demo) and **3 areas where the demo diverges** from the product spec in ways worth noting before stakeholder meetings.

---

## What Aligns Perfectly

| Product Requirement | Demo Implementation | Status |
|---|---|---|
| Hash-only model (SHA-256, no documents) | API only accepts hashes; demo annotations explain this explicitly | ALIGNED |
| OAuth 2.0 Client Credentials (M2M) | Full implementation with JWT tokens | ALIGNED |
| CSC-style endpoints (/info, /credentials/info, /signatures/signHash) | All 6 CSC v2 endpoints implemented | ALIGNED |
| Raw RSA signature returned | signHash returns raw signature bytes | ALIGNED |
| RFC 3161 timestamp | Timestamp included in every seal operation | ALIGNED |
| Credential model (credential_id per tenant) | Demo shows 3 credentials per tenant, matching multi-credential reality | ALIGNED |
| Certificate chain via /credentials/info | Endpoint returns DER-encoded cert chain | ALIGNED |
| Audit trail (per-operation logging) | audit_log table with tenant, credential, operation, IP, user-agent | ALIGNED |
| No document upload/storage | API has no document endpoint; annotations explain this is architectural | ALIGNED |
| Developer Portal for credential management | Portal with OAuth + PIN generation, credential visibility | ALIGNED (meeting memo requirement) |

---

## Deliberate Simplifications (Expected, Non-Problematic)

These are areas where the demo intentionally simplifies. They're transparent and don't mislead stakeholders.

### 1. RSA 2048 vs RSA 4096+

- **Product spec:** RSA ≥ 4096-bit (Erko's chosen baseline)
- **Demo:** RSA 2048
- **Impact:** None for demonstrating the flow. The signing operation is identical regardless of key size. The portal and annotations don't claim a specific key size as a requirement — they just show RSA.
- **For stakeholders:** Mention that production uses 4096+ when discussing.

### 2. Software key store vs QSCD/HSM

- **Product spec:** QSCD/HSM with non-exportable keys, certified SAM
- **Demo:** AES-256-GCM encrypted keys in PostgreSQL
- **Impact:** None for the API flow. The signing interface is identical — hash goes in, signature comes out. The portal annotation explicitly states "stored inside a certified HSM (QSCD)" which is what production does.
- **For stakeholders:** Already explained in portal annotations.

### 3. No IP allowlist / WAF

- **Product spec:** IP allowlist enforced at gateway before auth
- **Demo:** No IP filtering
- **Impact:** Infrastructure concern, not protocol. Does not affect the sealing flow demonstration.

### 4. No batch sealing (500 hashes/request)

- **Product spec:** Up to 500 hashes per signHash call
- **Demo:** One hash per call
- **Impact:** The API already accepts `hash[]` array. Batch processing is a scaling concern, not an architectural one. The demo shows the per-hash flow correctly.

### 5. Single demo tenant vs full provisioning

- **Product spec:** Manual high-touch onboarding (A1-A4: tenant creation, legal verification, key ceremony, activation)
- **Demo:** Pre-seeded tenant with Developer Portal for credential management
- **Impact:** The portal annotations explicitly explain the full onboarding flow and that the demo skips the legal due diligence step. This was a deliberate design decision per the brainstorming session.

---

## Divergences Worth Noting

These are areas where the demo behaves differently from the product spec in ways that could cause confusion during a stakeholder walkthrough.

### 1. TIMESTAMP: Server-side vs Client-side (THE BIG ONE)

**Product spec (Erko's document, Section B, Step 6):**
> "TSA timestamps **signature bytes** (RFC3161 token returned)"

The product returns `signatureValue` + `timestampToken` together in the signHash response. The timestamp is applied **server-side by the e-seal service** as part of the sealing transaction. The client receives both the signature and its timestamp in one API response.

**Demo:**
The timestamp is requested **client-side by the SDK** (step 7 in the Process X-Ray, tagged as "SDK"). The signHash endpoint returns only the raw signature. The SDK then separately calls a TSA to get the RFC 3161 token.

**Why this matters:**
- In the product, timestamping is a **service guarantee** — every seal is timestamped automatically, the client can't skip it
- In the demo, timestamping is a **client responsibility** — the SDK handles it, but a client building their own integration could skip it
- The demo playground tags the timestamp step as "SDK" with a visible annotation, which could raise questions from a technical stakeholder who has read Erko's document

**How to handle in meetings:**
Acknowledge this openly: "In the demo, the SDK requests the timestamp separately to show each step of the flow transparently. In the production service, the timestamp is applied server-side as part of the signHash response — the client receives signature + timestamp together. The protocol is identical; the demo just splits it for educational visibility."

### 2. SCAL2 PIN vs No SCAL in Erko's Document

**Product spec (Erko's document):**
The document does NOT mention SCAL2, PIN, or credentials/authorize. The flow is: OAuth token → signHash. No explicit credential authorization step.

**Raul's feedback (confirmed in meeting memo):**
SCAL2 is required for qualified level. This adds the PIN-based authorization flow (credentials/authorize → SAD → signHash).

**Demo:**
Implements full SCAL2 with PIN and SAD tokens, following Raul's guidance.

**Why this matters:**
- The demo is MORE correct than Erko's original document on this point
- Raul confirmed SCAL2 is mandatory; the demo implements it
- But Erko's document may not have been updated to reflect this
- If stakeholders have read Erko's document, they might wonder why the demo has an extra authorization step

**How to handle in meetings:**
"The demo includes SCAL2 authorization (PIN → SAD token) based on Raul's compliance review. This is a regulatory requirement for qualified e-seals under EN 419 241-1, confirmed in our March 31 session. The original technical document predates this requirement being added."

### 3. CMS Assembly: Client vs Server Responsibility

**Product spec (Erko's document, Section 6.2 response):**
The service returns `signatureValue` (raw RSA bytes) + `timestampToken` (RFC 3161). The CLIENT is responsible for assembling whatever container format they need (CMS/PAdES/XAdES/etc.).

**Demo:**
The SDK assembles a full CMS/PKCS#7 SignedData container and injects it into the PDF as PAdES B-T. This is client-side, which ALIGNS with the product spec. But the demo's landing page and portal annotations frame this as "the SDK handles CMS assembly" — which could imply SK provides the SDK as part of the service.

**Product decision still open:**
Whether SK ships an official SDK is a product decision (noted in the landing page SDK annotation). The demo includes a working SDK; the product may or may not.

**How to handle in meetings:**
"The service returns raw signatures. What the client does with them — whether they build PAdES, XAdES, or raw CMS — is their responsibility. We built a reference SDK that shows one way to do it. Whether the production service includes an SDK is a separate product decision."

---

## Product Requirements Not Demonstrated (Out of Scope for Demo)

| Requirement | Product Spec Section | Why Not in Demo |
|---|---|---|
| Batch sealing (500 hashes) | §B, §6.2 | Demo shows per-hash flow; batch is scaling, not architecture |
| IP allowlist | §6.3 | Infrastructure, not protocol |
| Usage reporting (/reports/usage) | §9 | Billing model, not sealing flow |
| 10-year audit retention | §8 | Operational policy, not demonstrable |
| Idempotency-Key header | §10 | Resilience pattern, not core flow |
| Partial success per-item statuses | §10 | Batch-related; demo does single-hash |
| Key versioning behind stable credential_id | §5 | Lifecycle management, Phase 2+ |
| Post-quantum algorithm agility | §12 | Future-proofing, not current flow |
| Credential state machine (ACTIVE→SUSPENDED→REVOKED) | §5 | Demo shows 2 active + 1 suspended (static) |
| receiptId per seal event | §6.2 | Not returned in demo signHash response |

---

## Alignment Score

**Core architecture: 10/10** — Hash-only, OAuth 2.0, CSC-style endpoints, raw signatures, RFC 3161 timestamps, audit trail. The demo faithfully represents the product's fundamental design.

**Protocol compliance: 8/10** — SCAL2 adds a step not in the original doc (but required by regulation). Timestamp is client-side vs server-side. Both are explainable.

**Operational readiness: 4/10** — Expected for a demo. No batch, no IP allowlist, no usage reporting, no key lifecycle. These are Phase 2+ concerns.

**Stakeholder readiness: 9/10** — The educational annotations, portal walkthrough, and transparent step-by-step flow make this an effective sell-in tool. The three divergences above should be addressed proactively in meetings.

---

## Recommended Talking Points for Stakeholder Meetings

1. **"This demo runs the real CSC v2 protocol."** The API endpoints, authentication flow, and signing operations are identical to what the production service will expose.

2. **"The only thing that changes for production is infrastructure."** Replace the software key store with an HSM, swap the test cert for a real one, scale the database. The protocol doesn't change.

3. **"Timestamping will be server-side in production."** The demo splits it out for educational visibility. In the real service, every seal includes a timestamp automatically — the client can't opt out.

4. **"SCAL2 is included because Raul confirmed it's required."** The extra PIN authorization step is a regulatory requirement, not complexity for its own sake.

5. **"The Developer Portal shows the onboarding experience."** Banks will see exactly how their developers will interact with the service — get credentials, pick a seal certificate, test the flow.
