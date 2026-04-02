# Developer Portal & Landing Page Enrichment — Design Document

> Date: 2026-04-02
> Status: Approved
> Context: Brainstorming session based on Meeting Memo (31 Mar 2026) — portal confirmed as must-have by all participants (Egert, Erko, Raul, Rain)

---

## Problem Statement

The prototype demonstrates a fully working CSC v2 e-sealing flow, but **credential onboarding is entirely missing**. Credentials are created by a seed script, hardcoded in `.env.local`, and invisible to anyone using the demo. There is no way for a visitor to:

1. See what credentials a tenant has
2. Understand the OAuth + SCAL2 + credential model
3. Test the API flow with their own generated credentials
4. Understand how this translates to a real production service

The meeting memo (31 Mar 2026) confirmed:
- *"On-boardimine on see koht, kus puudu on"* (Egert)
- Portal for credential management is a must-have, not nice-to-have (all participants)
- Delegation model: authorized representative onboards, then delegates to developers (Raul, Rain)
- Audit trail required (Raul)

Additionally, the landing page currently serves as a marketing + demo page but lacks **educational annotations** that explain how the demo maps to the real production service. This limits its usefulness as a stakeholder communication and sales tool.

---

## Goals

1. **Developer Portal** — a functional credential management interface where developers get API access, view seal certificates, and test the full CSC v2 integration flow
2. **Landing Page Enrichment** — integrate portal links and educational annotations that make the page a self-guided walkthrough for sales meetings and stakeholder buy-in
3. **Educational Layer** — scroll-aware contextual annotations across both portal and landing page, explaining what happens in the real service at each step
4. **SDK Visibility** — properly highlight the client-side SDK's role and the division of responsibility between client and API
5. **Multiple Credentials** — demonstrate that organizations run multiple simultaneous seal certificates for different business processes (invoicing, contracts, regulatory)

## Non-Goals

- Legal entity onboarding (due diligence, esindusõigus verification) — out of scope
- Authentication/login (Clerk or otherwise) — portal is open access
- Multi-tenant support — single demo tenant
- Certificate creation/management — certificates are provisioned by the QTSP, never by developers
- Production-grade security — this is a demo, not a production portal

---

## Audience

**Primary:** Technical stakeholders (architects, security team, compliance) who understand PKI/crypto but need to see how the service flow works specifically.

**Secondary use case:** Sales tool — the landing page + portal together replace PowerPoint slides. Sales walks through the page section by section, with annotations providing talking points.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Portal authentication | None (open access) | Removes friction, keeps focus on credential management and API flow |
| Tenant scope | Single demo tenant ("Demo Corporation OÜ") | Simplest model, sufficient for demonstration |
| Credential generation | Self-service (generate/regenerate) | Matches Alkoholiks API pattern, realistic — in production this is where developers get credentials |
| Multiple seal credentials | 3 pre-seeded (2 active, 1 suspended) | Mirrors real-world: banks run multiple seals simultaneously for different business processes |
| Portal playground | Separate from landing page demo | Landing page = black box outcome demo. Portal = transparent step-by-step API flow. Different audiences, different purposes |
| Annotation pattern | Scroll-aware contextual callouts | Activates as visitor scrolls past relevant sections — makes the page feel like a guided walkthrough |
| SDK highlighting | Explicit division of responsibility | 5 of 8 sealing steps are client-side — the SDK's role must be visible and explained |

---

## Part 1: Developer Portal (`/dashboard`)

### Route & Layout

- **URL:** `/dashboard`
- **Layout:** Single page, vertically stacked sections. No tabs, no sidebar. Clean scroll matching landing page design language.
- **Design system:** Same "Technical Editorial" system — `#f12f00` primary, Space Grotesk + Inter, tonal layering, no shadows.
- **No authentication required.**

### Section A: Tenant Overview

Header card showing the demo context:

- **Organization:** Demo Corporation OÜ
- **Tenant ID:** `tenant-demo-corp-001`
- **Status:** Active
- **Credentials:** 3 (2 active, 1 suspended)

**Annotation:**
> "In the live service, this tenant is created during QTSP onboarding. An authorized representative with legal signing rights (esindusõigus) or power of attorney completes identity verification and due diligence. They then delegate API access to technical staff through this portal — with a full audit trail. This demo skips the legal onboarding and starts from the point where a developer has been granted access."

### Section B: API Credentials

**OAuth 2.0 Credentials:**
- `client_id` — displayed, copyable
- `client_secret` — "Generate" button. Shown once in a modal after generation (with copy button and "save now, won't be shown again" warning). Can regenerate (revokes old tokens).

**Annotation:**
> "OAuth 2.0 Client Credentials (RFC 6749 §4.4) authenticate your system to the e-seal API. In production, these are bound to the legal entity that completed onboarding. Rotating the secret immediately invalidates all active access tokens."

**SCAL2 PIN:**
- "Generate PIN" button. Shown once in a modal.

**Annotation:**
> "The PIN is the Sole Control Assurance Level 2 (SCAL2) component required by EN 419 241-1 for qualified electronic seals. Each signing operation requires explicit PIN-based authorization — this ensures the legal entity retains sole control over their signing keys, even though the keys are hosted remotely in the QTSP's HSM. The PIN is not a password — it's a cryptographic authorization factor."

### Section C: Seal Credentials (Certificates)

Table showing 3 pre-seeded certificates:

| Credential ID | Label | Key Algorithm | Hash | SCAL | Status |
|---|---|---|---|---|---|
| `cred-inv-001` | Invoice Sealing | RSA 2048 | SHA-256 | SCAL2 | Active |
| `cred-con-002` | Contract Sealing | RSA 2048 | SHA-256 | SCAL2 | Active |
| `cred-reg-003` | Regulatory Filings | RSA 2048 | SHA-256 | SCAL2 | Suspended |

Each row expandable to show: certificate subject, issuer, validity period, key algorithm, certificate fingerprint. The suspended credential demonstrates lifecycle states.

**Annotation:**
> "Each credential represents a seal certificate stored inside a certified HSM (QSCD). The private key never leaves the hardware — only the credential ID is exposed to your application. Large organizations typically maintain multiple active credentials for different business processes (invoicing, contracts, regulatory filings). In production, certificates are issued by the QTSP's Certificate Authority and can be suspended or revoked through this portal."

### Section D: Seal Playground

Interactive integration test area:

1. **Select credential** — dropdown populated from active credentials in Section C
2. **Upload PDF** — drag-and-drop zone
3. **Seal** — executes the full CSC v2 flow with the developer's generated credentials

**Visible step-by-step timeline** showing each API call with real request/response data:

```
Step 1: OAuth Token Exchange
  POST /oauth2/token
  client_id: tenant-demo-corp-001  →  Bearer eyJhbG...
  ✓ 200 OK (142ms)

Step 2: SCAL2 Credential Authorization
  POST /csc/v2/credentials/authorize
  credentialID: cred-inv-001, PIN: ****  →  SAD token (5 min TTL, single-use)
  ✓ 200 OK (89ms)

Step 3: Hash Signing
  POST /csc/v2/signatures/signHash
  SAD: eyJhbG..., hash: a7f3b9c1...  →  RSA signature (256 bytes)
  ✓ 200 OK (203ms)

Step 4: CMS Assembly + RFC 3161 Timestamp
  Building PKCS#7 SignedData... (client-side — SDK)
  Requesting qualified timestamp from TSA... (client-side — SDK)
  ✓ PAdES B-T signature complete

Step 5: PDF Injection
  Embedding signature into PDF placeholder... (client-side — SDK)
  ✓ Sealed PDF ready
```

Each step annotated. Steps 4-5 explicitly tagged as "client-side — SDK" to highlight the division of responsibility.

4. **Download** — the sealed PDF

**Playground annotation:**
> "This playground executes the exact same CSC v2 flow that a production integration would use. Steps 1-3 are API calls to the e-seal service. Steps 4-5 happen entirely on the client side — the Client SDK handles CMS assembly, RFC 3161 timestamping, and PDF injection. The API never sees the document; it only signs a 32-byte hash."

---

## Part 2: Landing Page Enrichment

### Annotation Pattern

Scroll-aware contextual callouts that activate/highlight as the visitor scrolls past relevant sections. Visually distinct from marketing copy — lighter tone, slightly smaller text, left-border accent or info icon. Consistent styling between landing page and portal. Functions as a guided tour layer that provides talking points for sales meetings.

### Section Changes

**Section 1: Navbar**
- Add "Developer Portal" link between "Try Demo" and "Documentation"

**Section 2: Hero**
- Add third CTA: "Open Developer Portal" → `/dashboard`
- Existing CTAs stay: "Try the Live Demo" + "Read the Documentation"

**Section 3: What is an E-Seal? (4 feature cards)**

Annotations on two cards:

- *Qualified Level:* "Qualified is the highest of three eIDAS levels (basic → advanced → qualified). It requires certified hardware (HSM), a Qualified Trust Service Provider, and conformity assessment by an EU-accredited body. This is what separates a qualified e-seal from a simple digital signature."

- *Hash-Only Privacy:* "This is a property of the CSC v2 protocol, not a policy choice. The API only accepts hashes — there is no endpoint that accepts documents. Privacy is architecturally enforced, not contractually promised."

**Section 5: Who Is This For? (customer segments)**

- *Banks & Financial Institutions:* "Current e-seal customers in this segment process hundreds of thousands of seals per month. The move from physical crypto sticks to remote API-based sealing eliminates courier logistics, RA officer overhead, and manual key ceremonies."

- *E-Signature Brokers:* "In the broker model, the seal certificate belongs to the end-entity (the small company), not the broker. The broker facilitates access but the identity chain to the legal entity must be preserved. This is architecturally supported through per-tenant credentials."

**Section 6: How It Works (technical flow)**

Annotations on API-side steps:

- *Step 3 (Authenticate):* "OAuth 2.0 Client Credentials flow. Credentials are issued through the Developer Portal after QTSP onboarding. The authorized representative delegates API access to the technical team."

- *Step 4 (Authorize — SCAL2):* "This step is what makes it 'qualified.' The PIN ensures the legal entity retains sole control of the signing key, even though the key is hosted remotely in the QTSP's HSM. Required by EN 419 241-1."

- *Step 5 (Sign hash):* "The private key never leaves the HSM. The hash enters, the signature comes out. The API cannot export, copy, or extract the key — this is enforced by the QSCD hardware certification."

**SDK responsibility callout** (new, below the existing callout box):
> "Steps 1-2 and 7-10 execute on your infrastructure — the API never sees the document. The Client SDK handles PDF preparation, hash computation, CMS assembly, timestamping, and injection. Without it, your team would need to implement PAdES B-T compliant CMS construction, RFC 3161 timestamping, and PDF signature embedding from scratch. Whether the production service includes an official SDK is a product decision — this prototype includes a fully working one."

**Section 7: Live Demo**
- Add one line after existing disclaimer: "Want to see the full API flow with your own credentials? Open the Developer Portal."

**Section 8: Developer Experience**
- Above/below code snippet: "Get these values from the Developer Portal — generate credentials, pick a seal certificate, and you're ready to integrate."
- Add fourth card to grid: **Developer Portal** — "Get API credentials, manage seal certificates, test the full CSC v2 integration flow step by step."

**Section 11: Documentation & Resources — Developer Tools**
- Add Developer Portal as **first card** in Developer Tools grid, above Swagger UI

**Section 12: CTA Banner**
- Change "Try the Demo" → "Open Developer Portal"
- Keep "Contact Sales"

### Sections Unchanged
- Section 4 (eIDAS Qualified) — already educational
- Section 9 (Pricing) — placeholder, leave as-is
- Section 10 (Compliance & Standards) — already thorough

---

## Part 3: Database & Backend Changes

### Seed Script Updates

The current `scripts/seed.ts` creates 1 tenant with 1 credential. Updated seed:

- **1 tenant:** "Demo Corporation OÜ" (`tenant-demo-corp-001`)
- **3 credentials:**
  - `cred-inv-001` — "Invoice Sealing" (Active)
  - `cred-con-002` — "Contract Sealing" (Active)
  - `cred-reg-003` — "Regulatory Filings" (Suspended)
- Each credential gets its own RSA 2048 keypair and self-signed X.509 certificate
- The existing demo env vars (`DEMO_CLIENT_ID`, etc.) continue to work for the landing page demo — unchanged

### New API Routes (Portal Backend)

```
GET  /api/dashboard/tenant          → tenant overview (name, status, credential count)
GET  /api/dashboard/credentials     → list seal credentials for tenant
POST /api/dashboard/oauth/generate  → generate new client_secret (hash+store, return plaintext once)
POST /api/dashboard/pin/generate    → generate new PIN (hash+store, return plaintext once)
POST /api/dashboard/seal            → playground seal endpoint (same as /api/demo/seal but uses developer's generated credentials, returns step-by-step SSE with request/response details)
```

### Schema Changes

No new tables needed. The existing `tenants` + `credentials` tables already support everything. The seed script just needs to create more rows.

One consideration: the current schema stores `client_secret_hash` and `pin_hash` on the `tenants` table. When the portal regenerates these, it updates the same row. The landing page demo uses its own hardcoded env vars for the `/api/demo/seal` route, so regeneration in the portal does not break the landing page demo.

---

## Part 4: Technical Implementation Notes

### Alkoholiks API Pattern Reuse

The portal credential management (generate/regenerate/display) follows the exact pattern from `alkoholiks-api/src/app/api/dashboard/credentials/route.ts`:
- `crypto.randomBytes(32).toString('hex')` for secrets
- `bcrypt.hash(secret, 12)` for storage
- Show plaintext once in modal, never again
- Regenerate = generate new + update hash in DB

**Differences from Alkoholiks:**
- No Clerk auth (open access)
- Additional PIN generation (same generate-hash-show-once pattern)
- Multiple seal credentials displayed (read-only, pre-seeded)
- Playground with step-by-step API flow visibility

### Scroll-Aware Annotations

Implementation approach: CSS `position: sticky` for annotation sidebar elements, or Intersection Observer API to highlight/reveal annotations as their associated content enters the viewport. The exact visual treatment (left-border callout, floating sidebar, inline expandable) will be determined during frontend implementation — the content is defined in this document.

### SDK Responsibility in Playground

The playground's step-by-step display must clearly distinguish:
- **API calls** (Steps 1-3): show request URL, method, key parameters, response status + timing
- **Client-side operations** (Steps 4-5): show what the SDK is doing, explicitly tagged as happening on the client side

This reinforces the architectural message: the API is a signing oracle, the SDK does everything else.

---

## Success Criteria

1. A visitor can land on the landing page, understand the service, scroll through with educational context, and navigate to the portal
2. In the portal, they can generate OAuth credentials and a PIN, view multiple seal certificates, and use the playground to seal a PDF — seeing every API step with real request/response data
3. The annotations across both pages provide enough context that a sales person can walk a bank's technical team through the entire demo without additional slides
4. The division of responsibility between API and SDK is clear and visible
5. Everything is grounded in CSC v2 / eIDAS / EN 419 241-1 reality — no made-up concepts

---

*Design based on: Meeting Memo (31 Mar 2026), Brainstorming transcript, existing prototype analysis, Alkoholiks API developer portal pattern.*
