import { createHash } from 'crypto';
import * as forge from 'node-forge';

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
 * 1. Compute SHA-256 of PDF byte ranges → pdfHash
 * 2. Build CMS SignedAttributes containing pdfHash as messageDigest
 * 3. DER-encode SignedAttributes → hash THAT → signedAttributesHash
 * 4. Send signedAttributesHash to CSC signHash
 *
 * (CSC v2 spec Section 11.7, node-signpdf issue #46)
 *
 * @param preparedPdf - The PDF bytes with signature placeholder
 * @param byteRange - [offset1, length1, offset2, length2] from preparePdf()
 * @param signingTime - Optional signing time (defaults to now)
 */
export function computeHash(
  preparedPdf: Uint8Array,
  byteRange: [number, number, number, number],
  signingTime: Date = new Date(),
): HashResult {
  // Step 1: Compute SHA-256 of the PDF byte ranges
  // The byte ranges cover everything EXCEPT the signature placeholder
  const hash = createHash('sha256');
  hash.update(
    Buffer.from(
      preparedPdf.buffer,
      preparedPdf.byteOffset + byteRange[0],
      byteRange[1],
    ),
  );
  hash.update(
    Buffer.from(
      preparedPdf.buffer,
      preparedPdf.byteOffset + byteRange[2],
      byteRange[3],
    ),
  );
  const pdfHash = hash.digest();

  // Step 2: Build CMS SignedAttributes
  const signedAttributesDer = buildSignedAttributesDer(pdfHash, signingTime);

  // Step 3: Hash the DER-encoded SignedAttributes
  const signedAttributesHash = createHash('sha256')
    .update(signedAttributesDer)
    .digest();

  return {
    pdfHash,
    signedAttributesDer,
    signedAttributesHash,
    signingTime,
  };
}

/**
 * Builds CMS SignedAttributes as a DER-encoded SET.
 *
 * Required attributes per CMS (RFC 5652) and PAdES:
 * - contentType (OID 1.2.840.113549.1.9.3) = id-data (OID 1.2.840.113549.1.7.1)
 * - messageDigest (OID 1.2.840.113549.1.9.4) = SHA-256 of PDF byte ranges
 * - signingTime (OID 1.2.840.113549.1.9.5) = UTC time
 *
 * IMPORTANT: When hashing for signature verification, SignedAttributes must be
 * encoded as a SET (tag 0x31), not as the IMPLICIT [0] (tag 0xA0) used in SignerInfo.
 */
function buildSignedAttributesDer(
  pdfHash: Buffer,
  signingTime: Date,
): Buffer {
  const asn1 = forge.asn1;

  // OIDs
  const oidContentType = asn1.oidToDer('1.2.840.113549.1.9.3').getBytes();
  const oidMessageDigest = asn1.oidToDer('1.2.840.113549.1.9.4').getBytes();
  const oidSigningTime = asn1.oidToDer('1.2.840.113549.1.9.5').getBytes();
  const oidData = asn1.oidToDer('1.2.840.113549.1.7.1').getBytes();

  // Attribute: contentType = id-data
  const contentTypeAttr = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        oidContentType,
      ),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, oidData),
      ]),
    ],
  );

  // Attribute: signingTime
  const signingTimeAttr = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        oidSigningTime,
      ),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.UTCTIME,
          false,
          formatUtcTime(signingTime),
        ),
      ]),
    ],
  );

  // Attribute: messageDigest = SHA-256 of PDF byte ranges
  const messageDigestAttr = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SEQUENCE,
    true,
    [
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        oidMessageDigest,
      ),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
        asn1.create(
          asn1.Class.UNIVERSAL,
          asn1.Type.OCTETSTRING,
          false,
          pdfHash.toString('binary'),
        ),
      ]),
    ],
  );

  // Build the SET of attributes
  // Tag 0x31 = UNIVERSAL SET (constructed)
  const signedAttrs = asn1.create(
    asn1.Class.UNIVERSAL,
    asn1.Type.SET,
    true,
    [contentTypeAttr, signingTimeAttr, messageDigestAttr],
  );

  // DER-encode
  const derBytes = asn1.toDer(signedAttrs);
  return Buffer.from(derBytes.getBytes(), 'binary');
}

/**
 * Formats a Date as UTCTime string per ASN.1 (YYMMDDHHMMSSZ)
 */
function formatUtcTime(date: Date): string {
  const y = date.getUTCFullYear().toString().slice(-2);
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  const h = date.getUTCHours().toString().padStart(2, '0');
  const min = date.getUTCMinutes().toString().padStart(2, '0');
  const s = date.getUTCSeconds().toString().padStart(2, '0');
  return `${y}${m}${d}${h}${min}${s}Z`;
}
