# Developer Portal & Landing Page Enrichment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a developer portal (`/dashboard`) with credential management, multi-credential display, seal playground, and educational annotations. Enrich the landing page with portal links and contextual annotations. Both grounded in CSC v2 / eIDAS / SCAL2 reality.

**Architecture:** Extend existing Next.js App Router app. New `/dashboard` page + 5 API routes. Update seed script for 3 credentials. Shared annotation component used on both portal and landing page. No new dependencies — uses existing bcryptjs, jose, neon, node-forge stack.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS, Neon PostgreSQL, bcryptjs, node-forge, SSE streams

**Design doc:** `docs/plans/2026-04-02-developer-portal-design.md`

---

## Phase 1: Backend — Seed & API Routes

### Task 1: Update Seed Script for Multi-Credential Demo Tenant

**Files:**
- Modify: `scripts/seed.ts`

**Step 1: Update seed script**

Replace the single credential creation with 3 credentials. Change tenant name to "Demo Corporation OÜ" and client_id to "tenant-demo-corp-001". Keep the existing DEMO_* env var output for backward compatibility with landing page demo.

```typescript
// scripts/seed.ts — key changes:
// 1. Tenant name: 'Demo Corporation OÜ'
// 2. Client ID: 'tenant-demo-corp-001'
// 3. Three credentials with fixed IDs:

const credentialConfigs = [
  { id: 'cred-inv-001', label: 'Invoice Sealing', status: 'active' },
  { id: 'cred-con-002', label: 'Contract Sealing', status: 'active' },
  { id: 'cred-reg-003', label: 'Regulatory Filings', status: 'suspended' },
];

// For each config: generate RSA 2048 keypair + self-signed X.509 cert
// using existing generateTestCertificate() from src/lib/crypto.ts
// Org name in cert subject: 'Demo Corporation OÜ — {label}'

// DEMO_CREDENTIAL_ID env var output uses first credential (cred-inv-001)
```

**Step 2: Add `label` column to credentials table**

Modify `src/lib/schema.sql` — add after `credential_id`:
```sql
label TEXT,
```

This is a nullable column (no migration needed for existing data, seed script will repopulate).

**Step 3: Run migration + re-seed**

```bash
cd /c/Users/Kasutaja/Claude_Projects/sk-e-seal-prototype
npx tsx scripts/migrate.ts
npx tsx scripts/seed.ts
```

Verify: 1 tenant, 3 credentials in DB. DEMO_* env vars still output.

**Step 4: Update .env.local with new credentials**

Copy the seed output into `.env.local`. Verify `DEMO_CLIENT_ID=tenant-demo-corp-001`.

**Step 5: Verify landing page demo still works**

```bash
npm run dev
```

Open http://localhost:3000, scroll to demo, upload a PDF, verify sealing works. This confirms backward compatibility.

**Step 6: Commit**

```bash
git add scripts/seed.ts src/lib/schema.sql
git commit -m "feat: multi-credential seed — 3 seal certificates per demo tenant"
```

---

### Task 2: Portal API Routes — Tenant & Credentials

**Files:**
- Create: `src/app/api/dashboard/tenant/route.ts`
- Create: `src/app/api/dashboard/credentials/route.ts`

**Step 1: Create tenant overview endpoint**

`GET /api/dashboard/tenant` — returns tenant info for the demo tenant.

```typescript
// src/app/api/dashboard/tenant/route.ts
import { neon } from '@neondatabase/serverless';

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);

  // Get demo tenant with credential counts
  const tenants = await sql`
    SELECT t.id, t.name, t.client_id, t.status, t.created_at,
      (SELECT COUNT(*) FROM credentials c WHERE c.tenant_id = t.id)::int as total_credentials,
      (SELECT COUNT(*) FROM credentials c WHERE c.tenant_id = t.id AND c.status = 'active')::int as active_credentials
    FROM tenants t
    WHERE t.client_id = 'tenant-demo-corp-001'
    LIMIT 1`;

  if (tenants.length === 0) {
    return Response.json({ error: 'Demo tenant not found. Run seed script.' }, { status: 404 });
  }

  return Response.json({ tenant: tenants[0] });
}
```

**Step 2: Create credentials list endpoint**

`GET /api/dashboard/credentials` — returns seal credentials for the demo tenant.

```typescript
// src/app/api/dashboard/credentials/route.ts
import { neon } from '@neondatabase/serverless';
import forge from 'node-forge';

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);

  const tenant = await sql`SELECT id FROM tenants WHERE client_id = 'tenant-demo-corp-001' LIMIT 1`;
  if (tenant.length === 0) {
    return Response.json({ error: 'Demo tenant not found' }, { status: 404 });
  }

  const credentials = await sql`
    SELECT credential_id, label, certificate_pem, key_algorithm, key_length,
           hash_algorithm, scal, status, created_at
    FROM credentials
    WHERE tenant_id = ${tenant[0].id}
    ORDER BY created_at`;

  // Parse certificate details from PEM for display
  const enriched = credentials.map(cred => {
    try {
      const cert = forge.pki.certificateFromPem(cred.certificate_pem);
      return {
        credentialId: cred.credential_id,
        label: cred.label,
        keyAlgorithm: cred.key_algorithm,
        keyLength: cred.key_length,
        hashAlgorithm: cred.hash_algorithm,
        scal: cred.scal,
        status: cred.status,
        createdAt: cred.created_at,
        certificate: {
          subject: cert.subject.getField('CN')?.value || '',
          issuer: cert.issuer.getField('CN')?.value || '',
          organization: cert.subject.getField('O')?.value || '',
          validFrom: cert.validity.notBefore.toISOString(),
          validTo: cert.validity.notAfter.toISOString(),
          serialNumber: cert.serialNumber,
          fingerprint: forge.md.sha256.create()
            .update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())
            .digest().toHex(),
        },
      };
    } catch {
      return { credentialId: cred.credential_id, label: cred.label, status: cred.status };
    }
  });

  return Response.json({ credentials: enriched });
}
```

**Step 3: Verify both endpoints**

```bash
curl http://localhost:3000/api/dashboard/tenant | jq .
curl http://localhost:3000/api/dashboard/credentials | jq .
```

Expected: tenant overview with credential counts, list of 3 credentials with cert details.

**Step 4: Commit**

```bash
git add src/app/api/dashboard/
git commit -m "feat: portal API — tenant overview and credentials list endpoints"
```

---

### Task 3: Portal API Routes — OAuth & PIN Generation

**Files:**
- Create: `src/app/api/dashboard/oauth/generate/route.ts`
- Create: `src/app/api/dashboard/pin/generate/route.ts`

**Step 1: Create OAuth credential generation endpoint**

`POST /api/dashboard/oauth/generate` — generates new client_secret, hashes it, updates tenant, returns plaintext once.

```typescript
// src/app/api/dashboard/oauth/generate/route.ts
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export async function POST() {
  const sql = neon(process.env.DATABASE_URL!);

  const clientSecret = crypto.randomBytes(32).toString('hex');
  const clientSecretHash = await bcrypt.hash(clientSecret, 12);

  const result = await sql`
    UPDATE tenants
    SET client_secret_hash = ${clientSecretHash}, updated_at = NOW()
    WHERE client_id = 'tenant-demo-corp-001'
    RETURNING client_id`;

  if (result.length === 0) {
    return Response.json({ error: 'Demo tenant not found' }, { status: 404 });
  }

  return Response.json({
    clientId: result[0].client_id,
    clientSecret, // Shown once — never stored or returned again
    message: 'Save your client secret now — it will not be shown again.',
  });
}
```

**Step 2: Create PIN generation endpoint**

`POST /api/dashboard/pin/generate` — generates new PIN, hashes it, updates tenant, returns plaintext once.

```typescript
// src/app/api/dashboard/pin/generate/route.ts
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export async function POST() {
  const sql = neon(process.env.DATABASE_URL!);

  // Generate a 6-digit numeric PIN (realistic for SCAL2)
  const pin = crypto.randomInt(100000, 999999).toString();
  const pinHash = await bcrypt.hash(pin, 12);

  const result = await sql`
    UPDATE tenants
    SET pin_hash = ${pinHash}, updated_at = NOW()
    WHERE client_id = 'tenant-demo-corp-001'
    RETURNING client_id`;

  if (result.length === 0) {
    return Response.json({ error: 'Demo tenant not found' }, { status: 404 });
  }

  return Response.json({
    pin, // Shown once — never stored or returned again
    message: 'Save your PIN now — it will not be shown again.',
  });
}
```

**Step 3: Verify both endpoints**

```bash
curl -X POST http://localhost:3000/api/dashboard/oauth/generate | jq .
curl -X POST http://localhost:3000/api/dashboard/pin/generate | jq .
```

Expected: plaintext credentials returned, usable against OAuth and SCAL2 endpoints.

**Step 4: Commit**

```bash
git add src/app/api/dashboard/oauth/ src/app/api/dashboard/pin/
git commit -m "feat: portal API — OAuth secret and SCAL2 PIN generation endpoints"
```

---

### Task 4: Portal API Route — Playground Seal

**Files:**
- Create: `src/app/api/dashboard/seal/route.ts`

**Step 1: Create playground seal endpoint**

`POST /api/dashboard/seal` — like `/api/demo/seal` but accepts credentials from form data (the ones the developer generated in the portal) and returns more detailed step info showing request/response data.

```typescript
// src/app/api/dashboard/seal/route.ts
// Similar to src/app/api/demo/seal/route.ts but:
// 1. Reads credentialId, clientId, clientSecret, pin from form data (not env vars)
// 2. SSE steps include request/response details (method, URL, status, timing)
// 3. Tags client-side steps explicitly

import { SealClient } from '../../../../../packages/client-sdk/src';

export const maxDuration = 60;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('pdf') as File | null;
  const credentialId = formData.get('credentialId') as string | null;
  const clientId = formData.get('clientId') as string | null;
  const clientSecret = formData.get('clientSecret') as string | null;
  const pin = formData.get('pin') as string | null;

  if (!file || file.type !== 'application/pdf') {
    return Response.json({ error: 'PDF file required' }, { status: 400 });
  }
  if (!credentialId || !clientId || !clientSecret || !pin) {
    return Response.json({ error: 'All credentials required (clientId, clientSecret, pin, credentialId)' }, { status: 400 });
  }

  const origin = process.env.API_URL || new URL(request.url).origin;
  const baseUrl = `${origin}/api`;
  const pdfBytes = new Uint8Array(await file.arrayBuffer());

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const client = new SealClient({ baseUrl, clientId, clientSecret, pin, credentialId });

        const result = await client.seal(pdfBytes, {
          onStep: (step) => {
            // Enrich step with API flow context for playground display
            const enriched = {
              ...step,
              // Tag whether this step is an API call or client-side SDK operation
              executionContext: ['token_obtained', 'credential_authorized', 'hash_signed'].includes(step.name)
                ? 'api' : 'client-sdk',
            };
            sendEvent('step', enriched);
          },
        });

        const sealedBase64 = Buffer.from(result.sealedPdf).toString('base64');
        sendEvent('complete', {
          totalDurationMs: result.totalDurationMs,
          originalSize: pdfBytes.length,
          sealedSize: result.sealedPdf.length,
          sealedPdfBase64: sealedBase64,
        });
      } catch (err) {
        sendEvent('error', { message: err instanceof Error ? err.message : 'Sealing failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/dashboard/seal/
git commit -m "feat: portal API — playground seal endpoint with credential pass-through"
```

---

### CHECKPOINT 1: Backend Verification

Before proceeding to frontend, verify all backend pieces work:

1. `GET /api/dashboard/tenant` — returns Demo Corporation OÜ with 3 credentials
2. `GET /api/dashboard/credentials` — returns 3 credentials with cert details, one suspended
3. `POST /api/dashboard/oauth/generate` — returns new client_id + client_secret
4. `POST /api/dashboard/pin/generate` — returns new PIN
5. `POST /api/dashboard/seal` — accepts credentials in form data, streams SSE steps
6. Landing page demo still works with DEMO_* env vars (backward compatibility)

---

## Phase 2: Portal UI

### Task 5: Shared Annotation Component

**Files:**
- Create: `src/app/components/Annotation.tsx`

**Step 1: Create the annotation component**

A reusable component for educational callouts used on both portal and landing page. Left-bordered callout with info icon, expandable detail for longer text.

```typescript
// src/app/components/Annotation.tsx
'use client';
import { useState } from 'react';

interface AnnotationProps {
  children: React.ReactNode;
  /** Optional expandable detail text */
  detail?: React.ReactNode;
}

export function Annotation({ children, detail }: AnnotationProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-l-2 border-primary/30 pl-4 py-2 my-4">
      <div className="flex items-start gap-2">
        <span className="material-symbols-outlined text-primary/50 text-sm mt-0.5 shrink-0">info</span>
        <div className="text-sm text-secondary/80 font-body italic leading-relaxed">
          {children}
          {detail && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="ml-1 text-primary/60 hover:text-primary text-xs font-label uppercase tracking-wider"
              >
                {expanded ? 'Less' : 'More'}
              </button>
              {expanded && (
                <div className="mt-2 text-secondary/70">{detail}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/components/Annotation.tsx
git commit -m "feat: shared Annotation component for educational callouts"
```

---

### Task 6: Dashboard Page — Tenant Overview & Credentials

**Files:**
- Create: `src/app/dashboard/page.tsx`

**Step 1: Create the dashboard page**

Build the full portal page with all four sections (A-D from design doc). This is a single `'use client'` page that fetches data from the portal API routes and renders:

- **Section A:** Tenant overview card
- **Section B:** OAuth credentials + SCAL2 PIN (generate buttons, one-time display modals)
- **Section C:** Seal credentials table (3 rows, expandable cert details)
- **Section D:** Seal playground (credential picker, PDF upload, step-by-step SSE flow)

Each section includes `<Annotation>` components with the educational text from the design doc.

The page structure follows the landing page's design language — same fonts, colors, tonal surface shifts, rounded-xl cards, no shadows.

Key UI patterns from existing code to reuse:
- Upload zone: same drag-and-drop pattern as `DemoSection.tsx` (lines 209-258)
- SSE stream parsing: same pattern as `DemoSection.tsx` (lines 149-186)
- Step display: similar to Process X-Ray but with API/SDK tagging and request/response details
- Generate modals: show plaintext once with copy button and warning

**Section D (Playground) step display differences from landing page demo:**
- Each step shows: HTTP method + URL (for API steps) or "Client SDK" tag
- Request parameters visible (credential ID, truncated tokens)
- Response status + timing
- Steps 4-5 (CMS assembly, timestamp, PDF injection) explicitly tagged as "client-side — SDK"

**Step 2: Commit**

```bash
git add src/app/dashboard/
git commit -m "feat: developer portal page — credentials, seal certificates, playground"
```

---

### CHECKPOINT 2: Portal UI Verification

Open http://localhost:3000/dashboard and verify:

1. Tenant overview shows "Demo Corporation OÜ" with credential count
2. OAuth section: can generate client_secret, shown once with copy button
3. PIN section: can generate PIN, shown once with copy button
4. Credentials table: 3 rows, 2 active + 1 suspended, expandable cert details
5. Playground: select credential, upload PDF, see step-by-step seal flow with API/SDK tagging
6. All annotations display correctly with expand/collapse
7. Design matches landing page (fonts, colors, tonal surfaces)

---

## Phase 3: Landing Page Enrichment

### Task 7: Landing Page — Navbar, Hero, CTAs

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update navbar**

Add "Developer Portal" link between "Try Demo" and "Documentation" (line ~16):

```tsx
<a className="font-headline font-bold uppercase tracking-[0.2em] text-sm text-secondary hover:text-[#f12f00] transition-colors duration-200" href="/dashboard">Developer Portal</a>
```

**Step 2: Update hero CTAs**

Add third CTA button after "Read the Documentation" (line ~48):

```tsx
<a href="/dashboard" className="px-8 py-4 bg-surface-container-highest text-on-surface rounded-full font-bold text-base hover:bg-surface-container-high transition-all flex items-center gap-2">
  Open Developer Portal
  <span className="material-symbols-outlined">developer_mode</span>
</a>
```

**Step 3: Update CTA banner**

Change "Try the Demo" link (line ~700) to:

```tsx
<a href="/dashboard" className="bg-transparent text-white border-2 border-white/30 px-10 py-5 rounded-full font-bold text-lg hover:bg-white/10 transition-all">
  Open Developer Portal
</a>
```

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: landing page — portal links in navbar, hero, CTA banner"
```

---

### Task 8: Landing Page — Educational Annotations

**Files:**
- Modify: `src/app/page.tsx` (convert to client component or import Annotation)

**Step 1: Add annotations to Section 3 (What is an E-Seal?)**

After the "Qualified Level" card (~line 140):
```tsx
<Annotation>
  Qualified is the highest of three eIDAS levels (basic → advanced → qualified).
  It requires certified hardware (HSM), a Qualified Trust Service Provider, and
  conformity assessment by an EU-accredited body. This is what separates a qualified
  e-seal from a simple digital signature.
</Annotation>
```

After the "Hash-Only Privacy" card (~line 150):
```tsx
<Annotation>
  This is a property of the CSC v2 protocol, not a policy choice. The API only
  accepts hashes — there is no endpoint that accepts documents. Privacy is
  architecturally enforced, not contractually promised.
</Annotation>
```

**Step 2: Add annotations to Section 5 (Customer Segments)**

After "Banks & Financial Institutions" card (~line 229):
```tsx
<Annotation>
  Current e-seal customers in this segment process hundreds of thousands of seals
  per month. The move from physical crypto sticks to remote API-based sealing
  eliminates courier logistics, RA officer overhead, and manual key ceremonies.
</Annotation>
```

After "E-Signature Brokers" card (~line 249):
```tsx
<Annotation>
  In the broker model, the seal certificate belongs to the end-entity (the small
  company), not the broker. The broker facilitates access but the identity chain
  to the legal entity must be preserved — architecturally supported through
  per-tenant credentials.
</Annotation>
```

**Step 3: Add annotations to Section 6 (How It Works)**

After Step 3 (Authenticate) (~line 301):
```tsx
<Annotation>
  OAuth 2.0 Client Credentials flow. Credentials are issued through the Developer
  Portal after QTSP onboarding. The authorized representative delegates API access
  to the technical team.
</Annotation>
```

After Step 4 (Authorize — SCAL2) (~line 309):
```tsx
<Annotation>
  This step is what makes it "qualified." The PIN ensures the legal entity retains
  sole control of the signing key, even though the key is hosted remotely in the
  QTSP's HSM. Required by EN 419 241-1.
</Annotation>
```

After Step 5 (Sign hash) (~line 316):
```tsx
<Annotation>
  The private key never leaves the HSM. The hash enters, the signature comes out.
  The API cannot export, copy, or extract the key — enforced by QSCD hardware
  certification.
</Annotation>
```

**Step 4: Add SDK responsibility callout to Section 6**

After the existing callout box (~line 332), add:

```tsx
<Annotation detail="The Client SDK (packages/client-sdk) handles: PDF placeholder creation (pdf-lib), byte range hash computation with SignedAttributes DER encoding, CMS/PKCS#7 SignedData assembly (node-forge), RFC 3161 timestamp requests to qualified TSA, and final signature injection into the PDF.">
  Steps 1-2 and 7-10 execute on your infrastructure — the API never sees the document.
  The Client SDK handles PDF preparation, hash computation, CMS assembly, timestamping,
  and injection. Without it, your team would need to implement PAdES B-T compliant CMS
  construction from scratch. Whether the production service includes an official SDK
  is a product decision — this prototype includes a fully working one.
</Annotation>
```

**Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: landing page — educational annotations on key sections"
```

---

### Task 9: Landing Page — Developer Section & Portal Card

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update Section 8 (Developer Experience)**

Above or below the code snippet (~line 376), add context text:

```tsx
<p className="text-sm text-secondary mb-8 font-body">
  Get these values from the <a href="/dashboard" className="text-primary hover:underline font-bold">Developer Portal</a> —
  generate credentials, pick a seal certificate, and you're ready to integrate.
</p>
```

**Step 2: Add Developer Portal card to the grid**

Add as first card in the 3-card grid (~line 380), making it a 4-card grid:

```tsx
<a href="/dashboard" className="bg-surface-container-lowest p-10 rounded-xl group hover:bg-surface-container-high transition-all duration-300 block">
  <div className="w-14 h-14 bg-surface-container-low rounded-xl flex items-center justify-center mb-8 group-hover:bg-primary/10 transition-colors">
    <span className="material-symbols-outlined text-primary text-3xl">developer_mode</span>
  </div>
  <h3 className="text-xl font-bold mb-4 font-headline">Developer Portal</h3>
  <p className="text-secondary leading-relaxed font-body">
    Get API credentials, manage seal certificates, test the full CSC v2 integration flow step by step.
  </p>
</a>
```

Update grid from `md:grid-cols-3` to `md:grid-cols-2 lg:grid-cols-4`.

**Step 3: Add Developer Portal card to Section 11 Developer Tools grid**

Add as first card (~line 617), above Swagger UI:

```tsx
<a href="/dashboard" className="bg-surface-container-lowest p-6 rounded-xl group hover:bg-surface-container-high transition-all duration-300 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <span className="material-symbols-outlined text-primary">developer_mode</span>
    <div>
      <h4 className="font-bold font-headline">Developer Portal</h4>
      <p className="text-sm text-secondary font-body">Get credentials, manage seal certificates, test the API flow</p>
    </div>
  </div>
  <span className="material-symbols-outlined text-secondary group-hover:text-primary transition-colors">arrow_forward</span>
</a>
```

**Step 4: Add portal link to Section 7 (Demo) disclaimer**

After existing disclaimer (~line 348):

```tsx
<p className="text-sm text-secondary mt-2 font-body">
  Want to see the full API flow with your own credentials? <a href="/dashboard" className="text-primary hover:underline font-bold">Open the Developer Portal</a>.
</p>
```

**Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: landing page — portal cards, developer section enrichment, demo link"
```

---

### CHECKPOINT 3: Landing Page Verification

Open http://localhost:3000 and verify:

1. Navbar: "Developer Portal" link present, navigates to `/dashboard`
2. Hero: three CTA buttons, "Open Developer Portal" works
3. Section 3: annotations on Qualified Level and Hash-Only Privacy cards
4. Section 5: annotations on Banks and Brokers segments
5. Section 6: annotations on Steps 3, 4, 5 + SDK responsibility callout
6. Section 7: portal link in demo disclaimer
7. Section 8: portal context text above code, Developer Portal card in grid (4 cards)
8. Section 11: Developer Portal card first in Developer Tools
9. Section 12: CTA banner "Open Developer Portal" link
10. All annotations match design language (no visual jarring)
11. Landing page demo still works end-to-end

---

## Phase 4: Polish & Integration

### Task 10: Scroll-Aware Annotation Behavior

**Files:**
- Modify: `src/app/components/Annotation.tsx`

**Step 1: Add Intersection Observer**

Enhance the Annotation component with a fade-in + left-border highlight effect when the annotation enters the viewport. Uses Intersection Observer API (no dependencies).

```typescript
// Add to Annotation.tsx:
// useRef for the container element
// useEffect with IntersectionObserver (threshold: 0.3)
// When intersecting: add 'opacity-100 translate-x-0' classes
// When not: 'opacity-0 -translate-x-2' (subtle slide-in from left)
// CSS transition handles the animation
```

This makes the annotations activate as you scroll past them — the guided tour feel for sales walkthroughs.

**Step 2: Commit**

```bash
git add src/app/components/Annotation.tsx
git commit -m "feat: scroll-aware annotation animation via Intersection Observer"
```

---

### Task 11: Final Integration Verification

**Step 1: Full E2E walkthrough**

Open the app and walk through the complete journey:

1. Land on `/` → read through landing page, annotations appear on scroll
2. Click "Open Developer Portal" → navigate to `/dashboard`
3. View tenant overview → "Demo Corporation OÜ"
4. Generate OAuth credentials → copy client_id + secret
5. Generate PIN → copy PIN
6. View seal credentials table → 3 certs, expand one to see details
7. In playground: select "Invoice Sealing" credential
8. Upload a PDF
9. Watch step-by-step seal flow with API/SDK tagging
10. Download sealed PDF
11. Navigate back to landing page → demo still works independently

**Step 2: Verify sealed PDF**

Upload the playground-sealed PDF to EU DSS validator:
`https://ec.europa.eu/digital-building-blocks/DSS/webapp-demo/validation`

Expected: PAdES-BES format, QTSA timestamp PASSED (same as existing demo).

**Step 3: Build check**

```bash
npm run build
```

Must pass with zero errors.

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "feat: developer portal & landing page enrichment — complete"
```

---

### CHECKPOINT 4: Final Verification

Full checklist before declaring done:

- [ ] Landing page: all 12 sections render, annotations present and animate on scroll
- [ ] Landing page demo: sealing works end-to-end (backward compatible)
- [ ] Portal: all 4 sections render with correct design language
- [ ] Portal: credential generation works (OAuth + PIN)
- [ ] Portal: 3 seal certificates displayed with expandable details
- [ ] Portal: playground seals a PDF with developer-generated credentials
- [ ] Portal: step-by-step display shows API vs SDK tagging
- [ ] All annotations have correct educational content grounded in CSC v2 / eIDAS
- [ ] Navigation between landing page and portal is seamless
- [ ] `npm run build` passes
- [ ] EU DSS validates playground-sealed PDF

---

## File Inventory

### New Files (8)
```
src/app/dashboard/page.tsx                          — Portal page (sections A-D)
src/app/components/Annotation.tsx                   — Shared annotation component
src/app/api/dashboard/tenant/route.ts               — GET tenant overview
src/app/api/dashboard/credentials/route.ts          — GET seal credentials list
src/app/api/dashboard/oauth/generate/route.ts       — POST generate OAuth secret
src/app/api/dashboard/pin/generate/route.ts         — POST generate SCAL2 PIN
src/app/api/dashboard/seal/route.ts                 — POST playground seal (SSE)
docs/plans/2026-04-02-developer-portal-design.md    — Design document (already committed)
```

### Modified Files (2)
```
scripts/seed.ts                                     — 3 credentials, updated tenant name
src/app/page.tsx                                    — Navbar, hero, annotations, portal cards, CTAs
```

### Unchanged but Referenced
```
src/lib/schema.sql                                  — Add label column to credentials
src/lib/crypto.ts                                   — generateTestCertificate() reused by seed
src/lib/auth.ts                                     — hashSecret/verifySecret reused
src/app/api/demo/seal/route.ts                      — Unchanged, backward compatible
src/app/components/DemoSection.tsx                   — Unchanged, SSE pattern referenced
packages/client-sdk/src/seal.ts                     — SealClient reused by playground
```
