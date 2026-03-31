import { createHash } from 'crypto';
import * as forge from 'node-forge';
import { OID_CONTENT_TYPE, OID_DATA, OID_MESSAGE_DIGEST, OID_SIGNING_TIME, OID_SIGNING_CERTIFICATE_V2, sha256AlgorithmId, derToBuffer, oidNode } from './asn1-helpers';

const asn1 = forge.asn1;

/** Result of computing the hash for CSC v2 signHash */
export interface HashResult {
  /** SHA-256 of the PDF byte ranges (the messageDigest value) */
  pdfHash: Buffer;
  /** The DER-encoded SignedAttributes (needed later for CMS assembly) */
  signedAttributesDer: Buffer;
  /** SHA-256 of the DER-encoded SignedAttributes — THIS is what goes to signHash */
  signedAttributesHash: Buffer;
  /** The signing time used in SignedAttributes */
  signingTime: Date;
}

/**
 * Computes the hash to send to CSC v2 signHash endpoint.
 *
 * CRITICAL: For PAdES, you do NOT send the raw PDF hash. The correct flow:
 * 1. SHA-256 of PDF byte ranges → pdfHash
 * 2. Build CMS SignedAttributes containing pdfHash as messageDigest
 * 3. DER-encode SignedAttributes → hash THAT → signedAttributesHash
 * 4. Send signedAttributesHash to CSC signHash
 * (CSC v2 spec §11.7, node-signpdf issue #46)
 */
export function computeHash(
  preparedPdf: Uint8Array,
  byteRange: [number, number, number, number],
  signingTime: Date = new Date(),
  signingCertDer?: Buffer,
): HashResult {
  const hash = createHash('sha256');
  hash.update(Buffer.from(preparedPdf.buffer, preparedPdf.byteOffset + byteRange[0], byteRange[1]));
  hash.update(Buffer.from(preparedPdf.buffer, preparedPdf.byteOffset + byteRange[2], byteRange[3]));
  const pdfHash = hash.digest();

  const signedAttributesDer = buildSignedAttributesDer(pdfHash, signingTime, signingCertDer);
  const signedAttributesHash = createHash('sha256').update(signedAttributesDer).digest();

  return { pdfHash, signedAttributesDer, signedAttributesHash, signingTime };
}

/**
 * Builds CMS SignedAttributes as a DER-encoded SET.
 *
 * IMPORTANT: When hashing for signature verification, SignedAttributes must be
 * encoded as a SET (tag 0x31), not as the IMPLICIT [0] (tag 0xA0) used in SignerInfo.
 */
function buildSignedAttributesDer(pdfHash: Buffer, signingTime: Date, signingCertDer?: Buffer): Buffer {
  const contentTypeAttr = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    oidNode(OID_CONTENT_TYPE),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [oidNode(OID_DATA)]),
  ]);

  const signingTimeAttr = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    oidNode(OID_SIGNING_TIME),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.UTCTIME, false, formatUtcTime(signingTime)),
    ]),
  ]);

  const messageDigestAttr = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    oidNode(OID_MESSAGE_DIGEST),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, pdfHash.toString('binary')),
    ]),
  ]);

  const attrs: forge.asn1.Asn1[] = [contentTypeAttr, signingTimeAttr, messageDigestAttr];

  // ESS signing-certificate-v2 (RFC 5035) — required for PAdES-BASELINE-T
  // Binds the signature to a specific certificate via its SHA-256 hash
  if (signingCertDer) {
    const certHash = createHash('sha256').update(signingCertDer).digest();
    // ESSCertIDv2 ::= SEQUENCE { hashAlgorithm (DEFAULT sha256 — omit), certHash }
    const essCertIdV2 = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, certHash.toString('binary')),
    ]);
    // SigningCertificateV2 ::= SEQUENCE { certs SEQUENCE OF ESSCertIDv2 }
    const signingCertificateV2 = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [essCertIdV2]),
    ]);
    const signingCertAttr = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      oidNode(OID_SIGNING_CERTIFICATE_V2),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [signingCertificateV2]),
    ]);
    attrs.push(signingCertAttr);
  }

  const signedAttrs = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, attrs);

  return derToBuffer(asn1.toDer(signedAttrs));
}

/** Formats a Date as ASN.1 UTCTime (YYMMDDHHMMSSZ) */
function formatUtcTime(date: Date): string {
  const y = date.getUTCFullYear().toString().slice(-2);
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  const h = date.getUTCHours().toString().padStart(2, '0');
  const min = date.getUTCMinutes().toString().padStart(2, '0');
  const s = date.getUTCSeconds().toString().padStart(2, '0');
  return `${y}${m}${d}${h}${min}${s}Z`;
}
