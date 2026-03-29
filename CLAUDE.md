# Qualified E-Seal by SK ID

## Project Context
CSC v2 compliant remote e-sealing prototype. Full scope in SCOPE.md.

## Key Technical Notes
- CSC v2 spec (100 pages) has been fully extracted and analyzed. Key sections: 8.5 (e-seal auth), 11 (API definitions)
- CMS signing gotcha: for PAdES, sign the DER-encoded SignedAttributes hash, NOT the raw PDF hash (node-signpdf issue #46)
- SCAL2 confirmed required by Raul (ET/regulatory). Means credentials/authorize endpoint with PIN -> SAD is mandatory.
- node-forge is the Swiss Army knife: X.509, PKCS#7/CMS, RSA, cert chains
- No open-source CSC v2 server exists anywhere. This would be the first.

## Conventions
- Next.js App Router (same as alkoholiks-api)
- TypeScript strict mode
- CSC v2 endpoint paths: `/csc/v2/*` (info, credentials/*, signatures/*)
- OAuth endpoint: `/oauth2/token`

## Reference Repos (study, don't copy)
- `simionrobert/cloud-signature-consortium` — Node.js CSC v1 server (MIT)
- `vbuch/node-signpdf` — PDF signing (MIT)
- `Xevolab/node-signpdf-pades` — PAdES Baseline B (MIT)

## Design Philosophy
- **No corners cut.** Build toward the real thing. Every piece upgradeable to production via config/cert swap, not rewrite.
- Client SDK is a **separate package** (`/packages/client-sdk/`) — own package.json, tests, README.
- PAdES B-T (with timestamp) from day one.
- Per-tenant PINs, hashed, configurable via API. No hardcoded shortcuts.
- Documentation is educational reference quality — inline spec references, architecture docs, developer guides.

## ⚠️ Landing Page — MANDATORY STOP
Before building the landing page, **STOP and ask user for SK branding/styling guidance**.
Do NOT use generic styling or guess SK brand colors. Wait for explicit direction from the user.

## SK Initiative Source Docs
All in `G:\My Drive\SK_RE\Remote_e_seal\Kickoff\` — read SCOPE.md Section 11 for full index.
