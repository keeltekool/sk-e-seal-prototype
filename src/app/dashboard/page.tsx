'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Annotation } from '../components/Annotation';

// --- Types ---

interface TenantData {
  name: string;
  client_id: string;
  status: string;
  total_credentials: number;
  active_credentials: number;
  suspended_credentials: number;
}

interface CredentialData {
  credentialId: string;
  label: string;
  keyAlgorithm: string;
  keyLength: number;
  hashAlgorithm: string;
  scal: string;
  status: string;
  createdAt: string;
  certificate: {
    subject: string;
    issuer: string;
    organization: string;
    country: string;
    fingerprint: string;
  };
}

interface StepData {
  name: string;
  description: string;
  durationMs: number;
  data: Record<string, unknown>;
  executionContext: 'api' | 'client-sdk';
}

interface CompletionData {
  totalDurationMs: number;
  originalSize: number;
  sealedSize: number;
  sealedPdfBase64: string;
}

// --- Step Labels & Icons (reused from DemoSection pattern) ---

const STEP_LABELS: Record<string, string> = {
  placeholder_created: 'PDF Placeholder',
  hash_computed: 'Hash Computation',
  token_obtained: 'OAuth 2.0 Token Exchange',
  credential_authorized: 'SCAL2 Credential Authorization',
  hash_signed: 'Hash Signing',
  cms_built: 'CMS Assembly',
  timestamp_added: 'RFC 3161 Timestamp',
  pdf_sealed: 'PDF Sealed',
};

const STEP_ICONS: Record<string, string> = {
  placeholder_created: 'edit_document',
  hash_computed: 'tag',
  token_obtained: 'key',
  credential_authorized: 'verified_user',
  hash_signed: 'draw',
  cms_built: 'build',
  timestamp_added: 'schedule',
  pdf_sealed: 'task_alt',
};

const STEP_ENDPOINTS: Record<string, string> = {
  token_obtained: 'POST /oauth2/token',
  credential_authorized: 'POST /csc/v2/credentials/authorize',
  hash_signed: 'POST /csc/v2/signatures/signHash',
};

const STEP_ANNOTATIONS: Record<string, string> = {
  placeholder_created: 'Client-side: the SDK adds a 16KB signature placeholder to the PDF using pdf-lib. The document stays on your infrastructure.',
  hash_computed: 'Client-side: SHA-256 of the PDF byte ranges, then DER-encoded SignedAttributes (including ESS signing-certificate-v2), then SHA-256 again. Only this 32-byte hash leaves your infrastructure.',
  token_obtained: 'API call: OAuth 2.0 Client Credentials (RFC 6749 §4.4). Your client_id and client_secret authenticate the request. Returns a Bearer token valid for 1 hour.',
  credential_authorized: 'API call: SCAL2 authorization (EN 419 241-1). The PIN proves sole control of the signing key. Returns a single-use SAD token valid for 5 minutes.',
  hash_signed: 'API call: the hash is signed inside the HSM using RSA PKCS#1 v1.5. The private key never leaves the certified hardware (QSCD).',
  cms_built: 'Client-side: the SDK assembles a PKCS#7/CMS SignedData container (RFC 5652) with the raw signature, certificate chain, and SignedAttributes.',
  timestamp_added: 'Client-side: the SDK requests an RFC 3161 timestamp from a Qualified TSA and embeds it as an unsigned attribute in the CMS.',
  pdf_sealed: 'Client-side: the final CMS hex is injected into the PDF placeholder. Output: PAdES B-T compliant sealed PDF.',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-xs text-primary/60 hover:text-primary font-label uppercase tracking-wider inline-flex items-center gap-1"
    >
      <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// --- Main Dashboard Page ---

export default function DashboardPage() {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [credentials, setCredentials] = useState<CredentialData[]>([]);
  const [expandedCred, setExpandedCred] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Credential state
  const [clientId, setClientId] = useState<string>('');
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Playground state
  const [selectedCredential, setSelectedCredential] = useState<string>('');
  const [playgroundSecret, setPlaygroundSecret] = useState<string>('');
  const [playgroundPin, setPlaygroundPin] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [steps, setSteps] = useState<StepData[]>([]);
  const [completion, setCompletion] = useState<CompletionData | null>(null);
  const [sealError, setSealError] = useState<string | null>(null);
  const [isSealing, setIsSealing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch data on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/tenant').then(r => r.json()),
      fetch('/api/dashboard/credentials').then(r => r.json()),
    ]).then(([tenantRes, credRes]) => {
      setTenant(tenantRes.tenant);
      setCredentials(credRes.credentials || []);
      setClientId(tenantRes.tenant?.client_id || '');
      const activeCredentials = (credRes.credentials || []).filter((c: CredentialData) => c.status === 'active');
      if (activeCredentials.length > 0) setSelectedCredential(activeCredentials[0].credentialId);
      setLoading(false);
    });
  }, []);

  // Generate OAuth secret
  const generateOAuth = async () => {
    setGenerating(true);
    const res = await fetch('/api/dashboard/oauth/generate', { method: 'POST' });
    const data = await res.json();
    setGeneratedSecret(data.clientSecret);
    setPlaygroundSecret(data.clientSecret);
    setGenerating(false);
  };

  // Generate PIN
  const generatePin = async () => {
    setGenerating(true);
    const res = await fetch('/api/dashboard/pin/generate', { method: 'POST' });
    const data = await res.json();
    setGeneratedPin(data.pin);
    setPlaygroundPin(data.pin);
    setGenerating(false);
  };

  // File handling
  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') { setSealError('Please upload a PDF file.'); return; }
    if (f.size > 10 * 1024 * 1024) { setSealError('File too large (max 10MB).'); return; }
    setFile(f);
    setSealError(null);
    setSteps([]);
    setCompletion(null);
    setExpandedStep(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // Seal
  const startSealing = async () => {
    if (!file || !playgroundSecret || !playgroundPin || !selectedCredential) {
      setSealError('Generate your OAuth credentials and PIN first, then select a credential.');
      return;
    }
    setIsSealing(true);
    setSteps([]);
    setCompletion(null);
    setSealError(null);
    setExpandedStep(null);

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('clientId', clientId);
    formData.append('clientSecret', playgroundSecret);
    formData.append('pin', playgroundPin);
    formData.append('credentialId', selectedCredential);

    try {
      const response = await fetch('/api/dashboard/seal', { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Sealing failed');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const currentEvent = { value: '' };

      const processLines = (lines: string[]) => {
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent.value = line.slice(7);
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (currentEvent.value === 'step') setSteps(prev => [...prev, data as StepData]);
            else if (currentEvent.value === 'complete') setCompletion(data as CompletionData);
            else if (currentEvent.value === 'error') setSealError(data.message);
            currentEvent.value = '';
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        processLines(lines);
      }
      if (buffer.trim()) processLines(buffer.split('\n'));
    } catch (err) {
      setSealError(err instanceof Error ? err.message : 'Sealing failed');
    } finally {
      setIsSealing(false);
    }
  };

  const downloadSealed = () => {
    if (!completion) return;
    const bytes = Uint8Array.from(atob(completion.sealedPdfBase64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? file.name.replace(/\.pdf$/i, '-sealed.pdf') : 'sealed.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const activeCredentials = credentials.filter(c => c.status === 'active');

  return (
    <>
      {/* Navbar */}
      <nav className="sticky top-0 w-full z-50 bg-white/90 backdrop-blur-md">
        <div className="flex justify-between items-center px-8 py-4 max-w-screen-2xl mx-auto">
          <a href="/" className="text-2xl font-black text-[#f12f00] brand-logo">Qualified E-Seal</a>
          <div className="hidden md:flex items-center space-x-8">
            <a className="font-headline font-bold uppercase tracking-[0.2em] text-sm text-[#f12f00]" href="/dashboard">Developer Portal</a>
            <a className="font-headline font-bold uppercase tracking-[0.2em] text-sm text-secondary hover:text-[#f12f00] transition-colors duration-200" href="/#demo">Live Demo</a>
            <a className="font-headline font-bold uppercase tracking-[0.2em] text-sm text-secondary hover:text-[#f12f00] transition-colors duration-200" href="/docs">API Docs</a>
            <a className="font-headline font-bold uppercase tracking-[0.2em] text-sm text-secondary hover:text-[#f12f00] transition-colors duration-200" href="/#documentation">Documentation</a>
          </div>
        </div>
      </nav>

      <main className="max-w-screen-xl mx-auto px-8 py-12 space-y-16">
        {/* Page Header */}
        <div>
          <span className="inline-block font-label font-bold uppercase tracking-[0.2em] text-primary text-xs mb-4">DEVELOPER PORTAL</span>
          <h1 className="text-[2.5rem] leading-tight font-bold font-headline">E-Seal API Credentials & Integration</h1>
          <p className="text-secondary font-body mt-4 max-w-2xl">
            Generate your API credentials, view your seal certificates, and test the full CSC v2 integration flow.
          </p>
        </div>

        {/* ===== SECTION A: TENANT OVERVIEW ===== */}
        <section>
          <div className="bg-surface-container-lowest rounded-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-primary text-2xl">domain</span>
              <h2 className="text-xl font-bold font-headline">Tenant Overview</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-secondary font-label uppercase tracking-wider mb-1">Organization</p>
                <p className="font-bold font-headline">{tenant?.name}</p>
              </div>
              <div>
                <p className="text-xs text-secondary font-label uppercase tracking-wider mb-1">Tenant ID</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-surface-container-high px-2 py-0.5 rounded">{tenant?.client_id}</code>
                  <CopyButton text={tenant?.client_id || ''} />
                </div>
              </div>
              <div>
                <p className="text-xs text-secondary font-label uppercase tracking-wider mb-1">Status</p>
                <span className="inline-flex items-center gap-1 text-sm font-bold">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {tenant?.status}
                </span>
              </div>
              <div>
                <p className="text-xs text-secondary font-label uppercase tracking-wider mb-1">Seal Credentials</p>
                <p className="font-bold font-headline">
                  {tenant?.total_credentials} <span className="text-sm font-normal text-secondary">({tenant?.active_credentials} active, {tenant?.suspended_credentials} suspended)</span>
                </p>
              </div>
            </div>
          </div>
          <Annotation>
            In the live service, this tenant is created during QTSP onboarding. An authorized representative with legal signing rights (esindusõigus) or power of attorney completes identity verification and due diligence. They then delegate API access to technical staff through this portal — with a full audit trail. This demo skips the legal onboarding and starts from the point where a developer has been granted access.
          </Annotation>
        </section>

        {/* ===== SECTION B: API CREDENTIALS ===== */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-2xl">key</span>
            <h2 className="text-xl font-bold font-headline">API Credentials</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* OAuth 2.0 */}
            <div className="bg-surface-container-lowest rounded-xl p-8">
              <h3 className="font-bold font-headline mb-1">OAuth 2.0 Client Credentials</h3>
              <p className="text-sm text-secondary font-body mb-6">Machine-to-machine authentication for the CSC v2 API</p>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-secondary font-label uppercase tracking-wider mb-1">Client ID</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-surface-container-high px-3 py-1.5 rounded flex-1">{clientId}</code>
                    <CopyButton text={clientId} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-secondary font-label uppercase tracking-wider mb-1">Client Secret</p>
                  {generatedSecret ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-primary/5 border border-primary/20 px-3 py-1.5 rounded flex-1 break-all">{generatedSecret}</code>
                        <CopyButton text={generatedSecret} />
                      </div>
                      <p className="text-xs text-primary font-label flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        Save now — will not be shown again
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-secondary/50 font-body italic">Hidden. Generate to get a new secret.</p>
                  )}
                </div>
                <button
                  onClick={generateOAuth}
                  disabled={generating}
                  className="px-6 py-2.5 bg-primary text-on-primary rounded-full font-bold text-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                >
                  {generatedSecret ? 'Regenerate Secret' : 'Generate Secret'}
                </button>
              </div>
            </div>

            {/* SCAL2 PIN */}
            <div className="bg-surface-container-lowest rounded-xl p-8">
              <h3 className="font-bold font-headline mb-1">SCAL2 Authorization PIN</h3>
              <p className="text-sm text-secondary font-body mb-6">Per-operation authorization for signing key access</p>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-secondary font-label uppercase tracking-wider mb-1">PIN</p>
                  {generatedPin ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="text-2xl font-mono font-bold bg-primary/5 border border-primary/20 px-6 py-3 rounded tracking-[0.3em]">{generatedPin}</code>
                        <CopyButton text={generatedPin} />
                      </div>
                      <p className="text-xs text-primary font-label flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        Save now — will not be shown again
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-secondary/50 font-body italic">Hidden. Generate to get a new PIN.</p>
                  )}
                </div>
                <button
                  onClick={generatePin}
                  disabled={generating}
                  className="px-6 py-2.5 bg-primary text-on-primary rounded-full font-bold text-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                >
                  {generatedPin ? 'Regenerate PIN' : 'Generate PIN'}
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
            <Annotation>
              OAuth 2.0 Client Credentials (RFC 6749 §4.4) authenticate your system to the e-seal API. In production, these are bound to the legal entity that completed onboarding. Rotating the secret immediately invalidates all active access tokens.
            </Annotation>
            <Annotation>
              The PIN is the Sole Control Assurance Level 2 (SCAL2) component required by EN 419 241-1 for qualified electronic seals. Each signing operation requires explicit PIN-based authorization — this ensures the legal entity retains sole control over their signing keys, even though the keys are hosted remotely in the QTSP&apos;s HSM. The PIN is not a password — it&apos;s a cryptographic authorization factor.
            </Annotation>
          </div>
        </section>

        {/* ===== SECTION C: SEAL CREDENTIALS ===== */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-2xl">badge</span>
            <h2 className="text-xl font-bold font-headline">Seal Credentials</h2>
          </div>

          <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_120px_100px_80px_80px] gap-4 px-8 py-4 bg-surface-container-low text-xs text-secondary font-label uppercase tracking-wider">
              <span>Credential ID</span>
              <span>Label</span>
              <span>Key</span>
              <span>Hash</span>
              <span>SCAL</span>
              <span>Status</span>
            </div>

            {credentials.map(cred => (
              <div key={cred.credentialId}>
                <div
                  className="grid grid-cols-[1fr_1fr_120px_100px_80px_80px] gap-4 px-8 py-4 items-center cursor-pointer hover:bg-surface-container-high transition-colors"
                  onClick={() => setExpandedCred(expandedCred === cred.credentialId ? null : cred.credentialId)}
                >
                  <code className="text-sm font-mono">{cred.credentialId}</code>
                  <span className="text-sm font-body">{cred.label}</span>
                  <span className="text-sm font-body">{cred.keyAlgorithm} {cred.keyLength}</span>
                  <span className="text-sm font-body">{cred.hashAlgorithm}</span>
                  <span className="text-sm font-body">{cred.scal}</span>
                  <span className={`inline-flex items-center gap-1 text-sm font-bold ${cred.status === 'active' ? 'text-green-600' : 'text-amber-600'}`}>
                    <span className={`w-2 h-2 rounded-full ${cred.status === 'active' ? 'bg-green-500' : 'bg-amber-500'}`} />
                    {cred.status}
                  </span>
                </div>
                {/* Expanded certificate details */}
                {expandedCred === cred.credentialId && cred.certificate && (
                  <div className="px-8 pb-6">
                    <div className="bg-surface-container-high rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-secondary font-label uppercase tracking-wider mb-1">Subject</p>
                        <p className="font-body">{cred.certificate.subject}</p>
                      </div>
                      <div>
                        <p className="text-xs text-secondary font-label uppercase tracking-wider mb-1">Issuer</p>
                        <p className="font-body">{cred.certificate.issuer}</p>
                      </div>
                      <div>
                        <p className="text-xs text-secondary font-label uppercase tracking-wider mb-1">Organization</p>
                        <p className="font-body">{cred.certificate.organization}</p>
                      </div>
                      <div>
                        <p className="text-xs text-secondary font-label uppercase tracking-wider mb-1">Country</p>
                        <p className="font-body">{cred.certificate.country}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs text-secondary font-label uppercase tracking-wider mb-1">SHA-256 Fingerprint</p>
                        <code className="text-xs font-mono break-all text-secondary">{cred.certificate.fingerprint}</code>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Annotation>
            Each credential represents a seal certificate stored inside a certified HSM (QSCD). The private key never leaves the hardware — only the credential ID is exposed to your application. Large organizations typically maintain multiple active credentials for different business processes (invoicing, contracts, regulatory filings). In production, certificates are issued by the QTSP&apos;s Certificate Authority and can be suspended or revoked through this portal.
          </Annotation>
        </section>

        {/* ===== SECTION D: SEAL PLAYGROUND ===== */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-2xl">science</span>
            <h2 className="text-xl font-bold font-headline">Seal Playground</h2>
          </div>
          <p className="text-secondary font-body mb-6">
            Test the full CSC v2 sealing flow with your generated credentials. Every API call is shown step by step.
          </p>

          {/* Credential selector */}
          {!isSealing && !completion && (
            <div className="bg-surface-container-lowest rounded-xl p-8 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="text-xs text-secondary font-label uppercase tracking-wider mb-2 block">Select Seal Credential</label>
                  <select
                    value={selectedCredential}
                    onChange={(e) => setSelectedCredential(e.target.value)}
                    className="w-full bg-surface-container-high rounded-lg px-4 py-2.5 font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {activeCredentials.map(c => (
                      <option key={c.credentialId} value={c.credentialId}>
                        {c.credentialId} — {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-secondary font-label uppercase tracking-wider">Credentials Status</p>
                  <div className="flex items-center gap-4 text-sm font-body">
                    <span className={`flex items-center gap-1 ${playgroundSecret ? 'text-green-600' : 'text-secondary/50'}`}>
                      <span className="material-symbols-outlined text-sm">{playgroundSecret ? 'check_circle' : 'radio_button_unchecked'}</span>
                      OAuth Secret
                    </span>
                    <span className={`flex items-center gap-1 ${playgroundPin ? 'text-green-600' : 'text-secondary/50'}`}>
                      <span className="material-symbols-outlined text-sm">{playgroundPin ? 'check_circle' : 'radio_button_unchecked'}</span>
                      SCAL2 PIN
                    </span>
                  </div>
                  {(!playgroundSecret || !playgroundPin) && (
                    <p className="text-xs text-primary/70 font-body italic">Generate credentials above before sealing.</p>
                  )}
                </div>
              </div>

              {/* Upload zone */}
              <div
                className={`relative rounded-xl p-12 text-center transition-all duration-300 cursor-pointer border-2 border-dashed ${
                  isDragging ? 'border-primary bg-primary/5' : file ? 'border-primary/30 bg-surface-container-low' : 'border-outline-variant/30 bg-surface-container-low'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <span className="material-symbols-outlined text-primary text-4xl mb-3 block">
                  {file ? 'picture_as_pdf' : 'upload_file'}
                </span>
                {file ? (
                  <>
                    <p className="text-lg font-bold font-headline">{file.name}</p>
                    <p className="text-sm text-secondary mt-1 font-body">{formatBytes(file.size)}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); startSealing(); }}
                      disabled={!playgroundSecret || !playgroundPin}
                      className="mt-6 px-8 py-3 bg-primary text-on-primary rounded-full font-bold text-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined">play_arrow</span>
                      Seal with {selectedCredential}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold font-headline">Drop a PDF here</p>
                    <p className="text-sm text-secondary mt-1 font-body">or click to browse (max 10MB)</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {sealError && (
            <div className="bg-red-50 text-red-800 p-4 rounded-xl flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined">error</span>
              <p className="font-body text-sm">{sealError}</p>
            </div>
          )}

          {/* Step-by-step flow */}
          {(steps.length > 0 || isSealing) && (
            <div className="bg-surface-container-lowest rounded-xl p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg font-headline flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">biotech</span>
                  CSC v2 Integration Flow
                </h3>
                {isSealing && !completion && (
                  <div className="flex items-center gap-2 text-sm text-secondary font-body">
                    <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    Sealing...
                  </div>
                )}
                {completion && (
                  <span className="text-sm text-secondary font-body">Total: {completion.totalDurationMs}ms</span>
                )}
              </div>

              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={step.name}>
                    <div
                      className={`flex items-center gap-3 p-4 rounded-xl transition-all cursor-pointer hover:bg-surface-container-high ${expandedStep === step.name ? 'bg-surface-container-high' : ''}`}
                      onClick={() => setExpandedStep(expandedStep === step.name ? null : step.name)}
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      {/* Context badge */}
                      <span className={`text-[10px] font-label uppercase tracking-wider px-2 py-0.5 rounded-full font-bold shrink-0 ${
                        step.executionContext === 'api' ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-secondary'
                      }`}>
                        {step.executionContext === 'api' ? 'API' : 'SDK'}
                      </span>
                      <span className="material-symbols-outlined text-primary shrink-0">
                        {STEP_ICONS[step.name] || 'check_circle'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold font-headline text-sm">{STEP_LABELS[step.name] || step.name}</span>
                        {STEP_ENDPOINTS[step.name] && (
                          <code className="ml-2 text-xs text-primary/60 font-mono">{STEP_ENDPOINTS[step.name]}</code>
                        )}
                      </div>
                      <span className="text-sm text-primary font-bold font-headline shrink-0">{step.durationMs}ms</span>
                      <span className="material-symbols-outlined text-secondary text-sm shrink-0">
                        {expandedStep === step.name ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>

                    {expandedStep === step.name && (
                      <div className="ml-20 mr-4 mt-1 mb-3 space-y-3">
                        {/* Step annotation */}
                        {STEP_ANNOTATIONS[step.name] && (
                          <p className="text-sm text-secondary/70 font-body italic border-l-2 border-primary/20 pl-3">
                            {STEP_ANNOTATIONS[step.name]}
                          </p>
                        )}
                        {/* Request/response data */}
                        <div className="bg-[#1b1c1b] rounded-xl p-4 space-y-2">
                          {Object.entries(step.data).map(([key, value]) => (
                            <div key={key} className="flex gap-2 text-xs">
                              <span className="text-primary-fixed-dim font-mono">{key}:</span>
                              <span className="text-gray-400 font-mono break-all">
                                {typeof value === 'string' && value.length > 80 ? `${value.slice(0, 80)}...` : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completion */}
          {completion && (
            <div className="bg-surface-container-lowest rounded-xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-1">
                <p className="font-bold font-headline text-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">task_alt</span>
                  Document Sealed
                </p>
                <p className="text-sm text-secondary font-body">
                  {formatBytes(completion.originalSize)} → {formatBytes(completion.sealedSize)}
                  <span className="text-primary ml-2">(+{formatBytes(completion.sealedSize - completion.originalSize)})</span>
                </p>
                <p className="text-sm text-secondary font-body">{steps.length} steps in {completion.totalDurationMs}ms</p>
              </div>
              <div className="flex gap-4">
                <button onClick={downloadSealed} className="px-8 py-3 bg-primary text-on-primary rounded-full font-bold text-sm hover:opacity-90 transition-all inline-flex items-center gap-2">
                  <span className="material-symbols-outlined">download</span>
                  Download Sealed PDF
                </button>
                <button
                  onClick={() => { setFile(null); setSteps([]); setCompletion(null); setSealError(null); setExpandedStep(null); }}
                  className="px-8 py-3 bg-surface-container-highest text-on-surface rounded-full font-bold text-sm hover:bg-surface-container-high transition-all"
                >
                  Seal Another
                </button>
              </div>
            </div>
          )}

          <Annotation>
            This playground executes the exact same CSC v2 flow that a production integration would use. Steps 1-3 are API calls to the e-seal service. Steps 4-5 happen entirely on the client side — the Client SDK handles CMS assembly, RFC 3161 timestamping, and PDF injection. The API never sees the document; it only signs a 32-byte hash.
          </Annotation>
        </section>
      </main>
    </>
  );
}
