import * as forge from 'node-forge';
import type { SealClientConfig, SealStep, SealOptions, SealResult } from './types';
import { preparePdf, injectSignature } from './pdf';
import { computeHash } from './hash';
import { CscApiClient } from './api';
import { buildCmsSignedData, addTimestampToCms } from './cms';
import { getTimestamp, DEFAULT_TSA_URL } from './timestamp';

// 16KB placeholder for PAdES B-T (CMS + TSA response token needs more than default 8KB)
const PADES_BT_SIGNATURE_LENGTH = 16384;

/**
 * High-level client for the Qualified E-Seal by SK ID service.
 *
 * The PDF document never leaves the client — only the 32-byte hash
 * is sent to the signing service (CSC v2 hash-only model).
 */
export class SealClient {
  private config: SealClientConfig;
  private apiClient: CscApiClient;

  constructor(config: SealClientConfig) {
    this.config = config;
    this.apiClient = new CscApiClient(config);
  }

  async seal(pdfBytes: Uint8Array, options: SealOptions = {}): Promise<SealResult> {
    const steps: SealStep[] = [];
    const totalStart = performance.now();
    const { onStep } = options;

    function emitStep(step: SealStep) {
      steps.push(step);
      onStep?.(step);
    }

    // Prepare PDF with signature placeholder
    let start = performance.now();
    const prepared = await preparePdf(pdfBytes, PADES_BT_SIGNATURE_LENGTH);
    emitStep({
      name: 'placeholder_created',
      description: `Signature placeholder added to PDF (${pdfBytes.length} → ${prepared.preparedPdf.length} bytes)`,
      durationMs: Math.round(performance.now() - start),
      data: { inputSize: pdfBytes.length, preparedSize: prepared.preparedPdf.length, byteRange: prepared.byteRange },
    });

    // Compute hash (SignedAttributes DER → SHA-256)
    start = performance.now();
    const signingTime = new Date();
    const hashResult = computeHash(prepared.preparedPdf, prepared.byteRange, signingTime);
    const hashBase64 = hashResult.signedAttributesHash.toString('base64');
    emitStep({
      name: 'hash_computed',
      description: 'PDF byte range hashed, SignedAttributes built and hashed',
      durationMs: Math.round(performance.now() - start),
      data: {
        pdfHash: hashResult.pdfHash.toString('hex'),
        signedAttributesHash: hashResult.signedAttributesHash.toString('hex'),
      },
    });

    // Get access token
    start = performance.now();
    const tokenResponse = await this.apiClient.getToken();
    const accessToken = tokenResponse.access_token;
    emitStep({
      name: 'token_obtained',
      description: 'OAuth2 access token obtained',
      durationMs: Math.round(performance.now() - start),
      data: { expiresIn: tokenResponse.expires_in },
    });

    // Parallelize: credential info fetch + authorize→signHash chain
    // credentialInfo only needs accessToken, doesn't depend on signing result
    start = performance.now();
    const [credInfo, rawSignature] = await Promise.all([
      this.apiClient.getCredentialInfo(accessToken),
      this.apiClient.authorize(accessToken, hashBase64).then(async (authResponse) => {
        emitStep({
          name: 'credential_authorized',
          description: 'Credential authorized via SCAL2 PIN → SAD token',
          durationMs: Math.round(performance.now() - start),
          data: { sadExpiresIn: authResponse.expiresIn },
        });

        const signStart = performance.now();
        const signResponse = await this.apiClient.signHash(accessToken, authResponse.SAD, hashBase64);
        const sig = Buffer.from(signResponse.signatures[0]!, 'base64');
        emitStep({
          name: 'hash_signed',
          description: `Hash signed via CSC v2 signHash (${sig.length} bytes)`,
          durationMs: Math.round(performance.now() - signStart),
          data: { signatureLength: sig.length },
        });
        return sig;
      }),
    ]);

    // Convert base64 DER certs to buffers (no PEM round-trip)
    const certDerBuffers = credInfo.cert.certificates.map((b64) => Buffer.from(b64, 'base64'));

    // Parse signing cert for issuer/serial (needed by CMS SignerInfo)
    const signingCertDer = certDerBuffers[0]!;
    const signingCert = forge.pki.certificateFromAsn1(
      forge.asn1.fromDer(signingCertDer.toString('binary')),
    );

    // Build CMS SignedData
    start = performance.now();
    let cmsDer = buildCmsSignedData(rawSignature, hashResult.signedAttributesDer, signingCert, certDerBuffers);
    emitStep({
      name: 'cms_built',
      description: `CMS SignedData assembled (${cmsDer.length} bytes)`,
      durationMs: Math.round(performance.now() - start),
      data: { cmsLength: cmsDer.length, certificateCount: certDerBuffers.length },
    });

    // Add RFC 3161 timestamp (PAdES B → B-T)
    start = performance.now();
    const tsaUrl = this.config.tsaUrl || DEFAULT_TSA_URL;
    const timestampToken = await getTimestamp(rawSignature, tsaUrl);
    cmsDer = addTimestampToCms(cmsDer, timestampToken);
    emitStep({
      name: 'timestamp_added',
      description: `RFC 3161 timestamp added (${timestampToken.length} bytes from TSA)`,
      durationMs: Math.round(performance.now() - start),
      data: { timestampTokenLength: timestampToken.length, tsaUrl, finalCmsLength: cmsDer.length },
    });

    // Inject CMS into PDF placeholder
    start = performance.now();
    const cmsHex = cmsDer.toString('hex');
    const sealedPdf = injectSignature(prepared, cmsHex);
    emitStep({
      name: 'pdf_sealed',
      description: `PDF sealed (${sealedPdf.length} bytes)`,
      durationMs: Math.round(performance.now() - start),
      data: { sealedSize: sealedPdf.length },
    });

    return {
      sealedPdf,
      steps,
      totalDurationMs: Math.round(performance.now() - totalStart),
    };
  }
}
