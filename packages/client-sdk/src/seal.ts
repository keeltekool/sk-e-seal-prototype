import * as forge from 'node-forge';
import type { SealClientConfig, SealStep, SealOptions, SealResult } from './types';
import { preparePdf, injectSignature } from './pdf';
import { computeHash } from './hash';
import { CscApiClient } from './api';
import { buildCmsSignedData, addTimestampToCms } from './cms';
import { getTimestamp } from './timestamp';

// 16KB placeholder for PAdES B-T (CMS + TSA response token)
const PADES_BT_SIGNATURE_LENGTH = 16384;

/**
 * High-level client for the Qualified E-Seal by SK ID service.
 *
 * Orchestrates the full PDF sealing flow:
 * 1. Load PDF and add signature placeholder
 * 2. Compute SHA-256 of byte ranges, build CMS SignedAttributes
 * 3. Authenticate via OAuth2 (client_credentials)
 * 4. Authorize credential via SCAL2 PIN → SAD
 * 5. Send hash to CSC v2 signHash → get raw RSA signature
 * 6. Fetch signing certificate from credentials/info
 * 7. Build CMS SignedData container
 * 8. Add RFC 3161 timestamp (PAdES B-T)
 * 9. Inject CMS into PDF placeholder
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

  /**
   * Seals a PDF document with a qualified e-seal.
   *
   * @param pdfBytes - The original PDF as Uint8Array
   * @param options - Optional callbacks for progress tracking
   * @returns The sealed PDF and step metadata
   */
  async seal(
    pdfBytes: Uint8Array,
    options: SealOptions = {},
  ): Promise<SealResult> {
    const steps: SealStep[] = [];
    const totalStart = performance.now();
    const { onStep } = options;

    function emitStep(step: SealStep) {
      steps.push(step);
      onStep?.(step);
    }

    // Step 1: Load PDF
    let start = performance.now();
    emitStep({
      name: 'pdf_loaded',
      description: `PDF loaded (${pdfBytes.length} bytes)`,
      durationMs: Math.round(performance.now() - start),
      data: { sizeBytes: pdfBytes.length },
    });

    // Step 2: Add signature placeholder
    start = performance.now();
    const prepared = await preparePdf(pdfBytes, PADES_BT_SIGNATURE_LENGTH);
    emitStep({
      name: 'placeholder_created',
      description: 'Signature placeholder added to PDF',
      durationMs: Math.round(performance.now() - start),
      data: {
        preparedSizeBytes: prepared.preparedPdf.length,
        byteRange: prepared.byteRange,
        placeholderSizeBytes: prepared.signaturePlaceholderLength,
      },
    });

    // Step 3: Compute hash
    start = performance.now();
    const signingTime = new Date();
    const hashResult = computeHash(
      prepared.preparedPdf,
      prepared.byteRange,
      signingTime,
    );
    const hashBase64 = hashResult.signedAttributesHash.toString('base64');
    emitStep({
      name: 'hash_computed',
      description:
        'SHA-256 of PDF byte ranges computed, SignedAttributes built and hashed',
      durationMs: Math.round(performance.now() - start),
      data: {
        pdfHash: hashResult.pdfHash.toString('hex'),
        signedAttributesHash: hashResult.signedAttributesHash.toString('hex'),
        signingTime: signingTime.toISOString(),
      },
    });

    // Step 4: Get access token
    start = performance.now();
    const tokenResponse = await this.apiClient.getToken();
    const accessToken = tokenResponse.access_token;
    emitStep({
      name: 'token_obtained',
      description: 'OAuth2 access token obtained (client_credentials)',
      durationMs: Math.round(performance.now() - start),
      data: {
        tokenType: tokenResponse.token_type,
        expiresIn: tokenResponse.expires_in,
      },
    });

    // Step 5: Authorize credential (SCAL2 PIN → SAD)
    start = performance.now();
    const authResponse = await this.apiClient.authorize(
      accessToken,
      hashBase64,
    );
    emitStep({
      name: 'credential_authorized',
      description: 'Credential authorized via SCAL2 PIN → SAD token',
      durationMs: Math.round(performance.now() - start),
      data: { sadExpiresIn: authResponse.expiresIn },
    });

    // Step 6: Sign hash
    start = performance.now();
    const signResponse = await this.apiClient.signHash(
      accessToken,
      authResponse.SAD,
      hashBase64,
    );
    const signatureBase64 = signResponse.signatures[0]!;
    const rawSignature = Buffer.from(signatureBase64, 'base64');
    emitStep({
      name: 'hash_signed',
      description: `Hash signed via CSC v2 signHash (${rawSignature.length} bytes)`,
      durationMs: Math.round(performance.now() - start),
      data: {
        signatureLength: rawSignature.length,
      },
    });

    // Step 7: Get certificate chain for CMS assembly
    const credInfo = await this.apiClient.getCredentialInfo(accessToken);
    const certDerBase64List = credInfo.cert.certificates;

    // Convert base64 DER certs to PEM
    const certPems = certDerBase64List.map((b64) => {
      const derBytes = forge.util.decode64(b64);
      const asn1 = forge.asn1.fromDer(derBytes);
      const cert = forge.pki.certificateFromAsn1(asn1);
      return forge.pki.certificateToPem(cert);
    });
    const signingCertPem = certPems[0]!;
    const chainPems = certPems.slice(1);

    // Step 8: Build CMS SignedData
    start = performance.now();
    let cmsDer = buildCmsSignedData(
      rawSignature,
      hashResult.signedAttributesDer,
      signingCertPem,
      chainPems,
    );
    emitStep({
      name: 'cms_built',
      description: `CMS SignedData assembled (${cmsDer.length} bytes)`,
      durationMs: Math.round(performance.now() - start),
      data: {
        cmsLength: cmsDer.length,
        certificateCount: certPems.length,
      },
    });

    // Step 9: Add RFC 3161 timestamp
    start = performance.now();
    const tsaUrl = this.config.tsaUrl || 'https://freetsa.org/tsr';
    const timestampToken = await getTimestamp(rawSignature, tsaUrl);
    cmsDer = addTimestampToCms(cmsDer, timestampToken);
    emitStep({
      name: 'timestamp_added',
      description: `RFC 3161 timestamp added (${timestampToken.length} bytes from TSA)`,
      durationMs: Math.round(performance.now() - start),
      data: {
        timestampTokenLength: timestampToken.length,
        tsaUrl,
        finalCmsLength: cmsDer.length,
      },
    });

    // Step 10: Inject CMS into PDF
    start = performance.now();
    const cmsHex = cmsDer.toString('hex');
    const sealedPdf = injectSignature(
      prepared.preparedPdf,
      cmsHex,
      prepared.signaturePlaceholderOffset,
      prepared.signaturePlaceholderLength,
    );
    emitStep({
      name: 'pdf_sealed',
      description: `PDF sealed (${sealedPdf.length} bytes)`,
      durationMs: Math.round(performance.now() - start),
      data: {
        sealedSizeBytes: sealedPdf.length,
        cmsHexLength: cmsHex.length,
      },
    });

    return {
      sealedPdf,
      steps,
      totalDurationMs: Math.round(performance.now() - totalStart),
    };
  }
}
