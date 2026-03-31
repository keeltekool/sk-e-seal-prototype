import { PDFDocument } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import {
  findByteRange,
  DEFAULT_SIGNATURE_LENGTH,
  DEFAULT_BYTE_RANGE_PLACEHOLDER,
  SUBFILTER_ETSI_CADES_DETACHED,
} from '@signpdf/utils';

/** Result of preparing a PDF for signing */
export interface PreparedPdf {
  /** The PDF bytes with signature placeholder inserted */
  preparedPdf: Uint8Array;
  /** Actual byte range [0, beforeSig, afterSig, remaining] */
  byteRange: [number, number, number, number];
  /** Byte offset where the Contents hex string starts (including '<') */
  signaturePlaceholderOffset: number;
  /** Length of the Contents hex string (including '<' and '>') */
  signaturePlaceholderLength: number;
}

/**
 * Prepares a PDF for digital signing by adding a signature placeholder.
 *
 * Inserts a /Sig dictionary with /SubFilter /ETSI.CAdES.detached (PAdES),
 * a ByteRange, and a zeroed Contents field sized for a PAdES B-T CMS signature.
 * The document never leaves the client — only the hash is sent to the signing service.
 */
export async function preparePdf(
  pdfBytes: Uint8Array,
  signatureLength: number = DEFAULT_SIGNATURE_LENGTH,
): Promise<PreparedPdf> {
  const pdfDoc = await PDFDocument.load(pdfBytes);

  pdflibAddPlaceholder({
    pdfDoc,
    reason: 'Qualified E-Seal',
    contactInfo: 'info@example.com',
    name: 'Qualified E-Seal',
    location: 'EU',
    signatureLength,
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
  });

  const preparedBytes = await pdfDoc.save({ useObjectStreams: false });
  // Zero-copy wrap — pdf-lib returns a fresh Uint8Array that owns its ArrayBuffer
  const pdfBuffer = Buffer.from(preparedBytes.buffer, preparedBytes.byteOffset, preparedBytes.byteLength);

  const { byteRangePlaceholder, byteRangePlaceholderPosition } =
    findByteRange(pdfBuffer, DEFAULT_BYTE_RANGE_PLACEHOLDER);

  if (!byteRangePlaceholder || byteRangePlaceholderPosition === undefined) {
    throw new Error('ByteRange placeholder not found in prepared PDF');
  }

  const byteRangeEnd = byteRangePlaceholderPosition + byteRangePlaceholder.length;
  const contentsTagPos = pdfBuffer.indexOf('/Contents ', byteRangeEnd);
  const placeholderPos = pdfBuffer.indexOf('<', contentsTagPos);
  const placeholderEnd = pdfBuffer.indexOf('>', placeholderPos);
  const placeholderLengthWithBrackets = placeholderEnd + 1 - placeholderPos;

  const byteRange: [number, number, number, number] = [
    0,
    placeholderPos,
    placeholderPos + placeholderLengthWithBrackets,
    pdfBuffer.length - (placeholderPos + placeholderLengthWithBrackets),
  ];

  // Replace ByteRange placeholder with actual values
  let actualByteRange = `/ByteRange [${byteRange.join(' ')}]`;
  actualByteRange += ' '.repeat(byteRangePlaceholder.length - actualByteRange.length);

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
 * The signature hex string is padded with zeros to fill the entire placeholder.
 */
export function injectSignature(prepared: PreparedPdf, cmsSignatureHex: string): Uint8Array {
  const { preparedPdf, signaturePlaceholderOffset, signaturePlaceholderLength } = prepared;
  const maxHexLength = signaturePlaceholderLength - 2; // exclude < and >

  if (cmsSignatureHex.length > maxHexLength) {
    throw new Error(
      `CMS signature (${cmsSignatureHex.length} hex chars) exceeds placeholder capacity (${maxHexLength} hex chars). ` +
        `Increase signatureLength when calling preparePdf().`,
    );
  }

  const paddedHex = cmsSignatureHex + '0'.repeat(maxHexLength - cmsSignatureHex.length);

  // Zero-copy view for subarray operations
  const pdf = Buffer.from(preparedPdf.buffer, preparedPdf.byteOffset, preparedPdf.byteLength);

  return new Uint8Array(Buffer.concat([
    pdf.subarray(0, signaturePlaceholderOffset),
    Buffer.from(`<${paddedHex}>`),
    pdf.subarray(signaturePlaceholderOffset + signaturePlaceholderLength),
  ]));
}
