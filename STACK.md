# E-Seal Prototype — STACK.md

> CSC v2 compliant remote e-sealing service prototype.
> Last updated: 2026-03-31

## Services

| Service | Purpose | Env Var(s) |
|---------|---------|------------|
| Neon PostgreSQL | Tenants, credentials, audit log, SAD tokens | `DATABASE_URL` |
| Sectigo Qualified TSA | RFC 3161 timestamps (EU Trusted List, QTSA) | *(hardcoded default, configurable via `tsaUrl`)* |
| Vercel | Hosting + serverless API routes | *(auto)* |

Env vars stored in: Vercel (6 vars), `.env.local` (local dev)

Additional env vars: `JWT_SECRET`, `DEMO_CLIENT_ID`, `DEMO_CLIENT_SECRET`, `DEMO_PIN`, `DEMO_CREDENTIAL_ID`

## Brand

Primary: `#f12f00` (orange-red), Surface: `#fbf9f7`, On-surface: `#1b1c1b`
Fonts: Space Grotesk (headlines), Inter (body)
Design system: "Technical Editorial" — tonal layering, no shadows, no borders

## Gotchas

| Issue | Fix |
|-------|-----|
| `@signpdf/*` deps not found on Vercel | Hoist to root `package.json` — Vercel doesn't install sub-package deps |
| CMS signing: must sign SignedAttributes hash, NOT raw PDF hash | `hash.ts` builds DER SignedAttributes with pdfHash as messageDigest, then hashes that |
| `Buffer` not assignable to `BodyInit` in timestamp.ts | Wrap with `new Uint8Array(buffer)` for fetch body |
| CMS serial number overflow (32-bit) | Use `forge.util.hexToBytes()` directly, not `parseInt + integerToDer` |
| SSE stream: final event lost in buffer | Process remaining buffer after `done === true` loop exit |
| Vercel env vars get trailing newline | Use `echo -n "value"` not `echo "value"` when adding via CLI |
| EU DSS shows PKCS7-T not PAdES | Must use SubFilter `ETSI.CAdES.detached` + ESS `signing-certificate-v2` attribute |

## EU DSS Validation Status

| Check | Result |
|-------|--------|
| Signature format | PAdES-BES |
| Timestamp (QTSA) | PASSED — Sectigo Qualified (EU Trusted List) |
| ESS signing-certificate-v2 | Present |
| SubFilter | ETSI.CAdES.detached |
| Signing cert | INDETERMINATE — self-signed (cert swap → TOTAL_PASSED) |

## Deployment

```bash
npm run dev                              # local dev (port 3000)
npx vercel --prod                        # production deploy
npx tsx scripts/migrate.ts               # run DB schema
npx tsx scripts/seed.ts                  # create demo tenant
npx tsx scripts/seal-demo.ts FILE.pdf    # CLI seal test
```

## Post-Deploy Smoke Tests

1. Load landing page — hero, navbar, sections render with branding
2. Scroll to demo — upload a PDF, watch Process X-Ray steps stream
3. Download sealed PDF — verify file downloads
4. Upload sealed PDF to EU DSS validator — check PAdES-BES format, QTSA timestamp PASSED
5. Open `/docs` — Swagger UI loads with all 6 endpoints
6. Check console — no JS errors
