# Qualified E-Seal by SK ID — Build Plan & Design

> **Created:** 2026-03-29
> **Status:** Approved — ready for implementation
> **Service name:** Qualified E-Seal by SK ID
> **Approach:** API-First (Layer 1 → 2 → 3 → 4)

---

## Architecture

Four layers, built in order. Each layer is independently testable before the next begins.

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 4: Landing Page + Live Demo (LAST)               │
│  SK-branded marketing site, upload demo with SSE         │
│  process X-ray, expandable code/spec references          │
├─────────────────────────────────────────────────────────┤
│  LAYER 3: Documentation                                  │
│  OpenAPI 3.1 + Swagger UI, architecture docs,            │
│  CSC v2 mapping, developer guides                        │
├─────────────────────────────────────────────────────────┤
│  LAYER 2: Client SDK  (/packages/client-sdk/)            │
│  Separate package — own package.json, tests, README.     │
│  Zero coupling to API server internals.                  │
│  PDF prep → hash → API calls → CMS → PAdES → timestamp. │
│  onStep callback for process observability.              │
├─────────────────────────────────────────────────────────┤
│  LAYER 1: CSC v2 API Server                              │
│  6 endpoints, OAuth2 Client Credentials, SCAL2,          │
│  software key store, Neon DB                             │
└─────────────────────────────────────────────────────────┘
```

## Monorepo Structure

Same git repo, independent packages. SDK has zero dependency on API server internals.

```
sk-e-seal-prototype/
├── src/app/                    # Next.js — API routes + landing page
│   ├── api/
│   │   ├── csc/v2/             # CSC v2 endpoints
│   │   │   ├── info/
│   │   │   ├── credentials/
│   │   │   │   ├── list/
│   │   │   │   ├── info/
│   │   │   │   └── authorize/
│   │   │   └── signatures/
│   │   │       └── signHash/
│   │   ├── oauth2/             # Token endpoint
│   │   │   └── token/
│   │   └── demo/               # Landing page demo (SSE seal route)
│   │       └── seal/
│   └── (landing)/              # Landing page UI
├── packages/
│   └── client-sdk/             # SEPARATE PACKAGE
│       ├── package.json        # Own dependencies, own version
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts        # Public API
│       │   ├── pdf.ts          # PDF prep, placeholder, byte ranges
│       │   ├── hash.ts         # SHA-256, SignedAttributes
│       │   ├── api.ts          # CSC v2 API client (token, authorize, signHash)
│       │   ├── cms.ts          # CMS SignedData assembly
│       │   ├── timestamp.ts    # RFC 3161 TSA client
│       │   └── types.ts        # Shared types
│       ├── tests/
│       └── README.md           # Standalone SDK documentation
├── scripts/
│   └── seal-demo.ts            # CLI demo using client-sdk
├── docs/
│   ├── plans/
│   ├── architecture.md
│   ├── csc-v2-mapping.md
│   └── guides/
│       ├── seal-first-pdf.md
│       └── certificate-swap.md
├── openapi.yaml                # OpenAPI 3.1 spec
└── README.md                   # Project overview
```

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build order | API-first | Each layer testable independently. Matches real service build order. |
| SDK location | `/packages/client-sdk/` — same repo, separate package | Own package.json, publishable to npm. Zero coupling to API internals. |
| PAdES level | B-T (with RFC 3161 timestamp) from day one | No point shipping signatures without time proof. One HTTP call to FreeTSA. |
| Test certificate | Self-signed, generated at first startup | Designed for drop-in replacement with real SK cert. Zero code changes needed. |
| PIN management | Per-tenant, hashed in DB, configurable via API | Production-grade from the start. No hardcoded shortcuts. |
| Landing page demo | Server-side SDK execution, SSE streaming to browser | Real process, real timing. Upload PDF → watch steps live → download sealed PDF. |
| Demo under-the-hood | Expandable step details with code snippets + spec references | Educational value. Colleagues see exactly how CSC v2 works. |
| Landing page timing | LAST — requires user's SK branding guidance first | Mandatory stop before building. |

## No Corners Cut — Design Philosophy

Every architectural decision is made so the prototype evolves toward production through incremental upgrades, not rewrites:

- Swap in real SK certificate (.p12) → config change, not rebuild
- Connect to real HSM → replace software key store, API stays identical
- Add real CA infrastructure → extend credential store, endpoints unchanged
- Publish SDK to npm → already structured as independent package
- Scale to multi-tenant → DB schema already supports it

---

## Phase A: Foundation (API Server Core)

| # | Task | Deliverable |
|---|------|-------------|
| A1 | Next.js project scaffold, TypeScript strict, Tailwind, monorepo with `/packages/client-sdk/` stub | Project structure |
| A2 | Neon DB setup — tenants, credentials, audit_log tables | Schema + migration script |
| A3 | `POST /oauth2/token` — Client Credentials flow | Working token endpoint |
| A4 | Auth middleware — Bearer token validation on all `/csc/v2/*` routes | Protected routes |
| A5 | Test certificate generation — RSA 2048 keypair + self-signed X.509 cert, stored in Neon | Seed script |

### Checkpoint A — Verification

- [ ] `curl POST /oauth2/token` with valid client_id/secret → access token returned
- [ ] `curl POST /oauth2/token` with invalid credentials → 401
- [ ] DB has tenant + credential rows with encrypted private key
- [ ] Certificate is valid X.509 (`openssl x509 -text` inspection)
- [ ] Monorepo structure in place, both packages buildable

---

## Phase B: CSC v2 Endpoints

| # | Task | Deliverable |
|---|------|-------------|
| B1 | `POST /csc/v2/info` — service metadata, capabilities, algorithms | Spec-compliant response |
| B2 | `POST /csc/v2/credentials/list` — list credentials for tenant | Filtered by auth |
| B3 | `POST /csc/v2/credentials/info` — cert chain, key algo, SCAL, auth mode | Full credential detail |
| B4 | `POST /csc/v2/credentials/authorize` — PIN → SAD (JWT, hash-bound) | SCAL2 flow |
| B5 | `POST /csc/v2/signatures/signHash` — validate SAD, sign hash | Raw RSA signature |
| B6 | OpenAPI 3.1 spec + Swagger UI at `/docs` | API documentation |

### Checkpoint B — Verification

- [ ] Full curl flow: token → list → info → authorize(PIN + hash) → signHash(SAD + hash) → raw signature
- [ ] SAD is JWT, bound to specific hash values, single-use, expires
- [ ] Invalid PIN → 401. Expired/reused SAD → 400. Wrong credential → 403.
- [ ] Swagger UI loads with all 6 endpoints, request/response schemas
- [ ] Every response matches CSC v2.0.0.2 spec field names and types

---

## Phase C: Client SDK

| # | Task | Deliverable |
|---|------|-------------|
| C1 | Package scaffold — `/packages/client-sdk/`, own package.json, TypeScript config | Buildable package |
| C2 | PDF preparation — load PDF, add signature placeholder with pdf-lib | Byte ranges computed |
| C3 | Hash computation — SHA-256 of byte ranges, build CMS SignedAttributes, hash those | Correct `attrsHash` |
| C4 | API integration — typed client for token, authorize, signHash | API client module |
| C5 | CMS assembly — build CMS SignedData with signature + cert chain | Valid PKCS#7 container |
| C6 | RFC 3161 timestamp — call FreeTSA, embed in CMS (PAdES B-T) | Timestamped signature |
| C7 | PDF finalization — inject CMS into placeholder, output sealed PDF | Sealed PDF |
| C8 | `onStep` callback — emit structured step events (name, duration, data) | Observable sealing process |
| C9 | SDK README — installation, usage, API reference | Developer documentation |

### Checkpoint C — Verification

- [ ] `node scripts/seal-demo.ts sample.pdf` → produces `sample-sealed.pdf`
- [ ] Open in Adobe Acrobat → signature visible (self-signed = "unknown signer" but valid structure)
- [ ] Signature includes RFC 3161 timestamp from FreeTSA
- [ ] `onStep` fires for every step with correct data
- [ ] SDK importable as standalone package — no dependency on Next.js app internals
- [ ] SDK tests pass independently (`cd packages/client-sdk && npm test`)

---

## Phase D: Documentation

| # | Task | Deliverable |
|---|------|-------------|
| D1 | `docs/architecture.md` — component diagram, data flow, decisions | Architecture reference |
| D2 | `docs/csc-v2-mapping.md` — spec section → code file/function mapping | Spec traceability |
| D3 | `docs/guides/seal-first-pdf.md` — step-by-step tutorial | Developer onboarding |
| D4 | `docs/guides/certificate-swap.md` — how to plug in real SK cert | Upgrade path doc |
| D5 | `README.md` — project overview, quick start, architecture | Cold-start readable |
| D6 | Inline code comments — every endpoint/SDK function → CSC spec section | Educational codebase |

### Checkpoint D — Verification

- [ ] Colleague can read README → understand the project → run CLI demo in under 5 minutes
- [ ] Every CSC v2 endpoint traceable to spec section via csc-v2-mapping.md
- [ ] Architecture doc matches actual code structure
- [ ] Certificate swap guide is accurate and tested

---

## Phase E: Landing Page + Live Demo (LAST)

**⚠️ MANDATORY STOP before E1: Ask user for SK branding/styling guidance. Do NOT proceed with generic styling.**

| # | Task | Deliverable |
|---|------|-------------|
| E0 | **STOP — Get SK branding direction from user** | Branding guidance |
| E1 | Landing page — hero, value prop, how it works, use cases, pricing, compliance | Marketing site |
| E2 | Upload demo UI — drag-and-drop PDF upload | Upload component |
| E3 | SSE process X-ray — real-time step stream during sealing | Live step visualization |
| E4 | Expandable step details — code snippets, values, spec references | Under-the-hood view |
| E5 | Sealed PDF download | Download button |
| E6 | Responsive design + visual polish | Production-quality page |

### Checkpoint E — Verification

- [ ] Landing page loads — professional SK-branded marketing site
- [ ] Upload PDF → steps appear in real-time via SSE (not fake animation)
- [ ] Each step expandable → code snippet, actual values, CSC spec reference
- [ ] Download sealed PDF → identical result to CLI demo
- [ ] Mobile responsive, no console errors, no layout breaks
- [ ] Process X-ray shows real timing and real data

---

## Summary

| Phase | Tasks | Focus | Test Method |
|-------|-------|-------|-------------|
| A | 5 | Foundation — scaffold, DB, auth, cert | curl + DB inspection |
| B | 6 | CSC v2 API — all 6 endpoints | curl flow + Swagger UI |
| C | 9 | Client SDK — full seal loop | CLI demo + Adobe verification |
| D | 6 | Documentation — educational reference | Colleague cold-start test |
| E | 6 (+stop) | Landing page — marketing + live demo | Browser E2E test |
| **Total** | **32 + 1 stop** | | |

**Service name:** Qualified E-Seal by SK ID
**Build principle:** No corners cut. Every piece upgradeable to production via config/cert swap, not rewrite.
