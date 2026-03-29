import { PDFDocument } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import {
  findByteRange,
  DEFAULT_SIGNATURE_LENGTH,
  DEFAULT_BYTE_RANGE_PLACEHOLDER,
} from '@signpdf/utils';

/** Result of preparing a PDF for signing */
export interface PreparedPdf {
  /** The PDF bytes with signature placeholder inserted */
  preparedPdf: Uint8Array;
  /**
   * The actual byte range [offset1, length1, offset2, length2]:
   * - [0, placeholderPos] = bytes before the Contents hex string
   * - [placeholderEnd, remainingLength] = bytes after the Contents hex string
   */
  byteRange: [number, number, number, number];
  /** Byte offset where the Contents hex string starts (including '<') */
  signaturePlaceholderOffset: number;
  /** Length of the Contents hex string (including '<' and '>') */
  signaturePlaceholderLength: number;
}

/**
 * Prepares a PDF for digital signing by adding a signature placeholder.
 *
 * This inserts a /Sig dictionary with /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached,
 * a ByteRange placeholder, and a zeroed Contents field sized for a PAdES B-T CMS signature.
 *
 * CSC v2 spec context: The client prepares the PDF locally — the document never
 * leaves the client side. Only the hash is sent to the signing service.
 */
export async function preparePdf(
  pdfBytes: Uint8Array,
  signatureLength: number = DEFAULT_SIGNATURE_LENGTH,
): Promise<PreparedPdf> {
  // Load the PDF
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Add signature placeholder using @signpdf/placeholder-pdf-lib
  pdflibAddPlaceholder({
    pdfDoc,
    reason: 'E-Seal by SK ID Solutions',
    contactInfo: 'e-seal@sk.ee',
    name: 'Qualified E-Seal',
    location: 'Estonia',
    signatureLength,
  });

  // Save with specific options to preserve structure
  const preparedBytes = await pdfDoc.save({ useObjectStreams: false });
  const pdfBuffer = Buffer.from(preparedBytes);

  // Find the ByteRange placeholder that was inserted
  const { byteRangePlaceholder, byteRangePlaceholderPosition } =
    findByteRange(pdfBuffer, DEFAULT_BYTE_RANGE_PLACEHOLDER);

  if (!byteRangePlaceholder || byteRangePlaceholderPosition === undefined) {
    throw new Error('ByteRange placeholder not found in prepared PDF');
  }

  // Compute actual byte ranges — same logic as @signpdf/signpdf
  const byteRangeEnd =
    byteRangePlaceholderPosition + byteRangePlaceholder.length;
  const contentsTagPos = pdfBuffer.indexOf('/Contents ', byteRangeEnd);
  const placeholderPos = pdfBuffer.indexOf('<', contentsTagPos);
  const placeholderEnd = pdfBuffer.indexOf('>', placeholderPos);
  const placeholderLengthWithBrackets = placeholderEnd + 1 - placeholderPos;

  // ByteRange: [0, beforeSig, afterSig, remaining]
  const byteRange: [number, number, number, number] = [
    0,
    placeholderPos,
    placeholderPos + placeholderLengthWithBrackets,
    pdfBuffer.length - (placeholderPos + placeholderLengthWithBrackets),
  ];

  // Replace the ByteRange placeholder with the actual values
  let actualByteRange = `/ByteRange [${byteRange.join(' ')}]`;
  actualByteRange += ' '.repeat(
    byteRangePlaceholder.length - actualByteRange.length,
  );

  const finalPdf = Buffer.concat([
    pdfBuffer.subarray(0, byteRangePlaceholderPosition),
    Buffer.from(actualByteRange),
    pdfBuffer.subarray(byteRangeEnd),
  ]);

  return {
    preparedPdf: new Uint8Array(finalPdf),
    byteRange,
    signaturePlaceholderOffset: placeholderPos,
    signaturePlaceholderLength: placeholderLengthWithBrackets,
  };
}

/**
 * Injects a hex-encoded CMS signature into the prepared PDF at the placeholder position.
 *
 * The signature hex string is padded with zeros to fill the entire placeholder.
 */
export function injectSignature(
  preparedPdf: Uint8Array,
  cmsSignatureHex: string,
  signaturePlaceholderOffset: number,
  signaturePlaceholderLength: number,
): Uint8Array {
  // The placeholder includes < and >, so the actual hex content space is length - 2
  const maxHexLength = signaturePlaceholderLength - 2;

  if (cmsSignatureHex.length > maxHexLength) {
    throw new Error(
      `CMS signature (${cmsSignatureHex.length} hex chars) exceeds placeholder capacity (${maxHexLength} hex chars). ` +
        `Increase signatureLength when calling preparePdf().`,
    );
  }

  // Pad with zeros to fill the placeholder
  const paddedHex =
    cmsSignatureHex + '0'.repeat(maxHexLength - cmsSignatureHex.length);

  const pdf = Buffer.from(preparedPdf);
  const before = pdf.subarray(0, signaturePlaceholderOffset);
  const signatureContent = Buffer.from(`<${paddedHex}>`);
  const after = pdf.subarray(
    signaturePlaceholderOffset + signaturePlaceholderLength,
  );

  return new Uint8Array(Buffer.concat([before, signatureContent, after]));
}
