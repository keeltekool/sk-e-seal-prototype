import { DemoSection } from './components/DemoSection';

export default function Home() {
  return (
    <>
      {/* ===== SECTION 1: NAVBAR ===== */}
      <nav className="sticky top-0 w-full z-50 bg-white/90 backdrop-blur-md">
        <div className="flex justify-between items-center px-8 py-4 max-w-screen-2xl mx-auto">
          <div className="text-2xl font-black text-[#f12f00] brand-logo">
            SK ID Solutions
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a className="font-headline font-bold uppercase tracking-[0.2em] text-sm text-secondary hover:text-[#f12f00] transition-colors duration-200" href="#service">Service</a>
            <a className="font-headline font-bold uppercase tracking-[0.2em] text-sm text-secondary hover:text-[#f12f00] transition-colors duration-200" href="#how-it-works">How It Works</a>
            <a className="font-headline font-bold uppercase tracking-[0.2em] text-sm text-secondary hover:text-[#f12f00] transition-colors duration-200" href="#developers">For Developers</a>
            <a className="font-headline font-bold uppercase tracking-[0.2em] text-sm text-secondary hover:text-[#f12f00] transition-colors duration-200" href="#demo">Try Demo</a>
            <a className="font-headline font-bold uppercase tracking-[0.2em] text-sm text-secondary hover:text-[#f12f00] transition-colors duration-200" href="#documentation">Documentation</a>
          </div>
          <div className="flex items-center space-x-6">
            <button className="px-6 py-2 bg-primary text-on-primary rounded-full font-bold text-sm tracking-wide uppercase hover:opacity-90 transition-all active:scale-95">
              Contact Sales
            </button>
          </div>
        </div>
      </nav>

      <main>
        {/* ===== SECTION 2: HERO ===== */}
        <section className="relative bg-surface overflow-hidden pt-16 pb-16">
          <div className="max-w-screen-2xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="z-10">
              <span className="inline-block font-label font-bold uppercase tracking-[0.2em] text-primary text-xs mb-6">
                REMOTE QUALIFIED E-SEAL
              </span>
              <h1 className="text-[3.5rem] leading-[1.1] font-bold text-on-surface mb-8 font-headline">
                Remote Qualified E-Sealing. API-first. Privacy by design.
              </h1>
              <p className="text-lg text-secondary leading-relaxed mb-10 max-w-xl font-body">
                Apply eIDAS Qualified electronic seals to millions of documents - without a single one ever leaving your infrastructure. The most complete remote e-sealing solution on the market.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="#demo" className="px-8 py-4 bg-primary text-on-primary rounded-full font-bold text-base hover:opacity-90 transition-all flex items-center gap-2">
                  Try the Live Demo
                  <span className="material-symbols-outlined">arrow_forward</span>
                </a>
                <a href="#documentation" className="px-8 py-4 bg-surface-container-highest text-on-surface rounded-full font-bold text-base hover:bg-surface-container-high transition-all">
                  Read the Documentation
                </a>
              </div>
            </div>
            {/* Right side: visual flow diagram */}
            <div className="relative h-[600px] lg:h-[700px] flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/5 rounded-[4rem] -rotate-3 transform-gpu"></div>
              <div className="relative z-10 w-full max-w-md space-y-4 px-8">
                {/* Your Infrastructure */}
                <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10">
                  <p className="text-xs text-primary font-label uppercase tracking-wider mb-4 font-bold">Your Infrastructure</p>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="material-symbols-outlined text-on-surface">description</span>
                    <span className="font-body text-sm text-secondary">invoice-2026-q1.pdf</span>
                    <span className="text-xs text-secondary ml-auto font-label">2.4 MB</span>
                  </div>
                  <div className="flex items-center gap-2 pl-10">
                    <span className="material-symbols-outlined text-primary text-sm">arrow_downward</span>
                    <span className="font-body text-xs text-secondary">SHA-256</span>
                  </div>
                  <div className="mt-3 bg-[#1b1c1b] rounded-lg p-3">
                    <code className="text-xs text-primary-fixed-dim font-mono break-all">a7f3b9c1d4e8f2a6b0c5d7e9f1a3b5c8d2e4f6a8b0c3d5e7f9a1b4c6d8e0f2a4</code>
                  </div>
                  <p className="text-center text-xs text-secondary mt-2 font-label">32 bytes - that&apos;s all that leaves</p>
                </div>

                {/* Arrow down */}
                <div className="flex justify-center">
                  <div className="flex flex-col items-center">
                    <div className="w-px h-6 bg-primary/30"></div>
                    <span className="material-symbols-outlined text-primary">arrow_downward</span>
                    <p className="text-xs text-primary font-label font-bold mt-1">HTTPS</p>
                    <div className="w-px h-6 bg-primary/30"></div>
                  </div>
                </div>

                {/* SK E-Seal API */}
                <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10">
                  <p className="text-xs text-primary font-label uppercase tracking-wider mb-4 font-bold">SK E-Seal API</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                      <span className="text-xs text-secondary font-body">OAuth 2.0 authenticated</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                      <span className="text-xs text-secondary font-body">SCAL2 PIN authorized</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                      <span className="text-xs text-secondary font-body">RSA 2048 signed</span>
                    </div>
                  </div>
                  <div className="mt-4 bg-primary/5 rounded-lg p-3 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">verified_user</span>
                    <div>
                      <p className="text-sm font-bold font-headline text-on-surface">eIDAS Qualified</p>
                      <p className="text-xs text-secondary font-body">PAdES B-T with RFC 3161 timestamp</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating stat card */}
              <div className="absolute -bottom-8 -left-8 bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 z-20 hidden md:block">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary text-4xl">lock</span>
                  <div>
                    <p className="text-2xl font-bold font-headline">32 bytes</p>
                    <p className="text-xs text-secondary font-label uppercase tracking-wider">Only a hash crosses the network</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 3: WHAT IS AN E-SEAL? ===== */}
        <section id="service" className="bg-surface-container-low py-16">
          <div className="max-w-screen-2xl mx-auto px-8">
            <div className="max-w-3xl mb-10">
              <span className="font-label font-bold uppercase tracking-[0.2em] text-primary text-xs mb-4 block">THE BASICS</span>
              <h2 className="text-[2.5rem] font-bold leading-tight font-headline">Electronic seals - the digital equivalent of a company stamp.</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Card 1: Qualified Level */}
              <div className="bg-surface-container-lowest p-10 rounded-xl group hover:bg-surface-container-high transition-all duration-300">
                <div className="w-14 h-14 bg-surface-container-low rounded-xl flex items-center justify-center mb-8 group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-primary text-3xl">verified_user</span>
                </div>
                <h3 className="text-xl font-bold mb-4 font-headline">Qualified Level</h3>
                <p className="text-secondary leading-relaxed font-body">
                  Highest legal assurance under eIDAS. Non-repudiable proof of origin and integrity.
                </p>
              </div>
              {/* Card 2: Hash-Only Privacy */}
              <div className="bg-surface-container-lowest p-10 rounded-xl group hover:bg-surface-container-high transition-all duration-300">
                <div className="w-14 h-14 bg-surface-container-low rounded-xl flex items-center justify-center mb-8 group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-primary text-3xl">lock</span>
                </div>
                <h3 className="text-xl font-bold mb-4 font-headline">Hash-Only Privacy</h3>
                <p className="text-secondary leading-relaxed font-body">
                  Your documents never leave your infrastructure. We only receive a 32-byte hash - we cannot see, read, or store your content.
                </p>
              </div>
              {/* Card 3: API-First */}
              <div className="bg-surface-container-lowest p-10 rounded-xl group hover:bg-surface-container-high transition-all duration-300">
                <div className="w-14 h-14 bg-surface-container-low rounded-xl flex items-center justify-center mb-8 group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-primary text-3xl">speed</span>
                </div>
                <h3 className="text-xl font-bold mb-4 font-headline">API-First</h3>
                <p className="text-secondary leading-relaxed font-body">
                  One API call to seal. Full CSC v2 compliance. TypeScript SDK included. Seal thousands of documents per minute.
                </p>
              </div>
              {/* Card 4: Timestamp Included */}
              <div className="bg-surface-container-lowest p-10 rounded-xl group hover:bg-surface-container-high transition-all duration-300">
                <div className="w-14 h-14 bg-surface-container-low rounded-xl flex items-center justify-center mb-8 group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-primary text-3xl">schedule</span>
                </div>
                <h3 className="text-xl font-bold mb-4 font-headline">Timestamp Included</h3>
                <p className="text-secondary leading-relaxed font-body">
                  Every seal includes an RFC 3161 qualified timestamp - cryptographic proof of exactly when the document was sealed. PAdES B-T from day one.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 4: eIDAS QUALIFIED ===== */}
        <section className="py-16 bg-surface">
          <div className="max-w-screen-2xl mx-auto px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
              <div>
                <span className="font-label font-bold uppercase tracking-[0.2em] text-primary text-xs mb-4 block">LEGAL ASSURANCE</span>
                <h2 className="text-4xl font-bold mb-6 leading-tight font-headline">The highest legal standard for electronic seals in Europe.</h2>
                <p className="text-secondary leading-relaxed font-body">
                  Qualified is the highest level under eIDAS - full legal equivalence to a handwritten signature across all 27 EU member states. Documents sealed at this level are <strong className="text-on-surface">presumed authentic and unaltered</strong> by law. Organizations that seal at qualified level now get full future-proofing - any jurisdiction, any court, any scenario.
                </p>
              </div>
              <div className="space-y-6">
                <div className="flex gap-4 p-6 bg-surface-container-low rounded-xl">
                  <span className="material-symbols-outlined text-primary mt-1">gavel</span>
                  <div>
                    <h4 className="font-bold mb-1 font-headline">Legal equivalence</h4>
                    <p className="text-sm text-secondary font-body">Qualified e-seals enjoy automatic legal recognition across the entire EU. No bilateral agreements. No per-country validation. One seal, 27 member states.</p>
                  </div>
                </div>
                <div className="flex gap-4 p-6 bg-surface-container-low rounded-xl">
                  <span className="material-symbols-outlined text-primary mt-1">shield</span>
                  <div>
                    <h4 className="font-bold mb-1 font-headline">Certified infrastructure</h4>
                    <p className="text-sm text-secondary font-body">Requires a Qualified Signature Creation Device (QSCD), certified Trust Service Provider status, and conformity assessment. This is hard - by design.</p>
                  </div>
                </div>
                <div className="flex gap-4 p-6 bg-surface-container-low rounded-xl">
                  <span className="material-symbols-outlined text-primary mt-1">workspace_premium</span>
                  <div>
                    <h4 className="font-bold mb-1 font-headline">Highest confidence</h4>
                    <p className="text-sm text-secondary font-body">When your bank statement, invoice, or regulatory filing carries a qualified e-seal, recipients know it&apos;s authentic. Not because they trust you - because EU law says so.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 5: WHO IS THIS FOR? ===== */}
        <section className="bg-surface-container-low py-16">
          <div className="max-w-screen-2xl mx-auto px-8">
            <div className="max-w-3xl mb-10">
              <span className="font-label font-bold uppercase tracking-[0.2em] text-primary text-xs mb-4 block">CUSTOMER SEGMENTS</span>
              <h2 className="text-[2.5rem] font-bold leading-tight font-headline">Built for organizations that seal at scale.</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-surface-container-lowest p-8 rounded-xl group hover:bg-surface-container-high transition-all duration-300">
                <div className="w-12 h-12 bg-surface-container-low rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-primary text-2xl">account_balance</span>
                </div>
                <h3 className="text-lg font-bold mb-1 font-headline">Banks &amp; Financial Institutions</h3>
                <p className="text-xs text-primary font-label uppercase tracking-wider mb-3">Direct API Clients</p>
                <p className="text-sm text-secondary font-body">
                  Seal statements, agreements, and regulatory filings. Direct CSC v2 API integration for maximum throughput.
                </p>
              </div>
              <div className="bg-surface-container-lowest p-8 rounded-xl group hover:bg-surface-container-high transition-all duration-300">
                <div className="w-12 h-12 bg-surface-container-low rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-primary text-2xl">integration_instructions</span>
                </div>
                <h3 className="text-lg font-bold mb-1 font-headline">Document &amp; ERP Platforms</h3>
                <p className="text-xs text-primary font-label uppercase tracking-wider mb-3">Platforms &amp; SaaS</p>
                <p className="text-sm text-secondary font-body">
                  Embed e-sealing into your product. White-label ready. <code className="bg-surface-container-high px-1 py-0.5 rounded text-xs">client.seal(pdf)</code> and done.
                </p>
              </div>
              <div className="bg-surface-container-lowest p-8 rounded-xl group hover:bg-surface-container-high transition-all duration-300">
                <div className="w-12 h-12 bg-surface-container-low rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-primary text-2xl">hub</span>
                </div>
                <h3 className="text-lg font-bold mb-1 font-headline">E-Signature Brokers</h3>
                <p className="text-xs text-primary font-label uppercase tracking-wider mb-3">Trust Service Providers</p>
                <p className="text-sm text-secondary font-body">
                  Add qualified e-sealing to your portfolio. Multi-tenant, per-customer credentials. CSC v2 compatible.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 6: HOW IT WORKS ===== */}
        <section id="how-it-works" className="py-16 bg-surface">
          <div className="max-w-screen-2xl mx-auto px-8">
            <div className="max-w-3xl mb-10">
              <span className="font-label font-bold uppercase tracking-[0.2em] text-primary text-xs mb-4 block">TECHNICAL FLOW</span>
              <h2 className="text-[2.5rem] font-bold leading-tight font-headline">The hash-only model - privacy by architecture.</h2>
            </div>
            {/* Flow diagram */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              <div>
                <h3 className="font-bold text-lg mb-6 font-headline">Your Infrastructure</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                    <span className="text-primary font-bold font-headline w-8">1.</span>
                    <span className="text-secondary font-body">Load document</span>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                    <span className="text-primary font-bold font-headline w-8">2.</span>
                    <span className="text-secondary font-body">Compute SHA-256 hash (32 bytes)</span>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                    <span className="text-primary font-bold font-headline w-8">7.</span>
                    <span className="text-secondary font-body">Build CMS SignedData</span>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                    <span className="text-primary font-bold font-headline w-8">8.</span>
                    <span className="text-secondary font-body">Add RFC 3161 timestamp</span>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                    <span className="text-primary font-bold font-headline w-8">9.</span>
                    <span className="text-secondary font-body">Embed in document</span>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                    <span className="text-primary font-bold font-headline w-8">10.</span>
                    <span className="text-secondary font-body">Output: Qualified sealed PDF</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-6 font-headline">SK E-Seal API</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                    <span className="text-primary font-bold font-headline w-8">3.</span>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">arrow_forward</span>
                      <span className="text-secondary font-body">Authenticate (OAuth 2.0)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                    <span className="text-primary font-bold font-headline w-8">4.</span>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">arrow_forward</span>
                      <span className="text-secondary font-body">Authorize credential (SCAL2)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                    <span className="text-primary font-bold font-headline w-8">5.</span>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">arrow_forward</span>
                      <span className="text-secondary font-body">Sign the hash (RSA 2048)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                    <span className="text-primary font-bold font-headline w-8">6.</span>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">arrow_back</span>
                      <span className="text-secondary font-body">Return raw signature</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Callout box */}
            <div className="p-8 border-l-4 border-primary bg-surface-container-lowest max-w-4xl">
              <p className="text-secondary leading-relaxed font-body">
                <strong className="text-on-surface">The document never crosses the boundary.</strong> Only a 32-byte SHA-256 hash is transmitted. Your infrastructure computes the hash locally, sends it to the API, receives back a cryptographic signature, and assembles the final sealed document. We never see the content. This is not a policy choice - it&apos;s how the CSC v2 protocol works by design.
              </p>
            </div>
          </div>
        </section>

        {/* ===== SECTION 7: LIVE DEMO ===== */}
        <section id="demo" className="bg-surface-container-low py-16">
          <div className="max-w-screen-2xl mx-auto px-8">
            <div className="max-w-3xl mb-8">
              <span className="font-label font-bold uppercase tracking-[0.2em] text-primary text-xs mb-4 block">INTERACTIVE DEMO</span>
              <h2 className="text-[2.5rem] font-bold leading-tight font-headline">Seal a PDF right now. Watch every step.</h2>
              <p className="text-secondary leading-relaxed mt-4 font-body">
                Upload any PDF document. Watch the 8-step sealing process execute in real-time - authentication, credential authorization, hash signing, CMS assembly, timestamping. Download your sealed PDF when it&apos;s done.
              </p>
            </div>
            <DemoSection />
            <p className="text-sm text-secondary mt-8 italic font-body">
              This demo uses a self-signed test certificate. In production, documents are sealed with SK&apos;s qualified certificate - validated by Adobe Acrobat and DigiDoc4.
            </p>
          </div>
        </section>

        {/* ===== SECTION 8: DEVELOPER EXPERIENCE ===== */}
        <section id="developers" className="py-16 bg-surface">
          <div className="max-w-screen-2xl mx-auto px-8">
            <div className="max-w-3xl mb-10">
              <span className="font-label font-bold uppercase tracking-[0.2em] text-primary text-xs mb-4 block">FOR DEVELOPERS</span>
              <h2 className="text-[2.5rem] font-bold leading-tight font-headline">From zero to sealed PDF in 5 minutes.</h2>
            </div>
            {/* Code block */}
            <div className="bg-[#1b1c1b] rounded-xl p-8 mb-16 overflow-x-auto">
              <pre className="text-sm leading-relaxed">
                <code className="text-gray-300">
{`import { SealClient } from '@sk-eseal/client-sdk';

const client = new SealClient({
  baseUrl: 'https://eseal.sk.ee',
  clientId: 'your-tenant-id',
  clientSecret: 'your-secret',
  pin: 'your-pin',
  credentialId: 'your-credential-id',
});

const result = await client.seal(pdfBytes);
`}<span className="text-secondary">{'// result.sealedPdf → Uint8Array (sealed PDF with PAdES B-T signature)'}</span>
                </code>
              </pre>
            </div>
            {/* Three feature cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-surface-container-lowest p-10 rounded-xl group hover:bg-surface-container-high transition-all duration-300">
                <div className="w-14 h-14 bg-surface-container-low rounded-xl flex items-center justify-center mb-8 group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-primary text-3xl">code</span>
                </div>
                <h3 className="text-xl font-bold mb-4 font-headline">TypeScript SDK</h3>
                <p className="text-secondary leading-relaxed font-body">
                  8 modules, 23 tests. <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-sm">npm install @sk-eseal/client-sdk</code>. Handles PDF preparation, hash computation, CMS assembly, timestamping - everything except the signing itself.
                </p>
              </div>
              <div className="bg-surface-container-lowest p-10 rounded-xl group hover:bg-surface-container-high transition-all duration-300">
                <div className="w-14 h-14 bg-surface-container-low rounded-xl flex items-center justify-center mb-8 group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-primary text-3xl">description</span>
                </div>
                <h3 className="text-xl font-bold mb-4 font-headline">OpenAPI 3.1 Spec</h3>
                <p className="text-secondary leading-relaxed font-body">
                  Full machine-readable API definition. Import into Postman, generate clients in any language. Interactive Swagger UI included.
                </p>
              </div>
              <div className="bg-surface-container-lowest p-10 rounded-xl group hover:bg-surface-container-high transition-all duration-300">
                <div className="w-14 h-14 bg-surface-container-low rounded-xl flex items-center justify-center mb-8 group-hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-primary text-3xl">terminal</span>
                </div>
                <h3 className="text-xl font-bold mb-4 font-headline">CLI Demo</h3>
                <p className="text-secondary leading-relaxed font-body">
                  <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-sm">npx tsx seal-demo.ts invoice.pdf</code> → sealed PDF in seconds. Inspect every step of the flow.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 9: PRICING ===== */}
        <section className="bg-surface-container-low py-16">
          <div className="max-w-screen-2xl mx-auto px-8">
            <div className="max-w-3xl mb-10">
              <span className="font-label font-bold uppercase tracking-[0.2em] text-primary text-xs mb-4 block">PRICING</span>
              <h2 className="text-[2.5rem] font-bold leading-tight font-headline">Transparent pricing for every scale.</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Starter */}
              <div className="bg-surface-container-lowest p-10 rounded-xl relative">
                <div className="absolute top-4 right-4 bg-surface-container-high px-3 py-1 rounded-full">
                  <span className="text-xs text-secondary font-label uppercase tracking-wider">Coming Soon</span>
                </div>
                <h3 className="text-xl font-bold mb-2 font-headline">Starter</h3>
                <p className="text-sm text-secondary mb-6 font-body">For evaluation and development</p>
                <div className="text-4xl font-bold font-headline text-secondary/30 mb-6">—</div>
                <div className="space-y-3 text-sm text-secondary/50 font-body">
                  <p>Lorem ipsum dolor sit amet</p>
                  <p>Consectetur adipiscing elit</p>
                  <p>Sed do eiusmod tempor</p>
                </div>
              </div>
              {/* Business */}
              <div className="bg-surface-container-lowest p-10 rounded-xl relative">
                <div className="absolute top-4 right-4 bg-surface-container-high px-3 py-1 rounded-full">
                  <span className="text-xs text-secondary font-label uppercase tracking-wider">Coming Soon</span>
                </div>
                <h3 className="text-xl font-bold mb-2 font-headline">Business</h3>
                <p className="text-sm text-secondary mb-6 font-body">For production workloads</p>
                <div className="text-4xl font-bold font-headline text-secondary/30 mb-6">—</div>
                <div className="space-y-3 text-sm text-secondary/50 font-body">
                  <p>Lorem ipsum dolor sit amet</p>
                  <p>Consectetur adipiscing elit</p>
                  <p>Sed do eiusmod tempor</p>
                  <p>Incididunt ut labore et dolore</p>
                </div>
              </div>
              {/* Enterprise */}
              <div className="bg-surface-container-lowest p-10 rounded-xl relative">
                <div className="absolute top-4 right-4 bg-surface-container-high px-3 py-1 rounded-full">
                  <span className="text-xs text-secondary font-label uppercase tracking-wider">Coming Soon</span>
                </div>
                <h3 className="text-xl font-bold mb-2 font-headline">Enterprise</h3>
                <p className="text-sm text-secondary mb-6 font-body">For high-volume and custom needs</p>
                <div className="text-4xl font-bold font-headline text-secondary/30 mb-6">—</div>
                <div className="space-y-3 text-sm text-secondary/50 font-body">
                  <p>Lorem ipsum dolor sit amet</p>
                  <p>Consectetur adipiscing elit</p>
                  <p>Sed do eiusmod tempor</p>
                  <p>Incididunt ut labore et dolore</p>
                  <p>Magna aliqua ut enim</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 10: COMPLIANCE & STANDARDS ===== */}
        <section className="py-16 bg-surface">
          <div className="max-w-screen-2xl mx-auto px-8">
            <div className="max-w-3xl mb-10">
              <span className="font-label font-bold uppercase tracking-[0.2em] text-primary text-xs mb-4 block">COMPLIANCE</span>
              <h2 className="text-[2.5rem] font-bold leading-tight font-headline">Built on open standards. Validated by regulation.</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-start">
              <div className="lg:sticky lg:top-32 space-y-4">
                <div className="flex gap-4 p-4 bg-surface-container-low rounded-xl">
                  <span className="text-primary font-bold font-headline min-w-fit">CSC v2.0.0.2</span>
                  <p className="text-sm text-secondary font-body">Cloud Signature Consortium API standard (all 6 endpoints)</p>
                </div>
                <div className="flex gap-4 p-4 bg-surface-container-low rounded-xl">
                  <span className="text-primary font-bold font-headline min-w-fit">eIDAS</span>
                  <p className="text-sm text-secondary font-body">EU Regulation 910/2014 on electronic identification and trust services</p>
                </div>
                <div className="flex gap-4 p-4 bg-surface-container-low rounded-xl">
                  <span className="text-primary font-bold font-headline min-w-fit">PAdES B-T</span>
                  <p className="text-sm text-secondary font-body">ETSI EN 319 142 (PDF Advanced Electronic Signatures with timestamp)</p>
                </div>
                <div className="flex gap-4 p-4 bg-surface-container-low rounded-xl">
                  <span className="text-primary font-bold font-headline min-w-fit">RFC 5652</span>
                  <p className="text-sm text-secondary font-body">Cryptographic Message Syntax (CMS/PKCS#7)</p>
                </div>
                <div className="flex gap-4 p-4 bg-surface-container-low rounded-xl">
                  <span className="text-primary font-bold font-headline min-w-fit">RFC 3161</span>
                  <p className="text-sm text-secondary font-body">Time-Stamp Protocol</p>
                </div>
                <div className="flex gap-4 p-4 bg-surface-container-low rounded-xl">
                  <span className="text-primary font-bold font-headline min-w-fit">RFC 6749</span>
                  <p className="text-sm text-secondary font-body">OAuth 2.0 Authorization Framework</p>
                </div>
                <div className="flex gap-4 p-4 bg-surface-container-low rounded-xl">
                  <span className="text-primary font-bold font-headline min-w-fit">SCAL2</span>
                  <p className="text-sm text-secondary font-body">Sole Control Assurance Level 2 (qualified authorization)</p>
                </div>
              </div>
              <div className="space-y-8">
                <p className="text-secondary leading-relaxed font-body">
                  Every signature produced by this service is a <strong className="text-on-surface">PAdES Baseline-T</strong> signature - containing a qualified timestamp proving when the seal was applied. The CMS structure validates in Adobe Acrobat, DigiDoc4, and the EU DSS validation library.
                </p>
                <p className="text-secondary leading-relaxed font-body">
                  The SCAL2 authorization model means each sealing operation requires explicit credential authorization - not just an access token. This is the level required for qualified electronic seals under eIDAS.
                </p>
                <p className="text-secondary leading-relaxed font-body">
                  The hash-only architecture ensures full <strong className="text-on-surface">GDPR compliance</strong> - your document content never enters our infrastructure.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 11: PORTAL / DELIVERABLES ===== */}
        <section id="documentation" className="bg-surface-container-low py-16">
          <div className="max-w-screen-2xl mx-auto px-8">
            <div className="max-w-3xl mb-10">
              <span className="font-label font-bold uppercase tracking-[0.2em] text-primary text-xs mb-4 block">DOCUMENTATION &amp; RESOURCES</span>
              <h2 className="text-[2.5rem] font-bold leading-tight font-headline">Everything built. Everything accessible.</h2>
              <p className="text-secondary leading-relaxed mt-4 font-body">
                Every deliverable from this prototype is documented, tested, and accessible. All source code and documentation lives on GitHub.
              </p>
            </div>

            {/* GitHub Repository - hero card */}
            <a href="https://github.com/keeltekool/sk-e-seal-prototype" target="_blank" rel="noopener noreferrer" className="bg-surface-container-lowest p-10 rounded-xl group hover:bg-surface-container-high transition-all duration-300 block mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-surface-container-low rounded-xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <span className="material-symbols-outlined text-primary text-3xl">code</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-headline">keeltekool/sk-e-seal-prototype</h3>
                    <p className="text-sm text-secondary font-body">Full source code, documentation, SDK, scripts - MIT licensed</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-primary text-2xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </div>
            </a>

            {/* Documentation grid */}
            <h3 className="font-bold text-lg mb-6 font-headline">Documentation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
              <a href="https://github.com/keeltekool/sk-e-seal-prototype/blob/master/docs/architecture.md" target="_blank" rel="noopener noreferrer" className="bg-surface-container-lowest p-6 rounded-xl group hover:bg-surface-container-high transition-all duration-300 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">architecture</span>
                  <div>
                    <h4 className="font-bold font-headline">Architecture</h4>
                    <p className="text-sm text-secondary font-body">Component diagram, data flow, design decisions, database schema</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-secondary group-hover:text-primary transition-colors">open_in_new</span>
              </a>
              <a href="https://github.com/keeltekool/sk-e-seal-prototype/blob/master/docs/csc-v2-mapping.md" target="_blank" rel="noopener noreferrer" className="bg-surface-container-lowest p-6 rounded-xl group hover:bg-surface-container-high transition-all duration-300 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">map</span>
                  <div>
                    <h4 className="font-bold font-headline">CSC v2 Mapping</h4>
                    <p className="text-sm text-secondary font-body">Every CSC v2 spec section mapped to exact file and line number</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-secondary group-hover:text-primary transition-colors">open_in_new</span>
              </a>
              <a href="https://github.com/keeltekool/sk-e-seal-prototype/blob/master/docs/prototype-vs-production.md" target="_blank" rel="noopener noreferrer" className="bg-surface-container-lowest p-6 rounded-xl group hover:bg-surface-container-high transition-all duration-300 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">compare_arrows</span>
                  <div>
                    <h4 className="font-bold font-headline">Prototype vs Production</h4>
                    <p className="text-sm text-secondary font-body">What&apos;s real, what&apos;s simplified, full upgrade path</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-secondary group-hover:text-primary transition-colors">open_in_new</span>
              </a>
              <a href="https://github.com/keeltekool/sk-e-seal-prototype/blob/master/docs/guides/seal-first-pdf.md" target="_blank" rel="noopener noreferrer" className="bg-surface-container-lowest p-6 rounded-xl group hover:bg-surface-container-high transition-all duration-300 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">play_circle</span>
                  <div>
                    <h4 className="font-bold font-headline">Seal Your First PDF</h4>
                    <p className="text-sm text-secondary font-body">Step-by-step quickstart guide - clone to sealed PDF</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-secondary group-hover:text-primary transition-colors">open_in_new</span>
              </a>
              <a href="https://github.com/keeltekool/sk-e-seal-prototype/blob/master/docs/guides/certificate-swap.md" target="_blank" rel="noopener noreferrer" className="bg-surface-container-lowest p-6 rounded-xl group hover:bg-surface-container-high transition-all duration-300 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">swap_horiz</span>
                  <div>
                    <h4 className="font-bold font-headline">Certificate Swap Guide</h4>
                    <p className="text-sm text-secondary font-body">Replace the test cert with a real SK .p12 certificate</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-secondary group-hover:text-primary transition-colors">open_in_new</span>
              </a>
              <a href="https://github.com/keeltekool/sk-e-seal-prototype/blob/master/README.md" target="_blank" rel="noopener noreferrer" className="bg-surface-container-lowest p-6 rounded-xl group hover:bg-surface-container-high transition-all duration-300 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">info</span>
                  <div>
                    <h4 className="font-bold font-headline">README</h4>
                    <p className="text-sm text-secondary font-body">Project overview, quick start, full documentation index</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-secondary group-hover:text-primary transition-colors">open_in_new</span>
              </a>
            </div>

            {/* Developer Tools grid */}
            <h3 className="font-bold text-lg mb-6 font-headline">Developer Tools</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
              <a href="/docs" className="bg-surface-container-lowest p-6 rounded-xl group hover:bg-surface-container-high transition-all duration-300 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">api</span>
                  <div>
                    <h4 className="font-bold font-headline">Swagger UI</h4>
                    <p className="text-sm text-secondary font-body">Interactive API explorer - test every endpoint in the browser</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-secondary group-hover:text-primary transition-colors">arrow_forward</span>
              </a>
              <a href="https://github.com/keeltekool/sk-e-seal-prototype/blob/master/public/openapi.yaml" target="_blank" rel="noopener noreferrer" className="bg-surface-container-lowest p-6 rounded-xl group hover:bg-surface-container-high transition-all duration-300 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">description</span>
                  <div>
                    <h4 className="font-bold font-headline">OpenAPI 3.1 Specification</h4>
                    <p className="text-sm text-secondary font-body">Machine-readable API definition - import into Postman</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-secondary group-hover:text-primary transition-colors">open_in_new</span>
              </a>
              <a href="https://github.com/keeltekool/sk-e-seal-prototype/tree/master/packages/client-sdk" target="_blank" rel="noopener noreferrer" className="bg-surface-container-lowest p-6 rounded-xl group hover:bg-surface-container-high transition-all duration-300 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">package_2</span>
                  <div>
                    <h4 className="font-bold font-headline">Client SDK</h4>
                    <p className="text-sm text-secondary font-body">Standalone TypeScript SDK - 8 modules, 23 tests, npm-ready</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-secondary group-hover:text-primary transition-colors">open_in_new</span>
              </a>
              <a href="https://github.com/keeltekool/sk-e-seal-prototype/blob/master/scripts/seal-demo.ts" target="_blank" rel="noopener noreferrer" className="bg-surface-container-lowest p-6 rounded-xl group hover:bg-surface-container-high transition-all duration-300 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-primary">terminal</span>
                  <div>
                    <h4 className="font-bold font-headline">CLI Demo</h4>
                    <p className="text-sm text-secondary font-body">End-to-end sealing from the command line</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-secondary group-hover:text-primary transition-colors">open_in_new</span>
              </a>
            </div>

            {/* SK Initiative Documents */}
            <h3 className="font-bold text-lg mb-6 font-headline">SK Initiative Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-container-lowest p-6 rounded-xl flex items-center gap-4">
                <span className="material-symbols-outlined text-primary">business_center</span>
                <div>
                  <h4 className="font-bold font-headline">Business Requirements v3</h4>
                  <p className="text-sm text-secondary font-body">10 requirements, pricing tiers, success criteria</p>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-6 rounded-xl flex items-center gap-4">
                <span className="material-symbols-outlined text-primary">engineering</span>
                <div>
                  <h4 className="font-bold font-headline">Technical Requirements v3</h4>
                  <p className="text-sm text-secondary font-body">CSC v2 endpoints, SCAL levels, architecture</p>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-6 rounded-xl flex items-center gap-4">
                <span className="material-symbols-outlined text-primary">account_tree</span>
                <div>
                  <h4 className="font-bold font-headline">Initiative Integration Doc</h4>
                  <p className="text-sm text-secondary font-body">12 deliverables, dependency graph, Go/No-Go criteria</p>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-6 rounded-xl flex items-center gap-4">
                <span className="material-symbols-outlined text-primary">monitoring</span>
                <div>
                  <h4 className="font-bold font-headline">Market Validation Master</h4>
                  <p className="text-sm text-secondary font-body">Full market analysis, competitor mapping</p>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-6 rounded-xl flex items-center gap-4">
                <span className="material-symbols-outlined text-primary">menu_book</span>
                <div>
                  <h4 className="font-bold font-headline">CSC v2 Specification (PDF)</h4>
                  <p className="text-sm text-secondary font-body">The 100-page standard this prototype implements</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 12: CTA BANNER ===== */}
        <section className="max-w-screen-2xl mx-auto px-8 pb-16 pt-8">
          <div className="bg-primary rounded-3xl p-16 relative overflow-hidden flex flex-col items-center text-center">
            {/* Dot pattern overlay */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="2" fill="white" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dots)" />
              </svg>
            </div>
            <h2 className="text-white text-4xl md:text-5xl font-bold mb-8 relative z-10 max-w-3xl font-headline">
              Ready to add qualified e-sealing to your platform?
            </h2>
            <p className="text-white/80 text-lg mb-12 relative z-10 max-w-xl font-body">
              Whether you&apos;re a bank sealing millions of statements, a platform embedding trust services, or a broker expanding your portfolio - we built this for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 relative z-10">
              <button className="bg-white text-primary px-10 py-5 rounded-full font-bold text-lg hover:bg-surface-container-low transition-all">
                Contact Sales
              </button>
              <a href="#demo" className="bg-transparent text-white border-2 border-white/30 px-10 py-5 rounded-full font-bold text-lg hover:bg-white/10 transition-all">
                Try the Demo
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ===== SECTION 13: FOOTER ===== */}
      <footer className="bg-surface border-t border-outline-variant/10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-8 py-16 max-w-screen-2xl mx-auto font-body text-sm leading-6 text-secondary">
          {/* Brand & Info */}
          <div className="space-y-6">
            <div className="text-xl font-bold text-[#f12f00] brand-logo">
              SK ID Solutions
            </div>
            <p className="max-w-xs">
              Leading provider of secure digital identity solutions and trust services in the Baltics and beyond.
            </p>
            <div className="flex gap-4">
              <span className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-secondary hover:text-primary transition-colors cursor-pointer">
                <span className="material-symbols-outlined">share</span>
              </span>
              <span className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-secondary hover:text-primary transition-colors cursor-pointer">
                <span className="material-symbols-outlined">alternate_email</span>
              </span>
            </div>
          </div>
          {/* Service */}
          <div>
            <h5 className="text-on-surface font-bold uppercase tracking-widest text-xs mb-6">Service</h5>
            <ul className="space-y-4">
              <li><span className="text-[#f12f00] font-semibold">Remote E-Seal</span></li>
              <li><a className="hover:text-[#f12f00] transition-colors" href="https://www.skidsolutions.eu/en/services/smart-id/" target="_blank" rel="noopener noreferrer">Smart-ID</a></li>
              <li><a className="hover:text-[#f12f00] transition-colors" href="https://www.skidsolutions.eu/en/services/mobile-id/" target="_blank" rel="noopener noreferrer">Mobile-ID</a></li>
              <li><a className="hover:text-[#f12f00] transition-colors" href="https://www.skidsolutions.eu/en/services/" target="_blank" rel="noopener noreferrer">Trust Services</a></li>
            </ul>
          </div>
          {/* Developers */}
          <div>
            <h5 className="text-on-surface font-bold uppercase tracking-widest text-xs mb-6">Developers</h5>
            <ul className="space-y-4">
              <li><a className="hover:text-[#f12f00] transition-colors" href="/docs">API Docs</a></li>
              <li><a className="hover:text-[#f12f00] transition-colors" href="https://github.com/keeltekool/sk-e-seal-prototype/tree/master/packages/client-sdk" target="_blank" rel="noopener noreferrer">SDK</a></li>
              <li><a className="hover:text-[#f12f00] transition-colors" href="https://github.com/keeltekool/sk-e-seal-prototype/blob/master/public/openapi.yaml" target="_blank" rel="noopener noreferrer">OpenAPI Spec</a></li>
              <li><a className="hover:text-[#f12f00] transition-colors" href="https://github.com/keeltekool/sk-e-seal-prototype" target="_blank" rel="noopener noreferrer">GitHub</a></li>
            </ul>
          </div>
          {/* Legal */}
          <div>
            <h5 className="text-on-surface font-bold uppercase tracking-widest text-xs mb-6">Legal</h5>
            <ul className="space-y-4">
              <li><a className="hover:text-[#f12f00] transition-colors underline decoration-2 underline-offset-4" href="#">Privacy Policy</a></li>
              <li><a className="hover:text-[#f12f00] transition-colors underline decoration-2 underline-offset-4" href="#">Terms of Service</a></li>
              <li><a className="hover:text-[#f12f00] transition-colors underline decoration-2 underline-offset-4" href="#">Security</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-outline-variant/10 py-8 px-8">
          <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-label">
            <p>&copy; 2026 SK ID Solutions AS</p>
            <div className="flex gap-8">
              <span>EU Trust List</span>
              <span>ISO/IEC 27001</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
