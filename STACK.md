# SK E-Seal Prototype — STACK.md

> CSC v2 compliant remote e-sealing service prototype for SK ID Solutions initiative.
> Last updated: 2026-03-29

## Services

| Service | Purpose | Env Var(s) |
|---------|---------|------------|
| Neon PostgreSQL | Tenants, credentials, audit log, SAD tokens | `DATABASE_URL` |
| FreeTSA.org | RFC 3161 timestamps (PAdES B-T) | *(hardcoded default, configurable via `tsaUrl`)* |
| Vercel | Hosting + serverless API routes | *(auto)* |

Env vars stored in: Vercel (6 vars), `.env.local` (local dev)

Additional env vars: `JWT_SECRET`, `DEMO_CLIENT_ID`, `DEMO_CLIENT_SECRET`, `DEMO_PIN`, `DEMO_CREDENTIAL_ID`

## Brand

Primary: `#f12f00` (SK orange-red), Surface: `#fbf9f7`, On-surface: `#1b1c1b`
Fonts: Space Grotesk (headlines), Inter (body)
Design system: SK "Technical Editorial" — tonal layering, no shadows, no borders

## Gotchas

| Issue | Fix |
|-------|-----|
| `@signpdf/*` deps not found on Vercel | Hoist to root `package.json` — Vercel doesn't install sub-package deps |
| CMS signing: must sign SignedAttributes hash, NOT raw PDF hash | `hash.ts` builds DER SignedAttributes with pdfHash as messageDigest, then hashes that |
| `Buffer` not assignable to `BodyInit` in timestamp.ts | Wrap with `new Uint8Array(buffer)` for fetch body |

## Deployment

```bash
npm run dev                              # local dev (port 3000)
npx vercel --prod                        # production deploy
npx tsx scripts/migrate.ts               # run DB schema
npx tsx scripts/seed.ts                  # create demo tenant
npx tsx scripts/seal-demo.ts FILE.pdf    # CLI seal test
```

## Post-Deploy Smoke Tests

1. Load landing page — hero, navbar, sections render with SK branding
2. Scroll to demo — upload a PDF, watch Process X-Ray steps stream
3. Download sealed PDF — verify file downloads
4. Open `/docs` — Swagger UI loads with all 6 endpoints
5. Check console — no JS errors
