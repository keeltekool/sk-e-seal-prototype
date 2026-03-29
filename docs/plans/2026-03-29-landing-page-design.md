# Landing Page Design — Remote Qualified E-Seal by SK ID Solutions

> **Status:** Approved
> **Date:** 2026-03-29
> **Branding:** Follow `Landing_page/design_and_build_assets_/DESIGN.md` exactly (Technical Editorial, no borders, tonal layering, Space Grotesk + Inter, primary `#b32000` / `#f12f00`, surface `#fbf9f7`)
> **Reference:** `Landing_page/design_and_build_assets_/code.html` + `screen.png`
> **Favicon:** `Landing_page/favicon.png`

---

## Section 1: NAVBAR

- SK ID Solutions logo (orange `#f12f00`, Space Grotesk, font-black)
- Links: Service | How It Works | For Developers | Try Demo | Documentation
- CTA button: "Contact Sales" (primary pill)
- Sticky top, glass blur bg (`bg-white/90 backdrop-blur-md`)

---

## Section 2: HERO (surface `#fbf9f7`)

**Label:** `REMOTE QUALIFIED E-SEAL` (uppercase, tracking-widest, primary color, Inter)

**Headline (Space Grotesk, 3.5rem):**
> Remote Qualified E-Sealing. API-first. Privacy by design.

**Sub-headline (Inter, secondary, lg):**
> Apply eIDAS Qualified electronic seals to millions of documents — without a single one ever leaving your infrastructure. The most complete remote e-sealing solution on the market.

**CTAs:**
- Primary (orange pill): "Try the Live Demo" → scrolls to demo section
- Secondary (grey pill): "Read the Documentation" → scrolls to portal section

**Floating stat card (bottom-left):**
- `32 bytes` — "Only a hash crosses the network"

---

## Section 3: WHAT IS AN E-SEAL? (surface-container-low `#f6f3f1`)

**Label:** `THE BASICS`
**Headline:** `Electronic seals — the digital equivalent of a company stamp.`

**Body:**
> An electronic seal proves that a document was issued by a specific legal entity and has not been altered since. Unlike electronic signatures (which represent a person), e-seals represent an **organization**. They are the digital equivalent of a company rubber stamp — but cryptographically verifiable and legally binding across the entire EU under the eIDAS regulation.

**Four cards (white `#ffffff`, no borders, rounded-xl, hover → surface-container-high):**

| Icon | Title | Copy |
|------|-------|------|
| `verified_user` | **Qualified Level** | Highest legal assurance under eIDAS. Non-repudiable proof of origin and integrity. |
| `lock` | **Hash-Only Privacy** | Your documents never leave your infrastructure. We only receive a 32-byte hash — we cannot see, read, or store your content. |
| `speed` | **API-First** | One API call to seal. Full CSC v2 compliance. TypeScript SDK included. Seal thousands of documents per minute. |
| `schedule` | **Timestamp Included** | Every seal includes an RFC 3161 qualified timestamp — cryptographic proof of exactly when the document was sealed. PAdES B-T from day one. |

---

## Section 4: eIDAS QUALIFIED (surface `#fbf9f7`)

**Label:** `LEGAL ASSURANCE`

**Headline:**
> The highest legal standard for electronic seals in Europe.

**Sub-headline:**
> Qualified under eIDAS. Trusted by law across the EU.

**Body:**
> Electronic seals come in three levels under eIDAS: basic, advanced, and **qualified**. Qualified is the highest — carrying full legal equivalence to a handwritten signature across all 27 EU member states. Documents sealed at this level are **presumed authentic and unaltered** by law. The burden of proof shifts to anyone who challenges the seal.
>
> Most regulations don't mandate qualified level today. But regulations evolve, disputes happen, and cross-border requirements tighten. Organizations that seal at qualified level now never have to worry about whether their seals will hold up — in any jurisdiction, in any court, in any future scenario. That certainty is the value.

**Three supporting points (icon + text rows):**

| Icon | Point |
|------|-------|
| `gavel` | **Legal equivalence** — Qualified e-seals enjoy automatic legal recognition across the entire EU. No bilateral agreements. No per-country validation. One seal, 27 member states. |
| `shield` | **Certified infrastructure** — Requires a Qualified Signature Creation Device (QSCD), certified Trust Service Provider status, and conformity assessment. This is hard — by design. |
| `workspace_premium` | **Highest confidence** — When your bank statement, invoice, or regulatory filing carries a qualified e-seal, recipients know it's authentic. Not because they trust you — because EU law says so. |

---

## Section 5: WHO IS THIS FOR? (surface-container-low `#f6f3f1`)

**Label:** `CUSTOMER SEGMENTS`
**Headline:** `Built for organizations that seal at scale.`

**Three columns:**

**Column 1 — Direct API Clients**
> **Banks & Financial Institutions**
> Seal account statements, loan agreements, regulatory filings, and compliance documents. Integrate directly via the CSC v2 API for full control. Ideal for organizations with in-house development teams that need maximum throughput and customization.

**Column 2 — Platforms & SaaS**
> **Document Management & ERP Platforms**
> Embed e-sealing into your product. Your customers seal documents through your interface while the cryptographic operations happen via our API. White-label ready. SDK handles the complexity — your developers call `client.seal(pdf)` and get back a sealed document.

**Column 3 — Brokers & Trust Service Providers**
> **E-Signature Brokers & Integrators**
> Offer qualified e-sealing as part of your trust service portfolio. Multi-tenant architecture supports per-customer credentials and audit trails. CSC v2 standard means your existing integrations work — if you speak CSC, you speak our API.

---

## Section 6: HOW IT WORKS (surface `#fbf9f7`)

**Label:** `TECHNICAL FLOW`
**Headline:** `The hash-only model — privacy by architecture.`

**Visual flow diagram (styled):**

```
YOUR INFRASTRUCTURE                          SK E-SEAL API
─────────────────────                        ──────────────
1. Load document
2. Compute SHA-256 hash (32 bytes)
                                    ──→  3. Authenticate (OAuth 2.0)
                                    ──→  4. Authorize credential (SCAL2)
                                    ──→  5. Sign the hash (RSA 2048)
                                    ←──  6. Return raw signature
7. Build CMS SignedData
8. Add RFC 3161 timestamp
9. Embed in document
10. Output: Qualified sealed PDF
```

**Callout box (primary left border, white bg):**
> **The document never crosses the boundary.** Only a 32-byte SHA-256 hash is transmitted. Your infrastructure computes the hash locally, sends it to the API, receives back a cryptographic signature, and assembles the final sealed document. We never see the content. This is not a policy choice — it's how the CSC v2 protocol works by design.

---

## Section 7: LIVE DEMO (surface-container-low `#f6f3f1`)

**Label:** `INTERACTIVE DEMO`
**Headline:** `Seal a PDF right now. Watch every step.`
**Subtext:** `Upload any PDF document. Watch the 8-step sealing process execute in real-time — authentication, credential authorization, hash signing, CMS assembly, timestamping. Download your sealed PDF when it's done.`

**Demo component:**
- Drag-and-drop upload zone (PDF only, max size validation)
- SSE Process X-Ray: real-time step-by-step visualization
  - Each step: checkmark animation, step name, duration in ms
  - Each step expandable → code snippet, actual values (hash preview, token preview, cert subject), CSC v2 spec section reference
- Download button activates after completion
- File size delta (original → sealed)
- Total elapsed time

**Disclaimer:**
> *This demo uses a self-signed test certificate. In production, documents are sealed with SK's qualified certificate — validated by Adobe Acrobat and DigiDoc4.*

---

## Section 8: DEVELOPER EXPERIENCE (surface `#fbf9f7`)

**Label:** `FOR DEVELOPERS`
**Headline:** `From zero to sealed PDF in 5 minutes.`

**Code block (dark bg, syntax highlighted):**
```typescript
import { SealClient } from '@sk-eseal/client-sdk';

const client = new SealClient({
  baseUrl: 'https://eseal.sk.ee',
  clientId: 'your-tenant-id',
  clientSecret: 'your-secret',
  pin: 'your-pin',
  credentialId: 'your-credential-id',
});

const result = await client.seal(pdfBytes);
// result.sealedPdf → Uint8Array (sealed PDF with PAdES B-T signature)
```

**Three feature cards:**

| Icon | Title | Copy |
|------|-------|------|
| `code` | **TypeScript SDK** | 8 modules, 23 tests. `npm install @sk-eseal/client-sdk`. Handles PDF preparation, hash computation, CMS assembly, timestamping — everything except the signing itself. |
| `description` | **OpenAPI 3.1 Spec** | Full machine-readable API definition. Import into Postman, generate clients in any language. Interactive Swagger UI included. |
| `terminal` | **CLI Demo** | `npx tsx seal-demo.ts invoice.pdf` → sealed PDF in seconds. Inspect every step of the flow. |

---

## Section 9: PRICING (surface-container-low `#f6f3f1`)

**Label:** `PRICING`
**Headline:** `Transparent pricing for every scale.`

**STATUS: WIP — placeholder only, no real numbers.**

Three pricing tier cards with lorem ipsum content. Clearly styled as coming soon / under development. No numbers, no commitments.

---

## Section 10: COMPLIANCE & STANDARDS (surface `#fbf9f7`)

**Label:** `COMPLIANCE`
**Headline:** `Built on open standards. Validated by regulation.`

**Two-column layout:**

**Left — Standards (sticky):**
- **CSC v2.0.0.2** — Cloud Signature Consortium API standard (all 6 endpoints)
- **eIDAS** — EU Regulation 910/2014 on electronic identification and trust services
- **PAdES B-T** — ETSI EN 319 142 (PDF Advanced Electronic Signatures with timestamp)
- **RFC 5652** — Cryptographic Message Syntax (CMS/PKCS#7)
- **RFC 3161** — Time-Stamp Protocol
- **RFC 6749** — OAuth 2.0 Authorization Framework
- **SCAL2** — Sole Control Assurance Level 2 (qualified authorization)

**Right — What this means:**
> Every signature produced by this service is a **PAdES Baseline-T** signature — containing a qualified timestamp proving when the seal was applied. The CMS structure validates in Adobe Acrobat, DigiDoc4, and the EU DSS validation library.
>
> The SCAL2 authorization model means each sealing operation requires explicit credential authorization — not just an access token. This is the level required for qualified electronic seals under eIDAS.
>
> The hash-only architecture ensures full **GDPR compliance** — your document content never enters our infrastructure.

---

## Section 11: PROJECT DELIVERABLES — PORTAL (surface-container-low `#f6f3f1`)

**Label:** `DOCUMENTATION & RESOURCES`
**Headline:** `Everything built. Everything accessible.`

**Documentation cards (grid):**

| Link | Description |
|------|-------------|
| **Architecture** → `docs/architecture.md` | Component diagram, data flow, design decisions, database schema |
| **CSC v2 Mapping** → `docs/csc-v2-mapping.md` | Every CSC v2 spec section mapped to exact file and line number |
| **Prototype vs Production** → `docs/prototype-vs-production.md` | What's real, what's simplified, full upgrade path to production |
| **Seal Your First PDF** → `docs/guides/seal-first-pdf.md` | Step-by-step quickstart guide — clone to sealed PDF |
| **Certificate Swap Guide** → `docs/guides/certificate-swap.md` | How to replace the test cert with a real SK .p12 certificate |
| **OpenAPI Specification** → `public/openapi.yaml` | Machine-readable API definition (OpenAPI 3.1) |
| **Swagger UI** → `/docs` | Interactive API explorer — test every endpoint in the browser |
| **Client SDK** → `packages/client-sdk/` | Standalone TypeScript SDK — 8 modules, 23 tests, npm-ready |
| **CLI Demo** → `scripts/seal-demo.ts` | End-to-end sealing from the command line |
| **GitHub Repository** → `https://github.com/keeltekool/sk-e-seal-prototype` | Full source code — MIT licensed |

**SK Initiative Documents (external links):**

| Link | Description |
|------|-------------|
| Business Requirements v3 | 10 requirements, pricing tiers, success criteria |
| Technical Requirements v3 | CSC v2 endpoints, SCAL levels, architecture |
| Initiative Integration Doc | 12 deliverables, dependency graph, Go/No-Go criteria |
| Market Validation Master | Full market analysis, competitor mapping |
| CSC v2 Specification (PDF) | The 100-page standard this prototype implements |

---

## Section 12: CTA BANNER (primary `#b32000` bg, dot pattern overlay)

**Headline (white, 3rem):**
> Ready to add qualified e-sealing to your platform?

**Subtext (white/80%):**
> Whether you're a bank sealing millions of statements, a platform embedding trust services, or a broker expanding your portfolio — we built this for you.

**CTAs:**
- White pill: "Contact Sales"
- Transparent bordered pill: "Try the Demo"

---

## Section 13: FOOTER (surface, top border `outline-variant/10`)

Four columns (matching reference code.html pattern):
- **SK ID Solutions** — brand logo + description + social icons
- **Service** — Remote E-Seal, Smart-ID, Mobile-ID, Trust Services
- **Developers** — API Docs, SDK, OpenAPI Spec, GitHub
- **Legal** — Privacy Policy, Terms of Service, Security

Bottom bar: `© 2026 SK ID Solutions AS` | `EU Trust List` | `ISO/IEC 27001`

---

## Implementation Notes

- **Branding source of truth:** `Landing_page/design_and_build_assets_/DESIGN.md`
- **No borders.** Use tonal layering (surface shifts) per the "No-Line" rule
- **No drop shadows.** Tonal elevation only. Exception: floating elements get diffused ambient shadows
- **Fonts:** Space Grotesk (headlines), Inter (body/labels)
- **Colors:** Primary `#b32000`/`#f12f00`, surface `#fbf9f7`, secondary `#5f5e5d`, full token set in code.html Tailwind config
- **Favicon:** `Landing_page/favicon.png`
- **Editorial hierarchy:** Bold uppercase label (primary) above headline — used consistently across all sections
- **Asymmetric spacing:** Larger top margins than bottom per design system
- **Demo integration:** SSE-based Process X-Ray connected to real Client SDK via `/api/demo/seal` route
- **Portal section:** All links must work — relative paths for project docs, absolute for external
