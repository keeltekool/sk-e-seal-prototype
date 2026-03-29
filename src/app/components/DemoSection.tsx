'use client';

import { useState, useRef, useCallback } from 'react';

interface StepData {
  name: string;
  description: string;
  durationMs: number;
  data: Record<string, unknown>;
}

interface CompletionData {
  totalDurationMs: number;
  originalSize: number;
  sealedSize: number;
  sealedPdfBase64: string;
}

const STEP_LABELS: Record<string, string> = {
  placeholder_created: 'PDF Placeholder',
  hash_computed: 'Hash Computation',
  token_obtained: 'OAuth 2.0 Token',
  credential_authorized: 'SCAL2 Authorization',
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

const STEP_CODE: Record<string, string> = {
  placeholder_created: `const prepared = await preparePdf(pdfBytes, 16384);
// Adds a 16KB /Sig placeholder dictionary to the PDF`,
  hash_computed: `const hashResult = computeHash(
  prepared.preparedPdf,
  prepared.byteRange,
  new Date()
);
// SHA-256 of PDF byte ranges → SignedAttributes DER → SHA-256`,
  token_obtained: `POST /oauth2/token
Content-Type: application/x-www-form-urlencoded
grant_type=client_credentials&client_id=...&client_secret=...`,
  credential_authorized: `POST /csc/v2/credentials/authorize
{ "credentialID": "...", "PIN": "...",
  "hash": ["<signedAttributesHash>"],
  "hashAlgo": "2.16.840.1.101.3.4.2.1" }
// Returns SAD token (5 min TTL, single-use)`,
  hash_signed: `POST /csc/v2/signatures/signHash
{ "credentialID": "...", "SAD": "...",
  "hash": ["<signedAttributesHash>"],
  "hashAlgo": "2.16.840.1.101.3.4.2.1",
  "signAlgo": "1.2.840.113549.1.1.1" }
// RSA PKCS#1 v1.5 signature`,
  cms_built: `const cmsDer = buildCmsSignedData(
  rawSignature, signedAttributesDer,
  signingCert, certDerBuffers
);
// ASN.1 ContentInfo → SignedData → SignerInfo`,
  timestamp_added: `const tsToken = await getTimestamp(rawSignature, tsaUrl);
const cmsFinal = addTimestampToCms(cmsDer, tsToken);
// RFC 3161 TSA request → unsigned attribute OID 1.2.840.113549.1.9.16.2.14`,
  pdf_sealed: `const sealedPdf = injectSignature(prepared, cmsHex);
// CMS hex injected into PDF /Contents placeholder
// Output: PAdES B-T signed PDF`,
};

const STEP_SPEC: Record<string, string> = {
  placeholder_created: 'PAdES (ETSI EN 319 142)',
  hash_computed: 'RFC 5652 §11 — SignedAttributes',
  token_obtained: 'CSC v2 §8 — OAuth 2.0',
  credential_authorized: 'CSC v2 §11.4 — credentials/authorize',
  hash_signed: 'CSC v2 §11.7 — signatures/signHash',
  cms_built: 'RFC 5652 — CMS SignedData',
  timestamp_added: 'RFC 3161 — Time-Stamp Protocol',
  pdf_sealed: 'ETSI EN 319 142 — PAdES B-T',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DemoSection() {
  const [file, setFile] = useState<File | null>(null);
  const [steps, setSteps] = useState<StepData[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [completion, setCompletion] = useState<CompletionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSealing, setIsSealing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File too large (max 10MB).');
      return;
    }
    setFile(f);
    setError(null);
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

  const startSealing = async () => {
    if (!file) return;
    setIsSealing(true);
    setSteps([]);
    setCompletion(null);
    setError(null);
    setExpandedStep(null);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('/api/demo/seal', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Sealing failed');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (currentEvent === 'step') {
              setSteps(prev => [...prev, data as StepData]);
            } else if (currentEvent === 'complete') {
              setCompletion(data as CompletionData);
            } else if (currentEvent === 'error') {
              setError(data.message);
            }
            currentEvent = '';
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sealing failed');
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

  return (
    <div className="space-y-8">
      {/* Upload zone */}
      {!isSealing && !completion && (
        <div
          className={`relative rounded-xl p-16 text-center transition-all duration-300 cursor-pointer ${
            isDragging
              ? 'bg-primary/5'
              : file
                ? 'bg-surface-container-lowest'
                : 'bg-surface-container-lowest'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <span className="material-symbols-outlined text-primary text-5xl mb-4 block">
            {file ? 'picture_as_pdf' : 'upload_file'}
          </span>
          {file ? (
            <>
              <p className="text-lg font-bold font-headline">{file.name}</p>
              <p className="text-sm text-secondary mt-1 font-body">{formatBytes(file.size)}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startSealing();
                }}
                className="mt-8 px-8 py-4 bg-primary text-on-primary rounded-full font-bold text-base hover:opacity-90 transition-all inline-flex items-center gap-2"
              >
                Seal This Document
                <span className="material-symbols-outlined">play_arrow</span>
              </button>
            </>
          ) : (
            <>
              <p className="text-lg font-bold font-headline">Drop a PDF here</p>
              <p className="text-sm text-secondary mt-1 font-body">or click to browse (max 10MB)</p>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-error-container text-on-error-container p-6 rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <p className="font-body">{error}</p>
        </div>
      )}

      {/* Process X-Ray */}
      {(steps.length > 0 || isSealing) && (
        <div className="bg-surface-container-lowest rounded-xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">biotech</span>
              Process X-Ray
            </h3>
            {isSealing && !completion && (
              <div className="flex items-center gap-2 text-sm text-secondary font-body">
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Sealing in progress...
              </div>
            )}
            {completion && (
              <span className="text-sm text-secondary font-body">
                Total: {completion.totalDurationMs}ms
              </span>
            )}
          </div>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={step.name}>
                {/* Step row */}
                <div
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 cursor-pointer hover:bg-surface-container-high ${
                    expandedStep === step.name ? 'bg-surface-container-high' : ''
                  }`}
                  onClick={() => setExpandedStep(expandedStep === step.name ? null : step.name)}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <span className="material-symbols-outlined text-primary">
                    {STEP_ICONS[step.name] || 'check_circle'}
                  </span>
                  <span className="font-bold font-headline text-sm min-w-[180px]">
                    {STEP_LABELS[step.name] || step.name}
                  </span>
                  <span className="text-sm text-secondary font-body flex-1 truncate">
                    {step.description}
                  </span>
                  <span className="text-sm text-primary font-bold font-headline min-w-[60px] text-right">
                    {step.durationMs}ms
                  </span>
                  <span className="material-symbols-outlined text-secondary text-sm">
                    {expandedStep === step.name ? 'expand_less' : 'code'}
                  </span>
                </div>
                {/* Expanded details */}
                {expandedStep === step.name && (
                  <div className="ml-12 mr-4 mt-1 mb-3 p-6 bg-[#1b1c1b] rounded-xl text-sm space-y-4">
                    {/* Code snippet */}
                    <pre className="text-gray-300 overflow-x-auto">
                      <code>{STEP_CODE[step.name] || ''}</code>
                    </pre>
                    {/* Actual values */}
                    <div className="border-t border-white/10 pt-4 space-y-2">
                      {Object.entries(step.data).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="text-primary-fixed-dim">{key}:</span>
                          <span className="text-gray-400 break-all">
                            {typeof value === 'string' && value.length > 60
                              ? `${value.slice(0, 60)}...`
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* CSC v2 spec reference */}
                    <div className="border-t border-white/10 pt-3">
                      <span className="text-primary-fixed-dim text-xs">
                        Spec: {STEP_SPEC[step.name] || '—'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion: download + stats */}
      {completion && (
        <div className="bg-surface-container-lowest rounded-xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="font-bold font-headline text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">task_alt</span>
              Document Sealed
            </p>
            <p className="text-sm text-secondary font-body">
              {formatBytes(completion.originalSize)} → {formatBytes(completion.sealedSize)}
              <span className="text-primary ml-2">
                (+{formatBytes(completion.sealedSize - completion.originalSize)})
              </span>
            </p>
            <p className="text-sm text-secondary font-body">
              {steps.length} steps in {completion.totalDurationMs}ms
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={downloadSealed}
              className="px-8 py-4 bg-primary text-on-primary rounded-full font-bold text-base hover:opacity-90 transition-all inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined">download</span>
              Download Sealed PDF
            </button>
            <button
              onClick={() => {
                setFile(null);
                setSteps([]);
                setCompletion(null);
                setError(null);
                setExpandedStep(null);
              }}
              className="px-8 py-4 bg-surface-container-highest text-on-surface rounded-full font-bold text-base hover:bg-surface-container-high transition-all"
            >
              Seal Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
